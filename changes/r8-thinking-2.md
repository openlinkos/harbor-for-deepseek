浏览超过 5 条时只画出前 5 条，其余走「查看全部」。换行测试按可见的 5 条计数。SP-TH-205。

apps/web/e2e/browse-link-wrap.spec.ts:164 旧 PAGES.length（6）新 Math.min(PAGES.length, 5)，SP-TH-205。
