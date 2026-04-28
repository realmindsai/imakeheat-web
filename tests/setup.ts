import '@testing-library/jest-dom/vitest'

// jsdom's Blob does not implement arrayBuffer(). Swap in Node's native Blob,
// which has full Blob API support on Node 18+.
import { Blob as NodeBlob } from 'buffer'
if (typeof globalThis.Blob === 'undefined' || typeof (new globalThis.Blob([])).arrayBuffer === 'undefined') {
  // @ts-ignore — intentional polyfill
  globalThis.Blob = NodeBlob
}
