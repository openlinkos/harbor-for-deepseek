type KeyStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  key(index: number): string | null
  readonly length: number
}

const EXACT: Array<[string, string]> = [
  ['harbor-ui', 'deepapi-ui'],
  ['harbor-theme', 'deepapi-theme'],
  ['harbor-voice', 'deepapi-voice'],
  ['harbor-improve', 'deepapi-improve'],
  ['harbor-profile', 'deepapi-profile'],
]

const PREFIXES = ['harbor-vote:', 'harbor-feedback:']

const copy = (storage: KeyStore, from: string, to: string, value: string) => {
  if (storage.getItem(to) != null) return
  storage.setItem(to, from === 'harbor-ui' ? value.replaceAll('"format":"harbor-ui"', '"format":"deepapi-ui"') : value)
}

/** Read Harbor keys and write the DeepAPI keys when those are still empty. */
export const migrateStoredKeys = (storage: KeyStore) => {
  for (const [from, to] of EXACT) {
    const value = storage.getItem(from)
    if (value != null) copy(storage, from, to, value)
  }
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key) keys.push(key)
  }
  for (const key of keys) {
    if (!PREFIXES.some((prefix) => key.startsWith(prefix))) continue
    const value = storage.getItem(key)
    if (value == null) continue
    copy(storage, key, `deepapi-${key.slice('harbor-'.length)}`, value)
  }
}

export const migrateSessionMode = (storage: KeyStore) => {
  const value = storage.getItem('harbor-mode')
  if (value != null) copy(storage, 'harbor-mode', 'deepapi-mode', value)
}
