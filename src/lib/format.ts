/**
 * 금액 표기 헬퍼
 * toLocaleString currency 옵션은 서버 환경에서 'W' 로 깨질 수 있으므로
 * ₩ 기호를 직접 하드코딩
 */
export function formatCurrency(amount: number): string {
  return '₩' + Math.round(amount).toLocaleString('ko-KR')
}

export function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('ko-KR')
}
