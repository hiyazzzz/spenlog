import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
// TODO: expo-sharing 패키지 설치 필요 (npm install expo-sharing) — 설치 후 아래 주석 해제
// import * as Sharing from 'expo-sharing';
import { COLORS, RADIUS, CARD_SHADOW, getThemeColors } from '@/constants/theme';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { getProfile, updateTheme, updateName, updatePushSettings, type PushSettings } from '@/lib/api/settings';
import { isPremiumUnlocked } from '@/lib/premium';
import type { Theme, User } from '@spenlog/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spenlog.vercel.app';

const BASIC_THEMES = [
  { key: 'Burgundy', name: '버건디', color: '#6B1E2E' },
  { key: 'Sage', name: '세이지', color: '#7C9070' },
];

const PREMIUM_THEMES = [
  { key: 'Lavender', name: '라벤더', color: '#8E7CC3' },
  { key: 'Terracotta', name: '테라코타', color: '#C56C4E' },
  { key: 'Oatmeal', name: '오트밀', color: '#B5A48C' },
  { key: 'WarmGray', name: '웜그레이', color: '#8C8479' },
  { key: 'Midnight', name: '미드나잇', color: '#2E3A59' },
  { key: 'Indigo', name: '인디고', color: '#4B5DA6' },
];

function Section({
  title, defaultOpen = false, children,
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={[styles.sectionChevron, open && { transform: [{ rotate: '180deg' }] }]}>▼</Text>
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function ToggleSwitch({
  label, sublabel, value, onValueChange, themeColors,
}: {
  label: string; sublabel?: string; value: boolean; onValueChange: (v: boolean) => void;
  themeColors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sublabel && <Text style={styles.toggleSublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.gray300, true: themeColors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<Theme>('Burgundy');
  const [darkMode, setDarkMode] = useState(false);
  const [gifAutoplay, setGifAutoplay] = useState(true);
  const [pushExpense, setPushExpense] = useState(true);
  const [pushDueDate, setPushDueDate] = useState(true);
  const [pushUnprocessed, setPushUnprocessed] = useState(true);
  const [pushReport, setPushReport] = useState(true);

  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const result = await getProfile(userId);
      setProfile(result);
      if (result?.theme) setSelectedTheme(result.theme);
      if (result) {
        setPushExpense(result.push_expense_reminder ?? true);
        setPushDueDate(result.push_due_date_reminder ?? true);
        setPushUnprocessed(result.push_due_date_unprocessed ?? true);
        setPushReport(result.push_report ?? true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSelectTheme(theme: Theme) {
    setSelectedTheme(theme);
    const userId = await getCurrentUserId();
    if (!userId) return;
    await updateTheme(userId, theme);
  }

  function openNicknameModal() {
    setNicknameInput(profile?.name ?? '');
    setNicknameModalOpen(true);
  }

  async function handleSaveNickname() {
    const name = nicknameInput.trim();
    if (!name) return;
    const userId = await getCurrentUserId();
    if (!userId) return;
    setSavingNickname(true);
    try {
      await updateName(userId, name);
      setProfile(p => p ? { ...p, name } : p);
      setNicknameModalOpen(false);
    } finally {
      setSavingNickname(false);
    }
  }

  async function handleSavePassword() {
    if (newPassword.length < 6) { setPasswordError('비밀번호는 6자 이상이어야 해요'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('비밀번호가 일치하지 않아요'); return; }
    setPasswordError('');
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPasswordError(error.message); return; }
      setPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('변경 완료', '비밀번호가 변경됐어요');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  async function handlePushToggle(key: keyof PushSettings, value: boolean, setter: (v: boolean) => void) {
    setter(value);
    const userId = await getCurrentUserId();
    if (!userId) return;
    await updatePushSettings(userId, { [key]: value });
  }

  function notReady() {
    Alert.alert('준비 중', '아직 준비 중인 기능이에요');
  }

  async function handleCsvExport() {
    if (!isPremiumUnlocked(profile)) {
      Alert.alert('프리미엄 기능', 'CSV 내보내기는 프리미엄 전용 기능이에요');
      return;
    }
    if (csvLoading) return;
    setCsvLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/export/csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'NO_DATA') {
          Alert.alert('내보내기 실패', '해당 기간에 내역이 없어요');
        } else {
          Alert.alert('내보내기 실패', data.error ?? '알 수 없는 오류가 발생했어요');
        }
        return;
      }
      const csv = await res.text();
      const now = new Date();
      const fileName = `spenlog_export_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`;
      const file = new File(Paths.document, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(csv);

      // TODO: expo-sharing 설치 후 공유 시트 노출
      // if (await Sharing.isAvailableAsync()) {
      //   await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'CSV 내보내기' });
      // } else {
      //   Alert.alert('내보내기 완료', `${fileName} 파일이 저장됐어요`);
      // }
      Alert.alert('내보내기 완료', `${fileName} 파일이 저장됐어요`);
    } catch {
      Alert.alert('오류', '내보내기 중 문제가 발생했어요');
    } finally {
      setCsvLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const themeColors = getThemeColors(profile?.theme);
  const isPremium = isPremiumUnlocked(profile);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: themeColors.accent }]}>설정</Text>

      {/* 프로필 카드 */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: themeColors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: themeColors.primary }]}>{(profile?.name || '소비요정').slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{profile?.name || '소비요정'}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? ''}</Text>
        </View>
        <TouchableOpacity style={[styles.premiumBtn, { backgroundColor: themeColors.accent }]} onPress={notReady}>
          <Text style={styles.premiumBtnText}>{isPremium ? '✨ 프리미엄 이용중' : '✨ 프리미엄'}</Text>
        </TouchableOpacity>
      </View>

      {/* 계정 */}
      <Section title="계정" defaultOpen>
        <TouchableOpacity style={styles.itemRow} onPress={openNicknameModal}>
          <Text style={styles.itemLabel}>닉네임 변경</Text>
          <Text style={styles.itemValue}>{profile?.name || '소비요정'} ›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemRow} onPress={() => setPasswordModalOpen(true)}>
          <Text style={styles.itemLabel}>비밀번호 변경</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemRow} onPress={notReady}>
          <Text style={styles.itemLabel}>구글 계정 연동</Text>
          <Text style={styles.itemValueMuted}>연동 안됨 ›</Text>
        </TouchableOpacity>
      </Section>

      {/* 카테고리 관리 */}
      <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/category')}>
        <Text style={styles.linkRowTitle}>카테고리 관리</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* 테마 */}
      <Section title="테마">
        <Text style={styles.subHeader}>기본 테마</Text>
        <View style={styles.themeGrid}>
          {BASIC_THEMES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.themeItem, selectedTheme === t.key && { borderColor: themeColors.primary, backgroundColor: themeColors.primaryLight }]}
              onPress={() => handleSelectTheme(t.key as Theme)}
            >
              <View style={[styles.themeSwatch, { backgroundColor: t.color }]} />
              <Text style={styles.themeName}>{t.name}</Text>
              {selectedTheme === t.key && <Ionicons name="checkmark-circle" size={16} color={themeColors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.subHeader, { marginTop: 12 }]}>프리미엄 테마</Text>
        <View style={styles.themeGrid}>
          {PREMIUM_THEMES.map(t => (
            isPremium ? (
              <TouchableOpacity
                key={t.key}
                style={[styles.themeItem, selectedTheme === t.key && { borderColor: themeColors.primary, backgroundColor: themeColors.primaryLight }]}
                onPress={() => handleSelectTheme(t.key as Theme)}
              >
                <View style={[styles.themeSwatch, { backgroundColor: t.color }]} />
                <Text style={styles.themeName}>{t.name}</Text>
                {selectedTheme === t.key && <Ionicons name="checkmark-circle" size={16} color={themeColors.primary} />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={t.key} style={[styles.themeItem, styles.themeItemLocked]} onPress={notReady}>
                <View style={[styles.themeSwatch, { backgroundColor: t.color, opacity: 0.5 }]} />
                <Text style={styles.themeNameLocked}>{t.name}</Text>
                <Ionicons name="lock-closed" size={13} color={COLORS.gray400} />
              </TouchableOpacity>
            )
          ))}
        </View>
      </Section>

      {/* 알림 */}
      <Section title="알림">
        <ToggleSwitch label="지출 기록 리마인더" sublabel="저녁에 오늘 지출을 기록했는지 알려줘요" value={pushExpense} onValueChange={(v) => handlePushToggle('push_expense_reminder', v, setPushExpense)} themeColors={themeColors} />
        <ToggleSwitch label="납부일 알림" sublabel="고정비 납부일이 다가오면 알려줘요" value={pushDueDate} onValueChange={(v) => handlePushToggle('push_due_date_reminder', v, setPushDueDate)} themeColors={themeColors} />
        <ToggleSwitch label="미처리 납부 알림" sublabel="납부일이 지났는데 처리되지 않은 항목을 알려줘요" value={pushUnprocessed} onValueChange={(v) => handlePushToggle('push_due_date_unprocessed', v, setPushUnprocessed)} themeColors={themeColors} />
        <ToggleSwitch label="월간 리포트 알림" sublabel="매월 소비 리포트가 준비되면 알려줘요" value={pushReport} onValueChange={(v) => handlePushToggle('push_report', v, setPushReport)} themeColors={themeColors} />
      </Section>

      {/* 화면 표시 */}
      <Section title="화면 표시">
        <ToggleSwitch label="다크 모드" value={darkMode} onValueChange={setDarkMode} themeColors={themeColors} />
        <ToggleSwitch label="GIF 자동 재생" sublabel="홈 화면 캐릭터 GIF를 자동으로 재생해요" value={gifAutoplay} onValueChange={setGifAutoplay} themeColors={themeColors} />
      </Section>

      {/* 내보내기 */}
      <Section title="데이터 내보내기">
        <TouchableOpacity style={styles.exportBtn} onPress={handleCsvExport} disabled={csvLoading}>
          {csvLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="download-outline" size={16} color={COLORS.primary} />
          )}
          <Text style={styles.exportBtnText}>{isPremium ? 'CSV로 내보내기' : 'CSV로 내보내기 (프리미엄)'}</Text>
        </TouchableOpacity>
      </Section>

      {/* 앱 정보 */}
      <Section title="앱 정보">
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>버전</Text>
          <Text style={styles.itemValueMuted}>1.0.0</Text>
        </View>
        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/terms')}>
          <Text style={styles.itemLabel}>이용약관</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/privacy')}>
          <Text style={styles.itemLabel}>개인정보처리방침</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/app-guide')}>
          <Text style={styles.itemLabel}>앱 가이드 다시보기</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Section>

      {/* 계정 관리 */}
      <View style={[styles.card, { marginTop: 4 }]}>
        <TouchableOpacity style={styles.itemRow} onPress={handleLogout}>
          <Text style={styles.itemLabel}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.itemRow, { borderBottomWidth: 0 }]} onPress={notReady}>
          <Text style={styles.dangerLabel}>회원 탈퇴</Text>
        </TouchableOpacity>
      </View>

      {/* 닉네임 변경 모달 */}
      <Modal visible={nicknameModalOpen} transparent animationType="slide" onRequestClose={() => setNicknameModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>닉네임 변경</Text>
            <TextInput
              style={styles.modalInput}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="닉네임"
              placeholderTextColor={COLORS.gray400}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveNickname} disabled={savingNickname || !nicknameInput.trim()}>
                <Text style={styles.modalConfirmBtnText}>{savingNickname ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNicknameModalOpen(false)}>
                <Text style={styles.modalCancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <Modal visible={passwordModalOpen} transparent animationType="slide" onRequestClose={() => setPasswordModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>비밀번호 변경</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="새 비밀번호"
              placeholderTextColor={COLORS.gray400}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginTop: 8 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호 확인"
              placeholderTextColor={COLORS.gray400}
              secureTextEntry
            />
            {!!passwordError && <Text style={styles.modalErrorText}>{passwordError}</Text>}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSavePassword} disabled={savingPassword || !newPassword || !confirmPassword}>
                <Text style={styles.modalConfirmBtnText}>{savingPassword ? '변경 중...' : '변경'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setPasswordModalOpen(false); setPasswordError(''); setNewPassword(''); setConfirmPassword(''); }}>
                <Text style={styles.modalCancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  pageTitle: { fontSize: 18, fontWeight: '600', color: COLORS.accent, marginBottom: 16 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#f3f4f6',
    padding: 16, marginBottom: 12, ...CARD_SHADOW,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  profileName: { fontSize: 15, fontWeight: '700', color: COLORS.gray800 },
  profileEmail: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  premiumBtn: { backgroundColor: COLORS.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  premiumBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: 6, marginBottom: 10 },

  section: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 10, overflow: 'hidden',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  sectionChevron: { fontSize: 14, color: COLORS.gray400 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 14 },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10,
  },
  linkRowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  chevron: { fontSize: 16, color: COLORS.gray400 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray50,
  },
  itemLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray800 },
  itemValue: { fontSize: 12, color: COLORS.gray500 },
  itemValueMuted: { fontSize: 12, color: COLORS.gray400 },
  dangerLabel: { fontSize: 13, fontWeight: '600', color: COLORS.red },

  subHeader: { fontSize: 11, fontWeight: '700', color: COLORS.gray400, marginBottom: 8 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fafafa',
    width: '47%',
  },
  themeItemSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  themeItemLocked: { opacity: 0.7 },
  themeSwatch: { width: 16, height: 16, borderRadius: 8 },
  themeName: { fontSize: 12, fontWeight: '600', color: COLORS.gray700, flex: 1 },
  themeNameLocked: { fontSize: 12, fontWeight: '600', color: COLORS.gray400, flex: 1 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray50 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray800 },
  toggleSublabel: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight,
  },
  exportBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray800, marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.gray800,
  },
  modalErrorText: { fontSize: 12, color: COLORS.red, marginTop: 8 },
  modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalConfirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.gray100, alignItems: 'center' },
  modalCancelBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.gray600 },
});
