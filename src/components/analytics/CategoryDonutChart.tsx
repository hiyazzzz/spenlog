'use client'

const COLORS = ['#6B1E2E', '#C4748A', '#F5A5B0', '#A85C6E', '#E8B4BC']

interface Props {
  data: { name: string; value: number }[]
  total: number
}

function DonutChart({ data, total }: Props) {
  const size = 120
  const cx = size / 2
  const cy = size / 2
  const outerR = 52
  const innerR = 32
  const gap = 0.04 // radians

  let cumAngle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * (2 * Math.PI) - gap
    const startAngle = cumAngle + gap / 2
    const endAngle = startAngle + angle
    cumAngle += (d.value / total) * (2 * Math.PI)

    const x1 = cx + outerR * Math.cos(startAngle)
    const y1 = cy + outerR * Math.sin(startAngle)
    const x2 = cx + outerR * Math.cos(endAngle)
    const y2 = cy + outerR * Math.sin(endAngle)
    const x3 = cx + innerR * Math.cos(endAngle)
    const y3 = cy + innerR * Math.sin(endAngle)
    const x4 = cx + innerR * Math.cos(startAngle)
    const y4 = cy + innerR * Math.sin(startAngle)

    const largeArc = angle > Math.PI ? 1 : 0

    const path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`

    return { path, color: COLORS[i % COLORS.length] }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} />
      ))}
    </svg>
  )
}

export default function CategoryDonutChart({ data, total }: Props) {
  if (data.length === 0 || total === 0) return null

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
      <p className="text-xs text-gray-400 mb-3">카테고리 비율</p>
      <div className="flex items-center gap-5">
        <div className="flex-shrink-0">
          <DonutChart data={data} total={total} />
        </div>
        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="text-gray-600">{item.name}</span>
              </div>
              <span className="font-semibold text-gray-800">
                {Math.round((item.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
