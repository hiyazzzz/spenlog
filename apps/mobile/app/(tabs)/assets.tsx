import React, { useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch, Keyboard } from 'react-native';
import SlideUpModal from '@/components/SlideUpModal';
import { useFocusEffect } from 'expo-router';
import { useDataCache } from '@/store/dataCache';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, getThemeColors, useThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { monthString } from '@/lib/date';
import { getAssetsData, addAccount, deleteAccount, addCard, deleteCard, updateIncome, updateAccount, updateCard, getMonthExpensesTotal, type AssetsData } from '@/lib/api/assets';
import { getFixedCostsData, addFixedCost, editFixedCost, deleteFixedCost, type FixedCostsData } from '@/lib/api/fixed-costs';
import { getBudgetData, saveBudgets, recommendBudget, type BudgetData } from '@/lib/api/budget';
import { getPaidFixedCostNames, getPaidCardIds, recordFixedCostPayment, recordCardPayment } from '@/lib/api/routine';
import type { Card as CardType, FixedCost } from '@spenlog/types';

const ACCOUNT_TYPES = ['입출금', '적금', '투자', '기타'] as const;

type SubTab = 'assets' | 'fixed' | 'budget';

function fmt(v: string) {
  const n = v.replace(/[^0-9]/g, '');
  return n ? Number(n).toLocaleString() : '';
}
function parse(v: string) {
  return parseInt(v.replace(/[^0-9]/g, '')) || 0;
}

