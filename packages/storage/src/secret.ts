import type { SealedSecret } from '@deepapi/types'

/** OWASP-aligned PBKDF2-SHA-256 iteration count for a one-shot unlock. */
export const PBKDF2_ITERATIONS = 600_000

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const derive = async (passphrase: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey('raw', textEncoder.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const sealSecret = async (value: string, passphrase: string | null): Promise<SealedSecret> => {
  if (!passphrase) {
    return { v: 1, enc: false, value }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(passphrase, salt, PBKDF2_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(value))
  return {
    v: 1,
    enc: true,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iterations: PBKDF2_ITERATIONS,
  }
}

export const openSecret = async (sealed: SealedSecret, passphrase: string | null): Promise<string> => {
  if (!sealed.enc) {
    return sealed.value
  }
  if (!passphrase) {
    throw new Error('passphrase required')
  }
  const key = await derive(passphrase, base64ToBytes(sealed.salt), sealed.iterations)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(sealed.iv) },
      key,
      base64ToBytes(sealed.ciphertext),
    )
    return textDecoder.decode(plain)
  } catch {
    throw new Error('passphrase rejected')
  }
}
