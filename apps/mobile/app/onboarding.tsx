import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, getThemeColors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '@/store/themeStore';
import { supabase } from '@/lib/supabase';
import { completeOnboarding } from '@/lib/api/settings';

// ──────────────────────────────────────────────
// 인트로 슬라이드
// ──────────────────────────────────────────────
const INTRO_SLIDES = [
  {
    emoji: '🤖',
    title: '"스타벅스 육천원 카드" 한 줄이면',
    desc: 'AI가 금액·카테고리·결제수단을 자동으로 분류해줘요',
    bg: '#6B1E2E',
  },
  {
    emoji: '📊',
    title: '이번 달 지출 현황을 한눈에',
    desc: '카테고리별 예산 달성률을 대시보드에서 바로 확인해요',
    bg: '#4A6741',
  },
  {
    emoji: '🏦',
    title: '계좌·카드·고정비 연결하면',
    desc: '루틴 기록 한 번으로 잔액이 자동으로 반영돼요',
    bg: '#5C4B8A',
  },
];

// ──────────────────────────────────────────────
// 랜덤 닉네임 (Vercel 앱과 동기화)
// ──────────────────────────────────────────────
const RANDOM_NAMES = [
  '데굴데굴 도토리', '반짝반짝 별님', '폴짝폴짝 토끼', '살금살금 고양이',
  '알콩달콩 다람쥐', '포근포근 구름', '도란도란 물방울', '사뿐사뿐 나비',
  '보슬보슬 솔방울', '동글동글 밤톨', '깜짝깜짝 별똥별', '방글방글 해님',
];
function randomName() { return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]!; }

const THEME_LIST = [
  { key: 'Burgundy', name: '버건디', color: '#6B1E2E' },
  { key: 'Sage', name: '세이지', color: '#4A6741' },
];

// 기본 카테고리 (온보딩 화면엔 노출 안 하지만 finish 시 자동 저장)
const DEFAULT_CATS = ['생활비', '고정비', '활동비', '친목비', '수입'];

