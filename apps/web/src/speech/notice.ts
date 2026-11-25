import { create } from 'zustand'

type SpeechNoticeState = {
  notice: { text: string; id: number } | null
  show: (text: string) => void
  clear: () => void
}

let noticeId = 0

export const useSpeechNotice = create<SpeechNoticeState>((set) => ({
  notice: null,
  show: (text) => {
    noticeId += 1
    set({ notice: { text, id: noticeId } })
  },
  clear: () => set({ notice: null }),
}))
