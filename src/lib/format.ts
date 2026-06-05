export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
  })
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR')
}
