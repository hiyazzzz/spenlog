import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, ImageBackground, Keyboard } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, getThemeColors, getThemeCardPalette, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getHomeData, type HomeData } from '@/lib/api/home';
import { parseAiInput, addExpenses } from '@/lib/api/expenses';
import HomeEditModal from '@/components/HomeEditModal';
import SlideUpModal from '@/components/SlideUpModal';
import { useThemeStore } from '@/store/themeStore';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const setStoreTheme = useThemeStore((s) => s.setTheme);
  const [aiInput, setAiInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmItems, setConfirmItems] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'expense' | 'income'>('expense');

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) {
        setError('로그인이 필요해요');
        return;
      }
      setUserId(uid);
      const homeData = await getHomeData(uid);
      setData(homeData);
      if (homeData?.profile?.theme) setStoreTheme(homeData.profile.theme);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAiSubmit() {
    const text = aiInput.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) { Alert.alert('로그인이 필요해요'); return; }
      const result = await parseAiInput(text);
      if (!result.items || result.items.length === 0) {
        Alert.alert('인식 실패', result.error ?? '금액을 인식하지 못했어요.\n예) 스타벅스 육천원 카드');
        return;
      }
      setConfirmItems(result.items);
      setShowConfirm(true);
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSave() {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const { error: saveErr } = await addExpenses(uid, confirmItems);
      if (saveErr) { Alert.alert('저장 실패', saveErr.message); return; }
      setShowConfirm(false);
      setConfirmItems([]);
      setAiInput('');
      await load();
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요');
    }
  }

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

  const allExpenses = data.expenses;
  const totalSpent = allExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const recentExpenses = allExpenses.filter(e => e.type === 'expense').slice(0, 3);
  const savingGoal = data.profile?.saving_goal ?? 0;
  const income = data.profile?.income ?? 0;
  const fixedSavingsTotal = data.fixedCosts.filter(f => f.kind === '고정저축').reduce((s, f) => s + f.amount, 0);
  const actualSaving = fixedSavingsTotal + Math.max(0, income - totalSpent - fixedSavingsTotal);
  const displayName = data.profile?.name || '소비요정';

  const categories = data.categories.map(c => c.name);
  const budgetMap: Record<string, number> = {};
  data.budgets.forEach(b => { budgetMap[b.category] = b.amount; });

  const catMap: Record<string, number> = {};
  allExpenses.filter(e => e.type !== 'income').forEach(e => {
    catMap[e.category] = (catMap[e.category] ?? 0) - e.amount;
  });

  const themeColors = getThemeColors(data.profile?.theme);
  const cardPalette = getThemeCardPalette(data.profile?.theme);

  const coverUrl = data.profile?.home_cover_url ?? null;
  const gifAutoplay = data.profile?.gif_autoplay ?? true;
  const categoryImgUrls = [
    data.profile?.category_img_url_1 ?? null,
    data.profile?.category_img_url_2 ?? null,
    data.profile?.category_img_url_3 ?? null,
    data.profile?.category_img_url_4 ?? null,
  ];

  const coverContent = (
    <>
      <View style={styles.coverOverlay} />
      <TouchableOpacity style={styles.coverEditBtn} onPress={() => setEditOpen(true)} activeOpacity={0.8}>
        <Text style={styles.coverEditBtnText}>✦ 홈 꾸미기</Text>
      </TouchableOpacity>
      <View style={styles.coverGreeting}>
        <Text style={styles.coverHello}>안녕하세요 👋</Text>
        <Text style={styles.coverName}>{displayName}님</Text>
      </View>
      <View style={styles.coverStatsBar}>
        <View>
          <Text style={styles.coverStatLabel}>이번 달 지출</Text>
          <Text style={styles.coverStatValue}>{formatCurrency(totalSpent)}</Text>
        </View>
        {savingGoal > 0 && (
          <>
            <View style={styles.coverDivider} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.coverStatLabel}>저축 달성</Text>
              <Text style={styles.coverSavingValue}>
                {formatCurrency(actualSaving)} / {formatCurrency(savingGoal)}
              </Text>
            </View>
          </>
        )}
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
      {/* 커버 배너 */}
      {coverUrl ? (
        <ImageBackground
          key={`cover-${gifAutoplay}`}
          source={{ uri: coverUrl }}
          style={styles.cover}
          imageStyle={{ borderRadius: RADIUS.lg }}
        >
          {coverContent}
        </ImageBackground>
      ) : (
        <View style={[styles.cover, { backgroundColor: themeColors.primary }]}>
          {coverContent}
        </View>
      )}

      {/* 한 줄 기록 */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.gray800 }]}>한 줄 기록</Text>
          <TouchableOpacity style={styles.addCircleBtn}>
            <Ionicons name="create-outline" size={16} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.aiInputRow}>
          <TextInput
            style={styles.aiInput}
            placeholder="예) 스타벅스 육천원 카드"
            placeholderTextColor={COLORS.gray400}
            value={aiInput}
            onChangeText={setAiInput}
            editable={!submitting}
          />
          <TouchableOpacity
            style={[styles.aiSubmitBtn, { backgroundColor: themeColors.primary }, (!aiInput.trim() || submitting) && styles.aiSubmitBtnDisabled]}
            disabled={!aiInput.trim() || submitting}
            onPress={handleAiSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 카테고리 2x2 그리드 */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.gray800 }]}>카테고리 현황</Text>
          <TouchableOpacity onPress={() => router.push('/category')}>
            <Text style={styles.linkText}>카테고리 관리 →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {categories.slice(0, 4).map((cat, idx) => {
            const net = catMap[cat] ?? 0;
            const spent = Math.abs(net);
            const budget = budgetMap[cat] ?? 0;
            const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
            const over = budget > 0 && spent > budget;
            const barColor = over ? COLORS.red : pct >= 70 ? COLORS.amber : themeColors.primary;
            const cardBg = cardPalette[idx] ?? cardPalette[0];
            const catImgUrl = categoryImgUrls[idx];

            const gridItemTop = (
              <>
                {over && (
                  <View style={styles.overBadge}>
                    <Text style={styles.overBadgeText}>초과 ⚠️</Text>
                  </View>
                )}
                <View style={styles.gridItemLabelWrap}>
                  <Text style={styles.gridItemLabel}>{cat}</Text>
                </View>
              </>
            );

            return (
              <TouchableOpacity
                key={cat}
                style={styles.gridItem}
                onPress={() => router.push('/budget')}
                activeOpacity={0.8}
              >
                {catImgUrl ? (
                  <ImageBackground source={{ uri: catImgUrl }} style={styles.gridItemTop}>
                    {gridItemTop}
                  </ImageBackground>
                ) : (
                  <View style={[styles.gridItemTop, { backgroundColor: cardBg }]}>
                    {gridItemTop}
                  </View>
                )}
                <View style={styles.gridItemBottom}>
                  <Text style={[styles.gridItemAmount, { color: net < 0 ? themeColors.primary : COLORS.gray300 }]}>
                    {net < 0 ? '-' : ''}{formatCurrency(spent)}
                  </Text>
                  {budget > 0 && (
                    <View style={{ marginTop: 4 }}>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={styles.progressLabel}>예산 {pct}% 사용</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 최근 지출 내역 */}
      <View style={[styles.card, { marginBottom: 24, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.gray800 }]}>최근 지출 내역</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.linkText}>전체 보기 →</Text>
          </TouchableOpacity>
        </View>
        {recentExpenses.length === 0 ? (
          <Text style={styles.emptyText}>아직 기록된 지출이 없어요</Text>
        ) : (
          recentExpenses.map((e, i) => (
            <View key={e.id} style={[styles.expenseRow, i === 0 && { paddingTop: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.expenseMeta}>
                  {e.date.slice(5).replace('-', '.')} · {e.category}
                  {e.payment_method ? ' · ' + e.payment_method : ''}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>-{formatCurrency(e.amount)}</Text>
            </View>
          ))
        )}
      </View>

      {userId && (
        <HomeEditModal
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={load}
          userId={userId}
          displayName={displayName}
          totalSpent={totalSpent}
          savingGoal={savingGoal}
          actualSaving={actualSaving}
          categories={categories}
          catMap={catMap}
          budgetMap={budgetMap}
          currentCoverUrl={coverUrl}
          currentCategoryUrls={categoryImgUrls}
          recentExpenses={recentExpenses}
        />
      )}
    </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: themeColors.primary }]}
        onPress={() => setFabOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* AI 파싱 확인 팝업 */}
      <SlideUpModal visible={showConfirm} onRequestClose={() => setShowConfirm(false)} dismissOnBackdrop={false}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{confirmItems.length}건 인식됨 — 확인 후 저장하세요</Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {confirmItems.map((item, idx) => (
                editingIdx === idx ? (
                  <View key={idx} style={styles.confirmCard}>
                    <Text style={styles.confirmBadge}>#{idx + 1} 수정</Text>
                    <View style={styles.confirmTypeToggle}>
                      {(['expense', 'income'] as const).map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.confirmTypeBtn, editType === t && styles.confirmTypeBtnActive]}
                          onPress={() => setEditType(t)}
                        >
                          <Text style={[styles.confirmTypeBtnText, editType === t && styles.confirmTypeBtnTextActive]}>
                            {t === 'expense' ? '💸 지출' : '💰 수입'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.confirmEditInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="이름"
                    />
                    {editType === 'expense' && (
                      <TextInput
                        style={styles.confirmEditInput}
                        value={editCategory}
                        onChangeText={setEditCategory}
                        placeholder="카테고리"
                      />
                    )}
                    <TextInput
                      style={styles.confirmEditInput}
                      value={editAmount}
                      onChangeText={setEditAmount}
                      placeholder="금액"
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => {
                      const updated = [...confirmItems];
                      updated[idx] = {
                        ...updated[idx],
                        name: editName,
                        category: editType === 'income' ? '수입' : editCategory,
                        amount: parseInt(editAmount) || updated[idx].amount,
                        type: editType,
                      };
                      setConfirmItems(updated);
                      setEditingIdx(null);
                    }}>
                      <Text style={{ color: COLORS.primary, fontWeight: '700', marginTop: 6 }}>완료</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View key={idx} style={styles.confirmCard}>
                    <View style={styles.confirmCardHeader}>
                      <View style={[styles.confirmBadgeWrap, { flexDirection: 'row', gap: 6 }]}>
                        <Text style={styles.confirmBadge}>#{idx + 1} 자동</Text>
                        <Text style={[styles.confirmBadge, item.type === 'income' ? styles.confirmBadgeIncome : styles.confirmBadgeExpense]}>
                          {item.type === 'income' ? '💰 수입' : '💸 지출'}
                        </Text>
                      </View>
                      <View style={styles.confirmCardActions}>
                        <TouchableOpacity onPress={() => {
                          setEditingIdx(idx);
                          setEditName(item.name);
                          setEditCategory(item.category);
                          setEditAmount(String(item.amount));
                          setEditType(item.type === 'income' ? 'income' : 'expense');
                        }} style={styles.confirmActionBtn}>
                          <Text style={styles.confirmActionBtnText}>✏️ 수정</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                          const updated = confirmItems.filter((_, i) => i !== idx);
                          if (updated.length === 0) { setShowConfirm(false); setConfirmItems([]); }
                          else setConfirmItems(updated);
                        }} style={[styles.confirmActionBtn, styles.confirmActionBtnDelete]}>
                    