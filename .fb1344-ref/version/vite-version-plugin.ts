// fb1344: goes into apps/web/vite.config.ts plugins[]. Single source = root package.json "version"; commit from GIT_SHA
// (Docker build-arg; the image build context has no .git) or `git rev-parse` locally.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
export const versionPlugin = (): Plugin => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const version = JSON.parse(readFileSync(root + 'package.json', 'utf8')).version as string
  let commit = (process.env.GIT_SHA || '').slice(0, 7)
  if (!commit) try { commit = execSync('git rev-parse --short=7 HEAD', { cwd: root, encoding: 'utf8' }).trim() } catch { commit = 'unknown' }
  const builtAt = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : new Date().toISOString()
  return {
    name: 'deepapi-version',
    config: () => ({ define: { __APP_VERSION__: JSON.stringify(version), __APP_COMMIT__: JSON.stringify(commit) } }),
    // official chat.deepseek.com carries <meta name="commit-id">; we add app-version next to it
    transformIndexHtml: (html) => html.replace('</head>', `  <meta name="app-version" content="${version}">\n  <meta name="commit-id" content="${commit}">\n</head>`),
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, commit, builtAt }) + '\n' }) },
  }
}
