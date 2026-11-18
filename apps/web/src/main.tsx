import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { applyTheme, readTheme } from './themeMode.js'
import './theme.css'
import './styles.css'

applyTheme(readTheme())
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (readTheme() === 'system') {
    applyTheme('system')
  }
})

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
