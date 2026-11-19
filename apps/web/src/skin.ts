const KEY = 'deepapi-ui'

const NAME = /^--(?:dsw|ds|dsl|harbor|message-list|sider|composer)-[a-z0-9-]+$/
const COLOR = /^(?:transparent|#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\))$/
const LENGTH = /^-?\d+(?:\.\d+)?(?:px|rem|em)$/
const TIME = /^(?:0|0\.\d|0\.[0-6]\d*)s$/

export type SkinPackage = {
  format: 'deepapi-ui' | 'harbor-ui'
  schema: 1
  name: string
  scripts: 'forbidden'
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> }
  layout?: { sidebar?: { widthPx?: number }; composer?: { maxWidthPx?: number } }
}

const valueOk = (name: string, value: string) => {
  if (name.endsWith('duration') || name.includes('transition')) return TIME.test(value)
  if (value.endsWith('px') || value.endsWith('rem') || value.endsWith('em')) return LENGTH.test(value)
  return COLOR.test(value)
}

export const parseSkin = (raw: string): SkinPackage => {
  if (/sk-[A-Za-z0-9]{8,}/.test(raw)) throw new Error('skin rejected')
  const data = JSON.parse(raw) as SkinPackage
  if ((data.format !== 'deepapi-ui' && data.format !== 'harbor-ui') || data.schema !== 1 || data.scripts !== 'forbidden') throw new Error('skin rejected')
  if (!data.name || data.name.length > 40) throw new Error('skin rejected')
  for (const side of [data.tokens?.light, data.tokens?.dark]) {
    if (!side) continue
    for (const [name, value] of Object.entries(side)) {
      if (!NAME.test(name) || typeof value !== 'string' || !valueOk(name, value)) throw new Error('skin rejected')
    }
  }
  const width = data.layout?.sidebar?.widthPx
  const composer = data.layout?.composer?.maxWidthPx
  if (width != null && (!Number.isInteger(width) || width < 200 || width > 360)) throw new Error('skin rejected')
  if (composer != null && (!Number.isInteger(composer) || composer < 560 || composer > 960)) throw new Error('skin rejected')
  return data
}

const darkNow = () => document.body.hasAttribute('data-ds-dark-theme')

export const applySkin = (pack: SkinPackage | null) => {
  const shell = document.querySelector<HTMLElement>('.shell')
  if (!shell) return
  for (const name of [...shell.style]) {
    if (name.startsWith('--')) shell.style.removeProperty(name)
  }
  if (!pack) return
  const tokens = (darkNow() ? pack.tokens?.dark : pack.tokens?.light) ?? {}
  for (const [name, value] of Object.entries(tokens)) shell.style.setProperty(name, value)
  if (pack.layout?.sidebar?.widthPx) shell.style.setProperty('--sider-width', `${pack.layout.sidebar.widthPx}px`)
  if (pack.layout?.composer?.maxWidthPx) shell.style.setProperty('--message-list-max-width', `${pack.layout.composer.maxWidthPx}px`)
}

export const saveSkin = (pack: SkinPackage | null) => {
  if (pack) localStorage.setItem(KEY, JSON.stringify({ ...pack, format: 'deepapi-ui' }))
  else localStorage.removeItem(KEY)
  applySkin(pack)
}

export const loadSkin = () => {
  const raw = localStorage.getItem(KEY)
  if (!raw) return
  try {
    applySkin(parseSkin(raw))
  } catch {
    localStorage.removeItem(KEY)
  }
}
