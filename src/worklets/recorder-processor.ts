class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    this.port.postMessage({ type: 'samples', samples: Array.from(input[0]) });
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
