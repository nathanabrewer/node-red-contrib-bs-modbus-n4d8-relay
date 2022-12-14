

module.exports = function(RED) {

    "use strict";


    // The main node definition - most things happen in here
    function bsRelayNode(config) {
        // Create a RED node
        RED.nodes.createNode(this,config);

        // Store local copies of the node configuration (as defined in the .html)
        this.topic = config.topic;
        let node = this;

        //fetch the config for server... (i.e. config.server is just a reference to the node)
        let modbusInterfaceNode = RED.nodes.getNode(config.modbusInterface);
        let relayHelper = modbusInterfaceNode.relayHelper
        let pollInterval = parseInt(config.pollInterval)
        let numberOfInputs = parseInt(config.numberOfInputs)
        let board = relayHelper.addBoard(config.boardAddress, pollInterval, numberOfInputs)

        setTimeout(()=>{
            board.setInterlock(config.inputRelationship)
        }, 1000)

        board.on("INPUT_UPDATE", (data) => {
            node.status({
                text: data.join(",")
            })
        })

        board.on("INPUT_CHANGE", (data) => {
            node.send(data)
        })



        //Actual Input
        this.on('input', function (msg) {

            switch(msg.topic) {
                case "MOMENT":
                    board.setRelay(msg.payload, "MOMENT", 0x10).then(result => {
                        msg.resultMessage = result
                        msg.success = true
                        node.send(msg)
                    }).catch(err => {
                        msg.success = false
                        msg.resultErr = err
                        node.send(msg)
                    })
                    break;

                case "READ":
                    board.readInput(msg.payload)
                    break;

                case "ON":
                    board.setRelay(msg.payload, true).then(result => {
                        msg.resultMessage = result
                        msg.success = true
                        node.send(msg)
                    }).catch(err => {
                        msg.success = false
                        msg.resultErr = err
                        node.send(msg)
                    })
                    break;

                case "OFF":
                    board.setRelay(msg.payload, false).then(result => {
                        msg.resultMessage = result
                        msg.success = true
                        node.send(msg)
                    }).catch(err => {
                        msg.success = false
                        msg.resultErr = err
                        node.send(msg)
                    })
                    break;

                default:
                    node.warn("Unknown request")
                    node.warn(msg.topic)


            }
        })

        this.on('close', function(removed, done) {

            if (removed) {
                // This node has been disabled/deleted
            } else {
                // This node is being restarted
            }
            console.log("BOARD CLEARING INTERVAL")
            board.close()

            done();
        });


    }



    RED.nodes.registerType("BS Modbus N4D8 Relay",bsRelayNode);

}
