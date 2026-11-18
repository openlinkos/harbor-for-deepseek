import { translate, type Locale } from '@harbor/i18n'
import { presentBlocks } from './blocks.js'
import { estimateCost, formatCny } from '@harbor/pricing'
import { activePath, siblingIds } from '@harbor/types'
import type { ContentBlock, Conversation, Message } from '@harbor/types'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { readTheme, saveTheme, type ThemeChoice } from './themeMode.js'
import { Markdown } from './markdown.js'
import { conversationCost, useHarbor, type HarborState } from './store.js'

const Mark = () => (
  <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#3964FE" />
    <path d="M9 8v16M23 8v16M9 16h14" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

type SourceItem = { url: string; title: string; snippet: string; site: string }
const SourcesPanel = createContext<(items: SourceItem[]) => void>(() => undefined)

const useT = () => {
  const locale = useHarbor((state) => state.settings.locale)
  return (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars)
}

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

  return (
    <main className="gate">
      <div className="gate-card">
        <Mark />
        <p className="eyebrow">{t('taglineSub')}</p>
        <h1>{t('product')}</h1>
        <p className="lede">{t('tagline')}</p>
        <LanguageSwitch locale={locale} onChange={setLocale} />
        {locked ? (
          <form onSubmit={onUnlock}>
            <h2>{t('unlockTitle')}</h2>
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
            <button className="primary" data-testid="unlock-submit" type="submit">
              {t('unlock')}
            </button>
          </form>
        ) : (
          <form onSubmit={onSave}>
            <h2>{t('keyTitle')}</h2>
            <p className="risk">{t('keyBody')}</p>
            <label className="check">
              <input data-testid="key-ack" type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
              <span>{t('keyAck')}</span>
            </label>
            <label>
              {t('keyPlaceholder')}
              <span className="field-row">
                <input
                  data-testid="key-input"
                  type={show ? 'text' : 'password'}
                  value={key}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t('keyPlaceholder')}
                  onChange={(event) => setKey(event.target.value)}
                />
                <button type="button" className="ghost" onClick={() => setShow((value) => !value)}>
                  {show ? t('hide') : t('show')}
                </button>
              </span>
            </label>
            <label>
              {t('passphraseOptional')}
              <input
                data-testid="key-passphrase"
                type="password"
                value={passphrase}
                autoComplete="new-password"
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </label>
            <p className="hint">{t('passphraseHint')}</p>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary" data-testid="key-save" type="submit">
              {t('saveKey')}
            </button>
          </form>
        )}
        {hosted ? (
          <button className="ghost" type="button" data-testid="open-login" onClick={openLogin}>
            {t('loginTitle')}
          </button>
        ) : null}
        <footer className="legal">
          <p>{t('disclaimer')}</p>
          <p>{t('disclaimerLong')}</p>
        </footer>
      </div>
    </main>
  )
}

