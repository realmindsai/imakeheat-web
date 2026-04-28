# imakeheat-web

A pocket bitcrusher PWA. Web Audio API + AudioWorklet, render-on-export, IndexedDB archive.

## Develop

    npm install
    npm run dev          # http://localhost:5173
    npm test             # vitest
    npm run typecheck

## Build

    npm run build
    npm run preview

## Layout

- `src/audio/`     — engine, worklets, WAV codec
- `src/store/`     — Zustand session + IndexedDB exports
- `src/screens/`   — four screens (Home, Preview, Effects, Exports)
- `src/components/` — shared visual components
- `tests/unit/`    — vitest
- `tests/e2e/`     — Playwright

## Reference

- Design spec: `../imakeheat/docs/superpowers/specs/2026-04-28-imakeheat-pwa-design.md`
- Postmortem of the Android predecessor: `../imakeheat/walkthrough.md`
