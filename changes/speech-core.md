# Speech core

Library slice only. Composer, settings, and the assistant action row are not wired in this commit. A passing unit test is not a live ASR or TTS acceptance.

## What changed

- Public voice ids stay `stella` and `tide`. Legacy `海星` / `暗潮` normalize; `贝壳` and `白浪` do not map onto another voice.
- API client posts multipart `POST /v1/tools/asr` and full-text `POST /v1/tools/tts` (`format: pcm`, `filter_markdown: true`, real `voice_id`). Bearer still comes from the caller.
- Recorder, WAV, PCM carry, and the read-aloud controller stay independent of the chat abort controller.
- Silence at -80 dB stays at 0. Octave tilt is applied only above that floor, so a high band with the same energy rises farther than a low band.
- Each PCM clip arms `onended` when it is scheduled. The session returns to idle after the stream ends and the last clip ends, including when that end is observed before the EOF turn finishes.
- The voice id is read when the gesture starts. The request itself starts on the next microtask, so a second toggle in the same turn still sees the voice from its own gesture.
- Browser `AudioBufferSourceNode` is wrapped. Its `onended` listener type is not used as `ScheduledClip`. Recording graph `connect` accepts test doubles as well as real `AudioNode`s.
- Speech message keys exist in both catalogs. Website-only voice labels are not added as selectable ids.

## Commands

All of these exited 0. No microphone, account, key file, or external network call.

- `pnpm typecheck` — 10/10 tasks successful (web and i18n cache miss; the other packages cache hit).
- `pnpm --filter @deepapi/web exec vitest run src/speech` — 6 files, 23 tests passed (spectrum 2, pcm 4, wav 3, recorder 3, readAloud 5, voiceSession 6).
- `pnpm --filter @deepapi/api-client exec vitest run src/speech.test.ts` — 6 passed.
- `pnpm --filter @deepapi/types exec vitest run src/speech.test.ts` — 5 passed.
- `pnpm --filter @deepapi/storage exec vitest run src/storage.test.ts` — 10 passed.
- `pnpm --filter @deepapi/i18n exec vitest run` — 2 passed.

The three previously failing speech tests (`spectrum` silence, read-aloud drain, voice captured at the gesture) now pass without changing those assertions.
