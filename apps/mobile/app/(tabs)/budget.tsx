import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import { COLORS, RADIUS, formatCurrency, useThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { monthString } from '@/lib/date';
import { getBudgetData, saveBudgets, recommendBudget, type BudgetData } from '@/lib/api/budget';

const PRESETS = [
  { key: '알뜰', label: '💰 알뜰하게', desc: '수입의 40% 저축', savingRate: 0.4, dist: { 생활비: 0.40, 고정비: 0.35, 활동비: 0.25 } as Record<string, number> },
  { key: '균형', label: '⚖️ 균형있게', desc: '수입의 25% 저축', savingRate: 0.25, dist: { 생활비: 0.40, 고정비: 0.35, 활동비: 0.25 } as Record<string, number> },
  { key: '여유', label: '🌈 여유있게', desc: '수입의 15% 저축', savingRate: 0.15, dist: { 생활비: 0.40, 고정비: 0.35, 활동비: 0.25 } as Record<string, number> },
] as const;

function presetAmounts(income: number, categories: string[], preset: typeof PRESETS[number]): Record<string, number> {
  const targetSave = Math.round(income * preset.savingRate);
  const spendBudget = income - targetSave;
  const spendCats = categories.filter(c => c !== '수입');
  if (spendCats.length === 0) return {};

  // 알려진 카테고리는 preset.dist 비율, 미지정 카테고리는 0.1 기본값 부여 후 전체 정규화
  const BASE_RATIO = 0.1;
  const rawRatios: Record<string, number> = Object.fromEntries(
    spendCats.map(cat => [cat, cat in preset.dist ? (preset.dist[cat] ?? 0) : BASE_RATIO])
  );

  // 전체 합산으로 정규화 → ON 카테고리 합이 항상 spendBudget이 되도록
  const totalRatio = Object.values(rawRatios).reduce((s, r) => s + r, 0);
  return Object.fromEntries(
    spendCats.map(cat => [cat, totalRatio > 0 ? Math.round(spendBudget * rawRatios[cat] / totalRatio) : 0])
  );
}

export default function BudgetScreen() {
  const { themeColors } = useThemeColors();
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<'manual' | 'ai'>('manual');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledCats, setEnabledCats] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savedAmountsRef = useRef<Record<string, string>>({});
  const savedEnabledRef = useRef<Record<string, boolean>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAmounts, setAiAmounts] = useState<Record<string, number> | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [savingAiPlan, setSavingAiPlan] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) {
        setError('로그인이 필요해요');
        return;
      }
      // 캐시 먼저 표시
      const cached = useDataCache.getState().budget;
      if (cached) { setData(cached); setLoading(false); }

      const result = await getBudgetData(userId);
      useDataCache.getState().setBudget(result);
      setData(result);
      const budgetMap: Record<string, number> = {};
      result.budgets.forEach(b => { budgetMap[b.category] = b.amount; });
      // 저장된 예산 행이 있으면 해당 카테고리만 ON, 없으면 전체 ON (최초 설정)
      const hasSavedBudgets = result.budgets.length > 0;
      setEnabledCats(Object.fromEntries(result.customCategories.map(c => [c, hasSavedBudgets ? (c in budgetMap) : true])));
      const initAmounts = Object.fromEntries(result.customCategories.map(c => [c, String(budgetMap[c] ?? '')]));
      setAmounts(initAmounts);
      savedAmountsRef.current = initAmounts;
      const hasSavedBudgets2 = result.budgets.length > 0;
      savedEnabledRef.current = Object.fromEntries(result.customCategories.map(c => [c, hasSavedBudgets2 ? (c in budgetMap) : true]));
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyText}>{error ?? '데이터를 불러오지 못했어요'}</Text>
      </View>
    );
  }

  const categories = data.customCategories;
  const income = data.income;
  const expenses = data.expenses;

  function handleChange(cat: string, value: string) {
    setAmounts(prev => ({ ...prev, [cat]: value.replace(/[^0-9]/g, '') }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert('로그인이 필요해요');
        return;
      }
      await saveBudgets(userId, monthString(), categories, enabledCats, amounts);
      Alert.alert('저장 완료', '예산이 저장됐어요');
      await load();
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  }

  function handleSelectPreset(key: string) {
    setSelectedPreset(key);
    setAiAmounts(null);
    setAiReason(null);
  }

  async function handleAiRecommend() {
    if (aiLoading || !data) return;
    setAiLoading(true);
    try {
      const activeCats = categories.filter(c => c !== '수입' && enabledCats[c]);
      const result = await recommendBudget({
        income: data.income,
        fixedSavings: data.fixedSavings,
        recentExpenses: data.recentExpenses,
        currentBudgets: data.budgets.map(b => ({ category: b.category, amount: b.amount })),
        categories: activeCats,
      });
      setAiAmounts(result.amounts);
      setAiReason(result.reason ?? null);
      setSelectedPreset(null);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSavePlan(planAmounts: Record<string, number>) {
    if (savingAiPlan) return;
    setSavingAiPlan(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert('로그인이 필요해요');
        return;
      }
      // OFF 카테고리는 유지 — enabledCats 그대로 전달
      const planAmountStrings = Object.fromEntries(categories.map(c => [c, String(planAmounts[c] ?? 0)]));
      await saveBudgets(userId, monthString(), categories, enabledCats, planAmountStrings, 'ai');
      Alert.alert('저장 완료', '예산이 저장됐어요');
      setSelectedPreset(null);
      setAiAmounts(null);
      setAiReason(null);
      setTab('manual');
      await load();
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '저장에 실패했어요');
    } finally {
      setSavingAiPlan(false);
    }
  }

  const isDirty = categories.some(cat =>
    amounts[cat] !== savedAmountsRef.current[cat] ||
    enabledCats[cat] !== savedEnabledRef.current[cat]
  );
  const totalBudget = categories.filter(c => enabledCats[c]).reduce((s, c) => s + (parseInt(amounts[c] || '0') || 0), 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.pageTitle, { color: themeColors.accent }]}>예산 설정</Text>
      <Text style={[styles.pageSubtitle, { color: colors.gray400 }]}>2026년 6월 카테고리별 목표 예산</Text>

      {/* 탭 */}
      <View style={styles.tabBar}>
        {(['manual', 'ai'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { backgroundColor: themeColors.primary }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'manual' ? '직접 설정' : 'AI 추천'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'ai' && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.aiBasisText}>월 수입 {formatCurrency(income)} 기준으로 추천해요</Text>
          <View style={styles.presetRow}>
            {PRESETS.map(preset => {
              const selected = selectedPreset === preset.key;
              const targetSave = Math.round(income * preset.savingRate);
              const spendBudget = income - targetSave;
              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.presetCard, selected && { borderColor: themeColors.primary, backgroundColor: themeColors.primaryLight }]}
                  onPress={() => handleSelectPreset(preset.key)}
                >
                  <Text style={[styles.presetLabel, { color: themeColors.primary }]}>{preset.label}</Text>
                  <Text style={styles.presetDesc}>{preset.desc}</Text>
                  <Text style={styles.presetBudget}>{formatCurrency(spendBudget)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.aiRecommendBtn} onPress={handleAiRecommend} disabled={aiLoading}>
            {aiLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.aiRecommendBtnText}>✨ 내 소비 패턴으로 AI 추천받기</Text>
            )}
          </TouchableOpacity>

          {/* 저축 분석 — 프리셋 선택 시 */}
          {selectedPreset && income > 0 && !aiAmounts && (() => {
            const preset = PRESETS.find(p => p.key === selectedPreset);
            if (!preset) return null;
            const targetSave = Math.round(income * preset.savingRate);
            const addSave = Math.max(0, targetSave - (data?.fixedSavings ?? 0));
            return (
              <View style={styles.savingAnalysisBox}>
                <Text style={styles.savingAnalysisTitle}>💰 저축 플랜</Text>
                <View style={styles.savingAnalysisRow}>
                  <Text style={styles.savingAnalysisLabel}>목표 저축</Text>
                  <Text style={[styles.savingAnalysisValue, { color: COLORS.green }]}>{formatCurrency(targetSave)}</Text>
                </View>
                {(data?.fixedSavings ?? 0) > 0 && (
                  <View style={styles.savingAnalysisRow}>
                    <Text style={styles.savingAnalysisLabel}>고정저축 (확보됨)</Text>
                    <Text style={styles.savingAnalysisMuted}>{formatCurrency(data!.fixedSavings)}</Text>
                  </View>
                )}
                <View style={[styles.savingAnalysisRow, styles.savingAnalysisDivider]}>
                  <Text style={styles.savingAnalysisLabel}>추가 저축 필요</Text>
                  <Text style={[styles.savingAnalysisValue, { color: COLORS.green, fontWeight: '800' }]}>{formatCurrency(addSave)}</Text>
                </View>
              </View>
            );
          })()}

          {/* 지출 예산 배분 미리보기 — 프리셋 선택 시 */}
          {selectedPreset && income > 0 && !aiAmounts && (() => {
            const preset = PRESETS.find(p => p.key === selectedPreset);
            if (!preset) return null;
            const activeCats = categories.filter(c => c !== '수입' && enabledCats[c]);
            const plan = presetAmounts(income, activeCats, preset);
            if (activeCats.length === 0) return null;
            return (
              <View style={styles.aiResultBox}>
                <Text style={styles.savingAnalysisTitle}>📊 지출 예산 배분</Text>
                {activeCats.map(cat => (
                  <View key={cat} style={styles.aiResultRow}>
                    <Text style={[styles.aiResultLabel, { color: themeColors.accent }]}>{cat}</Text>
                    <Text style={styles.aiResultValue}>{formatCurrency(plan[cat] ?? 0)}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {aiAmounts && (
            <View style={styles.aiResultBox}>
              {aiReason && <Text style={styles.aiReasonText}>{aiReason}</Text>}
              {categories.filter(c => c !== '수입' && enabledCats[c]).map(cat => (
                <View key={cat} style={styles.aiResultRow}>
                  <Text style={[styles.aiResultLabel, { color: themeColors.accent }]}>{cat}</Text>
                  <Text style={styles.aiResultValue}>{formatCurrency(aiAmounts[cat] ?? 0)}</Text>
                </View>
              ))}
            </View>
          )}

          {aiAmounts ? (
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColors.primary }]} onPress={() => handleSavePlan(aiAmounts)} disabled={savingAiPlan}>
              <Text style={styles.saveBtnText}>{savingAiPlan ? '저장 중...' : '이 플랜으로 저장하기'}</Text>
            </TouchableOpacity>
          ) : selectedPreset ? (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: themeColors.primary }]}
              onPress={() => {
                // OFF 카테고리 제외하고 정규화된 비율로 배분
                const activeCats = categories.filter(c => c !== '수입' && enabledCats[c]);
                handleSavePlan(presetAmounts(income, activeCats, PRESETS.find(p => p.key === selectedPreset)!));
              }}
              disabled={savingAiPlan}
            >
              <Text style={styles.saveBtnText}>{savingAiPlan ? '저장 중...' : '이 플랜으로 저장하기'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {tab === 'manual' && (
        <>
          {totalBudget > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressHeaderLabel}>전체 사용률</Text>
                <Text style={[
                  styles.progressHeaderPct,
                  { color: overallPct > 100 ? COLORS.red : overallPct >= 80 ? COLORS.amber : '#059669' },
                ]}>{overallPct}%</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(overallPct, 100)}%`,
                    backgroundColor: overallPct > 100 ? COLORS.red : overallPct >= 80 ? COLORS.amber : themeColors.primary,
                  },
                ]} />
              </View>
              <View style={styles.progressFooterRow}>
                <Text style={styles.progressFooterText}>지출 {formatCurrency(totalSpent)}</Text>
                <Text style={styles.progressFooterText}>예산 {formatCurrency(totalBudget)}</Text>
              </View>
            </View>
          )}

          <View style={{ gap: 12, marginTop: 12 }}>
            {/* ON 카테고리만 표시 */}
            {categories.filter(cat => enabledCats[cat]).map(cat => {
              const spent = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
              const budget = parseInt(amounts[cat] || '0') || 0;
              const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
              const over = spent > budget && budget > 0;

              return (
                <View key={cat} style={styles.budgetItem}>
                  <View style={styles.budgetItemRow}>
                    <Text style={[styles.budgetItemLabel, { color: themeColors.accent }]}>{cat}</Text>
                    <View style={styles.budgetInputBox}>
                      <TextInput
                        style={styles.budgetInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.gray400}
                        value={amounts[cat] ? Number(amounts[cat]).toLocaleString() : ''}
                        onChangeText={v => handleChange(cat, v)}
                      />
                      <Text style={styles.budgetInputUnit}>원</Text>
                    </View>
                    <Switch
                      value={true}
                      onValueChange={() => setEnabledCats(prev => ({ ...prev, [cat]: false }))}
                      trackColor={{ false: COLORS.gray300, true: themeColors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  {budget > 0 && (
                    <View style={styles.budgetProgressWrap}>
                      <View style={styles.progressBgSmall}>
                        <View style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: over ? COLORS.red : pct >= 80 ? COLORS.amber : themeColors.primary,
                          },
                        ]} />
                      </View>
                      <View style={styles.budgetProgressFooter}>
                        <Text style={[styles.budgetProgressText, over && { color: COLORS.red, fontWeight: '600' }]}>
                          {spent > 0 ? `${formatCurrency(spent)} 사용` : '아직 지출 없음'}
                        </Text>
                        <Text style={styles.budgetProgressText}>{pct}%{over ? ' 초과!' : ''}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* OFF 카테고리 — 추가 버튼으로 표시 */}
            {categories.filter(cat => !enabledCats[cat]).length > 0 && (
              <View style={styles.offCatsSection}>
                <Text style={[styles.offCatsSectionLabel, { color: colors.gray400 }]}>비활성 카테고리</Text>
                <View style={styles.offCatsRow}>
                  {categories.filter(cat => !enabledCats[cat]).map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.offCatChip, { borderColor: colors.border }]}
                      onPress={() => setEnabledCats(prev => ({ ...prev, [cat]: true }))}
                    >
                      <Text style={[styles.offCatChipText, { color: colors.gray400 }]}>+ {cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.saveBtn, { marginTop: 20, opacity: (saving || !isDirty) ? 0.55 : 1 }]} onPress={handleSave} disabled={saving || !isDirty}>
            <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '저장하기'}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  pageTitle: { fontSize: 18, fontWeight: '600', color: COLORS.accent, marginBottom: 4 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 16 },
  pageSubtitle: { fontSize: 12, color: COLORS.gray400, marginBottom: 16 },

  tabBar: { flexDirection: 'row', backgroundColor: '#F0EAEC', borderRadius: RADIUS.lg, padding: 4, gap: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#B8A8AC' },
  tabBtnTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, padding: 16 },
  aiBasisText: { fontSize: 12, color: COLORS.gray400, marginBottom: 12 },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetCard: {
    flex: 1, padding: 10, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.gray100, backgroundColor: '#fafafa', alignItems: 'center',
  },
  presetCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  presetLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 2, textAlign: 'center' },
  presetDesc: { fontSize: 10, color: COLORS.gray400, marginBottom: 4, textAlign: 'center' },
  presetBudget: { fontSize: 11, fontWeight: '600', color: '#555' },

  aiRecommendBtn: {
    width: '100%', padding: 12, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.gray200, borderStyle: 'dashed',
    backgroundColor: '#fafafa', alignItems: 'center', marginBottom: 4,
  },
  aiRecommendBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },

  saveBtn: { width: '100%', padding: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  aiResultBox: { marginTop: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: '#fafafa', borderWidth: 1, borderColor: COLORS.gray100 },
  aiReasonText: { fontSize: 12, color: COLORS.gray500, marginBottom: 8 },
  aiResultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  aiResultLabel: { fontSize: 13, fontWeight: '600', color: COLORS.accent },
  aiResultValue: { fontSize: 13, fontWeight: '700', color: COLORS.gray700 },

  progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressHeaderLabel: { fontSize: 12, fontWeight: '600', color: COLORS.gray500 },
  progressHeaderPct: { fontSize: 12, fontWeight: '800' },
  progressBg: { backgroundColor: COLORS.gray100, borderRadius: 99, height: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  progressFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressFooterText: { fontSize: 11, color: COLORS.gray400 },

  budgetItem: { marginBottom: 4 },
  budgetItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetItemLabel: { fontSize: 13, fontWeight: '600', color: COLORS.accent, minWidth: 44 },
  budgetInputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  budgetInput: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.gray700, textAlign: 'right' },
  budgetInputUnit: { fontSize: 12, color: COLORS.gray400 },
  budgetProgressWrap: { paddingLeft: 52, paddingRight: 48, marginTop: 4 },
  progressBgSmall: { backgroundColor: COLORS.gray100, borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 3 },
  budgetProgressFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetProgressText: { fontSize: 10, color: COLORS.gray400 },

  offCatsSection: { marginTop: 8 },
  offCatsSectionLabel: { fontSize: 11, marginBottom: 8 },
  offCatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offCatChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderStyle: 'dashed' as const,
  },
  offCatChipText: { fontSize: 12, fontWeight: '600' },

  savingAnalysisBox: {
    backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.md,
    padding: 12, marginBottom: 12,
  },
  savingAnalysisTitle: { fontSize: 12, fontWeight: '700', color: '#059669', marginBottom: 8 },
  savingAnalysisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  savingAnalysisLabel: { fontSize: 12, color: COLORS.gray500 },
  savingAnalysisValue: { fontSize: 12, fontWeight: '700', color: COLORS.green },
  savingAnalysisMuted: { fontSize: 12, color: COLORS.gray600 },
  savingAnalysisDivider: { borderTopWidth: 1, borderTopColor: 'rgba(16,185,129,0.2)', marginTop: 4, paddingTop: 6 },
});
