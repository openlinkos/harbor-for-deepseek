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
import { FileCard, ImageCard } from './file-card.js'
import { imagePreview, useHarbor, type StatusToastCode } from './store.js'
import { IconMicFill16, IconMicOutline16, IconPlayMediaOutline16 } from './speech/icons.js'
import { useSpeechNotice } from './speech/notice.js'
import { ReadingBars } from './speech/ReadingBars.js'
import { readAloudSnapshot, stopReadAloud, toggleReadAloud, useReadAloud } from './speech/readAloud.js'
import { installSpeech } from './speech/runtime.js'
import { Spectrum } from './speech/Spectrum.js'
import { applyHistory, applyObservedEdit, armSelectionAuth, decideDelivery, judgeCompositionUpdate, noteSelectionMove, noteUnobserved, recoverTranscriptAtCaret, resolveEditSpan, type SelectionAuth } from './speech/selectionAuth.js'
import { bindVoiceInserter, cancelVoiceInput, currentVoiceGeneration, insertTranscript, toggleVoiceInput, useVoiceInput, type VoiceAnchor } from './speech/voiceSession.js'
import { ACTION_ICONS } from './official-icons.js'
import { GLYPHS, type GlyphName } from './glyphs.js'
import { livePhase, phaseOf, stoppedInTitle, type ThinkPhase } from './phase.js'
import { USER_MENU_ICONS } from './user-menu-icons.js'
import { DsButton, DsFileButton } from './ds-button.js'
import { failedSiteIcons, LinkMarkIcon } from './site-logo.js'

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

let composerFocusTicket = 0

const focusComposer = () => {
  const ticket = ++composerFocusTicket
  const box = document.querySelector<HTMLTextAreaElement>('[data-testid="composer"]')
  // Captured at request time. A delayed frame must not move a selection the
  // user placed after this focus was asked for.
  const snapshot = box
    ? { value: box.value, start: box.selectionStart, end: box.selectionEnd, direction: box.selectionDirection }
    : null
  // The caller may run while a dialog still holds focus. A click in the next frame
  // (the user menu, after settings has closed) must keep that focus.
  const atSchedule = document.activeElement
  window.requestAnimationFrame(() => {
    if (ticket !== composerFocusTicket) return
    // SP-MOD-635. A frame queued before the search dialog opened must not take the input.
    if (document.querySelector('.search-dialog')) return
    const now = document.activeElement
    if (
      now instanceof HTMLElement
      && now !== document.body
      && now.isConnected
      && now !== atSchedule
    ) return
    const node = document.querySelector<HTMLTextAreaElement>('[data-testid="composer"]')
    if (!node) return
    const userMoved = snapshot !== null
      && node === box
      && (node.value !== snapshot.value || node.selectionStart !== snapshot.start || node.selectionEnd !== snapshot.end)
    if (userMoved) {
      const start = node.selectionStart ?? 0
      const end = node.selectionEnd ?? start
      const direction = node.selectionDirection
      if (document.activeElement !== node) node.focus({ preventScroll: true })
      node.setSelectionRange(start, end, direction)
      return
    }
    node.focus({ preventScroll: true })
    const end = node.value.length
    node.setSelectionRange(end, end)
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

const Favicon = ({ icon }: { label: string; icon?: string | null }) => {
  const src = siteIconSrc(icon)
  const [failed, setFailed] = useState(() => !src || failedSiteIcons.has(src))
  const [ready, setReady] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    setFailed(!src || failedSiteIcons.has(src))
    setReady(false)
  }, [src])
  useEffect(() => {
    const img = imgRef.current
    if (!img || !src || failed) return
    if (img.complete && img.naturalWidth > 0) setReady(true)
  }, [src, failed])
  if (!src || failed) {
    return (
      <i className="favicon site_logo_back" aria-hidden="true">
        <span className="site_logo_fallback">
          <LinkMarkIcon />
        </span>
      </i>
    )
  }
  return (
    <i className="favicon site_logo_back" aria-hidden="true">
      <img
        ref={imgRef}
        src={src}
        alt=""
        className={ready ? 'on' : ''}
        onLoad={() => setReady(true)}
        onError={() => {
          failedSiteIcons.add(src)
          setFailed(true)
        }}
      />
    </i>
  )
}

type SourceItem = { url: string; title: string; snippet: string; site: string; date?: string; icon?: string | null }
type SourcesApi = {
  open: boolean
  show: (items: SourceItem[]) => void
  toggle: (items: SourceItem[]) => void
  close: () => void
}
const SourcesPanel = createContext<SourcesApi>({ open: false, show: () => undefined, toggle: () => undefined, close: () => undefined })

const MODAL_FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// SP-SET-736 / SP-SET-765. The settings mask covers New chat and the chat rows.
// A press on those controls must not switch chats and must not dismiss the dialog.
const pointHitsChatNav = (x: number, y: number) => {
  const nodes = document.querySelectorAll('[data-testid="new-chat"], [data-testid="top-new"], a.chat-link')
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true
  }
  return false
}

// One history entry per open overlay. Close calls history.back(), which is async.
// The next open waits for that pop before it pushState's, so the late back cannot
// pop the new entry or restore the search field to the empty snapshot.
let overlaySeq = 0
let closeFlight: Promise<void> | null = null
let suppressEmptyRestore = false

const whenOverlayHistorySettled = () => closeFlight ?? Promise.resolve()

const setNativeInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
}

const useOverlayHistory = (open: boolean, onClose: () => void) => {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const retain = useRef(false)
  useEffect(() => {
    if (!open) return undefined
    const token = ++overlaySeq
    let pushed = false
    let removePop: (() => void) | null = null
    let cancel = false
    const arm = () => {
      if (cancel || pushed) return
      const prior = history.state
      const base = prior && typeof prior === 'object' ? prior : {}
      history.pushState({ ...base, deepapiOverlay: token }, '', location.href)
      pushed = true
      const onPop = () => {
        pushed = false
        closeRef.current()
      }
      window.addEventListener('popstate', onPop)
      removePop = () => window.removeEventListener('popstate', onPop)
    }
    const flight = closeFlight
    if (flight) void flight.then(arm)
    else arm()
    return () => {
      cancel = true
      removePop?.()
      const keep = retain.current
      retain.current = false
      if (!pushed || keep) return
      const state = history.state
      if (!(state && typeof state === 'object' && state.deepapiOverlay === token)) return
      pushed = false
      suppressEmptyRestore = true
      let settled = false
      let settle: () => void = () => undefined
      const done = new Promise<void>((resolve) => {
        settle = resolve
      })
      closeFlight = done
      let timer = 0
      const finish = () => {
        if (settled) return
        settled = true
        window.clearInterval(timer)
        window.removeEventListener('popstate', onLatePop)
        suppressEmptyRestore = false
        if (closeFlight === done) closeFlight = null
        settle()
      }
      const onLatePop = () => finish()
      window.addEventListener('popstate', onLatePop)
      history.back()
      timer = window.setInterval(() => {
        const now = history.state
        if (!(now && typeof now === 'object' && (now as { deepapiOverlay?: number }).deepapiOverlay === token)) finish()
      }, 16)
      window.setTimeout(finish, 1000)
    }
  }, [open])
  return () => {
    retain.current = true
  }
}

const useScrollLock = (open: boolean) => {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])
}

/** Official ds-modal defaults: mask click and Escape close, focus stays inside, then returns to the trigger. */
const ConfirmDialog = ({ label, body, confirm, onCancel, onConfirm }: { label: string; body: string; confirm: string; onCancel: () => void; onConfirm: () => void }) => {
  const t = useT()
  const panel = useRef<HTMLDivElement>(null)
  // Back closes the confirm. Escape cancels too (昊辰 fb1132-5). SP-MOD-572's capture has no Esc-cancel; that conflict stays open.
  useOverlayHistory(true, () => onCancel())
  useScrollLock(true)
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
      // Escape cancels (昊辰 fb1132-5). Mask click and Back still close it. SP-MOD-572's capture does not, and that conflict stays open.
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
        <p className="confirm-body">{body}</p>
        <div className="edit-actions">
          <DsButton type="button" onClick={onCancel}>{t('cancel')}</DsButton>
          <DsButton type="button" variant="danger" className="ds-button--solid-error" data-testid="confirm-delete" onClick={onConfirm}>{confirm}</DsButton>
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

const SpeechNotice = () => {
  const notice = useSpeechNotice((state) => state.notice)
  const clear = useSpeechNotice((state) => state.clear)
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => clear(), 4000)
    return () => window.clearTimeout(timer)
  }, [notice, clear])
  if (!notice) return null
  return <p className="speech-notice" role="status" data-testid="speech-notice">{notice.text}</p>
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
  /** SP-SHARE-006. OK (complete) and INCOMPLETE (aborted) can be selected. Error, refused, and streaming cannot. */
  locked: (messageId: string) => boolean
  toggle: (groupId: string) => void
  reject: (messageId: string) => void
  enter: (messageId: string) => void
}

