import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Keyboard, Alert, Animated, Platform, InputAccessoryView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import dayjs from 'dayjs';
import { COLORS, RADIUS, formatCurrency, useThemeColors, getThemeColors, useAppTheme } from '@/constants/theme';
import { DEFAULT_CATEGORIES } from '@/lib/api/categories';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { recordCardPayment } from '@/lib/api/routine';
import { getHistoryData, updateExpense, type HistoryData } from '@/lib/api/history';
import { deleteExpense } from '@/lib/api/expenses';
import type { Expense } from '@spenlog/types';
import GroupedDropdownPicker, { type GroupedItem } from '@/components/GroupedDropdownPicker';

const { height: WINDOW_H } = Dimensions.get('window');

type ViewMode = 'list' | 'calendar';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
type TypeFilter = '' | 'expense' | 'income' | 'savings' | 'transfer';

export default function HistoryScreen() {
  const router = useRouter();
  const { themeColors, tabBg } = useThemeColors();
  const { colors } = useAppTheme();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const params = useLocalSearchParams<{ category?: string }>();
  const [filterCat, setFilterCat] = useState(params.category ?? '');
  const [filterPay, setFilterPay] = useState('');
  const [filterType, setFilterType] = useState<TypeFilter>('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [calMonth, setCalMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'type' | 'cat' | 'pay' | 'sort' | null>(null);
  const [kbdH, setKbdH] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbdH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbdH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // 필터 드롭다운 오버레이용 refs / 위치 상태
  const typeFilterRef = useRef<any>(null);
  const catFilterRef = useRef<any>(null);
  const payFilterRef = useRef<any>(null);
  const sortFilterRef = useRef<any>(null);
  const [filterPanelPos, setFilterPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

  function openFilter(key: 'type' | 'cat' | 'pay' | 'sort') {
    if (activeDropdown === key) { setActiveDropdown(null); setFilterPanelPos(null); return; }
    const refs: Record<string, React.RefObject<any>> = {
      type: typeFilterRef, cat: catFilterRef, pay: payFilterRef, sort: sortFilterRef,
    };
    refs[key].current?.measure((_x: number, _y: number, w: number, h: number, px: number, py: number) => {
      setFilterPanelPos({ top: py + h + 4, left: px, width: w });
      setActiveDropdown(key);
    });
  }

  const [cardPayModal, setCardPayModal] = useState<{
    payMethod: string; monthTotal: number; alreadyPaid: number; remaining: number;
    accountName: string; matchedCard: any; thisMonth: string; userId: string; refreshFn: () => void;
  } | null>(null);
  const appliedCategoryRef = useRef<string>('');

  // 세대 카운터: 구버전 응답이 최신 응답보다 늦게 도착해도 UI 덮어쓰기 방지
  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) {
        setError('로그인이 필요해요');
        return;
      }
      // 캐시 먼저 표시
      const cached = useDataCache.getState().history;
      if (cached) { setData(cached); setLoading(false); }

      const result = await getHistoryData(userId);
      if (gen !== loadGenRef.current) return; // 더 최신 요청 있으면 구버전 무시
      useDataCache.getState().setHistory(result);
      setData(result);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, []);

  // Zustand store 변경 즉시 반영 — prefetch로 store가 업데이트되면 useFocusEffect 없이도 UI 갱신
  const storeHistory = useDataCache(s => s.history);
  useEffect(() => {
    if (storeHistory) {
      setData(storeHistory);
      setLoading(false);
    }
  }, [storeHistory]);

  useFocusEffect(useCallback(() => {
    load();
    if (params.category && params.category !== appliedCategoryRef.current) {
      setFilterCat(params.category);
      appliedCategoryRef.current = params.category;
    }
    // 다른 탭에서 돌아올 때 편집/드롭다운 상태 초기화
    return () => {
      setEditingExpense(null);
      setActiveDropdown(null);
    };
  }, [load, params.category]));

  const expenses = data?.expenses ?? [];

  const filtered = useMemo(() => {
    let list = expenses.filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat && e.category !== filterCat) return false;
      if (filterPay && e.payment_method !== filterPay) return false;
      if (filterType) {
        const t = e.type ?? 'expense';
        if (filterType === 'transfer') {
          if (t !== 'transfer' && t !== 'savings') return false;
        } else {
          if (t !== filterType) return false;
        }
      }
      return true;
    });
    switch (sort) {
      case 'date_asc': return [...list].sort((a, b) => a.date.localeCompare(b.date));
      case 'amount_desc': return [...list].sort((a, b) => b.amount - a.amount);
      case 'amount_asc': return [...list].sort((a, b) => a.amount - b.amount);
      default: return [...list].sort((a, b) => b.date.localeCompare(a.date));
    }
  }, [expenses, search, filterCat, filterPay, filterType, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    filtered.forEach(e => {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    });
    return [...map.entries()].sort((a, b) =>
      sort === 'date_asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])
    );
  }, [filtered, sort]);

  const { calExpenseMap, calIncomeSet } = useMemo(() => {
    const expenseMap = new Map<string, number>();
    const incomeSet = new Set<string>();
    expenses.filter(e => e.date.startsWith(calMonth)).forEach(e => {
      const type = e.type ?? 'expense';
      if (type === 'income') {
        incomeSet.add(e.date);
      } else {
        expenseMap.set(e.date, (expenseMap.get(e.date) ?? 0) + e.amount);
      }
    });
    return { calExpenseMap: expenseMap, calIncomeSet: incomeSet };
  }, [expenses, calMonth]);

  function handleDelete(expense: Expense) {
    Alert.alert(
      '내역 삭제',
      `'${expense.name}' 내역을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: async () => {
          await deleteExpense(expense);
          setData(d => d ? { ...d, expenses: d.expenses.filter(e => e.id !== expense.id) } : d);
          useDataCache.getState().setHome(null);
          useDataCache.getState().setAssets(null);
          setEditingExpense(null);
        }},
      ]
    );
  }

  async function handleSave(id: string, updates: Partial<Expense>) {
    await updateExpense(id, updates);
    setData(d => d ? { ...d, expenses: d.expenses.map(e => e.id === id ? { ...e, ...updates } : e) } : d);
    useDataCache.getState().setHome(null);
    useDataCache.getState().setAssets(null);
    setEditingExpense(null);
  }

  async function handleCardPayment(expense: Expense) {
    const userId = await getCurrentUserId();
    if (!userId || !data) return;
    const payMethod = expense.payment_method ?? '';
    const thisMonth = dayjs().format('YYYY-MM');

    // 이번 달 해당 카드 지출 합계
    const monthTotal = data.expenses
      .filter(e =>
        (e.type ?? 'expense') === 'expense' &&
        e.payment_method === payMethod &&
        e.date.startsWith(thisMonth)
      )
      .reduce((sum, e) => sum + e.amount, 0);

    // 이미 이번 달 납부한 금액 (카드 대금으로 기록된 것)
    const alreadyPaid = data.expenses
      .filter(e =>
        e.name?.includes('카드 대금') &&
        (e.payment_method === payMethod || e.name?.includes(payMethod)) &&
        e.date.startsWith(thisMonth)
      )
      .reduce((sum, e) => sum + e.amount, 0);

    const remaining = monthTotal - alreadyPaid;

    // 연결 카드 조회
    const { data: cards } = await supabase.from('cards').select('*').eq('user_id', userId);
    const matchedCard = (cards ?? []).find((card: any) =>
      payMethod.includes(card.name) || card.name.includes(payMethod) || card.name === payMethod
    );

    let accountName = '';
    if (matchedCard?.linked_account_id) {
      const { data: acc } = await supabase.from('accounts').select('name').eq('id', matchedCard.linked_account_id).single();
      accountName = acc?.name ?? '';
    }

    if (remaining <= 0) {
      Alert.alert('납부 완료', `${payMethod} 이번 달 납부할 잔액이 없어요.`);
      return;
    }

    setCardPayModal({
      payMethod,
      monthTotal,
      alreadyPaid,
      remaining,
      accountName,
      matchedCard: matchedCard ?? null,
      thisMonth,
      userId,
      refreshFn: load,
    });
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

  const today = dayjs().format('YYYY-MM-DD');
  const hasFilter = !!(search || filterCat || filterPay || filterType);
  const categories = data.userCategories.length > 0 ? data.userCategories : DEFAULT_CATEGORIES;
  const selectedItems = selectedDate ? expenses.filter(e => e.date === selectedDate) : [];

  return (
    <>
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: themeColors.accent }]}>내역</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={[styles.viewSegment, { backgroundColor: tabBg }]}>
            <TouchableOpacity
              style={[styles.viewSegmentBtn, view === 'list' && { backgroundColor: themeColors.primary }]}
              onPress={() => setView('list')}
            >
              <Text style={[styles.viewSegmentText, view === 'list' && styles.viewSegmentTextActive]}>≡ 리스트</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewSegmentBtn, view === 'calendar' && { backgroundColor: themeColors.primary }]}
              onPress={() => setView('calendar')}
            >
              <Text style={[styles.viewSegmentText, view === 'calendar' && styles.viewSegmentTextActive]}>캘린더</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.addCircleBtn, { backgroundColor: themeColors.primary }]} onPress={() => router.push('/add')}>
            <Text style={styles.addCircleBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="항목명 검색"
          placeholderTextColor={COLORS.gray400}
          value={search}
          onChangeText={setSearch}
        />
        {search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: COLORS.gray400, fontSize: 12 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 필터 드롭다운 4개 — 오버레이 방식 */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          ref={typeFilterRef}
          style={[styles.dropdownBtn, (filterType !== '' || activeDropdown === 'type') && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
          onPress={() => openFilter('type')}
        >
          <Text style={[styles.dropdownBtnText, (filterType !== '' || activeDropdown === 'type') && { color: '#fff' }]} numberOfLines={1}>
            {filterType === '' ? '유형' : filterType === 'expense' ? '지출' : filterType === 'income' ? '수입' : '이체'}
          </Text>
          <Text style={[styles.dropdownArrow, (filterType !== '' || activeDropdown === 'type') && { color: '#fff' }]}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity
          ref={catFilterRef}
          style={[styles.dropdownBtn, (filterCat !== '' || activeDropdown === 'cat') && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
          onPress={() => openFilter('cat')}
        >
          <Text style={[styles.dropdownBtnText, (filterCat !== '' || activeDropdown === 'cat') && { color: '#fff' }]} numberOfLines={1}>
            {filterCat === '' ? '카테고리' : filterCat}
          </Text>
          <Text style={[styles.dropdownArrow, (filterCat !== '' || activeDropdown === 'cat') && { color: '#fff' }]}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity
          ref={payFilterRef}
          style={[styles.dropdownBtn, (filterPay !== '' || activeDropdown === 'pay') && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
          onPress={() => openFilter('pay')}
        >
          <Text style={[styles.dropdownBtnText, (filterPay !== '' || activeDropdown === 'pay') && { color: '#fff' }]} numberOfLines={1}>
            {filterPay === '' ? '결제수단' : filterPay}
          </Text>
          <Text style={[styles.dropdownArrow, (filterPay !== '' || activeDropdown === 'pay') && { color: '#fff' }]}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity
          ref={sortFilterRef}
          style={[styles.dropdownBtn, (sort !== 'date_desc' || activeDropdown === 'sort') && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
          onPress={() => openFilter('sort')}
        >
          <Text style={[styles.dropdownBtnText, (sort !== 'date_desc' || activeDropdown === 'sort') && { color: '#fff' }]} numberOfLines={1}>
            {sort === 'date_desc' ? '최신순' : sort === 'date_asc' ? '오래된순' : sort === 'amount_desc' ? '금액↓' : '금액↑'}
          </Text>
          <Text style={[styles.dropdownArrow, (sort !== 'date_desc' || activeDropdown === 'sort') && { color: '#fff' }]}>▾</Text>
        </TouchableOpacity>
      </View>
      {hasFilter && (
        <TouchableOpacity style={[styles.resetChip, { marginBottom: 8, alignSelf: 'flex-start' }]} onPress={() => { setSearch(''); setFilterCat(''); setFilterPay(''); setFilterType(''); setActiveDropdown(null); setFilterPanelPos(null); }}>
          <Text style={styles.resetChipText}>초기화 ✕</Text>
        </TouchableOpacity>
      )}

      {view === 'list' && (
        <View>
          {filtered.length === 0 && (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={styles.emptyText}>{hasFilter ? '해당 조건의 내역이 없어요' : '아직 기록된 내역이 없어요 🌿'}</Text>
            </View>
          )}
          {grouped.map(([date, items]) => {
            const expenseSum = items.filter(e => (e.type ?? 'expense') === 'expense').reduce((s, e) => s + e.amount, 0);
            const incomeSum = items.filter(e => (e.type ?? 'expense') === 'income').reduce((s, e) => s + e.amount, 0);
            const net = expenseSum - incomeSum;
            return (
              <View key={date} style={{ marginBottom: 16 }}>
                <View style={styles.dateRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.dateLabel}>{dayjs(date).format('M월 D일 (ddd)')}</Text>
                    {date === today && (
                      <View style={[styles.todayBadge, { backgroundColor: themeColors.primary }]}><Text style={styles.todayBadgeText}>오늘</Text></View>
                    )}
                  </View>
                  {net !== 0 && (
                    <Text style={[styles.dateSum, { color: net > 0 ? COLORS.red : COLORS.green }]}>
                      {net > 0 ? '-' : '+'}{formatCurrency(Math.abs(net)).replace('원', '')}원
                    </Text>
                  )}
                </View>
                <View style={[styles.card, { backgroundColor: colors.bg }]}>
                  {items.map((e, idx) => (
                    <View key={e.id}>
                      <ExpenseRow expense={e} onTap={() => setEditingExpense(e)} onPayCard={handleCardPayment} accountNames={new Set(data?.accountNames ?? [])} />
                      {idx < items.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {view === 'calendar' && (
        <CalendarView
          calMonth={calMonth}
          onChangeMonth={setCalMonth}
          calExpenseMap={calExpenseMap}
          calIncomeSet={calIncomeSet}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={d => setSelectedDate(selectedDate === d ? null : d)}
          themeColors={themeColors}
        />
      )}

      {view === 'calendar' && selectedDate && (
        <View style={[styles.card, { marginTop: 12, backgroundColor: colors.bg }]}>
          <View style={styles.selectedHeaderRow}>
            <Text style={styles.dateLabel}>{dayjs(selectedDate).format('M월 D일 (ddd)')}</Text>
            {selectedItems.filter(e => (e.type ?? 'expense') !== 'income').length > 0 && (
              <Text style={[styles.dateSum, { color: COLORS.red }]}>
                -{formatCurrency(selectedItems.filter(e => (e.type ?? 'expense') !== 'income').reduce((s, e) => s + e.amount, 0)).replace('원', '')}원
              </Text>
            )}
          </View>
          {selectedItems.length === 0 ? (
            <Text style={[styles.emptyText, { paddingVertical: 24 }]}>이날은 내역이 없었어요 🌿</Text>
          ) : selectedItems.map((e, idx) => (
            <View key={e.id}>
              <ExpenseRow expense={e} onTap={() => setEditingExpense(e)} onPayCard={handleCardPayment} accountNames={new Set(data?.accountNames ?? [])} />
              {idx < selectedItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      )}
    </ScrollView>

    {/* 카드 납부 커스텀 모달 */}
    {cardPayModal && (
      <Modal visible transparent animationType="slide" onRequestClose={() => setCardPayModal(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCardPayModal(null)} />
          <View style={styles.cardPaySheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>💳 {cardPayModal.payMethod} 카드 납부</Text>
            <View style={styles.cardPayInfoBox}>
              <View style={styles.cardPayInfoRow}>
                <Text style={styles.cardPayInfoLabel}>이번 달 총 지출</Text>
                <Text style={styles.cardPayInfoValue}>{formatCurrency(cardPayModal.monthTotal)}</Text>
              </View>
              {cardPayModal.alreadyPaid > 0 && (
                <>
                  <View style={styles.cardPayInfoRow}>
                    <Text style={styles.cardPayInfoLabel}>이미 납부</Text>
                    <Text style={[styles.cardPayInfoValue, { color: COLORS.green }]}>-{formatCurrency(cardPayModal.alreadyPaid)}</Text>
                  </View>
                  <View style={[styles.cardPayInfoRow, { borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 8, marginTop: 4 }]}>
                    <Text style={[styles.cardPayInfoLabel, { fontWeight: '700' }]}>납부 잔액</Text>
                    <Text style={[styles.cardPayInfoValue, { fontWeight: '800', color: COLORS.red }]}>{formatCurrency(cardPayModal.remaining)}</Text>
                  </View>
                </>
              )}
              {cardPayModal.accountName ? (
                <Text style={styles.cardPayAccountNote}>[{cardPayModal.accountName}]에서 차감됩니다</Text>
              ) : (
                <Text style={[styles.cardPayAccountNote, { color: '#d97706' }]}>연결 계좌를 자산 탭에서 먼저 설정해주세요</Text>
              )}
            </View>
            <View style={styles.formBtnRow}>
              <TouchableOpacity style={styles.deleteFormBtn} onPress={() => setCardPayModal(null)}>
                <Text style={styles.deleteFormBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { flex: 2, backgroundColor: themeColors.primary }]}
                onPress={async () => {
                  if (!cardPayModal.matchedCard) {
                    setCardPayModal(null);
                    Alert.alert('카드 없음', '자산 탭에서 카드를 먼저 등록해주세요.');
                    return;
                  }
                  const today = dayjs().format('YYYY-MM-DD');
                  await recordCardPayment(cardPayModal.userId, cardPayModal.matchedCard, cardPayModal.thisMonth, cardPayModal.remaining, today, null);
                  setCardPayModal(null);
                  await cardPayModal.refreshFn();
                }}
              >
                <Text style={styles.confirmBtnText}>납부하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}

    {/* 수정 바텀시트 모달 */}
    {editingExpense && (
      <Modal visible transparent animationType="none" onRequestClose={() => setEditingExpense(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditingExpense(null)} />
          <View style={[styles.editSheet, kbdH > 0 && { maxHeight: WINDOW_H - kbdH - 20, marginBottom: kbdH }]}>
            <View style={styles.modalHandle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 36 }}
            >
              {(editingExpense.type === 'savings' || editingExpense.type === 'transfer')
                ? <TransferEditRow
                    expense={editingExpense}
                    onSave={u => handleSave(editingExpense.id, u)}
                    onDelete={() => handleDelete(editingExpense)}
                    onCancel={() => setEditingExpense(null)}
                  />
                : <EditRow
                    expense={editingExpense}
                    categories={categories}
                    paymentMethods={data.paymentMethods}
                    cardNames={data.cardNames}
                    accountNames={data.accountNames}
                    themeColors={themeColors}
                    onSave={u => { handleSave(editingExpense.id, u); setShowToast(true); setTimeout(() => setShowToast(false), 1500); }}
                    onDelete={() => handleDelete(editingExpense)}
                    onCancel={() => setEditingExpense(null)}
                  />
              }
            </ScrollView>
          </View>
        </View>
      </Modal>
    )}
    {/* 필터 드롭다운 오버레이 Modal */}
    <Modal
      visible={activeDropdown !== null && filterPanelPos !== null}
      transparent
      animationType="none"
      onRequestClose={() => { setActiveDropdown(null); setFilterPanelPos(null); }}
    >
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => { setActiveDropdown(null); setFilterPanelPos(null); }}
        />
        {filterPanelPos && (
          <View style={[styles.filterOverlayPanel, {
            position: 'absolute',
            top: filterPanelPos.top,
            left: filterPanelPos.left,
            minWidth: Math.max(filterPanelPos.width, 150),
          }]}>
            <ScrollView bounces={false} nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
              {activeDropdown === 'type' && (
                ([['', '전체'], ['expense', '지출'], ['income', '수입'], ['transfer', '이체']] as [TypeFilter, string][]).map(([v, l]) => (
                  <TouchableOpacity key={v} style={[styles.dropdownOpt, filterType === v && { backgroundColor: themeColors.primaryLight }]} onPress={() => { setFilterType(v); setActiveDropdown(null); setFilterPanelPos(null); }}>
                    <Text style={[styles.dropdownOptText, filterType === v && { color: themeColors.primary, fontWeight: '700' }]}>{l}</Text>
                  </TouchableOpacity>
                ))
              )}
              {activeDropdown === 'cat' && (
                ([['', '카테고리 전체'], ...categories.map(c => [c, c])] as [string, string][]).map(([v, l]) => (
                  <TouchableOpacity key={v} style={[styles.dropdownOpt, filterCat === v && { backgroundColor: themeColors.primaryLight }]} onPress={() => { setFilterCat(v as any); setActiveDropdown(null); setFilterPanelPos(null); }}>
                    <Text style={[styles.dropdownOptText, filterCat === v && { color: themeColors.primary, fontWeight: '700' }]}>{l}</Text>
                  </TouchableOpacity>
                ))
              )}
              {activeDropdown === 'pay' && (
                ([['', '결제수단 전체'], ...data.paymentMethods.map(p => [p, p])] as [string, string][]).map(([v, l]) => (
                  <TouchableOpacity key={v} style={[styles.dropdownOpt, filterPay === v && { backgroundColor: themeColors.primaryLight }]} onPress={() => { setFilterPay(v); setActiveDropdown(null); setFilterPanelPos(null); }}>
                    <Text style={[styles.dropdownOptText, filterPay === v && { color: themeColors.primary, fontWeight: '700' }]}>{l}</Text>
                  </TouchableOpacity>
                ))
              )}
              {activeDropdown === 'sort' && (
                ([['date_desc', '최신순'], ['date_asc', '오래된순'], ['amount_desc', '금액 높은순'], ['amount_asc', '금액 낮은순']] as [SortKey, string][]).map(([v, l]) => (
                  <TouchableOpacity key={v} style={[styles.dropdownOpt, sort === v && { backgroundColor: themeColors.primaryLight }]} onPress={() => { setSort(v); setActiveDropdown(null); setFilterPanelPos(null); }}>
                    <Text style={[styles.dropdownOptText, sort === v && { color: themeColors.primary, fontWeight: '700' }]}>{l}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>

    {Platform.OS === 'ios' && (
      <InputAccessoryView nativeID="editRowKbd">
        <View style={styles.kbdBar}>
          <TouchableOpacity onPress={Keyboard.dismiss} style={styles.kbdBarBtn}>
            <Text style={styles.kbdBarBtnText}>완료</Text>
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    )}
    <SaveToast visible={showToast} />
    </>
  );
}

function ExpenseRow({ expense, onTap, onPayCard, accountNames = new Set<string>() }: { expense: Expense; onTap: () => void; onPayCard?: (e: Expense) => void; accountNames?: Set<string> }) {
  const expType = expense.type ?? 'expense';
  const isIncome = expType === 'income';
  const isTransfer = expType === 'savings' || expType === 'transfer';
  const isCard = !isIncome && !isTransfer && !accountNames.has(expense.payment_method ?? '') && (expense.payment_method ?? '').includes('카드');

  if (isTransfer) {
    const parts = expense.name.includes('→') ? expense.name.split('→').map(s => s.trim()) : [expense.name, ''];
    const fromAcc = parts[0];
    const toAcc = parts[1] || '';
    return (
      <TouchableOpacity onPress={onTap} activeOpacity={0.7} style={styles.rowWrap}>
        <LinearGradient colors={['rgba(221,214,254,0.4)', '#fff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.row}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <View style={styles.savingsBadge}><Text style={styles.savingsBadgeText}>이체</Text></View>
            </View>
            <Text style={styles.rowName} numberOfLines={1}>
              {fromAcc}{toAcc ? ` → ${toAcc}` : ''}
            </Text>
          </View>
          <Text style={[styles.rowAmount, { color: '#7c3aed' }]}>
            ⇔ {formatCurrency(expense.amount).replace('원', '')}원
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (isCard) {
    return (
      <TouchableOpacity onPress={onTap} activeOpacity={0.7} style={styles.rowWrap}>
        <LinearGradient colors={['rgba(254,202,202,0.4)', '#fff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.row}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>카드</Text></View>
            </View>
            <Text style={styles.rowName} numberOfLines={1}>{expense.name}</Text>
            <Text style={styles.rowMeta}>
              {expense.category}{expense.payment_method ? ` · ${expense.payment_method}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[styles.rowAmount, { color: '#f97316' }]}>
              -{formatCurrency(expense.amount).replace('원', '')}원
            </Text>
            {onPayCard && (
              <TouchableOpacity
                onPress={() => onPayCard(expense)}
                style={{ backgroundColor: '#fed7aa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}
              >
                <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: '600' }}>납부</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.row} onPress={onTap} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowName}>{expense.name}</Text>
          {isIncome && (
            <View style={styles.incomeBadge}><Text style={styles.incomeBadgeText}>수입</Text></View>
          )}
        </View>
        <Text style={styles.rowMeta}>
          {expense.category}{expense.payment_method ? ` · ${expense.payment_method}` : ''}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: isIncome ? COLORS.green : '#ef4444' }]}>
        {isIncome ? '+' : '-'}{formatCurrency(expense.amount).replace('원', '')}원
      </Text>
    </TouchableOpacity>
  );
}

