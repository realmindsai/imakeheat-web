// ABOUTME: Guards the security headers Netlify serves on every path (security-1x3).
// ABOUTME: imakeheat is not behind Cloudflare, so netlify.toml is the only place they come from.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const toml = readFileSync(resolve(__dirname, '../../netlify.toml'), 'utf8')

function headersFor(path: string): string {
  const blocks = toml.split('[[headers]]').slice(1)
  const block = blocks.find((b) => b.includes(`for = "${path}"`))
  if (!block) throw new Error(`no [[headers]] block for ${path}`)
  return block
}

describe('netlify.toml site-wide security headers', () => {
  const all = () => headersFor('/*')

  it('forbids framing the app', () => {
    expect(all()).toContain('X-Frame-Options = "DENY"')
    expect(all()).toMatch(/Content-Security-Policy = ".*frame-ancestors 'none'/)
  })

  it('blocks plugins and base-tag hijacking', () => {
    expect(all()).toMatch(/Content-Security-Policy = ".*object-src 'none'/)
    expect(all()).toMatch(/Content-Security-Policy = ".*base-uri 'self'/)
  })

  it('sets nosniff and a referrer policy', () => {
    expect(all()).toContain('X-Content-Type-Options = "nosniff"')
    expect(all()).toContain('Referrer-Policy = "strict-origin-when-cross-origin"')
  })

  it('keeps the microphone available to the app itself, since recording needs it', () => {
    expect(all()).toMatch(/Permissions-Policy = ".*microphone=\(self\)/)
    expect(all()).toMatch(/Permissions-Policy = ".*camera=\(\)/)
  })
})
