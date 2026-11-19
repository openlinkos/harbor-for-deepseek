export type LocalProfile = { nickname: string; initial: string }

const KEY = 'deepapi-profile'
const empty = (): LocalProfile => ({ nickname: '', initial: '' })

export const readProfile = (): LocalProfile => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return empty()
    }
    const parsed = JSON.parse(raw) as Partial<LocalProfile>
    return {
      nickname: String(parsed.nickname ?? '').trim().slice(0, 32),
      initial: String(parsed.initial ?? '').trim().slice(0, 2),
    }
  } catch {
    return empty()
  }
}

export const saveProfile = (profile: LocalProfile) => {
  localStorage.setItem(
    KEY,
    JSON.stringify({ nickname: profile.nickname.trim().slice(0, 32), initial: profile.initial.trim().slice(0, 2) }),
  )
  window.dispatchEvent(new Event('deepapi-profile'))
}
