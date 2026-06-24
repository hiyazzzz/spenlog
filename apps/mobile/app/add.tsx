import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { COLORS, RADIUS } from '@/constants/theme';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { getAssetsData } from '@/lib/api/assets';
import { addExpense } from '@/lib/api/expenses';
import { DEFAULT_CATEGORIES } from '@/lib/api/categories';

const EXPENSE_METHODS = ['현금', '계좌이체', '카카오페이', '네이버페이', '토스페이', '제로페이'];
const INCOME_METHODS = ['현금', '계좌이체'];
const RECENCY_KEY = 'payment_method_recency';

function formatAmount(val: string): string {
  const num = val.replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString();
}

function sortByRecency(methods: string[], recency: Record<string, number>): string[] {
  return [...methods].sort((a, b) => (recency[b] ?? 0) - (recency[a] ?? 0));
}

type EntryType = 'expense' | 'income' | 'transfer';

const TYPE_CONFIG: { key: EntryType; label: string }[] = [
  { key: 'expense', label: '💸 지출' },
  { key: 'income',  label: '💰 수입' },
  { key: 'transfer', label: '🔄 이체' },
];

export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [cards, setCards] = useState<{ name: string }[]>([]);
  const [recency, setRecency] = useState<Record<string, number>>({});

  const initType: EntryType =
    params.type === 'income' ? 'income' :
    params.type === 'transfer' ? 'transfer' : 'expense';

  const [type, setType] = useState<EntryType>(initType);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('생활비');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [memo, setMemo] = useState('');
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 최근 사용 수단 로드
  useEffect(() => {
    AsyncStorage.getItem(RECENCY_KEY).then(raw => {
      if (raw) {
        try { setRecency(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

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

  async function saveRecency(methods: string[]) {
    const updated = { ...recency };
    const now = Date.now();
    methods.forEach(m => { if (m) updated[m] = now; });
    setRecency(updated);
    await AsyncStorage.setItem(RECENCY_KEY, JSON.stringify(updated));
  }

  const accountNames = accounts.map(a => a.name);
  const rawPaymentOptions = type === 'income'
    ? [...accountNames, ...INCOME_METHODS.filter(m => !accountNames.includes(m))]
    : [...cards.map(c => c.name), ...accountNames.filter(n => !cards.some(c => c.name === n)), ...EXPENSE_METHODS.filter(m => !cards.some(c => c.name === m) && !accountNames.includes(m))];
  // 최근 사용순 정렬 (한 번이라도 쓴 것은 앞으로)
  const paymentOptions = sortByRecency(rawPaymentOptions, recency);

  function resetTypeState() {
    setError('');
    setPaymentMethod('');
    setTransferFrom('');
    setTransferTo('');
  }

  async function handleSave() {
    const amt = parseInt(amount.replace(/,/g, ''), 10);
    if (!amt || amt <= 0) { setError('금액을 입력해주세요'); return; }
    if (!userId) return;
    setError('');
    setSaving(true);

    try {
      // ── 이체 ──────────────────────────────────────────────
      if (type === 'transfer') {
        if (!transferFrom && !transferTo) {
          setError('출금 또는 입금 계좌를 선택해주세요');
          setSaving(false);
          return;
        }
        const memoVal = transferTo ? `[이체] ${transferTo}` : (memo.trim() || null);
        const { error: saveErr } = await supabase.from('expenses').insert({
          user_id: userId,
          name: name.trim() || '계좌 이체',
          amount: amt,
          category: '이체',
          date,
          payment_method: transferFrom || null,
          memo: memoVal,
          type: 'savings',
          source: 'manual',
        });
        if (saveErr) throw saveErr;

        const fromAcc = accounts.find(a => a.name === transferFrom);
        if (fromAcc) {
          await supabase.from('accounts')
            .update({ balance: (fromAcc.balance ?? 0) - amt })
            .eq('id', fromAcc.id);
        }
        const toAcc = accounts.find(a => a.name === transferTo);
        if (toAcc) {
          await supabase.from('accounts')
            .update({ balance: (toAcc.balance ?? 0) + amt })
            .eq('id', toAcc.id);
        }

        // 이체 계좌도 recency 저장
        await saveRecency([transferFrom, transferTo].filter(Boolean));
        router.back();
        return;
      }

      // ── 지출 / 수입 ───────────────────────────────────────
      if (!name.trim()) { setError('항목명을 입력해주세요'); setSaving(false); return; }
      if (type === 'expense' && !paymentMethod) { setError('결제수단을 선택해주세요'); setSaving(false); return; }

      const { error: saveErr } = await addExpense(userId, {
        name: name.trim(),
        amount: amt,
        category: type === 'income' ? '수입' : category,
        date,
        payment_method: paymentMethod || null,
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

      // 사용한 결제수단 recency 저장
      if (paymentMethod) await saveRecency([paymentMethod]);

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

      {/* 타입 토글: 지출 / 수입 / 이체 */}
      <View style={styles.typeToggleRow}>
        {TYPE_CONFIG.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.typeToggleBtn, type === key && styles.typeToggleBtnActive]}
            onPress={() => { setType(key); resetTypeState(); }}
          >
            <Text style={[styles.typeToggleText, type === key && styles.typeToggleTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 금액 */}
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

      {/* 이체 — 출금 계좌 */}
      {type === 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>출금 계좌 (선택)</Text>
          <View style={styles.chipWrap}>
            {accounts.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chip,
                  transferFrom === a.name && styles.chipActive,
                  transferTo === a.name && styles.chipDisabled,
                ]}
                onPress={() => {
                  if (transferTo === a.name) return;
                  setTransferFrom(prev => prev === a.name ? '' : a.name);
                }}
              >
                <Text style={[styles.chipText, transferFrom === a.name && styles.chipTextActive]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {accounts.length === 0 && <Text style={styles.emptyHint}>등록된 계좌가 없어요</Text>}
        </View>
      )}

      {/* 이체 — 입금 계좌 */}
      {type === 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>입금 계좌 (선택)</Text>
          <View style={styles.chipWrap}>
            {accounts.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chip,
                  transferTo === a.name && styles.chipActiveGreen,
                  transferFrom === a.name && styles.chipDisabled,
                ]}
                onPress={() => {
                  if (transferFrom === a.name) return;
                  setTransferTo(prev => prev === a.name ? '' : a.name);
                }}
              >
                <Text style={[styles.chipText, transferTo === a.name && styles.chipTextActive]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {accounts.length === 0 && <Text style={styles.emptyHint}>등록된 계좌가 없어요</Text>}
        </View>
      )}

      {/* 이체 — 항목명 */}
      {type === 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>이체 항목 (선택)</Text>
          <TextInput
            style={styles.input}
            placeholder="예) ISA 투자금"
            placeholderTextColor={COLORS.gray400}
            value={name}
            onChangeText={setName}
          />
        </View>
      )}

      {/* 지출/수입 — 항목명 */}
      {type !== 'transfer' && (
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
      )}

      {/* 지출 — 카테고리 */}
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

      {/* 날짜 */}
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

      {/* 지출/수입 — 결제수단 (최근사용순) */}
      {type !== 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>
            {type === 'expense' ? '결제수단' : '받은 수단'}{' '}
            {type === 'expense' && <Text style={{ color: COLORS.red }}>*</Text>}
          </Text>
          {Object.keys(recency).length > 0 && (
            <Text style={styles.recencyHint}>최근 사용순으로 정렬됨</Text>
          )}
          <View style={styles.chipWrap}>
            {paymentOptions.map(method => (
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
      )}

      {/* 메모 (지출/수입만) */}
      {type !== 'transfer' && (
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
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>
          {saving ? '저장 중...' :
           type === 'expense' ? '지출 저장' :
           type === 'income'  ? '수입 저장' : '이체 기록'}
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
  typeToggleText: { fontSize: 12, fontWeight: '600', color: COLORS.gray400 },
  typeToggleTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray100, padding: 14 },
  fieldLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 8 },
  amountInput: { fontSize: 22, fontWeight: '800', color: COLORS.gray800 },
  input: { fontSize: 14, color: COLORS.gray800 },

  recencyHint: { fontSize: 10, color: COLORS.gray400, marginBottom: 6 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.gray100 },
  chipActive: { backgroundColor: COLORS.primary },
  chipActiveGreen: { backgroundColor: '#16a34a' },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.gray500 },
  chipTextActive: { color: '#fff' },

  emptyHint: { fontSize: 12, color: COLORS.gray400, marginTop: 4 },
  errorText: { fontSize: 12, color: COLORS.red, paddingHorizontal: 2 },

  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
