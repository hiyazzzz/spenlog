import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, ImageBackground, Keyboard } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, useAppTheme, useThemeColors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { getHomeData, type HomeData } from '@/lib/api/home';
import { parseAiInput, addExpenses } from '@/lib/api/expenses';
import HomeEditModal from '@/components/HomeEditModal';
import SlideUpModal from '@/components/SlideUpModal';
import { useThemeStore } from '@/store/themeStore';
import dayjs from 'dayjs';
import GroupedDropdownPicker, { type GroupedItem } from '@/components/GroupedDropdownPicker';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const setStoreTheme = useThemeStore((s) => s.setTheme);
  const { themeColors, cardPalette } = useThemeColors();
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
  const [editDate, setEditDate] = useState('');
  const [editPayment, setEditPayment] = useState('');
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) {
        const { isGuest } = useThemeStore.getState();
        if (isGuest) {
          // 게스트 모드: AsyncStorage에서 프로필 로드
          const [nickname, incomeStr, goalStr, catsJson, savedTheme] = await Promise.all([
            AsyncStorage.getItem('guest_nickname'),
            AsyncStorage.getItem('guest_income'),
            AsyncStorage.getItem('guest_saving_goal'),
            AsyncStorage.getItem('guest_categories'),
            AsyncStorage.getItem('guest_theme'),
          ]);
          const catNames: string[] = catsJson
            ? JSON.parse(catsJson)
            : ['생활비', '고정비', '활동비', '친목비', '수입'];
          if (savedTheme) setStoreTheme(savedTheme);
          setUserId(null);
          setData({
            profile: {
              name: nickname ?? '소비요정',
              income: parseInt(incomeStr ?? '0') || 0,
              saving_goal: parseInt(goalStr ?? '0') || 0,
              home_cover_url: null,
              gif_autoplay: true,
              category_img_url_1: null,
              category_img_url_2: null,
              category_img_url_3: null,
              category_img_url_4: null,
            },
            expenses: [],
            budgets: [],
            categories: catNames.filter(n => n !== '수입').map(n => ({ name: n, color: null })),
            fixedCosts: [],
            paymentMethods: [],
            cardNames: [],
            accountNames: [],
          } as unknown as HomeData);
        } else {
          // 비로그인 (게스트 아님): 환영 화면
          setUserId(null);
        }
        return;
      }
      setUserId(uid);
      // 캐시 먼저 표시
      const cached = useDataCache.getState().home;
      if (cached) { setData(cached); setLoading(false); }
      const homeData = await getHomeData(uid);

      // 탈퇴 처리된 계정 감지: 재가입 유도
      if ((homeData?.profile as any)?.is_deleted) {
        Alert.alert(
          '탈퇴된 계정',
          '이전에 탈퇴 처리된 계정이에요.\n새 계정으로 시작하려면 고객센터에 문의해 주세요.',
          [{ text: '로그아웃', onPress: async () => { await supabase.auth.signOut(); router.replace('/login'); } }],
        );
        return;
      }

      useDataCache.getState().setHome(homeData);
      setData(homeData);
      // AsyncStorage 로컬 테마 있으면 DB값으로 덮어쓰지 않음 (탭 이동 시 테마 원복 방지)
      if (homeData?.profile?.theme) {
        const localTheme = await AsyncStorage.getItem('@spenlog/theme');
        if (!localTheme) setStoreTheme(homeData.profile.theme);
      }
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
      useDataCache.getState().setHistory(null);
      await load();
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요');
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  // 게스트 모드: 로그인 유도 화면
  if (!data) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg, gap: 20 }]}>
        <Text style={{ fontSize: 48 }}>👋</Text>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: themeColors.primary }}>Spenlog에 오신 걸 환영해요</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray400, textAlign: 'center', lineHeight: 20 }}>
            {'로그인하면 AI 가계부의\n모든 기능을 사용할 수 있어요'}
          </Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: themeColors.primary, paddingHorizontal: 36, paddingVertical: 14, borderRadius: RADIUS.lg }}
          onPress={() => router.replace('/login')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>로그인 / 회원가입</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allExpenses = data.expenses;
  const totalSpent = allExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const recentExpenses = allExpenses.filter(e => e.type === 'expense').slice(0, 3);
  const savingGoal = data.profile?.saving_goal ?? 0;
  const actualSaving = allExpenses.filter(e => e.type === 'savings').reduce((s, e) => s + e.amount, 0);
  const displayName = data.profile?.name || '소비요정';

  const categories = data.categories.map(c => c.name);
  const budgetMap: Record<string, number> = {};
  data.budgets.forEach(b => { budgetMap[b.category] = b.amount; });

  const catMap: Record<string, number> = {};
  allExpenses.filter(e => e.type !== 'income').forEach(e => {
    catMap[e.category] = (catMap[e.category] ?? 0) - e.amount;
  });

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
            <Text style={[styles.linkText, { color: themeColors.primaryMid }]}>카테고리 관리 →</Text>
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
                onPress={() => router.push({ pathname: '/(tabs)/history', params: { category: cat } })}
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
            <Text style={[styles.linkText, { color: themeColors.primaryMid }]}>전체 보기 →</Text>
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
                    <Text style={[styles.confirmBadge, { color: themeColors.primary }]}>#{idx + 1} 수정</Text>
                    <View style={styles.confirmTypeToggle}>
                      {(['expense', 'income'] as const).map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.confirmTypeBtn, editType === t && [styles.confirmTypeBtnActive, { backgroundColor: themeColors.primary }]]}
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
                    {editType === 'expense' && data && (
                      <View style={{ marginBottom: 6 }}>
                        <GroupedDropdownPicker
                          value={editCategory}
                          items={[
                            { type: 'item' as const, label: '없음', value: '없음' },
                            ...data.categories.map(c => ({ type: 'item' as const, label: c.name, value: c.name })),
                          ]}
                          onSelect={setEditCategory}
                          placeholder="카테고리 선택"
                          inline
                        />
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <TextInput
                        style={[styles.confirmEditInput, { flex: 1, marginBottom: 0 }]}
                        value={editAmount}
                        onChangeText={setEditAmount}
                        placeholder="금액"
                        keyboardType="numeric"
                      />
                      <Text style={{ fontSize: 14, color: COLORS.gray700, fontWeight: '600' }}>원</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.confirmEditInput, { justifyContent: 'center' }]}
                      onPress={() => setShowEditDatePicker(p => !p)}
                    >
                      <Text style={{ fontSize: 13, color: editDate ? COLORS.gray800 : COLORS.gray400 }}>{editDate || '날짜 선택'}</Text>
                    </TouchableOpacity>
                    {showEditDatePicker && (
                      <ConfirmJSDatePicker
                        date={new Date(editDate || Date.now())}
                        onChange={d => setEditDate(dayjs(d).format('YYYY-MM-DD'))}
                        onClose={() => setShowEditDatePicker(false)}
                      />
                    )}
                    <View style={{ marginBottom: 6 }}>
                      <GroupedDropdownPicker
                        value={editPayment}
                        items={buildConfirmPaymentItems(data?.cardNames ?? [], data?.accountNames ?? [])}
                        onSelect={setEditPayment}
                        placeholder="결제수단 (선택)"
                        inline
                      />
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: themeColors.primary, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', marginTop: 4 }}
                      onPress={() => {
                        const updated = [...confirmItems];
                        updated[idx] = {
                          ...updated[idx],
                          name: editName,
                          category: editType === 'income' ? '수입' : (editCategory === '없음' ? null : editCategory),
                          amount: parseInt(editAmount) || updated[idx].amount,
                          type: editType,
                          date: editDate || updated[idx].date,
                          payment_method: editPayment || undefined,
                        };
                        setConfirmItems(updated);
                        setEditingIdx(null);
                        setShowEditDatePicker(false);
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>저장</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View key={idx} style={styles.confirmCard}>
                    <View style={styles.confirmCardHeader}>
                      <View style={[styles.confirmBadgeWrap, { flexDirection: 'row', gap: 6 }]}>
                        <Text style={[styles.confirmBadge, { color: themeColors.primary }]}>#{idx + 1} 자동</Text>
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
                          setEditDate(item.date ?? dayjs().format('YYYY-MM-DD'));
                          setEditPayment(item.payment_method ?? '');
                          setShowEditDatePicker(false);
                        }} style={styles.confirmActionBtn}>
                          <Text style={styles.confirmActionBtnText}>✏️ 수정</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                          const updated = confirmItems.filter((_, i) => i !== idx);
                          if (updated.length === 0) { setShowConfirm(false); setConfirmItems([]); }
                          else setConfirmItems(updated);
                        }} style={[styles.confirmActionBtn, styles.confirmActionBtnDelete]}>
                          <Text style={styles.confirmActionBtnText}>삭제</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.confirmCardBody}>
                      <View>
                        <Text style={styles.confirmItemName}>{item.name}</Text>
                        <Text style={styles.confirmItemMeta}>{item.category} · {item.date ?? new Date().toISOString().slice(0, 10)}</Text>
                      </View>
                      <Text style={[styles.confirmItemAmount, item.type === 'income' && { color: COLORS.green }]}>
                        {item.type === 'income' ? '+' : ''}{formatCurrency(item.amount)}
                      </Text>
                    </View>
                  </View>
                )
              ))}
            </ScrollView>

            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.confirmSaveBtn, { backgroundColor: themeColors.primary }]} onPress={handleConfirmSave}>
                <Text style={styles.confirmSaveBtnText}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => { setShowConfirm(false); setConfirmItems([]); }}>
                <Text style={styles.confirmCancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
      </SlideUpModal>

      <SlideUpModal visible={fabOpen} onRequestClose={() => setFabOpen(false)}>
          <View style={styles.fabSheet}>
            <View style={styles.fabSheetHandle} />
            <Text style={styles.fabSheetTitle}>기록하기</Text>
            <TouchableOpacity
              style={[styles.fabSheetBtn, { backgroundColor: themeColors.primaryLight }]}
              onPress={() => { setFabOpen(false); router.push('/add?type=expense'); }}
            >
              <Text style={styles.fabSheetBtnText}>💸 지출 기록</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fabSheetBtn, { backgroundColor: '#dcfce7' }]}
              onPress={() => { setFabOpen(false); router.push('/add?type=income'); }}
            >
              <Text style={styles.fabSheetBtnText}>💰 수입 기록</Text>
            </TouchableOpacity>
          </View>
      </SlideUpModal>
    </View>
  );
}

