const pick = (list: string[]) => list.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** MP4 first: it plays and seeks everywhere. WebM is the fallback for browsers that cannot write it. */
export const videoMime = () => pick(['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'])
export const audioMime = () => pick(['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'])

export async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer()
  const AC: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext
  const ctx = new AC()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(buf)
  } finally {
    void ctx.close()
  }
  const length = Math.max(1, Math.ceil(decoded.duration * 16000))
  const off = new OfflineAudioContext(1, length, 16000)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  return (await off.startRendering()).getChannelData(0)
}

export type TranscribeEvent = { type: 'download'; ratio: number; mb: number } | { type: 'ready' }

export function transcribe(audio: Float32Array, on: (e: TranscribeEvent) => void): { done: Promise<string>; cancel: () => void } {
  const w = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  const done = new Promise<string>((resolve, reject) => {
    w.onmessage = (e) => {
      const d = e.data
      if (d.type === 'done') { resolve(d.text); w.terminate() }
      else if (d.type === 'error') { reject(new Error(d.message)); w.terminate() }
      else on(d)
    }
    w.onerror = (e) => { reject(new Error(e.message || 'Transcriber failed to start')); w.terminate() }
  })
  w.postMessage({ audio }, [audio.buffer as ArrayBuffer])
  return { done, cancel: () => w.terminate() }
}

export async function storageInfo(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const e = await navigator.storage.estimate()
  return { used: e.usage ?? 0, quota: e.quota ?? 0 }
}
