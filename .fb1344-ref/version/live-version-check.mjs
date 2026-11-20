#!/usr/bin/env node
// fb1344: post-deploy check (app repo workflow, on workflow_run "Web image" completed on master, or manual).
// Polls https://deepapi.linkos.org/version.json (cache-busted) until commit == the master SHA, timeout 25 min.
// Also checks <meta name="app-version"> on / equals version.json. Exit 1 on timeout/mismatch → red workflow.
const URL_ = process.env.SITE || 'https://deepapi.linkos.org'; const want = (process.env.GIT_SHA || '').slice(0, 7); const until = Date.now() + 25 * 60e3
while (true) {
  try { const v = await (await fetch(`${URL_}/version.json?t=${Date.now()}`, { cache: 'no-store' })).json()
    const html = await (await fetch(`${URL_}/?t=${Date.now()}`, { cache: 'no-store' })).text()
    const meta = /<meta name="app-version" content="([^"]+)"/.exec(html)?.[1]
    console.log(new Date().toISOString(), JSON.stringify(v), 'meta', meta)
    if (v.commit === want) { if (meta !== v.version) { console.error('meta app-version ≠ version.json'); process.exit(1) } console.log(`live = v${v.version} (${v.commit})`); process.exit(0) }
  } catch (e) { console.log('poll error', String(e)) }
  if (Date.now() > until) { console.error(`live never reached ${want}`); process.exit(1) }
  await new Promise((r) => setTimeout(r, 20e3))
}
