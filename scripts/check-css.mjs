#!/usr/bin/env node
// fb1344: CSS well-formedness gate. ci.yml runs this before the build.
// Fails on declarations outside any rule and on selectors the browser would drop — the class of bug that left
// `.avatar` without font-weight/color and dropped `.user-row small` (styles.css since #29).
// Usage: node scripts/check-css.mjs apps/web/src/*.css
//
// A known exception is allowed only while it still fails. When that problem is gone, this script exits 1
// so the fix PR has to delete the exception (same rule as test.fail in the e2e gate).
//
// broad-descendant-button（没有例外列表，也不能用注释关掉）:
// 只报这一种选择器：逗号拆开后，主体是裸 button（类型是 button，没有类、没有 id、没有 :not；
// 属性或 :hover 不算收窄，因为 button.favicons 同样可以带 aria-expanded 和 :hover），
// 并且它紧左边是「只有类」的容器复合选择器，中间的组合符是后代空格，不是 > + ~。
// 还要真的漏得进去才报：同一份样式表里有独立的 `button.<类>`（没有再套一层容器，目前是 button.favicons / button.chip），
// 并且 apps/web/src 的 JSX 里，这个容器的子树（直接子节点不算；同一文件里的函数组件、以及全仓库唯一的组件名会展开）
// 嵌着带这个类的 <button>。`.code-head button` 这种本来就要选中里面的裸按钮、里面也没有 button.favicons，不报。
// a / svg / p 不在这条规则里。收窄方式：改成子组合符（`.thinking > button`），或给标题按钮加类。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const KNOWN_EXCEPTIONS = []

const require = createRequire(process.cwd() + '/')
const postcss = require(process.env.POSTCSS || 'postcss')
const norm = (p) => p.replaceAll('\\', '/')
const lineOfIndex = (src, index) => src.slice(0, index).split('\n').length
const ts = require('typescript')

const readBalanced = (raw, i, open, close) => {
  let depth = 0
  let quote = ''
  for (; i < raw.length; i++) {
    const c = raw[i]
    if (quote) {
      if (c === '\\') { i++; continue }
      if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") { quote = c; continue }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return raw.length
}

const splitSelectors = (selector) => {
  const parts = []
  let current = ''
  let depth = 0
  let quote = ''
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]
    if (quote) {
      current += c
      if (c === quote && selector[i - 1] !== '\\') quote = ''
      continue
    }
    if (c === '"' || c === "'") { quote = c; current += c; continue }
    if (c === '(' || c === '[') { depth++; current += c; continue }
    if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); current += c; continue }
    if (c === ',' && depth === 0) { parts.push(current); current = ''; continue }
    current += c
  }
  if (current.trim()) parts.push(current)
  return parts.map((s) => s.trim()).filter(Boolean)
}

const parseComplex = (sel) => {
  const items = []
  let i = 0
  while (i < sel.length) {
    while (i < sel.length && /\s/.test(sel[i])) i++
    if (i >= sel.length) break
    if (sel[i] === '>' || sel[i] === '+' || sel[i] === '~') {
      items.push({ kind: 'combinator', op: sel[i] })
      i++
      continue
    }
    const start = i
    let depth = 0
    let quote = ''
    while (i < sel.length) {
      const c = sel[i]
      if (quote) {
        if (c === '\\') { i += 2; continue }
        if (c === quote) quote = ''
        i++
        continue
      }
      if (c === '"' || c === "'") { quote = c; i++; continue }
      if (c === '(' || c === '[') { depth++; i++; continue }
      if ((c === ')' || c === ']') && depth > 0) { depth--; i++; continue }
      if (depth === 0 && (/\s/.test(c) || c === '>' || c === '+' || c === '~')) break
      i++
    }
    const raw = sel.slice(start, i).trim()
    if (!raw) continue
    if (items.length && items[items.length - 1].kind === 'compound') items.push({ kind: 'combinator', op: ' ' })
    items.push({ kind: 'compound', raw })
  }
  return items
}

