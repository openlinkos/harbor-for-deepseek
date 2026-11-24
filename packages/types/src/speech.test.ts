import { describe, expect, it } from 'vitest'
import {
  ASR_MAX_BYTES,
  ASR_MAX_SECONDS,
  ASR_SAMPLE_RATE,
  TTS_MAX_BILLING_CHARS,
  TTS_MAX_JSON_BYTES,
  TTS_SAMPLE_RATE,
  exceedsTtsJson,
  legacyVoiceCandidates,
  normalizeTtsVoice,
  resolveTtsVoice,
  ttsBillingLength,
  ttsRequestJson,
} from './speech.js'

describe('public voice ids', () => {
  it('maps only stella and tide, including their public labels', () => {
    expect(normalizeTtsVoice('stella')).toBe('stella')
    expect(normalizeTtsVoice(' 海星 ')).toBe('stella')
    expect(normalizeTtsVoice('tide')).toBe('tide')
    expect(normalizeTtsVoice('暗潮')).toBe('tide')
    for (const label of ['贝壳', '白浪', '默认', 'Samantha', '', 'null', 1, null, undefined]) {
      expect(normalizeTtsVoice(label)).toBeNull()
    }
  })

  it('keeps a stored field from falling through to legacy', () => {
    expect(resolveTtsVoice('nope', ['暗潮', '海星'], true)).toBe('stella')
    expect(resolveTtsVoice('tide', ['海星'], true)).toBe('tide')
    expect(resolveTtsVoice(undefined, ['暗潮', '海星'], false)).toBe('tide')
    expect(resolveTtsVoice(undefined, ['贝壳', '白浪'], false)).toBe('stella')
  })

  it('reads legacy keys in order and ignores broken json and the profile', () => {
    const values = new Map<string, string>([
      ['deepapi-read-aloud', '{"enabled":true,"voice":"暗潮"}'],
      ['deepapi-voice', '海星'],
      ['harbor-voice', '贝壳'],
      ['deepapi-ui', JSON.stringify({ voice: '暗潮' })],
      ['deepapi-profile', JSON.stringify({ voice: '白浪' })],
      ['deepapi-voice-prefs', '{broken'],
    ])
    const storage = { getItem: (key: string) => values.get(key) ?? null }
    expect(legacyVoiceCandidates(storage)).toEqual(['暗潮', '海星', '贝壳', '暗潮'])
    expect(resolveTtsVoice(undefined, legacyVoiceCandidates(storage), false)).toBe('tide')
    values.set('deepapi-read-aloud', '{broken')
    expect(resolveTtsVoice(undefined, legacyVoiceCandidates(storage), false)).toBe('stella')
  })
})

describe('tts limits', () => {
  it('counts a CJK code point as two billing characters', () => {
    expect(ttsBillingLength('ab文')).toBe(4)
    expect(ttsBillingLength('a'.repeat(TTS_MAX_BILLING_CHARS))).toBe(TTS_MAX_BILLING_CHARS)
    expect(ASR_SAMPLE_RATE).toBe(16000)
    expect(ASR_MAX_SECONDS).toBe(120)
    expect(ASR_MAX_BYTES).toBe(8 * 1024 * 1024)
    expect(TTS_SAMPLE_RATE).toBe(24000)
  })

  it('builds the documented pcm body and flags an oversized json payload', () => {
    expect(JSON.parse(ttsRequestJson('你好', 'tide'))).toEqual({
      text: '你好',
      voice_id: 'tide',
      format: 'pcm',
      filter_markdown: true,
    })
    expect(exceedsTtsJson(ttsRequestJson('a'.repeat(TTS_MAX_BILLING_CHARS), 'stella'))).toBe(false)
    expect(exceedsTtsJson('x'.repeat(TTS_MAX_JSON_BYTES + 1))).toBe(true)
  })
})