// ─── 드롭다운 피커 (Modal 오버레이 — 옆 칸 높이에 영향 없음) ──────────────
const DROPDOWN_PANEL_MAX = 220;

function DropdownPicker({
  value, options, onSelect, placeholder = '선택하세요', themeColors,
}: {
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
  themeColors: ReturnType<typeof getThemeColors>;
}) {
  const [open, setOpen] = useState(false);
  const [panelMaxH, setPanelMaxH] = useState(DROPDOWN_PANEL_MAX);
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const btnRef = useRef<any>(null);

  function handlePress() {
    if (open) { setOpen(false); return; }
    const screenH = Dimensions.get('window').height;
    btnRef.current?.measure((_x: number, _y: number, w: number, h: number, px: number, py: number) => {
      const spaceBelow = screenH - py - h - 12;
      const spaceAbove = py - 12;
      const maxH = Math.max(80, Math.min(Math.max(spaceBelow, spaceAbove), DROPDOWN_PANEL_MAX));
      setPanelMaxH(maxH);
      if (spaceBelow >= DROPDOWN_PANEL_MAX || spaceBelow >= spaceAbove) {
        setPanelPos({ top: py + h + 2, left: px, width: w });
      } else {
        setPanelPos({ bottom: screenH - py + 2, left: px, width: w });
      }
      setOpen(true);
    });
  }

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        style={[styles.inlineDropdownBtn, { borderColor: COLORS.gray200 }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={value ? styles.inlineDropdownValue : styles.inlineDropdownPlaceholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.gray400, marginLeft: 6 }}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.inlineDropdownPanel, {
            position: 'absolute',
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelMaxH,
            ...(panelPos.top !== undefined ? { top: panelPos.top } : { bottom: panelPos.bottom }),
          }]}>
            <ScrollView bounces={false} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.inlineDropdownItem, value === opt && { backgroundColor: themeColors.primary }]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.inlineDropdownItemText, value === opt && { color: '#fff', fontWeight: '700' }]}>{opt}</Text>
                  {value === opt && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── 저장 완료 토스트 ───────────────────────────────────────────────────────
function SaveToast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View style={[styles.saveToast, { opacity }]} pointerEvents="none">
      <Text style={styles.saveToastText}>✅ 저장됐어요</Text>
    </Animated.View>
  );
}

