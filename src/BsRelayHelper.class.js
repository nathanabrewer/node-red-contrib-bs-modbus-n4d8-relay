
const BsRelayBoard = require('../src/BsRelayBoard.class.js')
const { SerialPort } = require('serialport')
const { InterByteTimeoutParser } = require('@serialport/parser-inter-byte-timeout')

class BsRelayHelper {

    constructor(serialPort, baud){
        this.portAddress = serialPort
        this.baudRate = baud
        this.write_success = 0
        this.write_error = 0
        this.initializePort()
        this.relayBoards = {}
        this.portIsOpen = false
        this.retryOpen = true
        this.buffersPending = []

        this.sendInterval = setInterval( () => {
            this.sendNext()
        }, 30)

    }

    initializePort(){

        this.port = new SerialPort({
            path: this.portAddress,
            baudRate: this.baudRate
        })

        this.port.on('open', () => {
            console.log('Relay Port OPEN.')
            this.portIsOpen = true

        })
        this.parser = this.port.pipe(new InterByteTimeoutParser({ interval: 25 }))
        this.parser.on('data', (data) => {
            this.handleData(data)
        })

        this.port.on('error', function (err) {
            console.log('Error: ', err.message)
        })

        this.port.on('close', () => {
            console.log("Port was closed!")
            this.portIsOpen = false
            if(this.retryOpen) {
                setTimeout(() => {
                    console.log("attempting to reinitialize port")
                    this.initializePort()
                }, 2000)
            }

        })

    }

    handleData(data){

        if (typeof data !== 'object') {
            return;
        }

        let dataPart = data.slice(0, data.length-2)
        let a = data.slice(data.length-2, data.length)
        let b = this.makeCRC16(dataPart)

        let crcOK = (a[0] == b[0] && a[1] == b[1])

        let crcMatchText = crcOK ? "CRC-OK" : "CRC-FAILED"

        console.log("Rx ",crcMatchText, data)

        let address = data[0]
        //if this is 0x3 and 0x18 then it is a response to input state query

        if(!crcOK){
            //Do not continue processing bad data, CRC has failed!
            return
        }

        if(data[1] == 0x3 && data[2] == 0x18){
            let length = data.length - 4
            let responseData = data.slice(4, length)
            return this.handleInputStates(address, responseData)
        }

    }

    handleInputStates(address, inputs){

        this.relayBoards[address].saveReadRelayStates(inputs)
    }

    addBoard(address, pollInterval, numberOfInputs) {
        //if (this.relayBoards[address] !== 'undefined') {
        //    console.log({msg:"relayBoards", data: this.relayBoards})
        //    throw 'Error, board already registered with that address'
        //}
        var board = new BsRelayBoard(this, address, pollInterval, numberOfInputs);
        this.relayBoards[address] = board
        return board
    }

    getBoard(address) {
        if (this.relayBoards[address] === 'undefined') {
            throw 'No such Board!'
        }
        return this.relayBoards[address]
    }
    makeCRC16(bufferArray){
        var crc = 0xFFFF;
        for (var pos = 0; pos < bufferArray.length; pos++) {
            crc ^= bufferArray[pos];
            for (var i = 8; i !== 0; i--) {
                if ((crc & 0x0001) !== 0) {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else
                    crc >>= 1;
            }
        }
        var crcBuffer = new Uint8Array(2)
        crcBuffer[0] = crc & 0xFF
        crcBuffer[1] = crc >> 8
        return Buffer.from(crcBuffer)
    }
    addModbusCRC(bufferArray) {
        let crcBuffer = this.makeCRC16(bufferArray)
        return Buffer.concat([bufferArray, crcBuffer])
    }

    sendWithCrc(data) {
        let buffer = this.addModbusCRC(data)
        this.buffersPending.push(buffer)
    }

    sendNext(){
        if(this.buffersPending.length == 0) return

        let buffer = this.buffersPending.pop()
        console.log("Tx", buffer)
        this.busy = true
        this.port.write(buffer, (err) => {
            if (err) {
                this.write_error++
                return console.log(err.message)
            }
            this.write_success++;
        })
    }

    close(){
        this.retryOpen = false
        this.port.close()
        clearInterval(this.sendInterval)
    }

}

module.exports = BsRelayHelper