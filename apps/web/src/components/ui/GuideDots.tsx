'use client'

interface GuideDotsProps {
  total: number
  current: number
  onSelect?: (index: number) => void
  activeColor: string
  inactiveColor: string
  activeWidth?: number
  inactiveWidth?: number
  size?: number
  style?: React.CSSProperties
}

export default function GuideDots({
  total, current, onSelect, activeColor, inactiveColor,
  activeWidth = 22, inactiveWidth = 6, size = 6, style,
}: GuideDotsProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, ...style }}>
      {Array.from({ length: total }).map((_, i) => {
        const dotStyle: React.CSSProperties = {
          width: i === current ? activeWidth : inactiveWidth,
          height: size,
          borderRadius: size / 2,
          background: i === current ? activeColor : inactiveColor,
          transition: 'all 0.25s',
          padding: 0,
        }
        if (onSelect) {
          return (
            <button key={i} onClick={() => onSelect(i)} style={{ ...dotStyle, border: 'none', cursor: 'pointer' }} />
          )
        }
        return <div key={i} style={dotStyle} />
      })}
    </div>
  )
}