// ─── 캘린더 팝업 피커 (월 그리드, ◀▶ 월 이동, 날짜 탭 선택) ─────────────────
function CalendarPicker({ date, onChange, onClose }: {
  date: Date; onChange: (d: Date) => void; onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => dayjs(date).startOf('month'));
  const selected = dayjs(date);

  const daysInMonth = viewMonth.daysInMonth();
  const firstDow = viewMonth.day(); // 0=Sun
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.calPickerWrapper}>
      {/* 헤더: ◀ YYYY년 MM월 ▶ */}
      <View style={styles.calPickerHeader}>
        <TouchableOpacity onPress={() => setViewMonth(m => m.subtract(1, 'month'))} hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}>
          <Text style={styles.calPickerNav}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.calPickerMonthLabel}>{viewMonth.format('YYYY년 M월')}</Text>
        <TouchableOpacity onPress={() => setViewMonth(m => m.add(1, 'month'))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 12 }}>
          <Text style={styles.calPickerNav}>▶</Text>
        </TouchableOpacity>
      </View>
      {/* 요일 헤더 */}
      <View style={styles.calPickerWeekRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <Text key={d} style={[styles.calPickerWeekDay, i === 0 && { color: COLORS.red }, i === 6 && { color: '#3b82f6' }]}>{d}</Text>
        ))}
      </View>
      {/* 날짜 그리드 */}
      {Array.from({ length: cells.length / 7 }, (_, wi) => (
        <View key={wi} style={styles.calPickerRow}>
          {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
            if (!day) return <View key={di} style={styles.calPickerCell} />;
            const thisDate = viewMonth.date(day);
            const isSelected = thisDate.isSame(selected, 'day');
            const dow = di; // 0=Sun
            return (
              <TouchableOpacity
                key={day}
                style={[styles.calPickerCell, isSelected && styles.calPickerCellSelected]}
                onPress={() => { onChange(thisDate.toDate()); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.calPickerDayText,
                  isSelected && { color: '#fff', fontWeight: '700' },
                  !isSelected && dow === 0 && { color: COLORS.red },
                  !isSelected && dow === 6 && { color: '#3b82f6' },
                ]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const EXTRA_PAY_METHODS = ['현금', '계좌이체'];

function EditRow({ expense, categories, paymentMethods, cardNames, accountNames, themeColors, onSave, onDelete, onCancel }: {
  expense: Expense;
  categories: string[];
  paymentMethods: string[];
  cardNames: string[];
  accountNames: string[];
  themeColors: ReturnType<typeof getThemeColors>;
  onSave: (updates: Partial<Expense>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(expense.name);
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [type, setType] = useState<'expense' | 'income'>((expense.type ?? 'expense') === 'income' ? 'income' : 'expense');
  const [paymentMethod, setPaymentMethod] = useState(expense.payment_method ?? '');
  const [date, setDate] = useState(new Date(expense.date));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 결제수단 그룹 아이템 구성 (카드 / 계좌 / 기타 수단 / 기타)
  const sortKo = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b, 'ko'));
  const sortedCards = sortKo(cardNames);
  const sortedAccounts = sortKo(accountNames);
  // 기존 지출 이력의 결제수단 중 카드/계좌에 없는 것만 기타 수단으로
  const historyExtras = paymentMethods.filter(
    m => !cardNames.includes(m) && !accountNames.includes(m)
  );
  const extraMethods = sortKo([...new Set([...historyExtras, ...EXTRA_PAY_METHODS.filter(
    m => !cardNames.includes(m) && !accountNames.includes(m)
  )])]);

  const payGroupItems: GroupedItem[] = [];
  if (sortedCards.length) { payGroupItems.push({ type: 'header', label: '카드' }); sortedCards.forEach(v => payGroupItems.push({ type: 'item', label: v, value: v })); }
  if (sortedAccounts.length) { payGroupItems.push({ type: 'header', label: '계좌' }); sortedAccounts.forEach(v => payGroupItems.push({ type: 'item', label: v, value: v })); }
  if (extraMethods.length) { payGroupItems.push({ type: 'header', label: '기타 수단' }); extraMethods.forEach(v => payGroupItems.push({ type: 'item', label: v, value: v })); }
  payGroupItems.push({ type: 'item', label: '기타', value: '기타' });

  return (
    <View style={styles.editBox}>
      {/* 헤더: 날짜 + 삭제 버튼 */}
      <View style={styles.editHeaderRow}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray500 }}>{dayjs(date).format('M월 D일')}</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}
          onPress={() => Alert.alert('삭제', '삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: onDelete },
          ])}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>삭제</Text>
        </TouchableOpacity>
      </View>
      {/* 지출/수입 토글 */}
      <View style={styles.typeToggleRow}>
        {(['expense', 'income'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.typeToggleBtn, type === t && { backgroundColor: themeColors.primary }]} onPress={() => setType(t)}>
            <Text style={[styles.typeToggleText, type === t && styles.typeToggleTextActive]}>{t === 'expense' ? '💸 지출' : '💰 수입'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* 항목명 */}
      <TextInput style={styles.editInput} value={name} onChangeText={setName} placeholder="항목명" placeholderTextColor={COLORS.gray400} returnKeyType="done" inputAccessoryViewID={Platform.OS === 'ios' ? 'editRowKbd' : undefined} />
      {/* 금액 + 원 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <TextInput
          style={[styles.editInput, { flex: 1, marginBottom: 0 }]}
          value={amount ? Number(amount).toLocaleString() : ''}
          onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={COLORS.gray300}
          returnKeyType="done"
          inputAccessoryViewID={Platform.OS === 'ios' ? 'editRowKbd' : undefined}
        />
        <Text style={{ fontSize: 14, color: COLORS.gray500, fontWeight: '600' }}>원</Text>
      </View>
      {/* 카테고리 + 날짜 2열 */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {type !== 'income' ? (
          <View style={{ flex: 1 }}>
            <DropdownPicker
              value={category}
              options={categories}
              onSelect={v => setCategory(v)}
              placeholder="카테고리"
              themeColors={themeColors}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <TouchableOpacity
          style={[styles.editInput, { flex: 1, marginBottom: 0, justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={{ fontSize: 14, color: COLORS.gray700 }}>{dayjs(date).format('M월 D일')}</Text>
        </TouchableOpacity>
      </View>
      {showDatePicker && (
        <CalendarPicker
          date={date}
          onChange={setDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}
      {/* 결제수단 */}
      <View style={{ marginBottom: 8 }}>
        <GroupedDropdownPicker
          value={paymentMethod}
          items={payGroupItems}
          onSelect={v => setPaymentMethod(v)}
          placeholder="결제수단 없음"
          inline
        />
        {paymentMethod !== '' && (
          <TouchableOpacity onPress={() => setPaymentMethod('')} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: COLORS.gray400 }}>✕ 선택 해제</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* 저장 / 취소 버튼 */}
      <View style={[styles.formBtnRow, { marginTop: 16 }]}>
        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={() => onSave({
          name,
          amount: parseInt(amount) || expense.amount,
          category: category as any,
          type,
          date: dayjs(date).format('YYYY-MM-DD'),
          payment_method: paymentMethod || null,
        })}>
          <Text style={styles.confirmBtnText}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelFormBtn} onPress={onCancel}>
          <Text style={styles.cancelFormBtnText}>취소</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TransferEditRow({ expense, onSave, onDelete, onCancel }: { expense: Expense; onSave: (u: Partial<Expense>) => void; onDelete: () => void; onCancel: () => void }) {
  const parts = expense.name.includes('→') ? expense.name.split('→').map(s => s.trim()) : [expense.name, ''];
  const [fromText, setFromText] = useState(parts[0]);
  const [toText, setToText] = useState(parts[1] || '');
  const [amount, setAmount] = useState(String(expense.amount));
  return (
    <View style={[styles.editBox, { backgroundColor: '#fafafa' }]}>
      <View style={styles.editHeaderRow}>
        <View style={styles.savingsBadge}><Text style={styles.savingsBadgeText}>이체</Text></View>
        <TouchableOpacity onPress={onCancel}><Text style={{ color: COLORS.gray400 }}>✕</Text></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <TextInput
          style={[styles.editInput, { flex: 1, marginBottom: 0 }]}
          value={fromText}
          onChangeText={setFromText}
          placeholder="출금 계좌"
          placeholderTextColor={COLORS.gray400}
        />
        <Text style={{ color: COLORS.gray400, fontSize: 16 }}>→</Text>
        <TextInput
          style={[styles.editInput, { flex: 1, marginBottom: 0 }]}
          value={toText}
          onChangeText={setToText}
          placeholder="입금 계좌"
          placeholderTextColor={COLORS.gray400}
        />
      </View>
      <TextInput
        style={styles.editInput}
        value={amount ? Number(amount).toLocaleString() : ''}
        onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        placeholder="금액"
        placeholderTextColor={COLORS.gray400}
      />
      <Text style={{ fontSize: 10, color: COLORS.gray400, marginBottom: 8 }}>* 금액 수정 시 계좌 잔액은 자동 반영되지 않아요</Text>
      <View style={styles.formBtnRow}>
        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#7c3aed' }]} onPress={() => onSave({
          name: toText ? `${fromText} → ${toText}` : fromText,
          amount: parseInt(amount) || expense.amount,
        })}>
          <Text style={styles.confirmBtnText}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteFormBtn} onPress={onDelete}>
          <Text style={styles.deleteFormBtnText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


function CalendarView({ calMonth, onChangeMonth, calExpenseMap, calIncomeSet, today, selectedDate, onSelectDate, themeColors }: {
  calMonth: string;
  onChangeMonth: (m: string) => void;
  calExpenseMap: Map<string, number>;
  calIncomeSet: Set<string>;
  today: string;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  themeColors: ReturnType<typeof getThemeColors>;
}) {
  const startOfMonth = dayjs(calMonth).startOf('month');
  const daysInMonth = startOfMonth.daysInMonth();
  const firstDow = startOfMonth.day();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calMonth}-${String(d).padStart(2, '0')}`;
    week.push(dateStr);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  return (
    <View>
      <View style={styles.calHeaderRow}>
        <TouchableOpacity style={styles.calNavBtn} onPress={() => onChangeMonth(dayjs(calMonth).subtract(1, 'month').format('YYYY-MM'))}>
          <Text style={styles.calNavBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.calMonthLabel}>{dayjs(calMonth).format('YYYY년 M월')}</Text>
        <TouchableOpacity style={styles.calNavBtn} onPress={() => onChangeMonth(dayjs(calMonth).add(1, 'month').format('YYYY-MM'))}>
          <Text style={styles.calNavBtnText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.calWeekRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <Text key={d} style={[styles.calWeekDay, i === 0 && { color: COLORS.red }, i === 6 && { color: '#3b82f6' }]}>{d}</Text>
        ))}
      </View>
      <View style={[styles.card, { backgroundColor: themeColors.bg }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.calRow}>
            {week.map((date, di) => {
              if (!date) return <View key={di} style={styles.calCell} />;
              const amt = calExpenseMap.get(date);
              const hasIncome = calIncomeSet.has(date);
              const isToday = date === today;
              const isSelected = date === selectedDate;
              const dow = dayjs(date).day();
              return (
                <TouchableOpacity key={date} style={[styles.calCell, isSelected && { backgroundColor: themeColors.primaryLight }]} onPress={() => onSelectDate(date)}>
                  <View style={[styles.calDayCircle, isToday && { backgroundColor: themeColors.primary }]}>
                    <Text style={[styles.calDayText, isToday && { color: '#fff' }, !isToday && dow === 0 && { color: COLORS.red }, !isToday && dow === 6 && { color: '#3b82f6' }]}>
                      {parseInt(date.split('-')[2])}
                    </Text>
                  </View>
                  {amt ? (
                    <Text style={styles.calAmount}>
                      -{amt >= 10000 ? `${Math.round(amt / 1000)}k` : amt.toLocaleString()}
                    </Text>
                  ) : null}
                  {hasIncome && <View style={styles.calIncomeDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: COLORS.accent },
  addCircleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addCircleBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  viewToggleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  viewSegment: { flexDirection: 'row', borderRadius: 20, padding: 3, gap: 2 },
  viewSegmentBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  viewSegmentText: { fontSize: 12, fontWeight: '600' },
  viewSegmentTextActive: { color: '#fff' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.gray800 },

  chipRow: { marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 11, color: COLORS.gray500 },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  resetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.redBg, borderWidth: 1, borderColor: '#fecdd3' },
  resetChipText: { fontSize: 11, color: COLORS.red },

  sortRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  sortChip: { flex: 1, paddingVertical: 7, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray100 },
  sortChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  sortChipText: { fontSize: 11, color: COLORS.gray400 },
  sortChipTextActive: { color: COLORS.primary, fontWeight: '700' },

  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  dateLabel: { fontSize: 12, fontWeight: '700', color: COLORS.gray500 },
  todayBadge: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  todayBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  dateSum: { fontSize: 12, fontWeight: '800' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, overflow: 'hidden' },
  rowWrap: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#fff' },
  rowName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  rowMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700', marginLeft: 12 },
  cardBadge: { backgroundColor: '#fee2e2', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  cardBadgeText: { fontSize: 9, fontWeight: '700', color: '#b91c1c' },
  incomeBadge: { backgroundColor: COLORS.greenBg, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  cardBadge: { backgroundColor: '#fef2f2', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  cardBadgeText: { fontSize: 10 },
  savingsBadge: { backgroundColor: '#ede9fe', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  incomeBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  savingsBadgeText: { fontSize: 9, fontWeight: '700', color: '#7c3aed' },
  divider: { height: 1, backgroundColor: COLORS.gray50, marginHorizontal: 14 },

  selectedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray50 },

  editBox: { padding: 14, backgroundColor: '#fafafa' },
  editHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeToggleRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, padding: 3, marginBottom: 8 },
  typeToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  typeToggleBtnActive: { backgroundColor: COLORS.primary },
  typeToggleText: { fontSize: 12, fontWeight: '600', color: COLORS.gray400 },
  typeToggleTextActive: { color: '#fff' },
  editInput: {
    borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: COLORS.gray800,
    backgroundColor: '#fff', marginBottom: 8,
  },
  fieldLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  smallChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: '#fff' },
  smallChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smallChipText: { fontSize: 11, color: COLORS.gray500 },
  smallChipTextActive: { color: '#fff', fontWeight: '600' },
  formBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  deleteFormBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.redBg, alignItems: 'center', justifyContent: 'center' },
  deleteFormBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.red },
  cancelFormBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  cancelFormBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },

  calHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calNavBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  calNavBtnText: { fontSize: 14, color: COLORS.gray600 },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekDay: { flex: 1, textAlign: 'center', fontSize: 11, color: COLORS.gray400, paddingVertical: 4 },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  calCellSelected: { backgroundColor: COLORS.primaryLight },
  calDayCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  calDayText: { fontSize: 12, fontWeight: '500', color: COLORS.gray700 },
  calAmount: { fontSize: 9, fontWeight: '700', color: COLORS.red },
  calIncomeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.green },


  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dropdownBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: '#fff' },
  dropdownBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.gray600, flexShrink: 1 },
  dropdownArrow: { fontSize: 9, color: COLORS.gray400 },
  dropdownPanel: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, marginBottom: 8, overflow: 'hidden' },
  filterOverlayPanel: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100,
    overflow: 'hidden', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  dropdownOpt: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray50 },
  dropdownOptText: { fontSize: 13, color: COLORS.gray700 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  fullscreenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray100, backgroundColor: '#fff' },
  headerSideBtn: { width: 48, paddingVertical: 4 },
  headerCancelText: { fontSize: 16, color: COLORS.gray500 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.gray800 },
  amountSection: { borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 20 },
  amountInput: { fontSize: 32, fontWeight: '700', color: COLORS.gray800, paddingVertical: 8, letterSpacing: -0.5 },
  amountUnit: { fontSize: 18, color: COLORS.gray500, fontWeight: '500', marginTop: 2 },

  // 인라인 드롭다운 (EditRow 내부, 서브 모달 없이 인라인 렌더링)
  inlineDropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1 },
  inlineDropdownValue: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  inlineDropdownPlaceholder: { fontSize: 13, color: '#9ca3af', flex: 1 },
  inlineDropdownPanel: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: COLORS.gray200, marginTop: 2, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  inlineDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  inlineDropdownItemText: { fontSize: 13, color: COLORS.gray700 },

  // 드롭다운 오버레이 & 시트
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  dropdownSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 36 },
  dropdownHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center' as const, marginBottom: 8 },
  dropdownSheetItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownSheetItemText: { fontSize: 14, color: '#374151' },

  // 저장 완료 토스트
  saveToast: { position: 'absolute' as const, bottom: 24, alignSelf: 'center' as const, backgroundColor: 'rgba(30,30,30,0.88)', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 30 },
  saveToastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cardPaySheet: { backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, paddingBottom: 40 },
  editSheet: { backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 0, maxHeight: '85%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray800, marginBottom: 20 },
  cardPayInfoBox: { backgroundColor: '#fafafa', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, padding: 14, marginBottom: 20 },
  cardPayInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  cardPayInfoLabel: { fontSize: 13, color: COLORS.gray500 },
  cardPayInfoValue: { fontSize: 13, fontWeight: '700', color: COLORS.gray800 },
  cardPayAccountNote: { fontSize: 11, color: COLORS.gray400, marginTop: 8, textAlign: 'center' },

  // 캘린더 팝업 피커
  calPickerWrapper: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray200, padding: 10, marginBottom: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  calPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calPickerNav: { fontSize: 14, color: COLORS.gray500, paddingHorizontal: 6 },
  calPickerMonthLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray800 },
  calPickerWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calPickerWeekDay: { flex: 1, textAlign: 'center', fontSize: 10, color: COLORS.gray400, paddingVertical: 3 },
  calPickerRow: { flexDirection: 'row' },
  calPickerCell: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' },
  calPickerCellSelected: { backgroundColor: COLORS.primary, borderRadius: 17 },
  calPickerDayText: { fontSize: 12, color: COLORS.gray700 },

  // 키보드 액세서리 바
  kbdBar: { backgroundColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.gray200 },
  kbdBarBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  kbdBarBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
});
