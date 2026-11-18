import { translate } from '@harbor/i18n'
import { useEffect, useState } from 'react'
import { api } from './remote.js'
import { useHarbor } from './store.js'

const useT = () => {
  const locale = useHarbor((state) => state.settings.locale)
  return (key: Parameters<typeof translate>[1]) => translate(locale, key)
}

export const SetupWizard = () => {
  const t = useT()
  const setupAdmin = useHarbor((state) => state.setupAdmin)
  const enterLocalMode = useHarbor((state) => state.enterLocalMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return (
    <main className="gate">
      <form
        className="gate-card"
        data-testid="setup-wizard"
        onSubmit={(event) => {
          event.preventDefault()
          void setupAdmin(username, password).catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
        }}
      >
        <p className="eyebrow">Harbor</p>
        <h1>{t('setupTitle')}</h1>
        <p className="risk">{t('setupBody')}</p>
        <label>
          {t('setupUser')}
          <input data-testid="setup-username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          {t('setupPassword')}
          <input data-testid="setup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary" data-testid="setup-submit" type="submit">
          {t('setupSubmit')}
        </button>
        <button className="ghost" type="button" onClick={() => enterLocalMode().then(() => useHarbor.setState({ setupRequired: false }))}>
          {t('useLocal')}
        </button>
        <footer className="legal">
          <p>{t('disclaimer')}</p>
        </footer>
      </form>
    </main>
  )
}

export const ServerLogin = () => {
  const t = useT()
  const loginServer = useHarbor((state) => state.loginServer)
  const registerServer = useHarbor((state) => state.registerServer)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <main className="gate">
      <div className="gate-card" data-testid="server-login">
        <h1>{t('loginTitle')}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void loginServer(username, password).catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
          }}
        >
          <label>
            {t('loginUser')}
            <input data-testid="login-username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            {t('loginPassword')}
            <input data-testid="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary" data-testid="login-submit" type="submit">
            {t('loginSubmit')}
          </button>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void registerServer(code, username, password).catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
          }}
        >
          <h2>{t('registerTitle')}</h2>
          <label>
            {t('registerCode')}
            <input data-testid="register-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          <button className="ghost" data-testid="register-submit" type="submit">
            {t('registerSubmit')}
          </button>
        </form>
        <footer className="legal">
          <p>{t('disclaimer')}</p>
        </footer>
      </div>
    </main>
  )
}

type KeyInfo = { id: string; label: string; last4: string; balanceCny: string | null; status: string; accountGroup: string }
type AlertInfo = { id: string; message: string }
type UserInfo = { id: string; username: string; role: string; status: string; tokenQuota: number; searchQuota: number; pageQuota: number }
type UsageRow = {
  userId: string
  username: string
  day: string
  apiKeyId: string
  keyLabel: string
  last4: string
  inputTokens: number
  outputTokens: number
  estimatedCny: string
}

