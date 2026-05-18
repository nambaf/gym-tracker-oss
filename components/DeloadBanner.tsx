'use client'
import React, { useState } from 'react'
import ProgressModal from './ProgressModal'
import { useDataStore } from '@/store/data'
import { Battery } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

export default function DeloadBanner() {
  const t = useT()
  const { deloadActive, setDeloadActive } = useDataStore()
  const [showProgress, setShowProgress] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  React.useEffect(() => { setHydrated(true) }, [])

  if (!hydrated || !deloadActive) return null

  return (
    <>
      <div className="rounded-2xl bg-warning/10 border border-warning/20 p-4 flex items-start gap-3 animate-fade-in-up">
        <div className="w-9 h-9 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
          <Battery size={16} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink">
            {t.deloadBanner.title}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {t.deloadBanner.body}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowProgress(true)}
              className="btn-pill"
            >
              {t.deloadBanner.analyseBtn}
            </button>
            <button
              onClick={() => setDeloadActive(false)}
              className="btn-pill !bg-transparent !border-transparent !text-muted hover:!text-ink"
            >
              {t.deloadBanner.deactivateBtn}
            </button>
          </div>
        </div>
      </div>

      {showProgress && <ProgressModal onClose={() => setShowProgress(false)} />}
    </>
  )
}
