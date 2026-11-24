import { defineConfig, devices } from '@playwright/test'

const port = process.env.PW_PORT || '4173'

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
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 820 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // --mute-audio stops Chromium from pulling a ScriptProcessorNode, so the
    // real recorder never receives samples. Speech tests need the audio thread.
    launchOptions: { ignoreDefaultArgs: ['--mute-audio'] },
    // Greeting tests pin a +08:00 clock and then read getHours(). CI browsers
    // default to UTC, so the same clock reads as the previous evening.
    timezoneId: 'Asia/Shanghai',
  },
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
})