const analyzeCompound = (raw) => {
  const classes = []
  let type = null
  let id = null
  let hasNot = false
  let hasAttr = false
  let i = 0
  while (i < raw.length) {
    const c = raw[i]
    if (c === '.') {
      const name = /^[\w-]+/.exec(raw.slice(i + 1))
      if (!name) { i++; continue }
      classes.push(name[0])
      i += 1 + name[0].length
      continue
    }
    if (c === '#') {
      const name = /^[\w-]+/.exec(raw.slice(i + 1))
      if (!name) { i++; continue }
      id = name[0]
      i += 1 + name[0].length
      continue
    }
    if (c === '[') { hasAttr = true; i = readBalanced(raw, i, '[', ']'); continue }
    if (c === ':') {
      const pseudo = c === ':' && raw[i + 1] === ':'
      i += pseudo ? 2 : 1
      const name = /^[\w-]+/.exec(raw.slice(i))
      const ident = name ? name[0] : ''
      i += ident.length
      if (raw[i] === '(') {
        if (!pseudo && ident === 'not') hasNot = true
        i = readBalanced(raw, i, '(', ')')
      }
      continue
    }
    if (/[a-zA-Z*]/.test(c)) {
      const name = /^[\w-]+/.exec(raw.slice(i))
      type = (name ? name[0] : '').toLowerCase()
      i += name ? name[0].length : 1
      continue
    }
    i++
  }
  return { type, classes, id, hasNot, hasAttr }
}

const portableButtonClasses = (root) => {
  const set = new Set()
  root.walkRules((rule) => {
    for (const sel of splitSelectors(rule.selector)) {
      const compounds = parseComplex(sel).filter((item) => item.kind === 'compound')
      if (compounds.length !== 1) continue
      const info = analyzeCompound(compounds[0].raw)
      if (info.type === 'button') for (const name of info.classes) set.add(name)
    }
  })
  return set
}

const tsxFiles = (dir, acc = []) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) tsxFiles(path, acc)
    else if (name.endsWith('.tsx')) acc.push(path)
  }
  return acc
}

const classTokens = (expr) => {
  if (!expr) return []
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text.split(/\s+/).filter(Boolean)
  if (ts.isTemplateExpression(expr)) {
    const bits = [expr.head.text]
    for (const span of expr.templateSpans) bits.push(span.literal.text)
    return bits.join(' ').split(/\s+/).filter((bit) => bit && !bit.includes('$'))
  }
  if (ts.isJsxExpression(expr)) return classTokens(expr.expression)
  if (ts.isParenthesizedExpression(expr)) return classTokens(expr.expression)
  if (ts.isConditionalExpression(expr)) return [...classTokens(expr.whenTrue), ...classTokens(expr.whenFalse)]
  if (ts.isBinaryExpression(expr)) return [...classTokens(expr.left), ...classTokens(expr.right)]
  if (ts.isArrayLiteralExpression(expr)) return expr.elements.flatMap((el) => classTokens(el))
  if (ts.isCallExpression(expr)) return expr.arguments.flatMap((arg) => classTokens(arg))
  return []
}

const jsxClassTokens = (opening) => {
  const attr = opening.attributes.properties.find((prop) => prop.name && ts.isIdentifier(prop.name) && prop.name.text === 'className')
  return attr && ts.isJsxAttribute(attr) ? classTokens(attr.initializer) : []
}

const tagNameOf = (opening) => ts.isIdentifier(opening.tagName) ? opening.tagName.text : null

const buildJsxIndex = (srcDir) => {
  const byFile = new Map()
  const byName = new Map()
  for (const path of tsxFiles(srcDir)) {
    const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const local = new Map()
    const visit = (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) local.set(node.name.text, node)
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        local.set(node.name.text, node.initializer)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    byFile.set(path, { sf, local })
    for (const name of local.keys()) {
      const hit = byName.get(name)
      if (!hit) byName.set(name, path)
      else if (hit !== path) byName.set(name, null)
    }
  }
  return { byFile, byName }
}

let jsxCache = null
const jsxIndex = (cssFile) => {
  if (jsxCache) return jsxCache
  const dir = dirname(cssFile)
  jsxCache = statSync(dir).isDirectory() ? buildJsxIndex(dir) : { byFile: new Map(), byName: new Map() }
  return jsxCache
}

const lookupFn = (index, file, name) => {
  const here = index.byFile.get(file)
  if (here?.local.get(name)) return { sf: here.sf, fn: here.local.get(name), file }
  const other = index.byName.get(name)
  if (!other) return null
  const there = index.byFile.get(other)
  const fn = there?.local.get(name)
  return fn ? { sf: there.sf, fn, file: other } : null
}

