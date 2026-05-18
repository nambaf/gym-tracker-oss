'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { LANGS, LANG_LABELS } from '@/lib/i18n'

export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-muted ${className}`}>
      <span>{t.common.language}</span>
      <select
        value={lang}
        onChange={e => setLang(e.target.value as typeof lang)}
        className="bg-paper-sunken border border-ink/10 rounded-lg px-2 py-1 text-ink"
      >
        {LANGS.map(l => (
          <option key={l} value={l}>{LANG_LABELS[l]}</option>
        ))}
      </select>
    </label>
  )
}
