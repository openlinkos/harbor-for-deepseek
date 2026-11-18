import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'android.spec.ts',
  timeout: 60_000,
  use: {
    ...devices['Pixel 5'],
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'node ../../scripts/serve-static.mjs ../mobile/www 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
})
