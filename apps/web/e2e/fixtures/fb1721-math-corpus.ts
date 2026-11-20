// fb1721 math + markdown corpus. Same text is sent as answer body (text block) and as thinking (thinking block).
// Expected counts follow the OFFICIAL parser (default-vendors.a63ee0213e.js module 6755: micromark math with
// flow `$$` + `\[…\]` (mathTexFlow) and text `$…$` (singleDollarTextMath) + `\(…\)` / `\[…\]` (mathTexText);
// a closing single `$` followed by a digit is rejected → "$5 和 $10" stays text). KaTeX renderToString
// {throwOnError:true, strict:false, displayMode:!inline} into <span class="katex-display ds-markdown-math"><span class="katex">.
export const MATH = [
  '我们要找出所有满足 \\( n \\leq 100 \\) 的质数。',
  '',
  '只需检验到 \\(\\sqrt{100}=10\\)，因为',
  '\\[',
  '11^2=121>100',
  '\\]',
  '',
  '行内美元 $a^2+b^2=c^2$，块美元：',
  '',
  '$$',
  '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
  '$$',
  '',
  '\\[ x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} \\]',
  '',
  '最终答案：',
  '',
  '\\[',
  '\\boxed{',
  '\\begin{aligned}',
  '&2,\\ 3,\\ 5,\\ 7,\\ 11,\\ 13,\\ 17,\\ 19,\\ 23,\\ 29,\\\\',
  '&31,\\ 37,\\ 41,\\ 43,\\ 47,\\ 53,\\ 59,\\ 61,\\ 67,\\ 71,\\\\',
  '&73,\\ 79,\\ 83,\\ 89,\\ 97',
  '\\end{aligned}',
  '}',
  '\\]',
  '',
  '价格 $5 和 $10 不是公式。',
  '',
  '1. 偶数质数只有 \\(2\\)',
  '2. 共有 $25$ 个',
].join('\n')
export const MATH_EXPECT = { inline: 5, display: 4, literalMustStay: ['$5 和 $10'], literalForbidden: ['\\boxed', '\\begin', '\\leq', '\\sqrt', '\\frac', '\\sum', '\\(', '\\)', '\\[', '\\]', '[ \\', '$$', '11^2', 'aligned'] }
// markdown blocks whose spacing differs between answer body and thinking (frozen main.dc093a796f.css)
export const LISTS = [
  '先分析题意。',
  '',
  '需要考虑：',
  '- 质数定义',
  '- 检验范围',
  '  - 只需到 10',
  '',
  '步骤：',
  '1. 列出 2 到 100',
  '2. 筛去倍数',
  '',
  '结论段落。',
].join('\n')
