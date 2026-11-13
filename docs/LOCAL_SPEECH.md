# Local speech recognition

Settings are separated into **AI suggestions**, **Recognition**, and **Sound**.
The first two have independent local/external connection choices. Browsing a
source never switches a running provider. Use an installed speech model or
explicitly apply the API provider to change recognition, including during a call.
AI connections retain OpenCode, provider keys, compatible endpoints, and cURL;
local AI continues to use Ollama. Sound contains capture devices and an explicit
microphone test; opening settings does not record audio.

## Engine and models

Recognition uses `sherpa-onnx-node` 2.0.1 with CPU inference in a separate Node
process. Native failures do not run in Electron's main or renderer process.
PCM16 input is bounded to 20 seconds while inference is busy. Speech is decoded
at phrase boundaries or in approximately six-second blocks; these offline models
produce final text rather than cloud-style interim streaming hypotheses.
There is **no cloud fallback** when local recognition is selected. Translation
and AI replies still use their separately configured connections.

The shipped catalog pins model revisions, expected sizes, and SHA256 for every
ONNX/vocabulary file. Only the selected files are downloaded, without executable
archives, into `userData/local-speech`. Downloads use Electron's network session
and the application's system-proxy preference, support Range resumption and
cancel/pause, and become installed only after verification. Activation verifies
the hashes again and checks native loading before updating the saved provider.

| Model | Files, decimal MB | License |
| --- | ---: | --- |
| Zipformer small RU (Vosk small Russian ONNX) | 26.7 | Apache-2.0 |
| Whisper tiny multilingual INT8 ONNX | 103.6 | MIT |
| Whisper base multilingual INT8 ONNX | 160.6 | MIT |
| Whisper small multilingual INT8 ONNX | 375.5 | MIT |

These sizes differ from GGML/whisper.cpp and classic Vosk distributions and do
not describe RAM or the engine download. Sources and exact pins are in
`shared/localSpeech.ts`. The old prototype's separate Vosk entry is represented
by its compact ONNX model rather than by adding a second native runtime.

Model/engine documentation: [sherpa offline API](https://k2-fsa.github.io/sherpa/onnx/javascript-api/examples/api_non_streaming_asr.html),
[Russian Zipformer](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html),
[Whisper license](https://github.com/openai/whisper/blob/main/LICENSE).

## Test recordings and measurements

Choose a local WAV (PCM16 or float32, mono/stereo, 8–96 kHz, 0.1–120 seconds,
up to 50 MB) to compare installed models. Audio is never uploaded. Each model
runs in a fresh process on the same recording. Time includes model loading;
memory is that process's peak RSS, not the whole application. Word error rate is
shown only when reference text is provided; punctuation and case are ignored.
Testing and changing the active recognition provider are mutually exclusive.

Checks:

```sh
pnpm test
pnpm run build:web:raw
pnpm run build:electron:raw
pnpm run test:ui
```

An explicit integration check downloads a pinned model plus the author's Russian
sample to `temp/local-speech-integration`, verifies it, and performs real inference:

```sh
node scripts/test-local-speech.cjs
node scripts/test-local-speech.cjs whisper-tiny
```

The Electron build is required first. Real inference and the live PCM adapter
were checked on Windows x64. Other platforms use the dependency's optional
platform packages; they have not been exercised here. The installer unpacks the
complete sherpa packages so their native modules and ONNX Runtime libraries stay
together. Models are user data and are not embedded in the installer.
