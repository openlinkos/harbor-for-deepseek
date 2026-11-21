import { translate, type Locale } from '@deepapi/i18n'
import { presentBlocks } from './blocks.js'
import { composeCitationMarkdown, joinAnswerText } from './citations.js'
import { estimateCost, formatCny } from '@deepapi/pricing'
import { activePath, childIds, siblingIds } from '@deepapi/types'
import type { ContentBlock, Conversation, Message } from '@deepapi/types'
import { cloneElement, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type FormEvent, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { readTheme, saveTheme, type ThemeChoice } from './themeMode.js'
import { loadSkin, parseSkin, saveSkin } from './skin.js'
import { Markdown } from './markdown.js'
import { readProfile, saveProfile, type LocalProfile } from './profile.js'
import { HINT_NETWORK, replyErrorKey } from './errors.js'
import { useHarbor } from './store.js'
import { ACTION_ICONS } from './official-icons.js'
import { GLYPHS, type GlyphName } from './glyphs.js'
import { livePhase, phaseOf, stoppedInTitle, type ThinkPhase } from './phase.js'
import { USER_MENU_ICONS } from './user-menu-icons.js'
import { DsButton, DsFileButton } from './ds-button.js'

const useProfile = () => {
  const [profile, setProfile] = useState<LocalProfile>(readProfile)
  useEffect(() => {
    const sync = () => setProfile(readProfile())
    window.addEventListener('deepapi-profile', sync)
    return () => window.removeEventListener('deepapi-profile', sync)
  }, [])
  return profile
}

const Mark = () => (
  <svg className="mark" viewBox="0 0 48 48" aria-hidden="true">
    <path className="ink" d="M15 4H33A10 10 0 0 1 43 14V22A10 10 0 0 1 33 32H24L12 42L18 32H15A10 10 0 0 1 5 22V14A10 10 0 0 1 15 4Z" />
    <path className="accent" d="M16 15.5h16a2.6 2.6 0 0 1 0 5.2H16a2.6 2.6 0 0 1 0-5.2Z" />
  </svg>
)

export const ProductVersion = () => (
  <p className="product-version" data-testid="product-version" data-commit={__DEEPAPI_COMMIT__} title={__DEEPAPI_COMMIT__}>
    {`DeepAPI v${__DEEPAPI_VERSION__}`}
  </p>
)

export const SiteFooter = () => {
  const t = useT()
  const locale = useHarbor((state) => state.settings.locale)
  return (
    <footer className="site-footer" data-testid="site-footer">
      <p>{t('footerAbout')}</p>
      <p>
        <a href="https://github.com/openlinkos/deepapi">GitHub</a>
        <span aria-hidden="true"> · </span>
        <a href="https://github.com/openlinkos/deepapi/blob/master/LICENSE">{t('footerLicense')}</a>
        <span aria-hidden="true"> · </span>
        <a href={locale === 'zh' ? 'https://openlinkos.com/zh/' : 'https://openlinkos.com/'}>OpenLinkOS</a>
      </p>
      <p>{t('footerMark')}</p>
    </footer>
  )
}

const FillIcon = ({ paths, size = 16, viewBox = '0 0 16 16', fillRule }: { paths: readonly string[]; size?: number; viewBox?: string; fillRule?: 'evenodd' | 'nonzero' }) => (
  <svg width={size} height={size} viewBox={viewBox} fill="currentColor" aria-hidden="true">
    {paths.map((d, index) => <path key={`${index}:${d.slice(0, 16)}`} d={d} fill="currentColor" fillRule={fillRule} />)}
  </svg>
)

/** Official ds-tooltip--s, portaled to body so a turn's content-visibility cannot clip it. */
const HoverTip = ({ text, children, className }: { text: string; children: ReactElement<React.HTMLAttributes<HTMLElement>>; className?: string }) => {
  const anchor = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const place = () => {
    const rect = anchor.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ left: rect.left + rect.width / 2, top: rect.bottom + 4 })
  }
  useEffect(() => {
    if (!open) return undefined
    const follow = () => place()
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open])
  const previous = children.props
  const child = cloneElement(children, {
    ref: anchor,
    onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => {
      place()
      setOpen(true)
      previous.onMouseEnter?.(event)
    },
    onMouseLeave: (event: ReactMouseEvent<HTMLElement>) => {
      setOpen(false)
      previous.onMouseLeave?.(event)
    },
    onFocus: (event: ReactFocusEvent<HTMLElement>) => {
      if (event.currentTarget.matches(':focus-visible')) {
        place()
        setOpen(true)
      }
      previous.onFocus?.(event)
    },
    onBlur: (event: ReactFocusEvent<HTMLElement>) => {
      setOpen(false)
      previous.onBlur?.(event)
    },
  } as { ref: Ref<HTMLElement> } & HTMLAttributes<HTMLElement>)
  return (
    <>
      {child}
      {open ? createPortal(
        <span className={`ds-tooltip ds-tooltip--s is-open${className ? ` ${className}` : ''}`} role="tooltip" style={{ left: pos.left, top: pos.top }}>
          {text}
          <span className="ds-tooltip__arrow ds-tooltip__arrow--sharp" aria-hidden="true" />
        </span>,
        document.body,
      ) : null}
    </>
  )
}
const UserMenuIcon = ({ name }: { name: keyof typeof USER_MENU_ICONS }) => {
  const paths = USER_MENU_ICONS[name].map((d, index) => <path key={index} d={d} fill="currentColor" />)
  if (name === 'settings') {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <g clipPath="url(#user-menu-settings-clip)">{paths}</g>
        <defs>
          <clipPath id="user-menu-settings-clip">
            <rect width="16" height="16" />
          </clipPath>
        </defs>
      </svg>
    )
  }
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {paths}
    </svg>
  )
}
const Glyph = ({ name, size = 16 }: { name: GlyphName; size?: number }) => {
  const glyph = GLYPHS[name]
  return <FillIcon paths={glyph.paths} viewBox={glyph.vb} size={size} fillRule={'fill' in glyph ? glyph.fill : undefined} />
}
const MORE_DOTS = [
  'M4.55146 8.00001C4.55146 8.63513 4.03659 9.15001 3.40146 9.15001C2.76634 9.15001 2.25146 8.63513 2.25146 8.00001C2.25146 7.36488 2.76634 6.85001 3.40146 6.85001C4.03659 6.85001 4.55146 7.36488 4.55146 8.00001Z',
  'M9.1476 8.00001C9.1476 8.63513 8.63273 9.15001 7.9976 9.15001C7.36248 9.15001 6.8476 8.63513 6.8476 8.00001C6.8476 7.36488 7.36248 6.85001 7.9976 6.85001C8.63273 6.85001 9.1476 7.36488 9.1476 8.00001Z',
  'M13.7486 8.00001C13.7486 8.63513 13.2338 9.15001 12.5986 9.15001C11.9635 9.15001 11.4486 8.63513 11.4486 8.00001C11.4486 7.36488 11.9635 6.85001 12.5986 6.85001C13.2338 6.85001 13.7486 7.36488 13.7486 8.00001Z',
]
const ICON_GLYPH: Record<string, GlyphName> = {
  'M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2': 'thinking',
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18': 'search',
  'M12 19V5M6 11l6-6 6 6': 'send',
  'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3': 'search',
  'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM9 3v18': 'sidebar',
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v8M8 12h8': 'newChat',
  'M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01': 'multi',
  'M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z': 'pin',
  'M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13': 'trash',
  'M6 9l6 6 6-6': 'chevron',
  'M9 6l6 6-6 6': 'chevron',
  'M4 20h4L18 10l-4-4L4 16v4zM13 7l4 4': 'pencil',
  'M4 20h4l10-10-4-4L4 16v4zM13 7l4 4': 'pencil',
  'M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11': 'copy',
  'M4 12v8h16v-8M12 16V4M8 8l4-4 4 4': 'share',
  'M14 5h5v5M19 5l-8 8M9 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3': 'share',
  'M7 17 17 7M9 7h8v8': 'share',
  'M12 5v14M5 12h14': 'plus',
  'M8 12h8M12 8v8': 'plus',
  'M6 4h9l3 3v13H6z': 'attach',
  'M21.4 11.1 12.7 19.8a5 5 0 0 1-7.1-7.1l8.5-8.4a3.5 3.5 0 0 1 4.9 5L10.5 17.8a2 2 0 1 1-2.8-2.8l7.8-7.8': 'attach',
  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h2M18 12h2M12 4v2M12 18v2': 'settingsGeneral',
  'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0': 'settingsAccount',
  'M4 7h16v12H4zM4 11h16M9 7v12': 'settingsData',
  'M7 3h8l4 4v14H7zM11 13h6M11 17h6': 'settingsPolicy',
  'M6 6l12 12M18 6 6 18': 'dismiss',
  'M9 6h11M9 12h11M9 18h11M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17': 'multi',
}
const Icon = ({ d, size = 16, stroke }: { d: string; size?: number; stroke?: number }) => {
  const name = ICON_GLYPH[d]
  if (name) return <Glyph name={name} size={size} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke ?? (size >= 20 ? 2 : 1.7)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} fill="none" />
    </svg>
  )
}

const focusComposer = () => {
  window.requestAnimationFrame(() => {
    const box = document.querySelector<HTMLTextAreaElement>('[data-testid="composer"]')
    if (!box) return
    box.focus({ preventScroll: true })
    const end = box.value.length
    box.setSelectionRange(end, end)
  })
}

const snippetAround = (text: string, query: string) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  const needle = query.trim().toLowerCase()
  const at = flat.toLowerCase().indexOf(needle)
  if (!needle || at < 0) return null
  const start = Math.max(0, at - 24)
  const end = Math.min(flat.length, at + needle.length + 48)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

const MarkedText = ({ text, query, mark }: { text: string; query: string; mark: string }) => {
  const needle = query.trim()
  if (!needle) return <>{text}</>
  const hay = text.toLowerCase()
  const pin = needle.toLowerCase()
  const nodes: ReactNode[] = []
  let cursor = 0
  let guard = 0
  while (cursor < text.length && guard < 40) {
    const at = hay.indexOf(pin, cursor)
    if (at < 0) {
      nodes.push(text.slice(cursor))
      break
    }
    if (at > cursor) nodes.push(text.slice(cursor, at))
    nodes.push(<span className={mark} key={`${at}-${guard}`}>{text.slice(at, at + needle.length)}</span>)
    cursor = at + needle.length
    guard += 1
  }
  if (cursor < text.length && nodes.length && guard >= 40) nodes.push(text.slice(cursor))
  return <>{nodes}</>
}