const EXTRA_CONFIRM_PAY = ['현금', '계좌이체'];
function buildConfirmPaymentItems(cardNames: string[], accountNames: string[]): GroupedItem[] {
  return [
    ...(cardNames.length > 0 ? [{ type: 'header' as const, label: '카드' }, ...cardNames.map(n => ({ type: 'item' as const, label: n, value: n }))] : []),
    ...(accountNames.length > 0 ? [{ type: 'header' as const, label: '계좌' }, ...accountNames.map(n => ({ type: 'item' as const, label: n, value: n }))] : []),
    { type: 'header' as const, label: '기타' },
    ...EXTRA_CONFIRM_PAY.map(m => ({ type: 'item' as const, label: m, value: m })),
  ];
}

function ConfirmJSDatePicker({ date, onChange, onClose }: { date: Date; onChange: (d: Date) => void; onClose: () => void }) {
  const { themeColors: pickTheme } = useThemeColors();
  const d = dayjs(date);
  const adj = (unit: 'year' | 'month' | 'date', delta: number) => {
    if (unit === 'date') { onChange(d.add(delta, 'day').toDate()); return; }
    const y = unit === 'year' ? d.year() + delta : d.year();
    const m = unit === 'month' ? d.month() + delta : d.month();
    const maxDay = dayjs(new Date(y, m, 1)).daysInMonth();
    onChange(new Date(y, m, Math.min(d.date(), maxDay)));
  };
  return (
    <View style={confirmPickerStyles.wrap}>
      <View style={confirmPickerStyles.row}>
        {([
          { unit: 'year' as const, label: `${d.year()}년` },
          { unit: 'month' as const, label: `${d.month() + 1}월` },
          { unit: 'date' as const, label: `${d.date()}일` },
        ]).map(({ unit, label }) => (
          <View key={unit} style={confirmPickerStyles.cell}>
            <TouchableOpacity onPress={() => adj(unit, -1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}>
              <Text style={confirmPickerStyles.arrow}>◀</Text>
            </TouchableOpacity>
            <Text style={confirmPickerStyles.label}>{label}</Text>
            <TouchableOpacity onPress={() => adj(unit, 1)} hitSlop={{ top: 10, bottom: 10, left: 4, right: 10 }}>
              <Text style={confirmPickerStyles.arrow}>▶</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={onClose} style={[confirmPickerStyles.doneBtn, { backgroundColor: pickTheme.primary }]}>
        <Text style={confirmPickerStyles.doneTxt}>완료</Text>
      </TouchableOpacity>
    </View>
  );
}
const confirmPickerStyles = StyleSheet.create({
  wrap: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.gray200 },
  row: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, borderWidth: 1, borderColor: COLORS.gray200 },
  arrow: { fontSize: 13, color: COLORS.gray400, paddingHorizontal: 2 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.gray800, minWidth: 36, textAlign: 'center' },
  doneBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.primary },
  doneTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, gap: 12 },

  cover: {
    height: 200,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    justifyContent: 'space-between',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  coverEditBtn: {
    position: 'absolute', top: 48, right: 14, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.40)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  coverEditBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.90)' },
  coverGreeting: { padding: 18 },
  coverHello: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 },
  coverName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  coverStatsBar: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginBottom: 2 },
  coverStatValue: { color: '#fff', fontSize: 15, fontWeight: '800' },
  coverSavingValue: { color: '#a7f3d0', fontSize: 13, fontWeight: '700' },
  coverDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 20,
    minHeight: 100,
    ...CARD_SHADOW,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray800 },
  linkText: { fontSize: 12, color: COLORS.primaryMid },
  addCircleBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },

  aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.gray800,
    backgroundColor: '#fafafa',
  },
  aiSubmitBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  aiSubmitBtnDisabled: { backgroundColor: COLORS.gray300 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  gridItemTop: { height: 80, justifyContent: 'flex-end' },
  gridItemLabelWrap: { padding: 10, paddingBottom: 6 },
  gridItemLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  overBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: COLORS.redBg,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  overBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.red },
  gridItemBottom: { padding: 10 },
  gridItemAmount: { fontSize: 14, fontWeight: '800' },
  progressBg: { backgroundColor: COLORS.gray100, borderRadius: 4, height: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 10, color: COLORS.gray400, marginTop: 2 },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.gray50,
  },
  expenseName: { fontSize: 14, fontWeight: '500', color: COLORS.gray800 },
  expenseMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#f87171', marginLeft: 12 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 16 },

  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  fabSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  fabSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.gray200,
    alignSelf: 'center', marginBottom: 8,
  },
  fabSheetTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800, marginBottom: 4 },
  fabSheetBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabSheetBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },

  confirmSheet: { backgroundColor: '#fff', borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: 20, gap: 12 },
  confirmTitle: { fontSize: 13, fontWeight: '600', color: COLORS.gray800, marginBottom: 4 },
  confirmCard: { backgroundColor: '#f8f7ff', borderRadius: RADIUS.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e8e4ff' },
  confirmCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  confirmBadgeWrap: {},
  confirmBadge: { fontSize: 11, fontWeight: '700', color: COLORS.primary, backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  confirmBadgeIncome: { color: COLORS.green, backgroundColor: COLORS.greenBg },
  confirmBadgeExpense: { color: COLORS.red, backgroundColor: COLORS.redBg },
  confirmTypeToggle: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.gray200, padding: 3, marginBottom: 8 },
  confirmTypeBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  confirmTypeBtnActive: { backgroundColor: COLORS.primary },
  confirmTypeBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.gray400 },
  confirmTypeBtnTextActive: { color: '#fff' },
  confirmCardActions: { flexDirection: 'row', gap: 6 },
  confirmActionBtn: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.gray200 },
  confirmActionBtnDelete: { borderColor: '#fca5a5' },
  confirmActionBtnText: { fontSize: 11, color: COLORS.gray700 },
  confirmCardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  confirmItemName: { fontSize: 15, fontWeight: '700', color: COLORS.gray800 },
  confirmItemMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  confirmItemAmount: { fontSize: 16, fontWeight: '800', color: COLORS.gray800 },
  confirmEditInput: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: COLORS.gray800, marginBottom: 6, backgroundColor: '#fff' },
  confirmButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmSaveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  confirmSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  confirmCancelBtn: { flex: 1, backgroundColor: COLORS.gray100, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  confirmCancelBtnText: { color: COLORS.gray600, fontWeight: '600', fontSize: 14 },
});
