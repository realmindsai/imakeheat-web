import { writeFileSync } from 'node:fs'

const sr = 44100
const dur = 1.0
const N = Math.round(sr * dur)
const data = Buffer.alloc(44 + N * 2)

const writeAscii = (offset, s) => { for (let i = 0; i < s.length; i++) data[offset + i] = s.charCodeAt(i) }
writeAscii(0, 'RIFF')
data.writeUInt32LE(36 + N * 2, 4)
writeAscii(8, 'WAVE')
writeAscii(12, 'fmt ')
data.writeUInt32LE(16, 16)
data.writeUInt16LE(1, 20)        // PCM
data.writeUInt16LE(1, 22)        // mono
data.writeUInt32LE(sr, 24)
data.writeUInt32LE(sr * 2, 28)
data.writeUInt16LE(2, 32)
data.writeUInt16LE(16, 34)
writeAscii(36, 'data')
data.writeUInt32LE(N * 2, 40)

for (let i = 0; i < N; i++) {
  const v = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
  data.writeInt16LE(Math.round(v * 0x7fff), 44 + i * 2)
}

writeFileSync(new URL('./sine-440-1s.wav', import.meta.url), data)
console.log('wrote sine-440-1s.wav')
