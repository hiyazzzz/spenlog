import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, THEMES, formatCurrency, getThemeColors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '@/store/themeStore';
import { supabase } from '@/lib/supabase';
import { completeOnboarding } from '@/lib/api/settings';

// ──────────────────────────────────────────────
// 인트로 슬라이드 (웹과 동일)
// ──────────────────────────────────────────────
const INTRO_SLIDES = [
  {
    emoji: '🤖',
    title: '"스타벅스 육천원 카드" 한 줄이면',
    desc: 'AI가 금액·카테고리·결제수단을 자동으로 분류해줘요',
    bg: ['#6B1E2E', '#9B2C45'] as [string, string],
  },
  {
    emoji: '📊',
    title: '이번 달 지출 현황을 한눈에',
    desc: '카테고리별 예산 달성률을 대시보드에서 바로 확인해요',
    bg: ['#4A7541', '#6AAD5E'] as [string, string],
  },
  {
    emoji: '🏦',
    title: '계좌·카드·고정비 연결하면',
    desc: '루틴 기록 한 번으로 잔액이 자동으로 반영돼요',
    bg: ['#5C4B8A', '#7B6AAD'] as [string, string],
  },
];

const THEME_LIST = [
  { key: 'Burgundy', name: '버건디', color: '#6B1E2E' },
  { key: 'Sage', name: '세이지', color: '#7C9070' },
];

const DEFAULT_CATS = ['생활비', '고정비', '활동비', '수입'];

const TOTAL_STEPS = 6; // 이름 / 테마 / 수입 / 목표 / 예산 / 카테고리

function formatNum(val: string) {
  const n = val.replace(/[^0-9]/g, '');
  return n ? Number(n).toLocaleString() : '';
}

