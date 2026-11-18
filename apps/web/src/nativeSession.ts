export type RemoteSession = { base: string; token: string; username: string }

const openStore = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('harbor-native', 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('kv')) {
        request.result.createObjectStore('kv')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

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