const shareableStatus = (status: Message['status']) => status === 'complete' || status === 'aborted'

const selectableGroupIds = (groups: TurnGroup[], rows: Message[]) => {
  const byId = new Map(rows.map((message) => [message.id, message]))
  return groups.filter((group) => group.messageIds.every((id) => {
    const message = byId.get(id)
    return Boolean(message && shareableStatus(message.status))
  })).map((group) => group.id)
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
        <div ref={menuRef} className={`anchored-menu ${menuClass ?? ''}`} role="listbox" data-testid={testId ? `${testId}-menu` : undefined} style={{ top: box.top, right: box.right, maxHeight: Math.min(box.maxHeight, 28 * 8.5), maxWidth: 'min(280px, calc(100vw - 16px))', overflowY: 'auto' }}>
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
      <div className="prose ds-markdown" data-testid={testId}>
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
      return <p className="tool-line" data-testid="browse-status">{t('browseFailed')}</p>
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
    if (block.media === 'image') {
      return <ImageCard name={block.filename} src={imagePreview(block.fileId)} />
    }
    return <FileCard name={block.filename} bytes={block.bytes} status="done" />
  }
  return null
}

const SourceMarks = ({ items }: { items: SourceItem[] }) => {
  const t = useT()
  const sources = useContext(SourcesPanel)
  const share = useContext(ShareMode)
  if (!items.length) return null
  return (
    <button
      type="button"
      className="favicons"
      data-testid="source-favicons"
      aria-expanded={sources.open}
      aria-label={t('foundPages', { count: items.length })}
      onClick={() => { if (!share?.on) sources.toggle(items) }}
    >
      {items.slice(0, SOURCE_MARKS).map((item) => <Favicon key={item.url} label={item.site} icon={item.icon} />)}
    </button>
  )
}

const SearchResults = ({ block }: { block: Extract<ContentBlock, { type: 'web_search_tool_result' }> }) => {
  const t = useT()
  const sources = useContext(SourcesPanel)
  const share = useContext(ShareMode)
  const failed = block.content.some((item) => item.type === 'web_search_tool_result_error')
  const results = block.content.filter((item) => item.type === 'web_search_result')
  if (!results.length) {
    return <p className="tool-line" data-testid="search-status">{failed ? t('searchUnavailable') : t('searchEmpty')}</p>
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
      <button className={share?.on ? 'sources-pill is-inert' : 'sources-pill'} type="button" data-testid="search-results" onClick={() => { if (!share?.on) sources.show(items) }}>
        <span className="favicons">
          {results.slice(0, SOURCE_MARKS).map((result) => (
            <Favicon key={result.url} label={result.site_name || result.title} icon={result.site_icon} />
          ))}
        </span>
        <span className="sources-pill-text">{t('pagesPill', { count: results.length })}</span>
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
        {/* SP-CV-182. Official fade sits under the title. Opacity 0 keeps the ink unchanged. */}
        <span className="think-fade" aria-hidden="true" />
      </button>
      {open ? <div className="thinking-body think-copy ds-think-content ds-markdown"><Markdown text={text} streaming={streaming} /></div> : null}
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
  const shareMode = useContext(ShareMode)
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
        <div key={index} className={`timeline-step timeline-think think-copy ds-think-content ${last}${phase === 'thinking' && last ? ' is-live' : ''}`}>
          <span className="timeline-dot" aria-hidden="true" />
          <span className="timeline-line" aria-hidden="true" />
          {/* The paragraph must be :first-child of .ds-markdown so margin-top resets to 0. */}
          <div className="ds-markdown"><Markdown text={step.text} streaming={answerStreaming} /></div>
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
        <span className="browse-wrap">
          <span className="browse-count">{t('browsedPages', { count: step.items.length })}</span>
          {step.items.slice(0, 5).map((item) => (
            <span key={item.url} className="browse-item">
              <a className="browse-link" href={item.url} target="_blank" rel="noreferrer noopener">{item.title}</a>
              <BrowseExternalIcon />
            </span>
          ))}
          {step.items.length > 5 ? (
            <button
              type="button"
              className="browse-view-all"
              data-testid="browse-view-all"
              onClick={() => {
                if (shareMode?.on) return
                sourcesApi.toggle(step.items.map((item) => ({
                  url: item.url,
                  title: item.title,
                  snippet: '',
                  site: hostOf(item.url),
                })))
              }}
            >{t('viewAll')}</button>
          ) : null}
        </span>
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
            {/* SP-CV-182. The fade sits under the thinking title. Opacity stays 0 until a selected wash needs it. */}
            <span className="think-fade" aria-hidden="true" />
          </button>
          <div className={`thinking-collapse ${open ? 'open' : ''}`}>
            <div className="thinking-body">
              {steps.map(renderStep)}
            </div>
          </div>
        </section>
      ) : steps.map(renderStep)}
      {article.text.trim() ? (
        <div className="prose ds-markdown" data-testid="assistant-text">
          <Markdown text={article.text} citations={article.citations} cards={article.cards} streaming={answerStreaming} />
        </div>
      ) : null}
      {sources.length ? (
        <button className={shareMode?.on ? 'sources-pill is-inert' : 'sources-pill'} type="button" data-testid="search-results" onClick={() => { if (!shareMode?.on) sourcesApi.show(sources) }}>
          <span className="favicons">{sources.slice(0, SOURCE_MARKS).map((item) => <Favicon key={item.url} label={item.site} icon={item.icon} />)}</span>
          <span className="sources-pill-text">{t('pagesPill', { count: sources.length })}</span>
        </button>
      ) : null}
    </>
  )
}

const BranchSwitcher = ({ ids, current, disabled, onStep, holdTip }: { ids: string[]; current: string; disabled?: boolean; onStep: (dir: -1 | 1) => void; holdTip?: string }) => {
  if (ids.length <= 1) return null
  const index = Math.max(0, ids.indexOf(current))
  const hold = disabled && holdTip ? holdTip : undefined
  return (
    <span className="branch" data-testid="versions">
      <button type="button" className="branch-prev" aria-label="‹" title={hold} disabled={disabled || index <= 0} onClick={() => onStep(-1)}>
        <Glyph name="chevronRight" size={14} />
      </button>
      <span className="branch-count">{index + 1} / {ids.length}</span>
      <button type="button" aria-label="›" title={hold} disabled={disabled || index >= ids.length - 1} onClick={() => onStep(1)}>
        <Glyph name="chevronRight" size={14} />
      </button>
    </span>
  )
}

const ReadAloudButton = ({ messageId, conversationId, text }: { messageId: string; conversationId: string; text: string }) => {
  const t = useT()
  const speech = useReadAloud()
  const active = speech.messageId === messageId && speech.status !== 'idle'
  const label = active ? t('ttsStop') : t('ttsPlay')
  // Version and branch switches unmount the answer that was on screen. Stop
  // only that session so a playback that already moved to another message stays up.
  useEffect(() => () => {
    const current = readAloudSnapshot()
    if (current.messageId === messageId && current.status !== 'idle') stopReadAloud()
  }, [messageId])
  return (
    <HoverTip text={label}>
      <button type="button" data-testid="read-aloud" data-tip={label} aria-label={label} aria-pressed={active} onClick={() => toggleReadAloud(messageId, conversationId, text)}>
        {active ? <ReadingBars mode={speech.status === 'playing' ? 'playing' : 'loading'} /> : <IconPlayMediaOutline16 />}
      </button>
    </HoverTip>
  )
}

