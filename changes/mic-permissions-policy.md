修复点语音输入直接提示「无法使用麦克风」、浏览器不弹授权：响应头 Permissions-Policy 由 microphone=() 改为 microphone=(self)，摄像头和定位仍禁止。新增 scripts/check-permissions-policy.mjs，校验各处响应头一致，且前端用到的浏览器权限能力不被策略关掉。
