/** Pinned ONNX assets. Sizes include only the model and vocabulary, not runtime/RAM. */
export interface SpeechAsset { name: string; url: string; bytes: number; sha256: string }
export interface SpeechModel { id: string; name: string; engine: 'transducer' | 'whisper'; languages: 'ru' | 'multilingual'; license: string; source: string; files: SpeechAsset[] }
export const SPEECH_MODELS: SpeechModel[] = [
  {
    "id": "zipformer-ru",
    "name": "Zipformer small RU",
    "engine": "transducer",
    "languages": "ru",
    "license": "Apache-2.0",
    "source": "https://huggingface.co/alphacep/vosk-model-small-ru",
    "files": [
      {
        "name": "decoder.int8.onnx",
        "url": "https://huggingface.co/alphacep/vosk-model-small-ru/resolve/4d68c4017bcfa44e2a79581f7933339e916a35da/am/decoder.int8.onnx",
        "bytes": 1307950,
        "sha256": "435752764fb93c3e3e8d2537b9d008700114c7e126461e7808de30ef4aed4696"
      },
      {
        "name": "encoder.int8.onnx",
        "url": "https://huggingface.co/alphacep/vosk-model-small-ru/resolve/4d68c4017bcfa44e2a79581f7933339e916a35da/am/encoder.int8.onnx",
        "bytes": 25090964,
        "sha256": "75653125bf3621d86a2b140ffd84a1c3b7610fc8cd49f2b6d70cf5786be0d085"
      },
      {
        "name": "joiner.int8.onnx",
        "url": "https://huggingface.co/alphacep/vosk-model-small-ru/resolve/4d68c4017bcfa44e2a79581f7933339e916a35da/am/joiner.int8.onnx",
        "bytes": 259572,
        "sha256": "a93e0afc2c82e94d366157b4a8b5f4cba6973ddea8f36ac94010b430be7823f1"
      },
      {
        "name": "tokens.txt",
        "url": "https://huggingface.co/alphacep/vosk-model-small-ru/resolve/4d68c4017bcfa44e2a79581f7933339e916a35da/lang/tokens.txt",
        "bytes": 6388,
        "sha256": "93bbbc0bae6b78c0bbb743d4aa9fded3bb5ff3aac5f0200e3a769a5a05e0fdf6"
      }
    ]
  },
  {
    "id": "whisper-tiny",
    "name": "Whisper tiny",
    "engine": "whisper",
    "languages": "multilingual",
    "license": "MIT",
    "source": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny",
    "files": [
      {
        "name": "tiny-decoder.int8.onnx",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/65176e2deb88badc814a94058666cadccc29b61c/tiny-decoder.int8.onnx",
        "bytes": 89855401,
        "sha256": "d2fece8dd42771f1df975c6c0445770d0c292bf7547c2cae04a6c0cc57540925"
      },
      {
        "name": "tiny-encoder.int8.onnx",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/65176e2deb88badc814a94058666cadccc29b61c/tiny-encoder.int8.onnx",
        "bytes": 12937772,
        "sha256": "d24fb083ae3b1041fc24e97971d60e280c9342201fbb67b0ab428a8b4a51a434"
      },
      {
        "name": "tiny-tokens.txt",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/65176e2deb88badc814a94058666cadccc29b61c/tiny-tokens.txt",
        "bytes": 816730,
        "sha256": "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126"
      }
    ]
  },
  {
    "id": "whisper-base",
    "name": "Whisper base",
    "engine": "whisper",
    "languages": "multilingual",
    "license": "MIT",
    "source": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base",
    "files": [
      {
        "name": "base-decoder.int8.onnx",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/bb53ee204431c90d314c1cc08d28d23e5b7927cc/base-decoder.int8.onnx",
        "bytes": 130672026,
        "sha256": "9759d217388a01b3a4c7c15533201067b48ae819c4daafc8624e64b9409dc02d"
      },
      {
        "name": "base-encoder.int8.onnx",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/bb53ee204431c90d314c1cc08d28d23e5b7927cc/base-encoder.int8.onnx",
        "bytes": 29120534,
        "sha256": "0b8fb1304b6109976038efff5ace81720e00386f3ff6b54ee8c75291ca0a1e11"
      },
      {
        "name": "base-tokens.txt",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/bb53ee204431c90d314c1cc08d28d23e5b7927cc/base-tokens.txt",
        "bytes": 816730,
        "sha256": "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126"
      }
    ]
  },
  {
    "id": "whisper-small",
    "name": "Whisper small",
    "engine": "whisper",
    "languages": "multilingual",
    "license": "MIT",
    "source": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small",
    "files": [
      {
        "name": "small-decoder.int8.onnx",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/8f3c18b358db4d1f2fc1eae49d75cd20989e4309/small-decoder.int8.onnx",
        "bytes": 262226114,
        "sha256": "acad50b5c782696e91b55914cc5ab4f756f1532f76e22aa6fc615f39fb69a8ee"
      },
      {
        "name": "small-encoder.int8.onnx",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/8f3c18b358db4d1f2fc1eae49d75cd20989e4309/small-encoder.int8.onnx",
        "bytes": 112442483,
        "sha256": "4cbe7b22fa9026b843b60a68640c747de05bafb1a11b57edc0e66c232d9f33a9"
      },
      {
        "name": "small-tokens.txt",
        "url": "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/8f3c18b358db4d1f2fc1eae49d75cd20989e4309/small-tokens.txt",
        "bytes": 816730,
        "sha256": "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126"
      }
    ]
  }
];
export type DownloadPhase = 'available' | 'downloading' | 'paused' | 'verifying' | 'installed' | 'error';
export interface SpeechModelStatus { id: string; phase: DownloadPhase; received: number; total: number; error?: string }
export interface LocalSpeechState { models: SpeechModelStatus[]; activeModel: string | null; activeProvider: string; busy: boolean; systemAudioEnabled: boolean }
export interface SpeechTestResult { modelId: string; text: string; durationMs: number; audioSeconds: number; peakMemoryBytes: number; error?: string }
export interface SpeechTestAudio { name: string; seconds: number }
export interface SpeechTestReport { results: SpeechTestResult[]; audio: SpeechTestAudio }
export interface SpeechReply { success: boolean; error?: string }
export interface LocalSpeechAPI {
 getLocalSpeechState: () => Promise<LocalSpeechState>;
 downloadSpeechModel: (id: string) => Promise<SpeechReply>;
 pauseSpeechModel: (id: string) => Promise<SpeechReply>;
 removeSpeechModel: (id: string) => Promise<SpeechReply>;
 activateSpeechModel: (id: string) => Promise<SpeechReply>;
 chooseSpeechTestAudio: () => Promise<{success: boolean; audio?: SpeechTestAudio; cancelled?: boolean; error?: string}>;
 testSpeechModels: (ids: string[]) => Promise<{success: boolean; report?: SpeechTestReport; error?: string}>;
 cancelSpeechTest: () => Promise<SpeechReply>;
 setSystemAudioCapture: (enabled: boolean) => Promise<SpeechReply>;
 onLocalSpeechChanged: (callback: (state: LocalSpeechState) => void) => () => void;
 onSttProviderChanged: (callback: (provider: string) => void) => () => void;
}
export function getSpeechModel(id: string): SpeechModel {
 const model = SPEECH_MODELS.find(item => item.id === id);
 if (!model) throw new Error('Unknown local speech model');
 return model;
}
/** Word error count; punctuation and case are ignored, numbers remain meaningful. */
export function wordErrors(reference: string, actual: string): { errors: number; words: number; rate: number | null } {
 const words = (text: string) => text.toLocaleLowerCase().replace(/ё/g,'е').match(/[\p{L}\p{N}]+/gu) || [];
 const expected = words(reference), received = words(actual);
 let previous = Array.from({length: received.length + 1}, (_,i) => i);
 for (let i=0;i<expected.length;i++) {
  const next=[i+1];
  for (let j=0;j<received.length;j++) next.push(Math.min(previous[j+1]+1,next[j]+1,previous[j]+Number(expected[i]!==received[j])));
  previous=next;
 }
 const errors=previous[received.length];
 return {errors,words:expected.length,rate:expected.length ? errors/expected.length : null};
}
