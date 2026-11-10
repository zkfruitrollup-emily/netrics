import { pipeline } from '@huggingface/transformers'

/* Runs Whisper in the browser. The model downloads once, then the Cache API serves it. Audio never leaves the device. */
const MODEL = 'onnx-community/whisper-tiny.en'
let asr: Promise<any> | null = null
const files = new Map<string, { loaded: number; total: number }>()

function load() {
  return (asr ??= (pipeline as any)('automatic-speech-recognition', MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: any) => {
      if (p.status === 'progress' && p.total) {
        files.set(p.file, { loaded: p.loaded, total: p.total })
        let l = 0, t = 0
        files.forEach((f) => { l += f.loaded; t += f.total })
        postMessage({ type: 'download', ratio: l / t, mb: Math.round(t / 1e6) })
      }
    },
  }))
}

self.onmessage = async (e: MessageEvent<{ audio: Float32Array }>) => {
  try {
    const run = await load()
    postMessage({ type: 'ready' })
    const out = await run(e.data.audio, { chunk_length_s: 30, stride_length_s: 5 })
    postMessage({ type: 'done', text: String(out.text ?? '').trim() })
  } catch (err) {
    asr = null
    postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
