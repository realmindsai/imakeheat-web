// ABOUTME: Orchestrates microphone recording via RecorderWorklet and encodes output as WAV.
// ABOUTME: Returns an ActiveRecording handle; call stop() to flush chunks and get a Blob.

import { wavEncode } from './wav'
import type { AudioBufferLike } from './types'

import recorderUrl from './worklets/recorder.worklet.ts?worker&url'

export interface ActiveRecording {
  stop(): Promise<Blob>
}

export async function startRecording(ctx: AudioContext): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const source = ctx.createMediaStreamSource(stream)

  await ctx.audioWorklet.addModule(recorderUrl)
  const node = new AudioWorkletNode(ctx, 'recorder')

  const chunks: Float32Array[][] = []
  let resolveDone: (() => void) | null = null
  const donePromise = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  node.port.onmessage = (ev) => {
    const data = ev.data as
      | { type: 'chunk'; channels: Float32Array[] }
      | { type: 'done' }
    if (data.type === 'chunk') chunks.push(data.channels)
    else if (data.type === 'done') resolveDone?.()
  }

  source.connect(node)
  node.connect(ctx.destination)
  node.port.postMessage({ command: 'start' })

  return {
    async stop(): Promise<Blob> {
      node.port.postMessage({ command: 'stop' })
      await donePromise

      stream.getTracks().forEach((t) => t.stop())
      source.disconnect()
      node.disconnect()

      const channels = chunks[0]?.length ?? 1
      const totalFrames = chunks.reduce((s, c) => s + c[0].length, 0)
      const merged: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(totalFrames))
      let offset = 0
      for (const block of chunks) {
        for (let c = 0; c < channels; c++) merged[c].set(block[c], offset)
        offset += block[0].length
      }

      const buf: AudioBufferLike = {
        numberOfChannels: channels,
        sampleRate: ctx.sampleRate,
        length: totalFrames,
        getChannelData: (c: number) => merged[c],
      }
      return wavEncode(buf)
    },
  }
}
