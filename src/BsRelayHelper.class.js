
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
        this.parser = this.port.pipe(new InterByteTimeoutParser({ interval: 20 }))
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

        //TODO: CRC CHECK?
console.log(data)
        let address = data[0]
        //if this is 0x3 and 0x18 then it is a response to input state query
        if(data[1] == 0x3 && data[2] == 0x18){
            let length = data.length - 4
            return this.handleInputStates(data[0], data.slice(4, length))
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

    addModbusCRC(bufferArray) {
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
        return Buffer.concat([bufferArray, crcBuffer])
    }

    sendWithCrc(data) {
        let buffer = this.addModbusCRC(data)
        this.buffersPending.push(buffer)
    }

    sendNext(){
        if(this.buffersPending.length == 0) return

        console.log("sendNext has "+this.buffersPending.length)

        let buffer = this.buffersPending.pop()
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