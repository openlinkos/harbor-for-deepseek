# iOS

iOS 上的 Harbor 和 Android 是同一个 Capacitor 壳（`org.linkos.harbor`）。默认仍是设备上的 Key。不填写你自己的 Harbor 服务器时，对话直接发往 `https://api.deepseek.com`。服务器地址、bearer 令牌和按需同步与 Android 相同。见 [android.zh-CN.md](android.zh-CN.md)。

iOS 壳里的页面来源是 `capacitor://localhost`。服务器的默认跨域名单包含它。管理员可以修改这份名单。

## 网络

App Transport Security 只允许 HTTPS（`NSAllowsArbitraryLoads` 为 false）。局域网里只提供 HTTP 的自托管服务器，要先显式打开再重新打包：

1. 编辑 `apps/mobile/ios/App/App/Info.plist`。
2. 在 `NSAppTransportSecurity` 下只为那一台主机增加 `NSExceptionDomains`，并把 `NSExceptionAllowsInsecureHTTPLoads` 设为 true。
3. 用 `node scripts/prepare-mobile.mjs --lan` 打包，让副本页面的策略也写上对应的 `http://` 主机。如果服务器有 HTTPS，就不用这一步。

应用里的「允许局域网的 http」仍然要勾选。只勾选它不会打开发明文。

## CI

每个拉取请求在 macOS 运行器上构建未签名的 iOS 模拟器应用。这一步不签名，也不上传到 TestFlight。

```bash
pnpm install
pnpm build
node scripts/prepare-mobile.mjs
pnpm --filter @harbor/mobile exec cap sync ios
cd apps/mobile/ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

## TestFlight

TestFlight 需要 Apple Developer Program。这个仓库不存放证书、描述文件或 App Store Connect 密钥。在你自己的 Apple 账号里准备好之后，用 Mac 上的 Xcode 归档：

1. 打开 `apps/mobile/ios/App/App.xcworkspace`。
2. 选中 App target。如果 `org.linkos.harbor` 已被占用，就换成你自己的 bundle id，并选中团队。
3. 用分发证书执行 Product → Archive。
4. 把归档分发到 App Store Connect，再为这个构建打开 TestFlight。

不要提交证书或描述文件。以后如果维护者把密钥加到仓库里，可以再加一条签名流程。这里没有定义任何密钥，也不会编造。
