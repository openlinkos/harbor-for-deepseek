import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'server.spec.ts',
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:8080',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'node ../../scripts/e2e-hosted.mjs',
    url: 'http://127.0.0.1:8080/api/config',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
