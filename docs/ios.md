# iOS

DeepAPI on iOS is the same Capacitor shell as Android (`org.linkos.harbor`). The default is still a key on the device. Chat goes to `https://api.deepseek.com` until you type a DeepAPI server you run and log in. The server address, bearer token, and opt-in sync are the same as on Android. See [android.md](android.md).

The page origin inside the iOS shell is `capacitor://localhost`. That origin is on the server’s default CORS list. An admin can change the list.

## Network

App Transport Security allows HTTPS only (`NSAllowsArbitraryLoads` is false). A self-hosted server on your LAN that speaks only HTTP will not connect until you opt in and rebuild:

1. Edit `apps/mobile/ios/App/App/Info.plist`.
2. Under `NSAppTransportSecurity`, add an `NSExceptionDomains` entry for that host only, with `NSExceptionAllowsInsecureHTTPLoads` set to true.
3. Build with `node scripts/prepare-mobile.mjs --lan` so the copied page’s policy also lists that `http://` host, or serve the server with HTTPS and skip this step.

The in-app “Allow http on a private LAN address” checkbox is still required. It does not by itself turn cleartext on.

## CI

Pull requests build an unsigned iOS Simulator app on a macOS runner. The job does not sign, and it does not upload to TestFlight.

```bash
pnpm install
pnpm build
node scripts/prepare-mobile.mjs
pnpm --filter @deepapi/mobile exec cap sync ios
cd apps/mobile/ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

## TestFlight

TestFlight needs an Apple Developer Program membership. This repository does not store a certificate, a provisioning profile, or an App Store Connect key. Create those in your Apple account, then archive from Xcode on a Mac:

1. Open `apps/mobile/ios/App/App.xcworkspace`.
2. Select the App target. Set the team and a unique bundle id if `org.linkos.harbor` is already taken.
3. Product → Archive, with a distribution signing certificate.
4. Distribute the archive to App Store Connect, then enable TestFlight for the build.

Do not commit the certificate or the profile. A later workflow can sign from repository secrets if a maintainer adds them. None are defined here, and this project does not invent any.
