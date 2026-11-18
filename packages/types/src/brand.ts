/**
 * Product naming lives here so a rename stays mechanical.
 * The visible name is Harbor. "DeepSeek" is only used to describe the API.
 */
export const BRAND = {
  name: 'Harbor',
  version: '0.1.0',
  organization: 'openlinkos',
  repository: 'https://github.com/openlinkos/harbor-for-deepseek',
  /** Public static host. No DeepSeek in the domain. */
  site: 'https://hfd.linkos.org',
  apiOrigin: 'https://api.deepseek.com',
  platform: 'https://platform.deepseek.com/',
  disclaimerZh: '非官方社区项目，与深度求索无隶属或合作关系',
  disclaimerEn: 'Unofficial community project, not affiliated with DeepSeek.',
} as const

export const NATIVE_ARCHIVE_FORMAT = 'harbor'
export const NATIVE_ARCHIVE_VERSION = 1
export const OFFICIAL_ARCHIVE_VERSION = 3
