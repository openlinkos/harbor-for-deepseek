import type { ContentBlock, TextBlock, TextCitation } from '@deepapi/types'

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

const SENTENCE_END = /[。！？.!?]/u

const isSentenceEnd = (char: string) => SENTENCE_END.test(char)

/** Move `at` to the end of its sentence, including the closing punctuation. */
const sentenceEnd = (text: string, at: number): number => {
  const cursor = Math.max(0, Math.min(at, text.length))
  if (cursor > 0 && isSentenceEnd(text[cursor - 1] ?? '')) return cursor
  const rest = text.slice(cursor)
  let index = 0
  while (index < rest.length && rest[index] !== '\n' && !isSentenceEnd(rest[index] ?? '')) index += 1
  if (index < rest.length && isSentenceEnd(rest[index] ?? '')) return cursor + index + 1
  if (index < rest.length && rest[index] === '\n') return cursor + index
  return text.length
}

const citationAt = (text: string, citation: TextCitation): number => {
  if (typeof citation.at === 'number' && Number.isFinite(citation.at)) return sentenceEnd(text, citation.at)
  const needle = citation.cited_text.trim()
  if (needle) {
    const found = text.indexOf(needle)
    if (found >= 0) return sentenceEnd(text, found + needle.length)
  }
  return text.length
}

/**
 * Search answers ship plain text. Insert 〔n〕 at the end of the sentence that
 * was current when the citation arrived. n is that URL's 1-based index in this
 * message's search results, the same number chat.deepseek.com prints.
 */
export const markSearchCitations = (
  text: string,
  citations: TextCitation[] | undefined,
  sources: { url: string; title: string; site: string }[],
): { text: string; citations: TextCitation[]; sites: string[] } => {
  if (!citations?.length || sources.length === 0) {
    return { text, citations: citations ?? [], sites: [] }
  }
  const aligned: TextCitation[] = []
  const sites: string[] = []
  const inserts: { at: number; n: number }[] = []
  for (const citation of citations) {
    const index = sources.findIndex((item) => item.url === citation.url)
    if (index < 0) continue
    const source = sources[index]
    if (!source) continue
    aligned[index] = { ...citation, title: source.title || citation.title }
    sites[index] = source.site
    inserts.push({ at: citationAt(text, citation), n: index + 1 })
  }
  inserts.sort((a, b) => a.at - b.at || a.n - b.n)
  const unique: { at: number; n: number }[] = []
  for (const insert of inserts) {
    const previous = unique.at(-1)
    if (previous && previous.at === insert.at && previous.n === insert.n) continue
    unique.push(insert)
  }
  let marked = text
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const insert = unique[index]
    if (!insert) continue
    marked = `${marked.slice(0, insert.at)}〔${insert.n}〕${marked.slice(insert.at)}`
  }
  return { text: marked, citations: aligned, sites }
}
