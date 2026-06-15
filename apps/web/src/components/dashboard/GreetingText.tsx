'use client'
import { useEffect, useState } from 'react'

interface Props {
  fallback: string
}

export default function GreetingText({ fallback }: Props) {
  const [text, setText] = useState(fallback)

  useEffect(() => {
    fetch('/api/greeting')
      .then(res => res.json())
      .then(data => {
        if (data?.text) setText(data.text)
      })
      .catch(() => {})
  }, [])

  return (
    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 }}>{text}</p>
  )
}
