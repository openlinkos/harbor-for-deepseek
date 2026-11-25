/** Public TTS voice ids. Website-only labels are not ids and are not mapped here. */
export type TtsVoice = 'stella' | 'tide'

export const TTS_VOICES: readonly TtsVoice[] = ['stella', 'tide']

export const ASR_SAMPLE_RATE = 16000
export const ASR_MAX_SECONDS = 120
export const ASR_MAX_BYTES = 8 * 1024 * 1024
export const TTS_SAMPLE_RATE = 24000
export const TTS_MAX_BILLING_CHARS = 10000
export const TTS_MAX_JSON_BYTES = 64 * 1024

export const isTtsVoice = (value: unknown): value is TtsVoice => value === 'stella' || value === 'tide'

/**
 * Map a stored label onto a public voice id.
 * 贝壳, 白浪, browser voice names, and anything else stay unmapped.
 */
export const normalizeTtsVoice = (value: unknown): TtsVoice | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === 'stella' || trimmed === '海星') return 'stella'
  if (trimmed === 'tide' || trimmed === '暗潮') return 'tide'
  return null
}

export type LegacyVoiceSource = {
  getItem(key: string): string | null
}

/** First match wins. Profile storage is intentionally not a source. */
const LEGACY_VOICE_KEYS = ['deepapi-read-aloud', 'deepapi-voice', 'harbor-voice', 'deepapi-ui'] as const

const readLegacyValue = (raw: string | null): unknown => {
  if (raw == null) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && 'voice' in parsed) {
        return (parsed as { voice?: unknown }).voice
      }
    } catch {
      return undefined
    }
    return undefined
  }
  return trimmed
}

export const legacyVoiceCandidates = (storage: LegacyVoiceSource | null | undefined): unknown[] => {
  if (!storage) return []
  const out: unknown[] = []
  for (const key of LEGACY_VOICE_KEYS) {
    try {
      out.push(readLegacyValue(storage.getItem(key)))
    } catch {
      out.push(undefined)
    }
  }
  return out
}

/**
 * A present settings field always wins, including an invalid one (normalized to stella).
 * Legacy is consulted only when the field is absent.
 */
export const resolveTtsVoice = (stored: unknown, legacy: readonly unknown[], fieldPresent: boolean): TtsVoice => {
  if (fieldPresent) return normalizeTtsVoice(stored) ?? 'stella'
  for (const candidate of legacy) {
    const voice = normalizeTtsVoice(candidate)
    if (voice) return voice
  }
  return 'stella'
}

const isBillingCjk = (code: number): boolean =>
  (code >= 0x3400 && code <= 0x9fff) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0x20000 && code <= 0x2a6df) ||
  (code >= 0x2a700 && code <= 0x2ebef) ||
  (code >= 0x30000 && code <= 0x323af)

/** Chinese code points count as two billing characters. */
export const ttsBillingLength = (text: string): number => {
  let total = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    total += isBillingCjk(code) ? 2 : 1
  }
  return total
}

export const ttsRequestJson = (text: string, voiceId: TtsVoice): string =>
  JSON.stringify({ text, voice_id: voiceId, format: 'pcm', filter_markdown: true })

export const exceedsTtsJson = (body: string): boolean => new TextEncoder().encode(body).byteLength > TTS_MAX_JSON_BYTES
