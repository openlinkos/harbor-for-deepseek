import { useEffect } from 'react'
import { useHarbor } from './store.js'
import { KeyGate, Shell } from './ui.js'

export const App = () => {
  const booted = useHarbor((state) => state.booted)
  const key = useHarbor((state) => state.key)
  const locked = useHarbor((state) => state.locked)
  const boot = useHarbor((state) => state.boot)
  useEffect(() => {
    void boot()
    if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.webdriver) {
      void navigator.serviceWorker.register('/sw.js')
    }
  }, [boot])
  if (!booted) {
    return <main className="gate" />
  }
  if (!key || locked) {
    return <KeyGate />
  }
  return <Shell />
}
