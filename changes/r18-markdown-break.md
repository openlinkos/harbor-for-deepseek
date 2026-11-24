SP-MD-401。代码块 `pre` 的 word-break 是 break-all。里面的 `code` 和行内代码仍是 normal。

改了的断言：

apps/web/e2e/spec-align-markdown.spec.ts:87 normal -> break-all SP-MD-401
