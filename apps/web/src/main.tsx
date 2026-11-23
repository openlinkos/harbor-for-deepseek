import '@fontsource/inter/400.css'
import '@fontsource/inter/400-italic.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/500-italic.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/600-italic.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/700-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { isNativeApp, listenForBack } from './native.js'
import { useHarbor } from './store.js'
import { migrateSessionMode, migrateStoredKeys } from './migrate.js'
import { applyTheme, readTheme } from './themeMode.js'

migrateStoredKeys(localStorage)
migrateSessionMode(sessionStorage)
import './theme.css'
import './styles.css'
import './spec-role-gallery.css'
import { mountSpecRoleGallery } from './spec-role-gallery.js'

applyTheme(readTheme())
// SP-GL-086
const setAppHeight = () => document.body.style.setProperty('--app-height', `${window.innerHeight}px`)
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (readTheme() === 'system') {
    applyTheme('system')
  }
})

const native = isNativeApp()
if (native) {
  useHarbor.setState({ native: true })
  void listenForBack(() => useHarbor.getState().dismissOverlay()).catch(() => undefined)
  void import('@capacitor/keyboard')
    .then(({ Keyboard, KeyboardResize }) => Keyboard.setResizeMode({ mode: KeyboardResize.Body }))
    .catch(() => undefined)
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Light }))
    .catch(() => undefined)
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
mountSpecRoleGallery()
