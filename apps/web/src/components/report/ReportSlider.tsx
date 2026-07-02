'use client'
import { useRef, useState } from 'react'

interface Props {
  pages: React.ReactNode[]
}

export default function ReportSlider({ pages }: Props) {
  const [index, setIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const startTime = useRef(0)
  const count = pages.length

  function settle(delta: number, elapsed: number) {
    const velocity = elapsed > 0 ? delta / elapsed : 0
    let next = index
    if (Math.abs(delta) > 40 || Math.abs(velocity) > 0.5) {
      next = delta < 0 ? Math.min(index + 1, count - 1) : Math.max(index - 1, 0)
    }
    setIndex(next)
    setDragOffset(0)
    setDragging(false)
    startX.current = null
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
    startX.current = e.clientX
    startTime.current = Date.now()
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    setDragOffset(e.clientX - startX.current)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (startX.current === null) return
    settle(e.clientX - startX.current, Date.now() - startTime.current)
  }

  function onPointerLeave() {
    if (startX.current === null) return
    settle(dragOffset, Date.now() - startTime.current)
  }

  function onPointerCancel() {
    setDragOffset(0)
    setDragging(false)
    startX.current = null
  }

  return (
    <div className="mb-4">
      <div
        style={{ overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
      >
        <div
          style={{
            display: 'flex',
            transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
            transition: dragging ? 'none' : 'transform 0.25s ease-out',
          }}
        >
          {pages.map((page, i) => (
            <div key={i} style={{ flex: '0 0 100%', minWidth: '100%' }}>
              {page}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {pages.map((_, i) => (
          <button key={i} onClick={() => setIndex(i)} style={{
            width: 6, height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
            backgroundColor: i === index ? 'var(--color-primary)' : '#e5e7eb',
            transition: 'background-color 0.2s',
          }} />
        ))}
      </div>
    </div>
  )
}