export default function AssetsScreen() {
  const [subTab, setSubTab] = useState<SubTab>('assets');
  const { themeColors, tabBg } = useThemeColors();
  const { colors } = useAppTheme();

  return (
    <View style={[sharedStyles.screen, { backgroundColor: colors.bg }]}>
      <View style={[sharedStyles.headerWrap, { backgroundColor: colors.bg }]}>
        <Text style={[sharedStyles.pageTitle, { color: themeColors.accent }]}>자산</Text>
        <View style={[sharedStyles.subTabBar, { backgroundColor: tabBg }]}>
          {([
            { key: 'assets', label: '자산현황' },
            { key: 'budget', label: '예산' },
            { key: 'fixed', label: '고정비' },
          ] as { key: SubTab; label: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[sharedStyles.subTabBtn, subTab === t.key && { backgroundColor: themeColors.primary }]}
              onPress={() => setSubTab(t.key)}
            >
              <Text style={[sharedStyles.subTabBtnText, { color: subTab === t.key ? '#fff' : themeColors.primary }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {subTab === 'assets' && <AssetsPanel onNavigate={setSubTab} />}
      {subTab === 'fixed' && <FixedCostsPanel themeColors={themeColors} />}
      {subTab === 'budget' && <BudgetPanel themeColors={themeColors} />}
    </View>
  );
}

function Section({
  title, summary, defaultOpen = false, children,
}: {
  title: string; summary: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={assetStyles.section}>
      <TouchableOpacity style={assetStyles.sectionHeader} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={assetStyles.sectionTitle}>{title}</Text>
        <View style={assetStyles.sectionHeaderRight}>
          <Text style={assetStyles.sectionSummary}>{summary}</Text>
          <Text style={[assetStyles.sectionChevron, open && { transform: [{ rotate: '180deg' }] }]}>▼</Text>
        </View>
      </TouchableOpacity>
      {open && <View style={assetStyles.sectionBody}>{children}</View>}
    </View>
  );
}

function AssetsPanel({ onNavigate }: { onNavigate: (tab: SubTab) => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<AssetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 계좌 추가 모달
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBank, setAccBank] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accType, setAccType] = useState<typeof ACCOUNT_TYPES[number]>('입출금');
  const [savingAccount, setSavingAccount] = useState(false);

  // 현금 빠른 추가
  const [showCashForm, setShowCashForm] = useState(false);
  const [cashBalance, setCashBalance] = useState('');
  const [savingCash, setSavingCash] = useState(false);

  // 카드 추가 모달
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');
  const [cardBillingStartDay, setCardBillingStartDay] = useState('');
  const [cardLinkedAccountId, setCardLinkedAccountId] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);

  // 계좌 수정 인라인
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccBank, setEditAccBank] = useState('');
  const [editAccType, setEditAccType] = useState<typeof ACCOUNT_TYPES[number]>('입출금');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [savingEditAccount, setSavingEditAccount] = useState(false);

  // 카드 수정 인라인
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardBank, setEditCardBank] = useState('');
  const [editCardDueDay, setEditCardDueDay] = useState('');
  const [editCardBillingStart, setEditCardBillingStart] = useState('');
  const [editCardLinkedAccountId, setEditCardLinkedAccountId] = useState<string | null>(null);
  const [savingEditCard, setSavingEditCard] = useState(false);

  // 월 수입 수정
  const [editingIncome, setEditingIncome] = useState(false);

  function closeAllEditing() {
    setEditingAccountId(null);
    setEditingCardId(null);
    setEditingIncome(false);
    Keyboard.dismiss();
  }
  const [income, setIncome] = useState('');
  const [savingGoal, setSavingGoal] = useState('');
  const [savingIncome, setSavingIncome] = useState(false);

  // 루틴 관리
  const [routineExpanded, setRoutineExpanded] = useState(false);
  const [cardSectionExpanded, setCardSectionExpanded] = useState(false);
  const [paidFixedCostIds, setPaidFixedCostIds] = useState<Set<string>>(new Set());
  const [paidCardIds, setPaidCardIds] = useState<Set<string>>(new Set());
  const [processingFixedId, setProcessingFixedId] = useState<string | null>(null);
  const [routineToast, setRoutineToast] = useState('');

  // 카드 납부 기록 모달
  const [cardPaySheet, setCardPaySheet] = useState<CardType | null>(null);
  const [cardPayAmount, setCardPayAmount] = useState('');
  const [cardPayMemo, setCardPayMemo] = useState('');
  const [cardPaySaving, setCardPaySaving] = useState(false);
  const [cardPayMonth, setCardPayMonth] = useState('');
  const [cardPayMonthTotal, setCardPayMonthTotal] = useState(0);
  const [loadingMonthTotal, setLoadingMonthTotal] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) {
        setError('로그인이 필요해요');
        return;
      }
      setUserId(uid);
      // 캐시 먼저 표시 (스피너 없이 즉시 렌더링)
      const cached = useDataCache.getState().assets;
      if (cached) { setData(cached); setLoading(false); }

      const result = await getAssetsData(uid);
      useDataCache.getState().setAssets(result);
      setData(result);
      setIncome(result.profile?.income ? Number(result.profile.income).toLocaleString() : '');
      setSavingGoal(result.profile?.saving_goal ? Number(result.profile.saving_goal).toLocaleString() : '');

      const [paidNames, paidCards] = await Promise.all([
        getPaidFixedCostNames(uid, monthString()),
        getPaidCardIds(uid, monthString()),
      ]);
      // 이름 → ID 변환 (expenses 테이블 name 기준, 웹 RoutineBanner와 동일 방식)
      const fixedCostIds = new Set<string>(
        result.fixedCosts.filter((fc: any) => paidNames.has(fc.name)).map((fc: any) => fc.id)
      );
      setPaidFixedCostIds(fixedCostIds);
      setPaidCardIds(paidCards);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[sharedStyles.panel, sharedStyles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[sharedStyles.panel, sharedStyles.center]}>
        <Text style={sharedStyles.emptyText}>{error ?? '데이터를 불러오지 못했어요'}</Text>
      </View>
    );
  }

  const accounts = data.accounts;
  const cards = data.cards;
  const fixedCosts = data.fixedCosts;
  const profile = data.profile;
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalBudget = data.budgets.reduce((s, b) => s + b.amount, 0);
  const monthlyIncome = profile?.income ?? 0;
  const themeColors = getThemeColors(profile?.theme);

  function resetAccountForm() {
    setAccName(''); setAccBank(''); setAccBalance(''); setAccType('입출금');
    setShowAddAccount(false);
  }

  async function handleAddAccount() {
    if (!userId || !accName.trim() || savingAccount) return;
    setSavingAccount(true);
    try {
      const { error: err } = await addAccount(userId, {
        name: accName.trim(), bank: accBank.trim() || accName.trim(),
        balance: parse(accBalance), type: accType,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetAccountForm();
      await load();
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleAddCash() {
    if (!userId || !cashBalance || savingCash) return;
    setSavingCash(true);
    try {
      const { error: err } = await addAccount(userId, {
        name: '현금', bank: '현금', balance: parse(cashBalance), type: '현금',
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      setCashBalance(''); setShowCashForm(false);
      await load();
    } finally {
      setSavingCash(false);
    }
  }

  function confirmDeleteAccount(id: string, name: string) {
    Alert.alert('계좌 삭제', `'${name}' 계좌를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await deleteAccount(id);
          await load();
        },
      },
    ]);
  }

  function resetCardForm() {
    setCardName(''); setCardBank(''); setCardDueDay(''); setCardBillingStartDay(''); setCardLinkedAccountId(null);
    setShowAddCard(false);
  }

  async function handleAddCard() {
    if (!userId || !cardName.trim() || savingCard) return;
    setSavingCard(true);
    try {
      const { error: err } = await addCard(userId, {
        name: cardName.trim(), bank: cardBank.trim() || cardName.trim(),
        due_day: cardDueDay ? parseInt(cardDueDay) : null,
        billing_start_day: cardBillingStartDay ? parseInt(cardBillingStartDay) : null,
        linked_account_id: cardLinkedAccountId,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetCardForm();
      await load();
    } finally {
      setSavingCard(false);
    }
  }

  function confirmDeleteCard(id: string, name: string) {
    Alert.alert('카드 삭제', `'${name}' 카드를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await deleteCard(id);
          await load();
        },
      },
    ]);
  }

  async function handleUpdateAccount() {
    if (!editingAccountId || savingEditAccount) return;
    setSavingEditAccount(true);
    try {
      const { error: err } = await updateAccount(editingAccountId, {
        name: editAccName.trim(), bank: editAccBank.trim(),
        type: editAccType, balance: parse(editAccBalance),
      });
      if (err) { Alert.alert('수정 실패', err.message); return; }
      setEditingAccountId(null);
      await load();
    } finally {
      setSavingEditAccount(false);
    }
  }

  async function handleUpdateCard() {
    if (!editingCardId || savingEditCard) return;
    setSavingEditCard(true);
    try {
      const { error: err } = await updateCard(editingCardId, {
        name: editCardName.trim(), bank: editCardBank.trim(),
        due_day: editCardDueDay ? parseInt(editCardDueDay) : null,
        billing_start_day: editCardBillingStart ? parseInt(editCardBillingStart) : null,
        linked_account_id: editCardLinkedAccountId ?? null,
      });
      if (err) { Alert.alert('수정 실패', err.message); return; }
      setEditingCardId(null);
      await load();
    } finally {
      setSavingEditCard(false);
    }
  }

  async function handleSaveIncome() {
    if (!userId || savingIncome) return;
    setSavingIncome(true);
    try {
      const { error: err } = await updateIncome(userId, parse(income), parse(savingGoal));
      if (err) { Alert.alert('저장 실패', err.message); return; }
      setEditingIncome(false);
      await load();
    } finally {
      setSavingIncome(false);
    }
  }

  async function handleRecordFixedCost(fc: FixedCost) {
    if (!userId || processingFixedId) return;
    setProcessingFixedId(fc.id);
    try {
      await recordFixedCostPayment(userId, fc, monthString());
      setPaidFixedCostIds(prev => new Set(prev).add(fc.id));
      setRoutineToast(`${fc.name} 기록 완료 ✓`);
      setTimeout(() => setRoutineToast(''), 2000);
      await load();
    } finally {
      setProcessingFixedId(null);
    }
  }

  function openCardPaySheet(card: CardType) {
    setCardPaySheet(card);
    setCardPayMemo('');
    const now = new Date();
    // 이번 달 기준으로 시작 (최근 입력한 카드 지출이 바로 보임)
    const pm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCardPayMonth(pm);
    setCardPayAmount('');
    loadMonthTotal(pm, card.name);
  }

  async function loadMonthTotal(month: string, cardName?: string) {
    if (!userId) return;
    setLoadingMonthTotal(true);
    try {
      const total = await getMonthExpensesTotal(userId, month, cardName);
      setCardPayMonthTotal(total);
      setCardPayAmount(total > 0 ? fmt(String(total)) : '');
    } finally {
      setLoadingMonthTotal(false);
    }
  }

  async function handleSaveCardPayment() {
    if (!userId || !cardPaySheet || cardPaySaving) return;
    const amount = parse(cardPayAmount);
    if (amount <= 0) { Alert.alert('금액을 입력해주세요'); return; }
    setCardPaySaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await recordCardPayment(userId, cardPaySheet, cardPayMonth || monthString(), amount, today, cardPayMemo.trim() || null);
      setPaidCardIds(prev => new Set(prev).add(cardPaySheet.id));
      setCardPaySheet(null);
      setRoutineToast(`${cardPaySheet.name} 카드 대금 기록 완료 ✓`);
      setTimeout(() => setRoutineToast(''), 2000);
      await load();
    } finally {
      setCardPaySaving(false);
    }
  }

  function getCardPayStatus(card: CardType): { label: string; color: string } {
    if (paidCardIds.has(card.id)) return { label: '✓ 완료', color: COLORS.green };
    if (!card.due_day) return { label: '', color: COLORS.gray400 };
    const today = new Date();
    const todayDay = today.getDate();
    const diff = card.due_day - todayDay;
    if (diff === 0) return { label: '오늘 납부일 ⚠️', color: COLORS.amber };
    if (diff < 0) {
      // 등록 월이 이번 달이면 지연 뱃지 미표시 (다음 달부터 적용)
      if (card.created_at) {
        const cardDate = new Date(card.created_at);
        const cardYearMonth = cardDate.getFullYear() * 100 + (cardDate.getMonth() + 1);
        const thisYearMonth = today.getFullYear() * 100 + (today.getMonth() + 1);
        if (cardYearMonth >= thisYearMonth) return { label: '', color: COLORS.gray400 };
      }
      return { label: '지연 ⚠️', color: COLORS.red };
    }
    return { label: `D-${diff}`, color: COLORS.gray400 };
  }

  const routineTotal = fixedCosts.length;
  const routineDone = fixedCosts.filter(fc => paidFixedCostIds.has(fc.id)).length;
  const cardsDone = cards.filter(c => paidCardIds.has(c.id)).length;

  // 자산/카드/고정비 중 하나도 없으면 초기 설정 가이드 배너 표시
  const showSetupBanner = accounts.length === 0 && cards.length === 0 && fixedCosts.length === 0;

  return (
    <ScrollView style={sharedStyles.panel} contentContainerStyle={sharedStyles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={closeAllEditing}>
      {/* 초기 설정 가이드 배너 */}
      {showSetupBanner && (
        <View style={[assetStyles.setupBanner, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary + '33' }]}>
          <Text style={assetStyles.setupBannerEmoji}>📌</Text>
          <View style={{ flex: 1 }}>
            <Text style={[assetStyles.setupBannerTitle, { color: themeColors.accent }]}>아직 설정 전이에요</Text>
            <Text style={assetStyles.setupBannerDesc}>고정비·통장·카드를 등록하면{'\n'}루틴 관리까지 자동으로 돼요</Text>
          </View>
          <TouchableOpacity
            style={[assetStyles.setupBannerBtn, { backgroundColor: themeColors.primary }]}
            onPress={() => onNavigate('fixed')}
          >
            <Text style={assetStyles.setupBannerBtnText}>시작 →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 0. 이번 달 루틴 (고정비만) */}
      {fixedCosts.length > 0 && (
        <View style={[assetStyles.section, { backgroundColor: themeColors.primaryLight + '33', borderColor: themeColors.primaryLight }]}>
          <TouchableOpacity style={assetStyles.sectionHeader} onPress={() => setRoutineExpanded(o => !o)} activeOpacity={0.7}>
            <Text style={[assetStyles.sectionTitle, { color: themeColors.primary }]}>이번 달 정기 기록</Text>
            <View style={assetStyles.sectionHeaderRight}>
              <Text style={[assetStyles.sectionSummary, { color: themeColors.primary }]}>{routineDone}/{routineTotal} 완료</Text>
              <Text style={[assetStyles.sectionChevron, routineExpanded && { transform: [{ rotate: '180deg' }] }]}>▼</Text>
            </View>
          </TouchableOpacity>
          {routineExpanded && (
            <View style={assetStyles.sectionBody}>
              {!!routineToast && (
                <View style={assetStyles.toast}>
                  <Text style={assetStyles.toastText}>{routineToast}</Text>
                </View>
              )}
              {[
                ...fixedCosts.filter(fc => !paidFixedCostIds.has(fc.id)).sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99)),
                ...fixedCosts.filter(fc => paidFixedCostIds.has(fc.id)).sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99)),
              ].map(fc => {
                const paid = paidFixedCostIds.has(fc.id);
                const todayDay = new Date(Date.now() + 9*60*60*1000).getDate();
                const overdue = !paid && fc.due_day != null && todayDay > fc.due_day;
                return (
                  <View key={fc.id} style={assetStyles.routineRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={assetStyles.rowTitle}>{fc.name}</Text>
                        {overdue && <Text style={assetStyles.overdueBadge}> ⚠️ 출금일 지남</Text>}
                      </View>
                      <Text style={assetStyles.rowSubtitle}>{fc.kind} · {formatCurrency(fc.amount)} · 매월 {fc.due_day}일</Text>
                    </View>
                    {paid ? (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.green }}>✓ 완료</Text>
                    ) : (
                      <TouchableOpacity
                        style={[assetStyles.recordBtn, { backgroundColor: themeColors.primary }]}
                        onPress={() => handleRecordFixedCost(fc)}
                        disabled={processingFixedId === fc.id}
                      >
                        <Text style={assetStyles.recordBtnText}>{processingFixedId === fc.id ? '처리 중...' : '기록'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 0-1. 이번 달 카드 납부 */}
      {cards.length > 0 && (
        <View style={[assetStyles.section, { backgroundColor: themeColors.primaryLight + '33', borderColor: themeColors.primaryLight }]}>
          <TouchableOpacity style={assetStyles.sectionHeader} onPress={() => setCardSectionExpanded(o => !o)} activeOpacity={0.7}>
            <Text style={[assetStyles.sectionTitle, { color: themeColors.primary }]}>이번 달 카드 납부</Text>
            <View style={assetStyles.sectionHeaderRight}>
              <Text style={[assetStyles.sectionSummary, { color: themeColors.primary }]}>{cardsDone}/{cards.length} 완료</Text>
              <Text style={[assetStyles.sectionChevron, cardSectionExpanded && { transform: [{ rotate: '180deg' }] }]}>▼</Text>
            </View>
          </TouchableOpacity>
          {cardSectionExpanded && <View style={assetStyles.sectionBody}>
            {!!routineToast && !fixedCosts.length && (
              <View style={assetStyles.toast}>
                <Text style={assetStyles.toastText}>{routineToast}</Text>
              </View>
            )}
            {cards.map(card => {
              const paid = paidCardIds.has(card.id);
              const status = getCardPayStatus(card);
              return (
                <View key={card.id} style={assetStyles.routineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={assetStyles.rowTitle}>{card.name}</Text>
                    <Text style={assetStyles.rowSubtitle}>{card.bank} · 납부일 매월 {card.due_day}일</Text>
                    {!!status.label && (
                      <Text style={[assetStyles.cardStatusBadge, { color: status.color }]}>{status.label}</Text>
                    )}
                  </View>
                  {paid ? (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.green }}>✓ 완료</Text>
                  ) : (
                    <TouchableOpacity style={[assetStyles.recordBtn, { backgroundColor: themeColors.primary }]} onPress={() => openCardPaySheet(card)}>
                      <Text style={assetStyles.recordBtnText}>납부 기록</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>}
        </View>
      )}

      {/* 1. 월 수입 */}
      <Section title="월 수입" summary={formatCurrency(monthlyIncome)}>
        {!editingIncome ? (
          <>
            <Text style={[assetStyles.incomeValue, { color: themeColors.accent }]}>{formatCurrency(monthlyIncome)}</Text>
            {(profile?.saving_goal ?? 0) > 0 && (
              <Text style={assetStyles.incomeSubtext}>저축 목표 {formatCurrency(Number(profile?.saving_goal))}</Text>
            )}
            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setEditingIncome(true)}>
              <Text style={[assetStyles.editLink, { color: themeColors.primary }]}>✏️ 수정</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View>
            <Text style={assetStyles.fieldLabel}>월 수입</Text>
            <TextInput
              style={assetStyles.input}
              keyboardType="numeric"
              value={income}
              onChangeText={v => setIncome(fmt(v))}
              placeholder="0"
              placeholderTextColor={COLORS.gray400}
            />
            <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>저축 목표</Text>
            <TextInput
              style={assetStyles.input}
              keyboardType="numeric"
              value={savingGoal}
              onChangeText={v => setSavingGoal(fmt(v))}
              placeholder="0"
              placeholderTextColor={COLORS.gray400}
            />
            <View style={assetStyles.formBtnRow}>
              <TouchableOpacity style={[assetStyles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={handleSaveIncome} disabled={savingIncome}>
                <Text style={assetStyles.confirmBtnText}>{savingIncome ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={assetStyles.cancelBtn} onPress={() => setEditingIncome(false)}>
                <Text style={assetStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Section>

      {/* 2. 예산 → 예산 서브탭으로 이동 */}
      <TouchableOpacity style={assetStyles.linkRow} onPress={() => onNavigate('budget')} activeOpacity={0.7}>
        <Text style={assetStyles.linkRowTitle}>카테고리별 예산</Text>
        <View style={assetStyles.linkRowRight}>
          <Text style={[assetStyles.linkRowValue, totalBudget > 0 && { color: themeColors.accent }]}>
            {totalBudget > 0 ? formatCurrency(totalBudget) + ' 설정됨' : '미설정'}
          </Text>
          <Text style={assetStyles.chevronRight}>›</Text>
        </View>
      </TouchableOpacity>

      {/* 3. 계좌/현금 */}
      <Section title="계좌 / 현금" summary={`총 ${formatCurrency(totalBalance)}`}>
        {accounts.length === 0 && (
          <Text style={assetStyles.emptyText}>등록된 계좌가 없어요</Text>
        )}
        {accounts.map(acc => (
          <View key={acc.id}>
            <View style={assetStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={assetStyles.rowTitle}>{acc.name}</Text>
                <Text style={assetStyles.rowSubtitle}>{acc.bank} · {acc.type}</Text>
              </View>
              <View style={assetStyles.rowRight}>
                <Text style={[assetStyles.rowAmountAccent, { color: themeColors.accent }]}>{formatCurrency(acc.balance)}</Text>
                <TouchableOpacity style={assetStyles.editBtn} onPress={() => {
                  if (editingAccountId === acc.id) { setEditingAccountId(null); return; }
                  setEditingAccountId(acc.id);
                  setEditAccName(acc.name);
                  setEditAccBank(acc.bank);
                  setEditAccType((acc.type || '입출금') as typeof ACCOUNT_TYPES[number]);
                  setEditAccBalance(String(acc.balance ?? 0));
                }}>
                  <Text style={assetStyles.editBtnText}>{editingAccountId === acc.id ? '닫기' : '수정'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={assetStyles.deleteBtn} onPress={() => confirmDeleteAccount(acc.id, acc.name)}>
                  <Text style={assetStyles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
            {editingAccountId === acc.id && (
              <View style={assetStyles.inlineEditForm}>
                <Text style={[assetStyles.fieldLabel, { marginBottom: 4 }]}>계좌명</Text>
                <TextInput style={assetStyles.input} value={editAccName} onChangeText={setEditAccName} placeholder="예) 국민 주거래통장" placeholderTextColor={COLORS.gray400} />
                <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 4 }]}>은행</Text>
                <TextInput style={assetStyles.input} value={editAccBank} onChangeText={setEditAccBank} placeholder="예) KB국민" placeholderTextColor={COLORS.gray400} />
                <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 4 }]}>잔액</Text>
                <TextInput style={assetStyles.input} value={editAccBalance ? Number(editAccBalance).toLocaleString() : ''} onChangeText={v => setEditAccBalance(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.gray400} />
                <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 6 }]}>유형</Text>
                <View style={[assetStyles.chipRow, { marginBottom: 4 }]}>
                  {ACCOUNT_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[assetStyles.typeChip, editAccType === t && assetStyles.typeChipActive, { borderColor: themeColors.primary }]} onPress={() => setEditAccType(t)}>
                      <Text style={[assetStyles.typeChipText, editAccType === t && { color: themeColors.primary }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={assetStyles.formBtnRow}>
                  <TouchableOpacity style={[assetStyles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={handleUpdateAccount} disabled={savingEditAccount || !editAccName.trim()}>
                    <Text style={assetStyles.confirmBtnText}>{savingEditAccount ? '저장 중...' : '저장'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={assetStyles.cancelBtn} onPress={() => { setEditingAccountId(null); setEditAccName(acc.name); setEditAccBank(acc.bank); setEditAccType((acc.type || '입출금') as typeof ACCOUNT_TYPES[number]); setEditAccBalance(String(acc.balance ?? 0)); }}>
                    <Text style={assetStyles.cancelBtnText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        {showCashForm && (
          <View style={assetStyles.cashForm}>
            <Text style={assetStyles.cashFormTitle}>현금 잔액</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[assetStyles.input, { flex: 1 }]}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.gray400}
                value={cashBalance}
                onChangeText={v => setCashBalance(fmt(v))}
                autoFocus
              />
              <TouchableOpacity style={assetStyles.cashAddConfirmBtn} onPress={handleAddCash} disabled={savingCash}>
                <Text style={assetStyles.cashAddConfirmBtnText}>{savingCash ? '추가 중...' : '추가'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={assetStyles.cancelBtn} onPress={() => { setShowCashForm(false); setCashBalance(''); }}>
                <Text style={assetStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={assetStyles.addBtnRow}>
          <TouchableOpacity style={[assetStyles.fullAddBtn, assetStyles.cashAddBtn]} onPress={() => setShowCashForm(s => !s)}>
            <Text style={assetStyles.cashAddBtnText}>+ 현금 추가</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[assetStyles.fullAddBtn, { backgroundColor: themeColors.primaryLight }]} onPress={() => setShowAddAccount(true)}>
            <Text style={[assetStyles.fullAddBtnText, { color: themeColors.primary }]}>+ 계좌 추가</Text>
          </TouchableOpacity>
        </View>
      </Section>

      {/* 4. 카드 */}
      <Section title="카드" summary={`${cards.length}개 등록됨`}>
        {cards.length === 0 && (
          <Text style={assetStyles.emptyText}>등록된 카드가 없어요</Text>
        )}
        {cards.map(card => {
          const linkedAccount = accounts.find(a => a.id === card.linked_account);
          const status = getCardPayStatus(card);
          return (
            <View key={card.id}>
              <View style={assetStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={assetStyles.rowTitle}>{card.name}</Text>
                  <Text style={assetStyles.rowSubtitle}>
                    {card.bank} · 납부일 매월 {card.due_day}일
                    {linkedAccount ? ' · ' + linkedAccount.name : ''}
                  </Text>
                  {!!status.label && (
                    <Text style={[assetStyles.cardStatusBadge, { color: status.color }]}>{status.label}</Text>
                  )}
                </View>
                <View style={assetStyles.rowRight}>
                  <TouchableOpacity style={assetStyles.editBtn} onPress={() => {
                    if (editingCardId === card.id) { setEditingCardId(null); return; }
                    setEditingCardId(card.id);
                    setEditCardName(card.name);
                    setEditCardBank(card.bank);
                    setEditCardDueDay(card.due_day ? String(card.due_day) : '');
                    setEditCardBillingStart(card.billing_start_day ? String(card.billing_start_day) : '');
                    setEditCardLinkedAccountId(card.linked_account_id ?? null);
                  }}>
                    <Text style={assetStyles.editBtnText}>{editingCardId === card.id ? '닫기' : '수정'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={assetStyles.deleteBtn} onPress={() => confirmDeleteCard(card.id, card.name)}>
                    <Text style={assetStyles.deleteBtnText}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {editingCardId === card.id && (
                <View style={assetStyles.inlineEditForm}>
                  <Text style={[assetStyles.fieldLabel, { marginBottom: 4 }]}>카드명</Text>
                  <TextInput style={assetStyles.input} value={editCardName} onChangeText={setEditCardName} placeholder="예) 신한카드" placeholderTextColor={COLORS.gray400} />
                  <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 4 }]}>카드사</Text>
                  <TextInput style={assetStyles.input} value={editCardBank} onChangeText={setEditCardBank} placeholder="예) 신한" placeholderTextColor={COLORS.gray400} />
                  <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 4 }]}>대금 출금일</Text>
                  <TextInput style={assetStyles.input} value={editCardDueDay} onChangeText={v => setEditCardDueDay(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="예) 15" placeholderTextColor={COLORS.gray400} />
                  <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 4 }]}>청구 시작일 (선택)</Text>
                  <TextInput style={assetStyles.input} value={editCardBillingStart} onChangeText={v => setEditCardBillingStart(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="미입력 시 매달 1일 기준" placeholderTextColor={COLORS.gray400} />
                  <Text style={[assetStyles.fieldLabel, { marginTop: 10, marginBottom: 4 }]}>연결 계좌</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <TouchableOpacity
                      style={[assetStyles.typeChip, editCardLinkedAccountId === null && assetStyles.typeChipActive, editCardLinkedAccountId === null && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                      onPress={() => setEditCardLinkedAccountId(null)}>
                      <Text style={[assetStyles.typeChipText, editCardLinkedAccountId === null && assetStyles.typeChipTextActive]}>없음</Text>
                    </TouchableOpacity>
                    {accounts.map(acc => (
                      <TouchableOpacity key={acc.id}
                        style={[assetStyles.typeChip, editCardLinkedAccountId === acc.id && assetStyles.typeChipActive, editCardLinkedAccountId === acc.id && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                        onPress={() => setEditCardLinkedAccountId(acc.id)}>
                        <Text style={[assetStyles.typeChipText, editCardLinkedAccountId === acc.id && assetStyles.typeChipTextActive]}>{acc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={assetStyles.formBtnRow}>
                    <TouchableOpacity style={[assetStyles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={handleUpdateCard} disabled={savingEditCard || !editCardName.trim()}>
                      <Text style={assetStyles.confirmBtnText}>{savingEditCard ? '저장 중...' : '저장'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={assetStyles.cancelBtn} onPress={() => setEditingCardId(null)}>
                      <Text style={assetStyles.cancelBtnText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <TouchableOpacity style={[assetStyles.fullAddBtn, { backgroundColor: themeColors.primaryLight }]} onPress={() => setShowAddCard(true)}>
          <Text style={[assetStyles.fullAddBtnText, { color: themeColors.primary }]}>+ 카드 추가</Text>
        </TouchableOpacity>
      </Section>

      {/* 계좌 추가 모달 */}
      <SlideUpModal visible={showAddAccount} onRequestClose={resetAccountForm}>
        <View style={assetStyles.modalSheet}>
          <Text style={assetStyles.modalTitle}>계좌 추가</Text>
          <Text style={assetStyles.fieldLabel}>계좌명</Text>
          <TextInput style={assetStyles.input} value={accName} onChangeText={setAccName} placeholder="예) 국민 주거래통장" placeholderTextColor={COLORS.gray400} />
          <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>은행</Text>
          <TextInput style={assetStyles.input} value={accBank} onChangeText={setAccBank} placeholder="예) KB국민" placeholderTextColor={COLORS.gray400} />
          <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>잔액</Text>
          <TextInput style={assetStyles.input} keyboardType="numeric" value={accBalance} onChangeText={v => setAccBalance(fmt(v))} placeholder="0" placeholderTextColor={COLORS.gray400} />
          <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>유형</Text>
          <View style={assetStyles.chipRow}>
            {ACCOUNT_TYPES.map(t => (
              <TouchableOpacity key={t} style={[assetStyles.typeChip, accType === t && assetStyles.typeChipActive, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]} onPress={() => setAccType(t)}>
                <Text style={[assetStyles.typeChipText, accType === t && assetStyles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={assetStyles.formBtnRow}>
            <TouchableOpacity style={[assetStyles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={handleAddAccount} disabled={savingAccount || !accName.trim()}>
              <Text style={assetStyles.confirmBtnText}>{savingAccount ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={assetStyles.cancelBtn} onPress={resetAccountForm}>
              <Text style={assetStyles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideUpModal>

      {/* 카드 추가 모달 */}
      <SlideUpModal visible={showAddCard} onRequestClose={resetCardForm}>
        <View style={assetStyles.modalSheet}>
          <Text style={assetStyles.modalTitle}>카드 추가</Text>
          <Text style={assetStyles.fieldLabel}>카드명</Text>
          <TextInput style={assetStyles.input} value={cardName} onChangeText={setCardName} placeholder="예) 신한카드" placeholderTextColor={COLORS.gray400} />
          <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>카드사</Text>
          <TextInput style={assetStyles.input} value={cardBank} onChangeText={setCardBank} placeholder="예) 신한" placeholderTextColor={COLORS.gray400} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={assetStyles.fieldLabel}>대금 출금일</Text>
              <TextInput style={assetStyles.input} keyboardType="numeric" value={cardDueDay} onChangeText={v => setCardDueDay(v.replace(/[^0-9]/g, ''))} placeholder="예) 15" placeholderTextColor={COLORS.gray400} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={assetStyles.fieldLabel}>청구 시작일</Text>
              <TextInput style={assetStyles.input} keyboardType="numeric" value={cardBillingStartDay} onChangeText={v => setCardBillingStartDay(v.replace(/[^0-9]/g, ''))} placeholder="없음" placeholderTextColor={COLORS.gray400} />
            </View>
          </View>
          {accounts.length > 0 && (
            <>
              <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>연결 계좌</Text>
              <View style={assetStyles.chipRow}>
                <TouchableOpacity
                  style={[assetStyles.typeChip, cardLinkedAccountId === null && assetStyles.typeChipActive, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                  onPress={() => setCardLinkedAccountId(null)}
                >
                  <Text style={[assetStyles.typeChipText, cardLinkedAccountId === null && assetStyles.typeChipTextActive]}>없음</Text>
                </TouchableOpacity>
                {accounts.map(acc => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[assetStyles.typeChip, cardLinkedAccountId === acc.id && assetStyles.typeChipActive, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                    onPress={() => setCardLinkedAccountId(acc.id)}
                  >
                    <Text style={[assetStyles.typeChipText, cardLinkedAccountId === acc.id && assetStyles.typeChipTextActive]}>{acc.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <View style={assetStyles.formBtnRow}>
            <TouchableOpacity style={[assetStyles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={handleAddCard} disabled={savingCard || !cardName.trim()}>
              <Text style={assetStyles.confirmBtnText}>{savingCard ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={assetStyles.cancelBtn} onPress={resetCardForm}>
              <Text style={assetStyles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideUpModal>

      {/* 카드 납부 기록 모달 */}
      <SlideUpModal visible={!!cardPaySheet} onRequestClose={() => setCardPaySheet(null)}>
        <View style={assetStyles.modalSheet}>
          <Text style={assetStyles.modalTitle}>{cardPaySheet?.name} 대금 납부 기록</Text>

          {/* 납부 월 안내 */}
          <Text style={{ fontSize: 12, color: COLORS.gray400, marginBottom: 10, textAlign: 'center' }}>
            최근 3개월 내역을 확인하고 납부 기록할 수 있어요
          </Text>
          {/* 월 칩 선택 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[-2, -1, 0].map(offset => {
              const now = new Date();
              const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
              const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const label = `${d.getMonth() + 1}월분`;
              const active = cardPayMonth === m;
              return (
                <TouchableOpacity key={m}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                    backgroundColor: active ? themeColors.primary : '#f3f4f6',
                    borderWidth: active ? 0 : 1, borderColor: '#e5e7eb' }}
                  onPress={() => { setCardPayMonth(m); loadMonthTotal(m, cardPaySheet?.name); }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : COLORS.gray500 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {cardPayMonthTotal > 0 && (
            <Text style={{ fontSize: 11, color: COLORS.gray400, marginBottom: 6 }}>
              {loadingMonthTotal ? '계산 중...' : `${cardPayMonth.replace('-', '년 ')}월 지출 합계: ${formatCurrency(cardPayMonthTotal)} (참고)`}
            </Text>
          )}

          <Text style={assetStyles.fieldLabel}>납부 금액</Text>
          <TextInput
            style={assetStyles.input}
            keyboardType="numeric"
            value={cardPayAmount}
            onChangeText={v => setCardPayAmount(fmt(v))}
            placeholder="0"
            placeholderTextColor={COLORS.gray400}
            autoFocus
          />
          <Text style={[assetStyles.fieldLabel, { marginTop: 10 }]}>메모 (선택)</Text>
          <TextInput
            style={assetStyles.input}
            value={cardPayMemo}
            onChangeText={setCardPayMemo}
            placeholder="메모"
            placeholderTextColor={COLORS.gray400}
          />
          <View style={assetStyles.formBtnRow}>
            <TouchableOpacity style={[assetStyles.confirmBtn, { backgroundColor: themeColors.primary }]} onPress={handleSaveCardPayment} disabled={cardPaySaving || !cardPayAmount}>
              <Text style={assetStyles.confirmBtnText}>{cardPaySaving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={assetStyles.cancelBtn} onPress={() => setCardPaySheet(null)}>
              <Text style={assetStyles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideUpModal>
    </ScrollView>
  );
}

const TYPES = ['월정액', '연정액', '기타'] as const;

interface FixedSelectOption {
  key: string; label: string; type: 'account' | 'card'; id: string;
}

function FixedSelectField({ label, placeholder, value, onPress, color }: {
  label: string; placeholder: string; value: string | null; onPress: () => void; color: string;
}) {
  return (
    <View>
      <Text style={fixedStyles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={fixedStyles.selectField} onPress={onPress}>
        <Text style={value ? [fixedStyles.selectFieldText, { color }] : fixedStyles.selectFieldPlaceholder}>
          {value ?? placeholder}
        </Text>
        <Text style={fixedStyles.selectFieldChevron}>▾</Text>
      </TouchableOpacity>
    </View>
  );
}

function FixedSelectModal({ visible, title, options, onSelect, onClose }: {
  visible: boolean; title: string; options: FixedSelectOption[];
  onSelect: (o: FixedSelectOption | null) => void; onClose: () => void;
}) {
  return (
    <SlideUpModal visible={visible} onRequestClose={onClose}>
      <View style={fixedStyles.modalSheet}>
        <Text style={fixedStyles.modalTitle}>{title}</Text>
        <ScrollView style={{ maxHeight: 280 }}>
          <TouchableOpacity style={fixedStyles.modalOption} onPress={() => onSelect(null)}>
            <Text style={fixedStyles.modalOptionTextMuted}>선택 안 함</Text>
          </TouchableOpacity>
          {options.map(opt => (
            <TouchableOpacity key={opt.key} style={fixedStyles.modalOption} onPress={() => onSelect(opt)}>
              <Text style={fixedStyles.modalOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SlideUpModal>
  );
}

function FixedCostsPanel({ themeColors }: { themeColors: ReturnType<typeof getThemeColors> }) {
  const [data, setData] = useState<FixedCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 고정지출 폼
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDueDay, setExpenseDueDay] = useState('');
  const [expenseType, setExpenseType] = useState<typeof TYPES[number]>('월정액');
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [linkedCardId, setLinkedCardId] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);

  // 고정저축 폼
  const [showSavingForm, setShowSavingForm] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [savingAmount, setSavingAmount] = useState('');
  const [savingDueDay, setSavingDueDay] = useState('');
  const [savingType, setSavingType] = useState<typeof TYPES[number]>('월정액');
  const [debitAccountId, setDebitAccountId] = useState<string | null>(null);
  const [creditAccountId, setCreditAccountId] = useState<string | null>(null);
  const [savingSaving, setSavingSaving] = useState(false);

  const [activePicker, setActivePicker] = useState<'linked' | 'debit' | 'credit' | 'edit-linked' | 'edit-credit' | null>(null);

  // 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editLinkedAccountId, setEditLinkedAccountId] = useState<string | null>(null);
  const [editLinkedCardId, setEditLinkedCardId] = useState<string | null>(null);
  const [editDebitAccountId, setEditDebitAccountId] = useState<string | null>(null);
  const [editCreditAccountId, setEditCreditAccountId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(item: FixedCost) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(fmt(String(item.amount)));
    setEditDueDay(item.due_day != null ? String(item.due_day) : '');
    setEditLinkedAccountId((item as any).linked_account_id ?? null);
    setEditLinkedCardId((item as any).linked_card_id ?? null);
    setEditDebitAccountId((item as any).linked_account_id ?? null);
    setEditCreditAccountId((item as any).linked_target_account_id ?? null);
  }

  async function handleEditSave() {
    if (!editingId || editSaving) return;
    const amt = parse(editAmount);
    if (!editName.trim() || amt <= 0) return;
    setEditSaving(true);
    try {
      const item = data?.fixedCosts.find(f => f.id === editingId);
      const isTransfer = item?.kind === '고정저축';
      const updates: Record<string, unknown> = {
        name: editName.trim(),
        amount: amt,
        due_day: editDueDay ? parseInt(editDueDay) : null,
      };
      if (isTransfer) {
        updates.linked_account_id = editDebitAccountId ?? null;
        updates.linked_target_account_id = editCreditAccountId ?? null;
        updates.linked_card_id = null;
      } else {
        if (editLinkedCardId) {
          updates.linked_card_id = editLinkedCardId;
          updates.linked_account_id = null;
        } else {
          updates.linked_account_id = editLinkedAccountId ?? null;
          updates.linked_card_id = null;
        }
      }
      await editFixedCost(editingId, updates);
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  const load = useCallback(async () => {
    try {
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) { setError('로그인이 필요해요'); return; }
      setData(await getFixedCostsData(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={[sharedStyles.panel, sharedStyles.center]}><ActivityIndicator color={COLORS.primary} /></View>;
  if (error || !data) return <View style={[sharedStyles.panel, sharedStyles.center]}><Text style={sharedStyles.emptyText}>{error ?? '오류가 발생했어요'}</Text></View>;

  const expenseItems = data.fixedCosts.filter(f => (f.kind ?? '고정지출') === '고정지출');
  const savingItems = data.fixedCosts.filter(f => f.kind === '고정저축');
  const expenseTotal = expenseItems.reduce((s, f) => s + f.amount, 0);
  const savingTotal = savingItems.reduce((s, f) => s + f.amount, 0);
  const grandTotal = expenseTotal + savingTotal;

  const accountOptions: FixedSelectOption[] = data.accounts.map(a => ({ key: `acc-${a.id}`, label: `${a.name} (계좌)`, type: 'account', id: a.id }));
  const linkedOptions: FixedSelectOption[] = [
    ...accountOptions,
    ...data.cards.map(c => ({ key: `card-${c.id}`, label: `${c.name} (카드)`, type: 'card' as const, id: c.id })),
  ];

  function selectedLabel(opts: FixedSelectOption[], id: string | null) { return opts.find(o => o.id === id)?.label ?? null; }

  function resetExpenseForm() {
    setExpenseName(''); setExpenseAmount(''); setExpenseDueDay(''); setExpenseType('월정액');
    setLinkedAccountId(null); setLinkedCardId(null); setShowExpenseForm(false);
  }
  function resetSavingForm() {
    setSavingName(''); setSavingAmount(''); setSavingDueDay(''); setSavingType('월정액');
    setDebitAccountId(null); setCreditAccountId(null); setShowSavingForm(false);
  }

  async function handleAddExpense() {
    const n = expenseName.trim(); const amt = parseInt(expenseAmount) || 0;
    if (!n || amt <= 0 || expenseSaving) return;
    setExpenseSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { Alert.alert('로그인이 필요해요'); return; }
      const { error: err } = await addFixedCost(userId, {
        name: n, amount: amt, due_day: expenseDueDay ? parseInt(expenseDueDay) : null,
        type: expenseType, kind: '고정지출',
        linked_account_id: linkedAccountId, linked_card_id: linkedCardId, linked_target_account_id: null,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetExpenseForm(); await load();
    } finally { setExpenseSaving(false); }
  }

  async function handleAddSaving() {
    const n = savingName.trim(); const amt = parseInt(savingAmount) || 0;
    if (!n || amt <= 0 || savingSaving) return;
    setSavingSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { Alert.alert('로그인이 필요해요'); return; }
      const { error: err } = await addFixedCost(userId, {
        name: n, amount: amt, due_day: savingDueDay ? parseInt(savingDueDay) : null,
        type: savingType, kind: '고정저축',
        linked_account_id: debitAccountId, linked_target_account_id: creditAccountId, linked_card_id: null,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetSavingForm(); await load();
    } finally { setSavingSaving(false); }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert('삭제', `'${name}' 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteFixedCost(id); await load(); } },
    ]);
  }

  return (
    <ScrollView style={sharedStyles.panel} contentContainerStyle={sharedStyles.content} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={[themeColors.primaryLight, '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: themeColors.primaryLight, overflow: 'hidden' }}>
        <Text style={{ fontSize: 12, color: COLORS.gray400, marginBottom: 4 }}>이번 달 고정비 지출</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.primary, marginBottom: 4 }}>월 {formatCurrency(grandTotal)}</Text>
        <Text style={{ fontSize: 12, color: COLORS.gray500 }}>고정지출 {formatCurrency(expenseTotal)} · 고정저축 {formatCurrency(savingTotal)}</Text>
      </LinearGradient>

      {/* 고정 지출 섹션 */}
      <View style={fixedStyles.section}>
        <View style={fixedStyles.sectionHeader}>
          <Text style={fixedStyles.sectionTitle}>고정 지출</Text>
          <TouchableOpacity
            style={[fixedStyles.sectionAddBtn, { backgroundColor: themeColors.primaryLight }]}
            onPress={() => { setShowExpenseForm(v => !v); resetSavingForm(); }}
          >
            <Text style={[fixedStyles.sectionAddBtnText, { color: themeColors.primary }]}>﹢추가</Text>
          </TouchableOpacity>
        </View>

        {expenseItems.length === 0 ? (
          <Text style={fixedStyles.emptyText}>등록된 고정 지출이 없어요</Text>
        ) : (
          expenseItems.map((item, i) => (
            <View key={item.id}>
              <View style={[fixedStyles.itemRow, i === 0 && { borderTopWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={fixedStyles.itemName}>{item.name}</Text>
                  <Text style={fixedStyles.itemMeta}>{item.due_day != null ? `매월 ${item.due_day}일` : '-'}</Text>
                </View>
                <Text style={[fixedStyles.itemAmount, { color: themeColors.accent }]}>{formatCurrency(item.amount)}</Text>
                <TouchableOpacity style={fixedStyles.editBtn} onPress={() => editingId === item.id ? setEditingId(null) : openEdit(item)}>
                  <Text style={[fixedStyles.editBtnText, { color: themeColors.primary }]}>{editingId === item.id ? '닫기' : '수정'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={fixedStyles.deleteBtn} onPress={() => confirmDelete(item.id, item.name)}>
                  <Text style={fixedStyles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
              {editingId === item.id && (
                <View style={fixedStyles.addForm}>
                  <Text style={fixedStyles.fieldLabel}>항목 이름</Text>
                  <TextInput style={fixedStyles.input} placeholder="항목 이름" placeholderTextColor={COLORS.gray400} value={editName} onChangeText={setEditName} />
                  <View style={fixedStyles.inputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={fixedStyles.fieldLabel}>금액</Text>
                      <TextInput style={fixedStyles.input} placeholder="금액" keyboardType="numeric" placeholderTextColor={COLORS.gray400} value={editAmount} onChangeText={v => setEditAmount(fmt(v))} />
                    </View>
                    <View style={{ width: 100 }}>
                      <Text style={fixedStyles.fieldLabel}>출금일</Text>
                      <TextInput style={[fixedStyles.input, { width: 100 }]} placeholder="출금일" keyboardType="numeric" placeholderTextColor={COLORS.gray400} value={editDueDay} onChangeText={v => setEditDueDay(v.replace(/[^0-9]/g, ''))} />
                    </View>
                  </View>
                  <FixedSelectField label="연결 계좌/카드" placeholder="선택 안 함"
                    value={editLinkedCardId ? selectedLabel(linkedOptions, editLinkedCardId) : editLinkedAccountId ? selectedLabel(accountOptions, editLinkedAccountId) : null}
                    onPress={() => setActivePicker('edit-linked')} color={themeColors.accent} />
                  <View style={fixedStyles.formBtnRow}>
                    <TouchableOpacity style={fixedStyles.cancelBtn} onPress={() => setEditingId(null)}>
                      <Text style={fixedStyles.cancelBtnText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[fixedStyles.confirmBtn, { backgroundColor: themeColors.primary }, (!editName.trim() || !editAmount || editSaving) && { opacity: 0.5 }]} onPress={handleEditSave} disabled={!editName.trim() || !editAmount || editSaving}>
                      <Text style={fixedStyles.confirmBtnText}>{editSaving ? '저장 중...' : '수정 저장'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        {expenseItems.length > 0 && (
          <View style={fixedStyles.subtotalRow}>
            <Text style={fixedStyles.subtotalLabel}>소계</Text>
            <Text style={[fixedStyles.subtotalValue, { color: themeColors.accent }]}>{formatCurrency(expenseTotal)}</Text>
          </View>
        )}

        {showExpenseForm && (
          <View style={fixedStyles.addForm}>
            <TextInput style={fixedStyles.input} placeholder="항목 이름" placeholderTextColor={COLORS.gray400}
              value={expenseName} onChangeText={setExpenseName} />
            <View style={fixedStyles.inputRow}>
              <TextInput style={[fixedStyles.input, { flex: 1 }]} placeholder="금액" keyboardType="numeric"
                placeholderTextColor={COLORS.gray400} value={expenseAmount}
                onChangeText={v => setExpenseAmount(v.replace(/[^0-9]/g, ''))} />
              <TextInput style={[fixedStyles.input, { width: 100 }]} placeholder="빠져나가는 날" keyboardType="numeric"
                placeholderTextColor={COLORS.gray400} value={expenseDueDay}
                onChangeText={v => setExpenseDueDay(v.replace(/[^0-9]/g, ''))} />
            </View>
            <View style={fixedStyles.typeRow}>
              {TYPES.map(t => (
                <TouchableOpacity key={t}
                  style={[fixedStyles.typeChip, expenseType === t && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                  onPress={() => setExpenseType(t)}>
                  <Text style={[fixedStyles.typeChipText, expenseType === t && fixedStyles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FixedSelectField label="연결 계좌/카드" placeholder="선택 안 함"
              value={linkedAccountId ? selectedLabel(accountOptions, linkedAccountId) : linkedCardId ? selectedLabel(linkedOptions, linkedCardId) : null}
              onPress={() => setActivePicker('linked')} color={themeColors.accent} />
            <View style={fixedStyles.formBtnRow}>
              <TouchableOpacity style={fixedStyles.cancelBtn} onPress={resetExpenseForm}>
                <Text style={fixedStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fixedStyles.confirmBtn, { backgroundColor: themeColors.primary }, (!expenseName.trim() || !expenseAmount || expenseSaving) && { opacity: 0.5 }]}
                onPress={handleAddExpense} disabled={!expenseName.trim() || !expenseAmount || expenseSaving}>
                <Text style={fixedStyles.confirmBtnText}>{expenseSaving ? '추가 중...' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 고정 저축 섹션 */}
      <View style={[fixedStyles.section, { marginTop: 12 }]}>
        <View style={fixedStyles.sectionHeader}>
          <Text style={fixedStyles.sectionTitle}>고정 저축</Text>
          <TouchableOpacity style={fixedStyles.sectionAddBtnGreen} onPress={() => { setShowSavingForm(v => !v); resetExpenseForm(); }}>
            <Text style={fixedStyles.sectionAddBtnTextGreen}>﹢추가</Text>
          </TouchableOpacity>
        </View>

        {savingItems.length === 0 ? (
          <Text style={fixedStyles.emptyText}>등록된 고정 저축이 없어요</Text>
        ) : (
          savingItems.map((item, i) => (
            <View key={item.id}>
              <View style={[fixedStyles.itemRow, i === 0 && { borderTopWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={fixedStyles.itemName}>{item.name}</Text>
                  <Text style={fixedStyles.itemMeta}>{item.due_day != null ? `매월 ${item.due_day}일` : '-'}</Text>
                </View>
                <Text style={fixedStyles.itemAmountGreen}>{formatCurrency(item.amount)}</Text>
                <TouchableOpacity style={fixedStyles.editBtn} onPress={() => editingId === item.id ? setEditingId(null) : openEdit(item)}>
                  <Text style={[fixedStyles.editBtnText, { color: COLORS.green }]}>{editingId === item.id ? '닫기' : '수정'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={fixedStyles.deleteBtn} onPress={() => confirmDelete(item.id, item.name)}>
                  <Text style={fixedStyles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
              {editingId === item.id && (
                <View style={fixedStyles.addForm}>
                  <TextInput style={fixedStyles.input} placeholder="항목 이름" placeholderTextColor={COLORS.gray400} value={editName} onChangeText={setEditName} />
                  <View style={fixedStyles.inputRow}>
                    <TextInput style={[fixedStyles.input, { flex: 1 }]} placeholder="금액" keyboardType="numeric" placeholderTextColor={COLORS.gray400} value={editAmount} onChangeText={v => setEditAmount(fmt(v))} />
                    <TextInput style={[fixedStyles.input, { width: 100 }]} placeholder="이체일" keyboardType="numeric" placeholderTextColor={COLORS.gray400} value={editDueDay} onChangeText={v => setEditDueDay(v.replace(/[^0-9]/g, ''))} />
                  </View>
                  <FixedSelectField label="출금 계좌" placeholder="선택 안 함"
                    value={editDebitAccountId ? selectedLabel(accountOptions, editDebitAccountId) : null}
                    onPress={() => setActivePicker('edit-debit')} color={themeColors.accent} />
                  <FixedSelectField label="입금 계좌" placeholder="선택 안 함"
                    value={editCreditAccountId ? selectedLabel(accountOptions, editCreditAccountId) : null}
                    onPress={() => setActivePicker('edit-credit')} color={COLORS.green} />
                  <View style={fixedStyles.formBtnRow}>
                    <TouchableOpacity style={fixedStyles.cancelBtn} onPress={() => setEditingId(null)}>
                      <Text style={fixedStyles.cancelBtnText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[fixedStyles.confirmBtn, { backgroundColor: COLORS.green }, (!editName.trim() || !editAmount || editSaving) && { opacity: 0.5 }]} onPress={handleEditSave} disabled={!editName.trim() || !editAmount || editSaving}>
                      <Text style={fixedStyles.confirmBtnText}>{editSaving ? '저장 중...' : '수정 저장'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        {savingItems.length > 0 && (
          <View style={fixedStyles.subtotalRow}>
            <Text style={fixedStyles.subtotalLabel}>소계</Text>
            <Text style={fixedStyles.subtotalValueGreen}>{formatCurrency(savingTotal)}</Text>
          </View>
        )}

        {showSavingForm && (
          <View style={fixedStyles.addForm}>
            <TextInput style={fixedStyles.input} placeholder="항목 이름" placeholderTextColor={COLORS.gray400}
              value={savingName} onChangeText={setSavingName} />
            <View style={fixedStyles.inputRow}>
              <TextInput style={[fixedStyles.input, { flex: 1 }]} placeholder="금액" keyboardType="numeric"
                placeholderTextColor={COLORS.gray400} value={savingAmount}
                onChangeText={v => setSavingAmount(v.replace(/[^0-9]/g, ''))} />
              <TextInput style={[fixedStyles.input, { width: 100 }]} placeholder="빠져나가는 날" keyboardType="numeric"
                placeholderTextColor={COLORS.gray400} value={savingDueDay}
                onChangeText={v => setSavingDueDay(v.replace(/[^0-9]/g, ''))} />
            </View>
            <View style={fixedStyles.typeRow}>
              {TYPES.map(t => (
                <TouchableOpacity key={t}
                  style={[fixedStyles.typeChip, savingType === t && { backgroundColor: COLORS.green, borderColor: COLORS.green }]}
                  onPress={() => setSavingType(t)}>
                  <Text style={[fixedStyles.typeChipText, savingType === t && fixedStyles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FixedSelectField label="출금 계좌 (돈이 나가는 곳)" placeholder="선택 안 함"
              value={selectedLabel(accountOptions, debitAccountId)} onPress={() => setActivePicker('debit')} color={COLORS.green} />
            <FixedSelectField label="입금 계좌 (적금 계좌)" placeholder="선택 안 함"
              value={selectedLabel(accountOptions, creditAccountId)} onPress={() => setActivePicker('credit')} color={COLORS.green} />
            <View style={fixedStyles.formBtnRow}>
              <TouchableOpacity style={fixedStyles.cancelBtn} onPress={resetSavingForm}>
                <Text style={fixedStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fixedStyles.confirmBtnGreen, (!savingName.trim() || !savingAmount || savingSaving) && { opacity: 0.5 }]}
                onPress={handleAddSaving} disabled={!savingName.trim() || !savingAmount || savingSaving}>
                <Text style={fixedStyles.confirmBtnText}>{savingSaving ? '추가 중...' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <FixedSelectModal visible={activePicker === 'linked'} title="연결 계좌/카드" options={linkedOptions}
        onSelect={opt => { setLinkedAccountId(opt?.type === 'account' ? opt.id : null); setLinkedCardId(opt?.type === 'card' ? opt.id : null); setActivePicker(null); }}
        onClose={() => setActivePicker(null)} />
      <FixedSelectModal visible={activePicker === 'debit'} title="출금 계좌" options={accountOptions}
        onSelect={opt => { setDebitAccountId(opt?.id ?? null); setActivePicker(null); }} onClose={() => setActivePicker(null)} />
      <FixedSelectModal visible={activePicker === 'credit'} title="입금 계좌 (적금 계좌)" options={accountOptions}
        onSelect={opt => { setCreditAccountId(opt?.id ?? null); setActivePicker(null); }} onClose={() => setActivePicker(null)} />
      <FixedSelectModal visible={activePicker === 'edit-linked'} title="연결 계좌/카드" options={linkedOptions}
        onSelect={opt => { setEditLinkedAccountId(opt?.type === 'account' ? opt.id : null); setEditLinkedCardId(opt?.type === 'card' ? opt.id : null); setActivePicker(null); }}
        onClose={() => setActivePicker(null)} />
      <FixedSelectModal visible={activePicker === 'edit-debit'} title="출금 계좌" options={accountOptions}
        onSelect={opt => { setEditDebitAccountId(opt?.id ?? null); setActivePicker(null); }} onClose={() => setActivePicker(null)} />
      <FixedSelectModal visible={activePicker === 'edit-credit'} title="입금 계좌" options={accountOptions}
        onSelect={opt => { setEditCreditAccountId(opt?.id ?? null); setActivePicker(null); }} onClose={() => setActivePicker(null)} />
    </ScrollView>
  );
}

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
  // 알려진 카테고리는 preset.dist 비율, 미지정 카테고리는 BASE_RATIO 부여 후 전체 정규화
  const BASE_RATIO = 0.1;
  const rawRatios: Record<string, number> = Object.fromEntries(
    spendCats.map(cat => [cat, cat in preset.dist ? (preset.dist[cat] ?? 0) : BASE_RATIO])
  );
  const totalRatio = Object.values(rawRatios).reduce((s, r) => s + r, 0);
  return Object.fromEntries(
    spendCats.map(cat => [cat, totalRatio > 0 ? Math.round(spendBudget * rawRatios[cat] / totalRatio) : 0])
  );
}

function BudgetPanel({ themeColors }: { themeColors: ReturnType<typeof getThemeColors> }) {
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
      const budgetCats = new Set(result.budgets.map(b => b.category));
      const hasBudgets = result.budgets.length > 0;
      setEnabledCats(Object.fromEntries(result.customCategories.map(c => [c, hasBudgets ? budgetCats.has(c) : true])));
      setAmounts(Object.fromEntries(result.customCategories.map(c => [c, String(budgetMap[c] ?? '')])));
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[sharedStyles.panel, sharedStyles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[sharedStyles.panel, sharedStyles.center]}>
        <Text style={sharedStyles.emptyText}>{error ?? '데이터를 불러오지 못했어요'}</Text>
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
      await saveBudgets(userId, monthString(), categories, planEnabled, planAmountStrings);
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
    <ScrollView style={sharedStyles.panel} contentContainerStyle={sharedStyles.content} keyboardShouldPersistTaps="handled">
      <Text style={budgetStyles.pageSubtitle}>{monthString().replace('-', '년 ')}월 카테고리별 목표 예산</Text>

      {/* 탭 */}
      <View style={budgetStyles.tabBar}>
        {(['manual', 'ai'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[budgetStyles.tabBtn, tab === t && { backgroundColor: themeColors.primary }]}
            onPress={() => setTab(t)}
          >
            <Text style={[budgetStyles.tabBtnText, tab === t && budgetStyles.tabBtnTextActive]}>
              {t === 'manual' ? '직접 설정' : 'AI 추천'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'ai' && (
        <View style={budgetStyles.card}>
          <Text style={budgetStyles.aiBasisText}>월 수입 {formatCurrency(income)} 기준으로 추천해요</Text>
          <View style={budgetStyles.presetRow}>
            {PRESETS.map(preset => {
              const selected = selectedPreset === preset.key;
              const targetSave = Math.round(income * preset.savingRate);
              const spendBudget = income - targetSave;
              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[budgetStyles.presetCard, selected && { borderColor: themeColors.primary, backgroundColor: themeColors.primaryLight }]}
                  onPress={() => handleSelectPreset(preset.key)}
                >
                  <Text style={[budgetStyles.presetLabel, { color: themeColors.primary }]}>{preset.label}</Text>
                  <Text style={budgetStyles.presetDesc}>{preset.desc}</Text>
                  <Text style={budgetStyles.presetBudget}>{formatCurrency(spendBudget)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={budgetStyles.aiRecommendBtn} onPress={handleAiRecommend} disabled={aiLoading}>
            {aiLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={budgetStyles.aiRecommendBtnText}>✨ 내 소비 패턴으로 AI 추천받기</Text>
            )}
          </TouchableOpacity>

          {selectedPreset && !aiAmounts && (() => {
            const preset = PRESETS.find(p => p.key === selectedPreset);
            if (!preset) return null;
            const targetSave = Math.round(income * preset.savingRate);
            const addSave = Math.max(0, targetSave - (data?.fixedSavings ?? 0));
            return (
              <View style={budgetStyles.savingAnalysisBox}>
                <Text style={budgetStyles.savingAnalysisTitle}>💰 저축 플랜</Text>
                <View style={budgetStyles.savingAnalysisRow}>
                  <Text style={budgetStyles.savingAnalysisLabel}>목표 저축</Text>
                  <Text style={[budgetStyles.savingAnalysisValue, { color: COLORS.green }]}>{formatCurrency(targetSave)}</Text>
                </View>
                {(data?.fixedSavings ?? 0) > 0 && (
                  <View style={budgetStyles.savingAnalysisRow}>
                    <Text style={budgetStyles.savingAnalysisLabel}>고정저축 (확보됨)</Text>
                    <Text style={budgetStyles.savingAnalysisMuted}>{formatCurrency(data!.fixedSavings)}</Text>
                  </View>
                )}
                <View style={[budgetStyles.savingAnalysisRow, budgetStyles.savingAnalysisDivider]}>
                  <Text style={budgetStyles.savingAnalysisLabel}>추가 저축 필요</Text>
                  <Text style={[budgetStyles.savingAnalysisValue, { color: COLORS.green, fontWeight: '800' }]}>{formatCurrency(addSave)}</Text>
                </View>
              </View>
            );
          })()}

          {selectedPreset && !aiAmounts && (() => {
            const preset = PRESETS.find(p => p.key === selectedPreset);
            if (!preset) return null;
            const activeCats = categories.filter(c => c !== '수입' && enabledCats[c]);
            const plan = presetAmounts(income, activeCats, preset);
            if (activeCats.length === 0) return null;
            return (
              <View style={budgetStyles.aiResultBox}>
                <Text style={budgetStyles.savingAnalysisTitle}>📊 지출 예산 배분</Text>
                {activeCats.map(cat => (
                  <View key={cat} style={budgetStyles.aiResultRow}>
                    <Text style={[budgetStyles.aiResultLabel, { color: themeColors.accent }]}>{cat}</Text>
                    <Text style={budgetStyles.aiResultValue}>{formatCurrency(plan[cat] ?? 0)}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {aiAmounts && (
            <View style={budgetStyles.aiResultBox}>
              {aiReason && <Text style={budgetStyles.aiReasonText}>{aiReason}</Text>}
              {categories.filter(c => c !== '수입').map(cat => (
                <View key={cat} style={budgetStyles.aiResultRow}>
                  <Text style={[budgetStyles.aiResultLabel, { color: themeColors.accent }]}>{cat}</Text>
                  <Text style={budgetStyles.aiResultValue}>{formatCurrency(aiAmounts[cat] ?? 0)}</Text>
                </View>
              ))}
            </View>
          )}

          {aiAmounts ? (
            <TouchableOpacity style={[budgetStyles.saveBtn, { backgroundColor: themeColors.primary }]} onPress={() => handleSavePlan(aiAmounts)} disabled={savingAiPlan}>
              <Text style={budgetStyles.saveBtnText}>{savingAiPlan ? '저장 중...' : '이 플랜으로 저장하기'}</Text>
            </TouchableOpacity>
          ) : selectedPreset ? (
            <TouchableOpacity
              style={[budgetStyles.saveBtn, { backgroundColor: themeColors.primary }]}
              onPress={() => handleSavePlan(presetAmounts(income, categories, PRESETS.find(p => p.key === selectedPreset)!))}
              disabled={savingAiPlan}
            >
              <Text style={budgetStyles.saveBtnText}>{savingAiPlan ? '저장 중...' : '이 플랜으로 저장하기'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {tab === 'manual' && (
        <>
          {totalBudget > 0 && (
            <View style={budgetStyles.card}>
              <View style={budgetStyles.progressHeaderRow}>
                <Text style={budgetStyles.progressHeaderLabel}>전체 사용률</Text>
                <Text style={[
                  budgetStyles.progressHeaderPct,
                  { color: overallPct > 100 ? COLORS.red : overallPct >= 80 ? COLORS.amber : '#059669' },
                ]}>{overallPct}%</Text>
              </View>
              <View style={budgetStyles.progressBg}>
                <View style={[
                  budgetStyles.progressFill,
                  {
                    width: `${Math.min(overallPct, 100)}%`,
                    backgroundColor: overallPct > 100 ? COLORS.red : overallPct >= 80 ? COLORS.amber : themeColors.primary,
                  },
                ]} />
              </View>
              <View style={budgetStyles.progressFooterRow}>
                <Text style={budgetStyles.progressFooterText}>지출 {formatCurrency(totalSpent)}</Text>
                <Text style={budgetStyles.progressFooterText}>예산 {formatCurrency(totalBudget)}</Text>
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
                <View key={cat} style={[budgetStyles.budgetItem, !enabled && { opacity: 0.45 }]}>
                  <View style={budgetStyles.budgetItemRow}>
                    <Text style={[budgetStyles.budgetItemLabel, { color: themeColors.accent }]}>{cat}</Text>
                    <View style={budgetStyles.budgetInputBox}>
                      <TextInput
                        style={budgetStyles.budgetInput}
                        keyboardType="numeric"
                        editable={enabled}
                        placeholder="0"
                        placeholderTextColor={COLORS.gray400}
                        value={amounts[cat] ? Number(amounts[cat]).toLocaleString() : ''}
                        onChangeText={v => handleChange(cat, v)}
                      />
                      <Text style={budgetStyles.budgetInputUnit}>원</Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={() => setEnabledCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                      trackColor={{ false: COLORS.gray300, true: themeColors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  {budget > 0 && (
                    <View style={budgetStyles.budgetProgressWrap}>
                      <View style={budgetStyles.progressBgSmall}>
                        <View style={[
                          budgetStyles.progressFill,
                          {
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: over ? COLORS.red : pct >= 80 ? COLORS.amber : themeColors.primary,
                          },
                        ]} />
                      </View>
                      <View style={budgetStyles.budgetProgressFooter}>
                        <Text style={[budgetStyles.budgetProgressText, over && { color: COLORS.red, fontWeight: '600' }]}>
                          {spent > 0 ? `${formatCurrency(spent)} 사용` : '아직 지출 없음'}
                        </Text>
                        <Text style={budgetStyles.budgetProgressText}>{pct}%{over ? ' 초과!' : ''}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={[budgetStyles.saveBtn, { marginTop: 20, backgroundColor: themeColors.primary }]} onPress={handleSave} disabled={saving}>
            <Text style={budgetStyles.saveBtnText}>{saving ? '저장 중...' : '저장하기'}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const sharedStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  panel: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 16 },

  headerWrap: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: COLORS.bg },
  pageTitle: { fontSize: 22, fontWeight: '700', color: COLORS.accent, marginBottom: 12 },
  subTabBar: { flexDirection: 'row', backgroundColor: '#F0EAEC', borderRadius: RADIUS.lg, padding: 4, gap: 4 },
  subTabBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  subTabBtnActive: { backgroundColor: COLORS.primary },
  subTabBtnText: { fontSize: 13, fontWeight: '600', color: '#B8A8AC' },
  subTabBtnTextActive: { color: '#fff' },
});

const assetStyles = StyleSheet.create({
  // 초기 설정 가이드 배너
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  setupBannerEmoji: { fontSize: 20 },
  setupBannerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  setupBannerDesc: { fontSize: 11, color: COLORS.gray500, lineHeight: 16 },
  setupBannerBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  setupBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 16 },

  toast: {
    backgroundColor: COLORS.greenBg,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 10,
  },
  toastText: { fontSize: 13, color: COLORS.green, fontWeight: '600', textAlign: 'center' },
  routineDoneText: { fontSize: 13, color: COLORS.green, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  overdueBadge: { fontSize: 11, color: COLORS.red, fontWeight: '600' },
  recordBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  cardStatusBadge: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  section: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionSummary: { fontSize: 12, color: COLORS.gray500 },
  sectionChevron: { fontSize: 14, color: COLORS.gray400 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },

  incomeValue: { fontSize: 24, fontWeight: '800', color: COLORS.accent, marginBottom: 8 },
  incomeSubtext: { fontSize: 12, color: COLORS.gray500 },
  editLink: { fontSize: 12, color: COLORS.primary },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6',
    borderRadius: RADIUS.lg, paddingVertical: 18, paddingHorizontal: 16,
    marginBottom: 10,
  },
  linkRowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  linkRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkRowValue: { fontSize: 13, color: COLORS.gray400 },
  chevronRight: { fontSize: 16, color: COLORS.gray400 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray50,
  },
  rowTitle: { fontSize: 13, fontWeight: '600', color: COLORS.gray800 },
  rowSubtitle: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowAmount: { fontSize: 13, fontWeight: '700', color: COLORS.gray700 },
  rowAmountAccent: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  rowAmountGreen: { fontSize: 13, fontWeight: '700', color: COLORS.green },

  editBtn: { backgroundColor: COLORS.gray100, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  editBtnText: { fontSize: 11, color: COLORS.gray500, fontWeight: '600' },
  inlineEditForm: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.gray100 },
  deleteBtn: { backgroundColor: COLORS.redBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deleteBtnText: { fontSize: 11, color: COLORS.red },

  addBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  fullAddBtn: {
    flex: 1, marginTop: 0, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight, alignItems: 'center',
  },
  fullAddBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cashAddBtn: { backgroundColor: COLORS.greenBg },
  cashAddBtnText: { fontSize: 12, fontWeight: '600', color: '#059669' },

  fixedSubHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fixedSubHeader: { fontSize: 12, fontWeight: '700', color: COLORS.gray700 },
  fixedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.gray50,
  },
  subtotalText: { fontSize: 12, color: COLORS.gray500, marginTop: 6, fontWeight: '600' },
  subtotalTextGreen: { fontSize: 12, color: '#059669', marginTop: 6, fontWeight: '600' },
  fixedDivider: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },

  // 폼 공통
  fieldLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.gray800,
    backgroundColor: '#fafafa',
  },
  formBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.gray100, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fafafa',
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 12, color: COLORS.gray500 },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },

  cashForm: { marginTop: 8, padding: 14, borderRadius: RADIUS.lg, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  cashFormTitle: { fontSize: 12, fontWeight: '700', color: '#065f46', marginBottom: 10 },
  cashAddConfirmBtn: { paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  cashAddConfirmBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 14 },
});

const fixedStyles = StyleSheet.create({
  pageSubtitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray500, marginBottom: 16 },

  section: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.gray100, padding: 16, ...CARD_SHADOW,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  sectionAddBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  sectionAddBtnText: { fontSize: 12, fontWeight: '700' },
  sectionAddBtnGreen: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f0fdf4' },
  sectionAddBtnTextGreen: { fontSize: 12, fontWeight: '700', color: '#059669' },

  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 12 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.gray50,
  },
  itemName: { fontSize: 13, fontWeight: '600', color: COLORS.gray800 },
  itemMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 1 },
  itemAmount: { fontSize: 13, fontWeight: '700' },
  itemAmountGreen: { fontSize: 13, fontWeight: '700', color: COLORS.green },
  deleteBtn: { backgroundColor: COLORS.redBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  deleteBtnText: { fontSize: 11, color: COLORS.red },
  editBtn: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  editBtnText: { fontSize: 11, fontWeight: '600' },

  subtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.gray100,
  },
  subtotalLabel: { fontSize: 12, fontWeight: '600', color: COLORS.gray400 },
  subtotalValue: { fontSize: 14, fontWeight: '800' },
  subtotalValueGreen: { fontSize: 14, fontWeight: '800', color: COLORS.green },

  addForm: { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.gray50, paddingTop: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.gray800,
    backgroundColor: '#fafafa',
  },
  inputRow: { flexDirection: 'row', gap: 8 },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fafafa',
  },
  typeChipText: { fontSize: 12, color: COLORS.gray500 },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  formBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.gray100, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  confirmBtnGreen: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.green, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  fieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray500, marginBottom: 4 },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa',
  },
  selectFieldText: { fontSize: 13, fontWeight: '600' },
  selectFieldPlaceholder: { fontSize: 13, color: COLORS.gray400 },
  selectFieldChevron: { fontSize: 12, color: COLORS.gray400 },

  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: 16 },
  modalTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800, marginBottom: 8 },
  modalOption: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.gray50 },
  modalOptionText: { fontSize: 13, color: COLORS.gray800 },
  modalOptionTextMuted: { fontSize: 13, color: COLORS.gray400 },
});

const budgetStyles = StyleSheet.create({
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

  savingAnalysisBox: { marginTop: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  savingAnalysisTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray800, marginBottom: 8 },
  savingAnalysisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  savingAnalysisLabel: { fontSize: 12, color: COLORS.gray500 },
  savingAnalysisValue: { fontSize: 12, fontWeight: '700', color: COLORS.gray800 },
  savingAnalysisMuted: { fontSize: 12, color: COLORS.gray400 },
  savingAnalysisDivider: { borderTopWidth: 1, borderTopColor: 'rgba(16,185,129,0.2)', marginTop: 4, paddingTop: 6 },
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
