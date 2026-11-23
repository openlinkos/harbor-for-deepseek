# r12 时间线圆点

进行中的思考圆点按 1.5 秒循环放大到 1.3 倍。停住的圆点仍是灰色，不动画。

没有改已有断言。标题间距量的是文字，不是这个 5px 圆点。

搜索阶段行加 `translateZ(0)`。没有改已有断言。SP-TH-100。

思考标题按钮 `user-select: none`。没有改已有断言。SP-CV-147。

进行中的圆点已经是品牌色加 1.5 秒脉动，捕获用例不再标失败。

- `apps/web/e2e/fb1721-state-style.spec.ts:50` 去掉 `knownFailure('fb1721-D1')`。SP-TH-009。
- `apps/web/e2e/fb1721-state-style.spec.ts:62` 去掉 `knownFailure('fb1721-D1')`。SP-TH-009。
- `apps/web/e2e/fb1721-state-style.spec.ts:26` 删除 `KNOWN['fb1721-D1']`。停住后的圆点仍是灰色。
