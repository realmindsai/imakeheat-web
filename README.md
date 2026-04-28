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

## CI

[![ci](https://github.com/dewoller/imakeheat-web/actions/workflows/ci.yml/badge.svg)](https://github.com/dewoller/imakeheat-web/actions)

## Install

The app is a PWA. On iOS, open the deployed URL in Safari, tap Share, "Add to Home Screen". On Android Chrome, tap the install button in the address bar.

## What's NOT in v1

- Video extraction (`.mp4` → audio)
- A/B loop points
- MP3 export
- Rename / regenerate / cloud sync
- Duration-preserving pitch shift
