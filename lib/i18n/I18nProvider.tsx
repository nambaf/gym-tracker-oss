'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { LANG_COOKIE, isLang, type Lang } from '.'
import { getDictionary, type Dictionary } from './dictionaries'

type Ctx = {
  lang: Lang
  t: Dictionary
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return
    setLangState(next)
    // 1 year, lax, root path. Not HttpOnly: client must read for SSR-less switching.
    document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
    // Reload so server components re-render with the new dictionary.
    window.location.reload()
  }, [])

  const value = useMemo<Ctx>(() => ({
    lang,
    t: getDictionary(lang),
    setLang,
  }), [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT(): Dictionary {
  return useI18n().t
}

export function useLang(): Lang {
  return useI18n().lang
}
