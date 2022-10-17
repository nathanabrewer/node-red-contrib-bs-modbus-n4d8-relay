

const BsRelayHelper = require('../src/BsRelayHelper.class.js')

module.exports = function(RED) {

    function BSModbusInterface(n) {
        RED.nodes.createNode(this,n);

        let relayHelper = new BsRelayHelper(n.port, parseInt(n.baudRate))
        this.relayHelper = relayHelper

        this.configAttributes = n

        this.on('close', function(removed, done) {

            if (removed) {
                // This node has been disabled/deleted
            } else {
                // This node is being restarted
            }
            console.log("MODBUS HELPER, CLOSE PORT")
            relayHelper.close()

            done();
        });

    }

    RED.nodes.registerType("bs-modbus-interface",BSModbusInterface);
}