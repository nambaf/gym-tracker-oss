'use client'
import { useRef, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

interface Props {
  children: ReactNode
  onDelete: () => void
}

export default function SwipeableSetRow({ children, onDelete }: Props) {
  const t = useT()
  const [offsetX, setOffsetX] = useState(0)
  const [swiped, setSwiped] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const touchRef = useRef({ startX: 0, startY: 0, locked: false as boolean | null })
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    if (swiped) return
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, locked: null }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (swiped) return
    const t = e.touches[0]
    const deltaX = touchRef.current.startX - t.clientX
    const deltaY = Math.abs(touchRef.current.startY - t.clientY)

    // Decide direction lock on first significant movement
    if (touchRef.current.locked === null) {
      if (Math.abs(deltaX) > 10 || deltaY > 10) {
        touchRef.current.locked = Math.abs(deltaX) > deltaY
      }
      return
    }

    if (!touchRef.current.locked) return

    // Only allow swipe left (positive deltaX)
    const clamped = Math.max(0, Math.min(deltaX, 120))
    setOffsetX(clamped)
  }

  function onTouchEnd() {
    if (swiped) return
    if (offsetX > 80) {
      setSwiped(true)
      setOffsetX(80)
    } else {
      setOffsetX(0)
    }
    touchRef.current.locked = null
  }

  function handleDeleteTap() {
    if (confirming) {
      // Second tap - execute delete
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      setRemoving(true)
      setTimeout(() => onDelete(), 300)
    } else {
      // First tap - show confirmation
      setConfirming(true)
      confirmTimer.current = setTimeout(() => {
        setConfirming(false)
      }, 2000)
    }
  }

  function handleCloseSwiped() {
    setSwiped(false)
    setConfirming(false)
    setOffsetX(0)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${removing ? 'animate-slide-out-left' : ''}`}
    >
      {/* Delete button behind */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center transition-colors ${
          confirming ? 'bg-accent-700' : 'bg-accent-500'
        }`}
        onClick={swiped ? handleDeleteTap : undefined}
      >
        <span className="text-white text-xs font-medium">
          {confirming ? t.swipe.confirm : t.swipe.delete}
        </span>
      </div>

      {/* Swipeable content */}
      <div
        className={`relative bg-paper ${
          swiped ? '' : 'transition-transform duration-200 ease-out'
        }`}
        style={{ transform: `translateX(-${offsetX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={swiped ? handleCloseSwiped : undefined}
      >
        {children}
      </div>
    </div>
  )
}
