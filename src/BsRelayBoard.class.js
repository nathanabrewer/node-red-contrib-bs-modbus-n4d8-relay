const EventEmitter = require('events');
class BsRelayBoard  extends EventEmitter {

    constructor(relayHelper, address, intervalTime, numberOfInputs){
        super()
        this.relayHelper = relayHelper
        this.numberOfInputs = numberOfInputs
        this.address = address & 0xFF
        this.relay_states = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

        if(typeof intervalTime !== 'undefined') {
            intervalTime = intervalTime + (20*address)
            this.interval = setInterval(() => {
                this.poll()
            }, intervalTime)
        }

        this.relayHelper.on("Rx", (rxEvent) => {

            if(rxEvent.address == this.address && rxEvent.crc){
                this.handleFunctionResponse(rxEvent.function, rxEvent.data)
            }

        })

    }

    poll() {
        if(this.relayHelper.portIsOpen){
            this.readInputs()
        }
    }

    close(){
        if(typeof this.interval !== 'undefined'){
            clearInterval(this.interval)
        }
    }

    sendWithCrc(buffer){
        return this.relayHelper.sendWithCrc(buffer)
    }

    timeout(time, prom) {
        let timer;
        return Promise.race([
            prom,
            new Promise((_r, rej) => timer = setTimeout(rej, time))
        ]).finally(() => clearTimeout(timer));
    }

    setRelay(relayAddress, targetState, delay) {

        console.log({ text: "Relay: " + relayAddress + ", Delay: " + delay });
        var request = [
            this.address,               // address, make sure it fits 0xFF mask
            0x06,                       // Modbus Function 06
            0x00, relayAddress & 0xFF,  //
        ]
        if (targetState == "MOMENT") {
            console.log("Momentary Request")
            request.push(0x05)
        } else {
            if (targetState) {
                request.push(0x01)
            } else {
                request.push(0x02)
            }
        }
        request.push(delay & 0xFF)

        var buffer = Buffer.from(request);
        
        let self = this
        return this.timeout(
            1000,
            new Promise( (resolve, reject) => {
                self.on("WRITE_SINGLE_SUCCESS", (d) => {
                    console.log("PROMISE IS ALIVE!!!", d)
                    self.removeAllListeners("WRITE_SINGLE_SUCCESS")
                    resolve()
                })
                this.sendWithCrc(buffer)
            })
        )
    }

    readInput(pin) {
        return this.relay_states[pin]
    }
    readInputs() {
        var request = [
            this.address,   // address, make sure it fits 0xFF mask
            0x03,           // Modbus Function 03
            0x00, 0x81,     // 0x0081 is first register of inputs
            0x00, 0x0C      // Read length of 0x0C or 12
        ]
        var buffer = Buffer.from(request);
        return this.sendWithCrc(buffer)
    }

    setInterlock = function (mode) {
        var request = [
            this.address,           // address, make sure it fits 0xFF mask
            0x06,                   // Modbus Function 06
            0x00, 0xFD
        ]
        switch (mode) {
            case 'unrelated':
                request.push(0x00)
                request.push(0x00)
                break;
            case 'self':
                request.push(0x00)
                request.push(0x01)
                break;
            case 'interlocking':
                request.push(0x00)
                request.push(0x02)
                break;
            case 'momentary':
                request.push(0x00)
                request.push(0x03)
                break;
            case 'interlock-2':
                request.push(0x00)
                request.push(0x04)
                break;
            default:
                request.push(0x00)
                request.push(0x00)
        }
        var buffer = Buffer.from(request);
        return this.sendWithCrc(buffer)
    }

    handleFunctionResponse(functionCode, data){

        console.log("handleFunctionResponse", functionCode, data)
        //Read Multiple Holding Registers Response
        if(functionCode == 0x3){
            if(data[0] == 0x18){
                var inputValues = data.slice(1, data.length - 1)
                return this.saveReadRelayStates(inputValues)
            }
        }

        //Write Single Holding Register Response
        /*             []Address
                          []Function
                             [- -]Register Address  uint16
                                   [- -]Written value uint16
            Tx <Buffer 01 06 00 0c 05 10 4b 55>
            Rx <Buffer 01 06 00 0c 05 10 4b 55>
        */
        if(functionCode == 0x6) {
            let writeSingleSuccess = {
                register: data[0] << 8 | data[1] ,
                value: data[2] << 8 | data[2]
            }

            this.emit("WRITE_SINGLE_SUCCESS", writeSingleSuccess)
            console.log('writeSingleSuccess', writeSingleSuccess)

            return
        }

        console.log("Unhandled Response", functionCode, data)


        // if(data[1] == 0x3 && data[2] == 0x18){
        //     let length = data.length - 4
        //     let responseData = data.slice(4, length)
        //     return this.handleInputStates(address, responseData)
        // }

    }

    saveReadRelayStates(d) {
        if(typeof this.numberOfInputs !== 'undefined'){
            d = d.slice(0,this.numberOfInputs*2)
        }

        let data = []
        for(let i = 0; i < this.numberOfInputs; i++){
            let pos = (i*2)+1
            data.push(d[pos]);
        }
        console.log(data)


        for(let i = 0; i < this.numberOfInputs; i++){
            if(this.relay_states[i] != data[i]){
                let eventName = "INPUT"+i+"_CHANGE"
                let eventValue = data[i]
                this.emit(eventName, eventValue)
                this.emit("INPUT_CHANGE", {input:i, value: data[i]})
                console.log(eventName, eventValue)
            }
        }

        this.relay_states = data
        this.emit("INPUT_UPDATE", data)

    }

}

module.exports = BsRelayBoard