const MessageRow = ({ message }: { message: Message }) => {
  const t = useT()
  const share = useContext(ShareMode)
  const groupId = share?.groupOf(message.id) ?? null
  const locked = Boolean(share?.on && share.locked(message.id))
  const picked = Boolean(groupId && share?.selected.has(groupId) && !locked)
  const messages = useHarbor((state) => state.messages)
  const sources = useContext(SourcesPanel)
  const selectSibling = useHarbor((state) => state.selectSibling)
  const regenerate = useHarbor((state) => state.regenerate)
  const resend = useHarbor((state) => state.resend)
  const editUser = useHarbor((state) => state.editUser)
  const streaming = useHarbor((state) => state.streaming)
  const generatingHere = useHarbor((state) =>
    state.messages.some((item) => item.conversationId === message.conversationId && item.status === 'streaming'),
  )
  const siblings = siblingIds(messages, message.id)
  const userIds = messages.filter((item) => item.conversationId === message.conversationId && item.role === 'user').map((item) => item.id)
  const isFirstUser = message.role === 'user' && userIds[0] === message.id
  const onSharePage = typeof window !== 'undefined' && window.location.pathname.startsWith('/share')
  const isLastUser = message.role === 'user' && userIds[userIds.length - 1] === message.id && !onSharePage
  const textOf = message.blocks.filter((block) => block.type === 'text').map((block) => (block.type === 'text' ? block.text : '')).join('\n')
  const fileBlocks = message.blocks.flatMap((block) => (block.type === 'file_ref' ? [block] : []))
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
    const index = siblings.indexOf(message.id)
    const next = siblings[index + dir]
    if (next) {
      sources.close()
      void selectSibling(message.id, next)
    }
  }
  return (
    <article className={`turn ${message.role} ${message.status === 'streaming' ? 'streaming' : ''} ${isFirstUser ? 'is-first' : ''} ${isLastUser ? 'is-last-user' : ''} ${share?.on ? 'share-on' : ''} ${locked ? 'share-locked' : ''} ${share?.on && picked ? 'share-picked' : ''}`} data-testid={`message-${message.role}`} data-follow-id={message.id} aria-busy={message.status === 'streaming'} onClick={() => { if (!share?.on || !groupId) return; if (locked) { share.reject(message.id); return }; share.toggle(groupId) }}>
      {/* Official mB returns null outside share mode. An empty sticky is 44px in flow. */}
      {share?.on ? (
        <span className="share-col">
          <span className="share-sticky">
            <input className="share-box ds-checkbox ds-checkbox--l" type="checkbox" hidden={locked} checked={picked} aria-label={textOf || t('share')} onClick={(event) => event.stopPropagation()} onChange={() => { if (!groupId || !share) return; if (locked) { share.reject(message.id); return }; share.toggle(groupId) }} />
          </span>
        </span>
      ) : null}
      {/* Assistant wash is a sibling of .prose so article > .prose stays direct. It is sized to the body, not the action row. */}
      {message.role === 'assistant' && share?.on ? <div className="share-halo" aria-hidden="true" /> : null}
      {message.role === 'user' ? (
        <div className="message-body">
          {share?.on ? <div className="share-halo" aria-hidden="true" /> : null}
          {fileBlocks.length ? (
            <div className="message-files" data-testid="message-files">
              {fileBlocks.map((block, blockIndex) => (
                <BlockView key={`${message.id}-f-${blockIndex}`} block={block} />
              ))}
            </div>
          ) : null}
          {editing ? (
            <form className="edit-card" onSubmit={(event) => { event.preventDefault(); sources.close(); void editUser(message.id, draft).then(() => setEditing(false)) }}>
              <textarea aria-label={t('edit')} value={draft} onChange={(event) => setDraft(event.target.value)} />
              <div className="edit-actions">
                <button type="button" onClick={() => { setDraft(textOf); setEditing(false) }}>{t('cancel')}</button>
                <button className="primary" type="submit">{t('send')}</button>
              </div>
            </form>
          ) : (
            <>
              <div className={`bubble${fileBlocks.length ? ' has-files' : ''}`}>
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
            </>
          )}
        </div>
      ) : null}
      {message.role === 'user' && !editing ? (
        <div className="user-actions">
          <HoverTip text={t('copy')}>
            <button type="button" data-tip={t('copy')} aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf)}>
              <Icon size={20} d="M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11" />
            </button>
          </HoverTip>
          <HoverTip text={t('editMessageTooltip')}>
            <button type="button" data-tip={t('editMessageTooltip')} aria-label={t('editMessageTooltip')} onClick={() => { setDraft(textOf); setEditing(true) }}>
              <Icon size={20} d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" />
            </button>
          </HoverTip>
          <BranchSwitcher ids={siblings} current={message.id} disabled={generatingHere} holdTip={generatingHere ? t('waitUntilGenerated') : undefined} onStep={stepVersion} />
        </div>
      ) : null}
      {message.status === 'refused' ? <p className="refused">{t('refused')}</p> : null}
      {message.role === 'assistant' && message.status === 'streaming' && phaseOf(message) === 'pending' ? (
        <div className="reply-dots" data-testid="reply-dots" aria-hidden="true"><i /><i /><i /></div>
      ) : null}
      {message.role === 'assistant' ? <AssistantTurn message={message} /> : null}
      {message.role === 'assistant' && message.status !== 'streaming' && textOf ? <p className="answer-note">{t('answerNote')}</p> : null}
      {message.status === 'error' ? (
        <p className="form-error">
          {errorKey ? t(errorKey) : message.errorMessage || t('error')}
          <button type="button" data-testid="retry" onClick={() => { sources.close(); void regenerate(message.id) }}>{t('retry')}</button>
        </p>
      ) : null}
      {message.status === 'aborted' && !stoppedInTitle(message) ? <p className="hint">{t('stopped')}</p> : null}
      {message.role === 'assistant' && message.status !== 'streaming' ? (
        <div className="action-row">
          <BranchSwitcher ids={siblings} current={message.id} disabled={generatingHere} holdTip={generatingHere ? t('waitUntilGenerated') : undefined} onStep={stepVersion} />
          <HoverTip text={copied ? t('copied') : t('copy')}>
            <button type="button" data-tip={copied ? t('copied') : t('copy')} aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200) })}>{copied ? '✓' : <FillIcon paths={[...ACTION_ICONS.copy]} />}</button>
          </HoverTip>
          <HoverTip text={streaming ? t('waitUntilGenerated') : t('regenerate')}>
            <button type="button" data-testid="regenerate" data-tip={t('regenerate')} title={streaming ? t('waitUntilGenerated') : undefined} aria-label={t('regenerate')} disabled={streaming} onClick={() => { sources.close(); void regenerate(message.id) }}>
              <FillIcon paths={[...ACTION_ICONS.regen]} />
            </button>
          </HoverTip>
          <HoverTip text={t('like')}>
            <button type="button" data-tip={t('like')} className={vote === 'up' ? 'on' : ''} aria-label={t('like')} aria-pressed={vote === 'up'} onClick={() => choose('up')}><FillIcon paths={[...ACTION_ICONS.like]} /></button>
          </HoverTip>
          <HoverTip text={t('dislike')}>
            <button type="button" data-tip={t('dislike')} className={vote === 'down' ? 'on' : ''} aria-label={t('dislike')} aria-pressed={vote === 'down'} onClick={() => { choose('down'); setFeedbackOpen(true) }}><FillIcon paths={[...ACTION_ICONS.dislike]} /></button>
          </HoverTip>
          <ReadAloudButton messageId={message.id} conversationId={message.conversationId} text={textOf} />
          <HoverTip text={message.status === 'complete' ? t('share') : t('shareUnsupported')}>
            <button type="button" data-tip={message.status === 'complete' ? t('share') : t('shareUnsupported')} aria-label={t('share')} disabled={message.status !== 'complete' && message.status !== 'aborted'} onClick={() => share?.enter(message.id)}><FillIcon paths={[...ACTION_ICONS.share]} /></button>
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