const nestedPortableButton = (index, file, containerClasses, portable) => {
  const found = []
  const see = (opening, direct) => {
    if (direct || tagNameOf(opening) !== 'button') return
    const hit = jsxClassTokens(opening).find((name) => portable.has(name))
    if (hit) found.push(hit)
  }
  const walkExpr = (expr, sf, fromFile, direct, stack) => {
    if (!expr || found.length) return
    if (ts.isParenthesizedExpression(expr)) return walkExpr(expr.expression, sf, fromFile, direct, stack)
    if (ts.isConditionalExpression(expr) || (ts.isBinaryExpression(expr) && (expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || expr.operatorToken.kind === ts.SyntaxKind.BarBarToken || expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))) {
      walkExpr(expr.left ?? expr.whenTrue, sf, fromFile, direct, stack)
      walkExpr(expr.right ?? expr.whenFalse, sf, fromFile, direct, stack)
      return
    }
    if (ts.isCallExpression(expr)) {
      const callee = expr.expression
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'map' && expr.arguments[0]) {
        const arg = expr.arguments[0]
        if (ts.isIdentifier(arg)) return expand(arg.text, fromFile, direct, stack)
        if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) return walkFn(arg, sf, fromFile, direct, stack)
      }
      if (ts.isIdentifier(callee)) return expand(callee.text, fromFile, direct, stack)
      return
    }
    if (ts.isIdentifier(expr)) return expand(expr.text, fromFile, direct, stack)
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) walkSlot(expr, sf, fromFile, direct, stack)
  }
  const walkSlot = (node, sf, fromFile, direct, stack) => {
    if (found.length) return
    if (ts.isJsxText(node)) return
    if (ts.isJsxExpression(node)) return walkExpr(node.expression, sf, fromFile, direct, stack)
    if (ts.isJsxFragment(node)) {
      for (const child of node.children) walkSlot(child, sf, fromFile, direct, stack)
      return
    }
    if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return
    const opening = ts.isJsxElement(node) ? node.openingElement : node
    const name = tagNameOf(opening)
    see(opening, direct)
    if (name && /^[A-Z]/.test(name)) expand(name, fromFile, direct, stack)
    if (ts.isJsxElement(node)) for (const child of node.children) walkSlot(child, sf, fromFile, false, stack)
  }
  const walkFn = (fn, sf, fromFile, direct, stack) => {
    if (found.length || stack.has(fn)) return
    stack.add(fn)
    const body = fn.body
    if (body && ts.isBlock(body)) {
      const visit = (node) => {
        if (found.length) return
        if (ts.isReturnStatement(node)) {
          if (node.expression) walkExpr(node.expression, sf, fromFile, direct, stack)
          return
        }
        if (ts.isFunctionLike(node) || ts.isClassLike(node)) return
        ts.forEachChild(node, visit)
      }
      visit(body)
    } else if (body) walkExpr(body, sf, fromFile, direct, stack)
    stack.delete(fn)
  }
  const expand = (name, fromFile, direct, stack) => {
    const hit = lookupFn(index, fromFile, name)
    if (hit) walkFn(hit.fn, hit.sf, hit.file, direct, stack)
  }
  for (const { sf } of index.byFile.values()) {
    const visit = (node) => {
      if (found.length) return
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = ts.isJsxElement(node) ? node.openingElement : node
        const tokens = jsxClassTokens(opening)
        if (containerClasses.every((name) => tokens.includes(name)) && ts.isJsxElement(node)) {
          for (const child of node.children) walkSlot(child, sf, sf.fileName, true, new Set())
        }
      }
      if (!found.length) ts.forEachChild(node, visit)
    }
    visit(sf)
    if (found.length) break
  }
  return found[0] ?? null
}

