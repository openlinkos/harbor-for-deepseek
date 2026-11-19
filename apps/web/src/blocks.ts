import type { ContentBlock, TextBlock } from '@deepapi/types'

const ONLY_PUNCT = /^[\s。．.!?！？…,，、；;：:]+$/u

const MARKER_LINE = /^[ \t]*[-*][ \t]*((?:〔\d+〕|\[\d+\]|\(\d+\))+)[ \t]*$/
const PUNCT_LINE = /^[ \t]*(?:[-*][ \t]*)?[。．.!?！？…]+[ \t]*$/

/** Drop list items that are only a citation marker or a stray full stop, and keep the marker on the previous line. */
export const tidyMarkdown = (value: string): string => {
  const kept: string[] = []
  for (const line of value.split('\n')) {
    const marker = MARKER_LINE.exec(line)
    if (marker?.[1] && kept.length) {
      kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[ \t]+$/, '')}${marker[1]}`
      continue
    }
    if (PUNCT_LINE.test(line)) {
      if (kept.length && !PUNCT_LINE.test(kept[kept.length - 1])) {
        kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[ \t]+$/, '')}${line.trim().replace(/^[-*]\s*/, '')}`
      }
      continue
    }
    kept.push(line)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n')
}

const tidyText = (value: string): string => {
  const match = /\n+[ \t]*([。．.!?！？…]+)[ \t]*$/u.exec(value)
  const mark = match?.[1]
  if (!match || !mark || match.index === undefined) {
    return value
  }
  const body = value.slice(0, match.index).trimEnd()
  return body.endsWith(mark) ? body : `${body}${mark}`
}

/** A lone "。" after citations is its own block or paragraph. Fold it back into the sentence. */
export const presentBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  const result: ContentBlock[] = []
  for (const block of blocks) {
    if (block.type !== 'text') {
      result.push(block)
      continue
    }
    const text = tidyText(block.text)
    const previous = result.at(-1)
    if (previous?.type === 'text' && ONLY_PUNCT.test(text) && text.trim()) {
      const merged: TextBlock = {
        ...previous,
        text: `${previous.text}${text.trim()}`,
        citations: [...(previous.citations ?? []), ...(block.citations ?? [])],
      }
      result[result.length - 1] = merged
      continue
    }
    const markdown = tidyMarkdown(text)
    if (!markdown.trim()) continue
    result.push(markdown === block.text ? block : { ...block, text: markdown })
  }
  return result
}
