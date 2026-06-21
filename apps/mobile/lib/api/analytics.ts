import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

export interface DailyData {
  day: number;
  amount: number;
}

export interface CategoryData {
  cat: string;
  thisAmt: number;
  lastAmt: number;
}

export interface AnalyticsData {
  currentMonth: string;
  maxMonth: string;
  thisTotal: number;
  lastTotal: number;
  diffPercent: number | null;
  diffAmt: number;
  dailyData: DailyData[];
  categoryData: CategoryData[];
}

export async function getAnalyticsData(userId: string, month?: string): Promise<AnalyticsData> {
  const currentMonth = month ?? dayjs().format('YYYY-MM');
  const prevMonth = dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM');
  const nextMonthStart = dayjs(currentMonth).add(1, 'month').format('YYYY-MM');

  const [
    { data: thisExpenses },
    { data: lastExpenses },
    { data: categoriesData },
    { data: maxExpense },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${nextMonthStart}-01`),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', `${prevMonth}-01`)
      .lt('date', `${currentMonth}-01`),
    supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .eq('is_hidden', false)
      .order('sort_order'),
    supabase
      .from('expenses')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1),
  ]);

  const thisFiltered = (thisExpenses ?? []).filter(e => (e.type ?? 'expense') === 'expense');
  const lastFiltered = (lastExpenses ?? []).filter(e => (e.type ?? 'expense') === 'expense');

  const thisTotal = thisFiltered.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastFiltered.reduce((s, e) => s + e.amount, 0);
  const diffAmt = thisTotal - lastTotal;
  const diffPercent = lastTotal > 0 ? Math.round((diffAmt / lastTotal) * 100) : null;

  // 일별 지출
  const dailyMap = new Map<number, number>();
  thisFiltered.forEach(e => {
    const day = parseInt(e.date.split('-')[2]);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + e.amount);
  });
  const dailyData: DailyData[] = Array.from(dailyMap.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => a.day - b.day);

  // 카테고리별
  const userCatNames = (categoriesData ?? []).map(c => c.name);
  const expenseCats = [...new Set([
    ...thisFiltered.map(e => e.category),
    ...lastFiltered.map(e => e.category),
  ])];
  const allCats = userCatNames.length > 0 ? userCatNames : expenseCats;

  const categoryData: CategoryData[] = allCats
    .map(cat => ({
      cat,
      thisAmt: thisFiltered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
      lastAmt: lastFiltered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
    }))
    .filter(c => c.thisAmt > 0 || c.lastAmt > 0)
    .sort((a, b) => b.thisAmt - a.thisAmt);

  const maxMonth = maxExpense?.[0]?.date
    ? maxExpense[0].date.substring(0, 7)
    : dayjs().format('YYYY-MM');

  return {
    currentMonth,
    maxMonth,
    thisTotal,
    lastTotal,
    diffPercent,
    diffAmt,
    dailyData,
    categoryData,
  };
}
