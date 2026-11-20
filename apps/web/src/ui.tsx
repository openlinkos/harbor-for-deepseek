import { translate, type Locale } from '@deepapi/i18n'
import { presentBlocks } from './blocks.js'
import { estimateCost, formatCny } from '@deepapi/pricing'
import { activePath, siblingIds } from '@deepapi/types'
import type { ContentBlock, Conversation, Message } from '@deepapi/types'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { readTheme, saveTheme, type ThemeChoice } from './themeMode.js'
import { loadSkin, parseSkin, saveSkin } from './skin.js'
import { Markdown } from './markdown.js'
import { readProfile, saveProfile, type LocalProfile } from './profile.js'
import { useHarbor, type HarborState } from './store.js'
import { ACTION_ICONS } from './official-icons.js'
import { GLYPHS, type GlyphName } from './glyphs.js'

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

const FillIcon = ({ paths, size = 16, viewBox = '0 0 16 16' }: { paths: readonly string[]; size?: number; viewBox?: string }) => (
  <svg width={size} height={size} viewBox={viewBox} fill="currentColor" aria-hidden="true">
    {paths.map((d) => <path key={d.slice(0, 24)} d={d} fill="currentColor" />)}
  </svg>
)
const Glyph = ({ name, size = 16 }: { name: GlyphName; size?: number }) => {
  const glyph = GLYPHS[name]
  return <FillIcon paths={glyph.paths} viewBox={glyph.vb} size={size} />
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

const shortcutWindows = () => {
  if (typeof navigator === 'undefined') return false
  return navigator.userAgent.toLowerCase().includes('windows')
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
const SourcesPanel = createContext<(items: SourceItem[]) => void>(() => undefined)

const ConfirmDialog = ({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void }) => {
  const t = useT()
  return createPortal(
    <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-label={label} data-testid="confirm-dialog">
      <div className="confirm-card">
        <h2>{label}</h2>
        <div className="edit-actions">
          <button type="button" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" className="danger outline" data-testid="confirm-delete" onClick={onConfirm}>{t('delete')}</button>
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
  const [key, setKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [show, setShow] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [think, setThink] = useState(true)
  const [search, setSearch] = useState(true)
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
                  <div className={think ? 'chip on' : 'chip'} role="presentation" tabIndex={0} onClick={() => setThink((value) => !value)}>
                    <Icon d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2" /> {t('thinking')}
                  </div>
                  <div className={search ? 'chip on' : 'chip'} role="presentation" tabIndex={0} onClick={() => setSearch((value) => !value)}>
                    <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /> {t('search')}
                  </div>
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
          <span className="theme-face" />
          <Icon
            d={
              choice === 'light'
                ? 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'
                : choice === 'dark'
                  ? 'M16 14.5A6.5 6.5 0 1 1 9.5 6 5 5 0 0 0 16 14.5Z'
                  : 'M4 5h16v10H4zM8 19h8'
            }
          />
          {choice === 'system' ? t('themeSystem') : choice === 'light' ? t('themeLight') : t('themeDark')}
        </button>
      ))}
    </div>
  )
}

const LANGUAGES = ['简体中文', 'English', '跟随系统', 'Afrikaans', 'አማርኛ', 'العربية', 'Azərbaycan', 'Беларуская', 'Български', 'বাংলা', 'Català', 'Čeština', 'Dansk']
const VOICES = ['贝壳', '白浪', '海星', '暗潮']

const AnchoredMenu = ({ label, options, selected, onPick, testId, dividerAfter, menuClass, shiftRight = 0 }: { label: string; options: string[]; selected: string; onPick: (value: string) => void; testId?: string; dividerAfter?: number; menuClass?: string; shiftRight?: number }) => {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ top: 0, right: 0, maxHeight: 320 })
  const show = () => setOpen((value) => !value)
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
        <div ref={menuRef} className={`anchored-menu ${menuClass ?? ''}`} role="listbox" style={{ top: box.top, right: box.right, maxHeight: box.maxHeight, maxWidth: 'calc(100vw - 16px)', overflowY: 'auto', minHeight: menuClass === 'lang-menu' ? Math.min(240, box.maxHeight) : undefined }}>
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

