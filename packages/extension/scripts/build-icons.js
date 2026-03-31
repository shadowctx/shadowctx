#!/usr/bin/env node
/**
 * Generates placeholder PNG icons using pure Node.js (no native deps).
 * Creates solid-colour squares — replace with real artwork for production.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

function crc32(buf) {
  const table = crc32.table || (crc32.table = buildTable())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildTable() {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = uint32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = uint32BE(crc32(crcInput))
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

function makePng(size, r, g, b) {
  // IHDR
  const ihdrData = Buffer.concat([
    uint32BE(size),  // width
    uint32BE(size),  // height
    Buffer.from([8, 2, 0, 0, 0]),  // bit depth=8, color type=RGB(2), deflate, filter, no interlace
  ])

  // Raw scanlines: each row = filter byte (0 = None) + RGB pixels
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0  // filter type: None
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const rawData = Buffer.concat(Array(size).fill(row))
  const idatData = zlib.deflateSync(rawData)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const sizes = [16, 48, 128]
const iconsDir = path.join(__dirname, '..', 'icons')

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

for (const size of sizes) {
  const out = path.join(iconsDir, `icon${size}.png`)
  // Purple: #7c3aed = rgb(124, 58, 237)
  fs.writeFileSync(out, makePng(size, 124, 58, 237))
  console.log(`Written: ${out} (${size}x${size})`)
}
