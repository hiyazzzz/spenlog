import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import SlideUpModal from '@/components/SlideUpModal';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, useThemeColors, useAppTheme } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getFixedCostsData, addFixedCost, editFixedCost, deleteFixedCost, type FixedCostsData } from '@/lib/api/fixed-costs';
import { getPaidIds, recordFixedCostPayment } from '@/lib/api/routine';
import { monthString } from '@/lib/date';

const KINDS = ['고정지출', '고정저축'] as const;
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
  const [kind, setKind] = useState<typeof KINDS[number]>('고정지출');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [type, setType] = useState<typeof TYPES[number]>('월정액');
  const [data, setData] = useState<FixedCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 고정지출: 연결 계좌/카드
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [linkedCardId, setLinkedCardId] = useState<string | null>(null);
  // 고정저축: 출금 계좌 / 입금(적금) 계좌
  const [debitAccountId, setDebitAccountId] = useState<string | null>(null);
  const [creditAccountId, setCreditAccountId] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<'linked' | 'debit' | 'credit' | null>(null);

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

  const load = useCallback(async () => {
    try {
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) {
        setError('로그인이 필요해요');
        return;
      }
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

  const fixedCosts = data.fixedCosts;
  const expenseItems = fixedCosts.filter(f => f.kind === '고정지출');
  const savingItems = fixedCosts.filter(f => f.kind === '고정저축');
  const expenseTotal = expenseItems.reduce((s, f) => s + f.amount, 0);
  const savingTotal = savingItems.reduce((s, f) => s + f.amount, 0);

  const items = kind === '고정지출' ? expenseItems : savingItems;

  function resetForm() {
    setName('');
    setAmount('');
    setDueDay('');
    setType('월정액');
    setLinkedAccountId(null);
    setLinkedCardId(null);
    setDebitAccountId(null);
    setCreditAccountId(null);
    setShowAddForm(false);
  }

  async function handleAdd() {
    const trimmedName = name.trim();
    const parsedAmount = parseInt(amount) || 0;
    if (!trimmedName || parsedAmount <= 0 || saving) return;
    setSaving(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert('로그인이 필요해요');
        return;
      }
      const { error: err } = await addFixedCost(userId, {
        name: trimmedName,
        amount: parsedAmount,
        due_day: dueDay ? parseInt(dueDay) : null,
        type,
        kind,
        linked_account_id: kind === '고정지출' ? linkedAccountId : debitAccountId,
        linked_target_account_id: kind === '고정저축' ? creditAccountId : null,
        linked_card_id: kind === '고정지출' ? linkedCardId : null,
      });
      if (err) {
        Alert.alert('추가 실패', err.message);
        return;
      }
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  const accountOptions: SelectOption[] = data.accounts.map(acc => ({
    key: `account-${acc.id}`, label: `${acc.name} (계좌)`, type: 'account' as const, id: acc.id,
  }));
  const linkedOptions: SelectOption[] = [
    ...accountOptions,
    ...data.cards.map(card => ({ key: `card-${card.id}`, label: `${card.name} (카드)`, type: 'card' as const, id: card.id })),
  ];

  function handleLinkedSelect(opt: SelectOption | null) {
    setLinkedAccountId(opt?.type === 'account' ? opt.id : null);
    setLinkedCardId(opt?.type === 'card' ? opt.id : null);
    setActivePicker(null);
  }

  function selectedLabel(options: SelectOption[], id: string | null) {
    return options.find(o => o.id === id)?.label ?? null;
  }

  function confirmDelete(id: string, itemName: string) {
    Alert.alert('삭제', `'${itemName}' 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await deleteFixedCost(id);
          await load();
        },
      },
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
  }

  async function handleSaveEdit() {
    if (!editingId || editSaving) return;
    const parsedAmt = parseInt(editAmount) || 0;
    if (!editName.trim() || parsedAmt <= 0) return;
    setEditSaving(true);
    try {
      await editFixedCost(editingId, {
        name: editName.trim(),
        amount: parsedAmt,
        due_day: editDueDay ? parseInt(editDueDay) : null,
      });
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  const today = new Date().getDate();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={{ flex: 1 }}>
      {/* 토스트 (ScrollView 바깥, 화면 상단에 고정) */}
      {!!routineToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{routineToast}</Text>
        </View>
      )}
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.pageTitle, { color: themeColors.accent }]}>고정비</Text>
      <Text style={styles.pageSubtitle}>매달 반복되는 지출과 저축을 관리해요</Text>

      {/* 합계 카드 */}
      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>고정 지출</Text>
          <Text style={[styles.totalValue, { color: themeColors.accent }]}>{formatCurrency(expenseTotal)}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>고정 저축</Text>
          <Text style={styles.totalValueGreen}>{formatCurrency(savingTotal)}</Text>
        </View>
      </View>

      {/* 이번 달 미처리 배너 */}
      {fixedCosts.length > 0 && (() => {
        const pending = fixedCosts.filter(f => !paidIds.has(f.id));
        if (pending.length === 0) return (
          <View style={[styles.routineBanner, styles.routineBannerDone]}>
            <Text style={styles.routineBannerDoneText}>🎉 이번 달 모두 기록 완료!</Text>
          </View>
        );
        return (
          <View style={styles.routineBanner}>
            <Text style={styles.routineBannerText}>📋 이번 달 미처리 {pending.length}건 · {formatCurrency(pending.reduce((s, f) => s + f.amount, 0))}</Text>
            <Text style={styles.routineBannerSub}>각 항목에서 '기록' 버튼을 눌러 이달 지출을 기록하세요</Text>
          </View>
        );
      })()}

      {/* KINDS 탭 */}
      <View style={styles.tabBar}>
        {KINDS.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.tabBtn, kind === k && { backgroundColor: themeColors.primary }]}
            onPress={() => {
              setKind(k);
              setLinkedAccountId(null);
              setLinkedCardId(null);
              setDebitAccountId(null);
              setCreditAccountId(null);
            }}
          >
            <Text style={[styles.tabBtnText, kind === k && styles.tabBtnTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 항목 리스트 */}
      <View style={styles.card}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>등록된 {kind}이 없어요</Text>
        ) : (
          items.map((item, i) => {
            const paid = paidIds.has(item.id);
            const overdue = item.due_day != null && today > item.due_day && !paid;
            if (editingId === item.id) {
              return (
                <View key={item.id} style={[styles.itemRow, i === 0 && { borderTopWidth: 0 }, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                  <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
            