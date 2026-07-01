import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import dayjs from 'dayjs';
import { COLORS, RADIUS, formatCurrency, getThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getReportData, getAiCoach, type ReportData, type Coach, type CoachErrorCode } from '@/lib/api/report';
import { getAnalyticsData, type AnalyticsData } from '@/lib/api/analytics';

const CAT_COLORS = ['#6B1E2E', '#C4748A', '#E8A4B0', '#A85C6E', '#D4848E', '#7E3A4C', '#F0B0BC'];

export default function ReportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | undefined>(undefined);

  const [coach, setCoach] = useState<Coach | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachErrorCode, setCoachErrorCode] = useState<CoachErrorCode | ''>('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [catTab, setCatTab] = useState<'bar' | 'pie'>('bar');
  const buttonAnim = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const catScrollRef = useRef<ScrollView>(null);
  const [catPageWidth, setCatPageWidth] = useState(0);

  const load = useCallback(async (m?: string) => {
    try {
      setError(null);
      // 현재 달 첫 로드: 캐시 먼저 표시
      if (!m) {
        const cachedReport = useDataCache.getState().report;
        const cachedAnalytics = useDataCache.getState().reportAnalytics;
        if (cachedReport && cachedAnalytics) {
          setReport(cachedReport);
          setAnalyticsData(cachedAnalytics);
          setMonth(cachedReport.currentMonth);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }
      const uid = await getCurrentUserId();
      if (!uid) {
        setError('로그인이 필요해요');
        return;
      }
      setUserId(uid);
      const [data, aData] = await Promise.all([
        getReportData(uid, m),
        getAnalyticsData(uid, m),
      ]);
      if (!m) useDataCache.getState().setReport(data, aData);
      setReport(data);
      setAnalyticsData(aData);
      setMonth(data.currentMonth);
      setCoach(null);
      setCoachErrorCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '리포트를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(month); }, []));

  // ⚠️ useMemo는 early return 이전에 선언 (React hooks 순서 규칙)
  const _month = report?.currentMonth ?? month ?? dayjs().format('YYYY-MM');
  const daysInMonth = dayjs(_month).daysInMonth();
  const todayDay = dayjs().month() === dayjs(_month).month() ? dayjs().date() : daysInMonth;
  const cumulativeData = useMemo(() => {
    if (!analyticsData) return [];
    let cum = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = analyticsData.dailyData.find(x => x.day === i + 1);
      cum += d?.amount ?? 0;
      return { day: i + 1, cum, daily: d?.amount ?? 0 };
    });
  }, [analyticsData, daysInMonth]);

  async function loadCoach() {
    if (!report || !userId || coach) return;
    setCoachLoading(true);
    setCoachErrorCode('');
    const result = await getAiCoach(userId, report);
    if (result.coach) setCoach(result.coach);
    else if (result.errorCode) setCoachErrorCode(result.errorCode);
    setCoachLoading(false);
  }

  function loadCoachWithAnim() {
    Animated.timing(buttonAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      Animated.timing(contentAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
    loadCoach();
  }

  useEffect(() => {
    buttonAnim.setValue(1);
    contentAnim.setValue(0);
    setCatTab('bar');
    catScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [month]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyText}>{error ?? '리포트를 불러오지 못했어요'}</Text>
      </View>
    );
  }

  const {
    currentMonth, prevMonth, maxMonth,
    totalSpent, prevTotalSpent, spendingDiff,
    savingGoal, savedAmount, savingPct,
    catData, threeMonths, maxTotal, patternComment, hasEnoughData,
  } = report;

  const monthLabel = dayjs(currentMonth).format('YYYY년 M월');
  const canGoNext = currentMonth < maxMonth;
  const goalAchieved = savingGoal > 0 && savedAmount >= savingGoal;
  const themeColors = getThemeColors(report.profile?.theme);
  const headerBg = goalAchieved ? COLORS.green : themeColors.primary;

  const headerTitle = goalAchieved
    ? '저축 목표 달성! 🎉'
    : spendingDiff !== null && spendingDiff < 0
      ? '이번 달 잘 아꼈어요 🌿'
      : savingGoal > 0
        ? `목표까지 ${formatCurrency(savingGoal - savedAmount)}`
        : `${formatCurrency(totalSpent)} 지출`;

  // 분석 데이터 (daysInMonth, todayDay, cumulativeData는 early return 이전에 선언됨)
  const maxDaily = Math.max(...cumulativeData.map(d => d.daily), 1);
  const donutData = analyticsData ? analyticsData.categoryData.filter(c => c.thisAmt > 0) : [];

  function goMonth(delta: number) {
    const m = dayjs(currentMonth).add(delta, 'month').format('YYYY-MM');
    if (delta > 0 && !canGoNext) return;
    load(m);
  }

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: themeColors.accent }]}>리포트</Text>
      </View>
      <View style={[styles.monthNavRow, { backgroundColor: themeColors.tabBg }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => goMonth(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]} onPress={() => goMonth(1)} disabled={!canGoNext}>
          <Text style={[styles.navBtnText, !canGoNext && styles.navBtnTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {totalSpent === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🌿</Text>
          <Text style={styles.emptyTitle}>아직 리포트가 없어요</Text>
          <Text style={styles.emptyDesc}>이번 달 지출을 기록하면{'\n'}다음 달 1일에 첫 리포트가 공개돼요!</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)')}>
            <Text style={styles.emptyLink}>첫 기록 남기기 →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={[styles.headerCard, { backgroundColor: headerBg }]}>
            <Text style={styles.headerCardLabel}>{monthLabel} 소비 총평</Text>
            <Text style={styles.headerCardTitle}>{headerTitle}</Text>
            <View style={styles.headerStatsRow}>
              <View>
                <Text style={styles.headerStatLabel}>총 지출</Text>
                <Text style={styles.headerStatValue}>{formatCurrency(totalSpent)}</Text>
              </View>
              {savingGoal > 0 && (
                <View>
                  <Text style={styles.headerStatLabel}>실제 저축</Text>
                  <Text style={styles.headerStatValue}>{formatCurrency(savedAmount)}</Text>
                </View>
              )}
              {savingGoal > 0 && (
                <View>
                  <Text style={styles.headerStatLabel}>달성률</Text>
                  <Text style={styles.headerStatValue}>{savingPct}%</Text>
                </View>
              )}
            </View>
          </View>

          {spendingDiff !== null && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>전월 대비 지출</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <Text style={[styles.diffValue, { color: spendingDiff > 0 ? COLORS.red : COLORS.green }]}>
                  {spendingDiff > 0 ? '▲' : '▼'} {Math.abs(spendingDiff)}%
                </Text>
                <Text style={styles.diffSub}>
                  ({spendingDiff > 0 ? '+' : ''}{formatCurrency(totalSpent - prevTotalSpent)})
                </Text>
              </View>
              <Text style={styles.diffDetail}>
                전달 {formatCurrency(prevTotalSpent)} → 이번 달 {formatCurrency(totalSpent)}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardLabel}>🤖 AI 코치</Text>

            {!coach && !coachErrorCode && !coachLoading && (
              <Animated.View style={{ opacity: buttonAnim, alignItems: 'center', paddingVertical: 16 }}>
                <TouchableOpacity
                  style={[styles.coachBtn, { backgroundColor: themeColors.primary }]}
                  onPress={loadCoachWithAnim}
                >
                  <Text style={styles.coachBtnText}>AI 코치 받기</Text>
                </TouchableOpacity>
                <Text style={[styles.emptyText, { marginTop: 8 }]}>AI가 이번 달 소비 패턴을 분석해드려요</Text>
              </Animated.View>
            )}

            {coachLoading && (
              <Animated.View style={{ opacity: contentAnim, paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color={themeColors.primaryMid} />
                <Text style={[styles.emptyText, { marginTop: 8 }]}>AI가 분석 중이에요...</Text>
              </Animated.View>
            )}

            {!!coachErrorCode && !coachLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={[styles.emptyText, { marginBottom: 12 }]}>
                  {coachErrorCode === 'NO_DATA' ? '이 달 기록된 지출이 없어요'
                    : coachErrorCode === 'PREMIUM_REQUIRED' ? '3개월 무료 체험이 끝났어요'
                    : 'AI 코치를 일시적으로 이용할 수 없어요'}
                </Text>
                {coachErrorCode === 'API_ERROR' && (
                  <TouchableOpacity style={[styles.coachBtn, { backgroundColor: themeColors.primary }]} onPress={loadCoach}>
                    <Text style={styles.coachBtnText}>다시 시도</Text>
                  </TouchableOpacity>
                )}
                {coachErrorCode === 'NO_DATA' && (
                  <TouchableOpacity style={[styles.coachBtn, { backgroundColor: themeColors.primary }]} onPress={() => router.push('/(tabs)')}>
                    <Text style={styles.coachBtnText}>지출 기록하러 가기</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {coach && (
              <Animated.View style={{ opacity: contentAnim, gap: 14 }}>
                {([
                  { step: '1', title: '패턴 진단', content: coach.step1 },
                  { step: '2', title: '동기부여', content: coach.step2 },
                  { step: '3', title: '행동 제안', content: coach.step3 },
                ] as const).map(({ step, title, content }) => (
                  <View key={title}>
                    <Text style={styles.coachStepTitle}>{step} {title}</Text>
                    <Text style={styles.coachStepContent}>{content}</Text>
                  </View>
                ))}
                <View style={styles.coachFooter}>
                  {hasEnoughData ? (
                    <TouchableOpacity style={[styles.coachCta, { backgroundColor: themeColors.primary }]} onPress={() => router.push('/(tabs)/assets')}>
                      <Text style={styles.coachCtaText}>다음 달 예산 AI 추천받기</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.emptyText, { textAlign: 'center' }]}>데이터가 쌓이면 예산 AI 추천이 활성화돼요</Text>
                  )}
                </View>
              </Animated.View>
            )}
          </View>

          <View style={styles.card}>
            <View onLayout={e => setCatPageWidth(p => p || e.nativeEvent.layout.width)}>
              <ScrollView
                ref={catScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const page = Math.round(e.nativeEvent.contentOffset.x / catPageWidth);
                  setCatTab(page === 0 ? 'bar' : 'pie');
                }}
              >
                <View style={{ width: catPageWidth }}>
                  {catData.filter(c => c.amount > 0).length === 0 ? (
                    <Text style={[styles.emptyText, { paddingVertical: 16 }]}>이달은 기록된 지출이 없어요</Text>
                  ) : (
                    <View style={{ gap: 16 }}>
                      {[...catData].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount).map(c => {
                        const over = c.budget > 0 && c.amount > c.budget;
                        const barColor = c.budgetPct >= 90 ? COLORS.red : c.budgetPct >= 70 ? COLORS.amber : themeColors.primary;
                        return (
                          <View key={c.cat}>
                            <View style={styles.catRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.catName}>{c.cat}</Text>
                                {c.prevDiff !== null && (
                                  <View style={[
                                    styles.prevDiffBadge,
                                    Math.abs(c.prevDiff) >= 20
                                      ? { backgroundColor: c.prevDiff > 0 ? COLORS.redBg : COLORS.greenBg }
                                      : { backgroundColor: COLORS.gray100 },
                                  ]}>
                                    <Text style={[
                                      styles.prevDiffText,
                                      Math.abs(c.prevDiff) >= 20
                                        ? { color: c.prevDiff > 0 ? COLORS.red : COLORS.green }
                                        : { color: COLORS.gray400 },
                                    ]}>
                                      {c.prevDiff > 0 ? '▲' : '▼'}{Math.abs(c.prevDiff)}%{c.prevDiff >= 20 ? ' ⚠️' : ''}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.catAmount}>{formatCurrency(c.amount)}</Text>
                            </View>
                            {c.budget > 0 ? (
                              <>
                                <View style={styles.thinTrack}>
                                  <View style={[styles.thinFill, { width: `${c.budgetPct}%`, backgroundColor: barColor }]} />
                                </View>
                                <Text style={styles.catSub}>예산 대비 {c.budgetPct}%{over ? ' (초과)' : ''}</Text>
                              </>
                            ) : (
                              <View style={styles.thinTrack}>
                                <View style={[styles.thinFill, {
                                  width: `${totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0}%`,
                                  backgroundColor: COLORS.gray300,
                                }]} />
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
                <View style={{ width: catPageWidth }}>
                  {donutData.length === 0 ? (
                    <Text style={[styles.emptyText, { paddingVertical: 16 }]}>이달은 기록된 지출이 없어요</Text>
                  ) : (
                    <>
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
                              <Text style={styles.legendLabel}>{item.cat}</Text>
                            </View>
                            <Text style={styles.legendPct}>
                              {Math.round((item.thisAmt / analyticsData!.thisTotal) * 100)}%
                            </Text>
                            <Text style={styles.legendAmt}>{formatCurrency(item.thisAmt)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
            <View style={styles.catDotRow}>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => { catScrollRef.current?.scrollTo({ x: 0, animated: true }); setCatTab('bar'); }}
              >
                <View style={[styles.catDot, catTab === 'bar' && { backgroundColor: themeColors.primary }]} />
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => { catScrollRef.current?.scrollTo({ x: catPageWidth, animated: true }); setCatTab('pie'); }}
              >
                <View style={[styles.catDot, catTab === 'pie' && { backgroundColor: themeColors.primary }]} />
              </TouchableOpacity>
            </View>
          </View>

          {threeMonths && threeMonths[0].total > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>📈 3개월 패턴</Text>
              <View style={{ gap: 8 }}>
                {threeMonths.map((m, i) => (
                  <View key={m.month} style={styles.patternRow}>
                    <Text style={styles.patternLabel}>{m.label}</Text>
                    <View style={styles.patternTrack}>
                      <View style={[styles.patternFill, {
                        width: `${maxTotal > 0 ? Math.round((m.total / maxTotal) * 100) : 0}%`,
                        backgroundColor: i === threeMonths.length - 1 ? themeColors.primary : themeColors.primaryMid,
                        minWidth: m.total > 0 ? 8 : 0,
                      }]} />
                    </View>
                    <Text style={styles.patternValue}>
                      {m.total > 0 ? formatCurrency(m.total) : '-'}
                    </Text>
                  </View>
                ))}
              </View>
              {patternComment && (
                <Text style={styles.patternComment}>{patternComment}</Text>
              )}
            </View>
          )}

          {/* 일별 지출 바 차트 */}
          {analyticsData && analyticsData.dailyData.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>📅 일별 지출</Text>
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
              <View style={styles.cumWrap}>
                <Text style={styles.cumLabel}>누적 지출</Text>
                <Text style={[styles.cumValue, { color: themeColors.primary }]}>
                  {formatCurrency(cumulativeData[todayDay - 1]?.cum ?? analyticsData.thisTotal)}
                </Text>
              </View>
            </View>
          )}

        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: COLORS.accent },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12, borderRadius: RADIUS.lg, paddingVertical: 8 },
  navBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { borderColor: COLORS.gray100 },
  navBtnText: { fontSize: 13, color: COLORS.gray600 },
  navBtnTextDisabled: { color: COLORS.gray200 },
  monthLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray700, minWidth: 76, textAlign: 'center' },

  emptyCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.gray100, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: '600', color: COLORS.gray500, marginBottom: 6 },
  emptyDesc: { fontSize: 11, color: COLORS.gray400, textAlign: 'center', lineHeight: 18 },
  emptyLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 14 },

  headerCard: { borderRadius: RADIUS.xl, padding: 20, marginBottom: 12 },
  headerCardLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  headerCardTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  headerStatsRow: { flexDirection: 'row', gap: 20 },
  headerStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  headerStatValue: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 2 },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.gray100, padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 10 },

  diffValue: { fontSize: 22, fontWeight: '800' },
  diffSub: { fontSize: 11, color: COLORS.gray400, marginBottom: 2 },
  diffDetail: { fontSize: 11, color: COLORS.gray400, marginTop: 6 },

  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  goalAmount: { fontSize: 18, fontWeight: '800' },
  goalSub: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  goalPct: { fontSize: 26, fontWeight: '800' },
  goalAchievedText: { fontSize: 11, color: COLORS.green, fontWeight: '700', marginTop: 8 },

  progressTrack: { backgroundColor: COLORS.gray100, borderRadius: 999, height: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },

  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  catName: { fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
  catAmount: { fontSize: 13, fontWeight: '700', color: COLORS.gray800 },
  prevDiffBadge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  prevDiffText: { fontSize: 9, fontWeight: '700' },
  thinTrack: { backgroundColor: COLORS.gray100, borderRadius: 999, height: 6, overflow: 'hidden' },
  thinFill: { height: '100%', borderRadius: 999 },
  catSub: { fontSize: 9, color: COLORS.gray400, marginTop: 3 },

  patternRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patternLabel: { fontSize: 11, color: COLORS.gray500, width: 28 },
  patternTrack: { flex: 1, backgroundColor: COLORS.gray100, borderRadius: 999, height: 20, overflow: 'hidden', justifyContent: 'center' },
  patternFill: { height: '100%', borderRadius: 999 },
  patternValue: { fontSize: 11, fontWeight: '700', color: COLORS.gray700, width: 80, textAlign: 'right' },
  patternComment: { fontSize: 11, color: COLORS.gray500, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray50 },

  catDotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  catDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gray200 },

  coachBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary },
  coachBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  coachStepTitle: { fontSize: 12, fontWeight: '700', color: COLORS.gray700, marginBottom: 4 },
  coachStepContent: { fontSize: 13, color: COLORS.gray600, lineHeight: 20 },
  coachFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray50 },
  coachCta: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center' },
  coachCtaText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // 일별 바 차트
  barChartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80, marginBottom: 8 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: 72, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 2 },
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
});
