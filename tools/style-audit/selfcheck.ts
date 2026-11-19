import { readFileSync } from 'node:fs'
import { diffMatch, loadAllowlist, normalizeColor } from './diff.ts'
import { matchCaptures, type Capture, type StyleNode } from './match.ts'

const node = (patch: Partial<StyleNode> & { key: string }): StyleNode => ({
  key: patch.key,
  role: patch.role || 'button',
  name: patch.name || '',
  text: patch.text || '',
  tag: patch.tag || 'button',
  testId: patch.testId || '',
  rect: patch.rect || { x: 10, y: 10, w: 40, h: 20 },
  style: patch.style || { color: 'rgb(0, 0, 0)', 'font-family': 'Inter', 'font-size': '14px' },
})

const capture = (elements: StyleNode[], height = 900): Capture => ({
  label: 'sample',
  state: 'sample',
  viewport: { width: 1440, height },
  devicePixelRatio: 1,
  ua: 'test',
  fonts: [],
  customProperties: { root: {}, body: {} },
  elements,
})

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

export const selfCheck = () => {
  assert(normalizeColor('#fff') === 'rgba(255, 255, 255, 1)', 'hex white')
  assert(normalizeColor('rgb(255, 255, 255)') === 'rgba(255, 255, 255, 1)', 'rgb white')
  assert(normalizeColor('#edf3fe') === 'rgba(237, 243, 254, 1)', 'selected fill')
  const allow = loadAllowlist(readFileSync(new URL('./allowlist.yaml', import.meta.url), 'utf8'))
  assert(allow.some((item) => item.id === 'font-family'), 'allowlist loads')

  const near = diffMatch('s', '1440x900', matchCaptures(
    capture([node({ key: 'a', rect: { x: 10, y: 10, w: 40, h: 20 } })]),
    capture([node({ key: 'a', rect: { x: 10.4, y: 10, w: 40, h: 20 } })]),
  ), allow)
  assert(near.pass && near.mismatches.length === 0, '0.4px geometry is inside tolerance')

  const far = diffMatch('s', '1440x900', matchCaptures(
    capture([node({ key: 'a', rect: { x: 10, y: 10, w: 40, h: 20 } })]),
    capture([node({ key: 'a', rect: { x: 10.6, y: 10, w: 40, h: 20 } })]),
  ), allow)
  assert(!far.pass && far.mismatches.some((item) => item.property === 'x' && item.status === 'fail'), '0.6px geometry fails')

  const font = diffMatch('s', '1440x900', matchCaptures(
    capture([node({ key: 'a', style: { color: 'rgb(0, 0, 0)', 'font-family': 'DeepSeek Sans', 'font-size': '14px' } })]),
    capture([node({ key: 'a', style: { color: '#000', 'font-family': 'Inter', 'font-size': '14px' } })]),
  ), allow)
  assert(font.pass && !font.mismatches.some((item) => item.property === 'font-family'), 'font-family is not a visual property')

  const brand = diffMatch('s', '1440x900', matchCaptures(
    capture([node({ key: 'logo', text: 'DeepSeek', tag: 'span', role: '', rect: { x: 40, y: 20, w: 80, h: 18 }, style: { color: 'black', 'font-size': '16px' } })]),
    capture([node({ key: 'mark', text: 'Harbor', tag: 'span', role: '', rect: { x: 40, y: 20, w: 70, h: 18 }, style: { color: 'red', 'font-size': '15px' } })]),
  ), allow)
  assert(brand.pass, 'wordmark brand diffs are allowed')
  assert(brand.mismatches.some((item) => item.id === 'brand-wordmark'), 'wordmark exception is cited')

  const chats = matchCaptures(
    capture([
      node({ key: 'o1', text: '官方标题甲', rect: { x: 16, y: 200, w: 200, h: 36 } }),
      node({ key: 'o2', text: '官方标题乙', rect: { x: 16, y: 250, w: 200, h: 36 } }),
    ]),
    capture([
      node({ key: 'h1', text: '加法', rect: { x: 16, y: 200, w: 200, h: 36 } }),
      node({ key: 'h2', text: '天气', rect: { x: 16, y: 250, w: 200, h: 36 } }),
    ]),
  )
  assert(chats.pairs.filter((pair) => pair.brand === 'chat-list').length >= 2, 'chat rows align by position')
  const extra = matchCaptures(
    capture([
      node({ key: 'o1', text: '测试会话A', rect: { x: 12, y: 160, w: 236, h: 40 } }),
      node({ key: 'o2', text: '另一条', rect: { x: 12, y: 200, w: 236, h: 40 } }),
      node({ key: 'o3', text: '第三条', rect: { x: 12, y: 240, w: 236, h: 40 } }),
    ]),
    capture([node({ key: 'h1', text: '对照', rect: { x: 12, y: 160, w: 236, h: 40 } })]),
  )
  assert(extra.pairs.length === 1 && extra.unmatchedOfficial.length === 0 && extra.unmatchedOurs.length === 0, 'extra official chats are structural, not mismatches')
  const colored = diffMatch('s', '1440x900', matchCaptures(
    capture([node({ key: 'o1', text: '官方标题甲', rect: { x: 16, y: 200, w: 200, h: 36 }, style: { color: 'rgb(1, 1, 1)', 'font-size': '14px' } })]),
    capture([node({ key: 'h1', text: '加法', rect: { x: 16, y: 200, w: 200, h: 36 }, style: { color: 'rgb(9, 9, 9)', 'font-size': '14px' } })]),
  ), allow)
  assert(!colored.pass, 'chat-list alignment still diffs real style properties')

  const toggle = diffMatch('s', '1440x900', matchCaptures(
    capture([node({ key: 'button| |深度思考|button#1', text: '', style: { 'background-color': '#fff', color: 'rgb(15, 17, 21)', 'font-size': '13px' } })]),
    capture([node({ key: 'button| |深度思考|button#1', text: '', testId: 'toggle-thinking', style: { 'background-color': '#edf3fe', color: '#3964fe', 'font-size': '13px' } })]),
  ), allow)
  assert(toggle.pass, 'default-on toggles are an owner-rule exception')
  assert(toggle.mismatches.every((item) => item.status === 'allowed'), 'toggle colors are allowed rather than failed')
}
