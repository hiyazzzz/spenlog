import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import dayjs from 'dayjs';
import { COLORS, RADIUS, formatCurrency, useThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getAnalyticsData, type AnalyticsData } from '@/lib/api/analytics';

const CAT_COLORS = ['#6B1E2E', '#C4748A', '#E8A4B0', '#A85C6E', '#D4848E', '#7E3A4C', '#F0B0BC'];

export default function AnalyticsScreen() {
  const { colors } = useAppTheme();
  const { themeColors } = useThemeColors();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (month?: string) => {
    try {
      setError(null);
      // 현재 달 첫 로드: 캐시 먼저 표시
      if (!month) {
        const cached = useDataCache.getState().analytics;
        if (cached) { setData(cached); setLoading(false); }
        else { setLoading(true); }
      } else {
        setLoading(true);
      }
      const userId = await getCurrentUserId();
      if (!userId) { setError('로그인이 필요해요'); return; }
      const result = await getAnalyticsData(userId, month);
      if (!month) useDataCache.getState().setAnalytics(result);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <Text style={styles.emptyText}>{error ?? '데이터를 불러오지 못했어요'}</Text>
      </View>
    );
  }

  const { currentMonth, maxMonth, thisTotal, lastTotal, diffPercent, diffAmt, dailyData, categoryData } = data;
  const canGoNext = currentMonth < maxMonth;
  const monthLabel = dayjs(currentMonth).format('YYYY년 M월');
  const daysInMonth = dayjs(currentMonth).daysInMonth();

  // 누적 일별 데이터
  const cumulativeData = useMemo(() => {
    let cum = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = dailyData.find(x => x.day === i + 1);
      cum += d?.amount ?? 0;
      return { day: i + 1, cum, daily: d?.amount ?? 0 };
    });
  }, [dailyData, daysInMonth]);

  const maxCum = Math.max(...cumulativeData.map(d => d.cum), 1);
  const maxDaily = Math.max(...cumulativeData.map(d => d.daily), 1);
  const todayDay = dayjs().month() === dayjs(currentMonth).month() ? dayjs().date() : daysInMonth;

  // 도넛 대체: 상위 카테고리 비율 목록
  const donutData = categoryData.filter(c => c.thisAmt > 0);

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* 헤더 + 월 네비 */}
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: themeColors.accent }]}>분석</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.navBtn} onPress={() => load(dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM'))}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
            onPress={() => canGoNext && load(dayjs(currentMonth).add(1, 'month').format('YYYY-MM'))}
            disabled={!canGoNext}
          >
            <Text style={[styles.navBtnText, !canGoNext && styles.navBtnTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 총 지출 카드 */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>총 지출</Text>
        <Text style={[styles.totalAmt, { color: themeColors.primary }]}>{formatCurrency(thisTotal)}</Text>
        {diffPercent !== null ? (
          <Text style={[styles.diffText, { color: diffAmt > 0 ? COLORS.red : COLORS.green }]}>
            지난 달 대비 {diffAmt > 0 ? '+' : ''}{diffPercent}% ({diffAmt > 0 ? '+' : ''}{formatCurrency(Math.abs(diffAmt))})
          </Text>
        ) : (
          <Text style={[styles.diffText, { color: COLORS.gray400 }]}>지난 달 데이터 없음</Text>
        )}
      </View>

      {/* 일별 지출 바 차트 */}
      {dailyData.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>일별 지출</Text>
          <View style={styles.barChartWrap}>
            {cumulativeData.map(d => {
              const pct = maxDaily > 0 ? d.daily / maxDaily : 0;
              const isToday = d.day === todayDay && dayjs().format('YYYY-MM') === currentMonth;
              return (
                <View key={d.day} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[
                      styles.barFill,
                      {
                        height: `${Math.max(pct * 100, d.daily > 0 ? 4 : 0)}%`,
                        backgroundColor: isToday ? themeColors.primary : themeColors.primaryMid,
                      },
                    ]} />
                  </View>
                  {(d.day === 1 || d.day === Math.ceil(daysInMonth / 2) || d.day === daysInMonth) && (
                    <Text style={styles.barLabel}>{d.day}</Text>
                  )}
                </View>
              );
            })}
          </View>
          {/* 누적 라인 표시 */}
          <View style={styles.cumWrap}>
            <Text style={styles.cumLabel}>누적 지출</Text>
            <Text style={[styles.cumValue, { color: themeColors.primary }]}>{formatCurrency(cumulativeData[todayDay - 1]?.cum ?? thisTotal)}</Text>
          </View>
        </View>
      )}

      {/* 카테고리 비율 */}
      {donutData.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>카테고리 비율</Text>
          {/* 퍼센트 바 */}
          <View style={styles.donutBarRow}>
            {donutData.map((item, i) => (
              <View
                key={item.cat}
                style={[
                  styles.donutBarSegment,
                  {
                    flex: item.thisAmt,
                    backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                    borderRadius: i === 0 ? 4 : i === donutData.length - 1 ? 4 : 0,
                  },
                ]}
              />
            ))}
          </View>
          <View style={{ gap: 8, marginTop: 12 }}>
            {donutData.map((item, i) => (
              <View key={item.cat} style={styles.legendRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <View style={[styles.legendDot, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                  <Text style={[styles.legendLabel, { color: colors.gray700 }]}>{item.cat}</Text>
                </View>
                <Text style={[styles.legendPct, { color: colors.gray800 }]}>
                  {Math.round((item.thisAmt / thisTotal) * 100)}%
                </Text>
                <Text style={[styles.legendAmt, { color: colors.gray600 }]}>{formatCurrency(item.thisAmt)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 카테고리별 전월 대비 */}
      {categoryData.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>카테고리별 지출</Text>
          <View style={{ gap: 14 }}>
            {categoryData.map(({ cat, thisAmt, lastAmt }) => {
              const catDiff = thisAmt - lastAmt;
              const catDiffPct = lastAmt > 0 ? Math.round((catDiff / lastAmt) * 100) : null;
              const barPct = thisTotal > 0 ? (thisAmt / thisTotal) * 100 : 0;
              return (
                <View key={cat}>
                  <View style={styles.catHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.catName, { color: colors.gray700 }]}>{cat}</Text>
                      {catDiffPct !== null && (
                        <Text style={[styles.catDiffBadge, { color: catDiff > 0 ? COLORS.red : COLORS.green }]}>
                          {catDiff > 0 ? '▲' : '▼'}{Math.abs(catDiffPct)}%
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.catAmt, { color: colors.gray800 }]}>{formatCurrency(thisAmt)}</Text>
                  </View>
                  <View style={[styles.catTrack, { backgroundColor: colors.gray100 }]}>
                    <View style={[styles.catFill, { width: `${barPct}%`, backgroundColor: themeColors.primary }]} />
                  </View>
                  {lastAmt > 0 && (
                    <Text style={[styles.catPrevText, { color: colors.gray400 }]}>
                      전달 {formatCurrency(lastAmt)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {thisTotal === 0 && (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🌿</Text>
          <Text style={[styles.emptyText, { fontSize: 14, color: colors.gray500 }]}>이 달의 지출 내역이 없어요</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { fontSize: 18, fontWeight: '700', color: COLORS.accent },
  navBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { borderColor: COLORS.gray100 },
  navBtnText: { fontSize: 13, color: COLORS.gray600 },
  navBtnTextDisabled: { color: COLORS.gray200 },
  monthLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray700, minWidth: 76, textAlign: 'center' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.gray100, padding: 16, marginBottom: 12 },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  cardLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 8 },

  totalAmt: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  diffText: { fontSize: 12, fontWeight: '500' },

  // 일별 바 차트
  barChartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80, marginBottom: 8 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: 72, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 2, minHeight: 0 },
  barLabel: { fontSize: 8, color: COLORS.gray400, marginTop: 2 },
  cumWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.gray50 },
  cumLabel: { fontSize: 11, color: COLORS.gray400 },
  cumValue: { fontSize: 13, fontWeight: '700' },

  // 카테고리 비율
  donutBarRow: { flexDirection: 'row', height: 16, borderRadius: 4, overflow: 'hidden', gap: 1 },
  donutBarSegment: { height: '100%' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: COLORS.gray600 },
  legendPct: { fontSize: 12, fontWeight: '700', color: COLORS.gray800, minWidth: 32, textAlign: 'right' },
  legendAmt: { fontSize: 11, color: COLORS.gray500, minWidth: 64, textAlign: 'right' },

  // 카테고리별
  catHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  catName: { fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
  catDiffBadge: { fontSize: 10, fontWeight: '600' },
  catAmt: { fontSize: 13, fontWeight: '700', color: COLORS.gray800 },
  catTrack: { backgroundColor: COLORS.gray100, borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 2 },
  catFill: { height: '100%', borderRadius: 999 },
  catPrevText: { fontSize: 10, color: COLORS.gray400, textAlign: 'right' },
});
