import { createClient } from '@deepapi/api-client'
import { translate, type MessageKey } from '@deepapi/i18n'
import { useHarbor } from '../store.js'
import { useSpeechNotice } from './notice.js'
import { hostFromAudioContext } from './player.js'
import { createReadAloud, installReadAloud, stopReadAloud } from './readAloud.js'
import { browserRecordingHost, startRecording } from './recorder.js'
import { cancelVoiceInput, createVoiceInput, deliverTranscript, installVoiceInput } from './voiceSession.js'

const client = createClient()

const localSpeechOpen = (): { ok: true } | { ok: false; key: MessageKey } => {
  const { serverMode, key } = useHarbor.getState()
  if (serverMode || !key) return { ok: false, key: 'voiceInputNeedsLocalKey' }
  return { ok: true }
}

const showSpeechError = (key: MessageKey) => {
  const locale = useHarbor.getState().settings.locale
  useSpeechNotice.getState().show(translate(locale, key))
}

/**
 * Install the production microphone and read-aloud controllers.
 * Hosted/server chat has no speech route, so those sessions stay gated.
 * A later install replaces the previous controllers, which keeps StrictMode remounts on one session.
 */
export const installSpeech = () => {
  cancelVoiceInput()
  stopReadAloud()
  installVoiceInput(createVoiceInput({
    now: () => Date.now(),
    startRecording: (onLimit) => startRecording(onLimit, browserRecordingHost()),
    transcribe: (file, signal) => {
      const { serverMode, key } = useHarbor.getState()
      if (serverMode || !key) return Promise.reject(new Error('speech transport unavailable'))
      return client.transcribe(key, file, signal)
    },
    secure: () => window.isSecureContext,
    gate: localSpeechOpen,
    onError: showSpeechError,
    onText: (text, conversationId, generation) => deliverTranscript(text, conversationId, generation),
    activeConversationId: () => useHarbor.getState().activeId,
  }))
  installReadAloud(createReadAloud({
    synthesize: (text, voice, signal) => {
      const { serverMode, key } = useHarbor.getState()
      if (serverMode || !key) return Promise.reject(new Error('speech transport unavailable'))
      return client.synthesize(key, text, voice, signal)
    },
    createContext: () => hostFromAudioContext(new AudioContext({ sampleRate: 24000 })),
    getVoice: () => useHarbor.getState().settings.ttsVoice,
    onError: showSpeechError,
    canSpeak: () => {
      const gate = localSpeechOpen()
      if (!gate.ok) return { ok: false, key: 'ttsNeedsLocalKey' }
      return gate
    },
  }))
}
