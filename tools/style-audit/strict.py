#!/usr/bin/env python3
"""DeepAPI strict parity checker. Usage: python3 strict.py [--caps caps] [--official DIR] [--out results]
Compares ours captures (capture2.js via harness.mjs) with official captures. Every check reports
missing AND extra; uncovered states/themes are failures, not 'not scored'."""
import json, os, re, sys, glob, collections, argparse

ap = argparse.ArgumentParser()
ap.add_argument('--caps', default='caps')
ap.add_argument('--official', default='/cursor/stores/store-51264720-55bc-4966-bda5-dac74fff6f5c/hfd-ref/style-official')
ap.add_argument('--out', default='results')
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)

# ---------- state pairing (ours state -> official reference). None = no official capture yet (coverage FAIL)
PAIRS = {
  'landing': ('live', 'official-landing-light'),          # www.deepseek.com logged-out landing, captured live
  'key-gate': ('harbor-only', None),                       # necessary for API-key use; checked by rules only
  'home-no-history': (None, 'home-no-history'),
  'home-with-history': ('store', 'home-with-history'),
  'after-new-chat-focus': ('store', 'home-with-history'),
  'answer': ('store', 'answer'),
  'answer-essay': ('store', 'answer'),
  'two-turns': ('store', 'answer'),
  'user-menu': ('store', 'user-menu'),
  'settings-general': ('store', 'settings-general'),
  'settings-account': ('store', 'settings-account'),
  'settings-data': ('store', 'settings-data'),
  'settings-terms': ('store', 'settings-terms'),
  'multi-select': (None, 'multi-select'),
  'sidebar-item-menu': ('store', 'sidebar-item-menu'),
  'search-dialog': ('store', 'search-dialog'),
  'mobile-drawer': ('store', 'mobile-drawer'),
}
# ---------- product rules (owner decisions) -------------------------------------------------
NOT_APPLICABLE = ['手机号码', '微信', '未成年人模式', '登录设备管理', '登出所有设备', '注销账号', '未绑定', '绑定']   # account-bound official features: must be removed
HARBOR_ONLY_COPY = ['本地模式', '密钥与对话仅保存在本设备', '对话留在本机', '密钥只留在本机', '数据留在本机', '本机', 'OpenLinkOS 发起的开源项目',
                    '从本机移除 Key', '下载应用', '服务器模式', '思考、搜索和文件直接走']
ALLOWED_HARBOR = {'key-gate'}  # API-key entry is required for the product
BRAND = [('DeepAPI', 'BRAND'), ('deepapi', 'BRAND'), ('DeepSeek', 'BRAND'), ('deepseek', 'BRAND')]
OFFICIAL_BODY = {'-webkit-font-smoothing': 'antialiased'}   # from official main.dc093a796f.css body rule
UA_BUTTON_BG = {'rgb(239, 239, 239)', 'rgb(107, 107, 107)', 'rgb(233, 233, 237)', 'rgb(59, 59, 59)'}
GROUPS = re.compile(r'^(置顶|今天|昨天|7 天内|30 天内|\d{4}-\d{2})$')

def load(p):
    with open(p) as f: return json.load(f)

def lum(c):
    m = re.match(r'rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?', c or '')
    if not m: return None, 0
    r, g, b = [float(x) / 255 for x in m.groups()[:3]]
    a = float(m.group(4)) if m.group(4) is not None else 1
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a

def filled(e):
    l, a = lum(e['style'].get('background-color', ''))
    return l is not None and a > 0.05