const formatSearchTime = (iso: string, yesterday: string, locale: Locale) => {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return ''
  const now = new Date()
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((dayStart(now) - dayStart(when)) / 86_400_000)
  if (days === 0) return `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
  if (days === 1) return yesterday
  const month = when.getMonth() + 1
  const date = when.getDate()
  if (when.getFullYear() === now.getFullYear()) return locale === 'zh' ? `${month}月${date}日` : `${month}/${date}`
  return locale === 'zh' ? `${when.getFullYear()}年${month}月${date}日` : `${month}/${date}/${when.getFullYear()}`
}

const SEARCH_HIT_ICON = 'M10 2C5.58162 2 2.00003 5.58162 2 10C2 11.2255 2.27557 12.3887 2.76953 13.4287L3.07422 14.0674L4.35059 13.4609L4.04785 12.8223L3.90332 12.4971C3.58796 11.7279 3.41406 10.8848 3.41406 10C3.41409 6.36278 6.36277 3.41407 10 3.41406C13.6372 3.41406 16.5859 6.36278 16.5859 10C16.5859 13.6372 13.6372 16.5859 10 16.5859C9.25515 16.5859 8.70984 16.5329 8.22656 16.3994C7.75059 16.2679 7.29925 16.0478 6.75879 15.6709C5.96644 15.1182 4.82978 14.9233 3.89355 15.5146L3.86426 15.5342L3.24121 15.9727L3.70996 17.3721L4.65918 16.7041C5.00017 16.4952 5.50572 16.5226 5.94824 16.8311C6.58879 17.2779 7.18624 17.5792 7.85059 17.7627C8.50781 17.9442 9.19541 18 10 18C14.4184 18 18 14.4184 18 10C18 5.58162 14.4184 2 10 2ZM6.25 10.5566V11.9707H10.1367V10.5566H6.25ZM6.25 9.23438H13.7852V7.82031H6.25V9.23438Z'

const shortcutWindows = () => {
  if (typeof navigator === 'undefined') return false
  return navigator.userAgent.toLowerCase().includes('windows')
}

type PopupNode = { readonly current: HTMLElement | null }

/** Close a popover on an outside press, Escape, or focus leaving the trigger and popup. */
const usePopoverDismiss = (open: boolean, onClose: () => void, anchor: PopupNode, popup: PopupNode) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const contains = (node: EventTarget | null) =>
      node instanceof Node && Boolean(anchor.current?.contains(node) || popup.current?.contains(node))
    const onMouseDown = (event: MouseEvent) => {
      if (contains(event.target)) return
      onCloseRef.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onCloseRef.current()
    }
    let timer = 0
    const onFocusOut = (event: FocusEvent) => {
      if (!contains(event.target)) return
      const next = event.relatedTarget
      if (next instanceof Node && contains(next)) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const active = document.activeElement
        if (active instanceof Node && contains(active)) return
        onCloseRef.current()
      }, 0)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [open, anchor, popup])
}

const Wordmark = () => (
  <span className="wordmark">
    <span className="wordmark-name">DeepAPI</span>
  </span>
)

/** Official chat shows the first four site logos on a source strip. */
const SOURCE_MARKS = 4

const siteIconSrc = (icon?: string | null) => (typeof icon === 'string' ? icon.trim() : '')

const Favicon = ({ label, icon }: { label: string; icon?: string | null }) => {
  const src = siteIconSrc(icon)
  const letter = (label.trim().slice(0, 1) || '?').toUpperCase()
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    setFailed(false)
    setReady(false)
  }, [src])
  useEffect(() => {
    const img = imgRef.current
    if (!img || !src || failed) return
    if (img.complete && img.naturalWidth > 0) setReady(true)
  }, [src, failed])
  if (!src || failed) {
    return <i className="favicon" aria-hidden="true">{letter}</i>
  }
  return (
    <i className="favicon" aria-hidden="true">
      <img
        ref={imgRef}
        src={src}
        alt=""
        className={ready ? 'on' : ''}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
      />
    </i>
  )
}

type SourceItem = { url: string; title: string; snippet: string; site: string; date?: string; icon?: string | null }
type SourcesApi = {
  open: boolean
  show: (items: SourceItem[]) => void
  toggle: (items: SourceItem[]) => void
}
const SourcesPanel = createContext<SourcesApi>({ open: false, show: () => undefined, toggle: () => undefined })

const MODAL_FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Official ds-modal defaults: mask click and Escape close, focus stays inside, then returns to the trigger. */
const ConfirmDialog = ({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void }) => {
  const t = useT()
  const panel = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const previousFocus = useRef<HTMLElement | null>(null)
  const capturedFocus = useRef(false)
  if (!capturedFocus.current && typeof document !== 'undefined') {
    capturedFocus.current = true
    const active = document.activeElement
    previousFocus.current = active instanceof HTMLElement ? active : null
  }
  useLayoutEffect(() => {
    const root = panel.current
    if (!root) return
    const focusables = () => [...root.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)].filter((node) => node.tabIndex >= 0 && !node.hasAttribute('disabled'))
    const nodes = focusables()
    nodes[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (!list.length) {
        event.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const current = document.activeElement
      const inside = current instanceof Node && root.contains(current)
      if (event.shiftKey) {
        if (!inside || current === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!root.isConnected) return
      const target = event.target
      if (target instanceof Node && root.contains(target)) return
      const list = focusables()
      ;(list[0] ?? root).focus()
    }
    root.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('keydown', onKey)
      const back = previousFocus.current
      if (back?.isConnected) back.focus()
    }
  }, [])
  return createPortal(
    <div
      ref={panel}
      className="modal confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="confirm-dialog"
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="confirm-card">
        <h2>{label}</h2>
        <div className="edit-actions">
          <DsButton type="button" onClick={onCancel}>{t('cancel')}</DsButton>
          <DsButton type="button" variant="danger" data-testid="confirm-delete" onClick={onConfirm}>{t('delete')}</DsButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const useT = () => {
  const locale = useHarbor((state) => state.settings.locale)
  return (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars)
}

type TurnGroup = { id: string; messageIds: string[] }

const turnGroups = (path: Message[]): TurnGroup[] => {
  const groups: TurnGroup[] = []
  let index = 0
  while (index < path.length) {
    const message = path[index]
    if (message.role === 'user') {
      const next = path[index + 1]
      const assistant = next && next.role === 'assistant' ? next : null
      groups.push({ id: message.id, messageIds: assistant ? [message.id, assistant.id] : [message.id] })
      index += assistant ? 2 : 1
    } else {
      groups.push({ id: message.id, messageIds: [message.id] })
      index += 1
    }
  }
  return groups
}

type ShareModeValue = {
  on: boolean
  groupOf: (messageId: string) => string | null
  selected: ReadonlySet<string>
  toggle: (groupId: string) => void
  enter: (messageId: string) => void
}

const ShareMode = createContext<ShareModeValue | null>(null)

/** No DOM node unless selecting, so article > .prose stays a direct child for the markdown gate. */
const LinkMark = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M6.6 9.4 9.4 6.6M7.2 5.4l.6-.6a2.3 2.3 0 0 1 3.2 3.2l-.6.6M8.8 10.6l-.6.6a2.3 2.3 0 0 1-3.2-3.2l.6-.6" />
  </svg>
)

const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      d={off
        ? 'M3 3l18 18M10.5 10.7a2 2 0 002.8 2.8M7 7.2C5.2 8.4 3.8 10.2 3 12c1.6 3.2 4.8 6 9 6 1.4 0 2.7-.3 3.9-.8M14 6.3A9 9 0 0121 12c-.4.8-1 1.6-1.7 2.3'
        : 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z'}
    />
    {off ? null : <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />}
  </svg>
)

const DOCS = 'https://github.com/openlinkos/deepapi/blob/master/SECURITY.md'
const PLATFORM = 'https://platform.deepseek.com'
const REPO = 'https://github.com/openlinkos/deepapi'

export const KeyGate = () => {
  const t = useT()
  const locked = useHarbor((state) => state.locked)
  const hosted = useHarbor((state) => state.hosted)
  const openLogin = useHarbor((state) => state.openLogin)
  const saveKey = useHarbor((state) => state.saveKey)
  const unlock = useHarbor((state) => state.unlock)
  const setLocale = useHarbor((state) => state.setLocale)
  const locale = useHarbor((state) => state.settings.locale)
  const prefs = useHarbor((state) => state.prefs)
  const setPrefs = useHarbor((state) => state.setPrefs)
  const [key, setKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [show, setShow] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const onSave = (event: FormEvent) => {
    event.preventDefault()
    void saveKey(key, '', true)
  }
  const onUnlock = (event: FormEvent) => {
    event.preventDefault()
    void unlock(passphrase).then((ok) => setError(ok ? '' : t('wrongPassphrase')))
  }
  const askForKey = (event?: FormEvent) => {
    event?.preventDefault()
    setKeyOpen(true)
  }

  return (
    <main className="landing" data-testid="landing">
      <header className="landing-bar">
        <span className="brand-name">
          <Mark />
          <Wordmark />
        </span>
        <span className="landing-tools">
          <a className="landing-app" href="https://github.com/openlinkos/deepapi/releases">{t('getApp')}</a>
          <LanguageSwitch locale={locale} onChange={setLocale} />
        </span>
      </header>
      <div className="landing-stage">
        {locked ? (
          <form className="key-card" onSubmit={onUnlock}>
            <h1>{t('unlockTitle')}</h1>
            <label>
              {t('passcode')}
              <input
                data-testid="unlock-passphrase"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary block" data-testid="unlock-submit" type="submit">
              {t('unlock')}
            </button>
          </form>
        ) : (
          <>
            <p className="landing-announce">{t('landingAnnounce')}</p>
            <h1 className="landing-title">{t('landingTitle')}</h1>
            <form className="composer landing-composer" onSubmit={askForKey}>
              <textarea
                data-testid="landing-draft"
                rows={2}
                value={draft}
                placeholder={t('landingPlaceholder')}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (event.target.value.trim()) setKeyOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    setKeyOpen(true)
                  }
                }}
              />
              <div className="composer-tools">
                <div className="chips">
                  <button type="button" data-testid="landing-thinking" className={prefs.thinking ? 'chip on' : 'chip'} aria-pressed={prefs.thinking} onClick={() => void setPrefs({ thinking: !prefs.thinking })}>
                    <Icon d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2" /> {t('thinking')}
                  </button>
                  <button type="button" data-testid="landing-search" className={prefs.search ? 'chip on' : 'chip'} aria-pressed={prefs.search} onClick={() => void setPrefs({ search: !prefs.search })}>
                    <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /> {t('search')}
                  </button>
                </div>
                <button className={`send ${draft.trim() ? 'ready' : ''}`} data-testid="landing-send" type="submit" aria-label={t('send')}>
                  <Icon d="M12 19V5M6 11l6-6 6 6" />
                </button>
              </div>
            </form>
            {hosted ? (
              <button className="landing-pill" type="button" data-testid="open-login" onClick={openLogin}>
                {t('loginTitle')}
              </button>
            ) : null}
          </>
        )}
      </div>
      <footer className="landing-foot">
        <div>
          <strong>产品</strong>
          <a href="https://deepapi.linkos.org">DeepAPI 网页版</a>
          <a href={PLATFORM}>{t('apiPlatform')}</a>
          <a href="https://deepapi.linkos.io">分享</a>
          <a href={REPO}>GitHub</a>
        </div>
        <div>
          <strong>文档</strong>
          <a href="https://api-docs.deepseek.com">API 文档</a>
          <a href="https://platform.deepseek.com">API 价格</a>
        </div>
        <div>
          <strong>法务 & 安全</strong>
          <div>{t('terms')}</div>
          <div>{t('privacyPolicy')}</div>
        </div>
        <div>
          <strong>加入我们</strong>
          <a href={REPO}>openlinkos/deepapi</a>
        </div>
        <p className="landing-copy">© 2026 OpenLinkOS</p>
      </footer>
      <SiteFooter />
      {keyOpen && !locked ? (
        <div className="modal" role="dialog" aria-modal="true" data-testid="key-dialog">
          <form className="key-card" onSubmit={onSave}>
            <h2>{t('keyTitle')}</h2>
            <p className="key-lead">
              {t('keyBody')}{' '}
              <a href={DOCS} target="_blank" rel="noreferrer noopener">{t('learnMore')}</a>
            </p>
            <label className="key-field">
              <span className="sr">{t('keyPlaceholder')}</span>
              <input
                data-testid="key-input"
                type={show ? 'text' : 'password'}
                value={key}
                autoComplete="off"
                spellCheck={false}
                placeholder={t('keyPlaceholder')}
                onChange={(event) => setKey(event.target.value)}
              />
              <button type="button" className="eye" aria-label={show ? t('hide') : t('show')} onClick={() => setShow((value) => !value)}>
                <EyeIcon off={show} />
              </button>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary block" data-testid="key-save" type="submit">
              {t('saveKey')}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  )
}

const ThemeSwitch = () => {
  const t = useT()
  const [theme, setTheme] = useState<ThemeChoice>(readTheme())
  return (
    <div className="chips theme-cards">
      {(['light', 'dark', 'system'] as ThemeChoice[]).map((choice) => (
        <button
          key={choice}
          type="button"
          className={theme === choice ? 'chip on' : 'chip'}
          onClick={() => {
            saveTheme(choice)
            setTheme(choice)
          }}
        >
          <span className="theme-face" aria-hidden="true" />
          <Icon
            d={
              choice === 'light'
                ? 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'
                : choice === 'dark'
                  ? 'M16 14.5A6.5 6.5 0 1 1 9.5 6 5 5 0 0 0 16 14.5Z'
                  : 'M4 5h16v10H4zM8 19h8'
            }
          />
          <span className="theme-label">{choice === 'system' ? t('themeSystem') : choice === 'light' ? t('themeLight') : t('themeDark')}</span>
        </button>
      ))}
    </div>
  )
}

const LANGUAGES = ['简体中文', 'English', '跟随系统', 'Afrikaans', 'አማርኛ', 'العربية', 'Azərbaycan', 'Беларуская', 'Български', 'বাংলা', 'Català', 'Čeština', 'Dansk']

const AnchoredMenu = ({ label, options, selected, onPick, testId, dividerAfter, menuClass, shiftRight = 0, dismiss = false }: { label: string; options: string[]; selected: string; onPick: (value: string) => void; testId?: string; dividerAfter?: number; menuClass?: string; shiftRight?: number; dismiss?: boolean }) => {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ top: 0, right: 0, maxHeight: 320 })
  const show = () => setOpen((value) => !value)
  usePopoverDismiss(dismiss && open, () => setOpen(false), trigger, menuRef)
  useLayoutEffect(() => {
    if (!open) return
    const rect = trigger.current?.getBoundingClientRect()
    const menu = menuRef.current
    if (!rect || !menu) return
    const margin = 8
    const needed = menu.scrollHeight
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const spaceAbove = rect.top - margin
    const openUp = needed > spaceBelow && spaceAbove > spaceBelow
    const available = Math.max(36, (openUp ? spaceAbove : spaceBelow) - 6)
    const top = openUp ? Math.max(margin, rect.top - 6 - Math.min(needed, available)) : rect.bottom + 6
    const menuWidth = Math.min(menu.offsetWidth, window.innerWidth - margin * 2)
    const minRight = margin
    const maxRight = Math.max(minRight, window.innerWidth - menuWidth - margin)
    const preferred = window.innerWidth - rect.right - shiftRight
    const right = Math.min(Math.max(preferred, minRight), maxRight)
    setBox({ top, right, maxHeight: available })
  }, [open, shiftRight])
  return (
    <div className="pill-menu">
      <div ref={trigger} data-testid={testId} aria-expanded={open} tabIndex={0} onClick={show} onKeyDown={(event) => { if (event.key === 'Enter') show() }}>{label}<span className="pill-gap" /><Icon d="M6 9l6 6 6-6" /></div>
      {open ? createPortal(
        <div ref={menuRef} className={`anchored-menu ${menuClass ?? ''}`} role="listbox" data-testid={testId ? `${testId}-menu` : undefined} style={{ top: box.top, right: box.right, maxHeight: box.maxHeight, maxWidth: 'calc(100vw - 16px)', overflowY: 'auto', minHeight: menuClass === 'lang-menu' ? Math.min(240, box.maxHeight) : undefined }}>
          {options.map((option, index) => (
            <div key={option}>
              {dividerAfter === index - 1 ? <hr /> : null}
              <button type="button" role="option" aria-selected={option === selected} onClick={() => { onPick(option); setOpen(false) }}>
                <span>{option}</span>
                {option === selected ? <Icon d="M5 12.5 9.2 17 19 7" /> : null}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

const LanguageSwitch = ({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) => (
  <div className="lang" role="group" aria-label="language">
    <button type="button" className={locale === 'zh' ? 'on' : ''} aria-pressed={locale === 'zh'} onClick={() => onChange('zh')}>
      中文
    </button>
    <button type="button" className={locale === 'en' ? 'on' : ''} aria-label="English" aria-pressed={locale === 'en'} onClick={() => onChange('en')}>
      EN
    </button>
  </div>
)

const BlockView = ({ block, testId }: { block: ContentBlock; testId?: string }) => {
  const t = useT()
  if (block.type === 'thinking') {
    return <Thinking text={block.thinking} />
  }
  if (block.type === 'text') {
    const marked = block.citations?.length
      ? `${block.text.trimEnd()}${block.citations.map((_, index) => `[citation:${index + 1}]`).join('')}`
      : block.text
    return (
      <div className="prose" data-testid={testId}>
        <Markdown text={marked} citations={block.citations} />
      </div>
    )
  }
  if (block.type === 'server_tool_use') {
    const action = block.input.action
    if (action === 'search') {
      return null
    }
    if (action === 'open_page' && 'url' in block.input && typeof block.input.url === 'string') {
      return <p className="tool-line">{t('opened')}: {block.input.url}</p>
    }
    if (action === 'read_link' && 'url' in block.input && typeof block.input.url === 'string') {
      return <p className="tool-line">{t('read')}: {block.input.url}</p>
    }
    if (action === 'find_in_page' && 'pattern' in block.input) {
      return <p className="tool-line">{String(block.input.pattern)}</p>
    }
    return null
  }
  if (block.type === 'web_search_tool_result') {
    return <SearchResults block={block} />
  }
  if (block.type === 'web_fetch_tool_result') {
    if (block.content.type === 'web_fetch_tool_result_error') {
      return <p className="tool-line">{block.content.error_code}</p>
    }
    const title = block.content.content?.title
    return (
      <p className="tool-line">
        <a href={block.content.url} target="_blank" rel="noreferrer noopener">
          {title || block.content.url}
        </a>
      </p>
    )
  }
  if (block.type === 'file_ref') {
    return (
      <span className="file-chip">
        {block.filename}
        <small>{Math.ceil(block.bytes / 1024)} KB</small>
      </span>
    )
  }
  return null
}

const SourceMarks = ({ items }: { items: SourceItem[] }) => {
  const t = useT()
  const sources = useContext(SourcesPanel)
  if (!items.length) return null
  return (
    <button
      type="button"
      className="favicons"
      data-testid="source-favicons"
      aria-expanded={sources.open}
      aria-label={t('foundPages', { count: items.length })}
      onClick={() => sources.toggle(items)}
    >
      {items.slice(0, SOURCE_MARKS).map((item) => <Favicon key={item.url} label={item.site} icon={item.icon} />)}
    </button>
  )
}

const SearchResults = ({ block }: { block: Extract<ContentBlock, { type: 'web_search_tool_result' }> }) => {
  const t = useT()
  const sources = useContext(SourcesPanel)
  const results = block.content.filter((item) => item.type === 'web_search_result')
  if (!results.length) {
    return null
  }
  const items = results.map((result) => ({
    url: result.url,
    title: result.title,
    snippet: result.snippet ?? '',
    site: result.site_name || result.url,
    date: result.page_age ? result.page_age.slice(0, 10).replace(/-/g, '/') : undefined,
    icon: result.site_icon,
  }))
  return (
    <div className="search-block">
      <p className="found-line">
        <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
        {t('foundPages', { count: results.length })}
        <SourceMarks items={items} />
      </p>
      <button className="sources-pill" type="button" data-testid="search-results" onClick={() => sources.show(items)}>
        <span className="favicons">
          {results.slice(0, SOURCE_MARKS).map((result) => (
            <Favicon key={result.url} label={result.site_name || result.title} icon={result.site_icon} />
          ))}
        </span>
        {t('pagesPill', { count: results.length })}
      </button>
    </div>
  )
}

const PhaseTitle = ({ text, live }: { text: string; live: boolean }) => {
  const ghost = useRef<HTMLSpanElement>(null)
  const ghostRoot = useRef<ShadowRoot | null>(null)
  useLayoutEffect(() => {
    const host = ghost.current
    if (!host) return
    // Closed shadow keeps the sizing copy out of the button's text (Playwright toHaveText
    // pierces open shadow). Layout still matches the official opacity-0 copy.
    if (!ghostRoot.current || ghostRoot.current.host !== host) ghostRoot.current = host.attachShadow({ mode: 'closed' })
    ghostRoot.current.textContent = text
  }, [text])
  if (!live) return <span className="phase-label">{text}</span>
  return (
    <span className="phase-label phase-shimmer">
      {text}
      <span className="phase-shimmer-sweep" aria-hidden="true">
        <span className="phase-shimmer-bar" style={{ width: 120 }} />
        <span className="phase-shimmer-ghost" ref={ghost} />
      </span>
    </span>
  )
}

const phaseLabel = (phase: ThinkPhase, seconds: number, t: ReturnType<typeof useT>) => {
  if (phase === 'stopped') return t('stopped')
  if (phase === 'searching') return t('phaseSearching')
  if (phase === 'browsing') return t('phaseBrowsing')
  if (phase === 'thinking' || phase === 'pending') return t('phaseThinking')
  return t('thoughtFor', { seconds })
}

const Thinking = ({ text }: { text: string }) => {
  const t = useT()
  const streaming = useHarbor((state) => state.streaming)
  const [open, setOpen] = useState(true)
  if (!text) {
    return null
  }
  return (
    <section className="thinking" data-testid="thinking">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        <FillIcon paths={GLYPHS.thinking.paths} viewBox={GLYPHS.thinking.vb} size={16} fillRule="evenodd" />
        <PhaseTitle text={streaming ? t('phaseThinking') : t('thoughtFor', { seconds: 1 })} live={streaming} />
        <span className="chev"><Glyph name={open ? 'chevron' : 'chevronRight'} size={14} /></span>
      </button>
      {open ? <div className="thinking-body think-copy"><Markdown text={text} streaming={streaming} /></div> : null}
    </section>
  )
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const samePage = (left: string, right: string) => {
  try {
    return new URL(left).href === new URL(right).href
  } catch {
    return left === right
  }
}

type BrowsePage = { title: string; url: string; fetched: boolean }

/** One row per URL. A fetch result replaces the hostname that open_page showed first; the page title is kept verbatim. */
const pushBrowse = (pages: BrowsePage[], url: string, title: string, fetched: boolean) => {
  const found = pages.find((page) => samePage(page.url, url))
  if (!found) {
    pages.push({ title, url, fetched })
    return
  }
  if (fetched) {
    found.title = title
    found.fetched = true
  }
}

const BROWSE_EXTERNAL_PATH = 'M6.54199 8.62824C6.54199 8.44193 6.54146 8.28829 6.53906 8.15851L1.11719 13.5814L0.728516 13.1927L0.339844 12.803L5.76172 7.38019C5.63201 7.3778 5.47812 7.37824 5.29199 7.37824H1.43555V6.27863H5.29199C5.65471 6.27863 5.97167 6.27814 6.22852 6.30597C6.49541 6.33493 6.76232 6.3998 7.00293 6.57452C7.13452 6.67013 7.25108 6.78571 7.34668 6.9173C7.52157 7.15808 7.5863 7.4256 7.61523 7.69269C7.64305 7.94948 7.64258 8.26562 7.64258 8.62824V12.4857H6.54199V8.62824Z'

const BrowseExternalIcon = () => (
  <span className="browse-ext" aria-hidden="true">
    <svg width={14} height={14} viewBox="0 0 8 14" fill="none">
      <path d={BROWSE_EXTERNAL_PATH} fill="currentColor" />
    </svg>
  </span>
)

const AssistantTurn = ({ message }: { message: Message }) => {
  const t = useT()
  const sourcesApi = useContext(SourcesPanel)
  const [open, setOpen] = useState(true)
  const steps: Array<
    | { type: 'think'; text: string }
    | { type: 'search'; items: SourceItem[] }
    | { type: 'searching' }
    | { type: 'browse'; items: BrowsePage[] }
  > = []
  let browse: BrowsePage[] = []
  const flush = () => {
    if (browse.length) {
      steps.push({ type: 'browse', items: browse })
      browse = []
    }
  }
  const sources: SourceItem[] = []
  let pendingSearch = false
  const presented = presentBlocks(message.blocks)
  for (const block of presented) {
    if (block.type === 'thinking') {
      flush()
      if (block.thinking.trim()) steps.push({ type: 'think', text: block.thinking })
    } else if (block.type === 'web_search_tool_result') {
      flush()
      pendingSearch = false
      const items = block.content.filter((item) => item.type === 'web_search_result').map((result) => ({
        url: result.url,
        title: result.title,
        snippet: result.snippet ?? '',
        site: result.site_name || result.url,
        date: result.page_age ? result.page_age.slice(0, 10).replace(/-/g, '/') : undefined,
        icon: result.site_icon,
      }))
      sources.push(...items)
      if (items.length) steps.push({ type: 'search', items })
    } else if (block.type === 'web_fetch_tool_result' && block.content.type !== 'web_fetch_tool_result_error') {
      const url = block.content.url
      pushBrowse(browse, url, block.content.content?.title || hostOf(url), true)
    } else if (block.type === 'server_tool_use') {
      const action = block.input.action
      if (action === 'search') pendingSearch = true
      if ((action === 'open_page' || action === 'read_link') && 'url' in block.input && typeof block.input.url === 'string') {
        pushBrowse(browse, block.input.url, hostOf(block.input.url), false)
      }
    } else if (block.type === 'text') {
      flush()
    } else {
      flush()
    }
  }
  flush()
  if (pendingSearch && message.status === 'streaming') steps.push({ type: 'searching' })
  const joined = joinAnswerText(presented)
  const answerStreaming = message.status === 'streaming'
  const article = composeCitationMarkdown(joined.text, joined.citations, sources, answerStreaming)
  const phase = phaseOf(message)
  const hasThink = steps.some((step) => step.type === 'think')
  const showHead =
    hasThink ||
    (message.status === 'aborted' && phase === 'stopped' && steps.length > 0) ||
    (message.status === 'streaming' && livePhase(phase) && (steps.length > 0 || message.blocks.some((block) => block.type === 'thinking')))
  const title = phaseLabel(phase, message.thinkingSeconds ?? 1, t)
  const renderStep = (step: (typeof steps)[number], index: number) => {
    const last = index === steps.length - 1 ? 'is-last' : ''
    if (step.type === 'think') {
      return (
        <div key={index} className={`timeline-step timeline-think think-copy ${last}`}>
          <span className="timeline-dot" aria-hidden="true" />
          <span className="timeline-line" aria-hidden="true" />
          <Markdown text={step.text} streaming={answerStreaming} />
        </div>
      )
    }
    if (step.type === 'search') {
      return (
        <p key={index} className={`timeline-step timeline-search found-line ${last}`}>
          <span className="timeline-line" aria-hidden="true" />
          <Glyph name="search" size={14} />
          {t('foundPages', { count: step.items.length })}
          <SourceMarks items={step.items} />
        </p>
      )
    }
    if (step.type === 'searching') {
      return (
        <p key={index} className={`timeline-step timeline-search found-line search-live ${last}`} data-testid="search-pending">
          <span className="timeline-line" aria-hidden="true" />
          <Glyph name="search" size={14} />
          {t('searchQueries')}
        </p>
      )
    }
    return (
      <p key={index} className={`timeline-step timeline-browse found-line browse-line ${last}`}>
        <span className="timeline-line" aria-hidden="true" />
        <Glyph name="document" size={14} />
        <span className="browse-count">{t('browsedPages', { count: step.items.length })}</span>
        {step.items.map((item) => (
          <span key={item.url} className="browse-item">
            <a className="browse-link" href={item.url} target="_blank" rel="noreferrer noopener">{item.title}</a>
            <BrowseExternalIcon />
          </span>
        ))}
      </p>
    )
  }
  return (
    <>
      {showHead ? (
        <section className={`thinking${phase === 'stopped' ? ' is-stopped' : ''}`} data-testid="thinking" data-phase={phase}>
          <button type="button" data-testid="thinking-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <FillIcon paths={GLYPHS.thinking.paths} viewBox={GLYPHS.thinking.vb} size={16} fillRule="evenodd" />
            <PhaseTitle text={title} live={livePhase(phase)} />
            <span className="chev"><Glyph name={open ? 'chevron' : 'chevronRight'} size={14} /></span>
          </button>
          <div className={`thinking-collapse ${open ? 'open' : ''}`}>
            <div className="thinking-body">
              {steps.map(renderStep)}
            </div>
          </div>
        </section>
      ) : steps.map(renderStep)}
      {article.text.trim() ? (
        <div className="prose" data-testid="assistant-text">
          <Markdown text={article.text} citations={article.citations} cards={article.cards} streaming={answerStreaming} />
        </div>
      ) : null}
      {sources.length ? (
        <button className="sources-pill" type="button" data-testid="search-results" onClick={() => sourcesApi.show(sources)}>
          <span className="favicons">{sources.slice(0, SOURCE_MARKS).map((item) => <Favicon key={item.url} label={item.site} icon={item.icon} />)}</span>
          {t('pagesPill', { count: sources.length })}
        </button>
      ) : null}
    </>
  )
}

const MessageRow = ({ message }: { message: Message }) => {
  const t = useT()
  const share = useContext(ShareMode)
  const groupId = share?.groupOf(message.id) ?? null
  const picked = Boolean(groupId && share?.selected.has(groupId))
  const messages = useHarbor((state) => state.messages)
  const selectSibling = useHarbor((state) => state.selectSibling)
  const regenerate = useHarbor((state) => state.regenerate)
  const resend = useHarbor((state) => state.resend)
  const editUser = useHarbor((state) => state.editUser)
  const streaming = useHarbor((state) => state.streaming)
  const generatingHere = useHarbor((state) =>
    state.messages.some((item) => item.conversationId === message.conversationId && item.status === 'streaming'),
  )
  const siblings = siblingIds(messages, message.id)
  const parent = messages.find((item) => item.id === message.parentId && item.role === 'user')
  const userSiblings = parent ? siblingIds(messages, parent.id) : []
  const versionIds = siblings.length > 1 ? siblings : userSiblings.length > 1 ? userSiblings : []
  const versionCurrent = siblings.length > 1 ? message.id : parent?.id ?? ''
  const versionIndex = versionIds.indexOf(versionCurrent)
  const textOf = message.blocks.filter((block) => block.type === 'text').map((block) => (block.type === 'text' ? block.text : '')).join('\n')
  const errorKey = replyErrorKey(message.errorMessage)
  const [copied, setCopied] = useState(false)
  const voteKey = `deepapi-vote:${message.id}`
  const [vote, setVote] = useState<'up' | 'down' | null>(() => {
    const saved = localStorage.getItem(voteKey)
    return saved === 'up' || saved === 'down' ? saved : null
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(textOf)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const choose = (next: 'up' | 'down') => {
    const value = vote === next ? null : next
    setVote(value)
    if (value) localStorage.setItem(voteKey, value)
    else localStorage.removeItem(voteKey)
  }
  const stepVersion = (dir: -1 | 1) => {
    const next = versionIds[versionIndex + dir]
    if (next && versionCurrent) void selectSibling(versionCurrent, next)
  }
  return (
    <article className={`turn ${message.role} ${message.status === 'streaming' ? 'streaming' : ''} ${share?.on ? 'share-on' : ''} ${share?.on && picked ? 'share-picked' : ''}`} data-testid={`message-${message.role}`} data-follow-id={message.id} aria-busy={message.status === 'streaming'}>
      <input className="share-box ds-checkbox ds-checkbox--l" type="checkbox" hidden={!share?.on} checked={picked} aria-label={textOf || t('share')} onChange={() => { if (groupId && share) share.toggle(groupId) }} />
      <div className="share-halo" aria-hidden="true" />
      {message.role === 'user' ? (
        editing ? (
          <form className="edit-card" onSubmit={(event) => { event.preventDefault(); void editUser(message.id, draft).then(() => setEditing(false)) }}>
            <textarea aria-label={t('edit')} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <div className="edit-actions">
              <button type="button" onClick={() => { setDraft(textOf); setEditing(false) }}>{t('cancel')}</button>
              <button className="primary" type="submit">{t('send')}</button>
            </div>
          </form>
        ) : (
        <>
          <div className="bubble">
            {textOf}
            {message.errorMessage === HINT_NETWORK ? (
              <HoverTip text={t('retry')}>
                <button type="button" className="hint-retry" data-testid="hint-retry" aria-label={t('retry')} onClick={() => void resend(message.id)}>
                  <FillIcon paths={[...ACTION_ICONS.regen]} size={14} />
                </button>
              </HoverTip>
            ) : null}
          </div>
          {message.errorMessage === HINT_NETWORK ? <p className="user-hint" data-testid="user-hint">{t('hintNetworkError')}</p> : null}
          <div className="user-actions">
            <HoverTip text={t('copy')}>
              <button type="button" data-tip={t('copy')} aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf)}>
                <Icon size={20} d="M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11" />
              </button>
            </HoverTip>
            <HoverTip text={t('edit')}>
              <button type="button" data-tip={t('edit')} aria-label={t('edit')} onClick={() => { setDraft(textOf); setEditing(true) }}>
                <Icon size={20} d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" />
              </button>
            </HoverTip>
          </div>
        </>
        )
      ) : null}
      {message.status === 'refused' ? <p className="refused">{t('refused')}</p> : null}
      {message.role === 'assistant' && message.status === 'streaming' && phaseOf(message) === 'pending' ? (
        <div className="reply-dots" data-testid="reply-dots" aria-hidden="true"><i /><i /><i /></div>
      ) : null}
      {message.role === 'assistant' ? <AssistantTurn message={message} /> : message.blocks.filter((block) => block.type === 'file_ref').map((block, blockIndex) => (
            <BlockView key={`${message.id}-f-${blockIndex}`} block={block} />
          ))}
      {message.status === 'error' ? (
        <p className="form-error">
          {errorKey ? t(errorKey) : message.errorMessage || t('error')}
          <button type="button" data-testid="retry" onClick={() => void regenerate(message.id)}>{t('retry')}</button>
        </p>
      ) : null}
      {message.status === 'aborted' && !stoppedInTitle(message) ? <p className="hint">{t('stopped')}</p> : null}
      {message.role === 'assistant' && message.status !== 'streaming' ? (
        <div className="action-row">
          {versionIds.length > 1 ? (
            <span className="branch" data-testid="versions">
              <button type="button" aria-label="‹" disabled={versionIndex <= 0} onClick={() => stepVersion(-1)}>‹</button>
              <span>{versionIndex + 1} / {versionIds.length}</span>
              <button type="button" aria-label="›" disabled={versionIndex >= versionIds.length - 1} onClick={() => stepVersion(1)}>›</button>
            </span>
          ) : null}
          <HoverTip text={copied ? t('copied') : t('copy')}>
            <button type="button" data-tip={copied ? t('copied') : t('copy')} aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200) })}>{copied ? '✓' : <FillIcon paths={[...ACTION_ICONS.copy]} />}</button>
          </HoverTip>
          <HoverTip text={t('regenerate')}>
            <button type="button" data-testid="regenerate" data-tip={t('regenerate')} aria-label={t('regenerate')} disabled={streaming} onClick={() => void regenerate(message.id)}>
              <FillIcon paths={[...ACTION_ICONS.regen]} />
            </button>
          </HoverTip>
          <HoverTip text={t('like')}>
            <button type="button" data-tip={t('like')} className={vote === 'up' ? 'on' : ''} aria-label={t('like')} aria-pressed={vote === 'up'} onClick={() => choose('up')}><FillIcon paths={[...ACTION_ICONS.like]} /></button>
          </HoverTip>
          <HoverTip text={t('dislike')}>
            <button type="button" data-tip={t('dislike')} className={vote === 'down' ? 'on' : ''} aria-label={t('dislike')} aria-pressed={vote === 'down'} onClick={() => { choose('down'); setFeedbackOpen(true) }}><FillIcon paths={[...ACTION_ICONS.dislike]} /></button>
          </HoverTip>
          <HoverTip text={t('share')}>
            <button type="button" data-tip={t('share')} aria-label={t('share')} onClick={() => share?.enter(message.id)}><FillIcon paths={[...ACTION_ICONS.share]} /></button>
          </HoverTip>
          {message.status === 'aborted' && !generatingHere && childIds(messages, message.id).length === 0 ? (
            <button type="button" className="continue-gen" data-testid="continue" onClick={() => void useHarbor.getState().continueReply(message.id)}>{t('continueGenerating')}</button>
          ) : null}
        </div>
      ) : null}
      {feedbackOpen ? (
        <div className="modal" role="dialog" aria-label={t('feedbackTitle')}>
          <form className="modal-card feedback" onSubmit={(event) => { event.preventDefault(); localStorage.setItem(`deepapi-feedback:${message.id}`, '1'); setFeedbackOpen(false) }}>
            <h2>{t('feedbackTitle')}</h2>
            <div className="feedback-chips">
              {[t('feedbackHarm'), t('feedbackFake'), t('feedbackUseless'), t('feedbackOther')].map((label) => (
                <button key={label} type="button" className="chip">{label}</button>
              ))}
            </div>
            <textarea placeholder={t('feedbackPlaceholder')} />
            <div className="edit-actions">
              <button type="button" onClick={() => setFeedbackOpen(false)}>{t('cancel')}</button>
              <button className="primary" type="submit">{t('submit')}</button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  )
}

export const Shell = () => {
  const t = useT()
  useEffect(() => {
    loadSkin()
    const onTheme = () => loadSkin()
    window.addEventListener('deepapi-theme', onTheme)
    return () => window.removeEventListener('deepapi-theme', onTheme)
  }, [])
  const state = useHarbor()
  const conversation = state.conversations.find((item) => item.id === state.activeId) ?? null
  const path = useMemo(
    () => activePath(state.messages, conversation?.activeLeafId ?? null),
    [state.messages, conversation?.activeLeafId],
  )
  const turns = useMemo(() => turnGroups(path), [path])
  const [shareConv, setShareConv] = useState<string | null>(null)
  const [shareIds, setShareIds] = useState<string[] | null>(null)
  const [sharePrimed, setSharePrimed] = useState(false)
  const [shareSoon, setShareSoon] = useState(false)
  const [shareAll, setShareAll] = useState(true)
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 799px)').matches)
  const sharing = shareIds !== null
  useEffect(() => {
    const media = window.matchMedia('(max-width: 799px)')
    const apply = () => setPhone(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  const exitShare = () => {
    setShareConv(null)
    setShareIds(null)
    setSharePrimed(false)
    setShareSoon(false)
    setShareAll(true)
  }
  const enterShare = (id: string | null) => {
    if (!id) return
    setShareSoon(false)
    setShareAll(true)
    setShareConv(id)
    if (id !== conversation?.id) {
      setSharePrimed(false)
      setShareIds([])
      void state.openChat(id)
      return
    }
    setShareIds(turns.map((group) => group.id))
    setSharePrimed(true)
  }
  const enterGroup = (messageId: string) => {
    if (!conversation?.id) return
    const group = turns.find((item) => item.messageIds.includes(messageId))
    setShareSoon(false)
    setShareAll(false)
    setShareConv(conversation.id)
    setShareIds(group ? [group.id] : [])
    setSharePrimed(true)
  }
  useEffect(() => {
    if (!shareConv || sharePrimed || conversation?.id !== shareConv) return
    if (!turns.length) {
      setShareIds([])
      setSharePrimed(true)
      return
    }
    setShareIds(shareAll ? turns.map((group) => group.id) : [turns[turns.length - 1].id])
    setSharePrimed(true)
  }, [shareConv, sharePrimed, shareAll, conversation?.id, turns])
  const shareConvRef = useRef(shareConv)
  useEffect(() => {
    const previous = shareConvRef.current
    shareConvRef.current = shareConv
    if (!sharing || !previous) return
    if (shareConv === previous && conversation?.id !== previous) exitShare()
  }, [sharing, shareConv, conversation?.id])
  useEffect(() => {
    if (!sharing) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      exitShare()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sharing])
  const shareValue: ShareModeValue = {
    on: sharing,
    groupOf: (messageId) => turns.find((group) => group.messageIds.includes(messageId))?.id ?? null,
    selected: new Set(shareIds ?? []),
    toggle: (groupId) => setShareIds((current) => {
      const ids = current ?? []
      return ids.includes(groupId) ? ids.filter((item) => item !== groupId) : [...ids, groupId]
    }),
    enter: (messageId) => enterGroup(messageId),
  }
  const selectedCount = turns.filter((group) => (shareIds ?? []).includes(group.id)).length
  const allTurns = turns.length > 0 && selectedCount === turns.length
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const consumed = useRef<string | null>(null)
  const seenChat = useRef<string | null | undefined>(undefined)
  const seenAssistant = useRef<string | null>(null)
  const [away, setAway] = useState(false)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  useEffect(() => {
    const down = () => setOffline(true)
    const up = () => setOffline(false)
    window.addEventListener('offline', down)
    window.addEventListener('online', up)
    return () => {
      window.removeEventListener('offline', down)
      window.removeEventListener('online', up)
    }
  }, [])
  useLayoutEffect(() => {
    const list = listRef.current
    const latest = [...path].reverse().find((message) => message.role === 'assistant')
    const chatId = conversation?.id ?? null
    const switching = seenChat.current !== undefined && seenChat.current !== chatId && !state.streaming
    seenChat.current = chatId
    if (!list) {
      return
    }
    if (switching) {
      seenAssistant.current = latest?.id ?? null
      consumed.current = latest?.id ?? null
      stick.current = true
      list.scrollTo({ left: 0, top: list.scrollHeight, behavior: 'instant' })
      return
    }
    const appeared = Boolean(latest && latest.id !== seenAssistant.current)
    if (appeared && state.streaming) {
      stick.current = true
    }
    if (!stick.current) {
      seenAssistant.current = latest?.id ?? null
      return
    }
    const bottom = list.scrollHeight - list.clientHeight
    const nodes = list.querySelectorAll<HTMLElement>('.turn.assistant .prose')
    const assistant = nodes[nodes.length - 1]
    let target = bottom
    let stop = false
    const followId = latest?.id ?? null
    if (assistant && appeared && followId && followId !== consumed.current) {
      const bodyTop = assistant.getBoundingClientRect().top - list.getBoundingClientRect().top
      const absolute = list.scrollTop + bodyTop
      if (Number.isFinite(absolute) && absolute < bottom - 1) {
        target = Math.max(0, absolute)
        stop = true
      }
    }
    if (!stop && appeared && state.streaming) {
      return
    }
    list.scrollTo({ left: 0, top: target, behavior: 'instant' })
    if (stop && followId) {
      consumed.current = followId
      seenAssistant.current = followId
      stick.current = false
      const distance = list.scrollHeight - list.scrollTop - list.clientHeight
      setAway(distance > 52)
    } else if (!appeared || !state.streaming) {
      seenAssistant.current = latest?.id ?? null
    }
  }, [path, state.streaming, state.messages, conversation?.id])
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return undefined
    }
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])

  const profile = useProfile()
  const [collapsed, setCollapsed] = useState(false)
  const [filtering, setFiltering] = useState(false)
  const [filter, setFilter] = useState('')
  const [corpus, setCorpus] = useState<Record<string, string>>({})
  const [activeHit, setActiveHit] = useState(-1)
  const resultsRef = useRef<HTMLDivElement>(null)
  const query = filter.trim()
  const hits = useMemo(() => {
    if (!query) return []
    const needle = query.toLowerCase()
    const includes = (value: string) => value.toLowerCase().includes(needle)
    const rows = state.conversations.flatMap((chat) => {
      if (chat.deletedAt) return []
      const title = chat.title || t('newChat')
      const snippet = snippetAround(corpus[chat.id] || '', query)
      if (!includes(title) && !snippet) return []
      return [{ id: chat.id, title, updatedAt: chat.updatedAt, snippet }]
    })
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return rows
  }, [query, state.conversations, corpus, t])
  const hitKey = hits.map((hit) => hit.id).join('\n')
  const [trackedHits, setTrackedHits] = useState('')
  if (hitKey !== trackedHits) {
    setTrackedHits(hitKey)
    setActiveHit(hits.length ? 0 : -1)
  }
  useEffect(() => {
    if (!filtering) return undefined
    let live = true
    void useHarbor.getState().loadSearchCorpus().then((next) => {
      if (live) setCorpus(next)
    })
    return () => {
      live = false
    }
  }, [filtering, state.conversations, state.messages])
  useEffect(() => {
    const list = resultsRef.current
    if (!list || activeHit < 0) return
    const item = list.querySelector<HTMLElement>(`#conversation-search-result-${activeHit}`)
    if (!item) return
    const delta = item.getBoundingClientRect().top - list.getBoundingClientRect().top
    if (delta < 0) list.scrollTop += delta
    else if (delta + item.offsetHeight > list.clientHeight) list.scrollTop += delta + item.offsetHeight - list.clientHeight
  }, [activeHit, hitKey])
  const openSearched = (id: string) => {
    window.history.pushState(null, '', `/a/chat/s/${encodeURIComponent(id)}`)
    setFiltering(false)
    setFilter('')
    void state.openChat(id)
    focusComposer()
  }
  const [userMenu, setUserMenu] = useState(false)
  const userBarRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<SourceItem[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const inComposer = target?.dataset.testid === 'composer'
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setFiltering(true)
      } else if (meta && event.key.toLowerCase() === 'j' && (!typing || inComposer)) {
        event.preventDefault()
        void state.newChat()
        focusComposer()
      } else if (event.key === 'Escape') {
        setPanel(null)
        setUserMenu(false)
        setFiltering(false)
        setFilter('')
        if (state.settingsOpen) {
          state.setSettingsOpen(false)
        }
        focusComposer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])
  useEffect(() => {
    if (!userMenu) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && userBarRef.current?.contains(target)) return
      setUserMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [userMenu])
  const groups = useMemo(() => {
    const buckets = new Map<string, typeof state.conversations>()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const order = [t('groupPinned'), t('groupToday'), t('groupYesterday'), t('group30')]
    for (const item of state.conversations.filter((chat) => !filter || (chat.title || t('newChat')).includes(filter))) {
      const when = new Date(item.updatedAt)
      const days = (startOfDay.getTime() - new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime()) / 86_400_000
      const label = item.pinned
        ? t('groupPinned')
        : days < 1
          ? t('groupToday')
          : days < 2
            ? t('groupYesterday')
            : days < 30
              ? t('group30')
                : `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      buckets.set(label, [...(buckets.get(label) ?? []), item])
    }
    return [...buckets.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0])
      const ib = order.indexOf(b[0])
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      }
      return a[0] < b[0] ? 1 : -1
    })
  }, [state.conversations, filter, t])
  const serverName = state.serverUser?.username
  const who = serverName || profile.nickname || t('product')
  const initial = serverName ? serverName.slice(0, 1).toUpperCase() : profile.initial
  const narrow = () => window.matchMedia('(max-width: 767px)').matches
  const sourcesApi = useMemo<SourcesApi>(() => ({
    open: panel !== null,
    show: (items) => setPanel(items),
    toggle: (items) => setPanel((current) => (current ? null : items)),
  }), [panel])

  return (
    <SourcesPanel.Provider value={sourcesApi}>
    <ShareMode.Provider value={shareValue}>
    <div className={`shell ${state.sidebarOpen ? 'nav-open' : ''} ${collapsed ? 'sider-collapsed' : ''} ${panel ? 'panel-open' : ''} ${selecting ? 'selecting' : ''} ${sharing ? 'sharing' : ''}`}>
      {offline ? <p className="offline-banner" role="status" data-testid="offline">{t('offline')}</p> : null}
      <aside className="sidebar" data-testid="sidebar">
        <div className="sider-top">
          <span
            className="brand-name"
            data-testid="brand"
            onClick={() => {
              state.setSidebarOpen(false)
              void state.newChat()
              focusComposer()
              if (window.location.pathname !== '/' || window.location.search || window.location.hash) {
                window.history.replaceState(null, '', '/')
              }
            }}
          >
            <Mark />
            <Wordmark />
          </span>
          <span className="sider-icons">
            {selecting ? null : <button className="icon-btn" type="button" aria-label={t('search')} onClick={() => setFiltering((value) => !value)}>
              <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
            </button>}
            <button className="icon-btn" type="button" aria-label={t('hide')} onClick={() => (narrow() ? state.setSidebarOpen(false) : setCollapsed(true))}>
              <Icon d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM9 3v18" />
            </button>
          </span>
        </div>
        {selecting ? (
          <div className="select-head">
            <span>{picked.length ? t('selectedCount', { count: picked.length }) : t('selectChats')}</span>
            <button className="select-close" type="button" aria-label={t('close')} title={t('exitMulti')} onClick={() => { setSelecting(false); setPicked([]) }}>
              <Icon size={12} d="M6 6l12 12M18 6 6 18" />
            </button>
          </div>
        ) : (
          <div className={shortcutWindows() ? 'new-chat shortcut-win' : 'new-chat'} data-testid="new-chat" role="presentation" tabIndex={0} onClick={() => { state.setSidebarOpen(false); void state.newChat(); focusComposer() }} onKeyDown={(event) => { if (event.key === 'Enter') { state.setSidebarOpen(false); void state.newChat(); focusComposer() } }}>
            <span className="new-chat-label"><Icon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v8M8 12h8" /><span>{t('newChat')}</span></span>
          </div>
        )}
        <div className="side-scroll">
          {state.conversations.length === 0 ? <p className="hint">{t('noConversations')}</p> : null}
          {groups.map(([label, items], index) => (
            <div key={label} className={`group${index === 0 ? ' is-first' : ''}${label === t('groupPinned') ? ' pinned' : ''}`}>
              <p className="group-label">
                {label}
                {!selecting && index === 0 ? (
                  <button className="icon-btn" type="button" aria-label={t('multiSelect')} onClick={() => { setSelecting(true); setPicked([]) }}>
                    <Icon d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01" />
                  </button>
                ) : null}
              </p>
              {items.map((item) => (
                <ChatLink
                  key={item.id}
                  conversation={item}
                  active={item.id === state.activeId}
                  picking={selecting}
                  picked={picked.includes(item.id)}
                  onPick={() => setPicked((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])}
                  onMulti={() => { setSelecting(true); setPicked([]) }}
                  onShare={() => enterShare(item.id)}
                />
              ))}
              {label === t('groupPinned') ? <div className="group-rule" data-testid="pinned-rule" /> : null}
            </div>
          ))}
        </div>
        {selecting ? (
          <div className="select-foot">
            <button type="button" aria-disabled={!picked.length} className={picked.length ? '' : 'off'} onClick={() => { if (picked.length) void state.pinMany(picked) }}>
              <Icon d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z" />
              <span>{t('pin')}</span>
            </button>
            <button type="button" aria-disabled={!picked.length} className={picked.length ? 'danger' : 'off'} onClick={() => { if (!picked.length) return; for (const id of picked) void state.removeChat(id); setPicked([]); setSelecting(false) }}>
              <Icon d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />
              <span>{t('delete')}</span>
            </button>
          </div>
        ) : (
        <div
          className="user-bar"
          data-testid="user-menu"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={userMenu}
          ref={userBarRef}
          onClick={(event) => {
            const target = event.target
            if (target instanceof Element && target.closest('.user-menu')) return
            setUserMenu((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setUserMenu(true)
          }}
          onBlur={() => setUserMenu(false)}
        >
          <span className="avatar" aria-hidden="true">
            {initial || 'D'}
          </span>
          <span className="user-copy">
            <span className="user-label">{who}</span>
          </span>
          <span className="user-more" aria-hidden="true">
            <FillIcon paths={MORE_DOTS} />
          </span>
          {userMenu ? (
            <div className="menu user-menu" role="menu" onMouseDown={(event) => event.preventDefault()}>
              <div role="menuitem" tabIndex={0} onClick={() => { setUserMenu(false); window.open('https://github.com/openlinkos/deepapi/releases', '_blank', 'noopener') }}><UserMenuIcon name="download" />{t('downloadMobile')}</div>
              <div role="menuitem" tabIndex={0} data-testid="settings-open" onClick={() => { setUserMenu(false); state.setSettingsOpen(true) }}><UserMenuIcon name="settings" />{t('systemSettings')}</div>
              <div role="menuitem" tabIndex={0} onClick={() => { setUserMenu(false); window.open('https://github.com/openlinkos/deepapi/issues', '_blank', 'noopener') }}><UserMenuIcon name="help" />{t('helpFeedback')}</div>
              <div role="menuitem" tabIndex={0} onClick={() => { setUserMenu(false); if (state.serverUser) void state.logoutServer(); else void state.clearKey() }}><UserMenuIcon name="logout" />{t('logout')}</div>
            </div>
          ) : null}
        </div>
        )}
      </aside>
      {collapsed ? (
        <>
          <span className="collapsed-mark"><Mark /></span>
          <div className="float-pill">
            <button className="icon-btn" type="button" aria-label={t('hide')} onClick={() => setCollapsed(false)}>
              <Icon d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM9 3v18" />
            </button>
            <button className="icon-btn" type="button" aria-label={t('newChat')} onClick={() => { void state.newChat(); focusComposer() }}>
              <Icon d="M12 5v14M5 12h14" />
            </button>
            <button className="icon-btn" type="button" aria-label={t('search')} onClick={() => setFiltering(true)}>
              <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
            </button>
          </div>
        </>
      ) : null}
      {filtering ? <button className="search-scrim" type="button" aria-label={t('close')} onClick={() => { setFiltering(false); setFilter(''); focusComposer() }} /> : null}
      {filtering ? (
        <form className={query ? 'search-dialog has-query' : 'search-dialog'} role="search" onSubmit={(event) => event.preventDefault()}>
          <span className="search-glyph"><Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" /></span>
          <span className="search-rule" />
          <input
            className="side-filter"
            autoFocus
            placeholder={t('searchChats')}
            value={filter}
            aria-label={t('search')}
            aria-controls={query ? 'conversation-search-results' : undefined}
            aria-activedescendant={query && activeHit >= 0 ? `conversation-search-result-${activeHit}` : undefined}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || !query) return
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (!hits.length) return
                const step = event.key === 'ArrowDown' ? 1 : -1
                setActiveHit((index) => {
                  const start = index < 0 ? 0 : index
                  return (start + step + hits.length) % hits.length
                })
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const hit = hits[activeHit]
                if (hit) openSearched(hit.id)
              }
            }}
          />
          <button type="button" aria-label={t('close')} onClick={() => { setFiltering(false); setFilter(''); focusComposer() }}>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
          {query ? (
            <div className={hits.length ? 'search-results' : 'search-results is-empty'} id="conversation-search-results" role="listbox" aria-label={t('searchPanel')} ref={resultsRef}>
              {hits.length ? (
                <div className="search-results-items">
                  {hits.map((hit, index) => (
                    <div
                      key={hit.id}
                      id={`conversation-search-result-${index}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={index === activeHit}
                      aria-posinset={index + 1}
                      aria-setsize={hits.length}
                      data-conversation-search-result-index={index}
                      className={index === activeHit ? 'search-hit active' : 'search-hit'}
                      onMouseMove={() => { if (index !== activeHit) setActiveHit(index) }}
                      onClick={() => openSearched(hit.id)}
                    >
                      <span className="search-hit-avatar" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d={SEARCH_HIT_ICON} fill="#81858C" />
                        </svg>
                      </span>
                      <span className="search-hit-main">
                        <span className="search-hit-line">
                          <span className="search-hit-title"><MarkedText text={hit.title} query={query} mark="search-hit-mark" /></span>
                          <span className="search-hit-time">{formatSearchTime(hit.updatedAt, t('groupYesterday'), state.settings.locale)}</span>
                        </span>
                        {hit.snippet ? (
                          <span className="search-hit-snippet"><MarkedText text={hit.snippet} query={query} mark="search-hit-snip" /></span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-results-empty">{t('searchNoResult')}</div>
              )}
            </div>
          ) : null}
        </form>
      ) : null}
      <section className="stage">
        {path.length > 0 ? <div className="top-fill" aria-hidden="true" /> : null}
        <header className="topbar">
          <button className="icon-btn menu-mobile" data-testid="menu" type="button" onClick={() => state.setSidebarOpen(!state.sidebarOpen)}>
            <Icon size={24} d="M3 9h13M3 16h18" />
          </button>
          {sharing && phone ? <div className="chat-title" data-testid="share-title">{t('sharePickTitle')}</div> : conversation?.title ? <div className="chat-title">{conversation.title}</div> : null}
          {state.serverMode ? <span className="server-pill" data-testid="server-mode">{t('serverChat')}</span> : null}
          {state.serverUser?.role === 'admin' ? (
            <button className="ghost" data-testid="open-admin" type="button" onClick={() => state.openAdmin(true)}>{t('adminTitle')}</button>
          ) : null}
          <span className="top-actions">
            {sharing && phone ? (
              <DsButton className="share-top-cancel" data-testid="share-top-cancel" onClick={exitShare}>{t('cancel')}</DsButton>
            ) : (
              <>
                <a className="download-app" href="https://github.com/openlinkos/deepapi/releases" target="_blank" rel="noreferrer noopener">
                  <Icon d="M12 4v10M8 10l4 4 4-4M5 18h14" />
                  <span>{t('downloadApp')}</span>
                </a>
                <button className="icon-btn top-new" data-testid="top-new" type="button" aria-label={t('newChat')} onClick={() => { void state.newChat(); focusComposer() }}>
                  <Icon size={24} d="M5 7h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8l-3 2v-2H5a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM8 12h6M11 9v6" />
                </button>
                {path.length > 0 ? (
                  <button className="icon-btn" type="button" aria-label="share" onClick={() => enterShare(conversation?.id ?? null)}>
                    <Icon size={16} d="M14 5h5v5M19 5l-8 8M9 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
                  </button>
                ) : null}
              </>
            )}
          </span>
        </header>
        {path.length === 0 ? (
          <div className="transcript" data-testid="message-list"><Empty /></div>
        ) : (
          <>
            <div
              className="transcript chat-scroll"
              data-testid="message-list"
              ref={listRef}
              onScroll={() => {
                const list = listRef.current
                if (!list) {
                  return
                }
                stick.current = list.scrollTop + list.offsetHeight >= list.scrollHeight - 1
                setAway(!(list.scrollTop + list.offsetHeight > list.scrollHeight - 52))
              }}
            >
              <div className="chat-column">
                {path.map((message) => conversation ? <MessageRow key={message.id} message={message} /> : null)}
                <div ref={endRef} />
              </div>
              {sharing ? null : (
                <div className="composer-wrap">
                  <Composer />
                  <p className="footnote ai-note">{t('aiNote')}</p>
                </div>
              )}
            </div>
            {sharing ? (
              <div className="share-bar">
                <div className="share-bar-inner">
                  <label className="share-all">
                    <input
                      className="ds-checkbox ds-checkbox--l"
                      data-testid="share-all"
                      type="checkbox"
                      checked={allTurns}
                      onChange={() => setShareIds(allTurns ? [] : turns.map((group) => group.id))}
                    />
                    <span>{t('shareSelectAll')}</span>
                  </label>
                  <span className="share-split" aria-hidden="true" />
                  <span className="share-count" data-testid="share-count">{t('shareSelected', { count: selectedCount })}</span>
                  <span className="share-gap" />
                  <DsButton data-testid="share-cancel" onClick={exitShare}>{t('cancel')}</DsButton>
                  <DsButton data-testid="share-create" variant="primary" disabled={selectedCount === 0} onClick={() => setShareSoon(true)}>
                    <LinkMark />
                    {t('createShareLink')}
                  </DsButton>
                </div>
              </div>
            ) : null}
            {away && !sharing ? (
              <button className="jump-end" type="button" aria-label={t('scrollDown')} onClick={() => { stick.current = true; setAway(false); listRef.current?.scrollTo({ left: 0, top: listRef.current.scrollHeight, behavior: 'instant' }) }}>
                <Icon d="M6 9l6 6 6-6" />
              </button>
            ) : null}
          </>
        )}
      </section>
      {panel ? (
        <aside className="search-panel" data-testid="search-panel">
          <header>
            <strong>{t('searchPanel')}</strong>
            <button className="icon-btn panel-close" type="button" aria-label={t('close')} onClick={() => setPanel(null)}>
              <Icon d="M6 6l12 12M18 6 6 18" />
            </button>
          </header>
          <ol>
            {panel.map((item, index) => (
              <li key={item.url}>
                <a className="source-card" href={item.url} target="_blank" rel="noreferrer noopener">
                  <span className="source-meta">
                    <Favicon label={item.site} icon={item.icon} />
                    <span className="source-site">{item.site}</span>
                    {item.date ? <span>{item.date}</span> : null}
                    <span className="source-index">{index + 1}</span>
                  </span>
                  <strong>{item.title}</strong>
                  {item.snippet ? <p>{item.snippet}</p> : null}
                </a>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
      {panel ? <button className="sheet-scrim" type="button" aria-label={t('close')} onClick={() => setPanel(null)} /> : null}
      {state.sidebarOpen ? <button className="scrim" type="button" aria-label={t('close')} onClick={() => state.setSidebarOpen(false)} /> : null}
      {state.settingsOpen ? <Settings /> : null}
      {state.notice ? <ImportToast notice={state.notice} /> : null}
      {shareSoon ? (
        <div className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-soon-title" data-testid="share-soon" onClick={exitShare}>
          <div className="share-soon-card" onClick={(event) => event.stopPropagation()}>
            <button className="share-soon-x" type="button" aria-label={t('close')} data-testid="share-soon-x" onClick={exitShare}>
              <Icon size={16} d="M6 6l12 12M18 6 6 18" />
            </button>
            <h2 id="share-soon-title">{t('shareSoonTitle')}</h2>
            <p>{t('shareSoonBody')}</p>
            <DsButton variant="primary" size="xl" data-testid="share-soon-ok" onClick={exitShare}>{t('shareSoonOk')}</DsButton>
          </div>
        </div>
      ) : null}
    </div>
    </ShareMode.Provider>
    </SourcesPanel.Provider>
  )
}

const ChatLink = ({ conversation, active, picking, picked, onPick, onMulti, onShare }: { conversation: Conversation; active: boolean; picking?: boolean; picked?: boolean; onPick?: () => void; onMulti?: () => void; onShare?: () => void }) => {
  const t = useT()
  const openChat = useHarbor((state) => state.openChat)
  const setSidebarOpen = useHarbor((state) => state.setSidebarOpen)
  const rename = useHarbor((state) => state.rename)
  const pin = useHarbor((state) => state.pin)
  const removeChat = useHarbor((state) => state.removeChat)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0 })
  const [confirming, setConfirming] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  usePopoverDismiss(open, () => setOpen(false), moreRef, menuRef)
  return (
    <a
      className={`chat-link ${active ? 'active' : ''} ${open ? 'open' : ''} ${picking ? 'picking' : ''}`}
      href={`#${conversation.id}`}
      onClick={(event) => {
        event.preventDefault()
        const target = event.target
        // Menu rows and the phone scrim are portaled to document.body, so a click there is not a hit on this row.
        if (!(target instanceof Element) || !event.currentTarget.contains(target)) return
        if (target.closest('.more') || target.closest('form')) return
        if (picking) {
          onPick?.()
          return
        }
        setSidebarOpen(false)
        void openChat(conversation.id)
        focusComposer()
      }}
    >
      <div className="chat-row">
      {picking ? (
        <span className={`pick ${picked ? 'on' : ''}`} role="checkbox" aria-checked={!!picked} aria-label={conversation.title || t('newChat')}>
          {picked ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.1 11.3 2.7 7.9l1.4-1.4 2 2 5.2-5.2 1.4 1.4z" /></svg> : null}
        </span>
      ) : null}
      {editing ? (
        <form
          onSubmit={(event) => { event.preventDefault(); void rename(conversation.id, title); setEditing(false) }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
            event.preventDefault()
            event.stopPropagation()
            setTitle(conversation.title)
            setEditing(false)
          }}
        >
          <input autoFocus aria-label={t('renameTitle')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </form>
      ) : (
        <button type="button">{conversation.title || t('newChat')}</button>
      )}
      {picking ? null : <button ref={moreRef} className="icon-btn more" type="button" aria-label={t('menu')} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setMenuBox({ top: rect.bottom + 4, left: rect.left - 5 })
        setOpen((value) => !value)
      }}><FillIcon paths={MORE_DOTS} /></button>}
      </div>
      {open ? createPortal(
        <>
        {window.matchMedia('(max-width: 767px)').matches ? <button className="item-menu-scrim" type="button" aria-label={t('close')} onClick={() => setOpen(false)} /> : null}
        <div ref={menuRef} className={`menu item-menu ${window.matchMedia('(max-width: 767px)').matches ? 'sheet' : ''}`} role="menu" data-testid="chat-item-menu" style={window.matchMedia('(max-width: 767px)').matches ? undefined : { top: menuBox.top, left: menuBox.left }}>
          <div role="menuitem" tabIndex={0} onClick={() => { setTitle(conversation.title); setEditing(true); setOpen(false) }}><Icon d="M4 20h4L18 10l-4-4L4 16v4zM13 7l4 4" /><span>{t('rename')}</span></div>
          <div role="menuitem" tabIndex={0} onClick={() => { setOpen(false); void pin(conversation.id) }}><Icon d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z" /><span>{conversation.pinned ? t('unpin') : t('pin')}</span></div>
          <div role="menuitem" tabIndex={0} onClick={() => { setOpen(false); onShare?.() }}><Icon d="M4 12v8h16v-8M12 16V4M8 8l4-4 4 4" /><span>{t('share')}</span></div>
          <div role="menuitem" tabIndex={0} onClick={() => { setOpen(false); onMulti?.() }}><Icon d="M9 6h11M9 12h11M9 18h11M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17" /><span>{t('multiSelect')}</span></div>
          <div role="menuitem" tabIndex={0} className="danger" onClick={() => { setOpen(false); setConfirming(true) }}><Icon d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" /><span>{t('delete')}</span></div>
        </div>
        </>,
        document.body,
      ) : null}
      {confirming ? (
        <ConfirmDialog
          label={t('deleteConfirm')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); void removeChat(conversation.id) }}
        />
      ) : null}
    </a>
  )
}

