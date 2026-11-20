// fb1554 长回答 markdown 语料：按 DeepSeek Anthropic 兼容接口的形状，把正文在引用处切成多个 text block
// （被引用的那句单独一个 block，citations_delta 跟在它后面；下一句从「。」「：」开始）。
// 这是 blocks.ts presentBlocks「A lone 。 after citations is its own block」所针对的真实形状；既有 mock 全是单个 text block，从没覆盖过。
// expect 按官方语义写：所有 text block 先拼成一篇 markdown 再解析一次；角标聚合在所在段落/列表项末尾、标点之后（frozen dom-answer.html 三处 data-citation-group 都是这样）。
const ICON = (c: string) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="${c}"/></svg>`)
export const RESULTS = Array.from({ length: 36 }, (_, i) => ({ type: 'web_search_result', title: `来源 ${i + 1} 工行湖北分行原行长相关报道`, url: `https://site${i + 1}.example/p${i + 1}`, snippet: `摘要 ${i + 1}`, site_name: `站点${i + 1}`, site_icon: ICON(`hsl(${i * 37} 70% 45%)`), page_age: '2026-11-19T00:00:00Z', encrypted_content: 'x' }))
// 浏览 4 个页面：真实接口每页一对 server_tool_use(open_page) + web_fetch_tool_result（同 URL）
export const OPENED = [0, 4, 9, 20].map((n, k) => ({ url: RESULTS[n].url, title: k === 0 ? '出自唐代李白的《静夜思》 - 出自唐代李白的《静夜思》' : `页面标题 ${k + 1}` }))
export const TEXT_BLOCKS: { text: string; cite?: number }[] = [
  { text: '## 一、背景\n\n他在任期内推动了**「深度重构」与「纠偏」**两项改革，但外部环境影响了实际表现', cite: 4 },
  { text: '。因此，市场对他的评价出现分化。\n\n他的主要任职经历包括', cite: 1 },
  { text: '：\n\n- **第一阶段**：担任某行行长，负责零售业务转型', cite: 2 },
  { text: '。他于2025年底卸任。\n- **第二阶段**：转任集团顾问，主管**风险', cite: 6 },
  { text: '控制**与合规。\n\n| 项目 | 说明 |\n| --- | --- |\n| 任期 | 2019–2025 |\n| 职务 | 行长 |\n\n计算公式为 $E=mc^2$，代码示例：\n\n```python\nprint("hello")\n```\n\n1. 一级条目\n   - 嵌套二级条目\n\n## 二、总结\n\n总体来看，他的路径属于**稳健型**。' },
]
export const EXPECT = {
  proseRoots: 1, h2: 2, topLevelP: 4, li: 4, table: 1, tableRows: 3, pre: 1, katex: 1,
  strong: ['「深度重构」与「纠偏」', '第一阶段', '第二阶段', '风险控制', '稳健型'],
  cites: ['5', '2', '3', '7'],
  browseLinks: OPENED.length, foundPages: RESULTS.length,
}
const thinkText = '用户想了解此人的任职情况。需要搜索并打开几个页面核实。'
export const events = (req: any, { split = true }: { split?: boolean } = {}) => {
  const o: any[] = [{ type: 'message_start', message: { id: 'r', model: req?.model || 'deepseek-flash' } }]; let i = 0
  o.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } }, { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: thinkText } }, { type: 'content_block_stop', index: i++ })
  o.push({ type: 'content_block_start', index: i, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['王某 现任'] } } }, { type: 'content_block_stop', index: i++ })
  o.push({ type: 'content_block_start', index: i, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: RESULTS } }, { type: 'content_block_stop', index: i++ })
  OPENED.forEach((p, k: number) => {
    o.push({ type: 'content_block_start', index: i, content_block: { type: 'server_tool_use', id: 'f' + k, name: 'deepseek_web_fetch', input: { action: 'open_page', url: p.url } } }, { type: 'content_block_stop', index: i++ })
    o.push({ type: 'content_block_start', index: i, content_block: { type: 'web_fetch_tool_result', tool_use_id: 'f' + k, content: { type: 'web_fetch_result', url: p.url, content: { type: 'document', title: p.title, source: { type: 'text', media_type: 'text/plain', data: '' } }, published_at: null } } }, { type: 'content_block_stop', index: i++ })
  })
  const blocks: { text: string; cite?: number; cites?: number[] }[] = split ? TEXT_BLOCKS : [{ text: TEXT_BLOCKS.map((b) => b.text).join(''), cites: TEXT_BLOCKS.filter((b) => b.cite !== undefined).map((b) => b.cite as number) }]
  for (const b of blocks) {
    o.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: b.text } })
    for (const n of b.cites ?? (b.cite === undefined ? [] : [b.cite])) o.push({ type: 'content_block_delta', index: i, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: RESULTS[n].url, title: RESULTS[n].title, cited_text: '', encrypted_index: '' } } })
    o.push({ type: 'content_block_stop', index: i++ })
  }
  o.push({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '[筑衡测试] 长回答语料' }, usage: { input_tokens: 1, output_tokens: 1 } }, { type: 'message_stop' })
  return o
}
export const sse = (evs: any[]) => evs.map((e: any) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
