import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // fb1344-parity.spec.ts is part of this run. The proposal's playwright.fb1344.config.ts
  // is not a second entry point, so `pnpm e2e` is the gate CI runs.
  testMatch: '*.spec.ts',
  testIgnore: ['android.spec.ts', 'server.spec.ts'],
  timeout: 60_000,
  fullyParallel: false,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 820 },
  },
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
