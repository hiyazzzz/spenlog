'use client'
import { useEffect, useState } from 'react'

function isGifUrl(url?: string | null): boolean {
  return !!url && /\.gif(\?.*)?$/i.test(url)
}

// gif_autoplay 설정이 꺼져있으면 GIF의 첫 프레임을 캡처해 정적 이미지로 대체
export function useGifAwareSrc(url: string | null | undefined, autoplay: boolean): string | null | undefined {
  const [resolved, setResolved] = useState(url)

  useEffect(() => {
    if (!url || autoplay || !isGifUrl(url)) {
      setResolved(url)
      return
    }
    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0)
        setResolved(canvas.toDataURL())
      } catch {
        setResolved(url)
      }
    }
    img.onerror = () => { if (!cancelled) setResolved(url) }
    img.src = url
    return () => { cancelled = true }
  }, [url, autoplay])

  return resolved
}
