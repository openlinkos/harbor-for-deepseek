# Android

DeepAPI on Android is the same web app inside a Capacitor shell (`org.linkos.harbor`). The default is still bring-your-own-key: the key and the chats stay on the device, export and import use the system share sheet, and chat requests go straight to `https://api.deepseek.com`.

The public site at `https://deepapi.linkos.org` is unchanged. Its Content-Security-Policy still allows connections only to itself and `https://api.deepseek.com`. The APK is built from a copy of that site (`apps/mobile/www`) whose `connect-src` also allows `https:` so the app can call a DeepAPI server you type in. That copy is not what Cloudflare Pages serves.

## Server mode

Settings on the app has a server address. HTTPS is accepted. HTTP is accepted only when you check “Allow http on a private LAN address”, and only for localhost, `*.local`, or a private IPv4 address. The app then logs in with a bearer token (the cookie session is for the browser on the server’s own origin). Sync uses the existing sync buttons and stays off until you use them.

The server allows cross-origin calls only from an admin-edited list. The default is `capacitor://localhost`, `https://localhost`, and `http://localhost`. The Android shell uses `https://localhost`. Change the list in the admin screen if you need another origin. The public static site does not call these servers.

## Network security

Release builds set `cleartextTrafficPermitted` to false. A self-hosted server on your LAN that speaks only HTTP will not connect until you opt in and rebuild:

1. Edit `apps/mobile/android/app/src/main/res/xml/network_security_config.xml`.
2. Add a `domain-config` with `cleartextTrafficPermitted="true"` for that host only.
3. Build with `node scripts/prepare-mobile.mjs --lan` so the copied page’s policy also lists that `http://` host, or serve the server with HTTPS and skip this step.

The debug APK used in pull-request CI already allows cleartext to `localhost`, `127.0.0.1`, and `10.0.2.2` (the emulator’s alias for the host machine). It does not allow cleartext to the rest of the LAN.

## Build

```bash
pnpm install
pnpm build
node scripts/prepare-mobile.mjs --lan
pnpm --filter @deepapi/mobile exec cap sync android
cd apps/mobile/android && ./gradlew assembleDebug
```

The debug APK is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Every pull request uploads it as the `harbor-debug-apk` artifact.

On a `v*` tag, the release workflow attaches an APK to the GitHub Release. It signs a release APK only when all four repository secrets are set:

- `ANDROID_KEYSTORE_BASE64` — base64 of the `.jks` or `.keystore` file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

If any of them is missing, the workflow attaches a debug-signed APK and does not invent a keystore. Create a keystore locally, then add the four secrets in the repository settings:

```bash
keytool -genkeypair -v -keystore harbor.jks -alias harbor -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 harbor.jks
```

Do not commit `harbor.jks`.

## What this release does, and what it leaves

Done:

- Capacitor Android project reusing the web UI.
- On-device key and chats, with share-sheet export and import.
- A server URL on the app, bearer login, and opt-in sync.
- Server CORS allowlist and bearer tokens. The public CSP is unchanged.
- Safe areas, the Android back button (closes a panel, then leaves the app), and keyboard resize.
- Debug APK on every pull request. Release APK on `v*` tags when a keystore is configured.

Deferred:

- The API key stays in the WebView’s private IndexedDB. It is not in the Android Keystore.
- No emulator is in CI. The screenshots are a headless render of the same mobile bundle with the Capacitor bridge stubbed.
- Play Store listing, and an iOS shell (the next milestone).
