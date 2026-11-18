const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|.+\.local)$/

/** HTTPS servers are allowed. Plain HTTP is only a private LAN host, and only when the person opts in. */
export const validateServerUrl = (value: string, allowLanHttp: boolean): string => {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('invalid server url')
  }
  if (url.username || url.password) {
    throw new Error('invalid server url')
  }
  if (url.protocol === 'https:') {
    return url.origin
  }
  if (url.protocol === 'http:' && allowLanHttp && PRIVATE_HOST.test(url.hostname)) {
    return url.origin
  }
  throw new Error('invalid server url')
}
