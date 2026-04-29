declare module 'soundtouchjs' {
  export class SoundTouch {
    tempo: number
    pitchSemitones: number
    rate: number
  }
  export class SimpleFilter {
    constructor(
      source: {
        extract(target: Float32Array, numFrames: number, sourcePosition: number): number
      },
      pipe: SoundTouch,
      callback?: () => void,
    )
    extract(target: Float32Array, numFrames: number): number
    clear(): void
    sourcePosition: number
    position: number
  }
}
