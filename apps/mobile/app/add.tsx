import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import { COLORS, RADIUS } from '@/constants/theme';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { getAssetsData } from '@/lib/api/assets';
import { addExpense } from '@/lib/api/expenses';
import { DEFAULT_CATEGORIES } from '@/lib/api/categories';

const EXPENSE_METHODS = ['현금', '계좌이체', '카카오페이', '네이버페이', '토스페이', '제로페이'];
const INCOME_METHODS = ['현금', '계좌이체'];

function formatAmount(val: string): string {
  const num = val.replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString();
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [cards, setCards] = useState<{ name: string }[]>([]);

  const [type, setType] = useState<'expense' | 'income'>(params.type === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('생활비');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;
      setUserId(uid);
      const data = await getAssetsData(uid);
      setAccounts(data.accounts.map(a => ({ id: a.id, name: a.name, balance: a.balance })));
      setCards(data.cards.map(c => ({ name: c.name })));
      const catNames = data.categories.map(c => c.name);
      if (catNames.length > 0) {
        setCategories(catNames);
        setCategory(catNames[0]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accountNames = accounts.map(a => a.name);
  const paymentOptions = type === 'income'
    ? [...accountNames, ...INCOME_METHODS.filter(m => !accountNames.includes(m))]
    : [...cards.map(c => c.name), ...accountNames.filter(n => !cards.some(c => c.name === n)), ...EXPENSE_METHODS.filter(m => !cards.some(c => c.name === m) && !accountNames.includes(m))];

  async function handleSave() {
    const amt = parseInt(amount.replace(/,/g, ''), 10);
    if (!amt || amt <= 0) { setError('금액을 입력해주세요'); return; }
    if (!name.trim()) { setError('항목명을 입력해주세요'); return; }
    if (type === 'expense' && !paymentMethod) { setError('결제수단을 선택해주세요'); return; }
    if (!userId) return;
    setError('');
    setSaving(true);
    try {
      const { error: saveErr } = await addExpense(userId, {
        name: name.trim(),
        amount: amt,
        category: type === 'income' ? '수입' : category,
        date,
        payment_method: type === 'expense' ? paymentMethod : null,
        memo: memo.trim() || null,
        type,
      });
      if (saveErr) throw saveErr;

      const selectedAccount = accounts.find(a => a.name === paymentMethod);
      if (selectedAccount) {
        const delta = type === 'income' ? amt : -amt;
        await supabase.from('accounts')
          .update({ balance: (selectedAccount.balance ?? 0) + delta })
          .eq('id', selectedAccount.id);
      }

      router.back();
    } catch {
      setError('저장 중 오류가 발생했어요');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>직접 입력</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.typeToggleRow}>
        {(['expense', 'income'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.typeToggleBtn, type === t && styles.typeToggleBtnActive]}
            onPress={() => { setType(t); setError(''); setPaymentMethod(''); }}
          >
            <Text style={[styles.typeToggleText, type === t && styles.typeToggleTextActive]}>
              {t === 'expense' ? '💸 지출' : '💰 수입'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>금액</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0"
          placeholderTextColor={COLORS.gray400}
          keyboardType="numeric"
          value={amount}
          onChangeText={v => setAmount(formatAmount(v))}
          autoFocus
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{type === 'expense' ? '어디서 썼나요?' : '어디서 받았나요?'}</Text>
        <TextInput
          style={styles.input}
          placeholder={type === 'expense' ? '예) 스타벅스' : '예) 용돈'}
          placeholderTextColor={COLORS.gray400}
          value={name}
          onChangeText={setName}
        />
      </View>

      {type === 'expense' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>카테고리</Text>
          <View style={styles.chipWrap}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>날짜</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.gray400}
          value={date}
          onChangeText={setDate}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>
          {type === 'expense' ? '결제수단' : '받은 수단'} {type === 'expense' && <Text style={{ color: COLORS.red }}>*</Text>}
        </Text>
        <View style={styles.chipWrap}>
          {paymentOptions.slice(0, 6).map(method => (
            <TouchableOpacity
              key={method}
              style={[styles.chip, paymentMethod === method && styles.chipActive]}
              onPress={() => setPaymentMethod(paymentMethod === method ? '' : method)}
            >
              <Text style={[styles.chipText, paymentMethod === method && styles.chipTextActive]}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>메모</Text>
        <TextInput
          style={styles.input}
          placeholder="메모 (선택)"
          placeholderTextColor={COLORS.gray400}
          value={memo}
          onChangeText={setMemo}
        />
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>
          {saving ? '저장 중...' : type === 'expense' ? '지출 저장' : '수입 저장'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 48, gap: 10 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pageTitle: { fontSize: 18, fontWeight: '700', color: COLORS.accent },
  cancelText: { fontSize: 13, color: COLORS.gray400 },

  typeToggleRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, padding: 3 },
  typeToggleBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  typeToggleBtnActive: { backgroundColor: COLORS.primary },
  typeToggleText: { fontSize: 13, fontWeight: '600', color: COLORS.gray400 },
  typeToggleTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, padding: 14 },
  fieldLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 8 },
  amountInput: { fontSize: 22, fontWeight: '800', color: COLORS.gray800 },
  input: { fontSize: 14, color: COLORS.gray800 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.gray100 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.gray500 },
  chipTextActive: { color: '#fff' },

  errorText: { fontSize: 12, color: COLORS.red, paddingHorizontal: 2 },

  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
