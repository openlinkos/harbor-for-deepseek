# Decisions that differ from the design notes

The design notes and the ecosystem notes disagree in a few places. The ecosystem notes win on naming. Other differences are implementation choices for M1.

1. **Name and host.** The interface says Harbor. The repository can say it is for the official DeepSeek API. The public host in the docs is `https://hfd.linkos.org`, not `harbor.linkos.org`.
2. **chat-demo.** The app is a new React interface, not a fork of the chat-demo UI. The Messages API behavior and the v3 ZIP layout follow the public API and the archive documented by chat-demo `5d5dd754`. `NOTICE` carries that project's MIT license and copyright. Voice is absent. The system prompt does not say the assistant was created by DeepSeek.
3. **safety_check.** Default is `high`, including on a public static host. Settings can select `low`, with a warning. The design notes left the default open; the ecosystem notes require `high` for a public site.
4. **No server in this tree.** `apps/server`, `apps/mobile`, and Compose are placeholders. Shipping a Compose file that does not boot would look like M2 was done.
5. **Files.** Upload uses `POST /files` with `expires_after[anchor]=created_at` and `expires_after[seconds]`, default 7 days, clamped to the documented 1 hour–30 day window. PDF and Office default to `rich_layout_recognition`; plain text and images use `user_data`. `deepseek-v4-pro` does not send tools or files.
6. **Usage.** There is no official usage API. Totals sum `message_delta.usage` only. Billing uses `tool_search`, `tool_image_search`, and `tool_fetch`. `web_search_requests` and `web_fetch_requests` are shown as display counts. Thinking tokens are already inside `output_tokens`.
7. **v3 ZIP.** Text, reasoning, search, opened pages, read-link signatures, and file metadata survive a round trip. Image bytes inside an official export are not re-uploaded. The JSON archive is the lossless copy. Import merges by conversation id and does not replace an existing chat; a checkbox imports copies with new ids.
8. **Key storage.** Unencrypted keys live in IndexedDB, not `localStorage`. A passphrase uses PBKDF2-SHA-256 (600,000 rounds) and AES-256-GCM. Deleting a chat removes the rows and writes a tombstone so a later sync can propagate the delete without keeping the text.
9. **CSP.** `script-src` and `style-src` are `'self'`. `style-src-attr 'unsafe-inline'` remains so style attributes work. `unsafe-eval` is not enabled. Mermaid runs with `securityLevel: 'strict'`.
10. **Replay.** Completed turns are sent back with their stored blocks, including thinking signatures and tool blocks, so a read-link signature is not dropped. Refused and failed turns are not replayed. A refusal clears the streamed text.
