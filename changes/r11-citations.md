# r11 引用

答案正文恢复 system-ui 字族，和 master `a8df8b9` 算出的 `.prose` 一致。`--dsw-font-family` 仍带 Inter（SP-GL-042），但套到答案正文上会把 fb1554 cite-style 的 dyTop 从 master 的 2 拉到 1，CI 容差是 0.5。所以 `.prose, .ds-markdown` 单独覆盖 `font-family`。思考块的更具体规则仍用小号正文字族。

没有改已有断言。夹具和容差没动。
