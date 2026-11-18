# Security

## Report a problem

Email the maintainers of `openlinkos/harbor-for-deepseek` through GitHub's private vulnerability reporting, or open a private security advisory. Do not file a public issue, and do not include an API key or a conversation transcript.

If a key was exposed, revoke it in the DeepSeek platform before anything else. Harbor cannot revoke a key for you, and the static site never received it.

## Where the key lives

Harbor's default mode is bring-your-own-key, entirely in the browser.

- The key is written to a separate IndexedDB database (`harbor-secrets`), not to `localStorage`, and not into the conversation database.
- An optional passphrase encrypts it with PBKDF2-SHA-256 (600,000 iterations) and AES-256-GCM. The passphrase is not stored. Without a passphrase, the key sits in IndexedDB in a form any script on this origin can read.
- Exports (JSON and the v3 ZIP) do not include the key. Import ignores a key if one was stuffed into a file.
- Requests use `credentials: "omit"` and go to `https://api.deepseek.com`. The page on `hfd.linkos.org` has no account and no request log of its own.
- The DeepSeek platform terms tell users not to put a key in a browser. Using the web app means accepting that risk: a malicious extension or an XSS bug can read an unencrypted key. A dedicated key with a spending limit is safer.
- The Android app uses the same IndexedDB inside the app WebView. Other apps cannot read it. It is not wrapped by the Android Keystore in this release. Export still omits the key. See [docs/android.md](docs/android.md).

## Why the static site is strict

XSS on the public page is equivalent to losing a visitor's key. The build therefore:

- Sets a Content-Security-Policy that allows scripts and styles from the site itself, connections only to `https://api.deepseek.com`, and images from the site plus `https://cdn.deepseek.com` (search-result site icons). `unsafe-eval` is not allowed. Inline style attributes are allowed because the interface uses them; inline scripts are not.
- Vendors fonts, KaTeX, and Mermaid. There is no analytics, no tag manager, and no third-party script.
- Registers a service worker that returns immediately for any non-same-origin request, including the API.
- Publishes `SHA256SUMS` and Subresource Integrity hashes with the static files.

`style-src-attr 'unsafe-inline'` is the one deliberate relaxation. It does not allow inline event handlers or remote scripts.

## Self-hosting

Harbor for DeepSeek server mode stores API keys with AES-256-GCM under `KEY_ENCRYPTION_SECRET` (32 bytes, or 64 hex characters). A database dump without that secret cannot decrypt the keys. Passwords are scrypt hashes. Session tokens are stored as SHA-256. Logs omit message text and fields that look like keys, passwords, or tokens. Cookie writes require the CSRF value returned at login. The cookie is `HttpOnly` and `SameSite=Lax`, and `Secure` on HTTPS. Login, registration, and chat are rate limited. CORS allows only the configured origins. The first admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD`, or from a one-time `BOOTSTRAP_TOKEN`. Invite codes expire. Upstream errors returned to the browser do not include the API key. Details: [docs/self-hosting.md](docs/self-hosting.md).
