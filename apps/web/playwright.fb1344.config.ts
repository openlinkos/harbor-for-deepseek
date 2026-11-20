import { defineConfig, devices } from '@playwright/test'
export default defineConfig({ testDir: './e2e', testMatch: 'fb1344-parity.spec.ts', timeout: 60_000, fullyParallel: true, workers: 4, reporter: [['list'], ['json', { outputFile: process.env.FB1344_JSON || 'fb1344-results.json' }]],
  use: { ...devices['Desktop Chrome'], baseURL: process.env.FB1344_BASE || 'http://127.0.0.1:4173' } })
