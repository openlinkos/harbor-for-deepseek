export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'deepapi-theme'

export const readTheme = (): ThemeChoice => {
  const stored = localStorage.getItem(KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export const applyTheme = (choice: ThemeChoice) => {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  // SP-GL-001/002: change-theme suppresses transitions for one frame, then light/dark classes follow the attribute.
  document.body.classList.add('change-theme')
  document.body.classList.toggle('dark', dark)
  document.body.classList.toggle('light', !dark)
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  document.documentElement.dataset.theme = choice
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#151517' : '#ffffff')
  window.setTimeout(() => document.body.classList.remove('change-theme'), 0)
}

export const saveTheme = (choice: ThemeChoice) => {
  localStorage.setItem(KEY, choice)
  applyTheme(choice)
  window.dispatchEvent(new Event('deepapi-theme'))
}
