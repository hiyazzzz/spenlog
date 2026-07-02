import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import dayjs from 'dayjs';
import { COLORS, RADIUS, formatCurrency, getThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getReportData, getAiCoach, getCoachBlocks, type ReportData, type Coach, type CoachErrorCode } from '@/lib/api/report';
import { getAnalyticsData, type AnalyticsData } from '@/lib/api/analytics';

const MIN_CARD_HEIGHT = 380;
const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

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
  const [hasCoachCache, setHasCoachCache] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [slideTab, setSlideTab] = useState<'budget' | 'compare' | 'daily'>('budget');
  const buttonAnim = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const slideScrollRef = useRef<ScrollView>(null);
  const [slidePageWidth, setSlidePageWidth] = useState(0);
  const [tapDay, setTapDay] = useState<number | null>(null);

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
      setHasCoachCache(data.hasCoachCache);
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
  const firstDow = dayjs(_month).startOf('month').day();
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
    setSlideTab('budget');
    setTapDay(null);
    slideScrollRef.current?.scrollTo({ x: 0, animated: false });
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
    totalSpent, spendingDiff,
    savingGoal, savedAmount, savingPct,
    catData, topCategory, noSpendDays, threeMonths, maxTotal, patternComment, hasEnoughData,
  } = report;

  const monthLabel = dayjs(currentMonth).format('YYYY년 M월');
  const canGoNext = currentMonth < maxMonth;
  const goalAchieved = savingGoal > 0 && savedAmount >= savingGoal;
  const themeColors = getThemeColors(report.profile?.theme);
  const headerBg = goalAchieved ? COLORS.green : themeColors.primary;

  const headerTitle = goalAchieved
    ? '저축 목표 달성! 🎉'
    : savingGoal > 0
      ? '조금 아쉽지만, 다음 달엔 꼭! 💪'
      : spendingDiff !== null && spendingDiff < 0
        ? '이번 달 잘 아꼈어요 🌿'
        : `${formatCurrency(totalSpent)} 지출`;

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
            <View style={styles.heroSplitRow}>
              <Text style={styles.heroLeft}>
                {savingGoal > 0
                  ? <>목표의 {savingPct}% 달성 <Text style={styles.heroLeftSub}>({formatCurrency(savedAmount)})</Text></>
                  : `이번 달 저축 ${formatCurrency(savedAmount)}`}
              </Text>
              <Text style={styles.heroRight}>
                {monthLabel} 총지출 {formatCurrency(totalSpent)}
                {topCategory ? ` │ 가장 많이 쓴 카테고리 "${topCategory}"` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>🤖 AI 코치</Text>

            {!coach && !coachErrorCode && !coachLoading && (
              <Animated.View style={{ opacity: buttonAnim, alignItems: 'center', paddingVertical: 16 }}>
                <TouchableOpacity
                  style={[styles.coachBtn, { backgroundColor: themeColors.primary }]}
                  onPress={loadCoachWithAnim}
                >
                  <Text style={styles.coachBtnText}>{hasCoachCache ? '🔓 AI 코치 보기' : '🔒 AI 코치 받기'}</Text>
                </TouchableOpacity>
                <Text style={[styles.emptyText, { marginTop: 8 }]}>
                  {hasCoachCache ? '이미 분석된 결과가 있어요' : 'AI가 이번 달 소비 패턴을 분석해드려요'}
                </Text>
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
                    : coachErrorCode === 'MONTH_NOT_COMPLETE' ? '이번 달이 끝나면 코치를 받을 수 있어요'
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
                <View style={{ gap: 16 }}>
                  {getCoachBlocks(coach).map((block, bi) => {
                    const textNode = (textColor?: string) => (
                      <Text style={[styles.coachStepContent, textColor ? { color: textColor } : null]}>
                        {block.segments.map((seg, si) => (
                          <Text key={si} style={seg.bold ? (textColor ? { fontWeight: '700' as const } : styles.coachBold) : undefined}>{seg.text}</Text>
                        ))}
                      </Text>
                    );
                    if (block.type === 'warning') {
                      return (
                        <View key={bi} style={{ backgroundColor: COLORS.redBg, borderRadius: RADIUS.lg, padding: 12 }}>
                          {textNode(COLORS.red)}
                        </View>
                      );
                    }
                    if (block.type === 'solution') {
                      return (
                        <View key={bi} style={{ backgroundColor: themeColors.primaryLight, borderRadius: RADIUS.lg, paddingVertical: 12, paddingHorizontal: 16 }}>
                          {textNode(themeColors.primary)}
                        </View>
                      );
                    }
                    return <View key={bi}>{textNode()}</View>;
                  })}
                </View>
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

          {/* 3-카드 슬라이드: 카테고리별 예산사용량 / 전월대비 / 일별소비패턴 */}
          <View style={styles.sliderCard}>
            <View
              onLayout={e => { const w = e?.nativeEvent?.layout?.width; if (w) setSlidePageWidth(p => p || w); }}
              style={{ overflow: 'hidden' }}
            >
              <ScrollView
                ref={slideScrollRef}
                horizontal
                pagingEnabled
                decelerationRate="fast"
                bounces={false}
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const page = Math.round(e.nativeEvent.contentOffset.x / slidePageWidth);
                  setSlideTab(page === 0 ? 'budget' : page === 1 ? 'compare' : 'daily');
                }}
              >
                {/* 카드 1: 카테고리별 예산 사용량 */}
                <View style={{ width: slidePageWidth, minHeight: MIN_CARD_HEIGHT }}>
                  <Text style={styles.cardLabel}>카테고리별 예산 사용량</Text>
                  {catData.filter(c => c.amount > 0).length === 0 ? (
                    <View style={styles.cardEmptyWrap}>
                      <Text style={styles.emptyText}>이달은 기록된 지출이 없어요</Text>
                    </View>
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'space-between', gap: 16 }}>
                      {[...catData].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount).map(c => {
                        const over = c.budget > 0 && c.amount > c.budget;
                        const barColor = over ? COLORS.red : themeColors.primary;
                        return (
                          <View key={c.cat}>
                            <View style={styles.catRow}>
                              <Text style={styles.catName}>{c.cat}</Text>
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

                {/* 카드 2: 전월 대비 지출 비교 */}
                <View style={{ width: slidePageWidth, minHeight: MIN_CARD_HEIGHT }}>
                  <Text style={styles.cardLabel}>🔄 전월 대비 지출 비교</Text>
                  {catData.filter(c => c.amount > 0).length === 0 ? (
                    <View style={styles.cardEmptyWrap}>
                      <Text style={styles.emptyText}>이달은 기록된 지출이 없어요</Text>
                    </View>
                  ) : (
                    <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 12 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {[...catData].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5).map(c => {
                        const diff = c.amount - c.prevAmount;
                        const isNew = c.prevAmount === 0;
                        return (
                          <View key={c.cat} style={styles.compareRow}>
                            <Text style={styles.catName}>{c.cat}</Text>
                            {isNew ? (
                              <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>신규</Text>
                              </View>
                            ) : (
                              <Text style={[styles.compareDiff, { color: diff > 0 ? COLORS.red : diff < 0 ? COLORS.green : COLORS.gray400 }]}>
                                {diff > 0 ? '🔺' : diff < 0 ? '🔽' : '-'} {formatCurrency(Math.abs(diff))}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                {/* 카드 3: 일별 소비 패턴 */}
                <View style={{ width: slidePageWidth, minHeight: MIN_CARD_HEIGHT }}>
                  <Text style={styles.cardLabel}>📅 일별 소비 패턴</Text>
                  <View style={[styles.noSpendBadge, { backgroundColor: themeColors.primaryMid }]}>
                    <Text style={styles.noSpendBadgeText}>무지출 데이 {noSpendDays}일</Text>
                  </View>
                  {analyticsData && analyticsData.dailyData.length > 0 ? (() => {
                    // 무지출 데이 연속 구간(같은 주 내 좌우 연결)을 하나의 띠로 이어붙이기 위한 폭 계산
                    const cellW = slidePageWidth / 7;
                    const tileW = cellW * 0.82;
                    const gapW = cellW - tileW;
                    const isNoSpendAt = (idx: number) => idx >= firstDow && cumulativeData[idx - firstDow]?.daily === 0;
                    const streakPos = (idx: number): 'solo' | 'start' | 'mid' | 'end' => {
                      const col = idx % 7;
                      const prevLinked = col > 0 && isNoSpendAt(idx - 1);
                      const nextLinked = col < 6 && isNoSpendAt(idx + 1);
                      if (prevLinked && nextLinked) return 'mid';
                      if (!prevLinked && nextLinked) return 'start';
                      if (prevLinked && !nextLinked) return 'end';
                      return 'solo';
                    };
                    return (
                      <View style={{ flex: 1 }}>
                        <View style={styles.calWeekRow}>
                          {WEEK_LABELS.map(w => (
                            <Text key={w} style={styles.calWeekLabel}>{w}</Text>
                          ))}
                        </View>
                        <View style={styles.calGrid}>
                          {Array.from({ length: firstDow }).map((_, i) => (
                            <View key={`blank-${i}`} style={styles.calCell} />
                          ))}
                          {cumulativeData.map((d, i) => {
                            const idx = firstDow + i;
                            const isNoSpend = d.daily === 0;
                            const isTapped = tapDay === d.day;
                            const pos = isNoSpend ? streakPos(idx) : 'solo';
                            const tileLayout = pos === 'mid'
                              ? { width: cellW, height: tileW, marginLeft: 0, borderRadius: 0 }
                              : pos === 'start'
                                ? { width: tileW + gapW / 2, height: tileW, marginLeft: gapW / 2, borderTopLeftRadius: RADIUS.md, borderBottomLeftRadius: RADIUS.md, borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                                : pos === 'end'
                                  ? { width: tileW + gapW / 2, height: tileW, marginLeft: 0, borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
                                  : { width: tileW, height: tileW, marginLeft: gapW / 2, borderRadius: RADIUS.md }
                            return (
                              <View key={d.day} style={styles.calCell}>
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  disabled={isNoSpend}
                                  onPress={() => setTapDay(isTapped ? null : d.day)}
                                  style={[styles.calTile, tileLayout, isNoSpend && { backgroundColor: `${themeColors.primary}B3` }]}
                                >
                                  <Text style={[styles.calTileText, isNoSpend && styles.calTileTextNoSpend]}>{d.day}</Text>
                                </TouchableOpacity>
                                {isTapped && !isNoSpend && (
                                  <View style={styles.calTooltip} pointerEvents="none">
                                    <Text style={styles.calTooltipText}>{formatCurrency(d.daily)}</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })() : (
                    <View style={styles.cardEmptyWrap}>
                      <Text style={styles.emptyText}>일별 데이터가 없어요</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* 슬라이드 도트 인디케이터 */}
            <View style={styles.catDotRow}>
              {(['budget', 'compare', 'daily'] as const).map((tab, i) => (
                <TouchableOpacity
                  key={tab}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    slideScrollRef.current?.scrollTo({ x: slidePageWidth * i, animated: true });
                    setSlideTab(tab);
                  }}
                >
                  <View style={[styles.catDot, slideTab === tab && { backgroundColor: themeColors.primary }]} />
                </TouchableOpacity>
              ))}
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
  heroSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 },
  heroLeft: { fontSize: 20, fontWeight: '700', color: '#fff' },
  heroLeftSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  heroRight: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flexShrink: 1, textAlign: 'right' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.gray100, padding: 16, marginBottom: 12 },
  sliderCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, padding: 24, marginBottom: 12 },
  cardLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 10 },

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
  thinTrack: { backgroundColor: COLORS.gray100, borderRadius: 999, height: 12, overflow: 'hidden' },
  thinFill: { height: '100%', borderRadius: 999 },
  catSub: { fontSize: 9, color: COLORS.gray400, marginTop: 3 },

  compareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareDiff: { fontSize: 13, fontWeight: '700' },
  newBadge: { backgroundColor: COLORS.gray100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  newBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.gray400 },

  noSpendBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  noSpendBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardEmptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  coachStepContent: { fontSize: 13, color: COLORS.gray600, lineHeight: 21 },
  coachBold: { fontWeight: '700', color: COLORS.gray800 },
  coachFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray50 },
  coachCta: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center' },
  coachCtaText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // 일별 소비 패턴 미니 캘린더
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, color: COLORS.gray400, fontWeight: '500' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'flex-start', justifyContent: 'center', position: 'relative' },
  calTile: { alignItems: 'center', justifyContent: 'center' },
  calTileText: { fontSize: 12, color: COLORS.gray800 },
  calTileTextNoSpend: { color: '#fff', fontWeight: '700' },
  calTooltip: {
    position: 'absolute', top: -30, alignSelf: 'center', backgroundColor: '#1F2937',
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, zIndex: 50,
  },
  calTooltipText: { fontSize: 10, color: '#fff', fontWeight: '600' },
});
