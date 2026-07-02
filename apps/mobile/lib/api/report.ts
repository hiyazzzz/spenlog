import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import type { User } from '@spenlog/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spenlog-nr7t.vercel.app'

export interface CatData {
  cat: string
  amount: number
  prevAmount: number
  budget: number
  budgetPct: number
  prevDiff: number | null
}

export interface MonthTotal {
  month: string
  label: string
  total: number
}

export interface TopItem {
  name: string
  amount: number
  category: string
}

export interface SpendCluster {
  label: string
  amount: number
  count: number
}

// 이름이 비슷한 소액 지출(커피, 배달 등)을 묶어서 합산 - 개별 금액은 작아도 모이면 유의미한 지출 유형 (web report-data와 동일 로직)
const SPEND_CLUSTER_KEYWORDS: Record<string, string[]> = {
  '카페/커피': ['커피', '카페', '스타벅스', '스벅', '이디야', '투썸', '커피빈', '빽다방', '메가커피', '컴포즈', '아메리카노', '라떼'],
  '배달/외식': ['배달', '배민', '요기요', '쿠팡이츠', '맥도날드', '버거킹', '치킨', '피자'],
  '편의점': ['cu', 'gs25', '세븐일레븐', '이마트24', '편의점'],
  '온라인쇼핑': ['쿠팡', '무신사', '지마켓', '11번가', '올리브영'],
  '구독서비스': ['넷플릭스', '왓챠', '유튜브', '멜론', '스포티파이', '디즈니'],
}

function clusterExpenses(items: { name: string; amount: number }[]): SpendCluster[] {
  const result: SpendCluster[] = []
  for (const [label, keywords] of Object.entries(SPEND_CLUSTER_KEYWORDS)) {
    const matched = items.filter(i => keywords.some(k => i.name.toLowerCase().includes(k.toLowerCase())))
    if (matched.length >= 2) {
      result.push({ label, amount: matched.reduce((s, i) => s + i.amount, 0), count: matched.length })
    }
  }
  return result.sort((a, b) => b.amount - a.amount)
}

export interface ReportData {
  profile: User | null
  currentMonth: string
  prevMonth: string
  maxMonth: string
  totalSpent: number
  prevTotalSpent: number
  spendingDiff: number | null
  savingGoal: number
  savedAmount: number
  savingPct: number
  income: number
  catData: CatData[]
  topItems: TopItem[]
  spendClusters: SpendCluster[]
  txnCount: number
  threeMonths: MonthTotal[] | null
  maxTotal: number
  patternComment: string
  hasEnoughData: boolean
  hasCoachCache: boolean
}

