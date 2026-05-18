export type Lang = 'it' | 'en'

export const LANGS: Lang[] = ['it', 'en']
export const LANG_COOKIE = 'gt_lang'

export function isLang(value: unknown): value is Lang {
  return value === 'it' || value === 'en'
}

export function getDefaultLang(): Lang {
  const env = process.env.DEFAULT_LANG?.toLowerCase()
  return isLang(env) ? env : 'it'
}

/** Negotiate a language from an `Accept-Language` header. */
export function negotiateFromHeader(header: string | null | undefined): Lang | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const code = part.trim().split(';')[0].toLowerCase().slice(0, 2)
    if (isLang(code)) return code
  }
  return null
}

export const LANG_LABELS: Record<Lang, string> = {
  it: 'Italiano',
  en: 'English',
}
