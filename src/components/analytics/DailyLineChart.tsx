'use client'

interface DayData {
  day: number
  amount: number
}

export default function DailyLineChart({ data, month }: { data: DayData[]; month: string }) {
  if (data.length === 0) return null

  const W = 320
  const H = 100
  const PAD = { top: 12, right: 12, bottom: 24, left: 40 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxAmt = Math.max(...data.map(d => d.amount), 1)
  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate()

  // 누적 지출로 변환
  let cum = 0
  const cumData = Array.from({ length: daysInMonth }, (_, i) => {
    const d = data.find(x => x.day === i + 1)
    cum += d?.amount ?? 0
    return { day: i + 1, cum }
  })
  const maxCum = Math.max(...cumData.map(d => d.cum), 1)

  const x = (day: number) => PAD.left + ((day - 1) / (daysInMonth - 1)) * innerW
  const y = (val: number) => PAD.top + innerH - (val / maxCum) * innerH

  const points = cumData.map(d => `${x(d.day)},${y(d.cum)}`).join(' ')
  const areaPoints = `${x(1)},${PAD.top + innerH} ${points} ${x(daysInMonth)},${PAD.top + innerH}`

  // Y축 레이블
  const yTicks = [0, 0.5, 1].map(r => ({
    val: Math.round(maxCum * r),
    y: PAD.top + innerH - r * innerH,
  }))

  const today = new Date().getDate()
  const todayCum = cumData[Math.min(today - 1, daysInMonth - 1)]

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
      <p className="text-xs text-gray-400 mb-3">누적 지출 추이</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* 그리드 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
              stroke="#f0f0f0" strokeWidth="1" />
            <text x={PAD.left - 4} y={t.y + 4} textAnchor="end"
              fontSize="8" fill="#ccc">
              {t.val >= 10000 ? `${Math.round(t.val / 10000)}만` : t.val === 0 ? '0' : `${t.val}`}
            </text>
          </g>
        ))}

        {/* 영역 */}
        <polygon points={areaPoints} fill="var(--color-primary)" opacity="0.08" />

        {/* 라인 */}
        <polyline points={points} fill="none"
          stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" />

        {/* 오늘 점 */}
        {todayCum && (
          <circle cx={x(todayCum.day)} cy={y(todayCum.cum)} r="4"
            fill="var(--color-primary)" stroke="#fff" strokeWidth="2" />
        )}

        {/* X축 월초/중/말 */}
        {[1, Math.ceil(daysInMonth / 2), daysInMonth].map(d => (
          <text key={d} x={x(d)} y={H - 4} textAnchor="middle" fontSize="8" fill="#bbb">
            {d}일
          </text>
        ))}
      </svg>
    </div>
  )
}