const broadButtonProblems = (file, root) => {
  const portable = portableButtonClasses(root)
  if (!portable.size) return []
  const index = jsxIndex(file)
  const problems = []
  root.walkRules((rule) => {
    for (const sel of splitSelectors(rule.selector)) {
      const items = parseComplex(sel)
      if (items.length < 3) continue
      const subject = items[items.length - 1]
      const comb = items[items.length - 2]
      const container = items[items.length - 3]
      if (subject.kind !== 'compound' || comb.kind !== 'combinator' || comb.op !== ' ' || container.kind !== 'compound') continue
      const sub = analyzeCompound(subject.raw)
      const box = analyzeCompound(container.raw)
      if (sub.type !== 'button' || sub.classes.length || sub.id || sub.hasNot) continue
      if (box.type || box.id || box.hasAttr || box.hasNot || !box.classes.length) continue
      const leaked = nestedPortableButton(index, file, box.classes, portable)
      if (!leaked) continue
      const shown = sel.replace(/\s+/g, ' ')
      problems.push({
        line: rule.source?.start?.line ?? 0,
        message: `${file}:${rule.source?.start?.line ?? '?'} 宽泛后代选择器 \`${shown}\` 会套到 \`.${box.classes.join('.')}\` 里面的 \`button.${leaked}\`。范围：容器只有类、用后代组合符接裸 button（无类、无 id、无 :not），并且 JSX 子树里嵌着带独立 button.<类> 的按钮。子组合符和写了类的 button 不报，a/svg/p 不在这条规则里，没有例外。收窄成 \`.${box.classes.join('.')} > button\`，或给标题按钮加类。`,
      })
    }
  })
  return problems
}

const parseProblems = (file, src) => {
  try {
    const root = postcss.parse(src, { from: file })
    const problems = []
    problems.push(...broadButtonProblems(file, root))
    root.walk((n) => {
      if (n.type === 'decl' && (n.parent.type === 'root' || (n.parent.type === 'atrule' && /^(media|supports|layer|container)$/.test(n.parent.name)))) {
        problems.push({ line: n.source.start.line, message: `${file}:${n.source.start.line} declaration outside a rule: ${n.prop}: ${n.value}` })
      }
      if (n.type === 'rule' && /[;{}]|^\s*[a-z-]+\s*:\s*[^:]+;/i.test(n.selector)) {
        problems.push({ line: n.source.start.line, message: `${file}:${n.source.start.line} invalid selector (browser drops the rule): ${n.selector.slice(0, 80).replace(/\n/g, ' ')}` })
      }
    })
    return problems
  } catch (e) {
    const line = e.line || 0
    return [{ line, parse: true, message: `${file}:${line || '?'} parse error ${e.reason || e.message}` }]
  }
}

let bad = 0
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  const located = []
  for (const ex of KNOWN_EXCEPTIONS.filter((ex) => norm(file).endsWith(ex.file))) {
    const at = src.indexOf(ex.snippet)
    if (at < 0) {
      console.error(`${ex.id}: 例外不再发生（${ex.file} 已没有 styles.css:587-591 那段游离声明）。删掉 scripts/check-css.mjs 里的 ${ex.id}。`)
      bad++
      continue
    }
    if (src.indexOf(ex.snippet, at + 1) >= 0) {
      console.error(`${ex.id}: 例外片段在 ${file} 里出现了多次，拒绝放行`)
      bad++
      continue
    }
    const start = lineOfIndex(src, at)
    located.push({ ex, at, start, end: start + ex.snippet.split('\n').length - 1 })
  }

  const problems = parseProblems(file, src)
  const covered = new Set()
  const uncovered = []
  for (const p of problems) {
    const hit = located.find((r) => p.line >= r.start && p.line <= r.end)
    if (hit) covered.add(hit.ex.id)
    else uncovered.push(p)
  }
  // The known `}` is a parse error, so postcss stops and would hide any other problem in this file.
  // Blank the exception and parse again. Line numbers stay put because the replacement is the same height.
  if (problems.some((p) => p.parse && located.some((r) => p.line >= r.start && p.line <= r.end))) {
    let excised = src
    for (const r of [...located].sort((a, b) => b.at - a.at)) {
      excised = excised.slice(0, r.at) + r.ex.snippet.split('\n').map(() => '').join('\n') + excised.slice(r.at + r.ex.snippet.length)
    }
    for (const p of parseProblems(file, excised)) {
      if (!located.some((r) => p.line >= r.start && p.line <= r.end)) uncovered.push(p)
    }
  }

  for (const r of located) {
    if (covered.has(r.ex.id)) console.log(`${r.ex.id}: 已知例外仍在 ${file}:${r.start}-${r.end}，放行。修好后删掉这条。`)
    else {
      console.error(`${r.ex.id}: 例外不再发生（${file}:${r.start}-${r.end} 已不再报游离声明或解析错误）。删掉 scripts/check-css.mjs 里的 ${r.ex.id}。`)
      bad++
    }
  }
  for (const p of uncovered) {
    console.error(p.message)
    bad++
  }
}
if (bad) {
  console.error(`check-css: ${bad} problem(s)`)
  process.exit(1)
}
console.log('check-css ok')
