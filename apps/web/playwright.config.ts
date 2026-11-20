import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['chat.spec.ts', 'parity.spec.ts', 'compare.spec.ts', 'gaps.spec.ts', 'mobile-capture.spec.ts', 'motion.spec.ts', 'focus.spec.ts', 'file-purpose.spec.ts'],
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
