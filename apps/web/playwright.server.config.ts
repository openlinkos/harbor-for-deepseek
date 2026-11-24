import { defineConfig, devices } from '@playwright/test'

const port = process.env.PW_SERVER_PORT || '8080'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'server.spec.ts',
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 900 },
    // Same clock as the web suite: greeting hours follow Asia/Shanghai, not CI's UTC.
    timezoneId: 'Asia/Shanghai',
  },
  webServer: {
    command: 'node ../../scripts/e2e-hosted.mjs',
    url: `http://127.0.0.1:${port}/api/config`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
