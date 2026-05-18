import 'server-only'
import { cookies, headers } from 'next/headers'
import { LANG_COOKIE, getDefaultLang, isLang, negotiateFromHeader, type Lang } from '.'

/**
 * Server-side language resolution:
 *   1. `gt_lang` cookie if valid
 *   2. `Accept-Language` request header
 *   3. `DEFAULT_LANG` env var (fallback: 'it')
 */
export async function getLang(): Promise<Lang> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LANG_COOKIE)?.value
  if (isLang(fromCookie)) return fromCookie

  const headersList = await headers()
  const fromHeader = negotiateFromHeader(headersList.get('accept-language'))
  if (fromHeader) return fromHeader

  return getDefaultLang()
}