export default function OnboardingScreen() {
  const router = useRouter();
  const setStoreTheme = useThemeStore(s => s.setTheme);

  // 인트로 슬라이드
  const [introSlide, setIntroSlide] = useState(0);
  const [step, setStep] = useState(0); // 0 = 인트로, 1~TOTAL_STEPS = 진행 단계, TOTAL_STEPS+1 = 완료

  // 입력값
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('Burgundy');

  // 선택된 테마의 컬러 팔레트 (즉시 반영)
  const tc = getThemeColors(theme);
  const [income, setIncome] = useState('');
  const [goal, setGoal] = useState('');
  const [budget, setBudget] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const incomeNum = parseInt(income || '0') || 0;
  const goalNum = parseInt(goal || '0') || 0;

  // ── 완료 처리 ──────────────────────────────
  async function finish() {
    setSaving(true);
    setSaveError('');
    try {
      const finalName = name.trim() || '소비요정';
      const month = new Date().toISOString().slice(0, 7);
      const budgetNum = parseInt(budget || '0') || Math.max(incomeNum - goalNum, 0);

      // 게스트 모드: AsyncStorage에만 저장, DB 스킵
      const { isGuest } = useThemeStore.getState();
      if (isGuest) {
        await AsyncStorage.setItem('guest_nickname', finalName);
        await AsyncStorage.setItem('guest_income', String(incomeNum));
        await AsyncStorage.setItem('guest_saving_goal', String(goalNum));
        await AsyncStorage.setItem('guest_onboarding_completed', 'true');
        setStoreTheme(theme);
        setStep(TOTAL_STEPS + 1);
        return;
      }

      // 로그인 유저: auth.getUser() 직접 호출 → id + email 동시 획득
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('로그인 필요');
      const uid = user.id;
      const email = user.email ?? '';

      // 1. users 테이블 upsert + Zustand store 동기화 (email 포함)
      await supabase.from('users').upsert(
        { id: uid, email, name: finalName, income: incomeNum, saving_goal: goalNum, theme, onboarding_completed: true },
        { onConflict: 'id' },
      );
      setStoreTheme(theme);

      // 2. 카테고리별 예산 (지출 카테고리만)
      const spendCats = categories.filter(c => c !== '수입');
      if (spendCats.length > 0 && budgetNum > 0) {
        const dist: Record<string, number> = { '생활비': 0.40, '고정비': 0.35, '활동비': 0.25 };
        const rows = spendCats.map(cat => ({
          user_id: uid,
          category: cat,
          amount: Math.round(budgetNum * (dist[cat] ?? 0.1) / 1000) * 1000,
          month,
          source: 'manual',
        }));
        await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category,month' });
      }

      // 3. 카테고리 초기 등록 (이미 있으면 스킵)
      const { data: existingCats } = await supabase.from('categories').select('id').eq('user_id', uid).limit(1);
      if (!existingCats?.length && categories.length > 0) {
        await supabase.from('categories').insert(
          categories.map((n, i) => ({ user_id: uid, name: n, is_default: true, is_hidden: false, sort_order: i }))
        );
      }

      // 4. 온보딩 완료 플래그 (AsyncStorage + DB)
      await completeOnboarding(uid);

      setStep(TOTAL_STEPS + 1);
    } catch (e: any) {
      setSaveError(e.message ?? '저장 중 오류가 발생했어요');
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (step === TOTAL_STEPS) {
      await finish();
      return;
    }
    setStep(s => s + 1);
  }

  function prev() {
    setStep(s => Math.max(s - 1, 0));
  }

  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

  // ── 인트로 슬라이드 ──────────────────────────
  if (step === 0) {
    const slide = INTRO_SLIDES[introSlide];
    return (
      <View style={styles.screen}>
        {/* 건너뛰기 */}
        <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(1)}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </TouchableOpacity>

        {/* 슬라이드 본문 */}
        <View style={[styles.slideHero, { backgroundColor: slide.bg[0] }]}>
          <Text style={styles.slideEmoji}>{slide.emoji}</Text>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideDesc}>{slide.desc}</Text>
        </View>

        {/* 하단 */}
        <View style={styles.slideBottom}>
          {/* 도트 인디케이터 */}
          <View style={styles.dotRow}>
            {INTRO_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === introSlide ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>

          {introSlide < INTRO_SLIDES.length - 1 ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setIntroSlide(s => s + 1)}>
              <Text style={styles.primaryBtnText}>다음</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(1)}>
              <Text style={styles.primaryBtnText}>시작하기 🎉</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── 완료 화면 ────────────────────────────────
  if (step === TOTAL_STEPS + 1) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.welcomeEmoji}>🎉</Text>
          <Text style={styles.welcomeTitle}>{name.trim() || '소비요정'}님, 준비됐어요!</Text>
          <Text style={styles.introText}>이제 Spenlog와 함께{'\n'}천천히, 꾸준히 시작해봐요</Text>
        </View>
        <View style={styles.bottom}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tc.primary }]} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.primaryBtnText}>홈으로 가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── 단계별 폼 ─────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={{ flex: 1 }}>
      {/* 진행률 바 */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(step / TOTAL_STEPS) * 100}%` as any, backgroundColor: tc.primary }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>어떻게 불러드릴까요?</Text>
            <Text style={styles.stepSubtitle}>닉네임을 입력해주세요</Text>
            <TextInput
              style={styles.input}
              placeholder="예) 소비요정"
              placeholderTextColor={COLORS.gray400}
              value={name}
              onChangeText={setName}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>마음에 드는 테마를 골라주세요</Text>
            <Text style={styles.stepSubtitle}>나중에 설정에서 바꿀 수 있어요</Text>
            <View style={styles.themeRow}>
              {THEME_LIST.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.themeCard, theme === t.key && { borderColor: tc.primary, backgroundColor: tc.primaryLight }]}
                  onPress={() => { setTheme(t.key); setStoreTheme(t.key); }}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: t.color }]} />
                  <Text style={styles.themeName}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>한 달 수입은 얼마인가요?</Text>
            <Text style={styles.stepSubtitle}>예산을 추천해드릴 때 사용돼요</Text>
            <View style={styles.amountInputBox}>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={formatNum(income)}
                onChangeText={v => setIncome(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.stepTitle}>저축 목표를 정해볼까요?</Text>
            <Text style={styles.stepSubtitle}>한 달에 모으고 싶은 금액이에요</Text>
            <View style={styles.amountInputBox}>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={formatNum(goal)}
                onChangeText={v => setGoal(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
            {incomeNum > 0 && goalNum > 0 && (
              <Text style={[styles.helperText, { color: tc.primary }]}>
                수입의 {Math.round((goalNum / incomeNum) * 100)}%를 저축할 거예요
              </Text>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <Text style={styles.stepTitle}>이번 달 지출 예산은요?</Text>
            <Text style={styles.stepSubtitle}>전체 지출 한도를 설정해요 (선택)</Text>
            <View style={styles.amountInputBox}>
              <TextInput
                style={styles.amountInput}
                placeholder={incomeNum > 0 ? String(Math.max(incomeNum - goalNum, 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'}
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={formatNum(budget)}
                onChangeText={v => setBudget(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
            {incomeNum > 0 && (
              <Text style={[styles.helperText, { color: tc.primary }]}>
                추천 예산: {formatCurrency(Math.max(incomeNum - goalNum, 0))}
              </Text>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <Text style={styles.stepTitle}>주로 어디에 돈을 쓰시나요?</Text>
            <Text style={styles.stepSubtitle}>관리할 카테고리를 선택해주세요</Text>
            <View style={styles.catGrid}>
              {DEFAULT_CATS.map(cat => {
                const selected = categories.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, selected && { borderColor: tc.primary, backgroundColor: tc.primary }]}
                    onPress={() => toggleCategory(cat)}
                  >
                    <Text style={[styles.catChipText, selected && styles.catChipTextSelected]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={prev}>
          <Text style={styles.secondaryBtnText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 1, backgroundColor: tc.primary }, saving && styles.btnDisabled]}
          onPress={next}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>{step === TOTAL_STEPS ? '완료' : '다음'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  welcomeEmoji: { fontSize: 48, marginBottom: 12 },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: COLORS.accent, marginBottom: 8, textAlign: 'center' },
  introText: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 22 },
  bottom: { padding: 24, paddingBottom: 48 },
  bottomRow: { flexDirection: 'row', gap: 10, padding: 24, paddingBottom: 48 },

  // 인트로 슬라이드
  skipBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  skipText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  slideHero: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 360 },
  slideEmoji: { fontSize: 64, marginBottom: 24 },
  slideTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12, lineHeight: 30 },
  slideDesc: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24 },
  slideBottom: { backgroundColor: '#fff', padding: 24, paddingBottom: 48 },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: COLORS.primary },
  dotInactive: { width: 6, backgroundColor: '#e5e7eb' },

  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  secondaryBtn: { borderRadius: RADIUS.lg, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', backgroundColor: COLORS.gray100 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray500 },
  btnDisabled: { opacity: 0.6 },

  progressBarBg: { height: 4, backgroundColor: COLORS.gray100, marginTop: 56 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary },

  body: { padding: 24, paddingTop: 40, paddingBottom: 20 },
  stepTitle: { fontSize: 19, fontWeight: '800', color: COLORS.accent, marginBottom: 6 },
  stepSubtitle: { fontSize: 13, color: COLORS.gray400, marginBottom: 24 },

  input: {
    borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.gray800,
    backgroundColor: '#fff',
  },

  amountInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
  },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.accent, textAlign: 'right' },
  amountUnit: { fontSize: 15, color: COLORS.gray500 },
  helperText: { fontSize: 12, color: COLORS.primary, marginTop: 10, fontWeight: '600' },

  themeRow: { flexDirection: 'row', gap: 12 },
  themeCard: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 20,
    borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  themeCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  themeSwatch: { width: 36, height: 36, borderRadius: 18 },
  themeName: { fontSize: 13, fontWeight: '700', color: COLORS.gray700 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  catChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  catChipTextSelected: { color: '#fff' },

  errorText: { fontSize: 12, color: '#ef4444', marginTop: 16, textAlign: 'center' },
});
