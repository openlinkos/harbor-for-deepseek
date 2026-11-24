import { useEffect } from 'react'
import { AdminScreen, ServerLogin, SetupWizard } from './hosted.js'
import { useHarbor } from './store.js'
import { BootSkeleton, KeyGate, Shell } from './ui.js'

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
  const locale = useHarbor((state) => state.settings.locale)
  useEffect(() => {
    // SP-GL-013/014: official body class is the locale id. zh and en map to zh_CN and en_US.
    document.body.classList.remove('zh_CN', 'en_US')
    document.body.classList.add(locale === 'en' ? 'en_US' : 'zh_CN')
  }, [locale])
  useEffect(() => {
    void boot()
    if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.webdriver) {
      void navigator.serviceWorker.register('/sw.js')
    }
  }, [boot])
  if (!booted) {
    return <BootSkeleton />
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
