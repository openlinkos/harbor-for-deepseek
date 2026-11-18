/**
 * Product naming lives here so a rename stays mechanical.
 * The visible name is Harbor for DeepSeek. Launcher labels may use the short name.
 */
export const BRAND = {
  name: 'Harbor for DeepSeek',
  shortName: 'Harbor',
  version: '0.1.0',
  organization: 'openlinkos',
  repository: 'https://github.com/openlinkos/harbor-for-deepseek',
  /** Public static host. No DeepSeek in the domain. */
  site: 'https://hfd.linkos.org',
  apiOrigin: 'https://api.deepseek.com',
  platform: 'https://platform.deepseek.com/',
} as const

export const NATIVE_ARCHIVE_FORMAT = 'harbor'
export const NATIVE_ARCHIVE_VERSION = 1
export const OFFICIAL_ARCHIVE_VERSION = 3
