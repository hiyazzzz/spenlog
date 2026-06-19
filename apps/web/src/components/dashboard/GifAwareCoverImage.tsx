'use client'
import { useGifAwareSrc } from '@/lib/useGifAwareSrc'

interface Props {
  src: string
  autoplay: boolean
}

export default function GifAwareCoverImage({ src, autoplay }: Props) {
  const resolved = useGifAwareSrc(src, autoplay)
  return (
    <img src={resolved ?? src} alt="cover"
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
  )
}
