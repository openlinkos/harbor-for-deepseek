import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const fail = []
const css = read('apps/web/src/styles.css')
const ui = read('apps/web/src/ui.tsx')
const request = read('packages/api-client/src/request.ts')
const i18n = read('packages/i18n/src/index.ts')
const store = read('apps/web/src/store.ts')

if (!css.includes('-webkit-font-smoothing: antialiased')) fail.push('body is missing -webkit-font-smoothing: antialiased')
if (css.includes('#2563eb') || ui.includes('#2563eb')) fail.push('#2563eb is still used; the brand blue is #3964fe')
if (ui.includes('deepapi-audit-greeting') || ui.includes('Math.random()')) fail.push('production still randomizes the greeting or reads the audit session key')
if (request.includes('你是 DeepAPI') || request.includes('helpful assistant inside DeepAPI') || request.includes('Current date and time')) fail.push('requests still inject a persona or a clock')
if (ui.includes('data-testid="key-ack"') || ui.includes('keyAck')) fail.push('the key gate still asks for an acknowledgement')
if (i18n.includes('从本机移除 Key') || i18n.includes('数据用于优化体验') || i18n.includes('有效期为 7 天')) fail.push('misleading or Harbor-only settings copy is still shipped')
if (!store.includes("history.every((item) => item.role !== 'assistant')")) fail.push('title.enabled is not limited to the first turn')
if (!css.includes('.pick.on') || !css.includes('border-radius: 50%') || !css.includes('#3964fe')) fail.push('batch checkboxes are not the official round circle')

if (fail.length) {
  console.error(fail.map((item) => `- ${item}`).join('\n'))
  process.exit(1)
}
console.log('strict source invariants ok')
