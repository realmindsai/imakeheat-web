// Drives a processor's process() method with synthetic Float32 buffers.
// Mirrors the AudioWorklet calling convention: process(inputs, outputs, parameters).

export interface ProcessorLike {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
  port?: { onmessage: ((e: MessageEvent) => void) | null }
}

export function runProcessor(
  proc: ProcessorLike,
  input: Float32Array[],
  blockSize = 128,
): Float32Array[] {
  const channels = input.length
  const totalFrames = input[0].length
  const blocks = Math.ceil(totalFrames / blockSize)
  const out: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(totalFrames))

  for (let b = 0; b < blocks; b++) {
    const start = b * blockSize
    const end = Math.min(start + blockSize, totalFrames)
    const len = end - start

    const inBlock = input.map((ch) => ch.subarray(start, end))
    const outBlock = Array.from({ length: channels }, () => new Float32Array(len))

    proc.process([inBlock], [outBlock], {})

    for (let c = 0; c < channels; c++) {
      out[c].set(outBlock[c], start)
    }
  }

  return out
}

// Send a message to the processor as if from main-thread postMessage.
export function postToProcessor(proc: ProcessorLike, data: unknown) {
  proc.port?.onmessage?.({ data } as MessageEvent)
}
