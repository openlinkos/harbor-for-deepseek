import { useEffect } from 'react'
import { AdminScreen, ServerLogin, SetupWizard } from './hosted.js'
import { useHarbor } from './store.js'
import { KeyGate, Shell } from './ui.js'

export const App = () => {
  const booted = useHarbor((state) => state.booted)
  const key = useHarbor((state) => state.key)
  const locked = useHarbor((state) => state.locked)
  const boot = useHarbor((state) => state.boot)
  const setupRequired = useHarbor((state) => state.setupRequired)
  const showLogin = useHarbor((state) => state.showLogin)
  const showAdmin = useHarbor((state) => state.showAdmin)
  const serverUser = useHarbor((state) => state.serverUser)
  const serverMode = useHarbor((state) => state.serverMode)
  useEffect(() => {
    void boot()
    if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.webdriver) {
      void navigator.serviceWorker.register('/sw.js')
    }
  }, [boot])
  if (!booted) {
    return <main className="gate" />
  }
  if (setupRequired) {
    return <SetupWizard />
  }
  if (showLogin && !serverMode) {
    return <ServerLogin />
  }
  if (showAdmin && serverUser?.role === 'admin') {
    return <AdminScreen />
  }
  if (serverMode && serverUser) {
    return <Shell />
  }
  if (!key || locked) {
    return <KeyGate />
  }
  return <Shell />
}
