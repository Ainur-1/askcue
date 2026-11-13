import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { availableParallelism } from 'node:os';
import { getSpeechModel } from '../../shared/localSpeech';

let recognizer: any;
process.on('message', (message: any) => {
  try {
    const started = performance.now();
    const model = getSpeechModel(message.modelId);
    if (!recognizer) {
      const sherpa = require('sherpa-onnx-node');
      const file = (suffix: string) => path.join(message.directory, model.files.find(item => item.name.endsWith(suffix))!.name);
      const modelConfig = {
        tokens: file('tokens.txt'), numThreads: Math.min(4, Math.max(1, availableParallelism() - 1)), provider: 'cpu', debug: false,
        ...(model.engine === 'transducer' ? {transducer: {encoder: file('encoder.int8.onnx'), decoder: file('decoder.int8.onnx'), joiner: file('joiner.int8.onnx')}}
          : {whisper: {encoder: file('encoder.int8.onnx'), decoder: file('decoder.int8.onnx'), language: message.language, task: 'transcribe', tailPaddings: -1}}),
      };
      recognizer = new sherpa.OfflineRecognizer({featConfig: {sampleRate: 16000, featureDim: 80}, modelConfig, decodingMethod: 'greedy_search'});
    }
    const stream = recognizer.createStream();
    stream.acceptWaveform({samples: new Float32Array(message.samples), sampleRate: message.sampleRate});
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    process.send?.({id: message.id, result: {modelId: model.id, text: result.text.trim(), durationMs: Math.round(performance.now() - started), audioSeconds: message.samples.length / message.sampleRate, peakMemoryBytes: process.resourceUsage().maxRSS * 1024}});
  } catch (error) { process.send?.({id: message.id, error: error instanceof Error ? error.message : String(error)}); }
});
process.on('disconnect', () => process.exit(0));
