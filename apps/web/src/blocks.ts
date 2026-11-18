import type { ContentBlock, TextBlock } from '@harbor/types'

const ONLY_PUNCT = /^[\s。．.!?！？…,，、；;：:]+$/u

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
    result.push(text === block.text ? block : { ...block, text })
  }
  return result
}