const Empty = () => {
  const t = useT()
  const hasHistory = useHarbor((state) => state.conversations.length > 0)
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  // Official home-with-history text: 1440 「欢迎回来，想从哪里开始？」, 390 「欢迎回来，随时开始吧」.
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1600px)').matches
  // Official home-with-history text, by the capture for that viewport:
  // 1920 dark 「你好，我能帮什么忙吗？」, 1440 「欢迎回来，想从哪里开始？」, 390 「欢迎回来，随时开始吧」.
  const line = t(hasHistory ? (narrow ? 'welcomeBack' : wide ? 'welcomeHello' : 'welcomeAlt') : 'welcomeMessage')
  return (
    <div className="home">
      <h2 className="greeting"><Mark /><span>{line}</span></h2>
      <Composer />
    </div>
  )
}

const Composer = () => {
  const t = useT()
  const prefs = useHarbor((state) => state.prefs)
  const setPrefs = useHarbor((state) => state.setPrefs)
  const send = useHarbor((state) => state.send)
  const stop = useHarbor((state) => state.stop)
  const streaming = useHarbor((state) => state.streaming)
  const generating = useHarbor((state) => state.streaming && state.messages.some((item) => item.status === 'streaming' && item.blocks.length > 0))
  const drafts = useHarbor((state) => state.drafts)
  const addFiles = useHarbor((state) => state.addFiles)
  const removeDraft = useHarbor((state) => state.removeDraft)
  const [text, setText] = useState('')
  const [iconOnly, setIconOnly] = useState(false)
  const chips = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const activeId = useHarbor((state) => state.activeId)
  useEffect(() => {
    focusComposer()
  }, [activeId])
  useEffect(() => {
    const row = chips.current
    if (!row) {
      return
    }
    let collapsedAt = 0
    const measure = () => {
      const labels = [...row.querySelectorAll<HTMLElement>('.chip-label')]
      if (collapsedAt && row.clientWidth <= collapsedAt + 24) {
        return
      }
      labels.forEach((label) => { label.hidden = false })
      const wrapped = labels.some((label) => {
        const line = Number.parseFloat(getComputedStyle(label).lineHeight)
        return Number.isFinite(line) && line > 0 && label.getBoundingClientRect().height > 1.5 * line
      })
      const content = [...row.querySelectorAll<HTMLElement>('.chip')].reduce((sum, chip) => sum + chip.getBoundingClientRect().width, 0)
      const overflow = content > row.clientWidth + 1 || row.scrollWidth > row.clientWidth + 1 || wrapped
      labels.forEach((label) => { label.hidden = overflow })
      setIconOnly(overflow)
      collapsedAt = overflow ? row.clientWidth : 0
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const onPrefill = (event: Event) => {
      setText((event as CustomEvent<string>).detail)
      box.current?.focus()
    }
    window.addEventListener('deepapi-prefill', onPrefill)
    return () => window.removeEventListener('deepapi-prefill', onPrefill)
  }, [])
  const trimmed = text.trim()
  const filesBlocking = drafts.some((file) => file.busy || file.error || !file.fileId)
  const hasFile = drafts.some((file) => file.fileId && !file.busy && !file.error)
  const canSend = !filesBlocking && (trimmed.length > 0 || hasFile)
  const submit = () => {
    if (!canSend) return
    const value = text
    setText('')
    void send(value)
    focusComposer()
  }
  return (
    <div className={`composer ${iconOnly ? 'icon-only' : ''}`}>
      <div className="composer-fill" aria-hidden="true" />
      <div className="composer-fill-alt" aria-hidden="true" />
      {drafts.length ? (
        <ul className="drafts">
          {drafts.map((file) => (
            <li key={file.localId}>
              <span>{file.busy ? t('uploading') : file.filename}</span>
              {file.error ? <small>{file.error}</small> : null}
              <button type="button" onClick={() => removeDraft(file.localId)}>
                {t('remove')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={box}
        data-testid="composer"
        rows={2}
        placeholder={t('composerPlaceholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          if (!event.shiftKey) {
            event.preventDefault()
            submit()
            return
          }
          event.preventDefault()
          const node = event.currentTarget
          const start = node.selectionStart ?? text.length
          const end = node.selectionEnd ?? start
          const next = `${text.slice(0, start)}\n${text.slice(end)}`
          setText(next)
          window.requestAnimationFrame(() => {
            node.selectionStart = start + 1
            node.selectionEnd = start + 1
          })
        }}
      />
      <div className="composer-tools">
        <div className="chips" ref={chips}>
          <span className="chip-wrap">
            <button type="button" data-testid="toggle-thinking" className={prefs.thinking ? 'chip on' : 'chip'} aria-pressed={prefs.thinking} onClick={() => void setPrefs({ thinking: !prefs.thinking })}>
              <Glyph name="thinking" size={14} />
              <span className="chip-label">{t('thinking')}</span>
            </button>
          </span>
          <button type="button" data-testid="toggle-search" className={prefs.search ? 'chip on' : 'chip'} aria-pressed={prefs.search} onClick={() => void setPrefs({ search: !prefs.search })}>
            <Glyph name="search" size={14} />
            <span className="chip-label">{t('search')}</span>
          </button>
        </div>
        <div className="tool-right">
          <button type="button" className="icon-btn" aria-label={t('attach')} onClick={() => fileRef.current?.click()}>
            <Glyph name="attach" size={16} />
          </button>
          <input ref={fileRef} data-testid="file-input" type="file" hidden onChange={(event) => { const list = event.target.files ? [...event.target.files] : []; event.target.value = ''; void addFiles(list) }} />
          {streaming ? (
            generating ? (
              <HoverTip text={t('stopGenerating')} className="is-above-composer">
                <button className="send stop" data-testid="stop" type="button" aria-label={t('stopGenerating')} data-tip={t('stopGenerating')} onClick={stop}>
                  <svg className="stop-square" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
                  </svg>
                </button>
              </HoverTip>
            ) : (
              <button className="send stop" data-testid="stop" type="button" aria-label={t('stopGenerating')} onClick={stop}>
                <span className="send-spinner" aria-hidden="true" />
              </button>
            )
          ) : (
            <button className={`send ${canSend ? 'ready' : ''}`} data-testid="send" type="button" disabled={!canSend} onClick={submit}><Icon size={20} stroke={2.2} d="M12 19V5M6 11l6-6 6 6" /></button>
          )}
        </div>
      </div>
      </div>
  )
}

const Settings = () => {
  const t = useT()
  const settings = useHarbor((state) => state.settings)
  const prefs = useHarbor((state) => state.prefs)
  const setPrefs = useHarbor((state) => state.setPrefs)
  const balance = useHarbor((state) => state.balance)
  const balanceError = useHarbor((state) => state.balanceError)
  const balanceInfo = balance?.balance_infos?.[0]
  const patchSettings = useHarbor((state) => state.patchSettings)
  const setLocale = useHarbor((state) => state.setLocale)
  const refreshBalance = useHarbor((state) => state.refreshBalance)
  const exportJson = useHarbor((state) => state.exportJson)
  const exportZip = useHarbor((state) => state.exportZip)
  const importJson = useHarbor((state) => state.importJson)
  const importZip = useHarbor((state) => state.importZip)
  const clearKey = useHarbor((state) => state.clearKey)
  const setSettingsOpen = useHarbor((state) => state.setSettingsOpen)
  const hosted = useHarbor((state) => state.hosted)
  const serverUser = useHarbor((state) => state.serverUser)
  const serverMode = useHarbor((state) => state.serverMode)
  const syncServer = useHarbor((state) => state.syncServer)
  const copyLocalToServer = useHarbor((state) => state.copyLocalToServer)
  const enterLocalMode = useHarbor((state) => state.enterLocalMode)
  const enterServerMode = useHarbor((state) => state.enterServerMode)
  const logoutServer = useHarbor((state) => state.logoutServer)
  const openLogin = useHarbor((state) => state.openLogin)
  const native = useHarbor((state) => state.native)
  const serverBase = useHarbor((state) => state.serverBase)
  const allowLanHttp = useHarbor((state) => state.allowLanHttp)
  const setAllowLanHttp = useHarbor((state) => state.setAllowLanHttp)
  const connectRemote = useHarbor((state) => state.connectRemote)
  const registerRemote = useHarbor((state) => state.registerRemote)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteUser, setRemoteUser] = useState('')
  const [remotePassword, setRemotePassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [remoteError, setRemoteError] = useState('')
  const totals = useHarbor((state) => state.totals)
  const quota = useHarbor((state) => state.quota)
  const [asCopy, setAsCopy] = useState(false)
  const [nextKey, setNextKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [tab, setTab] = useState<'general' | 'account' | 'data' | 'legal'>('general')
  const [exporting, setExporting] = useState(false)
  const [sharedNote, setSharedNote] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const profile = useProfile()
  const [nickname, setNickname] = useState(profile.nickname)
  const [initial, setInitial] = useState(profile.initial)
  const saveKey = useHarbor((state) => state.saveKey)
  const cost = estimateCost(totals, new Date())
  return (
    <div className="modal settings-modal" role="dialog" aria-modal="true" data-testid="settings-dialog">
      <div className="settings-shell" data-tab={tab}>
        <header className="settings-head">
          <h2>{t('systemSettings')}</h2>
          <button type="button" className="settings-x" data-testid="settings-close" aria-label={t('close')} onClick={() => {
            const modal = document.querySelector('.settings-modal')
            modal?.classList.add('closing')
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            window.setTimeout(() => { setSettingsOpen(false); focusComposer() }, reduce ? 0 : 100)
          }}>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
        </header>
        <nav className="settings-nav" aria-label={t('systemSettings')}>
          <button type="button" data-testid="settings-nav-general" className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}><Icon d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h2M18 12h2M12 4v2M12 18v2" />{t('navGeneral')}</button>
          <button type="button" data-testid="settings-nav-account" className={tab === 'account' ? 'on' : ''} onClick={() => setTab('account')}><Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />{t('navAccount')}</button>
          <button type="button" data-testid="settings-nav-data" className={tab === 'data' ? 'on' : ''} onClick={() => setTab('data')}><Icon d="M4 7h16v12H4zM4 11h16M9 7v12" />{t('navData')}</button>
          <button type="button" data-testid="settings-nav-legal" className={tab === 'legal' ? 'on' : ''} onClick={() => setTab('legal')}><Icon d="M7 3h8l4 4v14H7zM11 13h6M11 17h6" />{t('navLegal')}</button>
        </nav>
        <div className="settings-main">
        <section className="settings-general">
          <h3>{t('theme')}</h3>
          <ThemeSwitch />
          <div className="settings-line">
            <span>{t('language')}</span>
            <AnchoredMenu
              dismiss
              testId="language-trigger"
              menuClass="lang-menu"
              label={settings.locale === 'en' ? 'English' : '简体中文'}
              selected={settings.locale === 'en' ? 'English' : '简体中文'}
              options={LANGUAGES}
              dividerAfter={2}
              shiftRight={88}
              onPick={(value) => {
                if (value === 'English') void setLocale('en')
                else if (value === '简体中文' || value === '跟随系统') void setLocale('zh')
              }}
            />
          </div>
          <div className="settings-line">
            <span>{t('skin')}</span>
            <span className="account-side ds-button-stack">
              <DsButton type="button" data-testid="skin-reset" onClick={() => saveSkin(null)}>{t('skinReset')}</DsButton>
              <DsFileButton
                testId="skin-file"
                accept="application/json,.json"
                onFile={(file) => {
                  void file.text().then((raw) => saveSkin(parseSkin(raw))).catch(() => undefined)
                }}
              >
                {t('skinImport')}
              </DsFileButton>
            </span>
          </div>
          <div className="settings-line">
            <span>{t('safety')}</span>
            <AnchoredMenu
              dismiss
              testId="safety-select"
              label={settings.safetyLevel === 'low' ? t('safetyLow') : t('safetyHigh')}
              selected={settings.safetyLevel === 'low' ? t('safetyLow') : t('safetyHigh')}
              options={[t('safetyHigh'), t('safetyLow')]}
              onPick={(value) => void patchSettings({ safetyLevel: value === t('safetyLow') ? 'low' : 'high' })}
            />
          </div>
          <div className="settings-line">
            <span>{t('readLink')}</span>
            <button
              type="button"
              data-testid="toggle-read"
              className={prefs.readLink ? 'switch on' : 'switch'}
              aria-pressed={prefs.readLink}
              onClick={() => void setPrefs({ readLink: !prefs.readLink })}
            >
              <span className="knob" />
            </button>
          </div>
        </section>
        <section className="settings-account">
          <div className="settings-line">
            <span>API Key</span>
            <DsButton type="button" onClick={() => void clearKey()}>{t('clearKey')}</DsButton>
          </div>
          <div className="settings-line balance-line">
            <span data-testid="balance-label">{t('balance')}</span>
            <span className="account-side">
              <span data-testid="balance-side">
                {balanceError || !balanceInfo
                  ? t('balanceFailed')
                  : <span data-testid="balance-value">{balanceInfo.total_balance} {balanceInfo.currency} {balance.is_available ? t('available') : t('unavailable')}</span>}
              </span>
              {!balanceError && balanceInfo ? (
                <span className="hint" data-testid="balance-hint">
                  {t('granted')} {balanceInfo.granted_balance}
                  {' · '}{t('toppedUp')} {balanceInfo.topped_up_balance}
                </span>
              ) : null}
              {serverMode ? null : (
                <DsButton type="button" data-testid="refresh-balance" onClick={() => void refreshBalance()}>{t('refresh')}</DsButton>
              )}
            </span>
          </div>
          {serverMode ? (
            <div className="settings-line">
              <span>{t('quotaHeading')}</span>
              <span data-testid="quota">
                {quota
                  ? t('quotaLine', {
                      tokenUsed: quota.tokenUsed,
                      tokenQuota: quota.tokenQuota,
                      searchUsed: quota.searchUsed,
                      searchQuota: quota.searchQuota,
                      pageUsed: quota.pageUsed,
                      pageQuota: quota.pageQuota,
                    })
                  : t('balanceFailed')}
              </span>
            </div>
          ) : null}
          <div className="settings-line account-nickname">
            <span>{t('nickname')}</span>
            <input className="account-value" data-testid="nickname" value={nickname} placeholder={t('nickname')} maxLength={32} onChange={(event) => setNickname(event.target.value)} />
            <input className="account-value short" data-testid="avatar-initial" value={initial} placeholder={t('avatarMark')} maxLength={2} onChange={(event) => setInitial(event.target.value)} />
            <DsButton type="button" onClick={() => saveProfile({ nickname, initial })}>{t('save')}</DsButton>
          </div>
        </section>
        <section className="settings-data">
          <div className="settings-line">
            <span>{t('sharedLinks')}</span>
            <DsButton type="button" onClick={() => setSharedNote(true)}>{t('manage')}</DsButton>
          </div>
          {sharedNote ? <p className="hint">{t('noShared')}</p> : null}
          <div className="settings-line stack">
            <div className="settings-copy wide">
              <span>{t('exportAll')}</span>
              <p className="hint">{t('exportAllBody')}</p>
            </div>
            <DsButton type="button" data-testid="export-all" onClick={() => { setExporting(true); void exportJson().finally(() => setExporting(false)) }}>{exporting ? <span className="spinner" aria-hidden="true" /> : t('export')}</DsButton>
          </div>
          <div className="settings-line">
            <span>{t('deleteAll')}</span>
            <DsButton type="button" variant="danger" onClick={() => setConfirmAll(true)}>{t('delete')}</DsButton>
            {confirmAll ? (
              <ConfirmDialog
                label={t('deleteConfirm')}
                onCancel={() => setConfirmAll(false)}
                onConfirm={() => {
                  setConfirmAll(false)
                  const { conversations: rows, removeChat: drop } = useHarbor.getState()
                  for (const item of rows) void drop(item.id)
                }}
              />
            ) : null}
          </div>
        </section>
        <section className="settings-data">
          <div className="settings-line stack">
            <div className="settings-copy wide">
              <span>{t('usageTitle')}</span>
              <p className="hint">{serverMode ? t('serverUsageNote') : t('noUsageApi')}</p>
            </div>
          </div>
          <div className="usage-grid" data-testid="usage-grid">
            <div className="settings-line"><span>{t('input')}</span><span>{totals.input_tokens}</span></div>
            <div className="settings-line"><span>{t('cache')}</span><span>{totals.cache_read_input_tokens}</span></div>
            <div className="settings-line"><span>{t('output')}</span><span>{totals.output_tokens}</span></div>
            <div className="settings-line"><span>{t('thinkingTokens')}</span><span>{totals.output_tokens_details?.thinking_tokens ?? 0}</span></div>
            <div className="settings-line"><span>{t('billedSearch')}</span><span>{totals.server_tool_use?.tool_search ?? 0}</span></div>
            <div className="settings-line"><span>{t('billedFetch')}</span><span>{totals.server_tool_use?.tool_fetch ?? 0}</span></div>
            <div className="settings-line"><span>{t('displaySearch')}</span><span>{totals.server_tool_use?.web_search_requests ?? 0}</span></div>
            <div className="settings-line"><span>{t('displayFetch')}</span><span>{totals.server_tool_use?.web_fetch_requests ?? 0}</span></div>
            <div className="settings-line"><span>{t('estimated')}</span><span>{formatCny(cost.totalCny)} {t('cny')} ({cost.peak ? t('peak') : t('offPeak')})</span></div>
          </div>
        </section>
        <section className="settings-data">
          {serverMode ? <h3>{t('serverPrivacyTitle')}</h3> : null}
          <p className="hint">{serverMode ? t('serverPrivacyBody') : t('currentKey')}</p>
          <p className="hint">{serverMode ? t('serverImportNote') : t('importMergeNote')}</p>
          <div className="settings-line">
            <span>{t('exportJson')}</span>
            <DsButton type="button" data-testid="export-json" onClick={() => void exportJson()}>{t('export')}</DsButton>
          </div>
          <div className="settings-line">
            <span>{t('exportZip')}</span>
            <DsButton type="button" data-testid="export-zip" onClick={() => void exportZip()}>{t('export')}</DsButton>
          </div>
          <div className="settings-line">
            <span>{t('importAsCopy')}</span>
            <button type="button" data-testid="import-as-copy" className={asCopy ? 'switch on' : 'switch'} aria-pressed={asCopy} onClick={() => setAsCopy((value) => !value)}>
              <span className="knob" />
            </button>
          </div>
          <div className="settings-line">
            <span>{t('importJson')}</span>
            <DsFileButton
              testId="import-json"
              accept="application/json,.json"
              onFile={(file) => { void importJson(file, asCopy) }}
            >
              {t('importAct')}
            </DsFileButton>
          </div>
          <div className="settings-line">
            <span>{t('importZip')}</span>
            <DsFileButton
              testId="import-zip"
              accept=".zip,application/zip"
              onFile={(file) => { void importZip(file, asCopy) }}
            >
              {t('importAct')}
            </DsFileButton>
          </div>
        </section>
        {serverMode ? null : (
        <section className="settings-data" data-testid="replace-key">
          <div className="settings-line">
            <span>API Key</span>
            <input className="settings-pill wide" type="password" value={nextKey} autoComplete="off" onChange={(event) => setNextKey(event.target.value)} />
          </div>
          <div className="settings-line">
            <span>{t('passcode')}</span>
            <input className="settings-pill wide" type="password" value={passphrase} autoComplete="off" onChange={(event) => setPassphrase(event.target.value)} />
          </div>
          <div className="settings-line">
            <span>{t('replaceKey')}</span>
            <DsButton type="button" data-testid="replace-save" onClick={() => void saveKey(nextKey, passphrase, true)}>{t('save')}</DsButton>
          </div>
          <div className="settings-line">
            <span>{t('deviceKey')}</span>
            <DsButton type="button" onClick={() => void clearKey()}>{t('clearKey')}</DsButton>
          </div>
        </section>
        )}
        <section className="settings-data" data-testid="server-note">
          <div className="settings-line stack">
            <div className="settings-copy wide">
              <span>{t('serverTitle')}</span>
              <p className="hint">{native ? t('nativeServerBody') : t('serverBody')}</p>
            </div>
          </div>
          {native && !serverUser ? (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault()
                setRemoteError('')
                const action = inviteCode.trim()
                  ? registerRemote(remoteUrl, inviteCode.trim(), remoteUser, remotePassword)
                  : connectRemote(remoteUrl, remoteUser, remotePassword)
                void action.catch((error: unknown) => {
                  setRemoteError(error instanceof Error ? error.message : 'login failed')
                })
              }}
            >
              <div className="settings-line">
                <span>{t('serverUrl')}</span>
                <input className="settings-pill wide" data-testid="server-url" value={remoteUrl} autoComplete="off" onChange={(event) => setRemoteUrl(event.target.value)} />
              </div>
              <div className="settings-line">
                <span>{t('allowLanHttp')}</span>
                <button type="button" data-testid="allow-lan" className={allowLanHttp ? 'switch on' : 'switch'} aria-pressed={allowLanHttp} onClick={() => setAllowLanHttp(!allowLanHttp)}>
                  <span className="knob" />
                </button>
              </div>
              <div className="settings-line">
                <span>{t('loginUser')}</span>
                <input className="settings-pill wide" data-testid="remote-user" value={remoteUser} autoComplete="username" onChange={(event) => setRemoteUser(event.target.value)} />
              </div>
              <div className="settings-line">
                <span>{t('loginPassword')}</span>
                <input className="settings-pill wide" data-testid="remote-password" type="password" value={remotePassword} autoComplete="current-password" onChange={(event) => setRemotePassword(event.target.value)} />
              </div>
              <div className="settings-line">
                <span>{t('registerCode')}</span>
                <input className="settings-pill wide" data-testid="remote-invite" value={inviteCode} autoComplete="off" onChange={(event) => setInviteCode(event.target.value)} />
              </div>
              <div className="settings-line">
                <span>{inviteCode.trim() ? t('registerTitle') : t('loginTitle')}</span>
                <DsButton type="submit" variant="primary" data-testid="remote-login">{inviteCode.trim() ? t('registerSubmit') : t('connectServer')}</DsButton>
              </div>
              {remoteError ? <p className="error">{remoteError}</p> : null}
            </form>
          ) : null}
          {serverUser ? (
            <>
              {serverBase ? <p className="hint" data-testid="connected-server">{t('connectedServer')}: {serverBase}</p> : null}
            <div className="settings-line"><span>{t('syncNow')}</span><DsButton type="button" data-testid="server-sync" onClick={() => void syncServer()}>{t('syncAct')}</DsButton></div>
            <div className="settings-line"><span>{t('copyLocal')}</span><DsButton type="button" data-testid="copy-local" onClick={() => void copyLocalToServer()}>{t('copyAct')}</DsButton></div>
            <div className="settings-line"><span>{serverMode ? t('useLocal') : t('useServer')}</span><DsButton type="button" onClick={() => void (serverMode ? enterLocalMode() : enterServerMode())}>{t('switchAct')}</DsButton></div>
            <div className="settings-line"><span>{t('logout')}</span><DsButton type="button" onClick={() => void logoutServer()}>{t('logoutAct')}</DsButton></div>
            </>
          ) : hosted ? (
            <DsButton type="button" variant="primary" data-testid="open-login" onClick={openLogin}>
              {t('loginTitle')}
            </DsButton>
          ) : null}
        </section>
        <section className="settings-legal">
          <article className="legal-copy">
            <h3>{t('terms')}</h3>
            <p>DeepAPI 是一个独立的聊天客户端。你在本机保存 API Key，消息直接发往 api.deepseek.com。DeepAPI 不代替深度求索提供账号、计费或客服。</p>
            <p>使用 DeepSeek API 产生的费用由 Key 的持有者承担。请只在你信任的设备上保存 Key。</p>
            <h3>{t('privacyPolicy')}</h3>
            <p>Key、对话和设置默认只存在这台浏览器里。DeepAPI 不设账号，也不把对话上传到 OpenLinkOS 的服务器。可选的自建服务只有在你主动连接后才会收到数据。</p>
            <p>{t('footerMark')}</p>
          </article>
          <SiteFooter />
          <p className="hint">
            <a href="https://github.com/openlinkos/deepapi">openlinkos/deepapi</a>
            {' · '}
            <a href="https://platform.deepseek.com/">platform.deepseek.com</a>
          </p>
          <ProductVersion />
        </section>
        </div>
      </div>
    </div>
  )
}

const ImportToast = ({ notice }: { notice: string }) => {
  const t = useT()
  const dismiss = useHarbor((state) => state.dismissNotice)
  const [added, skipped] = notice.split(':')
  return (
    <p className="toast" data-testid="import-toast" role="status">
      {t('imported', { added: added ?? '0', skipped: skipped ?? '0' })}
      <button type="button" onClick={dismiss}>
        {t('close')}
      </button>
    </p>
  )
}
