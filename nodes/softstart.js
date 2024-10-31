module.exports = function (RED) {
    function SoftStartNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Configuration parameters
        const startPower = parseFloat(config.startPower) || 0; // Configurable start value with default of 0
        const duration = parseInt(config.duration) || 5000;
        const stepTime = parseInt(config.stepTime) || 100;
        const mode = config.mode || "exponential"; // Selection between "linear" and "exponential"

        // Calculation of steps and growth rate
        const steps = duration / stepTime;

        // Initialize currentPower from context storage or set to startPower
        let currentPower = node.context().get('currentPower') || startPower;
        let interval;

        // Function to adjust power with linear or exponential transition
        function adjustPower(newTarget, mode) {
            const start = currentPower;
            const target = newTarget;
            const isUp = start < target;
            const growthRate = (mode === "exponential")
                ? Math.pow(Math.max(target, 1) / Math.max(start, 1), 1 / steps)
                : ((target - start) / steps);
            const maxDiff = 0.01;

            let stepCount = 0;

            node.error({ start, target, growthRate, isUp })
            // Set interval to update currentPower towards target
            interval = setInterval(() => {
                stepCount++;
                if (mode === "exponential") {
                    currentPower = Math.max(start, 1) * Math.pow(growthRate, stepCount);
                } else { // linear mode
                    currentPower = start + growthRate * stepCount;
                }

                // Stop interval if target is reached
                if (stepCount > steps || (isUp && currentPower >= target) || (!isUp && currentPower <= target)) {
                    currentPower = target;
                    clearInterval(interval);
                }

                // Save current power to context for persistence
                node.context().set('currentPower', currentPower);

                // Update node status and output
                node.status({ fill: "blue", shape: "dot", text: `Output: ${currentPower.toFixed(2)}` });
                node.send({ payload: currentPower });
            }, stepTime);
        }

        // Event handler for incoming messages
        this.on('input', function (msg) {
            if (msg.payload == undefined || msg.payload == null) {
                return;
            }

            const newTarget = parseFloat(msg.payload);
            if (newTarget == NaN || newTarget === currentPower) {
                return;
            }

            if (interval) clearInterval(interval); // Clear previous interval on new input
            adjustPower(newTarget, mode);
        });

        // Cleanup on node removal
        this.on('close', function () {
            if (interval) {
                clearInterval(interval);
            }
        });
    }

    RED.nodes.registerType("softstart", SoftStartNode);
}
