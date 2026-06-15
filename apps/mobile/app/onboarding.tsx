import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, formatCurrency } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { completeOnboarding } from '@/lib/api/settings';

const THEME_LIST = [
  { key: 'Burgundy', name: '버건디', color: '#6B1E2E' },
  { key: 'Sage', name: '세이지', color: '#7C9070' },
];

const DEFAULT_CATS = ['생활비', '고정비', '활동비', '수입'];

const TOTAL_STEPS = 6; // 이름 / 테마 / 수입 / 목표 / 예산 / 카테고리

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = 인트로, 1~TOTAL_STEPS = 진행 단계, TOTAL_STEPS+1 = 완료

  const [name, setName] = useState('');
  const [theme, setTheme] = useState('Burgundy');
  const [income, setIncome] = useState('');
  const [goal, setGoal] = useState('');
  const [budget, setBudget] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);

  const incomeNum = parseInt(income || '0') || 0;
  const goalNum = parseInt(goal || '0') || 0;

  async function next() {
    if (step === TOTAL_STEPS) {
      try {
        const uid = await getCurrentUserId();
        if (uid) await completeOnboarding(uid);
      } catch (e) {
        console.log('[onboarding] completeOnboarding error:', e);
      }
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS + 1));
  }
  function prev() {
    setStep(s => Math.max(s - 1, 0));
  }
  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

  // 인트로
  if (step === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.logo}>Spenlog</Text>
          <Text style={styles.introText}>몇 가지만 알려주시면{'\n'}나만의 가계부를 만들어드릴게요</Text>
        </View>
        <View style={styles.bottom}>
          <TouchableOpacity style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>시작하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 완료
  if (step === TOTAL_STEPS + 1) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.welcomeEmoji}>🎉</Text>
          <Text style={styles.welcomeTitle}>{name || '소비요정'}님, 준비됐어요!</Text>
          <Text style={styles.introText}>이제 Spenlog와 함께{'\n'}천천히, 꾸준히 시작해봐요</Text>
        </View>
        <View style={styles.bottom}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.primaryBtnText}>홈으로 가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={{ flex: 1 }}>
      {/* 진행률 바 */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <View style={styles.body}>
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
                  style={[styles.themeCard, theme === t.key && styles.themeCardSelected]}
                  onPress={() => setTheme(t.key)}
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
                value={income ? Number(income).toLocaleString() : ''}
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
                value={goal ? Number(goal).toLocaleString() : ''}
                onChangeText={v => setGoal(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
            {incomeNum > 0 && goalNum > 0 && (
              <Text style={styles.helperText}>
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
                value={budget ? Number(budget).toLocaleString() : ''}
                onChangeText={v => setBudget(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
            {incomeNum > 0 && (
              <Text style={styles.helperText}>
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
                    style={[styles.catChip, selected && styles.catChipSelected]}
                    onPress={() => toggleCategory(cat)}
                  >
                    <Text style={[styles.catChipText, selected && styles.catChipTextSelected]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={prev}>
          <Text style={styles.secondaryBtnText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={next}>
          <Text style={styles.primaryBtnText}>{step === TOTAL_STEPS ? '완료' : '다음'}</Text>
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
  logo: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginBottom: 16 },
  introText: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 22 },
  welcomeEmoji: { fontSize: 48, marginBottom: 12 },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: COLORS.accent, marginBottom: 8, textAlign: 'center' },

  bottom: { padding: 24, paddingBottom: 48 },
  bottomRow: { flexDirection: 'row', gap: 10, padding: 24, paddingBottom: 48 },

  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  secondaryBtn: { borderRadius: RADIUS.lg, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', backgroundColor: COLORS.gray100 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray500 },

  progressBarBg: { height: 4, backgroundColor: COLORS.gray100, marginTop: 56 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary },

  body: { flex: 1, padding: 24, paddingTop: 40 },
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
});