def norm(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    for a, b in BRAND: t = t.replace(a, b)
    t = re.sub(r'[\w.*]+@[\w.]+', '<account>', t)
    t = re.sub(r'\d+', '#', t)
    return t

class Cap:
    def __init__(s, d, full_page=False):
        s.d = d; s.landing = full_page; s.vp = d['viewport']; s.W, s.H = s.vp['width'], s.vp['height']; s.mobile = s.W < 768
        s.page = d.get('page', {}); s.has_ph = any('ph' in e for e in d['elements'][:50])
        s.els = [e for e in d['elements'] if not e.get('pseudo') and s.visible(e, full_page)]
        s.pseudo_text = [e for e in d['elements'] if e.get('pseudo') and re.match(r'^"[^"]+"$', e['style'].get('content', '')) and e['style'].get('display') != 'none' and e['style'].get('opacity') not in ('0',) and e['style'].get('visibility') != 'hidden' and 0 <= e['rect']['y'] < s.H]
        s.dialog = s.find_dialog()
        ta = [e for e in s.els if e['tag'] == 'textarea']
        s.composer = None
        if ta:
            t = max(ta, key=lambda e: e['rect']['y'])['rect']
            cands = [e['rect'] for e in s.els if contains(e['rect'], t) and e['rect']['h'] >= t['h'] + 30 and e['rect']['w'] <= s.W - 10 and e['rect']['h'] < 400
                     and (filled(e) or e['style'].get('box-shadow', 'none') != 'none' or float((e['style'].get('border-top-width') or '0').replace('px', '') or 0) > 0)]
            s.composer = min(cands, key=lambda r: r['w'] * r['h']) if cands else t
        s.rows = [e['rect'] for e in s.els if e['rect']['x'] < 40 and 160 <= e['rect']['w'] <= 250 and 28 <= e['rect']['h'] <= 52 and e['rect']['y'] > (100 if not s.mobile else 90) and e['tag'] in ('a', 'div', 'button') and not re.search('开启新对话|深度思考|智能搜索', e.get('full') or '') and any(contains(e['rect'], t['rect']) and t is not e and (t.get('text') or '').strip() for t in s.els)]
        s.row_tags = collections.Counter(e['tag'] for e in s.els if e['rect'] in s.rows and e['tag'] in ('a', 'div', 'button'))
    def visible(s, e, full):
        r = e['rect']
        if r['w'] < 1 or r['h'] < 1: return False
        if e['style'].get('opacity') == '0' or e['style'].get('visibility') == 'hidden': return False
        if not full and (r['y'] >= s.H or r['y'] + r['h'] <= 0 or r['x'] >= s.W or r['x'] + r['w'] <= 0): return False
        return True
    def find_dialog(s):
        heads = [e for e in s.els if (e.get('text') or '') in ('系统设置', '反馈')]
        if not heads: return None
        h = heads[0]['rect']; best = None
        for e in s.els:
            r = e['rect']
            if filled(e) and r['w'] > 300 and r['h'] > 200 and r['w'] < s.W - 2 and r['x'] <= h['x'] and r['y'] <= h['y'] and r['x'] + r['w'] >= h['x'] + h['w']:
                if best is None or r['w'] * r['h'] < best['w'] * best['h']: best = r
        return best
    def region(s, e):
        r = e['rect']
        if s.dialog and r['x'] >= s.dialog['x'] - 1 and r['y'] >= s.dialog['y'] - 1 and r['x'] + r['w'] <= s.dialog['x'] + s.dialog['w'] + 1 and r['y'] + r['h'] <= s.dialog['y'] + s.dialog['h'] + 1:
            return 'dialog'
        sidebar_w = 262
        drawer = s.mobile and any(e2['tag'] in ('aside',) or 'sidebar' in (e2.get('cls') or '') for e2 in s.els if e2['rect']['x'] < 5 and e2['rect']['w'] > 250 and e2['rect']['h'] > 600)
        if not s.landing and (not s.mobile or drawer) and r['x'] < sidebar_w and r['x'] + r['w'] <= sidebar_w + (40 if s.mobile else 4) and r['w'] < s.W - 10:
            return 'sidebar'
        fs = e['style'].get('font-size', '')
        if r['y'] < (56 if s.mobile else 60) and r['h'] < 70 and (e['tag'] in ('button', 'svg', 'a') or e.get('role') == 'button' or (fs == '14px' and e['style'].get('font-weight') == '500') or not (e.get('text') or '').strip()): return 'topbar'
        if s.composer and contains({'x': s.composer['x'] - 2, 'y': s.composer['y'] - 2, 'w': s.composer['w'] + 4, 'h': s.composer['h'] + 4}, r): return 'composer'
        if s.composer and r['y'] >= s.composer['y'] + s.composer['h'] - 2: return 'footer'
        return 'content'

TRUNC = [False]
def text_of(e):
    t = (e.get('text') or '') if TRUNC[0] else (e.get('full') or e.get('text') or '')
    if TRUNC[0]: t = re.sub(r'\s+', ' ', t).strip()[:24]
    if not t and e['tag'] == 'textarea': t = '[placeholder]' + (e.get('ph') or '')
    elif e.get('ph'): t = '[placeholder]' + e['ph']
    return t

def chrome_tokens(c, state):
    """visible UI copy per region; conversation titles / answer text / accounts are data, not chrome"""
    chat = state not in ('landing', 'key-gate')
    out = collections.defaultdict(collections.Counter); data = collections.defaultdict(list)
    for e in c.els:
        t = text_of(e)
        if not t or not t.strip(): continue
        reg = c.region(e); r = e['rect']; fs = float(e['style'].get('font-size', '0').replace('px', '') or 0)
        is_data = False
        if c.mobile and reg not in ('topbar', 'dialog'): reg = 'page'
        if any(contains(row, r) for row in c.rows) or GROUPS.match(t.strip()):
            is_data = True   # conversation titles and date groups depend on history volume
        if reg == 'topbar' and chat and e['tag'] == 'div' and 13 <= fs <= 16 and r['x'] > (40 if c.mobile else 200) and r['x'] < c.W / 2: is_data = True  # chat title
        if reg in ('content', 'page') and chat and c.region(e) == 'content' and e['tag'] not in ('button',) and e.get('role') != 'button' and not re.match(r'^已思考', t): is_data = True
        if e['tag'] in ('code',) or re.match(r'^(js|ts)$', t): is_data = True
        if is_data: data[reg].append(e); continue
        out[reg][norm(t)] += 1
    for e in c.pseudo_text:   # text drawn with ::before/::after content (official ⌘ J is a pseudo element)
        t = e['style']['content'].strip('"')
        if len(t.strip()) >= 2:
            reg = c.region(e)
            if c.mobile and reg not in ('topbar', 'dialog'): reg = 'page'
            out[reg][norm(t)] += 1
    return out, data

def kinds(c):
    out = collections.defaultdict(collections.Counter); seen = set()
    for e in c.els:
        reg = c.region(e)
        if any(contains(row, e['rect']) for row in c.rows): continue
        if c.mobile and reg not in ('topbar', 'dialog', 'content'): reg = 'page'
        if reg == 'content': continue
        k = (e['tag'] == 'svg', round(e['rect']['x']), round(e['rect']['y']), round(e['rect']['w']), round(e['rect']['h']))
        if k in seen: continue
        seen.add(k)
        if e['tag'] == 'button' or e.get('role') == 'button': out[reg]['button'] += 1
        if e['tag'] == 'svg': out[reg]['icon'] += 1
        if e['tag'] == 'input': out[reg]['input:' + (e.get('inputType') or 'text')] += 1
        if e['tag'] == 'a': out[reg]['link'] += 1
        if e['tag'] == 'img': out[reg]['img'] += 1
    return out

def action_rows(c):
    btn = [e for e in c.els if c.region(e) == 'content' and (e['tag'] == 'button' or e.get('role') == 'button') and 22 <= e['rect']['w'] <= 40 and 22 <= e['rect']['h'] <= 40]
    rows = collections.defaultdict(list)
    for e in btn: rows[round(e['rect']['y'] / 6)].append(e)
    res = []
    for k, v in rows.items():
        xs = sorted({round(e['rect']['x']) for e in v})
        if len(xs) >= 4:
            icons = [s for s in c.els if s['tag'] == 'svg' and any(s['rect']['x'] >= b['rect']['x'] - 1 and s['rect']['x'] + s['rect']['w'] <= b['rect']['x'] + b['rect']['w'] + 1 and abs(s['rect']['y'] - b['rect']['y']) < b['rect']['h'] for b in v)]
            modes = collections.Counter(('stroke' if (s['style'].get('stroke') not in ('none', '', None) and s['style'].get('fill') in ('none', 'rgba(0, 0, 0, 0)')) else 'fill') for s in icons)
            res.append({'y': min(e['rect']['y'] for e in v), 'count': len(xs), 'icon_size': sorted({(round(s['rect']['w']), round(s['rect']['h'])) for s in icons}), 'modes': dict(modes), 'pitch': (xs[1] - xs[0]) if len(xs) > 1 else 0})
    return sorted(res, key=lambda r: r['y'])

def typography(data_els):
    agg = collections.defaultdict(collections.Counter)
    for e in data_els:
        s = e['style']; k = e['tag']
        if s.get('font-weight') in ('600', '700', 'bold'): k += '(bold)'
        agg[k][(s.get('font-size'), s.get('font-weight'), s.get('line-height'), s.get('color'))] += 1
    return {k: v.most_common(1)[0][0] for k, v in agg.items()}

def filled_boxes(c, reg):
    return [e for e in c.els if c.region(e) == reg and filled(e) and e['rect']['w'] * e['rect']['h'] > 600 and e['rect']['w'] < c.W - 4]

def iou(a, b):
    x1, y1 = max(a['x'], b['x']), max(a['y'], b['y']); x2, y2 = min(a['x'] + a['w'], b['x'] + b['w']), min(a['y'] + a['h'], b['y'] + b['h'])
    i = max(0, x2 - x1) * max(0, y2 - y1); u = a['w'] * a['h'] + b['w'] * b['h'] - i
    return i / u if u else 0

def contains(a, b):
    return b['x'] >= a['x'] - 1 and b['y'] >= a['y'] - 1 and b['x'] + b['w'] <= a['x'] + a['w'] + 1 and b['y'] + b['h'] <= a['y'] + a['h'] + 1

findings = []
def F(state, theme, vp, page, check, sev, detail, problem=None):
    if problem is None and check not in ('no official dark capture',):
        problem = {'landing': 1, 'multi-select': 4, 'settings-account': 5}.get(state)
        if state == 'settings-terms' and page == 'dialog': problem = 5
    findings.append({'state': state, 'theme': theme, 'vp': vp, 'page': page, 'check': check, 'sev': sev, 'detail': detail, 'problem': problem})

def ours_only_checks(c, state, theme, vp):
    """rules that need no official reference"""
    pg = c.page
    if pg.get('smoothing') and pg['smoothing'] != OFFICIAL_BODY['-webkit-font-smoothing']:
        F(state, theme, vp, 'all', 'body -webkit-font-smoothing', 'high', f"ours={pg['smoothing']} official=antialiased（官方 body 规则）→ 深色下文字在 macOS 上明显更粗", 2)
    allt = ' '.join(text_of(e) for e in c.els)
    if state not in ALLOWED_HARBOR:
        for w in NOT_APPLICABLE:
            if w in allt: F(state, theme, vp, 'settings', 'not-applicable official feature present', 'high', f'「{w}」是官方账号体系功能，API Key 产品无意义，应删除', 5)
        for w in HARBOR_ONLY_COPY:
            hits = [text_of(e) for e in c.els if w in text_of(e)]
            if hits: F(state, theme, vp, c.region([e for e in c.els if w in text_of(e)][0]), 'harbor-only copy', 'high', f'「{hits[0][:40]}」官方没有', 2 if w in ('本地模式', '密钥与对话仅保存在本设备') else (1 if w in ('对话留在本机', 'OpenLinkOS 发起的开源项目') else None))
    # native controls
    for e in c.els:
        if e['tag'] == 'input' and e.get('inputType') in ('checkbox', 'radio') and e['style'].get('appearance', 'auto') not in ('none',) and e['rect']['w'] >= 8:
            F(state, theme, vp, c.region(e), 'native control', 'high', f"原生 {e['inputType']}（appearance={e['style'].get('appearance')}）@{int(e['rect']['x'])},{int(e['rect']['y'])}", 4 if state == 'multi-select' else None)
        if e['tag'] == 'button' and (e['style'].get('background-color') in UA_BUTTON_BG or 'outset' in e['style'].get('border-top-style', '')):
            F(state, theme, vp, c.region(e), 'native control', 'high', f"浏览器默认按钮样式「{(e.get('text') or e.get('name') or '')[:10]}」bg={e['style'].get('background-color')} border={e['style'].get('border-top-style')}", 4 if state == 'multi-select' else None)
    # official ds-checkbox spec (main.dc093a796f.css): 16px, radius 6px, transparent bg, 1.5px inset ring var(--dsw-alias-border-l3), checked = brand
    for e in c.els:
        if e['tag'] == 'input' and e.get('inputType') == 'checkbox' and c.region(e) == 'sidebar':
            st = e['style']; bad = []
            if st.get('border-top-left-radius') != '6px': bad.append(f"radius {st.get('border-top-left-radius')}≠6px")
            if lum(st.get('background-color', ''))[1] > 0.05: bad.append(f"bg {st.get('background-color')}≠transparent")
            if float((st.get('border-top-width') or '0').replace('px', '') or 0) > 0: bad.append('用 border 而不是 1.5px inset ring')
            nxt = [t for t in c.els if (t.get('text') or '').strip() and abs(t['rect']['y'] + t['rect']['h'] / 2 - (e['rect']['y'] + 8)) < 8 and t['rect']['x'] >= e['rect']['x'] + 10]
            if nxt:
                gap = min(t['rect']['x'] for t in nxt) - (e['rect']['x'] + e['rect']['w'])
                if gap < 6: bad.append(f'与标题间距 {gap:.0f}px（贴住文字）')
            if bad: F(state, theme, vp, 'sidebar', 'checkbox vs official ds-checkbox', 'high', '；'.join(bad), 4 if state == 'multi-select' else None)
    # theme self-consistency
    pl, _ = lum(pg.get('bodyBg', ''))
    dark = theme == 'dark'
    for e in c.els:
        if not filled(e): continue
        l, a = lum(e['style']['background-color']); r = e['rect']
        if a < 0.6 or r['w'] * r['h'] < 2500: continue
        if dark and l > 0.6:
            F(state, theme, vp, c.region(e), 'light surface in dark theme', 'high', f"{e['tag']}.{(e.get('cls') or '')[:30]} {int(r['w'])}×{int(r['h'])}@{int(r['x'])},{int(r['y'])} bg={e['style']['background-color']}", 2 if c.region(e) == 'topbar' else (1 if state == 'landing' else None))
    # layout sanity: empty filled box, overlapping text, wrapped short labels
    texts = [e for e in c.els if (e.get('text') or '').strip() and e['tag'] not in ('textarea',)]
    for e in c.els:
        r = e['rect']
        if filled(e) and 40 < r['w'] < 420 and 16 < r['h'] < 90 and e['tag'] in ('div', 'span', 'p'):
            inner = [t for t in c.els if t is not e and contains(r, t['rect']) and ((t.get('text') or '').strip() or t['tag'] in ('svg', 'img', 'input', 'textarea', 'button'))]
            if not inner and not (e.get('text') or '').strip():
                F(state, theme, vp, c.region(e), 'empty filled box', 'high', f"空灰框 {int(r['w'])}×{int(r['h'])}@{int(r['x'])},{int(r['y'])} bg={e['style']['background-color']} cls={(e.get('cls') or '')[:30]}", 5 if 'settings' in state else None)
    for e in c.els:
        if e['tag'] == 'input' and (e.get('inputType') or 'text') == 'text' and not e.get('ph') and c.region(e) == 'dialog':
            F(state, theme, vp, 'dialog', 'empty filled box', 'high', f"空输入框 {int(e['rect']['w'])}×{int(e['rect']['h'])}@{int(e['rect']['x'])},{int(e['rect']['y'])} bg={e['style'].get('background-color')} cls={(e.get('cls') or '')[:30]}（官方此处是文字值）", 5 if 'settings' in state else None)
    for i, a in enumerate(texts):
        for b in texts[i + 1:]:
            ra, rb = a['rect'], b['rect']
            if a['key'].startswith(b['key']) or b['key'].startswith(a['key']): continue
            if c.region(a) != c.region(b) or a['key'].split(' > ')[:3] != b['key'].split(' > ')[:3]: continue
            if (a.get('full') or a['text']) == (b.get('full') or b['text']) and abs(ra['x'] - rb['x']) < 2: continue
            x = max(0, min(ra['x'] + ra['w'], rb['x'] + rb['w']) - max(ra['x'], rb['x'])); y = max(0, min(ra['y'] + ra['h'], rb['y'] + rb['h']) - max(ra['y'], rb['y']))
            small = min(ra['w'] * ra['h'], rb['w'] * rb['h'])
            if small and x * y / small > 0.25:
                F(state, theme, vp, c.region(a), 'overlapping text', 'high', f"「{a['text'][:8]}」与「{b['text'][:8]}」重叠 @{int(ra['x'])},{int(ra['y'])}", 5 if 'settings' in state else None)

def compare(o, c, state, theme, vp, oname):
    same_theme = theme == 'light'   # all official references are light
    TRUNC[0] = not any('full' in e for e in o.d['elements'][:50])   # old official captures keep only 24 chars of own text
    to, do = chrome_tokens(o, state); tc, dc = chrome_tokens(c, state)
    TRUNC[0] = False
    for reg in sorted(set(to) | set(tc)):
        miss = to[reg] - tc[reg]; extra = tc[reg] - to[reg]
        for t, n in miss.items():
            if t.startswith('BRAND') and len(t) < 8: continue
            if t.startswith('[placeholder]') and not o.has_ph: continue
            F(state, theme, vp, reg, 'chrome text missing', 'high' if reg != 'sidebar' or 'BRAND' not in t else 'med', f'官方有「{t[:40]}」×{n}，我们没有')
        for t, n in extra.items():
            if t in ('BRAND',): continue
            if t.startswith('[placeholder]') and not o.has_ph: continue
            F(state, theme, vp, reg, 'chrome text extra', 'high', f'我们多出「{t[:40]}」×{n}')
    ko, kc = kinds(o), kinds(c)
    for reg in sorted(set(ko) | set(kc)):
        for k in sorted(set(ko[reg]) | set(kc[reg])):
            if True:
                if ko[reg][k] != kc[reg][k]:
                    F(state, theme, vp, reg, 'element count', 'med', f'{k}: 官方 {ko[reg][k]} / 我们 {kc[reg][k]}')
    # action row
    if o.row_tags and c.row_tags and set(o.row_tags) != set(c.row_tags):
        F(state, theme, vp, 'sidebar', 'conversation row element', 'med', f'官方会话行是 {dict(o.row_tags)}（<a> 链接，可新标签页打开）/ 我们是 {dict(c.row_tags)}')
    ar_o, ar_c = action_rows(o), action_rows(c)
    if ar_o or ar_c:
        a, b = (ar_o[-1] if ar_o else None), (ar_c[-1] if ar_c else None)
        if not a or not b or a['count'] != b['count']:
            F(state, theme, vp, 'content', 'action row count', 'high', f"官方 {a and a['count']} 个 / 我们 {b and b['count']} 个", 2)
        if a and b:
            if a['modes'] != b['modes']: F(state, theme, vp, 'content', 'action row icon glyphs', 'high', f"官方图标 {a['modes']}（实心 fill 图形）/ 我们 {b['modes']}（描边线条，自绘路径）→ 图标形状不同", 2)
            if a['icon_size'] != b['icon_size'] or a['pitch'] != b['pitch']: F(state, theme, vp, 'content', 'action row geometry', 'med', f"官方 size={a['icon_size']} pitch={a['pitch']} / 我们 size={b['icon_size']} pitch={b['pitch']}")
    # global icon render mode
    def mode(cap):
        m = collections.Counter()
        for e in cap.els:
            if e['tag'] == 'svg' and e['rect']['w'] <= 24:
                m['stroke' if e['style'].get('stroke') not in ('none', '', None) and e['style'].get('fill') in ('none', 'rgba(0, 0, 0, 0)') else 'fill'] += 1
        return m
    mo, mc = mode(o), mode(c)
    if mc.get('stroke', 0) > mo.get('stroke', 0) + 2:
        F(state, theme, vp, 'all', 'icon glyph style', 'high', f'小图标：官方 fill {mo.get("fill",0)} / stroke {mo.get("stroke",0)}；我们 fill {mc.get("fill",0)} / stroke {mc.get("stroke",0)} → 我们的图标是自绘描边路径，不是官方图形')
    # content typography (same theme only)
    if same_theme:
        ty_o, ty_c = typography(do.get('content', [])), typography(dc.get('content', []))
        for k in sorted(set(ty_o) & set(ty_c)):
            if ty_o[k] != ty_c[k]:
                F(state, theme, vp, 'content', 'content typography', 'high', f'{k}: 官方 size/weight/lh/color={ty_o[k]} / 我们 {ty_c[k]}', 2 if k.startswith('span') else None)
        # filled boxes per region missing/extra
        for reg in ('topbar', 'sidebar', 'composer', 'dialog', 'content'):
            fo, fc = filled_boxes(o, reg), filled_boxes(c, reg)
            for e in fc:
                if not any(iou(e['rect'], x['rect']) > 0.5 for x in fo):
                    if reg == 'content': continue
                    F(state, theme, vp, reg, 'extra filled box', 'med', f"我们多出底色块 {e['tag']}.{(e.get('cls') or '')[:24]} {int(e['rect']['w'])}×{int(e['rect']['h'])}@{int(e['rect']['x'])},{int(e['rect']['y'])} bg={e['style']['background-color']}")
            for e in fo:
                if not any(iou(e['rect'], x['rect']) > 0.5 for x in fc):
                    if reg == 'content': continue
                    F(state, theme, vp, reg, 'missing filled box', 'med', f"官方有底色块 {e['tag']} {int(e['rect']['w'])}×{int(e['rect']['h'])}@{int(e['rect']['x'])},{int(e['rect']['y'])} bg={e['style']['background-color']}，我们没有")
    # composer surface (frosted / opaque)
    def comp_el(cap):
        if not cap.composer: return None
        m = [e for e in cap.els if e['rect'] == cap.composer]
        return m[0] if m else None
    co, cc = comp_el(o), comp_el(c)
    if same_theme and co and cc and co['style'].get('border-top-left-radius', '0px') != '0px':
        for prop in ('background-color', 'backdrop-filter', 'box-shadow', 'border-top-left-radius'):
            if (co['style'].get(prop) or 'none') != (cc['style'].get(prop) or 'none'):
                F(state, theme, vp, 'composer', 'composer surface', 'high' if prop in ('background-color', 'backdrop-filter') else 'med', f"输入框外壳 {prop}: 官方 {co['style'].get(prop)} / 我们 {cc['style'].get(prop)}")
        if abs(co['rect']['w'] - cc['rect']['w']) > 1 or abs(co['rect']['x'] - cc['rect']['x']) > 1 or abs(co['rect']['h'] - cc['rect']['h']) > 1:
            F(state, theme, vp, 'composer', 'composer geometry', 'med', f"输入框外壳 官方 {co['rect']} / 我们 {cc['rect']}")
    # page background / theme
    if same_theme and o.page.get('bodyBg') and c.page.get('bodyBg') and o.page['bodyBg'] != c.page['bodyBg']:
        F(state, theme, vp, 'page', 'page background', 'med', f"body bg 官方 {o.page['bodyBg']} / 我们 {c.page['bodyBg']}")

results_states = []
for f in sorted(glob.glob(f'{A.caps}/ours-*.json')):
    m = re.match(r'.*/ours-(.+)-(light|dark)-(\d+x\d+)\.json', f)
    if not m: continue
    state, theme, vp = m.groups()
    full = state == 'landing'
    c = Cap(load(f), full)
    ours_only_checks(c, state, theme, vp)
    kind, ref = PAIRS.get(state, (None, state))
    if state == 'after-new-chat-focus':
        act = c.page.get('activeTag', '')
        if not act.startswith('textarea'):
            F(state, theme, vp, 'composer', 'behavior: focus after 新建对话', 'high', f'点「开启新对话」后焦点在 {act or "body"}，官方是输入框', None)
    if state == 'two-turns':
        rq = f'{A.caps}/requests-two-turns.json'
        if os.path.exists(rq):
            r = load(rq)
            if len(r) == 2 and r[1].get('title', {}).get('enabled'):
                F(state, theme, vp, 'logic', 'title requested every turn', 'high', '第 2 轮请求仍带 title.enabled=true：标题会被后续回合覆盖；官方只在首轮后生成一次', 3)
            if r and r[0].get('system'):
                F(state, theme, vp, 'logic', 'custom system prompt', 'high', f"每轮都注入自定义 system：「{r[0]['system'][:60]}…」官方网页端没有这段，回答风格因此不同", 3)
    if kind == 'harbor-only':
        results_states.append((state, theme, vp, 'harbor-only (rules only)')); continue
    if kind is None:
        F(state, theme, vp, 'coverage', 'no official reference', 'high', f'官方 {ref} 状态没有采集，无法逐项比对（旧方法直接跳过不计分）', 4 if state == 'multi-select' else None)
        results_states.append((state, theme, vp, 'NO OFFICIAL REF')); continue
    if kind == 'live':
        of = f'{A.caps}/{ref.replace("light", "nocookie-light")}-{vp}.json'
        if not os.path.exists(of): of = f'{A.caps}/{ref}-{vp}.json'
        o = Cap(load(of), True)
        if theme == 'dark':
            od = f'{A.caps}/official-landing-dark-{vp}.json'
            if os.path.exists(od):
                ol, _ = lum(load(od).get('page', {}).get('bodyBg', '')); cl, _ = lum(c.page.get('bodyBg', ''))
                F(state, theme, vp, 'page', 'theme behaviour', 'high', f'系统深色时官方首页仍是浅色（body bg {load(od)["page"].get("bodyBg")}），我们切成深色（{c.page.get("bodyBg")}）', 1)
    else:
        of = f'{A.official}/style-official-{ref}-{vp}.json'
        if not os.path.exists(of):
            F(state, theme, vp, 'coverage', 'no official reference', 'high', f'没有官方 {ref} {vp} 采集')
            results_states.append((state, theme, vp, 'NO OFFICIAL REF')); continue
        o = Cap(load(of), False)
        if theme == 'dark':
            F(state, theme, vp, 'coverage', 'no official dark capture', 'med', '官方所有采集都是浅色；深色只能做自洽检查（浅色块、对比），颜色无法逐项比对')
    compare(o, c, state, theme, vp, of)
    results_states.append((state, theme, vp, os.path.basename(of)))

json.dump({'findings': findings, 'states': results_states}, open(f'{A.out}/findings.json', 'w'), ensure_ascii=False, indent=1)
# summary
by = collections.Counter((x['state'], x['theme'], x['vp']) for x in findings)
print('states:', len(results_states), 'findings:', len(findings))
for p in (1, 2, 3, 4, 5):
    hits = [x for x in findings if x['problem'] == p]
    print(f'user problem {p}: {"DETECTED" if hits else "NOT detected"} ({len(hits)} findings) e.g.', [h['check'] + ': ' + h['detail'][:70] for h in hits[:3]])