export async function getReportData(userId: string, month?: string): Promise<ReportData> {
  const maxMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const defaultMonth = maxMonth
  const rawMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth
  const safeMonth = rawMonth > maxMonth ? maxMonth : rawMonth

  const nextMonth = dayjs(safeMonth).add(1, 'month').format('YYYY-MM')
  const prevMonth = dayjs(safeMonth).subtract(1, 'month').format('YYYY-MM')
  const prev2Month = dayjs(safeMonth).subtract(2, 'month').format('YYYY-MM')

  const [
    { data: profile },
    { data: expenses },
    { data: prevExpenses },
    { data: prev2Expenses },
    { data: budgets },
    { data: categoriesData },
    { data: cachedReport },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('expenses').select('*').eq('user_id', userId)
      .gte('date', `${safeMonth}-01`).lt('date', `${nextMonth}-01`),
    supabase.from('expenses').select('amount, category, type').eq('user_id', userId)
      .gte('date', `${prevMonth}-01`).lt('date', `${safeMonth}-01`),
    supabase.from('expenses').select('amount, type').eq('user_id', userId)
      .gte('date', `${prev2Month}-01`).lt('date', `${prevMonth}-01`),
    supabase.from('budgets').select('*').eq('user_id', userId).eq('month', safeMonth),
    supabase.from('categories').select('name').eq('user_id', userId).eq('is_hidden', false).order('sort_order'),
    supabase.from('reports').select('ai_coach').eq('user_id', userId).eq('year_month', safeMonth).single(),
  ])

  const totalSpent = expenses?.filter((e: any) => (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const prevTotalSpent = prevExpenses?.filter((e: any) => (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const prev2TotalSpent = prev2Expenses?.filter((e: any) => (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const savingGoal = profile?.saving_goal ?? 0
  const income = profile?.income ?? 0

  // 실제 저축 기록 합산 (홈화면과 동일 기준)
  const savedAmount = expenses?.filter((e: any) => e.type === 'savings').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0
  const spendingDiff = prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100) : null

  const userCatNames = (categoriesData ?? []).map((c: any) => c.name)
  const expenseCatNames = [...new Set([
    ...(expenses ?? []).filter((e: any) => (e.type ?? 'expense') === 'expense').map((e: any) => e.category),
    ...(prevExpenses ?? []).filter((e: any) => (e.type ?? 'expense') === 'expense').map((e: any) => e.category),
    ...(budgets ?? []).map((b: any) => b.category),
  ])] as string[]
  const reportCategories = userCatNames.length > 0 ? userCatNames : expenseCatNames

  const catData: CatData[] = reportCategories.map((cat: string) => {
    const amount = expenses?.filter((e: any) => e.category === cat && (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const prevAmount = prevExpenses?.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const budget = budgets?.find((b: any) => b.category === cat)?.amount ?? 0
    const budgetPct = budget > 0 ? Math.min(Math.round((amount / budget) * 100), 100) : 0
    const prevDiff = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null
    return { cat, amount, prevAmount, budget, budgetPct, prevDiff }
  })

  // AI 코치가 카테고리 뭉뚱그린 조언 대신 실제 항목을 지목할 수 있도록 고액 지출 TOP3 전달 (web report-data와 동일 로직)
  const expenseRows = (expenses ?? []).filter((e: any) => (e.type ?? 'expense') === 'expense')
  const topItems: TopItem[] = [...expenseRows]
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 3)
    .map((e: any) => ({ name: e.name ?? '항목', amount: e.amount, category: e.category ?? '기타' }))
  const txnCount = expenseRows.length
  const spendClusters = clusterExpenses(expenseRows.map((e: any) => ({ name: e.name ?? '', amount: e.amount })))

  const threeMonthsRaw: MonthTotal[] = [
    { month: prev2Month, label: dayjs(prev2Month).format('M월'), total: prev2TotalSpent },
    { month: prevMonth, label: dayjs(prevMonth).format('M월'), total: prevTotalSpent },
    { month: safeMonth, label: dayjs(safeMonth).format('M월'), total: totalSpent },
  ]
  const maxTotal = Math.max(...threeMonthsRaw.map(m => m.total), 1)

  let patternComment = ''
  if (prevTotalSpent > 0 && prev2TotalSpent > 0) {
    if (totalSpent < prevTotalSpent && prevTotalSpent < prev2TotalSpent) {
      patternComment = '3개월 연속 줄이고 있어요! 잘하고 있어요 🌿'
    } else if (totalSpent > prevTotalSpent && prevTotalSpent > prev2TotalSpent) {
      patternComment = '3개월째 늘고 있어요. 한번 점검해볼까요?'
    } else {
      patternComment = '들쭉날쭉한 패턴이에요. 고정 예산을 잡아보는 건 어떨까요?'
    }
  }

  return {
    profile: (profile as User) ?? null,
    currentMonth: safeMonth,
    prevMonth,
    maxMonth,
    totalSpent,
    prevTotalSpent,
    spendingDiff,
    savingGoal,
    savedAmount,
    savingPct,
    income,
    catData,
    topItems,
    spendClusters,
    txnCount,
    threeMonths: prevTotalSpent > 0 ? threeMonthsRaw : null,
    maxTotal,
    patternComment,
    hasEnoughData: prevTotalSpent > 0,
    hasCoachCache: !!(cachedReport?.ai_coach),
  }
}

// pattern~action: 신규 5필드 스키마. message: 구버전 통합 메시지. step1~3: 구구버전 3단 스키마 (모두 getCoachBlocks에서 하위호환 처리)
export interface Coach {
  pattern?: string
  warning?: string
  context?: string
  solution?: string
  action?: string
  message?: string
  step1?: string
  step2?: string
  step3?: string
}

export interface CoachSegment {
  bold: boolean
  text: string
}

export interface CoachBlock {
  type: 'p' | 'warning' | 'solution'
  segments: CoachSegment[]
}

// "**볼드**" 마크다운 라이트 파싱 (RN Text는 HTML을 못 그리므로 세그먼트 배열로 반환)
function parseSegments(text: string): CoachSegment[] {
  return text.split(/(\*\*.+?\*\*)/g).filter(Boolean).map(seg =>
    seg.startsWith('**') && seg.endsWith('**')
      ? { bold: true, text: seg.slice(2, -2) }
      : { bold: false, text: seg }
  )
}

export function getCoachBlocks(c: Coach): CoachBlock[] {
  if (c.pattern || c.solution || c.action) {
    const blocks: CoachBlock[] = []
    if (c.pattern) blocks.push({ type: 'p', segments: parseSegments(c.pattern) })
    if (c.warning) blocks.push({ type: 'warning', segments: parseSegments(c.warning) })
    if (c.context) blocks.push({ type: 'p', segments: parseSegments(c.context) })
    if (c.solution) blocks.push({ type: 'solution', segments: parseSegments(c.solution) })
    if (c.action) blocks.push({ type: 'p', segments: parseSegments(c.action) })
    return blocks
  }
  // 구버전 호환: message 또는 step1/2/3 -> 전부 일반 문단으로 (콜아웃 없이)
  const legacyText = c.message ?? [c.step1, c.step2, c.step3].filter(Boolean).join(' ')
  return legacyText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(text => ({ type: 'p' as const, segments: parseSegments(text) }))
}

export type CoachErrorCode = 'NO_DATA' | 'API_ERROR' | 'PREMIUM_REQUIRED' | 'MONTH_NOT_COMPLETE'

export interface CoachResult {
  coach?: Coach
  errorCode?: CoachErrorCode
}

export async function getAiCoach(userId: string, report: ReportData): Promise<CoachResult> {
  if (report.totalSpent === 0) return { errorCode: 'NO_DATA' }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let res: Response
    try {
      res = await fetch(`${API_URL}/api/ai-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          yearMonth: report.currentMonth,
          totalSpent: report.totalSpent,
          prevTotalSpent: report.prevTotalSpent,
          savingGoal: report.savingGoal,
          savedAmount: report.savedAmount,
          income: report.income,
          catData: report.catData.map(c => ({ cat: c.cat, amount: c.amount, prevAmount: c.prevAmount, budget: c.budget })),
          topItems: report.topItems,
          spendClusters: report.spendClusters,
          txnCount: report.txnCount,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    const data = await res.json()
    if (data.coach) return { coach: data.coach }
    if (data.error === 'PREMIUM_REQUIRED') return { errorCode: 'PREMIUM_REQUIRED' }
    if (data.error === 'MONTH_NOT_COMPLETE') return { errorCode: 'MONTH_NOT_COMPLETE' }
    return { errorCode: 'API_ERROR' }
  } catch {
    return { errorCode: 'API_ERROR' }
  }
}
