SP-SB-063。`.chat-link` 补上 `justify-content: flex-start`。计算值原来是 `normal`。内层 `.chat-row` 仍是 `space-between`。

SP-SB-426。`.new-chat` 的 transition 改成 `box-shadow .3s`。原先是 `background-color 0.2s` 加 `box-shadow 0.2s`。官方 `._5a8ac7a` 只过渡阴影，时长 `.3s`。

没有改断言。没有测试把 0.2s 钉成期望值。
