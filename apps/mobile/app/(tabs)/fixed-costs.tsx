import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, CARD_SHADOW, formatCurrency, useThemeColors } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getFixedCostsData, addFixedCost, deleteFixedCost, type FixedCostsData } from '@/lib/api/fixed-costs';

const KINDS = ['고정지출', '고정저축'] as const;
const TYPES = ['월정액', '연정액', '기타'] as const;

export default function FixedCostsScreen() {
  const { themeColors } = useThemeColors();
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

  const load = useCallback(async () => {
    try {
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) {
        setError('로그인이 필요해요');
        return;
      }
      setData(await getFixedCostsData(userId));
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

      {/* KINDS 탭 */}
      <View style={styles.tabBar}>
        {KINDS.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.tabBtn, kind === k && { backgroundColor: themeColors.primary }]}
            onPress={() => setKind(k)}
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
          items.map((item, i) => (
            <View key={item.id} style={[styles.itemRow, i === 0 && { borderTopWidth: 0 }]}>
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.type} · 매월 {item.due_day}일</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={kind === '고정지출' ? [styles.itemAmount, { color: themeColors.accent }] : styles.itemAmountGreen}>
                  {formatCurrency(item.amount)}
                </Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item.id, item.name)}>
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* 추가 폼 */}
        {showAddForm ? (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="항목 이름"
              placeholderTextColor={COLORS.gray400}
              value={name}
              onChangeText={setName}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="금액"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={amount}
                onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={[styles.input, { width: 90 }]}
                placeholder="납부일"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={dueDay}
                onChangeText={v => setDueDay(v.replace(/[^0-9]/g, ''))}
              />
            </View>
            <View style={styles.typeRow}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.formBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: themeColors.primary }, (!name.trim() || !amount || saving) && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={!name.trim() || !amount || saving}
              >
                <Text style={styles.confirmBtnText}>{saving ? '추가 중...' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, kind === '고정저축' ? styles.addBtnGreen : { backgroundColor: themeColors.primaryLight }]}
            onPress={() => setShowAddForm(true)}
          >
            <Text style={[styles.addBtnText, kind === '고정저축' ? styles.addBtnTextGreen : { color: themeColors.primary }]}>
              + {kind} 추가
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  pageTitle: { fontSize: 18, fontWeight: '600', color: COLORS.accent, marginBottom: 4 },
  pageSubtitle: { fontSize: 12, color: COLORS.gray400, marginBottom: 16 },

  totalCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#f3f4f6',
    padding: 18, marginBottom: 16, ...CARD_SHADOW,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  totalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.accent },
  totalValueGreen: { fontSize: 18, fontWeight: '800', color: COLORS.green },
  totalDivider: { height: 1, backgroundColor: COLORS.gray50 },

  tabBar: { flexDirection: 'row', backgroundColor: '#F0EAEC', borderRadius: RADIUS.lg, padding: 4, gap: 4, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#B8A8AC' },
  tabBtnTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, padding: 16 },
  emptyText: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', paddingVertical: 16 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.gray50,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  itemMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemAmount: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  itemAmountGreen: { fontSize: 14, fontWeight: '700', color: COLORS.green },
  deleteBtn: { backgroundColor: COLORS.redBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deleteBtnText: { fontSize: 11, color: COLORS.red },

  addBtn: {
    marginTop: 12, paddingVertical: 12, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight, alignItems: 'center',
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  addBtnGreen: { backgroundColor: COLORS.greenBg },
  addBtnTextGreen: { color: '#059669' },

  addForm: { marginTop: 12, gap: 8 },
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
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 12, color: COLORS.gray500 },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  formBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.gray100, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
