import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

/** Evidence shots. Written only when PARITY_SHOTS_DIR is set; otherwise this does nothing. */
export const saveShot = async (page: Page, name: string) => {
  const dir = process.env.PARITY_SHOTS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: join(dir, name) })
}
