import { describe, expect, it } from 'vitest'
import { presentBlocks } from './blocks.js'

describe('presentBlocks', () => {
  it('folds a stray full stop into the previous sentence', () => {
    const blocks = presentBlocks([
      { type: 'text', text: '上海今天多云', citations: [{ type: 'web_search_result_location', url: 'https://example.com', title: '天气', cited_text: '多云', encrypted_index: '' }] },
      { type: 'text', text: '。' },
      { type: 'text', text: '明天也是。\n\n。' },
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'text', text: '上海今天多云。' })
    expect(blocks[1]).toMatchObject({ type: 'text', text: '明天也是。' })
  })
})
