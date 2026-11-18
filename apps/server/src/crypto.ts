import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`
}

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [kind, saltB64, hashB64] = stored.split(':')
  if (kind !== 'scrypt' || !saltB64 || !hashB64) {
    return false
  }
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

export const randomToken = (): string => randomBytes(32).toString('base64url')

export const sealSecret = (plain: string, master: Buffer): { ciphertext: Buffer; nonce: Buffer } => {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', master, nonce)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()])
  return { ciphertext: body, nonce }
}

export const openSecret = (ciphertext: Buffer, nonce: Buffer, master: Buffer): string => {
  const tag = ciphertext.subarray(ciphertext.length - 16)
  const body = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', master, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

export const loadMasterKey = (hexOrFile: Buffer): Buffer => {
  if (hexOrFile.length !== 32) {
    throw new Error('master key must be 32 bytes')
  }
  return hexOrFile
}
