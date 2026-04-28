import './processor-shim'

// Captures input samples and posts Float32 chunks to the main thread.
// Main thread accumulates chunks then encodes WAV (see src/audio/recorder.ts).
export class RecorderProcessor extends AudioWorkletProcessor {
  private recording = false

  constructor() {
    super()
    ;(this as any).port.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { command?: 'start' | 'stop' }
      if (data.command === 'start') this.recording = true
      else if (data.command === 'stop') {
        this.recording = false
        ;(this as any).port.postMessage({ type: 'done' })
      }
    }
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    if (!this.recording) return true
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channels = input.map((ch) => new Float32Array(ch))
    ;(this as any).port.postMessage({ type: 'chunk', channels })
    return true
  }
}

registerProcessor('recorder', RecorderProcessor)