const VoiceSelect = () => {
  const [name, setName] = useState(() => localStorage.getItem('deepapi-voice') || '贝壳')
  return (
    <AnchoredMenu
      testId="voice-select"
      menuClass="voice-menu"
      label={name || '贝壳'}
      selected={name || '贝壳'}
      options={VOICES}
      onPick={(value) => {
        setName(value)
        localStorage.setItem('deepapi-voice', value)
      }}
    />
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
      ? `${block.text.trimEnd()}${block.citations.map((_, index) => `〔${index + 1}〕`).join('')}`
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

const SearchResults = ({ block }: { block: Extract<ContentBlock, { type: 'web_search_tool_result' }> }) => {
  const t = useT()
  const openPanel = useContext(SourcesPanel)
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
  const marks = (
    <span className="favicons">
      {results.slice(0, SOURCE_MARKS).map((result) => (
        <Favicon key={result.url} label={result.site_name || result.title} icon={result.site_icon} />
      ))}
    </span>
  )
  return (
    <div className="search-block">
      <p className="found-line">
        <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
        {t('foundPages', { count: results.length })}
        {marks}
      </p>
      <button className="sources-pill" type="button" data-testid="search-results" onClick={() => openPanel(items)}>
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

const Thinking = ({ text }: { text: string }) => {
  const t = useT()
  const streaming = useHarbor((state) => state.streaming)
  const started = useRef(Date.now())
  const [open, setOpen] = useState(true)
  const [seconds, setSeconds] = useState(1)
  useEffect(() => {
    if (streaming) {
      const timer = window.setInterval(() => setSeconds(Math.max(1, Math.round((Date.now() - started.current) / 1000))), 500)
      return () => window.clearInterval(timer)
    }
    setSeconds(Math.max(1, Math.round((Date.now() - started.current) / 1000)))
    return undefined
  }, [streaming])
  if (!text) {
    return null
  }
  return (
    <section className="thinking" data-testid="thinking">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        <Icon d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        {t('thoughtFor', { seconds })}
        <Icon d="M9 6l6 6-6 6" />
      </button>
      {open ? <div className="thinking-body think-copy"><Markdown text={text} /></div> : null}
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

const AssistantTurn = ({ message }: { message: Message }) => {
  const t = useT()
  const openPanel = useContext(SourcesPanel)
  const streaming = useHarbor((state) => state.streaming)
  const started = useRef(Date.now())
  const [open, setOpen] = useState(true)
  const [seconds, setSeconds] = useState(1)
  useEffect(() => {
    if (!streaming) {
      setSeconds(Math.max(1, Math.round((Date.now() - started.current) / 1000)))
      return undefined
    }
    const timer = window.setInterval(() => setSeconds(Math.max(1, Math.round((Date.now() - started.current) / 1000))), 500)
    return () => window.clearInterval(timer)
  }, [streaming])
  const steps: Array<
    | { type: 'think'; text: string }
    | { type: 'search'; items: SourceItem[] }
    | { type: 'browse'; items: { title: string; url: string }[] }
  > = []
  const texts: Extract<ContentBlock, { type: 'text' }>[] = []
  let browse: { title: string; url: string }[] = []
  const flush = () => {
    if (browse.length) {
      steps.push({ type: 'browse', items: browse })
      browse = []
    }
  }
  const sources: SourceItem[] = []
  for (const block of presentBlocks(message.blocks)) {
    if (block.type === 'thinking') {
      flush()
      if (block.thinking.trim()) steps.push({ type: 'think', text: block.thinking })
    } else if (block.type === 'web_search_tool_result') {
      flush()
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
      browse.push({ title: block.content.content?.title || hostOf(block.content.url), url: block.content.url })
    } else if (block.type === 'server_tool_use') {
      const action = block.input.action
      if ((action === 'open_page' || action === 'read_link') && 'url' in block.input && typeof block.input.url === 'string') {
        browse.push({ title: hostOf(block.input.url), url: block.input.url })
      }
    } else if (block.type === 'text') {
      flush()
      texts.push(block)
    } else {
      flush()
    }
  }
  flush()
  return (
    <>
      {steps.length ? (
        <section className="thinking" data-testid="thinking">
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <Icon d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            {t('thoughtFor', { seconds })}
            <span className={`chev ${open ? 'open' : ''}`}><Icon d="M9 6l6 6-6 6" /></span>
          </button>
          <div className={`thinking-collapse ${open ? 'open' : ''}`}>
            <div className="thinking-body">
              {steps.map((step, index) => step.type === 'think' ? (
                <div key={index} className="timeline-step think-copy"><Markdown text={step.text} /></div>
              ) : step.type === 'search' ? (
                <p key={index} className="timeline-step found-line">
                  <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
                  {t('foundPages', { count: step.items.length })}
                  <span className="favicons">{step.items.slice(0, SOURCE_MARKS).map((item) => <Favicon key={item.url} label={item.site} icon={item.icon} />)}</span>
                </p>
              ) : (
                <p key={index} className="timeline-step found-line browse-line">
                  <Icon d="M6 4h9l3 3v13H6z" />
                  {t('browsedPages', { count: step.items.length })}
                  {step.items.map((item) => (
                    <a key={item.url} className="browse-link" href={item.url} target="_blank" rel="noreferrer noopener">
                      {item.title}
                      <Icon size={12} d="M7 17 17 7M9 7h8v8" />
                    </a>
                  ))}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {texts.map((block, index) => (
        <div className="prose" data-testid={index === 0 ? 'assistant-text' : undefined} key={index}>
          <Markdown text={block.text} citations={block.citations} />
        </div>
      ))}
      {sources.length ? (
        <button className="sources-pill" type="button" data-testid="search-results" onClick={() => openPanel(sources)}>
          <span className="favicons">{sources.slice(0, SOURCE_MARKS).map((item) => <Favicon key={item.url} label={item.site} icon={item.icon} />)}</span>
          {t('pagesPill', { count: sources.length })}
        </button>
      ) : null}
    </>
  )
}

const MessageRow = ({ message }: { message: Message }) => {
  const t = useT()
  const messages = useHarbor((state) => state.messages)
  const selectSibling = useHarbor((state) => state.selectSibling)
  const regenerate = useHarbor((state) => state.regenerate)
  const editUser = useHarbor((state) => state.editUser)
  const streaming = useHarbor((state) => state.streaming)
  const siblings = siblingIds(messages, message.id)
  const parent = messages.find((item) => item.id === message.parentId && item.role === 'user')
  const userSiblings = parent ? siblingIds(messages, parent.id) : []
  const versionIds = siblings.length > 1 ? siblings : userSiblings.length > 1 ? userSiblings : []
  const versionCurrent = siblings.length > 1 ? message.id : parent?.id ?? ''
  const versionIndex = versionIds.indexOf(versionCurrent)
  const textOf = message.blocks.filter((block) => block.type === 'text').map((block) => (block.type === 'text' ? block.text : '')).join('\n')
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
    <article className={`turn ${message.role} ${message.status === 'streaming' ? 'streaming' : ''}`} data-testid={`message-${message.role}`} data-follow-id={message.id} aria-busy={message.status === 'streaming'}>
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
          <div className="bubble">{textOf}</div>
          <div className="user-actions">
            <button type="button" data-tip={t('copy')} aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf)}>
              <Icon size={20} d="M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11" />
            </button>
            <button type="button" data-tip={t('edit')} aria-label={t('edit')} onClick={() => { setDraft(textOf); setEditing(true) }}>
              <Icon size={20} d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" />
            </button>
          </div>
        </>
        )
      ) : null}
      {message.status === 'refused' ? <p className="refused">{t('refused')}</p> : null}
      {message.role === 'assistant' ? <AssistantTurn message={message} /> : message.blocks.filter((block) => block.type === 'file_ref').map((block, blockIndex) => (
            <BlockView key={`${message.id}-f-${blockIndex}`} block={block} />
          ))}
      {message.status === 'error' ? (
        <p className="form-error">
          {message.errorMessage || t('error')}
          <button type="button" data-testid="retry" onClick={() => void regenerate(message.id)}>{t('retry')}</button>
        </p>
      ) : null}
      {message.status === 'aborted' ? <p className="hint">{t('stopped')}</p> : null}
      {message.role === 'assistant' && message.status !== 'streaming' ? (
        <div className="action-row">
          {versionIds.length > 1 ? (
            <span className="branch" data-testid="versions">
              <button type="button" aria-label="‹" disabled={versionIndex <= 0} onClick={() => stepVersion(-1)}>‹</button>
              <span>{versionIndex + 1} / {versionIds.length}</span>
              <button type="button" aria-label="›" disabled={versionIndex >= versionIds.length - 1} onClick={() => stepVersion(1)}>›</button>
            </span>
          ) : null}
          <button type="button" data-tip={copied ? t('copied') : t('copy')} aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200) })}>{copied ? '✓' : <FillIcon paths={[...ACTION_ICONS.copy]} />}</button>
          <button type="button" data-testid="regenerate" data-tip={t('regenerate')} aria-label={t('regenerate')} disabled={streaming} onClick={() => void regenerate(message.id)}>
            <FillIcon paths={[...ACTION_ICONS.regen]} />
          </button>
          <button type="button" data-tip={t('like')} className={vote === 'up' ? 'on' : ''} aria-label={t('like')} aria-pressed={vote === 'up'} onClick={() => choose('up')}><FillIcon paths={[...ACTION_ICONS.like]} /></button>
          <button type="button" data-tip={t('dislike')} className={vote === 'down' ? 'on' : ''} aria-label={t('dislike')} aria-pressed={vote === 'down'} onClick={() => { choose('down'); setFeedbackOpen(true) }}><FillIcon paths={[...ACTION_ICONS.dislike]} /></button>
          <button type="button" data-tip={t('speak')} aria-label={t('speak')} onClick={() => { const utter = new SpeechSynthesisUtterance(textOf); utter.lang = 'zh-CN'; speechSynthesis.cancel(); speechSynthesis.speak(utter) }}><FillIcon paths={[...ACTION_ICONS.speak]} /></button>
          <button type="button" data-tip={t('share')} aria-label={t('share')} onClick={() => downloadText('deepapi-answer.md', `${textOf}\n`)}><FillIcon paths={[...ACTION_ICONS.share]} /></button>
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
  const [userMenu, setUserMenu] = useState(false)
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
        if (state.settingsOpen) {
          state.setSettingsOpen(false)
        }
        focusComposer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])
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

  return (
    <SourcesPanel.Provider value={setPanel}>
    <div className={`shell ${state.sidebarOpen ? 'nav-open' : ''} ${collapsed ? 'sider-collapsed' : ''} ${panel ? 'panel-open' : ''} ${selecting ? 'selecting' : ''}`}>
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
        <a className="user-bar" href="#account" onClick={(event) => event.preventDefault()}>
          <span className="avatar" aria-hidden="true">
            {initial || 'D'}
          </span>
          <span className="user-copy">
            <span className="user-label">{who}</span>
          </span>
          <button className="icon-btn" type="button" data-testid="user-menu" aria-label={t('menu')} onClick={() => setUserMenu((value) => !value)}>
            <FillIcon paths={MORE_DOTS} />
          </button>
          {userMenu ? (
            <div className="menu user-menu">
              <div role="menuitem" tabIndex={0} onClick={() => window.open('https://github.com/openlinkos/deepapi/releases', '_blank', 'noopener')}>{t('downloadMobile')}</div>
              <div role="menuitem" tabIndex={0} data-testid="settings-open" onClick={() => { setUserMenu(false); state.setSettingsOpen(true) }}>{t('systemSettings')}</div>
              <div role="menuitem" tabIndex={0} onClick={() => window.open('https://github.com/openlinkos/deepapi/issues', '_blank', 'noopener')}>{t('helpFeedback')}</div>
              <div role="menuitem" tabIndex={0} onClick={() => { setUserMenu(false); if (state.serverUser) void state.logoutServer(); else void state.clearKey() }}><Glyph name="close" size={16} />{t('logout')}</div>
            </div>
          ) : null}
        </a>
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
        <form className="search-dialog" role="search" onSubmit={(event) => event.preventDefault()}>
          <span className="search-glyph"><Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" /></span>
          <span className="search-rule" />
          <input className="side-filter" autoFocus placeholder={t('searchChats')} value={filter} aria-label={t('search')} onChange={(event) => setFilter(event.target.value)} />
          <button type="button" aria-label={t('close')} onClick={() => { setFiltering(false); setFilter(''); focusComposer() }}>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
        </form>
      ) : null}
      <section className="stage">
        {path.length > 0 ? <div className="top-fill" aria-hidden="true" /> : null}
        <header className="topbar">
          <button className="icon-btn menu-mobile" data-testid="menu" type="button" onClick={() => state.setSidebarOpen(!state.sidebarOpen)}>
            <Icon size={24} d="M3 9h13M3 16h18" />
          </button>
          {conversation?.title ? <div className="chat-title">{conversation.title}</div> : null}
          {state.serverMode ? <span className="server-pill" data-testid="server-mode">{t('serverChat')}</span> : null}
          {state.serverUser?.role === 'admin' ? (
            <button className="ghost" data-testid="open-admin" type="button" onClick={() => state.openAdmin(true)}>{t('adminTitle')}</button>
          ) : null}
          <span className="top-actions">
            <a className="download-app" href="https://github.com/openlinkos/deepapi/releases" target="_blank" rel="noreferrer noopener">
              <Icon d="M12 4v10M8 10l4 4 4-4M5 18h14" />
              <span>{t('downloadApp')}</span>
            </a>
            <button className="icon-btn top-new" data-testid="top-new" type="button" aria-label={t('newChat')} onClick={() => { void state.newChat(); focusComposer() }}>
              <Icon size={24} d="M5 7h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8l-3 2v-2H5a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM8 12h6M11 9v6" />
            </button>
            {path.length > 0 ? (
              <button className="icon-btn" type="button" aria-label="share" onClick={() => void (navigator.share ? navigator.share({ title: conversation?.title || 'DeepAPI', text: conversation?.title || '' }) : navigator.clipboard.writeText(conversation?.title || ''))}>
                <Icon size={16} d="M14 5h5v5M19 5l-8 8M9 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
              </button>
            ) : null}
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
              <div className="composer-wrap">
                <Composer />
                <p className="footnote ai-note">{t('aiNote')}</p>
              </div>
            </div>
            {away ? (
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
    </div>
    </SourcesPanel.Provider>
  )
}

const EMPTY_MESSAGES: Message[] = []

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const ChatLink = ({ conversation, active, picking, picked, onPick, onMulti }: { conversation: Conversation; active: boolean; picking?: boolean; picked?: boolean; onPick?: () => void; onMulti?: () => void }) => {
  const t = useT()
  const openChat = useHarbor((state) => state.openChat)
  const setSidebarOpen = useHarbor((state) => state.setSidebarOpen)
  const rename = useHarbor((state) => state.rename)
  const pin = useHarbor((state) => state.pin)
  const removeChat = useHarbor((state) => state.removeChat)
  const messages = useHarbor((state) => (state.activeId === conversation.id ? state.messages : EMPTY_MESSAGES))
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0 })
  const [confirming, setConfirming] = useState(false)
  return (
    <a className={`chat-link ${active ? 'active' : ''} ${open ? 'open' : ''} ${picking ? 'picking' : ''}`} href={`#${conversation.id}`} onClick={(event) => { event.preventDefault(); if (picking) onPick?.() }}>
      <div className="chat-row">
      {picking ? (
        <span className={`pick ${picked ? 'on' : ''}`} role="checkbox" aria-checked={!!picked} aria-label={conversation.title || t('newChat')}>
          {picked ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.1 11.3 2.7 7.9l1.4-1.4 2 2 5.2-5.2 1.4 1.4z" /></svg> : null}
        </span>
      ) : null}
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); void rename(conversation.id, title); setEditing(false) }}>
          <input aria-label={t('renameTitle')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </form>
      ) : (
        <button type="button" onClick={(event) => { if (picking) return; event.stopPropagation(); setSidebarOpen(false); void openChat(conversation.id); focusComposer() }}>{conversation.title || t('newChat')}</button>
      )}
      {picking ? null : <button className="icon-btn more" type="button" aria-label={t('menu')} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setMenuBox({ top: rect.bottom + 4, left: rect.left - 5 })
        setOpen((value) => !value)
      }}><FillIcon paths={MORE_DOTS} /></button>}
      </div>
      {open ? createPortal(
        <>
        {window.matchMedia('(max-width: 767px)').matches ? <button className="item-menu-scrim" type="button" aria-label={t('close')} onClick={() => setOpen(false)} /> : null}
        <div className={`menu item-menu ${window.matchMedia('(max-width: 767px)').matches ? 'sheet' : ''}`} role="menu" style={window.matchMedia('(max-width: 767px)').matches ? undefined : { top: menuBox.top, left: menuBox.left }}>
          <div role="menuitem" tabIndex={0} onClick={() => { setEditing(true); setOpen(false) }}><Icon d="M4 20h4L18 10l-4-4L4 16v4zM13 7l4 4" /><span>{t('rename')}</span></div>
          <div role="menuitem" tabIndex={0} onClick={() => { setOpen(false); void pin(conversation.id) }}><Icon d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z" /><span>{conversation.pinned ? t('unpin') : t('pin')}</span></div>
          <div role="menuitem" tabIndex={0} onClick={() => {
            setOpen(false)
            const body = messages.map((message) => {
              const text = message.blocks.filter((block) => block.type === 'text').map((block) => (block.type === 'text' ? block.text : '')).join('\n')
              return `**${message.role}**\n\n${text}`
            }).join('\n\n')
            downloadText(`${conversation.title || 'deepapi'}.md`, `# ${conversation.title || 'DeepAPI'}\n\n${body}\n`)
          }}><Icon d="M4 12v8h16v-8M12 16V4M8 8l4-4 4 4" /><span>{t('share')}</span></div>
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
  const flash = prefs.model === 'deepseek-flash'
  const submit = () => {
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
            <div data-testid="toggle-thinking" className={prefs.thinking ? 'chip on' : 'chip'} role="presentation" tabIndex={0} onClick={() => void setPrefs({ thinking: !prefs.thinking })}>
              <Glyph name="thinking" size={14} />
              <span className="chip-label">{t('thinking')}</span>
            </div>
          </span>
          <div data-testid="toggle-search" className={prefs.search ? 'chip on' : 'chip'} role="presentation" tabIndex={0} aria-disabled={flash ? 'false' : 'true'} onClick={() => { if (flash) void setPrefs({ search: !prefs.search }) }}>
            <Glyph name="search" size={14} />
            <span className="chip-label">{t('search')}</span>
          </div>
        </div>
        <div className="tool-right">
          <button type="button" className={`icon-btn ${flash ? '' : 'off'}`} aria-label={t('attach')} disabled={!flash} onClick={() => fileRef.current?.click()}>
            <Glyph name="attach" size={16} />
          </button>
          <input ref={fileRef} data-testid="file-input" type="file" hidden disabled={!flash} onChange={(event) => { const list = event.target.files ? [...event.target.files] : []; event.target.value = ''; void addFiles(list) }} />
          {streaming ? (
            <button className="send stop" data-testid="stop" type="button" onClick={stop}><Icon size={18} stroke={2.4} d="M8 8h8v8H8z" /></button>
          ) : (
            <button className={`send ${text.trim() ? 'ready' : ''}`} data-testid="send" type="button" onClick={submit}><Icon size={20} stroke={2.2} d="M12 19V5M6 11l6-6 6 6" /></button>
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
          <button type="button" className="settings-x" aria-label={t('close')} onClick={() => {
            const modal = document.querySelector('.settings-modal')
            modal?.classList.add('closing')
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            window.setTimeout(() => { setSettingsOpen(false); focusComposer() }, reduce ? 0 : 100)
          }}>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
        </header>
        <nav className="settings-nav" aria-label={t('systemSettings')}>
          <button type="button" className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}><Icon d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h2M18 12h2M12 4v2M12 18v2" />{t('navGeneral')}</button>
          <button type="button" className={tab === 'account' ? 'on' : ''} onClick={() => setTab('account')}><Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />{t('navAccount')}</button>
          <button type="button" className={tab === 'data' ? 'on' : ''} onClick={() => setTab('data')}><Icon d="M4 7h16v12H4zM4 11h16M9 7v12" />{t('navData')}</button>
          <button type="button" className={tab === 'legal' ? 'on' : ''} onClick={() => setTab('legal')}><Icon d="M7 3h8l4 4v14H7zM11 13h6M11 17h6" />{t('navLegal')}</button>
        </nav>
        <div className="settings-main">
        <section className="settings-general">
          <h3>{t('theme')}</h3>
          <ThemeSwitch />
          <div className="settings-line">
            <span>{t('language')}</span>
            <AnchoredMenu
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
            <span>{t('voice')}</span>
            <VoiceSelect />
          </div>
          <div className="settings-line">
            <span>{t('skin')}</span>
            <span className="account-side">
              <label className="file-button">
                {t('skinImport')}
                <input
                  data-testid="skin-file"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    void file.text().then((raw) => saveSkin(parseSkin(raw))).catch(() => undefined)
                  }}
                />
              </label>
              <button type="button" className="account-quiet" data-testid="skin-reset" onClick={() => saveSkin(null)}>{t('skinReset')}</button>
            </span>
          </div>
          <div className="settings-line">
            <span>{t('model')}</span>
            <AnchoredMenu
              testId="model-select"
              label={prefs.model === 'deepseek-v4-pro' ? `DeepSeek ${t('pro')}` : `DeepSeek ${t('flash')}`}
              selected={prefs.model === 'deepseek-v4-pro' ? `DeepSeek ${t('pro')}` : `DeepSeek ${t('flash')}`}
              options={[`DeepSeek ${t('flash')}`, `DeepSeek ${t('pro')}`]}
              onPick={(value) => void setPrefs({ model: value.endsWith(t('pro')) ? 'deepseek-v4-pro' : 'deepseek-flash' })}
            />
          </div>
          <div className="settings-line">
            <span>{t('effort')}</span>
            <AnchoredMenu
              testId="effort-select"
              label={prefs.effort}
              selected={prefs.effort}
              options={['low', 'high', 'max']}
              onPick={(value) => void setPrefs({ effort: value as HarborState['prefs']['effort'] })}
            />
          </div>
          <div className="settings-line">
            <span>{t('safety')}</span>
            <AnchoredMenu
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
              disabled={prefs.model !== 'deepseek-flash'}
              onClick={() => void setPrefs({ readLink: !prefs.readLink })}
            >
              <span className="knob" />
            </button>
          </div>
          <div className="settings-line">
            <span>{t('fileExpiry')}</span>
            <input
              className="settings-pill"
              data-testid="file-expiry"
              type="number"
              min={1}
              max={30}
              value={settings.fileExpireDays}
              onChange={(event) => void patchSettings({ fileExpireDays: Number(event.target.value) })}
            />
          </div>
          <div className="settings-line">
            <span>{t('filePurpose')}</span>
            <AnchoredMenu
              testId="purpose-select"
              label={settings.documentPurpose === 'text_recognition' ? t('textRecognition') : t('richLayout')}
              selected={settings.documentPurpose === 'text_recognition' ? t('textRecognition') : t('richLayout')}
              options={[t('richLayout'), t('textRecognition')]}
              onPick={(value) => void patchSettings({ documentPurpose: value === t('textRecognition') ? 'text_recognition' : 'rich_layout_recognition' })}
            />
          </div>
        </section>
        <section className="settings-account">
          <div className="settings-line">
            <span>API Key</span>
            <button type="button" className="account-quiet" onClick={() => void clearKey()}>{t('clearKey')}</button>
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
                <button type="button" className="account-quiet" data-testid="refresh-balance" onClick={() => void refreshBalance()}>{t('refresh')}</button>
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
            <button type="button" className="account-quiet" onClick={() => saveProfile({ nickname, initial })}>{t('save')}</button>
          </div>
        </section>
        <section className="settings-data">
          <div className="settings-line">
            <span>{t('sharedLinks')}</span>
            <button type="button" className="account-quiet" onClick={() => setSharedNote(true)}>{t('manage')}</button>
          </div>
          {sharedNote ? <p className="hint">{t('noShared')}</p> : null}
          <div className="settings-line stack">
            <div className="settings-copy wide">
              <span>{t('exportAll')}</span>
              <p className="hint">{t('exportAllBody')}</p>
            </div>
            <button type="button" className="account-quiet" data-testid="export-all" onClick={() => { setExporting(true); void exportJson().finally(() => setExporting(false)) }}>{exporting ? <span className="spinner" aria-hidden="true" /> : t('export')}</button>
          </div>
          <div className="settings-line">
            <span>{t('deleteAll')}</span>
            <button type="button" className="account-danger" onClick={() => setConfirmAll(true)}>{t('delete')}</button>
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
            <button type="button" className="account-quiet" data-testid="export-json" onClick={() => void exportJson()}>{t('export')}</button>
          </div>
          <div className="settings-line">
            <span>{t('exportZip')}</span>
            <button type="button" className="account-quiet" data-testid="export-zip" onClick={() => void exportZip()}>{t('export')}</button>
          </div>
          <div className="settings-line">
            <span>{t('importAsCopy')}</span>
            <button type="button" data-testid="import-as-copy" className={asCopy ? 'switch on' : 'switch'} aria-pressed={asCopy} onClick={() => setAsCopy((value) => !value)}>
              <span className="knob" />
            </button>
          </div>
          <div className="settings-line">
            <span>{t('importJson')}</span>
            <label className="file-button">
              {t('importAct')}
              <input
                data-testid="import-json"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void importJson(file, asCopy)
                }}
              />
            </label>
          </div>
          <div className="settings-line">
            <span>{t('importZip')}</span>
            <label className="file-button">
              {t('importAct')}
              <input
                data-testid="import-zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void importZip(file, asCopy)
                }}
              />
            </label>
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
            <button type="button" className="account-quiet" data-testid="replace-save" onClick={() => void saveKey(nextKey, passphrase, true)}>{t('save')}</button>
          </div>
          <div className="settings-line">
            <span>{t('deviceKey')}</span>
            <button type="button" className="account-quiet" onClick={() => void clearKey()}>{t('clearKey')}</button>
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
                <button type="submit" className="account-quiet" data-testid="remote-login">{inviteCode.trim() ? t('registerSubmit') : t('connectServer')}</button>
              </div>
              {remoteError ? <p className="error">{remoteError}</p> : null}
            </form>
          ) : null}
          {serverUser ? (
            <>
              {serverBase ? <p className="hint" data-testid="connected-server">{t('connectedServer')}: {serverBase}</p> : null}
            <div className="settings-line"><span>{t('syncNow')}</span><button type="button" className="account-quiet" data-testid="server-sync" onClick={() => void syncServer()}>{t('syncAct')}</button></div>
            <div className="settings-line"><span>{t('copyLocal')}</span><button type="button" className="account-quiet" data-testid="copy-local" onClick={() => void copyLocalToServer()}>{t('copyAct')}</button></div>
            <div className="settings-line"><span>{serverMode ? t('useLocal') : t('useServer')}</span><button type="button" className="account-quiet" onClick={() => void (serverMode ? enterLocalMode() : enterServerMode())}>{t('switchAct')}</button></div>
            <div className="settings-line"><span>{t('logout')}</span><button type="button" className="account-quiet" onClick={() => void logoutServer()}>{t('logoutAct')}</button></div>
            </>
          ) : hosted ? (
            <button type="button" data-testid="open-login" onClick={openLogin}>
              {t('loginTitle')}
            </button>
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
