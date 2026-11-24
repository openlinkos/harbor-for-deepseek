# r16 errors race

`apps/web/e2e/parity.spec.ts` `errors`: after sending 太多, the test now also waits until a second `.form-error` exists (the 太多 turn's own 429 error, next to the 坏钥匙 one) before setting the mock to `down`.

Reason: `.form-error.last()` was already satisfied by the earlier 坏钥匙 error, so the mock could switch to `down` before the 太多 request was answered. Both turns then got the network-down hint, and `getByTestId('hint-retry')` matched two elements (strict-mode failure, about 1 run in 30 on the branch). The new wait is stricter. No existing assertion was removed or loosened, and no product code changed.

Approved by 筑衡 21:05 (UTC+8).