// 닉네임 / 테마 / 수입 / 저축목표
const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const setStoreTheme = useThemeStore(s => s.setTheme);

  const [introSlide, setIntroSlide] = useState(0);
  const [step, setStep] = useState(0); // 0=인트로, 1~4=단계, 5=완료

  const [suggestedName, setSuggestedName] = useState(randomName);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('Burgundy');
  const tc = getThemeColors(theme);

  const [income, setIncome] = useState('');
  const [goal, setGoal] = useState('');
  const incomeNum = (parseInt(income.replace(/,/g, '') || '0') || 0) * 10000;
  const goalNum = (parseInt(goal.replace(/,/g, '') || '0') || 0) * 10000;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function fmtManWon(v: string) {
    const n = v.replace(/[^0-9]/g, '');
    return n ? Number(n).toLocaleString() : '';
  }

  const finalName = name.trim() || suggestedName;

  // ── 저장 공통 헬퍼 ──────────────────────────
  async function saveData() {
    const month = new Date().toISOString().slice(0, 7);
    const budgetNum = Math.max(incomeNum - goalNum, 0);

    const { isGuest } = useThemeStore.getState();
    if (isGuest) {
      await AsyncStorage.setItem('guest_nickname', finalName);
      await AsyncStorage.setItem('guest_income', String(incomeNum));
      await AsyncStorage.setItem('guest_saving_goal', String(goalNum));
      await AsyncStorage.setItem('guest_categories', JSON.stringify(DEFAULT_CATS));
      await AsyncStorage.setItem('guest_theme', theme);
      await AsyncStorage.setItem('guest_onboarding_completed', 'true');
      setStoreTheme(theme);
      return null;
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error('로그인 필요');
    const uid = user.id;

    const emailToUse = user.email ?? `${uid}@guest.spenlog.app`
    await supabase.from('users').upsert(
      { id: uid, email: emailToUse, name: finalName, income: incomeNum, saving_goal: goalNum, theme, onboarding_completed: true },
      { onConflict: 'id' },
    );
    setStoreTheme(theme);

    // 예산 자동 분배 (수입이 있는 경우)
    const spendCats = DEFAULT_CATS.filter(c => c !== '수입');
    if (budgetNum > 0) {
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

    // 기본 카테고리 저장
    const { data: existingCats } = await supabase.from('categories').select('id').eq('user_id', uid).limit(1);
    if (!existingCats?.length) {
      await supabase.from('categories').insert(
        DEFAULT_CATS.map((n, i) => ({ user_id: uid, name: n, is_default: true, is_hidden: false, sort_order: i }))
      );
    }

    await completeOnboarding(uid);
    return uid;
  }

  async function finish() {
    setSaving(true);
    setSaveError('');
    try {
      await saveData();
      setStep(TOTAL_STEPS + 1);
    } catch (e: any) {
      setSaveError(e.message ?? '저장 중 오류가 발생했어요');
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    try {
      await saveData();
    } catch {
      // saveData 실패해도 onboarding 플래그는 반드시 저장 (무한 redirect 방지)
      const { isGuest } = useThemeStore.getState();
      if (isGuest) {
        try { await AsyncStorage.setItem('guest_onboarding_completed', 'true'); } catch {}
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await completeOnboarding(user.id).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
    router.replace('/(tabs)');
  }

  async function next() {
    if (step === TOTAL_STEPS) { await finish(); return; }
    setStep(s => s + 1);
  }

  function prev() { setStep(s => Math.max(s - 1, 0)); }

  // ── 인트로 슬라이드 ──────────────────────────
  if (step === 0) {
    const slide = INTRO_SLIDES[introSlide]!;
    return (
      <View style={styles.screen}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(1)}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </TouchableOpacity>
        <View style={[styles.slideHero, { backgroundColor: slide.bg }]}>
          <Text style={styles.slideEmoji}>{slide.emoji}</Text>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideDesc}>{slide.desc}</Text>
        </View>
        <View style={styles.slideBottom}>
          <View style={styles.dotRow}>
            {INTRO_SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === introSlide ? [styles.dotActive, { backgroundColor: tc.primary }] : styles.dotInactive]} />
            ))}
          </View>
          {introSlide < INTRO_SLIDES.length - 1 ? (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tc.primary }]} onPress={() => setIntroSlide(s => s + 1)}>
              <Text style={styles.primaryBtnText}>다음</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tc.primary }]} onPress={() => setStep(1)}>
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
          <Text style={[styles.welcomeTitle, { color: tc.accent }]}>{finalName}님, 준비됐어요!</Text>
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

      {/* 진행률 바 + 건너뛰기 */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(step / TOTAL_STEPS) * 100}%` as any, backgroundColor: tc.primary }]} />
          </View>
        </View>
        <Text style={styles.stepCounter}>{step}/{TOTAL_STEPS}</Text>
        {step < TOTAL_STEPS && (
          <TouchableOpacity style={styles.stepSkipBtn} onPress={skip} disabled={saving}>
            <Text style={[styles.stepSkipText, { color: tc.primary }]}>건너뛰기</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* ── STEP 1: 닉네임 ── */}
        {step === 1 && (
          <>
            <Text style={[styles.stepTitle, { color: tc.accent }]}>어떻게 불러드릴까요? 😊</Text>
            <Text style={styles.stepSubtitle}>어떻게 불러드릴까요?</Text>

            {/* 랜덤 닉네임 추천 카드 */}
            <View style={[styles.nickCard, { backgroundColor: tc.primaryLight }]}>
              <Text style={[styles.nickCardName, { color: tc.primary }]}>{suggestedName}</Text>
              <TouchableOpacity
                style={[styles.shuffleBtn, { borderColor: tc.primary }]}
                onPress={() => setSuggestedName(randomName())}
              >
                <Text style={[styles.shuffleBtnText, { color: tc.primary }]}>🔀 다른 이름</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.orLabel}>또는 직접 입력</Text>
            <TextInput
              style={[styles.input, { borderColor: tc.primaryLight }]}
              placeholder={`닉네임 입력 (선택)`}
              placeholderTextColor={COLORS.gray400}
              value={name}
              onChangeText={setName}
              maxLength={12}
            />
            <Text style={styles.nickHint}>
              입력하지 않으면 '{suggestedName}'으로 시작해요
            </Text>
          </>
        )}

        {/* ── STEP 2: 테마 ── */}
        {step === 2 && (
          <>
            <Text style={[styles.stepTitle, { color: tc.accent }]}>나만의 감성을 골라봐요 🎨</Text>
            <Text style={styles.stepSubtitle}>언제든지 설정에서 바꿀 수 있어요</Text>
            <View style={styles.themeRow}>
              {THEME_LIST.map(t => {
                const selected = theme === t.key;
                const ttc = getThemeColors(t.key);
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.themeCard, selected && { borderColor: ttc.primary, backgroundColor: ttc.primaryLight }]}
                    onPress={() => { setTheme(t.key); setStoreTheme(t.key); }}
                  >
                    <View style={[styles.themeSwatch, { backgroundColor: t.color }]}>
                      {selected && <Text style={styles.themeCheck}>✓</Text>}
                    </View>
                    <Text style={[styles.themeName, selected && { color: ttc.primary }]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.themeMoreNote}>✦ 더 많은 테마는 설정에서 만나보세요!</Text>
          </>
        )}

        {/* ── STEP 3: 월수입 ── */}
        {step === 3 && (
          <>
            <Text style={[styles.stepTitle, { color: tc.accent }]}>월 수입을 알려줘요 💰</Text>
            <Text style={styles.stepSubtitle}>세후 실수령 기준이에요. 나중에 바꿀 수 있어요.</Text>
            <Text style={styles.fieldLabel}>월 수입 (세후)</Text>
            <View style={[styles.amountInputBox, { borderColor: tc.primaryLight }]}>
              <TextInput
                style={[styles.amountInput, { color: tc.accent }]}
                placeholder="0"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={fmtManWon(income)}
                onChangeText={v => setIncome(v.replace(/[^0-9]/g, ''))}
                autoFocus
              />
              <Text style={styles.amountUnit}>만 원</Text>
            </View>
            {incomeNum > 0 && (
              <Text style={[styles.helperText, { color: tc.primary }]}>
                월 {incomeNum.toLocaleString()}원으로 설정돼요
              </Text>
            )}
          </>
        )}

        {/* ── STEP 4: 저축목표 ── */}
        {step === 4 && (
          <>
            <Text style={[styles.stepTitle, { color: tc.accent }]}>저축 목표가 있나요? 🎯</Text>
            <Text style={styles.stepSubtitle}>매달 이만큼 저축하는 게 목표예요</Text>
            <Text style={styles.fieldLabel}>월 저축 목표 (선택)</Text>
            <View style={[styles.amountInputBox, { borderColor: tc.primaryLight }]}>
              <TextInput
                style={[styles.amountInput, { color: tc.accent }]}
                placeholder="0"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={fmtManWon(goal)}
                onChangeText={v => setGoal(v.replace(/[^0-9]/g, ''))}
                autoFocus
              />
              <Text style={styles.amountUnit}>만 원</Text>
            </View>
            {incomeNum > 0 && goalNum > 0 && goalNum < incomeNum && (
              <Text style={[styles.helperText, { color: tc.primary }]}>
                💡 입력하면 홈 화면에서 저축 달성률을 볼 수 있어요
              </Text>
            )}
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          </>
        )}

      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.bottomRow}>
        {step > 1 && (
          <TouchableOpacity style={styles.prevBtn} onPress={prev}>
            <Text style={styles.prevBtnText}>← 이전</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 1, backgroundColor: tc.primary }, saving && styles.btnDisabled]}
          onPress={next}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>{step === TOTAL_STEPS ? '시작하기 🎉' : '다음 →'}</Text>
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
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: COLORS.accent, marginBottom: 8, textAlign: 'center' },
  introText: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 22 },
  bottom: { padding: 24, paddingBottom: 48 },

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
  dotActive: { width: 20 },
  dotInactive: { width: 6, backgroundColor: '#e5e7eb' },

  // 단계 헤더
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 56, paddingHorizontal: 4 },
  progressBarBg: { height: 4, backgroundColor: COLORS.gray100, marginLeft: 24 },
  progressBarFill: { height: '100%' as any },
  stepCounter: { fontSize: 11, color: COLORS.gray400, marginLeft: 8, marginRight: 4, fontWeight: '600' },
  stepSkipBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  stepSkipText: { fontSize: 12, fontWeight: '600' },

  body: { padding: 24, paddingTop: 32, paddingBottom: 20, flexGrow: 1, justifyContent: 'center' },
  stepTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  stepSubtitle: { fontSize: 13, color: COLORS.gray400, marginBottom: 28 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.gray500, marginBottom: 8 },

  // 닉네임 카드
  nickCard: { borderRadius: RADIUS.lg, padding: 20, alignItems: 'center', marginBottom: 16 },
  nickCardName: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  shuffleBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#fff' },
  shuffleBtnText: { fontSize: 13, fontWeight: '600' },
  orLabel: { fontSize: 12, color: COLORS.gray400, marginBottom: 8 },
  nickHint: { fontSize: 11, color: COLORS.gray400, marginTop: 6 },

  input: {
    borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.gray800,
    backgroundColor: '#fff',
  },

  // 테마
  themeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  themeCard: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 20,
    borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  themeSwatch: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  themeCheck: { color: '#fff', fontSize: 18, fontWeight: '700' },
  themeName: { fontSize: 13, fontWeight: '700', color: COLORS.gray700 },
  themeMoreNote: { fontSize: 12, color: COLORS.gray400, textAlign: 'center' },

  // 금액 입력
  amountInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
  },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'right' },
  amountUnit: { fontSize: 15, color: COLORS.gray500 },
  helperText: { fontSize: 12, marginTop: 10, fontWeight: '600', lineHeight: 18 },

  // 하단 버튼
  bottomRow: { flexDirection: 'row', gap: 10, padding: 24, paddingBottom: 48 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  prevBtn: { borderRadius: RADIUS.lg, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center', backgroundColor: COLORS.gray100 },
  prevBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  btnDisabled: { opacity: 0.6 },

  errorText: { fontSize: 12, color: '#ef4444', marginTop: 16, textAlign: 'center' },
});
