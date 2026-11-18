# Android

Android 上的 Harbor 是同一个网页，装在 Capacitor 壳里（`org.linkos.harbor`）。默认仍是自带 Key：Key 和对话留在设备上，导出和导入走系统分享面板，对话请求直接发往 `https://api.deepseek.com`。

公开站 `https://hfd.linkos.org` 没有改。它的内容安全策略仍然只允许连接自己和 `https://api.deepseek.com`。APK 用的是这份网站的副本（`apps/mobile/www`），副本的 `connect-src` 额外允许 `https:`，这样应用里才能填写你自己的 Harbor 地址。Cloudflare Pages 不会发布这个副本。

## 服务器模式

应用的设置里可以填写服务器地址。HTTPS 可以直接用。HTTP 只有在勾选「允许局域网的 http」之后才接受，并且只接受 localhost、`*.local` 或私有 IPv4。登录使用 bearer 令牌（浏览器在服务器自己的地址上仍然用 Cookie）。同步沿用原来的按钮，不点就不会同步。

服务器只对管理员维护的来源名单返回跨域头。默认是 `capacitor://localhost`、`https://localhost` 和 `http://localhost`。Android 壳的页面来源是 `https://localhost`。需要别的来源时在管理页修改。公开静态站不会去连这些服务器。

## 网络安全

正式包把 `cleartextTrafficPermitted` 设为 false。局域网里只提供 HTTP 的自托管服务器，要先显式打开再重新打包：

1. 编辑 `apps/mobile/android/app/src/main/res/xml/network_security_config.xml`。
2. 为那一台主机增加 `cleartextTrafficPermitted="true"` 的 `domain-config`。
3. 用 `node scripts/prepare-mobile.mjs --lan` 打包，让副本页面的策略也写上对应的 `http://` 主机。如果服务器有 HTTPS，就不用这一步。

拉取请求里的调试 APK 只对 `localhost`、`127.0.0.1` 和 `10.0.2.2`（模拟器访问宿主机的地址）放行明文。局域网的其他地址不放行。

## 构建

```bash
pnpm install
pnpm build
node scripts/prepare-mobile.mjs --lan
pnpm --filter @harbor/mobile exec cap sync android
cd apps/mobile/android && ./gradlew assembleDebug
```

调试 APK 在 `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`。每个拉取请求都会把它上传为 `harbor-debug-apk` 产物。

打上 `v*` 标签时，发布流程会把 APK 附到 GitHub Release。只有下面四个仓库密钥都存在时才会签正式包：

- `ANDROID_KEYSTORE_BASE64`：`.jks` 或 `.keystore` 文件的 base64
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

缺任何一个，流程就附上调试签名的 APK，不会自己造一套密钥。在本机生成密钥库，再把这四个密钥加到仓库设置里：

```bash
keytool -genkeypair -v -keystore harbor.jks -alias harbor -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 harbor.jks
```

不要提交 `harbor.jks`。

## 这一版做了什么，留下了什么

已完成：

- 复用网页界面的 Capacitor Android 工程。
- Key 和对话留在设备上，导出和导入走分享面板。
- 应用内填写服务器地址、bearer 登录、按需同步。
- 服务器的来源名单和 bearer 令牌。公开站的内容安全策略不变。
- 安全区、返回键（先关掉面板，再退出应用）、键盘顶起页面。
- 每个拉取请求构建调试 APK。配置了密钥库之后，`v*` 标签构建正式 APK。

未做：

- API Key 存在 WebView 自己的 IndexedDB 里，没有放进 Android Keystore。
- CI 里没有模拟器。截图是同一份移动端页面在无头浏览器里的渲染，Capacitor 桥是桩。
- 应用商店上架，以及 iOS 壳（下一个里程碑）。
