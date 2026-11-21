import { describe, expect, it } from 'vitest'
import { fileExtension, fileMetaText, formatFileSize } from './file-card.js'

describe('official file size', () => {
  it('matches the captured PDF 1.35KB and TXT 65B meta text', () => {
    expect(formatFileSize(65)).toBe('65B')
    expect(formatFileSize(1383)).toBe('1.35KB')
    expect(formatFileSize(1024)).toBe('1KB')
    expect(formatFileSize(0)).toBe('0B')
    expect(fileExtension('zhuheng-test.pdf')).toBe('PDF')
    expect(fileExtension('zhuheng-test.txt')).toBe('TXT')
    expect(fileMetaText('zhuheng-test.pdf', 1383)).toBe('PDF 1.35KB')
    expect(fileMetaText('zhuheng-test.txt', 65)).toBe('TXT 65B')
  })
})
