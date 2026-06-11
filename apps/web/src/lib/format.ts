/**
 * 금액 표기 헬퍼
 */
export function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('ko-KR') + '원'
}

export function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('ko-KR')
}
