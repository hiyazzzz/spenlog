import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, formatCurrency, useThemeColors } from '@/constants/theme';
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
  const knownRatio = spendCats.filter(c => c in preset.dist).reduce((s, c) => s + (preset.dist[c] ?? 0), 0);
  const unknownCats = spendCats.filter(c => !(c in preset.dist));
  const unknownRatio = unknownCats.length > 0 ? Math.max(0, 1 - knownRatio) / unknownCats.length : 0;
  return Object.fromEntries(
    spendCats.map(cat => [cat, Math.round(spendBudget * (cat in preset.dist ? (preset.dist[cat] ?? 0) : unknownRatio))])
  );
}

export default function BudgetScreen() {
  const { themeColors } = useThemeColors();
  const [tab, setTab] = useState<'manual' | 'ai'>('manual');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledCats, setEnabledCats] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
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
      const result = await getBudgetData(userId);
      setData(result);
      const budgetMap: Record<string, number> = {};
      result.budgets.forEach(b => { budgetMap[b.category] = b.amount; });
      setEnabledCats(Object.fromEntries(result.customCategories.map(c => [c, true])));
      setAmounts(Object.fromEntries(result.customCategories.map(c => [c, String(budgetMap[c] ?? '')])));
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
      const result = await recommendBudget({
        income: data.income,
        fixedSavings: data.fixedSavings,
        recentExpenses: data.recentExpenses,
        currentBudgets: data.budgets.map(b => ({ category: b.category, amount: b.amount })),
        categories,
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
      const planEnabled = Object.fromEntries(categories.map(c => [c, true]));
      const planAmountStrings = Object.fromEntries(categories.map(c => [c, String(planAmounts[c] ?? 0)]));
      await saveBudgets(userId, monthString(), categories, planEnabled, planAmountStrings, 'ai');
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

  const totalBudget = categories.filter(c => enabledCats[c]).reduce((s, c) => s + (parseInt(amounts[c] || '0') || 0), 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: themeColors.accent }]}>예산 설정</Text>
      <Text style={styles.pageSubtitle}>2026년 6월 카테고리별 목표 예산</Text>

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
        <View style={styles.card}>
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

          {aiAmounts && (
            <View style={styles.aiResultBox}>
              {aiReason && <Text style={styles.aiReasonText}>{aiReason}</Text>}
              {categories.filter(c => c !== '수입').map(cat => (
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
              onPress={() => handleSavePlan(presetAmounts(income, categories, PRESETS.find(p => p.key === selectedPreset)!))}
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
            <View style={styles.card}>
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
            {categories.map(cat => {
              const spent = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
              const budget = parseInt(amounts[cat] || '0') || 0;
              const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
              const over = spent > budget && budget > 0;
              const enabled = enabledCats[cat];

              return (
                <View key={cat} style={[styles.budgetItem, !enabled && { opacity: 0.45 }]}>
                  <View style={styles.budgetItemRow}>
                    <Text style={[styles.budgetItemLabel, { color: themeColors.accent }]}>{cat}</Text>
                    <View style={styles.budgetInputBox}>
                      <TextInput
                        style={styles.budgetInput}
                        keyboardType="numeric"
                        editable={enabled}
                        placeholder="0"
                        placeholderTextColor={COLORS.gray400}
                        value={amounts[cat] ? Number(amounts[cat]).toLocaleString() : ''}
                        onChangeText={v => handleChange(cat, v)}
                      />
                      <Text style={styles.budgetInputUnit}>원</Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={() => setEnabledCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
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
          </View>

          <TouchableOpacity style={[styles.saveBtn, { marginTop: 20 }]} onPress={handleSave} disabled={saving}>
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
});
