// At runtime in AudioWorkletGlobalScope, AudioWorkletProcessor and
// registerProcessor are real globals. In vitest (jsdom) they are not.
// This shim provides minimal stand-ins so worklet source files can be
// imported by tests. Tests then instantiate the processor class directly
// and call .process(...) with hand-built buffer arrays.

declare global {
  // The real type lives in lib.dom.d.ts; we only declare it conditionally.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AudioWorkletProcessor {}
  var AudioWorkletProcessor: {
    prototype: AudioWorkletProcessor
    new (): AudioWorkletProcessor
  }
  function registerProcessor(name: string, ctor: any): void
}

if (typeof (globalThis as any).AudioWorkletProcessor === 'undefined') {
  ;(globalThis as any).AudioWorkletProcessor = class {
    port = { onmessage: null as ((e: MessageEvent) => void) | null, postMessage: () => {} }
  }
}

if (typeof (globalThis as any).registerProcessor === 'undefined') {
  ;(globalThis as any).registerProcessor = (_name: string, _ctor: unknown) => {
    /* no-op in tests; production AudioWorkletGlobalScope wires this up */
  }
}

export {}
