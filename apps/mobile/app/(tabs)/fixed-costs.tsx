import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import SlideUpModal from '@/components/SlideUpModal';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, useThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getFixedCostsData, addFixedCost, editFixedCost, deleteFixedCost, type FixedCostsData } from '@/lib/api/fixed-costs';
import { getPaidIds, recordFixedCostPayment } from '@/lib/api/routine';
import { monthString } from '@/lib/date';

const TYPES = ['월정액', '연정액', '기타'] as const;

interface SelectOption {
  key: string;
  label: string;
  type: 'account' | 'card';
  id: string;
}

function SelectField({
  label, placeholder, value, onPress, color,
}: {
  label: string; placeholder: string; value: string | null; onPress: () => void; color: string;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectField} onPress={onPress}>
        <Text style={value ? [styles.selectFieldText, { color }] : styles.selectFieldPlaceholder}>
          {value ?? placeholder}
        </Text>
        <Text style={styles.selectFieldChevron}>▾</Text>
      </TouchableOpacity>
    </View>
  );
}

function SelectModal({
  visible, title, options, onSelect, onClose,
}: {
  visible: boolean; title: string; options: SelectOption[];
  onSelect: (option: SelectOption | null) => void; onClose: () => void;
}) {
  return (
    <SlideUpModal visible={visible} onRequestClose={onClose}>
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>{title}</Text>
        <ScrollView style={{ maxHeight: 280 }}>
          <TouchableOpacity style={styles.modalOption} onPress={() => onSelect(null)}>
            <Text style={styles.modalOptionTextMuted}>선택 안 함</Text>
          </TouchableOpacity>
          {options.map(opt => (
            <TouchableOpacity key={opt.key} style={styles.modalOption} onPress={() => onSelect(opt)}>
              <Text style={styles.modalOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SlideUpModal>
  );
}

export default function FixedCostsScreen() {
  const { themeColors } = useThemeColors();
  const { colors } = useAppTheme();

  const [data, setData] = useState<FixedCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 고정지출 폼 상태
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDueDay, setExpenseDueDay] = useState('');
  const [expenseType, setExpenseType] = useState<typeof TYPES[number]>('월정액');
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [linkedCardId, setLinkedCardId] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);

  // 고정저축 폼 상태
  const [showSavingForm, setShowSavingForm] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [savingAmount, setSavingAmount] = useState('');
  const [savingDueDay, setSavingDueDay] = useState('');
  const [savingType, setSavingType] = useState<typeof TYPES[number]>('월정액');
  const [debitAccountId, setDebitAccountId] = useState<string | null>(null);
  const [creditAccountId, setCreditAccountId] = useState<string | null>(null);
  const [savingSaving, setSavingSaving] = useState(false);

  // 계좌/카드 선택 모달
  const [activePicker, setActivePicker] = useState<'linked' | 'debit' | 'credit' | 'edit-linked' | 'edit-debit' | 'edit-credit' | null>(null);

  // 루틴 기록 상태
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const [routineToast, setRoutineToast] = useState('');

  // 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editLinkedAccountId, setEditLinkedAccountId] = useState<string | null>(null);
  const [editLinkedCardId, setEditLinkedCardId] = useState<string | null>(null);
  const [editDebitAccountId, setEditDebitAccountId] = useState<string | null>(null);
  const [editCreditAccountId, setEditCreditAccountId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) { setError('로그인이 필요해요'); return; }
      const [fcData, { fixedCostIds }] = await Promise.all([
        getFixedCostsData(userId),
        getPaidIds(userId, monthString()),
      ]);
      setData(fcData);
      setPaidIds(fixedCostIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={[styles.screen, styles.center]}><ActivityIndicator color={COLORS.primary} /></View>;
  }
  if (error || !data) {
    return <View style={[styles.screen, styles.center]}><Text style={styles.emptyText}>{error ?? '데이터를 불러오지 못했어요'}</Text></View>;
  }

  const fixedCosts = data.fixedCosts;
  const expenseItems = fixedCosts.filter(f => (f.kind ?? '고정지출') === '고정지출');
  const savingItems = fixedCosts.filter(f => f.kind === '고정저축');
  const expenseTotal = expenseItems.reduce((s, f) => s + f.amount, 0);
  const savingTotal = savingItems.reduce((s, f) => s + f.amount, 0);
  const grandTotal = expenseTotal + savingTotal;

  const accountOptions: SelectOption[] = data.accounts.map(acc => ({
    key: `account-${acc.id}`, label: `${acc.name} (계좌)`, type: 'account' as const, id: acc.id,
  }));
  const linkedOptions: SelectOption[] = [
    ...accountOptions,
    ...data.cards.map(card => ({ key: `card-${card.id}`, label: `${card.name} (카드)`, type: 'card' as const, id: card.id })),
  ];

  function selectedLabel(options: SelectOption[], id: string | null) {
    return options.find(o => o.id === id)?.label ?? null;
  }

  function resetExpenseForm() {
    setExpenseName(''); setExpenseAmount(''); setExpenseDueDay(''); setExpenseType('월정액');
    setLinkedAccountId(null); setLinkedCardId(null); setShowExpenseForm(false);
  }
  function resetSavingForm() {
    setSavingName(''); setSavingAmount(''); setSavingDueDay(''); setSavingType('월정액');
    setDebitAccountId(null); setCreditAccountId(null); setShowSavingForm(false);
  }

  async function handleAddExpense() {
    const trimmedName = expenseName.trim();
    const parsedAmount = parseInt(expenseAmount) || 0;
    if (!trimmedName || parsedAmount <= 0 || expenseSaving) return;
    setExpenseSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { Alert.alert('로그인이 필요해요'); return; }
      const { error: err } = await addFixedCost(userId, {
        name: trimmedName, amount: parsedAmount,
        due_day: expenseDueDay ? parseInt(expenseDueDay) : null,
        type: expenseType, kind: '고정지출',
        linked_account_id: linkedAccountId,
        linked_card_id: linkedCardId,
        linked_target_account_id: null,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetExpenseForm();
      await load();
    } finally {
      setExpenseSaving(false);
    }
  }

  async function handleAddSaving() {
    const trimmedName = savingName.trim();
    const parsedAmount = parseInt(savingAmount) || 0;
    if (!trimmedName || parsedAmount <= 0 || savingSaving) return;
    setSavingSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { Alert.alert('로그인이 필요해요'); return; }
      const { error: err } = await addFixedCost(userId, {
        name: trimmedName, amount: parsedAmount,
        due_day: savingDueDay ? parseInt(savingDueDay) : null,
        type: savingType, kind: '고정저축',
        linked_account_id: debitAccountId,
        linked_target_account_id: creditAccountId,
        linked_card_id: null,
      });
      if (err) { Alert.alert('추가 실패', err.message); return; }
      resetSavingForm();
      await load();
    } finally {
      setSavingSaving(false);
    }
  }

  function confirmDelete(id: string, itemName: string) {
    Alert.alert('삭제', `'${itemName}' 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteFixedCost(id); await load(); } },
    ]);
  }

  async function handleRecord(item: FixedCostsData['fixedCosts'][number]) {
    const userId = await getCurrentUserId();
    if (!userId || processing) return;
    setProcessing(item.id);
    try {
      await recordFixedCostPayment(userId, item, monthString());
      setPaidIds(prev => new Set(prev).add(item.id));
      setRoutineToast(`${item.name} 기록 완료 ✓`);
      setTimeout(() => setRoutineToast(''), 2000);
    } finally {
      setProcessing(null);
    }
  }

  function startEdit(item: FixedCostsData['fixedCosts'][number]) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(String(item.amount));
    setEditDueDay(item.due_day != null ? String(item.due_day) : '');
    setEditLinkedAccountId(item.linked_account_id ?? null);
    setEditLinkedCardId(item.linked_card_id ?? null);
    setEditDebitAccountId(item.linked_account_id ?? null);
    setEditCreditAccountId(item.linked_target_account_id ?? null);
  }

  async function handleSaveEdit() {
    if (!editingId || editSaving) return;
    const parsedAmt = parseInt(editAmount) || 0;
    if (!editName.trim() || parsedAmt <= 0) return;
    const item = fixedCosts.find(f => f.id === editingId);
    const isGreen = item?.kind === '고정저축';
    setEditSaving(true);
    try {
      await editFixedCost(editingId, {
        name: editName.trim(),
        amount: parsedAmt,
        due_day: editDueDay ? parseInt(editDueDay) : null,
        ...(isGreen ? {
          linked_account_id: editDebitAccountId,
          linked_target_account_id: editCreditAccountId,
          linked_card_id: null,
        } : {
          linked_account_id: editLinkedAccountId,
          linked_card_id: editLinkedCardId,
          linked_target_account_id: null,
        }),
      });
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  const today = new Date().getDate();

  const renderItem = (item: FixedCostsData['fixedCosts'][number], isGreen: boolean, i: number) => {
    const paid = paidIds.has(item.id);
    const overdue = item.due_day != null && today > item.due_day && !paid;

    if (editingId === item.id) {
      return (
        <View key={item.id} style={[styles.itemRow, i === 0 && { borderTopWidth: 0 }, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <TextInput style={styles.input} value={editName} onChangeText={setEditName}
            placeholder="항목 이름" placeholderTextColor={COLORS.gray400} />
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={editAmount}
              onChangeText={v => setEditAmount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric" placeholder="금액" placeholderTextColor={COLORS.gray400} />
            <TextInput style={[styles.input, { width: 90 }]} value={editDueDay}
              onChangeText={v => setEditDueDay(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric" placeholder="납부일" placeholderTextColor={COLORS.gray400} />
          </View>
          {isGreen ? (
            <>
              <SelectField
                label="출금 계좌 (돈이 나가는 곳)"
                placeholder="선택 안 함"
                value={selectedLabel(accountOptions, editDebitAccountId)}
                onPress={() => setActivePicker('edit-debit')}
                color={COLORS.green}
              />
              <SelectField
                label="입금 계좌 (적금 계좌)"
                placeholder="선택 안 함"
                value={selectedLabel(accountOptions, editCreditAccountId)}
                onPress={() => setActivePicker('edit-credit')}
                color={COLORS.green}
              />
            </>
          ) : (
            <SelectField
              label="연결 계좌/카드"
              placeholder="선택 안 함"
              value={editLinkedAccountId ? selectedLabel(accountOptions, editLinkedAccountId)
                : editLinkedCardId ? selectedLabel(linkedOptions, editLinkedCardId) : null}
              onPress={() => setActivePicker('edit-linked')}
              color={themeColors.accent}
            />
          )}
          <View style={styles.formBtnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: isGreen ? COLORS.green : themeColors.primary }, editSaving && { opacity: 0.5 }]}
              onPress={handleSaveEdit} disabled={editSaving}
            >
              <Text style={styles.confirmBtnText}>{editSaving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View key={item.id} style={[styles.itemRow, i === 0 && { borderTopWidth: 0 }]}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>
            {item.due_day != null ? `매월 ${item.due_day}일` : '-'}
            {overdue ? '  ⚠️ 출금일 지남' : ''}
          </Text>
        </View>
        <Text style={isGreen ? styles.itemAmountGreen : [styles.itemAmount, { color: themeColors.accent }]}>
          {formatCurrency(item.amount)}
        </Text>
        <View style={styles.itemActions}>
          {paid ? (
            <Text style={styles.paidBadge}>✓</Text>
          ) : (
            <TouchableOpacity
              style={[styles.recordBtn, { backgroundColor: isGreen ? COLORS.green : themeColors.primary }]}
              onPress={() => handleRecord(item)} disabled={processing === item.id}
            >
              <Text style={styles.recordBtnText}>{processing === item.id ? '...' : '기록'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
            <Text style={[styles.editBtnText, { color: isGreen ? COLORS.green : themeColors.primary }]}>수정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item.id, item.name)}>
            <Text style={styles.deleteBtnText}>삭제</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
        {!!routineToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{routineToast}</Text>
          </View>
        )}

        <ScrollView
          style={[styles.screen, { backgroundColor: colors.bg }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.pageTitle, { color: themeColors.accent }]}>고정비</Text>
          <Text style={styles.pageSubtitle}>월 {formatCurrency(grandTotal)} 지출 ▲</Text>

          {fixedCosts.length > 0 && (() => {
            const pending = fixedCosts.filter(f => !paidIds.has(f.id));
            if (pending.length === 0) return (
              <View style={[styles.routineBanner, styles.routineBannerDone]}>
                <Text style={styles.routineBannerDoneText}>🎉 이번 달 모두 기록 완료!</Text>
              </View>
            );
            return (
              <View style={styles.routineBanner}>
                <Text style={styles.routineBannerText}>
                  📋 이번 달 미처리 {pending.length}건 · {formatCurrency(pending.reduce((s, f) => s + f.amount, 0))}
                </Text>
              </View>
            );
          })()}

          {/* 고정 지출 섹션 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>고정 지출</Text>
              <TouchableOpacity
                style={[styles.sectionAddBtn, { backgroundColor: themeColors.primaryLight }]}
                onPress={() => { setShowExpenseForm(v => !v); resetSavingForm(); }}
              >
                <Text style={[styles.sectionAddBtnText, { color: themeColors.primary }]}>︋추가</Text>
              </TouchableOpacity>
            </View>

            {expenseItems.length === 0 ? (
              <Text style={styles.emptyText}>등록된 고정 지출이 없어요</Text>
            ) : (
              expenseItems.map((item, i) => renderItem(item, false, i))
            )}

            {expenseItems.length > 0 && (
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>소계</Text>
                <Text style={[styles.subtotalValue, { color: themeColors.accent }]}>{formatCurrency(expenseTotal)}</Text>
              </View>
            )}

            {showExpenseForm && (
              <View style={styles.addForm}>
                <TextInput style={styles.input} placeholder="항목 이름"
                  placeholderTextColor={COLORS.gray400} value={expenseName} onChangeText={setExpenseName} />
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="금액"
                    placeholderTextColor={COLORS.gray400} keyboardType="numeric"
                    value={expenseAmount} onChangeText={v => setExpenseAmount(v.replace(/[^0-9]/g, ''))} />
                  <TextInput style={[styles.input, { width: 100 }]} placeholder="빠져나가는 날"
                    placeholderTextColor={COLORS.gray400} keyboardType="numeric"
                    value={expenseDueDay} onChangeText={v => setExpenseDueDay(v.replace(/[^0-9]/g, ''))} />
                </View>
                <View style={styles.typeRow}>
                  {TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, expenseType === t && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                      onPress={() => setExpenseType(t)}
                    >
                      <Text style={[styles.typeChipText, expenseType === t && styles.typeChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <SelectField
                  label="연결 계좌/카드"
                  placeholder="선택 안 함"
                  value={linkedAccountId ? selectedLabel(accountOptions, linkedAccountId)
                    : linkedCardId ? selectedLabel(linkedOptions, linkedCardId) : null}
                  onPress={() => setActivePicker('linked')}
                  color={themeColors.accent}
                />
                <View style={styles.formBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={resetExpenseForm}>
                    <Text style={styles.cancelBtnText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: themeColors.primary },
                      (!expenseName.trim() || !expenseAmount || expenseSaving) && { opacity: 0.5 }]}
                    onPress={handleAddExpense} disabled={!expenseName.trim() || !expenseAmount || expenseSaving}
                  >
                    <Text style={styles.confirmBtnText}>{expenseSaving ? '추가 중...' : '저장'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 고정 저축 섹션 */}
          <View style={[styles.section, { marginTop: 12 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>고정 저축</Text>
              <TouchableOpacity
                style={styles.sectionAddBtnGreen}
                onPress={() => { setShowSavingForm(v => !v); resetExpenseForm(); }}
              >
                <Text style={styles.sectionAddBtnTextGreen}>︋추가</Text>
              </TouchableOpacity>
            </View>

            {savingItems.length === 0 ? (
              <Text style={styles.emptyText}>등록된 고정 저축이 없어요</Text>
            ) : (
              savingItems.map((item, i) => renderItem(item, true, i))
            )}

            {savingItems.length > 0 && (
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>소계</Text>
                <Text style={styles.subtotalValueGreen}>{formatCurrency(savingTotal)}</Text>
              </View>
            )}

            {showSavingForm && (
              <View style={styles.addForm}>
                <TextInput style={styles.input} placeholder="항목 이름"
                  placeholderTextColor={COLORS.gray400} value={savingName} onChangeText={setSavingName} />
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="금액"
                    placeholderTextColor={COLORS.gray400} keyboardType="numeric"
                    value={savingAmount} onChangeText={v => setSavingAmount(v.replace(/[^0-9]/g, ''))} />
                  <TextInput style={[styles.input, { width: 100 }]} placeholder="빠져나가는 날"
                    placeholderTextColor={COLORS.gray400} keyboardType="numeric"
                    value={savingDueDay} onChangeText={v => setSavingDueDay(v.replace(/[^0-9]/g, ''))} />
                </View>
                <View style={styles.typeRow}>
                  {TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, savingType === t && { backgroundColor: COLORS.green, borderColor: COLORS.green }]}
                      onPress={() => setSavingType(t)}
                    >
                      <Text style={[styles.typeChipText, savingType === t && styles.typeChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <SelectField
                  label="출금 계좌 (돈이 나가는 곣)"
                  placeholder="선택 안 함"
                  value={selectedLabel(accountOptions, debitAccountId)}
                  onPress={() => setActivePicker('debit')}
                  color={COLORS.green}
                />
                <SelectField
                  label="입금 계좌 (적금 계좌)"
                  placeholder="선택 안 함"
                  value={selectedLabel(accountOptions, creditAccountId)}
                  onPress={() => setActivePicker('credit')}
                  color={COLORS.green}
                />
                <View style={styles.formBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={resetSavingForm}>
                    <Text style={styles.cancelBtnText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtnGreen,
                      (!savingName.trim() || !savingAmount || savingSaving) && { opacity: 0.5 }]}
                    onPress={handleAddSaving} disabled={!savingName.trim() || !savingAmount || savingSaving}
                  >
                    <Text style={styles.confirmBtnText}>{savingSaving ? '추가 중...' : '저장'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <SelectModal
            visible={activePicker === 'linked'}
            title="연결 계좌/카드"
            options={linkedOptions}
            onSelect={opt => {
              setLinkedAccountId(opt?.type === 'account' ? opt.id : null);
              setLinkedCardId(opt?.type === 'card' ? opt.id : null);
              setActivePicker(null);
            }}
            onClose={() => setActivePicker(null)}
          />
          <SelectModal
            visible={activePicker === 'debit'}
            title="출금 계좌"
            options={accountOptions}
            onSelect={opt => { setDebitAccountId(opt?.id ?? null); setActivePicker(null); }}
            onClose={() => setActivePicker(null)}
          />
          <SelectModal
            visible={activePicker === 'credit'}
            title="입금 계좌 (적금 계좌)"
            options={accountOptions}
            onSelect={opt => { setCreditAccountId(opt?.id ?? null); setActivePicker(null); }}
            onClose={() => setActivePicker(null)}
          />
          <SelectModal
            visible={activePicker === 'edit-linked'}
            title="연결 계좌/카드"
            options={linkedOptions}
            onSelect={opt => {
              setEditLinkedAccountId(opt?.type === 'account' ? opt.id : null);
              setEditLinkedCardId(opt?.type === 'card' ? opt.id : null);
              setActivePicker(null);
            }}
            onClose={() => setActivePicker(null)}
          />
          <SelectModal
            visible={activePicker === 'edit-debit'}
            title="출금 계좌"
            options={accountOptions}
            onSelect={opt => { setEditDebitAccountId(opt?.id ?? null); setActivePicker(null); }}
            onClose={() => setActivePicker(null)}
          />
          <SelectModal
            visible={activePicker === 'edit-credit'}
            title="입금 계좌 (적금 계좌)"
            options={accountOptions}
            onSelect={opt => { setEditCreditAccountId(opt?.id ?? null); setActivePicker(null); }}
            onClose={() => setActivePicker(null)}
          />
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },

  pageTitle: { fontSize: 18, fontWeight: '600', marginBottom: 2 },
  pageSubtitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray500, marginBottom: 16 },

  routineBanner: {
    backgroundColor: '#fef3f0', borderRadius: RADIUS.md, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#fde0d5',
  },
  routineBannerDone: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  routineBannerText: { fontSize: 13, fontWeight: '700', color: '#c2410c' },
  routineBannerDoneText: { fontSize: 13, fontWeight: '700', color: '#059669' },

  toast: {
    position: 'absolute' as const, top: 60, left: 20, right: 20, zIndex: 100,
    backgroundColor: '#10B981', borderRadius: RADIUS.md,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  toastText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  section: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.gray100, padding: 16, ...CARD_SHADOW,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  sectionAddBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  sectionAddBtnText: { fontSize: 12, fontWeight: '700' },
  sectionAddBtnGreen: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f0fdf4' },
  sectionAddBtnTextGreen: { fontSize: 12, fontWeight: '700', color: '#059669' },

  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 12 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.gray50,
  },
  itemName: { fontSize: 13, fontWeight: '600', color: COLORS.gray800 },
  itemMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 1 },
  itemAmount: { fontSize: 13, fontWeight: '700', marginHorizontal: 8 },
  itemAmountGreen: { fontSize: 13, fontWeight: '700', color: COLORS.green, marginHorizontal: 8 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recordBtn: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  recordBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  paidBadge: { fontSize: 12, fontWeight: '700', color: COLORS.green, paddingHorizontal: 4 },
  editBtn: { backgroundColor: '#f5f5f5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  editBtnText: { fontSize: 11 },
  deleteBtn: { backgroundColor: COLORS.redBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  deleteBtnText: { fontSize: 11, color: COLORS.red },

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
