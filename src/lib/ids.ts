// ABOUTME: ID generation utility — wraps crypto.randomUUID for testability.
// ABOUTME: Use newId() everywhere instead of inlining crypto.randomUUID calls.

export function newId(): string {
  return globalThis.crypto.randomUUID()
}
