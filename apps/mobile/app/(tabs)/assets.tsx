import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import SlideUpModal from '@/components/SlideUpModal';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, getThemeColors, useThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { monthString } from '@/lib/date';
import { getAssetsData, addAccount, deleteAccount, addCard, deleteCard, updateIncome, type AssetsData } from '@/lib/api/assets';
import { getFixedCostsData, addFixedCost, deleteFixedCost, type FixedCostsData } from '@/lib/api/fixed-costs';
import { getBudgetData, saveBudgets, recommendBudget, type BudgetData } from '@/lib/api/budget';
import { getPaidIds, recordFixedCostPayment, recordCardPayment } from '@/lib/api/routine';
import type { Card as CardType, FixedCost } from '@spenlog/types';

const ACCOUNT_TYPES = ['입출금', '파킹', 'CMA', '현금'] as const;

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
  const { themeColors } = useThemeColors();
  const { colors } = useAppTheme();

  return (
    <View style={[sharedStyles.screen, { backgroundColor: colors.bg }]}>
      <View style={sharedStyles.headerWrap}>
        <Text style={sharedStyles.pageTitle}>자산</Text>
        <View style={sharedStyles.subTabBar}>
          {([
            { key: 'assets', label: '자산' },
            { key: 'budget', label: '예산' },
            { key: 'fixed', label: '고정비' },
          ] as { key: SubTab; label: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[sharedStyles.subTabBtn, subTab === t.key && { backgroundColor: themeColors.primary }]}
              onPress={() => setSubTab(t.key)}
            >
              <Text style={[sharedStyles.subTabBtnText, subTab === t.key && sharedStyles.subTabBtnTextActive]}>{t.label}</Text>
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

  // 월 수입 수정
  const [editingIncome, setEditingIncome] = useState(false);
  const [income, setIncome] = useState('');
  const [savingGoal, setSavingGoal] = useState('');
  const [savingIncome, setSavingIncome] = useState(false);

  // 루틴 관리
  const [routineExpanded, setRoutineExpanded] = useState(true);
  const [paidFixedCostIds, setPaidFixedCostIds] = useState<Set<string>>(new Set());
  const [paidCardIds, setPaidCardIds] = useState<Set<string>>(new Set());
  const [processingFixedId, setProcessingFixedId] = useState<string | null>(null);
  const [routineToast, setRoutineToast] = useState('');

  // 카드 납부 기록 모달
  const [cardPaySheet, setCardPaySheet] = useState<CardType | null>(null);
  const [cardPayAmount, setCardPayAmount] = useState('');
  const [cardPayMemo, setCardPayMemo] = useState('');
  const [cardPaySaving, setCardPaySaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) {
        setError('로그인이 필요해요');
        return;
      }
      setUserId(uid);
      const result = await getAssetsData(uid);
      setData(result);
      setIncome(result.profile?.income ? Number(result.profile.income).toLocaleString() : '');
      setSavingGoal(result.profile?.saving_goal ? Number(result.profile.saving_goal).toLocaleString() : '');

      const { fixedCostIds, cardIds } = await getPaidIds(uid, monthString());
      setPaidFixedCostIds(fixedCostIds);
      setPaidCardIds(cardIds);
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
    setCardPayAmount('');
    setCardPayMemo('');
  }

  async function handleSaveCardPayment() {
    if (!userId || !cardPaySheet || cardPaySaving) return;
    const amount = parse(cardPayAmount);
    if (amount <= 0) { Alert.alert('금액을 입력해주세요'); return; }
    setCardPaySaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await recordCardPayment(userId, cardPaySheet, monthString(), amount, today, cardPayMemo.trim() || null);
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
    const todayDay = new Date().getDate();
    const diff = card.due_day - todayDay;
    if (diff === 0) return { label: '오늘 납부일 ⚠️', color: COLORS.amber };
    if (diff < 0) return { label: '지연 ⚠️', color: COLORS.red };
    return { label: `D-${diff}`, color: COLORS.gray400 };
  }

  const routineTotal = fixedCosts.length + cards.length;
  const routineDone = fixedCosts.filter(fc => paidFixedCostIds.has(fc.id)).length
    + cards.filter(c => paidCardIds.has(c.id)).length;

  return (
    <ScrollView style={sharedStyles.panel} contentContainerStyle={sharedStyles.content} keyboardShouldPersistTaps="handled">
      {/* 0. 이번 달 처리 현황 */}
      <View style={assetStyles.section}>
        <TouchableOpacity style={assetStyles.sectionHeader} onPress={() => setRoutineExpanded(o => !o)} activeOpacity={0.7}>
          <Text style={assetStyles.sectionTitle}>이번 달 처리 현황</Text>
          <View style={assetStyles.sectionHeaderRight}>
            <Text style={assetStyles.sectionSummary}>{routineDone}/{routineTotal} 완료</Text>
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
            {routineTotal === 0 ? (
              <Text style={assetStyles.emptyText}>등록된 고정비/카드가 없어요</Text>
            ) : (
              <>
                {fixedCosts.map(fc => {
                  const paid = paidFixedCostIds.has(fc.id);
                  return (
                    <View key={fc.id} style={assetStyles.routineRow}>
                      <View>
                        <Text style={assetStyles.rowTitle}>{fc.name}</Text>
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
                {cards.map(card => {
                  const paid = paidCardIds.has(card.id);
                  const status = getCardPayStatus(card);
                  return (
                    <View key={card.id} style={assetStyles.routineRow}>
                      <View>
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
              </>
            )}
          </View>
        )}
      </View>

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
          <View key={acc.id} style={assetStyles.row}>
            <View>
              <Text style={assetStyles.rowTitle}>{acc.name}</Text>
              <Text style={assetStyles.rowSubtitle}>{acc.bank} · {acc.type}</Text>
            </View>
            <View style={assetStyles.rowRight}>
              <Text style={[assetStyles.rowAmountAccent, { color: themeColors.accent }]}>{formatCurrency(acc.balance)}</Text>
              <TouchableOpacity style={assetStyles.deleteBtn} onPress={() => confirmDeleteAccount(acc.id, acc.name)}>
                <Text style={assetStyles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </View>
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
            <View key={card.id} style={assetStyles.row}>
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
                <TouchableOpacity style={[assetStyles.recordBtn, { backgroundColor: themeColors.primary }]} onPress={() => openCardPaySheet(card)}>
                  <Text style={assetStyles.recordBtnText}>납부 기록</Text>
                </TouchableOpacity>
                <TouchableOpacity style={assetStyles.deleteBtn} onPress={() => confirmDeleteCard(card.id, card.name)}>
                  <Text style={assetStyles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
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

function FixedCostsPanel({ themeColors }: { themeColors: ReturnType<typeof getThemeColors> }) {
  const [data, setData] = useState<FixedCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 고정 지출 폼
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDueDay, setExpDueDay] = useState('');
  const [expAccountId, setExpAccountId] = useState<string | null>(null);
  const [expCardId, setExpCardId] = useState<string | null>(null);
  const [savingExp, setSavingExp] = useState(false);

  // 고정 저축 폼
  const [showSavingForm, setShowSavingForm] = useState(false);
  const [savName, setSavName] = useState('');
  const [savAmount, setSavAmount] = useState('');
  const [savDueDay, setSavDueDay] = useState('');
  const [savDebitAccId, setSavDebitAccId] = useState<string | null>(null);
  const [savCreditAccId, setSavCreditAccId] = useState<string | null>(null);
  const [savingSav, setSavingSav] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const uid = await getCurrentUserId();
      if (!uid) { setError('로그인이 필요해요'); return; }
      setUserId(uid);
      setData(await getFixedCostsData(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <View style={[sharedStyles.panel, sharedStyles.center]}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );

  if (error || !data) return (
    <View style={[sharedStyles.panel, sharedStyles.center]}>
      <Text style={sharedStyles.emptyText}>{error ?? '데이터를 불러오지 못했어요'}</Text>
    </View>
  );

  const fixedCosts = data.fixedCosts;
  const allAccounts = data.accounts.filter(a => a.type !== '현금');
  const cards = data.cards;
  const expenseItems = fixedCosts.filter(f => f.kind === '고정지출');
  const savingItems = fixedCosts.filter(f => f.kind === '고정저축');
  const expenseTotal = expenseItems.reduce((s, f) => s + f.amount, 0);
  const savingTotal = savingItems.reduce((s, f) => s + f.amount, 0);

  function resetExpenseForm() {
    setExpName(''); setExpAmount(''); setExpDueDay('');
    setExpAccountId(null); setExpCardId(null);
    setShowExpenseForm(false);
  }

  function resetSavingForm() {
    setSavName(''); setSavAmount(''); setSavDueDay('');
    setSavDebitAccId(null); setSavCreditAccId(null);
    setShowSavingForm(false);
  }

  async function handleAddExpense() {
    const trimmed = expName.trim();
    const parsed = parseInt(expAmount) || 0;
    if (!trimmed || parsed <= 0 || savingExp || !userId) return;
    setSavingExp(true);
    try {
      const { error: err } = await addFixedCost(userId, {
        name: trimmed, amount: parsed,
        due_day: expDueDay ? parseInt(expDueDay) : null,
        type: '월정액', kind: '고정지출',
        linked_account_id: expAccountId,
        linked_card_id: expCardId,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetExpenseForm();
      await load();
    } finally {
      setSavingExp(false);
    }
  }

  async function handleAddSaving() {
    const trimmed = savName.trim();
    const parsed = parseInt(savAmount) || 0;
    if (!trimmed || parsed <= 0 || savingSav || !userId) return;
    setSavingSav(true);
    try {
      const { error: err } = await addFixedCost(userId, {
        name: trimmed, amount: parsed,
        due_day: savDueDay ? parseInt(savDueDay) : null,
        type: '월정액', kind: '고정저축',
        linked_account_id: savDebitAccId,
        linked_target_account_id: savCreditAccId,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetSavingForm();
      await load();
    } finally {
      setSavingSav(false);
    }
  }

  function confirmDelete(id: string, itemName: string) {
    Alert.alert('삭제', `'${itemName}' 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteFixedCost(id); await load(); } },
    ]);
  }

  const expenseLinkedItems = [...allAccounts, ...cards];

  return (
    <ScrollView style={sharedStyles.panel} contentContainerStyle={sharedStyles.content} keyboardShouldPersistTaps="handled">
      {/* 헤더 합계 */}
      <View style={fixedStyles.headerRow}>
        <Text style={fixedStyles.pageTitle}>고정비</Text>
        <Text style={fixedStyles.headerSummary}>월 {formatCurrency(expenseTotal + savingTotal)} 지출 ▲</Text>
      </View>

      {/* 고정 지출 섹션 */}
      <View style={fixedStyles.sectionBlock}>
        <View style={fixedStyles.sectionHeaderRow}>
          <Text style={fixedStyles.sectionTitle}>고정 지출</Text>
          {!showExpenseForm && (
            <TouchableOpacity
              style={[fixedStyles.addInlineBtn, { borderColor: themeColors.primary }]}
              onPress={() => setShowExpenseForm(true)}
            >
              <Text style={[fixedStyles.addInlineBtnText, { color: themeColors.primary }]}>+ 추가</Text>
            </TouchableOpacity>
          )}
        </View>

        {expenseItems.length === 0 && !showExpenseForm && (
          <Text style={fixedStyles.emptyText}>고정 지출이 없어요</Text>
        )}
        {expenseItems.map((item, i) => (
          <View key={item.id} style={[fixedStyles.itemRow, i === 0 && { borderTopWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={fixedStyles.itemName}>{item.name}</Text>
              {item.due_day ? <Text style={fixedStyles.itemMeta}>매월 {item.due_day}일</Text> : null}
            </View>
            <View style={fixedStyles.itemRight}>
              <Text style={[fixedStyles.itemAmount, { color: themeColors.accent }]}>{formatCurrency(item.amount)}</Text>
              <TouchableOpacity style={fixedStyles.deleteBtn} onPress={() => confirmDelete(item.id, item.name)}>
                <Text style={fixedStyles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <Text style={fixedStyles.subtotalText}>소계 {formatCurrency(expenseTotal)}</Text>

        {showExpenseForm && (
          <View style={fixedStyles.addForm}>
            <Text style={fixedStyles.fieldLabel}>이름</Text>
            <TextInput
              style={fixedStyles.input}
              placeholder="예) 넷플릭스"
              placeholderTextColor={COLORS.gray400}
              value={expName}
              onChangeText={setExpName}
            />
            <Text style={[fixedStyles.fieldLabel, { marginTop: 10 }]}>금액</Text>
            <TextInput
              style={fixedStyles.input}
              placeholder="0"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
              value={expAmount}
              onChangeText={v => setExpAmount(v.replace(/[^0-9]/g, ''))}
            />
            <Text style={[fixedStyles.fieldLabel, { marginTop: 10 }]}>빠져나가는 날</Text>
            <TextInput
              style={fixedStyles.input}
              placeholder="예) 25"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
              value={expDueDay}
              onChangeText={v => setExpDueDay(v.replace(/[^0-9]/g, ''))}
            />
            {expenseLinkedItems.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={fixedStyles.fieldLabel}>연결 계좌/카드</Text>
                <View style={fixedStyles.chipScrollRow}>
                  <TouchableOpacity
                    style={[fixedStyles.selectChip, (expAccountId === null && expCardId === null) && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                    onPress={() => { setExpAccountId(null); setExpCardId(null); }}
                  >
                    <Text style={[fixedStyles.selectChipText, (expAccountId === null && expCardId === null) && { color: '#fff' }]}>선택</Text>
                  </TouchableOpacity>
                  {allAccounts.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[fixedStyles.selectChip, expAccountId === acc.id && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                      onPress={() => { setExpAccountId(acc.id); setExpCardId(null); }}
                    >
                      <Text style={[fixedStyles.selectChipText, expAccountId === acc.id && { color: '#fff' }]}>{acc.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {cards.map(card => (
                    <TouchableOpacity
                      key={card.id}
                      style={[fixedStyles.selectChip, expCardId === card.id && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                      onPress={() => { setExpCardId(card.id); setExpAccountId(null); }}
                    >
                      <Text style={[fixedStyles.selectChipText, expCardId === card.id && { color: '#fff' }]}>{card.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={fixedStyles.formBtnRow}>
              <TouchableOpacity
                style={[fixedStyles.confirmBtn, { backgroundColor: themeColors.primary }, (!expName.trim() || !expAmount || savingExp) && { opacity: 0.5 }]}
                onPress={handleAddExpense}
                disabled={!expName.trim() || !expAmount || savingExp}
              >
                <Text style={fixedStyles.confirmBtnText}>{savingExp ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={fixedStyles.cancelBtn} onPress={resetExpenseForm}>
                <Text style={fixedStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 고정 저축 섹션 */}
      <View style={fixedStyles.sectionBlock}>
        <View style={fixedStyles.sectionHeaderRow}>
          <Text style={fixedStyles.sectionTitle}>고정 저축</Text>
          {!showSavingForm && (
            <TouchableOpacity
              style={[fixedStyles.addInlineBtn, { borderColor: COLORS.green }]}
              onPress={() => setShowSavingForm(true)}
            >
              <Text style={[fixedStyles.addInlineBtnText, { color: COLORS.green }]}>+ 추가</Text>
            </TouchableOpacity>
          )}
        </View>

        {savingItems.length === 0 && !showSavingForm && (
          <Text style={fixedStyles.emptyText}>고정 저축이 없어요</Text>
        )}
        {savingItems.map((item, i) => (
          <View key={item.id} style={[fixedStyles.itemRow, i === 0 && { borderTopWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={fixedStyles.itemName}>{item.name}</Text>
              {item.due_day ? <Text style={fixedStyles.itemMeta}>매월 {item.due_day}일</Text> : null}
            </View>
            <View style={fixedStyles.itemRight}>
              <Text style={fixedStyles.itemAmountGreen}>{formatCurrency(item.amount)}</Text>
              <TouchableOpacity style={fixedStyles.deleteBtn} onPress={() => confirmDelete(item.id, item.name)}>
                <Text style={fixedStyles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <Text style={fixedStyles.subtotalTextGreen}>소계 {formatCurrency(savingTotal)}</Text>

        {showSavingForm && (
          <View style={fixedStyles.addForm}>
            <Text style={fixedStyles.fieldLabel}>이름</Text>
            <TextInput
              style={fixedStyles.input}
              placeholder="예) 서울 적금"
              placeholderTextColor={COLORS.gray400}
              value={savName}
              onChangeText={setSavName}
            />
            <Text style={[fixedStyles.fieldLabel, { marginTop: 10 }]}>금액</Text>
            <TextInput
              style={fixedStyles.input}
              placeholder="0"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
              value={savAmount}
              onChangeText={v => setSavAmount(v.replace(/[^0-9]/g, ''))}
            />
            <Text style={[fixedStyles.fieldLabel, { marginTop: 10 }]}>빠져나가는 날</Text>
            <TextInput
              style={fixedStyles.input}
              placeholder="예) 5"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
              value={savDueDay}
              onChangeText={v => setSavDueDay(v.replace(/[^0-9]/g, ''))}
            />
            {allAccounts.length > 0 && (
              <>
                <View style={{ marginTop: 10 }}>
                  <Text style={fixedStyles.fieldLabel}>출금 계좌 (돈이 나가는 곳)</Text>
                  <View style={fixedStyles.chipScrollRow}>
                    <TouchableOpacity
                      style={[fixedStyles.selectChip, savDebitAccId === null && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                      onPress={() => setSavDebitAccId(null)}
                    >
                      <Text style={[fixedStyles.selectChipText, savDebitAccId === null && { color: '#fff' }]}>선택</Text>
                    </TouchableOpacity>
                    {allAccounts.map(acc => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[fixedStyles.selectChip, savDebitAccId === acc.id && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                        onPress={() => setSavDebitAccId(acc.id)}
                      >
                        <Text style={[fixedStyles.selectChipText, savDebitAccId === acc.id && { color: '#fff' }]}>{acc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Text style={fixedStyles.fieldLabel}>입금 계좌 (적금 계좌)</Text>
                  <View style={fixedStyles.chipScrollRow}>
                    <TouchableOpacity
                      style={[fixedStyles.selectChip, savCreditAccId === null && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                      onPress={() => setSavCreditAccId(null)}
                    >
                      <Text style={[fixedStyles.selectChipText, savCreditAccId === null && { color: '#fff' }]}>선택</Text>
                    </TouchableOpacity>
                    {allAccounts.map(acc => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[fixedStyles.selectChip, savCreditAccId === acc.id && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                        onPress={() => setSavCreditAccId(acc.id)}
                      >
                        <Text style={[fixedStyles.selectChipText, savCreditAccId === acc.id && { color: '#fff' }]}>{acc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}
            <View style={fixedStyles.formBtnRow}>
              <TouchableOpacity
                style={[fixedStyles.confirmBtn, { backgroundColor: themeColors.primary }, (!savName.trim() || !savAmount || savingSav) && { opacity: 0.5 }]}
                onPress={handleAddSaving}
                disabled={!savName.trim() || !savAmount || savingSav}
              >
                <Text style={fixedStyles.confirmBtnText}>{savingSav ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={fixedStyles.cancelBtn} onPress={resetSavingForm}>
                <Text style={fixedStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const fixedStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pageTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800 },
  headerSummary: { fontSize: 12, color: COLORS.gray400 },

  sectionBlock: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100,
    padding: 16, marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray700 },
  addInlineBtn: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4,
  },
  addInlineBtnText: { fontSize: 12, fontWeight: '600' },

  emptyText: { fontSize: 12, color: COLORS.gray400, paddingVertical: 8 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.gray50,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  itemMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  itemAmountGreen: { fontSize: 14, fontWeight: '700', color: COLORS.green },
  deleteBtn: { backgroundColor: COLORS.redBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deleteBtnText: { fontSize: 11, color: COLORS.red },

  subtotalText: { fontSize: 12, color: COLORS.gray400, marginTop: 8, fontWeight: '600' },
  subtotalTextGreen: { fontSize: 12, color: COLORS.green, marginTop: 8, fontWeight: '600' },

  addForm: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.gray50, paddingTop: 14 },
  fieldLabel: { fontSize: 11, color: COLORS.gray500, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.gray800,
    backgroundColor: '#fafafa',
  },
  chipScrollRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  selectChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fafafa',
  },
  selectChipText: { fontSize: 12, color: COLORS.gray500 },

  formBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  confirmBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.gray100, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
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
