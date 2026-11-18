import { translate, type Locale } from '@harbor/i18n'
import { presentBlocks } from './blocks.js'
import { estimateCost, formatCny } from '@harbor/pricing'
import { activePath, siblingIds } from '@harbor/types'
import type { ContentBlock, Conversation, Message } from '@harbor/types'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { readTheme, saveTheme, type ThemeChoice } from './themeMode.js'
import { Markdown } from './markdown.js'
import { readProfile, saveProfile, type LocalProfile } from './profile.js'
import { useHarbor, type HarborState } from './store.js'

const useProfile = () => {
  const [profile, setProfile] = useState<LocalProfile>(readProfile)
  useEffect(() => {
    const sync = () => setProfile(readProfile())
    window.addEventListener('harbor-profile', sync)
    return () => window.removeEventListener('harbor-profile', sync)
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
        <a href="https://github.com/openlinkos/harbor-for-deepseek">GitHub</a>
        <span aria-hidden="true"> · </span>
        <a href="https://github.com/openlinkos/harbor-for-deepseek/blob/master/LICENSE">{t('footerLicense')}</a>
        <span aria-hidden="true"> · </span>
        <a href={locale === 'zh' ? 'https://openlinkos.com/zh/' : 'https://openlinkos.com/'}>OpenLinkOS</a>
      </p>
      <p>{t('footerMark')}</p>
    </footer>
  )
}

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size >= 24 ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const Favicon = ({ label }: { label: string }) => (
  <i className="favicon" aria-hidden="true">{(label.trim().slice(0, 1) || '?').toUpperCase()}</i>
)

type SourceItem = { url: string; title: string; snippet: string; site: string; date?: string }
const SourcesPanel = createContext<(items: SourceItem[]) => void>(() => undefined)

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

const DOCS = 'https://github.com/openlinkos/harbor-for-deepseek/blob/master/SECURITY.md'
const PLATFORM = 'https://platform.deepseek.com'
const REPO = 'https://github.com/openlinkos/harbor-for-deepseek'

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
  const [ack, setAck] = useState(false)
  const [show, setShow] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [think, setThink] = useState(true)
  const [search, setSearch] = useState(false)
  const [error, setError] = useState('')

  const onSave = (event: FormEvent) => {
    event.preventDefault()
    if (!ack) {
      setError(t('needAck'))
      return
    }
    void saveKey(key, passphrase, ack)
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
          <span className="wordmark">Harbor for <span className="wordmark-ds">DeepSeek</span></span>
        </span>
        <LanguageSwitch locale={locale} onChange={setLocale} />
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
                  <button type="button" className={think ? 'chip on' : 'chip'} onClick={() => setThink((value) => !value)}>
                    <Icon d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2" /> {t('thinking')}
                  </button>
                  <button type="button" className={search ? 'chip on' : 'chip'} onClick={() => setSearch((value) => !value)}>
                    <Icon d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" /> {t('search')}
                  </button>
                </div>
                <button className={`send ${draft.trim() ? 'ready' : ''}`} data-testid="landing-send" type="submit" aria-label={t('send')}>
                  <Icon d="M12 19V5M6 11l6-6 6 6" />
                </button>
              </div>
            </form>
            <div className="landing-pills">
              <button type="button" className="landing-pill" data-testid="start-chat" onClick={() => setKeyOpen(true)}>
                <Icon d="M8 12h8M12 8v8" /> {t('startChat')}
              </button>
              <a className="landing-pill" href={PLATFORM} target="_blank" rel="noreferrer noopener">
                <Icon d="M8 7h8v10H8zM10 7V5h4v2" /> {t('apiPlatform')}
              </a>
              <a className="landing-pill" href={REPO} target="_blank" rel="noreferrer noopener">
                <Icon d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.9a3.4 3.4 0 00-.9-2.6c3-.3 6.1-1.5 6.1-6.6a4.7 4.7 0 00-1.3-3.3 4.4 4.4 0 00-.1-3.2s-1-.3-3.3 1.2a11.4 11.4 0 00-6 0C6.2 1.1 5.2 1.4 5.2 1.4a4.4 4.4 0 00-.1 3.2 4.7 4.7 0 00-1.3 3.3c0 5.1 3.1 6.3 6.1 6.6a3.4 3.4 0 00-.9 2.6V21" /> {t('github')}
              </a>
            </div>
            {hosted ? (
              <button className="landing-pill" type="button" data-testid="open-login" onClick={openLogin}>
                {t('loginTitle')}
              </button>
            ) : null}
          </>
        )}
      </div>
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
            <button type="button" className="advanced" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
              {t('advanced')}
            </button>
            {advanced ? (
              <label>
                {t('passphraseOptional')}
                <input
                  data-testid="key-passphrase"
                  type="password"
                  value={passphrase}
                  autoComplete="new-password"
                  onChange={(event) => setPassphrase(event.target.value)}
                />
                <span className="hint">{t('passphraseHint')}</span>
              </label>
            ) : null}
            <label className="check">
              <input data-testid="key-ack" type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
              <span>{t('keyAck')}</span>
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
      {(['system', 'light', 'dark'] as ThemeChoice[]).map((choice) => (
        <button
          key={choice}
          type="button"
          className={theme === choice ? 'chip on' : 'chip'}
          onClick={() => {
            saveTheme(choice)
            setTheme(choice)
          }}
        >
          {choice === 'system' ? t('themeSystem') : choice === 'light' ? t('themeLight') : t('themeDark')}
        </button>
      ))}
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
  }))
  const marks = (
    <span className="favicons">
      {results.slice(0, 3).map((result) => (
        <Favicon key={result.url} label={result.site_name || result.title} />
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
          {results.slice(0, 3).map((result) => (
            <Favicon key={result.url} label={result.site_name || result.title} />
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
        <Icon d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2" />
        {t('thoughtFor', { seconds })}
        <Icon d="M9 6l6 6-6 6" />
      </button>
      {open ? <div className="thinking-body">{text}</div> : null}
    </section>
  )
}

const MessageRow = ({ message, conversation }: { message: Message; conversation: Conversation }) => {
  const t = useT()
  const messages = useHarbor((state) => state.messages)
  const selectSibling = useHarbor((state) => state.selectSibling)
  const regenerate = useHarbor((state) => state.regenerate)
  const streaming = useHarbor((state) => state.streaming)
  const siblings = siblingIds(messages, message.id)
  const index = siblings.indexOf(message.id)
  const cost = message.usage ? estimateCost(message.usage, new Date(message.updatedAt)) : null
  const textOf = message.blocks.filter((block) => block.type === 'text').map((block) => (block.type === 'text' ? block.text : '')).join('\n')
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  return (
    <article className={`turn ${message.role}`} data-testid={`message-${message.role}`}>
      {siblings.length > 1 ? (
        <header>
          <span className="branch">
            <button type="button" disabled={index <= 0} onClick={() => index > 0 && void selectSibling(message.id, siblings[index - 1] ?? message.id)}>‹</button>
            <span>{t('branch')} {index + 1}/{siblings.length}</span>
            <button type="button" disabled={index >= siblings.length - 1} onClick={() => index < siblings.length - 1 && void selectSibling(message.id, siblings[index + 1] ?? message.id)}>›</button>
          </span>
        </header>
      ) : null}
      {message.role === 'user' ? (
        <>
          <div className="bubble">{textOf}</div>
          <div className="user-actions">
            <button type="button" aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf)}>
              <Icon d="M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11" />
            </button>
            <button type="button" aria-label={t('edit')} onClick={() => window.dispatchEvent(new CustomEvent('harbor-prefill', { detail: textOf }))}>
              <Icon d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" />
            </button>
          </div>
        </>
      ) : null}
      {message.status === 'refused' ? <p className="refused">{t('refused')}</p> : null}
      {message.role === 'assistant'
        ? presentBlocks(message.blocks).map((block, blockIndex) => (
            <BlockView key={`${message.id}-${blockIndex}`} block={block} testId={block.type === 'text' ? 'assistant-text' : undefined} />
          ))
        : message.blocks.filter((block) => block.type === 'file_ref').map((block, blockIndex) => (
            <BlockView key={`${message.id}-f-${blockIndex}`} block={block} />
          ))}
      {message.status === 'error' ? <p className="form-error">{message.errorMessage || t('error')}</p> : null}
      {message.status === 'aborted' ? <p className="hint">{t('stopped')}</p> : null}
      {message.role === 'assistant' && message.usage ? (
        <p className="usage" data-testid="usage-line">
          {message.usage.input_tokens} {t('input')} · {message.usage.output_tokens} {t('output')}
          {message.usage.output_tokens_details?.thinking_tokens ? ` · ${t('thinkingTokens')} ${message.usage.output_tokens_details.thinking_tokens}` : ''}
          {cost ? ` · ${formatCny(cost.totalCny)} ${t('cny')} · ${cost.peak ? t('peak') : t('offPeak')}` : ''}
        </p>
      ) : null}
      {message.role === 'assistant' && message.status !== 'streaming' ? (
        <div className="action-row">
          <button type="button" aria-label={t('copy')} onClick={() => void navigator.clipboard.writeText(textOf).then(() => setCopied(true))}>{copied ? '✓' : <Icon d="M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11" />}</button>
          {conversation.activeLeafId === message.id ? (
            <button type="button" data-testid="regenerate" aria-label={t('regenerate')} disabled={streaming} onClick={() => void regenerate(message.id)}>
              <Icon d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
            </button>
          ) : null}
          <button type="button" className={vote === 'up' ? 'on' : ''} aria-label="like" onClick={() => setVote('up')}><Icon d="M7 11v10H4v-9h3Zm0 0 4-6a2 2 0 0 1 3.5 1L13 11h6l-1 8H7" /></button>
          <button type="button" className={vote === 'down' ? 'on' : ''} aria-label="dislike" onClick={() => setVote('down')}><Icon d="M17 13V3h3v9h-3Zm0 0-4 6a2 2 0 0 1-3.5-1L11 13H5l1-8h11" /></button>
          <button type="button" aria-label="share" onClick={() => void (navigator.share ? navigator.share({ text: textOf }) : navigator.clipboard.writeText(textOf))}><Icon d="M4 12v8h16v-8M12 16V4M8 8l4-4 4 4" /></button>
        </div>
      ) : null}
    </article>
  )
}

export const Shell = () => {
  const t = useT()
  const state = useHarbor()
  const conversation = state.conversations.find((item) => item.id === state.activeId) ?? null
  const path = useMemo(
    () => activePath(state.messages, conversation?.activeLeafId ?? null),
    [state.messages, conversation?.activeLeafId],
  )
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [away, setAway] = useState(false)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
    setAway(false)
  }, [path.length, state.streaming, state.messages])
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

  const total = estimateCost(state.totals, new Date())
  const profile = useProfile()
  const [collapsed, setCollapsed] = useState(false)
  const [filtering, setFiltering] = useState(false)
  const [filter, setFilter] = useState('')
  const [userMenu, setUserMenu] = useState(false)
  const [panel, setPanel] = useState<SourceItem[] | null>(null)
  const groups = useMemo(() => {
    const buckets = new Map<string, typeof state.conversations>()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    for (const item of state.conversations.filter((chat) => !filter || (chat.title || t('newChat')).includes(filter))) {
      const when = new Date(item.updatedAt)
      const days = (startOfDay.getTime() - new Date(when).setHours(0, 0, 0, 0)) / 86_400_000
      const label = days < 1 ? t('groupToday') : days < 7 ? t('group7') : days < 30 ? t('group30') : `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      buckets.set(label, [...(buckets.get(label) ?? []), item])
    }
    return [...buckets.entries()]
  }, [state.conversations, filter, t])
  const serverName = state.serverUser?.username
  const who = serverName || profile.nickname || t('localMode')
  const modeLine = serverName ? t('serverChat') : profile.nickname ? t('localMode') : t('localStay')
  const initial = serverName ? serverName.slice(0, 1).toUpperCase() : profile.initial
  const narrow = () => window.matchMedia('(max-width: 767px)').matches

  return (
    <SourcesPanel.Provider value={setPanel}>
    <div className={`shell ${state.sidebarOpen ? 'nav-open' : ''} ${collapsed ? 'sider-collapsed' : ''} ${panel ? 'panel-open' : ''}`}>
      <aside className="sidebar" data-testid="sidebar">
        <div className="sider-top">
          <span className="brand-name">
            <Mark />
            <span className="wordmark">Harbor for <span className="wordmark-ds">DeepSeek</span></span>
          </span>
          <span className="sider-icons">
            <button className="icon-btn" type="button" aria-label={t('search')} onClick={() => setFiltering((value) => !value)}>
              <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
            </button>
            <button className="icon-btn" type="button" aria-label={t('hide')} onClick={() => (narrow() ? state.setSidebarOpen(false) : setCollapsed(true))}>
              <Icon d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM9 3v18" />
            </button>
          </span>
        </div>
        {filtering ? (
          <input className="side-filter" value={filter} aria-label={t('search')} onChange={(event) => setFilter(event.target.value)} />
        ) : null}
        <button className="new-chat" data-testid="new-chat" type="button" onClick={() => { state.setSidebarOpen(false); void state.newChat() }}>
          <Icon d="M12 5v14M5 12h14" /> {t('newChat')}
        </button>
        <div className="side-scroll">
          {state.conversations.length === 0 ? <p className="hint">{t('noConversations')}</p> : null}
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="group-label">{label}</p>
              {items.map((item) => (
                <ChatLink key={item.id} conversation={item} active={item.id === state.activeId} />
              ))}
            </div>
          ))}
        </div>
        <div className="user-bar" title={modeLine}>
          <span className="avatar" aria-hidden="true">
            {initial || <Icon d="M4 5h16v11H4zM2 19h20" />}
          </span>
          <span className="user-copy">
            <span className="user-label">{who}</span>
            <small>{modeLine}</small>
          </span>
          <button className="icon-btn" type="button" data-testid="user-menu" aria-label={t('menu')} onClick={() => setUserMenu((value) => !value)}>
            <Icon d="M6 12h.01M12 12h.01M18 12h.01" />
          </button>
          {userMenu ? (
            <div className="menu user-menu">
              <p className="hint">{serverName ? t('serverChat') : t('localStay')}</p>
              <p className="side-usage" data-testid="total-usage">
                {t('totalLine', {
                  inTokens: state.totals.input_tokens + state.totals.cache_read_input_tokens,
                  outTokens: state.totals.output_tokens,
                  cny: formatCny(total.totalCny),
                })}
                {state.balance ? <span data-testid="balance-side"> {t('balance')} {state.balance.balance_infos[0]?.total_balance} {t('cny')}</span> : null}
              </p>
              <button type="button" data-testid="settings-open" onClick={() => { setUserMenu(false); state.setSettingsOpen(true) }}>{t('settings')}</button>
              <button type="button" onClick={() => { setUserMenu(false); state.setSettingsOpen(true) }}>{t('help')}</button>
              {state.serverUser ? <button type="button" onClick={() => void state.logoutServer()}>{t('logout')}</button> : null}
            </div>
          ) : null}
        </div>
        <SiteFooter />
      </aside>
      {collapsed ? (
        <div className="float-pill">
          <button className="icon-btn" type="button" aria-label={t('menu')} onClick={() => setCollapsed(false)}><Mark /></button>
          <button className="icon-btn" type="button" onClick={() => void state.newChat()}><Icon d="M12 5v14M5 12h14" /></button>
        </div>
      ) : null}
      <section className="stage">
        <header className="topbar">
          <button className="icon-btn menu-mobile" data-testid="menu" type="button" onClick={() => state.setSidebarOpen(!state.sidebarOpen)}>
            <Icon size={24} d="M3 8h18M3 16h11" />
          </button>
          <h2>{conversation?.title || ''}</h2>
          {state.serverMode ? <span className="server-pill" data-testid="server-mode">{t('serverChat')}</span> : null}
          {state.serverUser?.role === 'admin' ? (
            <button className="ghost" data-testid="open-admin" type="button" onClick={() => state.openAdmin(true)}>{t('adminTitle')}</button>
          ) : null}
          <span className="top-actions">
            <button className="icon-btn top-new" type="button" aria-label={t('newChat')} onClick={() => void state.newChat()}>
              <Icon d="M12 5v14M5 12h14" />
            </button>
            {path.length > 0 ? (
              <button className="icon-btn" type="button" aria-label="share" onClick={() => void (navigator.share ? navigator.share({ title: conversation?.title || 'Harbor for DeepSeek', text: conversation?.title || '' }) : navigator.clipboard.writeText(conversation?.title || ''))}>
                <Icon d="M4 12v8h16v-8M12 16V4M8 8l4-4 4 4" />
              </button>
            ) : null}
          </span>
        </header>
        {path.length === 0 ? (
          <div className="transcript" data-testid="message-list"><Empty /></div>
        ) : (
          <>
            <div
              className="transcript"
              data-testid="message-list"
              ref={listRef}
              onScroll={() => {
                const list = listRef.current
                if (!list) {
                  return
                }
                setAway(list.scrollHeight - list.scrollTop - list.clientHeight > 96)
              }}
            >
              {path.map((message) => conversation ? <MessageRow key={message.id} message={message} conversation={conversation} /> : null)}
              <div ref={endRef} />
            </div>
            {away ? (
              <button className="jump-end" type="button" aria-label={t('scrollDown')} onClick={() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}>
                <Icon d="M6 9l6 6 6-6" />
              </button>
            ) : null}
            <div className="composer-wrap">
              <Composer />
            </div>
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
                    <Favicon label={item.site} />
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

const ChatLink = ({ conversation, active }: { conversation: Conversation; active: boolean }) => {
  const t = useT()
  const openChat = useHarbor((state) => state.openChat)
  const setSidebarOpen = useHarbor((state) => state.setSidebarOpen)
  const rename = useHarbor((state) => state.rename)
  const removeChat = useHarbor((state) => state.removeChat)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  return (
    <div className={`chat-link ${active ? 'active' : ''} ${open ? 'open' : ''}`}>
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); void rename(conversation.id, title); setEditing(false) }}>
          <input aria-label={t('renameTitle')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </form>
      ) : (
        <button type="button" onClick={() => { setSidebarOpen(false); void openChat(conversation.id) }}>{conversation.title || t('newChat')}</button>
      )}
      <button className="icon-btn more" type="button" aria-label={t('menu')} onClick={() => setOpen((value) => !value)}><Icon d="M6 12h.01M12 12h.01M18 12h.01" /></button>
      {open ? (
        <div className="menu">
          <button type="button" onClick={() => { setEditing(true); setOpen(false) }}>{t('rename')}</button>
          <button className="danger" type="button" onClick={() => { if (window.confirm(t('deleteConfirm'))) void removeChat(conversation.id) }}>{t('delete')}</button>
        </div>
      ) : null}
    </div>
  )
}

const Empty = () => {
  const t = useT()
  return (
    <div className="home">
      <h2 className="greeting"><Mark /> {t('emptyTitle')}</h2>
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
  const box = useRef<HTMLTextAreaElement>(null)
  const [effortOpen, setEffortOpen] = useState(false)
  useEffect(() => {
    const onPrefill = (event: Event) => {
      setText((event as CustomEvent<string>).detail)
      box.current?.focus()
    }
    window.addEventListener('harbor-prefill', onPrefill)
    return () => window.removeEventListener('harbor-prefill', onPrefill)
  }, [])
  const flash = prefs.model === 'deepseek-flash'
  const submit = () => {
    const value = text
    setText('')
    void send(value)
  }
  return (
    <div className="composer">
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
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className="composer-tools">
        <div className="chips">
          <span className="chip-wrap">
            <button type="button" data-testid="toggle-thinking" className={prefs.thinking ? 'chip on' : 'chip'} onClick={() => void setPrefs({ thinking: !prefs.thinking })}>
              <Icon d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2" /> {t('thinking')}
            </button>
            <button className="chip-more" type="button" aria-label={t('effort')} onClick={() => setEffortOpen((value) => !value)}>
              <Icon d="M6 9l6 6 6-6" />
            </button>
            {effortOpen ? (
              <div className="menu effort-menu">
                {(['low', 'high', 'max'] as const).map((level) => (
                  <button key={level} type="button" onClick={() => { void setPrefs({ effort: level }); setEffortOpen(false) }}>
                    {level}{prefs.effort === level ? ' ·' : ''}
                  </button>
                ))}
              </div>
            ) : null}
          </span>
          <button type="button" data-testid="toggle-search" className={prefs.search ? 'chip on' : 'chip'} disabled={!flash} onClick={() => void setPrefs({ search: !prefs.search })}>
            <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /> {t('search')}
          </button>
        </div>
        <div className="tool-right">
          <label className={`icon-btn ${flash ? '' : 'off'}`} aria-label={t('attach')}>
            <Icon d="M21.4 11.1 12.7 19.8a5 5 0 0 1-7.1-7.1l8.5-8.4a3.5 3.5 0 0 1 4.9 5L10.5 17.8a2 2 0 1 1-2.8-2.8l7.8-7.8" />
            <input data-testid="file-input" type="file" hidden disabled={!flash} onChange={(event) => { const list = event.target.files ? [...event.target.files] : []; event.target.value = ''; void addFiles(list) }} />
          </label>
          {streaming ? (
            <button className="send stop" data-testid="stop" type="button" onClick={stop}><Icon d="M8 8h8v8H8z" /></button>
          ) : (
            <button className={`send ${text.trim() ? 'ready' : ''}`} data-testid="send" type="button" onClick={submit}><Icon d="M12 19V5M6 11l6-6 6 6" /></button>
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
  const [tab, setTab] = useState<'general' | 'profile' | 'data'>('general')
  const profile = useProfile()
  const [nickname, setNickname] = useState(profile.nickname)
  const [initial, setInitial] = useState(profile.initial)
  const saveKey = useHarbor((state) => state.saveKey)
  const info = balance?.balance_infos[0]
  const cost = estimateCost(totals, new Date())
  return (
    <div className="modal" role="dialog" aria-modal="true" data-testid="settings-dialog">
      <div className="modal-card" data-tab={tab}>
        <header className="settings-head">
          <h2>{t('settings')}</h2>
          <button type="button" className="ghost settings-x" aria-label={t('close')} onClick={() => setSettingsOpen(false)}>
            <span className="settings-close-word">{t('close')}</span>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
        </header>
        <nav className="settings-tabs" aria-label={t('settings')}>
          {(['general', 'profile', 'data'] as const).map((item) => (
            <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>
              {item === 'general' ? t('tabGeneral') : item === 'profile' ? t('tabProfile') : t('tabData')}
            </button>
          ))}
        </nav>
        <section className="settings-general">
          <LanguageSwitch locale={settings.locale} onChange={(locale) => void setLocale(locale)} />
        </section>
        <section className="settings-general">
          <h3>{t('theme')}</h3>
          <ThemeSwitch />
        </section>
        <section className="settings-profile">
          <h3>{t('tabProfile')}</h3>
          <p className="hint">{t('localStay')}</p>
          <label>
            {t('nickname')}
            <input data-testid="nickname" value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} />
          </label>
          <label>
            {t('avatarInitial')}
            <input data-testid="avatar-initial" value={initial} maxLength={2} onChange={(event) => setInitial(event.target.value)} />
          </label>
          <button type="button" className="primary" onClick={() => saveProfile({ nickname, initial })}>{t('save')}</button>
        </section>
        <section className="settings-data">
          <h3>{serverMode ? t('quotaHeading') : t('balance')}</h3>
          {serverMode ? (
            <p data-testid="quota">
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
            </p>
          ) : (
            <p data-testid="balance">
              {info ? (
                <>
                  {info.total_balance} {info.currency} · {balance?.is_available ? t('available') : t('unavailable')} · {t('granted')}{' '}
                  {info.granted_balance} · {t('toppedUp')} {info.topped_up_balance}
                </>
              ) : (
                t('balanceFailed')
              )}
            </p>
          )}
          {balanceError && !serverMode ? <p className="form-error">{t('balanceFailed')}</p> : null}
          {serverMode ? null : (
            <button type="button" data-testid="refresh-balance" onClick={() => void refreshBalance()}>
              {t('refresh')}
            </button>
          )}
        </section>
        <section className="settings-data">
          <h3>{t('usageTitle')}</h3>
          <p className="hint">{serverMode ? t('serverUsageNote') : t('noUsageApi')}</p>
          <ul className="usage-grid">
            <li>{t('input')}: {totals.input_tokens}</li>
            <li>{t('cache')}: {totals.cache_read_input_tokens}</li>
            <li>{t('output')}: {totals.output_tokens}</li>
            <li>{t('thinkingTokens')}: {totals.output_tokens_details?.thinking_tokens ?? 0}</li>
            <li>{t('billedSearch')}: {totals.server_tool_use?.tool_search ?? 0}</li>
            <li>{t('billedFetch')}: {totals.server_tool_use?.tool_fetch ?? 0}</li>
            <li>{t('displaySearch')}: {totals.server_tool_use?.web_search_requests ?? 0}</li>
            <li>{t('displayFetch')}: {totals.server_tool_use?.web_fetch_requests ?? 0}</li>
            <li>
              {t('estimated')}: {formatCny(cost.totalCny)} {t('cny')} ({cost.peak ? t('peak') : t('offPeak')})
            </li>
          </ul>
        </section>
        <section className="settings-general">
          <h3>{t('model')}</h3>
          <label>
            {t('model')}
            <select data-testid="model-select" value={prefs.model} onChange={(event) => void setPrefs({ model: event.target.value as HarborState['prefs']['model'] })}>
              <option value="deepseek-flash">DeepSeek {t('flash')}</option>
              <option value="deepseek-v4-pro">DeepSeek {t('pro')}</option>
            </select>
          </label>
          <label>
            {t('effort')}
            <select data-testid="effort-select" value={prefs.effort} onChange={(event) => void setPrefs({ effort: event.target.value as HarborState['prefs']['effort'] })}>
              <option value="low">low</option>
              <option value="high">high</option>
              <option value="max">max</option>
            </select>
          </label>
          <button type="button" data-testid="toggle-read" className={prefs.readLink ? 'chip on' : 'chip'} disabled={prefs.model !== 'deepseek-flash'} onClick={() => void setPrefs({ readLink: !prefs.readLink })}>
            {t('readLink')}
          </button>
          {prefs.model !== 'deepseek-flash' ? <p className="hint">{t('toolsFlashOnly')}</p> : null}
        </section>
        <section className="settings-general">
          <h3>{t('safety')}</h3>
          <label>
            <select
              data-testid="safety-select"
              value={settings.safetyLevel}
              onChange={(event) => void patchSettings({ safetyLevel: event.target.value === 'low' ? 'low' : 'high' })}
            >
              <option value="high">{t('safetyHigh')}</option>
              <option value="low">{t('safetyLow')}</option>
            </select>
          </label>
          <p className="hint">{t('safetyWarn')}</p>
          <label>
            {t('fileExpiry')}
            <input
              type="number"
              min={1}
              max={30}
              value={settings.fileExpireDays}
              onChange={(event) => void patchSettings({ fileExpireDays: Number(event.target.value) })}
            />
          </label>
          <label>
            {t('filePurpose')}
            <select
              value={settings.documentPurpose}
              onChange={(event) =>
                void patchSettings({
                  documentPurpose: event.target.value === 'text_recognition' ? 'text_recognition' : 'rich_layout_recognition',
                })
              }
            >
              <option value="rich_layout_recognition">{t('richLayout')}</option>
              <option value="text_recognition">{t('textRecognition')}</option>
            </select>
          </label>
        </section>
        <section className="settings-data">
          <h3>{serverMode ? t('serverPrivacyTitle') : t('privacyTitle')}</h3>
          <p className="hint">{serverMode ? t('serverPrivacyBody') : t('currentKey')}</p>
          <p className="hint">{serverMode ? t('serverImportNote') : t('importMergeNote')}</p>
          <div className="button-row">
            <button type="button" data-testid="export-json" onClick={() => void exportJson()}>
              {t('exportJson')}
            </button>
            <button type="button" data-testid="export-zip" onClick={() => void exportZip()}>
              {t('exportZip')}
            </button>
          </div>
          <label className="check">
            <input data-testid="import-as-copy" type="checkbox" checked={asCopy} onChange={(event) => setAsCopy(event.target.checked)} />
            <span>{t('importAsCopy')}</span>
          </label>
          <div className="button-row">
            <label className="file-button">
              {t('importJson')}
              <input
                data-testid="import-json"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) {
                    void importJson(file, asCopy)
                  }
                }}
              />
            </label>
            <label className="file-button">
              {t('importZip')}
              <input
                data-testid="import-zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) {
                    void importZip(file, asCopy)
                  }
                }}
              />
            </label>
          </div>
        </section>
        {serverMode ? null : (
        <section className="settings-data">
          <h3>{t('replaceKey')}</h3>
          <input type="password" value={nextKey} autoComplete="off" onChange={(event) => setNextKey(event.target.value)} />
          <input
            type="password"
            placeholder={t('passphraseOptional')}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <div className="button-row">
            <button type="button" onClick={() => void saveKey(nextKey, passphrase, true)}>
              {t('save')}
            </button>
            <button type="button" onClick={() => void clearKey()}>
              {t('clearKey')}
            </button>
          </div>
        </section>
        )}
        <section className="settings-data">
          <h3>{t('serverTitle')}</h3>
          <p>{native ? t('nativeServerBody') : t('serverBody')}</p>
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
              <label>
                {t('serverUrl')}
                <input data-testid="server-url" value={remoteUrl} autoComplete="off" onChange={(event) => setRemoteUrl(event.target.value)} />
              </label>
              <label className="check">
                <input
                  data-testid="allow-lan"
                  type="checkbox"
                  checked={allowLanHttp}
                  onChange={(event) => setAllowLanHttp(event.target.checked)}
                />
                {t('allowLanHttp')}
              </label>
              <label>
                {t('loginUser')}
                <input data-testid="remote-user" value={remoteUser} autoComplete="username" onChange={(event) => setRemoteUser(event.target.value)} />
              </label>
              <label>
                {t('loginPassword')}
                <input
                  data-testid="remote-password"
                  type="password"
                  value={remotePassword}
                  autoComplete="current-password"
                  onChange={(event) => setRemotePassword(event.target.value)}
                />
              </label>
              <label>
                {t('registerCode')}
                <input data-testid="remote-invite" value={inviteCode} autoComplete="off" onChange={(event) => setInviteCode(event.target.value)} />
              </label>
              <button type="submit" data-testid="remote-login">
                {inviteCode.trim() ? t('registerSubmit') : t('connectServer')}
              </button>
              {remoteError ? <p className="error">{remoteError}</p> : null}
            </form>
          ) : null}
          {serverUser ? (
            <>
              {serverBase ? <p className="hint" data-testid="connected-server">{t('connectedServer')}: {serverBase}</p> : null}
            <div className="button-row">
              <button type="button" data-testid="server-sync" onClick={() => void syncServer()}>
                {t('syncNow')}
              </button>
              <button type="button" data-testid="copy-local" onClick={() => void copyLocalToServer()}>
                {t('copyLocal')}
              </button>
              <button type="button" onClick={() => void (serverMode ? enterLocalMode() : enterServerMode())}>
                {serverMode ? t('useLocal') : t('useServer')}
              </button>
              <button type="button" onClick={() => void logoutServer()}>
                {t('logout')}
              </button>
            </div>
            </>
          ) : hosted ? (
            <button type="button" data-testid="open-login" onClick={openLogin}>
              {t('loginTitle')}
            </button>
          ) : null}
        </section>
        <section className="settings-general">
          <h3>{t('about')}</h3>
          <SiteFooter />
          <p className="hint">
            <a href="https://github.com/openlinkos/harbor-for-deepseek">openlinkos/harbor-for-deepseek</a>
            {' · '}
            <a href="https://platform.deepseek.com/">platform.deepseek.com</a>
          </p>
        </section>
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
