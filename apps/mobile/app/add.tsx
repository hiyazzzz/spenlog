import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Animated } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { COLORS, RADIUS, useThemeColors } from '@/constants/theme';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { getAssetsData } from '@/lib/api/assets';
import { addExpense } from '@/lib/api/expenses';
import { getHistoryData } from '@/lib/api/history';
import { useDataCache } from '@/store/dataCache';
import { DEFAULT_CATEGORIES } from '@/lib/api/categories';
import GroupedDropdownPicker, { GroupedItem } from '@/components/GroupedDropdownPicker';

const EXTRA_EXPENSE_METHODS = ['현금'];
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

// ─── 드롭다운 피커 ───────────────────────────────────────────────────────────
function DropdownPicker({
  value, options, onSelect, placeholder = '선택하세요',
}: {
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
}) {
  const { themeColors } = useThemeColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.dropdownSheet}>
            <View style={styles.dropdownHandle} />
            <ScrollView style={{ maxHeight: 340 }} bounces={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, value === opt && styles.dropdownItemActive, value === opt && { backgroundColor: themeColors.primary }]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, value === opt && styles.dropdownItemTextActive]}>{opt}</Text>
                  {value === opt && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── 저장 완료 토스트 ────────────────────────────────────────────────────────
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
      <Text style={styles.saveToastText}>✅ 저장됩니다</Text>
    </Animated.View>
  );
}