export const AdminScreen = () => {
  const t = useT()
  const openAdmin = useHarbor((state) => state.openAdmin)
  const [keys, setKeys] = useState<KeyInfo[]>([])
  const [alerts, setAlerts] = useState<AlertInfo[]>([])
  const [users, setUsers] = useState<UserInfo[]>([])
  const [label, setLabel] = useState('primary')
  const [secret, setSecret] = useState('')
  const [accountGroup, setAccountGroup] = useState('')
  const [invite, setInvite] = useState('')
const [threshold, setThreshold] = useState('50')
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [origins, setOrigins] = useState('')
  const [error, setError] = useState('')

  const statusLabel = (status: string) => {
    if (status === 'active') return t('statusActive')
    if (status === 'exhausted') return t('statusExhausted')
    if (status === 'error') return t('statusError')
    if (status === 'disabled') return t('statusDisabled')
    return status
  }

  const reload = async () => {
    const keyBody = await api<{ keys: KeyInfo[] }>('/api/admin/keys')
    const alertBody = await api<{ alerts: AlertInfo[] }>('/api/admin/alerts')
    const userBody = await api<{ users: UserInfo[] }>('/api/admin/users')
const settingsBody = await api<{ lowBalanceCny: number }>('/api/admin/settings')
    const usageBody = await api<{ daily: UsageRow[] }>('/api/admin/usage')
    const corsBody = await api<{ origins: string[] }>('/api/admin/cors')
    setKeys(keyBody.keys)
    setAlerts(alertBody.alerts)
    setUsers(userBody.users)
    setThreshold(String(settingsBody.lowBalanceCny))
    setUsage(usageBody.daily)
    setOrigins(corsBody.origins.join('\n'))
  }

  useEffect(() => {
    void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
  }, [])

  return (
    <main className="gate">
      <div className="gate-card admin-card" data-testid="admin">
        <header className="topbar">
          <h1>{t('adminTitle')}</h1>
          <button className="ghost" type="button" onClick={() => openAdmin(false)}>
            {t('close')}
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void api('/api/admin/keys', {
              method: 'POST',
              body: JSON.stringify({ label, secret, accountGroup: accountGroup || undefined }),
            })
              .then(() => {
                setSecret('')
                return reload()
              })
              .catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
          }}
        >
          <h2>{t('addKey')}</h2>
          <label>
            {t('keyLabel')}
            <input data-testid="admin-key-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            {t('keySecret')}
            <input data-testid="admin-key-secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} />
          </label>
          <label>
            {t('accountGroup')}
            <input data-testid="admin-account-group" value={accountGroup} onChange={(event) => setAccountGroup(event.target.value)} />
          </label>
          <button className="primary" data-testid="admin-key-save" type="submit">
            {t('addKey')}
          </button>
        </form>
        <ul className="key-list" data-testid="admin-key-list">
          {keys.map((key) => (
            <li className="key-row" key={key.id}>
              <strong>{key.label}</strong>
              <span>····{key.last4}</span>
              <span>
                {t('keyBalance')} {key.balanceCny ?? '—'}
              </span>
              <span>{statusLabel(key.status)}</span>
              <span>{key.accountGroup}</span>
            </li>
          ))}
        </ul>
        <h2>{t('alerts')}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void api('/api/admin/settings', {
              method: 'PATCH',
              body: JSON.stringify({ lowBalanceCny: Number(threshold) }),
            })
              .then(() => reload())
              .catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
          }}
        >
          <label>
            {t('alertThreshold')}
            <input
              data-testid="alert-threshold"
              type="number"
              min={0}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </label>
          <button type="submit">{t('save')}</button>
        </form>
        <ul data-testid="admin-alerts">
          {alerts.map((alert) => (
            <li key={alert.id}>{alert.message}</li>
          ))}
        </ul>
        <button
          className="ghost"
          type="button"
          data-testid="admin-invite"
          onClick={() => {
            void api<{ code: string }>('/api/admin/invites', { method: 'POST', body: JSON.stringify({ maxUses: 5 }) }).then((result) =>
              setInvite(result.code),
            )
          }}
        >
          {t('inviteCreate')}
        </button>
        {invite ? <p data-testid="invite-code">{invite}</p> : null}
<h2>{t('usageLedger')}</h2>
        <table className="ledger" data-testid="admin-usage">
          <thead>
            <tr>
              <th>{t('usageDay')}</th>
              <th>{t('usageUser')}</th>
              <th>{t('usageKey')}</th>
              <th>{t('input')}</th>
              <th>{t('output')}</th>
              <th>{t('estimated')}</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((row) => (
              <tr key={`${row.day}-${row.userId}-${row.apiKeyId}`}>
                <td>{row.day}</td>
                <td>{row.username}</td>
                <td>{row.keyLabel ? `${row.keyLabel} ····${row.last4}` : '—'}</td>
                <td>{row.inputTokens}</td>
                <td>{row.outputTokens}</td>
                <td>{row.estimatedCny}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>{t('corsOrigins')}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const next = origins.split('\n').map((item) => item.trim()).filter(Boolean)
            void api('/api/admin/cors', { method: 'PATCH', body: JSON.stringify({ origins: next }) })
              .then(() => reload())
              .catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))
          }}
        >
          <textarea data-testid="cors-origins" rows={4} value={origins} onChange={(event) => setOrigins(event.target.value)} />
          <button type="submit">{t('corsSave')}</button>
        </form>
        <h2>{t('quotaHeading')}</h2>
        {users.map((user) => (
          <form
            key={user.id}
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              void api(`/api/admin/users/${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  tokenQuota: Number(data.get('tokens')),
                  searchQuota: Number(data.get('searches')),
                  pageQuota: Number(data.get('pages')),
                }),
              }).then(() => reload())
            }}
          >
            <strong>{user.username}</strong> ({user.role} · {statusLabel(user.status)})
            <label>
              {t('quotaTokens')}
              <input name="tokens" defaultValue={user.tokenQuota} />
            </label>
            <label>
              {t('quotaSearches')}
              <input name="searches" defaultValue={user.searchQuota} />
            </label>
            <label>
              {t('quotaPages')}
              <input name="pages" defaultValue={user.pageQuota} />
            </label>
            <button type="submit">{t('quotaSave')}</button>
          </form>
        ))}
        {error ? <p className="form-error">{error}</p> : null}
        <footer className="legal">
          <p>{t('disclaimer')}</p>
        </footer>
      </div>
    </main>
  )
}
