import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_SHADOW, useThemeColors } from '@/constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const { themeColors } = useThemeColors();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보처리방침</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={[styles.updatedAt, { color: themeColors.primary }]}>최종 수정일: 2026.06.15</Text>

          <Text style={styles.sectionTitle}>1. 수집하는 개인정보 항목</Text>
          <Text style={styles.body}>
            회사는 회원가입 및 서비스 이용을 위해 이메일, 닉네임, 비밀번호를 수집하며,
            서비스 이용 과정에서 지출 내역, 예산, 카테고리 등의 정보가 생성됩니다.
          </Text>

          <Text style={styles.sectionTitle}>2. 개인정보의 수집 및 이용목적</Text>
          <Text style={styles.body}>
            수집된 정보는 회원 식별 및 서비스 제공, AI 기반 지출 분석, 맞춤형 예산 추천,
            서비스 개선 및 고객 문의 대응을 위한 목적으로 사용됩니다.
          </Text>

          <Text style={styles.sectionTitle}>3. 개인정보의 보유 및 이용기간</Text>
          <Text style={styles.body}>
            회원 탈퇴 시 관련 법령에서 정한 기간을 제외하고 지체 없이 파기합니다.
            단, 부정 이용 방지를 위해 일부 정보는 별도 보관될 수 있습니다.
          </Text>

          <Text style={styles.sectionTitle}>4. 개인정보의 제3자 제공</Text>
          <Text style={styles.body}>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않으며,
            법령에 근거하거나 이용자가 사전에 동의한 경우에 한하여 제공할 수 있습니다.
          </Text>

          <Text style={styles.sectionTitle}>5. 이용자의 권리</Text>
          <Text style={styles.body}>
            이용자는 언제든지 자신의 개인정보를 조회, 수정할 수 있으며,
            회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.
          </Text>

          <Text style={styles.sectionTitle}>6. 개인정보 보호책임자</Text>
          <Text style={styles.body}>
            개인정보 관련 문의는 서비스 내 고객센터 또는 등록된 이메일을 통해 접수받습니다.
          </Text>

          <Text style={styles.placeholderNote}>
            ※ 본 개인정보처리방침은 앱 출시 전 최종 확정됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 8, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800 },
  content: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, ...CARD_SHADOW,
  },
  updatedAt: { fontSize: 11, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray800, marginTop: 16, marginBottom: 6 },
  body: { fontSize: 12, lineHeight: 20, color: COLORS.gray600 },
  placeholderNote: { fontSize: 11, color: COLORS.gray400, marginTop: 24, textAlign: 'center' },
});
