/**
 * Prints the current 6-digit TOTP code for a base32 secret.
 * Usage: node scripts/totp-cli.mjs <base32Secret>
 * Mirrors GoTrue defaults: SHA-1, 6 digits, 30 s window.
 */
import crypto from 'node:crypto'

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of input.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(c)
    if (idx === -1) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

const secret = process.argv[2]?.replace(/\s+/g, '') ?? ''
if (!secret) {
  console.error('usage: node scripts/totp-cli.mjs <base32Secret>')
  process.exit(1)
}

const counterBuf = Buffer.alloc(8)
const counter = Math.floor(Date.now() / 30_000)
counterBuf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
counterBuf.writeUInt32BE(counter % 2 ** 32, 4)

const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counterBuf).digest()
const offset = hmac[hmac.length - 1] & 0xf
const bin =
  ((hmac[offset] & 0x7f) << 24) |
  ((hmac[offset + 1] & 0xff) << 16) |
  ((hmac[offset + 2] & 0xff) << 8) |
  (hmac[offset + 3] & 0xff)

console.log(String(bin % 1_000_000).padStart(6, '0'))
