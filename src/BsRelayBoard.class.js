
class BsRelayBoard {

    constructor(relayHelper, address, intervalTime, numberOfInputs){
        this.relayHelper = relayHelper
        this.numberOfInputs = numberOfInputs
        this.address = address & 0xFF
        this.relay_states = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        this.inputUpdateCallback = null


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

    setInterlock = function (relayAddress, mode) {
        var request = [
            this.address,           // address, make sure it fits 0xFF mask
            0x06,                   // Modbus Function 06
            relayAddress & 0xFF,    // address of input to modify
            0xFD, 0xFD
        ]
        switch (mode) {
            case 'none':
                request.push(0x00)
                break;
            case 'toggle':
                request.push(0x01)
                break;
            case 'lockout':
                request.push(0x02)
                break;
            case 'momentary':
                request.push(0x03)
                break;
            default:
                request.push(0x00)
        }
        var buffer = Buffer.from(request);
        return this.sendWithCrc(buffer)
    }



    onInputUpdate(callable) {
        this.inputUpdateCallback = callable
    }

    saveReadRelayStates(data) {
        if(typeof this.numberOfInputs !== 'undefined'){
            data = data.slice(0,this.numberOfInputs)
        }
        this.relay_states = data
        if (typeof this.inputUpdateCallback === 'function') {
            this.inputUpdateCallback(data)
        }
    }

}

module.exports = BsRelayBoard