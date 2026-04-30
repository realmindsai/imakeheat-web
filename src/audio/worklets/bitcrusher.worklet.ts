import './processor-shim'

// SP-1200 vibe: pre-quantize tanh soft-clip on the 12-bit path only.
// Drive sits BEFORE the quantizer so the nonlinearity shapes what gets
// rounded — that's the bit that gives drums the "hit" people associate
// with the SP. Other bit depths are untouched.
const SP_DRIVE = 1.9952623149688795 // +6 dB

export class BitCrusherProcessor extends AudioWorkletProcessor {
  private bits = 16

  constructor() {
    super()
    ;(this as any).port.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { bits?: number }
      if (typeof data.bits === 'number') {
        this.bits = Math.max(2, Math.min(16, Math.round(data.bits)))
      }
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    if (this.bits >= 16) {
      for (let c = 0; c < input.length; c++) {
        if (output[c]) output[c].set(input[c])
      }
      return true
    }

    const levels = 1 << this.bits      // 2^bits
    const half = levels / 2
    const spVibe = this.bits === 12

    for (let c = 0; c < input.length; c++) {
      const inCh = input[c]
      const outCh = output[c]
      if (!outCh) continue
      for (let i = 0; i < inCh.length; i++) {
        const x = spVibe ? Math.tanh(inCh[i] * SP_DRIVE) : inCh[i]
        const q = Math.max(-half, Math.min(half - 1, Math.round(x * half)))
        outCh[i] = q / half
      }
    }
    return true
  }
}

registerProcessor('bitcrusher', BitCrusherProcessor)
