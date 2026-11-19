/**
 * Product naming lives here so a rename stays mechanical.
 * The visible name is DeepAPI. The Haven mark stays beside the wordmark.
 */
export const BRAND = {
  name: 'DeepAPI',
  shortName: 'DeepAPI',
  version: '0.1.0',
  organization: 'openlinkos',
  repository: 'https://github.com/openlinkos/deepapi',
  /** Public static host. deepapi.linkos.org redirects here. */
  site: 'https://deepapi.linkos.org',
  apiOrigin: 'https://api.deepseek.com',
  platform: 'https://platform.deepseek.com/',
} as const

export const NATIVE_ARCHIVE_FORMAT = 'deepapi'
export const NATIVE_ARCHIVE_VERSION = 1
export const OFFICIAL_ARCHIVE_VERSION = 3
