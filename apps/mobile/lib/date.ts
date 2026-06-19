function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function monthString(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