export const BootSkeleton = () => {
  const t = useT()
  return (
    <div className="shell boot-skeleton" data-testid="boot-skeleton">
      <aside className="sidebar">
        <div className="sider-surface">
        <div className="sider-top">
          <span className="brand-name"><Mark /><Wordmark /></span>
          <span className="sider-icons" aria-hidden="true">
            <span className="icon-btn"><Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" /></span>
            <span className="icon-btn"><Icon d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM9 3v18" /></span>
          </span>
        </div>
        <div className="new-chat" role="presentation">
          <span className="new-chat-label"><Icon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v8M8 12h8" /><span>{t('newChat')}</span></span>
        </div>
        <div className="boot-bars" aria-hidden="true"><i /><i /><i /></div>
        <div className="sider-bottom">
          <div className="user-bar">
            <span className="avatar" />
            <span className="user-more" aria-hidden="true"><FillIcon paths={MORE_DOTS} /></span>
          </div>
        </div>
        </div>
      </aside>
      <section className="stage">
        <div className="boot-title-bar" />
      </section>
    </div>
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
  useEffect(() => {
    installSpeech()
    return () => {
      cancelVoiceInput()
      stopReadAloud()
    }
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
  const [shareToast, setShareToast] = useState<null | 'shareSelectBlocked' | 'shareSelectLater'>(null)
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
    // The phone drawer scrim covers the top-bar cancel, and share mode hides the menu button.
    state.setSidebarOpen(false)
    setShareSoon(false)
    setShareAll(true)
    setShareConv(id)
    if (id !== conversation?.id) {
      setSharePrimed(false)
      setShareIds([])
      void state.openChat(id)
      return
    }
    setShareIds(selectableGroupIds(turns, path))
    setSharePrimed(true)
  }
  const enterGroup = (messageId: string) => {
    if (!conversation?.id) return
    state.setSidebarOpen(false)
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
    const selectable = selectableGroupIds(turns, path)
    const lastId = turns[turns.length - 1]?.id
    setShareIds(shareAll ? selectable : selectable.filter((id) => id === lastId))
    setSharePrimed(true)
  }, [shareConv, sharePrimed, shareAll, conversation?.id, turns, path])
  const shareConvRef = useRef(shareConv)
  useEffect(() => {
    const previous = shareConvRef.current
    shareConvRef.current = shareConv
    if (!sharing || !previous) return
    if (shareConv === previous && conversation?.id !== previous) exitShare()
  }, [sharing, shareConv, conversation?.id])
  // SP-SHARE-147. Escape stays in select mode. Cancel is the exit.
  const selectableIds = selectableGroupIds(turns, path)
  const shareValue: ShareModeValue = {
    on: sharing,
    groupOf: (messageId) => turns.find((group) => group.messageIds.includes(messageId))?.id ?? null,
    selected: new Set(shareIds ?? []),
    locked: (messageId) => {
      const group = turns.find((item) => item.messageIds.includes(messageId))
      return !group || !selectableIds.includes(group.id)
    },
    toggle: (groupId) => setShareIds((current) => {
      if (!selectableIds.includes(groupId)) return current ?? []
      const ids = current ?? []
      return ids.includes(groupId) ? ids.filter((item) => item !== groupId) : [...ids, groupId]
    }),
    reject: (messageId) => {
      const group = turns.find((item) => item.messageIds.includes(messageId))
      if (!group) return
      const byId = new Map(path.map((message) => [message.id, message]))
      const refused = group.messageIds.some((id) => byId.get(id)?.status === 'refused')
      setShareToast(refused ? 'shareSelectBlocked' : 'shareSelectLater')
    },
    enter: (messageId) => enterGroup(messageId),
  }
  const selectedCount = selectableIds.filter((id) => (shareIds ?? []).includes(id)).length
  const allTurns = selectableIds.length > 0 && selectedCount === selectableIds.length
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [shareNarrow, setShareNarrow] = useState(false)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!sharing || !list) {
      setShareNarrow(false)
      return
    }
    const apply = () => {
      const width = list.offsetWidth
      list.style.setProperty('--panel-width', `${width}px`)
      const next = width < 800
      setShareNarrow((current) => (current === next ? current : next))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(list)
    return () => observer.disconnect()
  }, [sharing, path.length])
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
  // SP-SB-631. Below 1024 the official sider starts collapsed. Phone uses the drawer (sidebarOpen), not the in-flow width-0 class. At 1024 and above the stored flag wins, and the default is expanded.
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false
    const phone = !window.matchMedia('(min-width: 768px)').matches
    if (phone) return false
    if (!window.matchMedia('(min-width: 1024px)').matches) return true
    try {
      return localStorage.getItem('deepapi-sider-collapsed') === '1'
    } catch {
      return false
    }
  })
  const setCollapsed = (value: boolean) => {
    setCollapsedState(value)
    try {
      if (window.matchMedia('(min-width: 1024px)').matches) localStorage.setItem('deepapi-sider-collapsed', value ? '1' : '0')
    } catch {
      /* private mode */
    }
  }
  const [filtering, setFiltering] = useState(false)
  const [filter, setFilter] = useState('')
  const filterInputRef = useRef<HTMLInputElement>(null)
  // Survives the unmount of the field. A history restore must not replace it with ''.
  const preservedQuery = useRef('')
  const [searchReady, setSearchReady] = useState(false)
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
      const title = chat.title || t('untitledChat')
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
  // Mount the field only after the previous close's history.back() has popped.
  // The input is not in the document during that pop, so the browser cannot restore it to ''.
  useEffect(() => {
    if (!filtering) {
      setSearchReady(false)
      return undefined
    }
    let cancel = false
    void whenOverlayHistorySettled().then(() => {
      if (!cancel) setSearchReady(true)
    })
    return () => {
      cancel = true
    }
  }, [filtering])
  // SP-SB-647: reopening the dialog selects the preserved query.
  // Focus after the opening key event. Selecting during Ctrl+K lets that key replace the text.
  useEffect(() => {
    if (!filtering || !searchReady) return undefined
    const id = window.setTimeout(() => {
      const input = filterInputRef.current
      if (!input) return
      const saved = preservedQuery.current
      if (saved && input.value !== saved) {
        setNativeInputValue(input, saved)
        setFilter(saved)
      }
      input.focus()
      const len = (saved || input.value).length
      input.setSelectionRange(0, len)
    }, 0)
    return () => window.clearTimeout(id)
  }, [filtering, searchReady])
  // SP-MOD-635. Back closes the search dialog. Tab stays in the card. The page does not scroll behind it.
  const retainSearchHistory = useOverlayHistory(filtering, () => setFiltering(false))
  useScrollLock(filtering)
  useEffect(() => {
    if (!filtering) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const root = document.querySelector('.search-dialog')
      if (!(root instanceof HTMLElement)) return
      const list = [...root.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)].filter((node) => !node.hasAttribute('disabled') && node.getClientRects().length > 0)
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
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filtering])
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
    // The overlay entry is current. Replace it so closing does not history.back() over the chat URL.
    retainSearchHistory()
    window.history.replaceState(null, '', `/a/chat/s/${encodeURIComponent(id)}`)
    setFiltering(false)
    preservedQuery.current = ''
    setFilter('')
    void state.openChat(id)
    focusComposer()
  }
  const [userMenu, setUserMenu] = useState(false)
  const userBarRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<SourceItem[] | null>(null)
  const [showDesktopTitle, setShowDesktopTitle] = useState(true)
  const panelRef = useRef<SourceItem[] | null>(null)
  const coupledExpand = useRef(false)
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed
  panelRef.current = panel
  const below1024 = () => !window.matchMedia('(min-width: 1024px)').matches
  const below768 = () => !window.matchMedia('(min-width: 768px)').matches
  // SP-SEARCH-242 / 244 / 247. matchMedia min-width, not innerWidth.
  const collapseForCoupling = () => {
    if (!below1024()) return
    if (below768()) {
      if (useHarbor.getState().sidebarOpen) {
        coupledExpand.current = true
        useHarbor.getState().setSidebarOpen(false)
      }
      return
    }
    if (!collapsedRef.current) {
      coupledExpand.current = true
      setCollapsed(true)
    }
  }
  const restoreCoupled = () => {
    if (!coupledExpand.current) return
    coupledExpand.current = false
    setCollapsed(false)
    if (below768()) useHarbor.getState().setSidebarOpen(true)
    else useHarbor.getState().setSidebarOpen(false)
  }
  const closeSearchPanel = () => {
    panelRef.current = null
    setPanel(null)
    setShowDesktopTitle(true)
    restoreCoupled()
  }
  const openSearchPanel = (items: SourceItem[]) => {
    panelRef.current = items
    setPanel(items)
    collapseForCoupling()
  }
  const closeRef = useRef(closeSearchPanel)
  const openRef = useRef(openSearchPanel)
  closeRef.current = closeSearchPanel
  openRef.current = openSearchPanel
  const activeLoc = state.activeId ?? ''
  const locRef = useRef(activeLoc)
  useEffect(() => {
    if (locRef.current === activeLoc) return
    locRef.current = activeLoc
    closeRef.current()
  }, [activeLoc])
  useEffect(() => {
    const q1024 = window.matchMedia('(min-width: 1024px)')
    const q768 = window.matchMedia('(min-width: 768px)')
    const q1920 = window.matchMedia('(min-width: 1920px)')
    let narrowDesktop = !q1024.matches
    let phoneLayout = !q768.matches
    let below1920 = !q1920.matches
    const onChange = () => {
      const nextNarrow = !q1024.matches
      const nextPhone = !q768.matches
      const nextBelow1920 = !q1920.matches
      if (nextNarrow === narrowDesktop && nextPhone === phoneLayout && nextBelow1920 === below1920) return
      narrowDesktop = nextNarrow
      phoneLayout = nextPhone
      below1920 = nextBelow1920
      // SP-SEARCH-245 / 247. Opening search alone does not run this effect.
      if (nextNarrow) {
        if (nextPhone) {
          // SP-SEARCH-248: below 768 the sider is a fixed drawer. Do not add sider-collapsed (width 0).
          if (!collapsedRef.current || useHarbor.getState().sidebarOpen) {
            coupledExpand.current = true
            if (useHarbor.getState().sidebarOpen) useHarbor.getState().setSidebarOpen(false)
          }
        } else if (!collapsedRef.current) {
          coupledExpand.current = true
          setCollapsed(true)
        }
        if (panelRef.current) setShowDesktopTitle(false)
      } else {
        setShowDesktopTitle(true)
        if (coupledExpand.current) {
          coupledExpand.current = false
          setCollapsed(false)
          useHarbor.getState().setSidebarOpen(false)
        }
      }
    }
    q1024.addEventListener('change', onChange)
    q768.addEventListener('change', onChange)
    q1920.addEventListener('change', onChange)
    return () => {
      q1024.removeEventListener('change', onChange)
      q768.removeEventListener('change', onChange)
      q1920.removeEventListener('change', onChange)
    }
  }, [])
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
        // SP-SB-635: ignore the shortcut while multi-select is on. A second press closes.
        // closeSearch preserves the query (SP-SB-647 reopens it selected).
        if (selecting) return
        setFiltering((open) => !open)
      } else if (meta && event.key.toLowerCase() === 'j' && (!typing || inComposer)) {
        event.preventDefault()
        void state.newChat()
        focusComposer()
      } else if (event.key === 'Escape') {
        // SP-MOD-601. An IME composition Escape stays in the field.
        if (event.isComposing) return
        closeRef.current()
        setUserMenu(false)
        setFiltering(false)
        if (state.settingsOpen) {
          state.setSettingsOpen(false)
        }
        focusComposer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, selecting])
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
  // SP-SB-669: a history pop closes the user menu. Reload already drops it.
  // The overlay's own history.back() sets suppressEmptyRestore for that one pop.
  // A menu opened after the overlay closed must survive it.
  useEffect(() => {
    const onPop = () => {
      if (suppressEmptyRestore) return
      setUserMenu(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const groups = useMemo(() => {
    const buckets = new Map<string, typeof state.conversations>()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const order = [t('groupPinned'), t('groupToday'), t('groupYesterday'), t('group7'), t('group30')]
    for (const item of state.conversations.filter((chat) => !filtering || !filter || (chat.title || t('untitledChat')).includes(filter))) {
      const when = new Date(item.updatedAt)
      const days = (startOfDay.getTime() - new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime()) / 86_400_000
      const label = item.pinned
        ? t('groupPinned')
        : days < 1
          ? t('groupToday')
          : days < 2
            ? t('groupYesterday')
            : days < 7
              ? t('group7')
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
  }, [state.conversations, filter, filtering, t])
  const serverName = state.serverUser?.username
  const who = serverName || profile.nickname || t('profileLabel')
  const initial = serverName ? serverName.slice(0, 1).toUpperCase() : profile.initial
  const narrow = () => window.matchMedia('(max-width: 767px)').matches
  const sourcesApi = useMemo<SourcesApi>(() => ({
    open: panel !== null,
    show: (items) => openRef.current(items),
    toggle: (items) => {
      const current = panelRef.current
      const same = !!current && current.length === items.length && current.every((item, index) => item.url === items[index]?.url)
      if (same) closeRef.current()
      else openRef.current(items)
    },
    close: () => closeRef.current(),
  }), [panel])

  return (
    <SourcesPanel.Provider value={sourcesApi}>
    <ShareMode.Provider value={shareValue}>
    <div className={`shell ${state.sidebarOpen ? 'nav-open' : ''} ${collapsed ? 'sider-collapsed' : ''} ${panel ? 'panel-open' : ''} ${selecting ? 'selecting' : ''} ${sharing ? 'sharing' : ''} ${shareNarrow ? 'share-narrow' : ''}`}>
      {offline ? <p className="offline-banner" role="status" data-testid="offline">{t('offline')}</p> : null}
      <aside className="sidebar" data-testid="sidebar">
        <div className="sider-surface">
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
            {selecting ? null : <button className="icon-btn" type="button" aria-label={t('searchHistory')} onClick={() => setFiltering((value) => !value)}>
              <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
            </button>}
            <button className="icon-btn" type="button" aria-label={t('collapseSidebar')} onClick={() => (narrow() ? state.setSidebarOpen(false) : setCollapsed(true))}>
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
        <div className="side-scroll-wrap">
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
        </div>
        {selecting ? (
          <div className="select-foot">
            <button type="button" disabled={!picked.length} aria-disabled={!picked.length} className={picked.length ? '' : 'off'} onClick={() => { if (picked.length) void state.pinMany(picked) }}>
              <Icon d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z" />
              <span>{t('pin')}</span>
            </button>
            <button type="button" disabled={!picked.length} aria-disabled={!picked.length} className={picked.length ? 'danger' : 'off'} onClick={() => { if (!picked.length) return; for (const id of picked) void state.removeChat(id); setPicked([]); setSelecting(false) }}>
              <Icon d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />
              <span>{t('delete')}</span>
            </button>
          </div>
        ) : (
        <div className="sider-bottom">
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
            <img className="profile-photo" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
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
        </div>
        )}
        </div>
      </aside>
      {collapsed ? (
        <>
          <span className="collapsed-mark"><Mark /></span>
          <div className="float-pill">
            <button className="icon-btn" type="button" aria-label={t('expandSidebar')} onClick={() => { if (!window.matchMedia('(min-width: 1024px)').matches) closeRef.current(); setCollapsed(false) }}>
              <Icon d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM9 3v18" />
            </button>
            <button className="icon-btn" type="button" aria-label={t('newChat')} onClick={() => { void state.newChat(); focusComposer() }}>
              <Icon d="M12 5v14M5 12h14" />
            </button>
            <button className="icon-btn" type="button" aria-label={t('searchHistory')} onClick={() => setFiltering(true)}>
              <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
            </button>
          </div>
        </>
      ) : null}
      {filtering && searchReady ? <button className="search-scrim" type="button" aria-label={t('close')} onClick={() => { setFiltering(false); focusComposer() }} /> : null}
      {filtering && searchReady ? (
        <form className={query ? 'search-dialog has-query' : 'search-dialog'} role="search" onSubmit={(event) => event.preventDefault()}>
          <div className="search-field">
          <span className="search-glyph"><Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" /></span>
          <span className="search-rule" />
          <input
            ref={filterInputRef}
            className="side-filter"
            placeholder={t('searchChats')}
            value={filter}
            aria-label={t('search')}
            aria-controls={query ? 'conversation-search-results' : undefined}
            aria-activedescendant={query && activeHit >= 0 ? `conversation-search-result-${activeHit}` : undefined}
            onChange={(event) => {
              const next = event.target.value
              if (suppressEmptyRestore && next === '' && preservedQuery.current) {
                setNativeInputValue(event.target, preservedQuery.current)
                setFilter(preservedQuery.current)
                return
              }
              preservedQuery.current = next
              setFilter(next)
            }}
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
          <button type="button" aria-label={t('close')} onClick={() => { setFiltering(false); focusComposer() }}>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
          </div>
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
          <button className="icon-btn menu-mobile" data-testid="menu" type="button" onClick={() => { const opening = !state.sidebarOpen; if (opening && !window.matchMedia('(min-width: 1024px)').matches) closeRef.current(); state.setSidebarOpen(opening) }}>
            <Icon size={24} d="M3 9h13M3 16h18" />
          </button>
          {sharing && phone ? <div className="chat-title" data-testid="share-title">{t('sharePickTitle')}</div> : conversation && (showDesktopTitle || (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)) ? <div className="chat-title" data-testid="chat-title">{conversation.title || t('untitledChat')}</div> : null}
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
                  <button className="icon-btn" type="button" aria-label={t('share')} onClick={() => enterShare(conversation?.id ?? null)}>
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
                  <div className="composer-back" aria-hidden="true" />
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
                      onChange={() => setShareIds(allTurns ? [] : selectableIds)}
                    />
                    <span>{t('shareSelectAll')}</span>
                  </label>
                  <span className="share-split" aria-hidden="true" />
                  <span className="share-count" data-testid="share-count">{path.length === 0 ? t('shareNone') : t('shareSelected', { count: selectedCount })}</span>
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
            <div role="heading">{t('searchPanel')}</div>
            <button className="icon-btn panel-close" type="button" aria-label={t('close')} onClick={() => closeRef.current()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M14.1871 13.1265L13.1265 14.1872L1.81275 2.87347L2.87341 1.81281L14.1871 13.1265Z" fill="currentColor" />
                <path d="M13.1265 1.81282L14.1871 2.87348L2.8734 14.1872L1.81274 13.1265L13.1265 1.81282Z" fill="currentColor" />
              </svg>
            </button>
          </header>
          <ol>
            {panel.map((item, index) => {
              const site = item.site && item.site !== item.url ? item.site : (() => {
                const host = hostOf(item.url)
                return host && host !== item.url ? host : ''
              })()
              return (
                <li key={item.url}>
                  <a className="source-card" href={item.url} target="_blank" rel="noreferrer">
                    <span className="source-meta">
                      <Favicon label={site || item.title} icon={item.icon} />
                      {site ? <span className="source-site">{site}</span> : null}
                      {site && item.date ? <span className="source-divider" aria-hidden="true" /> : null}
                      {item.date ? <span className="source-date">{item.date}</span> : null}
                      <span className="source-index ds-markdown-cite">{index + 1}</span>
                    </span>
                    <span className="search-view-card__title">{item.title}</span>
                    {item.snippet ? <span className="search-view-card__snippet">{item.snippet}</span> : null}
                  </a>
                </li>
              )
            })}
          </ol>
        </aside>
      ) : (
        <aside className="search-panel is-closed" data-testid="search-panel" aria-hidden="true" />
      )}
      {panel ? <button className="sheet-scrim" type="button" aria-label={t('close')} onClick={() => closeRef.current()} /> : null}
      {state.sidebarOpen ? <button className="scrim" type="button" aria-label={t('close')} onClick={() => state.setSidebarOpen(false)} /> : null}
      {state.settingsOpen ? <Settings /> : null}
      {state.notice ? <ImportToast notice={state.notice} /> : null}
      <SpeechNotice />
      {state.statusToast ? <StatusToast code={state.statusToast} /> : null}
      {shareToast ? (
        <div className="toast-layer">
          <p className="toast" role="status" data-testid="share-select-toast">
            {t(shareToast)}
            <button type="button" onClick={() => setShareToast(null)}>{t('close')}</button>
          </p>
        </div>
      ) : null}
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
  const cancelEdit = useRef(false)
  const editingRef = useRef(false)
  const titleRef = useRef(title)
  editingRef.current = editing
  titleRef.current = title
  usePopoverDismiss(open, () => setOpen(false), moreRef, menuRef)
  // SP-SB-668: Back closes the row menu. A pop while renaming commits (SP-SB-670).
  useEffect(() => {
    const onPop = () => {
      setOpen(false)
      if (!editingRef.current || cancelEdit.current) return
      const next = titleRef.current.trim()
      if (next && next !== conversation.title) void rename(conversation.id, next)
      cancelEdit.current = true
      setEditing(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [conversation.id, conversation.title, rename])
  return (
    <a
      className={`chat-link ${active ? 'active' : ''} ${open ? 'open' : ''} ${picking ? 'picking' : ''}`}
      href={`/a/chat/s/${encodeURIComponent(conversation.id)}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
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
        <span className={`pick ${picked ? 'on' : ''}`} role="checkbox" aria-checked={!!picked} aria-label={conversation.title || t('untitledChat')}>
          {picked ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.1 11.3 2.7 7.9l1.4-1.4 2 2 5.2-5.2 1.4 1.4z" /></svg> : null}
        </span>
      ) : null}
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const next = title.trim()
            if (next && next !== conversation.title) void rename(conversation.id, next)
            setEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
            event.preventDefault()
            event.stopPropagation()
            // Set before unmount so the blur that follows does not commit the typed title.
            cancelEdit.current = true
            setTitle(conversation.title)
            setEditing(false)
          }}
        >
          <input
            autoFocus
            aria-label={t('renameTitle')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={(event) => {
              // SP-SB-670: commit when focus moves to another control (New chat, another row).
              // A reload blur has no element target, so the uncommitted title is not stored.
              if (cancelEdit.current) return
              if (!(event.relatedTarget instanceof Element)) return
              const next = title.trim()
              if (next && next !== conversation.title) void rename(conversation.id, next)
              setEditing(false)
            }}
          />
        </form>
      ) : (
        <button type="button">{conversation.title || t('untitledChat')}</button>
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
          <div role="menuitem" tabIndex={0} onClick={() => { cancelEdit.current = false; setTitle(conversation.title); setEditing(true); setOpen(false) }}><Icon d="M4 20h4L18 10l-4-4L4 16v4zM13 7l4 4" /><span>{t('rename')}</span></div>
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
          label={t('deleteChatTitle')}
          body={t('deleteChatBody')}
          confirm={t('deleteChatConfirm')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); void removeChat(conversation.id) }}
        />
      ) : null}
    </a>
  )
}

const Empty = () => {
  const t = useT()
  const locale = useHarbor((state) => state.settings.locale)
  const hasHistory = useHarbor((state) => state.conversations.length > 0)
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  // Official home-with-history text: 1440 「欢迎回来，想从哪里开始？」, 390 「欢迎回来，随时开始吧」.
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1600px)').matches
  // Official home-with-history text, by the capture for that viewport:
  // 1920 dark 「你好，我能帮什么忙吗？」, 1440 「欢迎回来，想从哪里开始？」, 390 「欢迎回来，随时开始吧」.
  // SP-TB-318/319/320. Time of day and locale pick the fresh greeting. A fresh Chinese
  // landing outside 05:00–12:00 keeps the catalog fallback. Returning Chinese lines stay the viewport set.
  const hour = new Date().getHours()
  const line = locale === 'en'
    ? (narrow ? t('greetingBegin') : t('greetingMind'))
    : !hasHistory && hour >= 5 && hour < 12
      ? t('greetingMorning')
      : t(hasHistory ? (narrow ? 'welcomeBack' : wide ? 'welcomeHello' : 'welcomeAlt') : 'welcomeMessage')
  return (
    <div className="home">
      <div className="home-header">
        <h2 className="greeting"><Mark /><span>{line}</span></h2>
      </div>
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
  const streaming = useHarbor((state) => state.streaming && state.messages.some((item) => item.conversationId === state.activeId && item.status === 'streaming'))
  const generating = useHarbor((state) => state.streaming && state.messages.some((item) => item.status === 'streaming' && item.blocks.length > 0 && item.conversationId === state.activeId))
  const drafts = useHarbor((state) => state.drafts)
  const addFiles = useHarbor((state) => state.addFiles)
  const removeDraft = useHarbor((state) => state.removeDraft)
  const activeId = useHarbor((state) => state.activeId)
  const text = useHarbor((state) => state.textDrafts[activeId ?? ''] ?? '')
  const setComposerText = useHarbor((state) => state.setComposerText)
  const setText = (value: string) => setComposerText(activeId, value)
  const [iconOnly, setIconOnly] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dropKind, setDropKind] = useState<'any' | 'text'>('any')
  const chips = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const voice = useVoiceInput()
  const textRef = useRef(text)
  const activeRef = useRef(activeId)
  const caretRef = useRef<number | null>(null)
  const gestureRef = useRef<VoiceAnchor | null>(null)
  const authRef = useRef<SelectionAuth | null>(null)
  const editRef = useRef<{ text: string; start: number; end: number; inputType: string } | null>(null)
  const compositionRef = useRef<{ text: string; start: number; end: number } | null>(null)
  const compositionOpenRef = useRef(false)
  const ignoreChangeRef = useRef(false)
  const [recovery, setRecovery] = useState<{ transcript: string; conversationId: string | null; generation: number; reason: string } | null>(null)
  textRef.current = text
  activeRef.current = activeId
  const readAnchor = (): VoiceAnchor | null => {
    const node = box.current
    if (!node) return null
    const value = node.value
    const start = node.selectionStart ?? value.length
    const end = node.selectionEnd ?? start
    return { conversationId: activeRef.current, text: value, start, end }
  }
  const armAnchor = (anchor: VoiceAnchor | null) => {
    authRef.current = anchor ? armSelectionAuth(anchor, currentVoiceGeneration()) : null
    editRef.current = null
    compositionRef.current = null
    compositionOpenRef.current = false
    setRecovery(null)
  }
  const applyAuthEdit = (next: string, editStart: number, editEnd: number) => {
    const auth = authRef.current
    if (!auth) return
    authRef.current = applyObservedEdit(auth, next, editStart, editEnd)
  }
  useEffect(() => {
    focusComposer()
    setRecovery((current) => (current && current.conversationId === activeId ? current : null))
  }, [activeId])
  useLayoutEffect(() => {
    const node = box.current
    const caret = caretRef.current
    if (!node || caret == null) return
    caretRef.current = null
    node.focus()
    node.setSelectionRange(caret, caret)
  })
  useEffect(() => {
    const node = box.current
    if (!node) return
    // React's onBeforeInput is a keypress/textInput polyfill. It does not run
    // for Backspace, Delete, or cut, so a deletion would look unobserved and
    // the transcript would never be inserted. The native event still carries
    // the pre-edit selection. The span itself is resolved when the value changes.
    const onNativeBeforeInput = (event: Event) => {
      if (compositionRef.current) return
      const input = event as InputEvent
      if (input.isComposing) return
      editRef.current = {
        text: node.value,
        start: node.selectionStart ?? 0,
        end: node.selectionEnd ?? node.selectionStart ?? 0,
        inputType: input.inputType ?? '',
      }
    }
    node.addEventListener('beforeinput', onNativeBeforeInput)
    return () => node.removeEventListener('beforeinput', onNativeBeforeInput)
  }, [])
  useEffect(() => {
    bindVoiceInserter((transcript, conversationId, generation) => {
      const node = box.current
      const auth = authRef.current
      authRef.current = null
      editRef.current = null
      if (!node?.isConnected || activeRef.current !== conversationId) return
      // Observed steps own the span. A terminal-string guess must not replace them
      // or revive a span the user already deleted.
      // An open composition has not been committed. Matching text must not
      // authorize the span that was saved before those keystrokes.
      const decision = decideDelivery(auth, textRef.current, conversationId, generation, {
        composing: compositionOpenRef.current || compositionRef.current != null,
      })
      if (decision.action === 'insert') {
        const next = insertTranscript(textRef.current, transcript, decision.range)
        caretRef.current = next.caret
        useHarbor.getState().setComposerText(conversationId, next.text)
        return
      }
      if (decision.action === 'recover') {
        setRecovery({ transcript, conversationId, generation, reason: decision.reason })
      }
    })
    return () => bindVoiceInserter(null)
  }, [])
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
      const detail = (event as CustomEvent<string>).detail
      const auth = authRef.current
      if (auth) authRef.current = noteUnobserved(auth, detail)
      // Read the store inside the handler so the empty dependency list stays valid.
      const state = useHarbor.getState()
      state.setComposerText(state.activeId, detail)
      box.current?.focus()
    }
    window.addEventListener('deepapi-prefill', onPrefill)
    return () => window.removeEventListener('deepapi-prefill', onPrefill)
  }, [])
  const trimmed = text.trim()
  const filesBlocking = drafts.some((file) => file.busy || file.error || !file.fileId)
  const hasFile = drafts.some((file) => file.fileId && !file.busy && !file.error)
  const canSend = voice.phase === 'idle' && !filesBlocking && (trimmed.length > 0 || hasFile)
  const voiceLabel = voice.phase === 'recording' ? t('voiceInputStop') : voice.phase === 'transcribing' ? t('voiceInputCancel') : t('voiceInput')
  const voiceSeconds = Math.floor(voice.elapsedMs / 1000)
  const sendTip = drafts.some((file) => file.error) ? t('removeBadFiles') : !trimmed && !hasFile ? t('emptyQuestion') : text.length > 100_000 ? t('overCharLimit') : ''
  const submit = () => {
    if (!trimmed && !hasFile) {
      useHarbor.setState({ statusToast: 'emptyQuestion' })
      return
    }
    if (text.length > 100_000) {
      useHarbor.setState({ statusToast: 'overCharLimit' })
      return
    }
    if (drafts.some((file) => file.error)) {
      useHarbor.setState({ statusToast: 'removeBadFiles' })
      return
    }
    if (!canSend) return
    const value = text
    authRef.current = null
    setRecovery(null)
    setText('')
    void send(value)
    focusComposer()
  }
  const acceptRecovery = () => {
    const offer = recovery
    if (!offer || offer.conversationId !== activeRef.current) return
    const node = box.current
    const length = textRef.current.length
    const caret = node ? Math.min(node.selectionStart ?? length, node.selectionEnd ?? length) : length
    const next = recoverTranscriptAtCaret(textRef.current, offer.transcript, caret)
    caretRef.current = next.caret
    setText(next.text)
    setRecovery(null)
  }
  const copyRecovery = () => {
    const offer = recovery
    if (!offer || offer.conversationId !== activeRef.current) return
    void navigator.clipboard?.writeText(offer.transcript).catch(() => undefined)
  }
  return (
    <div
      className={`composer ${iconOnly ? 'icon-only' : ''} ${dragOver ? 'is-dragover' : ''}`}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        const kinds = [...event.dataTransfer.items].map((item) => item.type).filter(Boolean)
        const hasImage = kinds.some((kind) => kind.startsWith('image/'))
        setDropKind(hasImage || kinds.length === 0 ? 'any' : 'text')
        dragDepth.current += 1
        setDragOver(true)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragOver(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        dragDepth.current = 0
        setDragOver(false)
        const list = [...event.dataTransfer.files]
        if (list.length) void addFiles(list)
      }}
    >
      {voice.phase === 'recording' ? <Spectrum analyser={voice.analyser} /> : null}
      <div className="composer-fill" aria-hidden="true" />
      <div className="composer-fill-alt" aria-hidden="true" />
      {dragOver ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-copy">
            <p className="drop-overlay-title">{dropKind === 'any' ? t('dropFilesAndImages') : t('dropFilesTextOnly')}</p>
          </div>
        </div>
      ) : null}
      {dragOver ? createPortal(
        <div className="drop-mask" data-testid="drop-overlay">
          <div className="drop-mask-copy">
            <p className="drop-mask-title">{dropKind === 'any' ? t('dropFilesAndImages') : t('dropFilesTextOnly')}</p>
          </div>
        </div>,
        document.body,
      ) : null}
      {drafts.length ? (
        <div className="drafts" data-testid="draft-files">
          {drafts.map((file) => (
            file.media === 'image' ? (
              <ImageCard
                key={file.localId}
                name={file.filename}
                src={file.previewUrl}
                failed={Boolean(file.error)}
                onRemove={() => removeDraft(file.localId)}
              />
            ) : (
              <FileCard
                key={file.localId}
                name={file.filename}
                bytes={file.bytes}
                status={file.busy ? 'uploading' : file.error ? 'error' : 'done'}
                error={file.error}
                pasteText={file.pasteText}
                onPasteBack={file.pasteText ? () => {
                  const next = file.pasteText ?? ''
                  const auth = authRef.current
                  if (auth) authRef.current = noteUnobserved(auth, next)
                  setText(next)
                  removeDraft(file.localId)
                } : undefined}
                onRemove={() => removeDraft(file.localId)}
              />
            )
          ))}
        </div>
      ) : null}
      {recovery && recovery.conversationId === activeId ? (
        <div className="voice-recovery" role="status" data-testid="voice-recovery" data-reason={recovery.reason}>
          <p data-testid="voice-recovery-transcript">{recovery.transcript}</p>
          <p>{t('voiceRecoveryOffer')}</p>
          <DsButton type="button" size="s" data-testid="voice-recovery-insert" onClick={acceptRecovery}>{t('voiceRecoveryInsert')}</DsButton>
          <DsButton type="button" size="s" data-testid="voice-recovery-copy" onClick={copyRecovery}>{t('voiceRecoveryCopy')}</DsButton>
          <DsButton type="button" size="s" data-testid="voice-recovery-dismiss" onClick={() => setRecovery(null)}>{t('voiceRecoveryDismiss')}</DsButton>
        </div>
      ) : null}
      <div className="composer-field ds-textarea">
      <div className="composer-mirror ds-textarea__mirror" aria-hidden="true">{text ? `${text}\n` : ''}</div>
      <textarea
        ref={box}
        data-testid="composer"
        rows={2}
        placeholder={t('composerPlaceholder')}
        value={text}
        onCompositionStart={(event) => {
          const node = event.currentTarget
          compositionOpenRef.current = true
          compositionRef.current = {
            text: node.value,
            start: node.selectionStart ?? 0,
            end: node.selectionEnd ?? node.selectionStart ?? 0,
          }
        }}
        onCompositionEnd={(event) => {
          const base = compositionRef.current
          compositionRef.current = null
          compositionOpenRef.current = false
          ignoreChangeRef.current = true
          editRef.current = null
          const auth = authRef.current
          const next = event.currentTarget.value
          if (!auth || !base) return
          if (auth.status === 'live' && base.text === auth.text) authRef.current = applyObservedEdit(auth, next, base.start, base.end)
          else if (auth.status === 'live' && next !== auth.text) authRef.current = noteUnobserved(auth, next)
        }}
        onPointerUp={() => {
          if (authRef.current) authRef.current = noteSelectionMove(authRef.current)
        }}
        onPaste={(event) => {
          const data = event.clipboardData.getData('text/plain')
          if (data.length > 100_000) {
            event.preventDefault()
            useHarbor.setState({ statusToast: 'pasteTooLong' })
            return
          }
          if (data.length >= 8_000) {
            event.preventDefault()
            const file = new File([data], `${t('pastedText')}.txt`, { type: 'text/plain' })
            Object.assign(file, { pasteText: data })
            void addFiles([file])
          }
        }}
        onKeyDown={(event) => {
          const key = event.key.toLowerCase()
          if (authRef.current && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', 'end', 'pageup', 'pagedown'].includes(key)) {
            authRef.current = noteSelectionMove(authRef.current)
          }
          // Ctrl+Z / Ctrl+Y stay with the browser. Preventing them and writing an
          // authorization snapshot drops the draft the user typed after the span
          // stopped being valid, and it also drops the redo entry for that draft.
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
          applyAuthEdit(next, start, end)
          setText(next)
          window.requestAnimationFrame(() => {
            node.selectionStart = start + 1
            node.selectionEnd = start + 1
          })
        }}
        onBeforeInput={(event) => {
          if (compositionRef.current) return
          const native = event.nativeEvent
          const node = event.currentTarget
          editRef.current = {
            text: node.value,
            start: node.selectionStart ?? 0,
            end: node.selectionEnd ?? node.selectionStart ?? 0,
            inputType: 'inputType' in native ? String(native.inputType) : '',
          }
        }}
        onChange={(event) => {
          const next = event.target.value
          const pending = editRef.current
          editRef.current = null
          const native = event.nativeEvent
          if (ignoreChangeRef.current) {
            ignoreChangeRef.current = false
            setText(next)
            return
          }
          const composing = native instanceof InputEvent && native.isComposing
          if (composing) compositionOpenRef.current = true
          // A composition stays uncommitted until compositionend. A crossing or
          // unobserved intermediate invalidates now, so a later string that
          // matches the armed draft cannot revive that same attempt. A still-valid
          // intermediate is committed once, at compositionend.
          if (composing || compositionRef.current || compositionOpenRef.current) {
            editRef.current = null
            const auth = authRef.current
            if (auth) authRef.current = judgeCompositionUpdate(auth, next, compositionRef.current)
            setText(next)
            return
          }
          const auth = authRef.current
          if (auth) {
            const nativeType = native instanceof InputEvent ? native.inputType : ''
            const inputType = nativeType || pending?.inputType || ''
            // Follow the text the browser already produced. Do not write the last
            // trusted snapshot over it when this step is missing or no longer adjacent.
            if (inputType === 'historyUndo' || inputType === 'historyRedo') authRef.current = applyHistory(auth, inputType, next)
            else if (auth.status === 'live' && pending && pending.text === auth.text) {
              const span = resolveEditSpan(pending.text, next, pending.start, pending.end, pending.inputType)
              authRef.current = span
                ? applyObservedEdit(auth, next, span.start, span.end)
                : applyObservedEdit(auth, next, pending.start, pending.end)
            }
            else if (auth.status === 'live' && next !== auth.text) authRef.current = noteUnobserved(auth, next)
          }
          setText(next)
        }}
      />
      </div>
      <div className="composer-tools">
        <div className="chips" ref={chips}>
          <span className="chip-wrap">
            <HoverTip text={t('thinkTip')}>
              <button type="button" data-testid="toggle-thinking" className={prefs.thinking ? 'chip on' : 'chip'} aria-pressed={prefs.thinking} onClick={() => void setPrefs({ thinking: !prefs.thinking })}>
                <Glyph name="thinking" size={14} />
                <span className="chip-label">{t('thinking')}</span>
              </button>
            </HoverTip>
          </span>
          <HoverTip text={hasFile ? t('searchNeedsNoFiles') : t('searchTip')}>
            <button type="button" data-testid="toggle-search" className={`ds-toggle-button ${prefs.search ? 'chip on' : 'chip'}`} aria-pressed={prefs.search} aria-disabled={hasFile} onClick={() => { if (hasFile) return; void setPrefs({ search: !prefs.search }) }}>
              <Glyph name="search" size={14} />
              <span className="chip-label">{t('search')}</span>
            </button>
          </HoverTip>
        </div>
        <div className="tool-right">
          {voice.phase === 'recording' ? <span className="voice-timer" data-testid="voice-timer">{t('voiceInputTimer', { seconds: voiceSeconds })}</span> : null}
          <button
            type="button"
            className={`icon-btn voice-input${voice.phase === 'recording' ? ' recording' : ''}`}
            data-testid="voice-input"
            aria-label={voiceLabel}
            aria-pressed={voice.phase === 'recording'}
            onPointerDown={() => {
              if (voice.phase !== 'idle') {
                gestureRef.current = null
                return
              }
              gestureRef.current = readAnchor()
            }}
            onClick={(event) => {
              if (voice.phase === 'idle') {
                const fromPointer = event.detail > 0
                armAnchor(fromPointer && gestureRef.current ? gestureRef.current : readAnchor())
              } else if (voice.phase === 'transcribing') {
                authRef.current = null
                setRecovery(null)
              }
              gestureRef.current = null
              toggleVoiceInput()
            }}
          >
            {voice.phase === 'recording' ? (
              <span className="voice-active">
                <span className="voice-halo" />
                <span className="voice-core" />
                <span className="voice-outline"><IconMicOutline16 /></span>
                <span className="voice-glyph"><IconMicFill16 /></span>
              </span>
            ) : voice.phase === 'transcribing' ? (
              <span className="voice-loading" />
            ) : (
              <IconMicOutline16 />
            )}
          </button>
          <HoverTip text={prefs.search ? t('filesNeedNoSearch') : t('attachTip')}>
            <button type="button" className="icon-btn" aria-label={t('attach')} onClick={() => { if (prefs.search) return; fileRef.current?.click() }}>
              <Glyph name="attach" size={16} />
            </button>
          </HoverTip>
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
            <button className={`send ${canSend ? 'ready' : ''}`} data-testid="send" type="button" disabled={!canSend} title={sendTip || undefined} onClick={submit}><Icon size={20} stroke={2.2} d="M12 19V5M6 11l6-6 6 6" /></button>
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
  const [deletedOk, setDeletedOk] = useState(false)
  const profile = useProfile()
  const [nickname, setNickname] = useState(profile.nickname)
  const [initial, setInitial] = useState(profile.initial)
  const saveKey = useHarbor((state) => state.saveKey)
  const cost = estimateCost(totals, new Date())
  const shellRef = useRef<HTMLDivElement>(null)
  // SP-SET-765: Back closes and the URL stays. Reload unmounts this dialog. Reopen starts on General.
  useOverlayHistory(true, () => setSettingsOpen(false))
  useScrollLock(true)
  useEffect(() => {
    const root = shellRef.current
    if (!root) return
    root.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const list = [...root.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)].filter((node) => !node.hasAttribute('disabled') && node.getClientRects().length > 0)
      if (!list.length) {
        event.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const current = document.activeElement
      const inside = current instanceof Node && root.contains(current)
      if (event.shiftKey) {
        if (!inside || current === first || current === root) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || current === last || current === root) {
        event.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div
      className="modal settings-modal ds-fade-in ds-modal-focus-lock"
      role="dialog"
      aria-modal="true"
      data-testid="settings-dialog"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        // SP-MOD-636 mask click closes. A press over New chat or a chat row does not (SP-SET-736).
        if (pointHitsChatNav(event.clientX, event.clientY)) return
        setSettingsOpen(false)
      }}
    >
      <div className="settings-shell" data-tab={tab} ref={shellRef} tabIndex={-1}>
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
          <div className="settings-line">
            <span>{t('settingsTtsVoice')}</span>
            <AnchoredMenu
              dismiss
              testId="voice-select"
              label={settings.ttsVoice === 'tide' ? t('settingsTtsVoiceTide') : t('settingsTtsVoiceStella')}
              selected={settings.ttsVoice === 'tide' ? t('settingsTtsVoiceTide') : t('settingsTtsVoiceStella')}
              options={[t('settingsTtsVoiceStella'), t('settingsTtsVoiceTide')]}
              onPick={(value) => void patchSettings({ ttsVoice: value === t('settingsTtsVoiceTide') ? 'tide' : 'stella' })}
            />
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
                label={t('deleteAllTitle')}
                body={t('deleteAllBody')}
                confirm={t('deleteAllConfirm')}
                onCancel={() => setConfirmAll(false)}
                onConfirm={() => {
                  setConfirmAll(false)
                  const { conversations: rows, removeChat: drop } = useHarbor.getState()
                  for (const item of rows) void drop(item.id)
                  setDeletedOk(true)
                }}
              />
            ) : null}
            {deletedOk ? createPortal(<div className="toast-layer"><p className="toast" role="status" data-testid="delete-all-toast">{t('deleteAllOk')}</p></div>, document.body) : null}
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

const StatusToast = ({ code }: { code: StatusToastCode }) => {
  const t = useT()
  const dismiss = useHarbor((state) => state.dismissStatusToast)
  const text = code === 'networkToasts'
    ? `${t('commonNetworkErrorToast')}\n${t('completionNetworkErrorToast')}`
    : t(code)
  return (
    <div className="toast-layer">
      <p className="toast" role="status" data-testid="status-toast">
        {text}
        <button type="button" onClick={dismiss}>{t('close')}</button>
      </p>
    </div>
  )
}

const ImportToast = ({ notice }: { notice: string }) => {
  const t = useT()
  const dismiss = useHarbor((state) => state.dismissNotice)
  const [added, skipped] = notice.split(':')
  return (
    <div className="toast-layer">
    <p className="toast" data-testid="import-toast" role="status">
      {t('imported', { added: added ?? '0', skipped: skipped ?? '0' })}
      <button type="button" onClick={dismiss}>
        {t('close')}
      </button>
    </p>
    </div>
  )
}
