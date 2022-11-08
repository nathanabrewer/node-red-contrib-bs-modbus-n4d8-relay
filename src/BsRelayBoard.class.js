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
        return this.sendWithCrc(buffer)
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


    saveReadRelayStates(data) {
        if(typeof this.numberOfInputs !== 'undefined'){
            data = data.slice(0,this.numberOfInputs)
        }

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