export default function AddExpenseScreen() {
  const { themeColors } = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [cards, setCards] = useState<{ name: string }[]>([]);
  const [recency, setRecency] = useState<Record<string, number>>({});
  const [showToast, setShowToast] = useState(false);

  const initType: EntryType =
    params.type === 'income' ? 'income' :
    params.type === 'transfer' ? 'transfer' : 'expense';

  const [type, setType] = useState<EntryType>(initType);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [memo, setMemo] = useState('');
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(RECENCY_KEY).then(raw => {
      if (raw) { try { setRecency(JSON.parse(raw)); } catch {} }
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
      } else {
        setCategory(DEFAULT_CATEGORIES[0]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveRecency(methods: string[]) {
    const updated = { ...recency };
    const now = Date.now();
    methods.forEach(m => { if (m && m !== '기타') updated[m] = now; });
    setRecency(updated);
    await AsyncStorage.setItem(RECENCY_KEY, JSON.stringify(updated));
  }

  // 결제수단 옵션 구성: 카드/계좌/기타 그룹으로 분리 (이름순)
  const accountNames = accounts.map(a => a.name);
  const cardNames = cards.map(c => c.name);

  function buildPaymentItems(t: 'expense' | 'income' | 'transfer'): GroupedItem[] {
    const sorted = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b, 'ko'));
    const items: GroupedItem[] = [];
    if (t === 'expense') {
      const sc = sorted(cardNames);
      const sa = sorted(accountNames);
      const se = sorted(EXTRA_EXPENSE_METHODS.filter(m => !cardNames.includes(m) && !accountNames.includes(m)));
      if (sc.length) { items.push({ type: 'header', label: '카드' }); sc.forEach(v => items.push({ type: 'item', label: v, value: v })); }
      if (sa.length) { items.push({ type: 'header', label: '계좌' }); sa.forEach(v => items.push({ type: 'item', label: v, value: v })); }
      if (se.length) { items.push({ type: 'header', label: '기타 수단' }); se.forEach(v => items.push({ type: 'item', label: v, value: v })); }
    } else {
      const sa = sorted(accountNames);
      const se = sorted(INCOME_METHODS.filter(m => !accountNames.includes(m)));
      if (sa.length) { items.push({ type: 'header', label: '계좌' }); sa.forEach(v => items.push({ type: 'item', label: v, value: v })); }
      if (se.length) { items.push({ type: 'header', label: '기타 수단' }); se.forEach(v => items.push({ type: 'item', label: v, value: v })); }
    }
    items.push({ type: 'item', label: '기타', value: '기타' });
    return items;
  }
  const paymentItems = buildPaymentItems(type);

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
      // ── 이체
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
          category: '고정비',
          date,
          payment_method: transferFrom || null,
          memo: memoVal,
          type: 'savings',
          source: 'manual',
        });
        if (saveErr) throw saveErr;
        const fromAcc = accounts.find(a => a.name === transferFrom);
        if (fromAcc) {
          await supabase.from('accounts').update({ balance: (fromAcc.balance ?? 0) - amt }).eq('id', fromAcc.id);
        }
        const toAcc = accounts.find(a => a.name === transferTo);
        if (toAcc) {
          await supabase.from('accounts').update({ balance: (toAcc.balance ?? 0) + amt }).eq('id', toAcc.id);
        }
        await saveRecency([transferFrom, transferTo].filter(Boolean));
        // 저장 직후 fresh history prefetch → 캐시에 미리 채워서 내역탭 즉시 반영
        getHistoryData(userId).then(fresh => {
          useDataCache.getState().setHistory(fresh);
        }).catch(() => { useDataCache.getState().setHistory(null); });
        triggerToastAndBack();
        return;
      }

      // ── 지출 / 수입
      if (!name.trim()) { setError('항목명을 입력해주세요'); setSaving(false); return; }

      const pm = paymentMethod || null;
      const { error: saveErr } = await addExpense(userId, {
        name: name.trim(),
        amount: amt,
        category: (type === 'income' ? '수입' : (category === '없음' ? null : (category || DEFAULT_CATEGORIES[0]))) as string,
        date,
        payment_method: pm,
        memo: memo.trim() || null,
        type,
      });
      if (saveErr) throw saveErr;

      // 계좌 잔액 업데이트 (기타 제외)
      if (paymentMethod && paymentMethod !== '기타') {
        const selectedAccount = accounts.find(a => a.name === paymentMethod);
        if (selectedAccount) {
          const delta = type === 'income' ? amt : -amt;
          await supabase.from('accounts').update({ balance: (selectedAccount.balance ?? 0) + delta }).eq('id', selectedAccount.id);
        }
        await saveRecency([paymentMethod]);
      }

      // 저장 직후 fresh history prefetch → 캐시에 미리 채워서 내역탭 즉시 반영
      getHistoryData(userId).then(fresh => {
        useDataCache.getState().setHistory(fresh);
      }).catch(() => { useDataCache.getState().setHistory(null); });
      triggerToastAndBack();
    } catch (err: any) {
      console.error('[add] save error:', JSON.stringify(err));
      setError('저장 중 오류가 발생했어요');
    } finally {
      setSaving(false);
    }
  }

  function triggerToastAndBack() {
    setShowToast(true);
    setTimeout(() => router.back(), 1100);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: themeColors.accent }]}>직접 입력</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
      </View>

      {/* 타입 토글 */}
      <View style={styles.typeToggleRow}>
        {TYPE_CONFIG.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.typeToggleBtn, type === key && styles.typeToggleBtnActive, type === key && { backgroundColor: themeColors.primary }]}
            onPress={() => { setType(key); resetTypeState(); }}
          >
            <Text style={[styles.typeToggleText, type === key && styles.typeToggleTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 금액 */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>금액 *</Text>
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
          <DropdownPicker
            value={transferFrom}
            options={accounts.filter(a => a.name !== transferTo).map(a => a.name)}
            onSelect={v => setTransferFrom(v === transferFrom ? '' : v)}
            placeholder="계좌 선택"
          />
          {accounts.length === 0 && <Text style={styles.emptyHint}>등록된 계좌가 없어요</Text>}
        </View>
      )}

      {/* 이체 — 입금 계좌 */}
      {type === 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>입금 계좌 (선택)</Text>
          <DropdownPicker
            value={transferTo}
            options={accounts.filter(a => a.name !== transferFrom).map(a => a.name)}
            onSelect={v => setTransferTo(v === transferTo ? '' : v)}
            placeholder="계좌 선택"
          />
          {accounts.length === 0 && <Text style={styles.emptyHint}>등록된 계좌가 없어요</Text>}
        </View>
      )}

      {/* 이체 — 항목명 */}
      {type === 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>이체 항목 (선택)</Text>
          <TextInput style={styles.input} placeholder="예) ISA 투자금" placeholderTextColor={COLORS.gray400} value={name} onChangeText={setName} />
        </View>
      )}

      {/* 지출/수입 — 항목명 */}
      {type !== 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{type === 'expense' ? '상호명 / 항목명 *' : '항목명 *'}</Text>
          <TextInput
            style={styles.input}
            placeholder={type === 'expense' ? '예) 스타벅스' : '예) 용돈'}
            placeholderTextColor={COLORS.gray400}
            value={name}
            onChangeText={setName}
          />
        </View>
      )}

      {/* 카테고리 드롭다운 */}
      {type === 'expense' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>카테고리</Text>
          <DropdownPicker
            value={category}
            options={['없음', ...categories]}
            onSelect={setCategory}
            placeholder="카테고리 선택"
          />
        </View>
      )}

      {/* 날짜 */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>날짜</Text>
        <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.gray400} value={date} onChangeText={setDate} />
      </View>

      {/* 결제수단 드롭다운 */}
      {type !== 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{type === 'expense' ? '결제수단' : '받은 수단'}</Text>
          <GroupedDropdownPicker
            value={paymentMethod}
            items={paymentItems}
            onSelect={setPaymentMethod}
            placeholder="선택 안 함 (없음)"
          />
          {paymentMethod !== '' && (
            <TouchableOpacity onPress={() => setPaymentMethod('')} style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: COLORS.gray400 }}>✕ 선택 해제</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 메모 */}
      {type !== 'transfer' && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>메모 (선택)</Text>
          <TextInput style={styles.input} placeholder="간단히 남겨보세요" placeholderTextColor={COLORS.gray400} value={memo} onChangeText={setMemo} />
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>
          {saving ? '저장 중...' :
           type === 'expense' ? '지출 저장' :
           type === 'income'  ? '수입 저장' : '이체 기록'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    <SaveToast visible={showToast} />
    </KeyboardAvoidingView>
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

  // 드롭다운
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.gray100, borderRadius: RADIUS.md,
  },
  dropdownValue: { fontSize: 14, fontWeight: '600', color: COLORS.gray800, flex: 1 },
  dropdownPlaceholder: { fontSize: 14, color: COLORS.gray400, flex: 1 },
  dropdownArrow: { fontSize: 10, color: COLORS.gray400, marginLeft: 8 },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  dropdownSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 36 },
  dropdownHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 8 },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  dropdownItemActive: { backgroundColor: COLORS.primary },
  dropdownItemText: { fontSize: 14, color: COLORS.gray700 },
  dropdownItemTextActive: { color: '#fff', fontWeight: '700' },

  // 저장 완료 토스트
  saveToast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: 'rgba(30,30,30,0.88)', paddingVertical: 10, paddingHorizontal: 22,
    borderRadius: 30,
  },
  saveToastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
