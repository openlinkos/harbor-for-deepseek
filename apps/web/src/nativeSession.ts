export type RemoteSession = { base: string; token: string; username: string }

const DB = 'deepapi-native'
const LEGACY = 'harbor-native'

const named = async () => {
  if (typeof indexedDB.databases !== 'function') return [] as string[]
  const rows = await indexedDB.databases()
  return rows.map((row) => row.name).filter((name): name is string => Boolean(name))
}

const openNamed = (name: string) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const openStore = async () => {
  const names = await named()
  if (names.includes(LEGACY) && !names.includes(DB)) {
    const source = await openNamed(LEGACY)
    const target = await openNamed(DB)
    if (!source.objectStoreNames.contains('kv') || !target.objectStoreNames.contains('kv')) {
      source.close()
      target.close()
      return openNamed(DB)
    }
    const value = await new Promise<RemoteSession | undefined>((resolve, reject) => {
      const request = source.transaction('kv').objectStore('kv').get('remote')
      request.onsuccess = () => resolve(request.result as RemoteSession | undefined)
      request.onerror = () => reject(request.error)
    })
    if (value) {
      await new Promise<void>((resolve, reject) => {
        const request = target.transaction('kv', 'readwrite').objectStore('kv').put(value, 'remote')
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
    source.close()
    target.close()
  }
  return openNamed(DB)
}

export const readRemoteSession = async (): Promise<RemoteSession | null> => {
  const db = await openStore()
  const value = await new Promise<RemoteSession | null>((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly')
    const request = tx.objectStore('kv').get('remote')
    request.onsuccess = () => resolve((request.result as RemoteSession | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

export const writeRemoteSession = async (session: RemoteSession | null) => {
  const db = await openStore()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite')
    const store = tx.objectStore('kv')
    const request = session ? store.put(session, 'remote') : store.delete('remote')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}
