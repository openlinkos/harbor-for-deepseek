import { translate, type Locale } from '@harbor/i18n'
import { estimateCost, formatCny, sumUsage } from '@harbor/pricing'
import { activePath, siblingIds } from '@harbor/types'
import type { ContentBlock, Conversation, Message } from '@harbor/types'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Markdown } from './markdown.js'
import { conversationCost, useHarbor, type HarborState } from './store.js'

const Mark = () => (
  <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#F3EFE6" />
    <path d="M6 46c7 5 14 5 21 0s14-5 21 0 10 5 14 2v8H6z" fill="#1F6A64" />
    <rect x="10" y="40" width="28" height="4.5" rx="2" fill="#142226" />
    <rect x="34" y="22" width="6" height="22" rx="1.5" fill="#142226" />
    <circle cx="37" cy="17" r="4.2" fill="#E08A3C" />
    <path d="M42 17h12" stroke="#E08A3C" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

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
        {block.citations?.length ? (
          <ol className="citations">
            {block.citations.map((citation) => (
              <li key={citation.url}>
                <a href={citation.url} target="_blank" rel="noreferrer noopener">
                  {citation.title || citation.url}
                </a>
              </li>
            ))}
          </ol>
        ) : null}
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
    const results = block.content.filter((item) => item.type === 'web_search_result')
    if (!results.length) {
      return null
    }
    return (
      <ul className="sources" data-testid="search-results">
        {results.map((result) => (
          <li key={result.url}>
            <a href={result.url} target="_blank" rel="noreferrer noopener">
              <strong>{result.title}</strong>
              <span>{result.site_name || result.url}</span>
            </a>
            {result.snippet ? <p>{result.snippet}</p> : null}
          </li>
        ))}
      </ul>
    )
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

const Thinking = ({ text }: { text: string }) => {
  const t = useT()
  const streaming = useHarbor((state) => state.streaming)
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (!streaming && text) {
      setOpen(false)
    }
  }, [streaming, text])
  if (!text) {
    return null
  }
  return (
    <section className="thinking" data-testid="thinking">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        {open ? t('hideReasoning') : t('showReasoning')}
      </button>
      {open ? <Markdown text={text} /> : <p className="thinking-preview">{text.slice(0, 140)}</p>}
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
  return (
    <article className={`row ${message.role}`} data-testid={`message-${message.role}`}>
      <header>
        <span>{message.role === 'user' ? t('you') : t('assistant')}</span>
        {siblings.length > 1 ? (
          <span className="branch">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => index > 0 && void selectSibling(message.id, siblings[index - 1] ?? message.id)}
            >
              ‹
            </button>
            <span>
              {t('branch')} {index + 1}/{siblings.length}
            </span>
            <button
              type="button"
              disabled={index >= siblings.length - 1}
              onClick={() =>
                index < siblings.length - 1 && void selectSibling(message.id, siblings[index + 1] ?? message.id)
              }
            >
              ›
            </button>
          </span>
        ) : null}
      </header>
      {message.status === 'refused' ? <p className="refused">{t('refused')}</p> : null}
      {message.blocks.map((block, blockIndex) => (
        <BlockView
          key={`${message.id}-${blockIndex}`}
          block={block}
          testId={message.role === 'assistant' && block.type === 'text' ? 'assistant-text' : undefined}
        />
      ))}
      {message.status === 'error' ? <p className="form-error">{message.errorMessage || t('error')}</p> : null}
      {message.status === 'aborted' ? <p className="hint">{t('stopped')}</p> : null}
      {message.role === 'assistant' && message.usage ? (
        <p className="usage" data-testid="usage-line">
          {message.usage.input_tokens} {t('input')} · {message.usage.output_tokens} {t('output')}
          {message.usage.output_tokens_details?.thinking_tokens
            ? ` · ${t('thinkingTokens')} ${message.usage.output_tokens_details.thinking_tokens}`
            : ''}
          {cost ? ` · ${formatCny(cost.totalCny)} ${t('cny')} · ${cost.peak ? t('peak') : t('offPeak')}` : ''}
        </p>
      ) : null}
      {message.role === 'assistant' && message.status !== 'streaming' && conversation.activeLeafId === message.id ? (
        <button type="button" className="ghost" data-testid="regenerate" disabled={streaming} onClick={() => void regenerate(message.id)}>
          {t('regenerate')}
        </button>
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

  return (
    <div className={`shell ${state.sidebarOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand">
          <Mark />
          <div>
            <strong>{t('product')}</strong>
            <small>{t('taglineSub')}</small>
          </div>
        </div>
        <button className="primary" data-testid="new-chat" type="button" onClick={() => void state.newChat()}>
          {t('newChat')}
        </button>
        <nav>
          {state.conversations.length === 0 ? <p className="hint">{t('noConversations')}</p> : null}
          {state.conversations.map((item) => (
            <ChatLink key={item.id} conversation={item} active={item.id === state.activeId} />
          ))}
        </nav>
        <div className="side-usage" data-testid="total-usage">
          <span>{t('allChats')}</span>
          <strong>
            {t('totalLine', {
              inTokens: state.totals.input_tokens + state.totals.cache_read_input_tokens,
              outTokens: state.totals.output_tokens,
              cny: formatCny(total.totalCny),
            })}
          </strong>
          {state.balance ? (
            <span data-testid="balance-side">
              {t('balance')} {state.balance.balance_infos[0]?.total_balance} {t('cny')}
            </span>
          ) : null}
        </div>
      </aside>
      <section className="stage">
        <header className="topbar">
          <button className="ghost menu" data-testid="menu" type="button" onClick={() => state.setSidebarOpen(!state.sidebarOpen)}>
            {t('menu')}
          </button>
          <h2>{conversation?.title || t('newChat')}</h2>
          {state.serverMode ? <span data-testid="server-mode">{t('serverChat')}</span> : null}
          {state.serverUser?.role === 'admin' ? (
            <button className="ghost" data-testid="open-admin" type="button" onClick={() => state.openAdmin(true)}>
              {t('adminTitle')}
            </button>
          ) : null}
          <button className="ghost" data-testid="settings-open" type="button" onClick={() => state.setSettingsOpen(true)}>
            {t('settings')}
          </button>
        </header>
        <div className="transcript" data-testid="message-list">
          {path.length === 0 ? <Empty /> : null}
          {path.map((message) =>
            conversation ? <MessageRow key={message.id} message={message} conversation={conversation} /> : null,
          )}
          <div ref={endRef} />
        </div>
        {conversation ? (
          <p className="chat-usage">
            {t('thisChat')} · {formatCny(chatUsage.totalCny)} {t('cny')} · {sumUsage(state.messages.map((message) => message.usage)).output_tokens}{' '}
            {t('tokens')}
          </p>
        ) : null}
        <Composer />
        <footer className="legal bar">
          <p>{t('disclaimer')}</p>
          <p>{t('riskFooter')}</p>
        </footer>
      </section>
      {state.sidebarOpen ? <button className="scrim" type="button" aria-label={t('close')} onClick={() => state.setSidebarOpen(false)} /> : null}
      {state.settingsOpen ? <Settings /> : null}
      {state.notice ? <ImportToast notice={state.notice} /> : null}
    </div>
  )
}

const ChatLink = ({ conversation, active }: { conversation: Conversation; active: boolean }) => {
  const t = useT()
  const openChat = useHarbor((state) => state.openChat)
  const rename = useHarbor((state) => state.rename)
  const removeChat = useHarbor((state) => state.removeChat)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  return (
    <div className={`chat-link ${active ? 'active' : ''}`}>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void rename(conversation.id, title)
            setEditing(false)
          }}
        >
          <input aria-label={t('renameTitle')} value={title} onChange={(event) => setTitle(event.target.value)} />
        </form>
      ) : (
        <button type="button" onClick={() => void openChat(conversation.id)}>
          {conversation.title || t('newChat')}
        </button>
      )}
      <span className="link-actions">
        <button type="button" onClick={() => setEditing(true)}>
          {t('rename')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('deleteConfirm'))) {
              void removeChat(conversation.id)
            }
          }}
        >
          {t('delete')}
        </button>
      </span>
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
    <div className="empty">
      <Mark />
      <h2>{t('emptyTitle')}</h2>
      <p>{t('emptyBody')}</p>
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
      <div className="composer-bar">
        <label>
          {t('model')}
          <select
            data-testid="model-select"
            value={prefs.model}
            onChange={(event) => void setPrefs({ model: event.target.value as HarborState['prefs']['model'] })}
          >
            <option value="deepseek-flash">{t('flash')} — {t('flashHint')}</option>
            <option value="deepseek-v4-pro">{t('pro')} — {t('proHint')}</option>
          </select>
        </label>
        <label>
          {t('effort')}
          <select
            data-testid="effort-select"
            value={prefs.effort}
            onChange={(event) => void setPrefs({ effort: event.target.value as HarborState['prefs']['effort'] })}
          >
            <option value="low">low</option>
            <option value="high">high</option>
            <option value="max">max</option>
          </select>
        </label>
        <button
          type="button"
          data-testid="toggle-thinking"
          className={prefs.thinking ? 'chip on' : 'chip'}
          onClick={() => void setPrefs({ thinking: !prefs.thinking })}
        >
          {t('thinking')}
        </button>
        <button
          type="button"
          data-testid="toggle-search"
          className={prefs.search ? 'chip on' : 'chip'}
          disabled={!flash}
          onClick={() => void setPrefs({ search: !prefs.search })}
        >
          {t('search')}
        </button>
        <button
          type="button"
          data-testid="toggle-read"
          className={prefs.readLink ? 'chip on' : 'chip'}
          disabled={!flash}
          onClick={() => void setPrefs({ readLink: !prefs.readLink })}
        >
          {t('readLink')}
        </button>
        <label className={`attach ${flash ? '' : 'off'}`}>
          {t('attach')}
          <input
            data-testid="file-input"
            type="file"
            disabled={!flash}
            onChange={(event) => {
              const list = event.target.files ? [...event.target.files] : []
              event.target.value = ''
              void addFiles(list)
            }}
          />
        </label>
        {streaming ? (
          <button className="primary stop" data-testid="stop" type="button" onClick={stop}>
            {t('stop')}
          </button>
        ) : (
          <button className="primary" data-testid="send" type="button" onClick={submit}>
            {t('send')}
          </button>
        )}
      </div>
      {!flash ? <p className="hint">{t('toolsFlashOnly')}</p> : <p className="hint">{t('filesExpire')}</p>}
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
          <h3>{t('balance')}</h3>
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
          {balanceError ? <p className="form-error">{t('balanceFailed')}</p> : null}
          <button type="button" data-testid="refresh-balance" onClick={() => void refreshBalance()}>
            {t('refresh')}
          </button>
        </section>
        <section>
          <h3>{t('usageTitle')}</h3>
          <p className="hint">{t('noUsageApi')}</p>
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
          <h3>{t('privacyTitle')}</h3>
          <p className="hint">{t('currentKey')}</p>
          <p className="hint">{t('importMergeNote')}</p>
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