const ThemeSwitch = () => {
  const t = useT()
  const [theme, setTheme] = useState<ThemeChoice>(readTheme())
  return (
    <div className="chips">
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
    <button type="button" className={locale === 'zh' ? 'on' : ''} onClick={() => onChange('zh')}>
      中文
    </button>
    <button type="button" className={locale === 'en' ? 'on' : ''} onClick={() => onChange('en')}>
      English
    </button>
  </div>
)

const BlockView = ({ block, testId }: { block: ContentBlock; testId?: string }) => {
  const t = useT()
  if (block.type === 'thinking') {
    return <Thinking text={block.thinking} />
  }
  if (block.type === 'text') {
    return (
      <div className="prose" data-testid={testId}>
        <Markdown text={block.text} />
        {block.citations?.map((citation, index) => (
          <span className="cite" key={citation.url}>
            {index + 1}
            <span className="hover-card">
              <strong>{citation.title || citation.url}</strong>
              <p>{citation.cited_text}</p>
            </span>
          </span>
        ))}
      </div>
    )
  }
  if (block.type === 'server_tool_use') {
    const action = block.input.action
    if (action === 'search') {
      const queries =
        'queries' in block.input && Array.isArray(block.input.queries)
          ? block.input.queries.filter((item): item is string => typeof item === 'string')
          : []
      return (
        <p className="tool-line">
          {t('searchQueries')}: {queries.join(' · ')}
        </p>
      )
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
  }))
  return (
    <div data-testid="search-results">
      <p className="found-line">
        <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" />
        {t('foundPages', { count: results.length })}
        <span className="favicons">
          {results.slice(0, 4).map((result) => (
            <i key={result.url}>{result.title.slice(0, 1)}</i>
          ))}
        </span>
      </p>
      <button className="sources-pill" type="button" onClick={() => openPanel(items)}>
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
        <Icon d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        {t('thoughtFor', { seconds })}
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
      {message.role === 'user' ? <div className="bubble">{textOf}</div> : null}
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
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [path.length, state.streaming, state.messages])

  const chatUsage = conversationCost(state.messages)
  const total = estimateCost(state.totals, new Date())
  const [collapsed, setCollapsed] = useState(false)
  const [panel, setPanel] = useState<SourceItem[] | null>(null)
  const groups = useMemo(() => {
    const buckets = new Map<string, typeof state.conversations>()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    for (const item of state.conversations) {
      const when = new Date(item.updatedAt)
      const days = (startOfDay.getTime() - new Date(when).setHours(0, 0, 0, 0)) / 86_400_000
      const label = days < 1 ? t('groupToday') : days < 7 ? t('group7') : days < 30 ? t('group30') : `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      buckets.set(label, [...(buckets.get(label) ?? []), item])
    }
    return [...buckets.entries()]
  }, [state.conversations, t])
  const who = state.serverUser?.username ?? t('thisDevice')

  return (
    <SourcesPanel.Provider value={setPanel}>
    <div className={`shell ${state.sidebarOpen ? 'nav-open' : ''} ${collapsed ? 'sider-collapsed' : ''} ${panel ? 'panel-open' : ''}`}>
      <aside className="sidebar" data-testid="sidebar">
        <div className="sider-top">
          <span className="brand-name"><Mark /> Harbor</span>
          <button className="icon-btn" type="button" aria-label={t('hide')} onClick={() => setCollapsed(true)}>
            <Icon d="M15 6H5m0 0 4-4M5 6l4 4M9 18h10m0 0-4-4m4 4-4 4" />
          </button>
        </div>
        <button className="new-chat" data-testid="new-chat" type="button" onClick={() => void state.newChat()}>
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
        <div className="side-usage" data-testid="total-usage">
          <span>{t('allChats')}</span>
          <strong>
            {t('totalLine', {
              inTokens: state.totals.input_tokens + state.totals.cache_read_input_tokens,
              outTokens: state.totals.output_tokens,
              cny: formatCny(total.totalCny),
            })}
          </strong>
          {state.balance ? <span data-testid="balance-side">{t('balance')} {state.balance.balance_infos[0]?.total_balance} {t('cny')}</span> : null}
        </div>
        <button className="user-row" type="button" data-testid="settings-open" onClick={() => state.setSettingsOpen(true)}>
          <span className="avatar">{who.slice(0, 1).toUpperCase()}</span>
          <span>{who}<small>{state.serverMode ? t('serverChat') : t('tagline')}</small></span>
        </button>
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
            <Icon d="M4 7h16M4 12h16M4 17h16" />
          </button>
          <h2>{conversation?.title || ''}</h2>
          {state.serverMode ? <span data-testid="server-mode">{t('serverChat')}</span> : null}
          {state.serverUser?.role === 'admin' ? (
            <button className="ghost" data-testid="open-admin" type="button" onClick={() => state.openAdmin(true)}>{t('adminTitle')}</button>
          ) : null}
        </header>
        {path.length === 0 ? (
          <div className="transcript" data-testid="message-list"><Empty /></div>
        ) : (
          <>
            <div className="transcript" data-testid="message-list">
              {path.map((message) => conversation ? <MessageRow key={message.id} message={message} conversation={conversation} /> : null)}
              <div ref={endRef} />
            </div>
            {conversation ? <p className="chat-usage">{t('thisChat')} · {formatCny(chatUsage.totalCny)} {t('cny')}</p> : null}
            <div className="composer-wrap">
              <Composer />
              <p className="footnote">{t('disclaimer')}</p>
            </div>
          </>
        )}
      </section>
      {panel ? (
        <aside className="search-panel" data-testid="search-panel">
          <header>
            <strong>{t('searchPanel')}</strong>
            <button className="icon-btn" type="button" onClick={() => setPanel(null)}>{t('close')}</button>
          </header>
          <ol>
            {panel.map((item, index) => (
              <li key={item.url}>
                <small>{index + 1} · {item.site}</small>
                <a href={item.url} target="_blank" rel="noreferrer noopener"><strong>{item.title}</strong></a>
                <p>{item.snippet}</p>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
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
        <button type="button" onClick={() => void openChat(conversation.id)}>{conversation.title || t('newChat')}</button>
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
  const send = useHarbor((state) => state.send)
  const streaming = useHarbor((state) => state.streaming)
  const prompts = [
    ['suggestion-math', t('suggestionMath')],
    ['suggestion-search', t('suggestionSearch')],
    ['suggestion-link', t('suggestionLink')],
  ] as const
  return (
    <div className="home">
      <h2 className="greeting"><Mark /> {t('emptyTitle')}</h2>
      <Composer />
      <p className="footnote">{t('disclaimer')}</p>
      <div className="suggestions">
        {prompts.map(([id, prompt]) => (
          <button key={id} data-testid={id} type="button" disabled={streaming} onClick={() => void send(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
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
          <button type="button" data-testid="toggle-thinking" className={prefs.thinking ? 'chip on' : 'chip'} onClick={() => void setPrefs({ thinking: !prefs.thinking })}>
            <Icon d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2" /> {t('thinking')}
          </button>
          <button type="button" data-testid="toggle-search" className={prefs.search ? 'chip on' : 'chip'} disabled={!flash} onClick={() => void setPrefs({ search: !prefs.search })}>
            <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /> {t('search')}
          </button>
          <button type="button" data-testid="toggle-read" className={prefs.readLink ? 'chip on' : 'chip'} disabled={!flash} onClick={() => void setPrefs({ readLink: !prefs.readLink })}>
            {t('readLink')}
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
      <div className="model-row">
        <select data-testid="model-select" value={prefs.model} onChange={(event) => void setPrefs({ model: event.target.value as HarborState['prefs']['model'] })}>
          <option value="deepseek-flash">DeepSeek {t('flash')}</option>
          <option value="deepseek-v4-pro">DeepSeek {t('pro')}</option>
        </select>
        <select data-testid="effort-select" value={prefs.effort} onChange={(event) => void setPrefs({ effort: event.target.value as HarborState['prefs']['effort'] })}>
          <option value="low">low</option>
          <option value="high">high</option>
          <option value="max">max</option>
        </select>
        {!flash ? <span className="hint">{t('toolsFlashOnly')}</span> : null}
      </div>
    </div>
  )
}

const Settings = () => {
  const t = useT()
  const settings = useHarbor((state) => state.settings)
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
  const totals = useHarbor((state) => state.totals)
  const quota = useHarbor((state) => state.quota)
  const [asCopy, setAsCopy] = useState(false)
  const [nextKey, setNextKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const saveKey = useHarbor((state) => state.saveKey)
  const info = balance?.balance_infos[0]
  const cost = estimateCost(totals, new Date())
  return (
    <div className="modal" role="dialog" aria-modal="true" data-testid="settings-dialog">
      <div className="modal-card">
        <header>
          <h2>{t('settings')}</h2>
          <button type="button" className="ghost" onClick={() => setSettingsOpen(false)}>
            {t('close')}
          </button>
        </header>
        <LanguageSwitch locale={settings.locale} onChange={(locale) => void setLocale(locale)} />
        <section>
          <h3>{t('theme')}</h3>
          <ThemeSwitch />
        </section>
        <section>
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
        <section>
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
        <section>
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
        <section>
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
        <section>
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
        <section>
          <h3>{t('serverTitle')}</h3>
          <p>{t('serverBody')}</p>
          {serverUser ? (
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
          ) : hosted ? (
            <button type="button" data-testid="open-login" onClick={openLogin}>
              {t('loginTitle')}
            </button>
          ) : null}
        </section>
        <section>
          <h3>{t('about')}</h3>
          <p>{t('disclaimerLong')}</p>
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
