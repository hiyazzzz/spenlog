import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_SHADOW, useThemeColors } from '@/constants/theme';

export default function TermsScreen() {
  const router = useRouter();
  const { themeColors } = useThemeColors();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={[styles.updatedAt, { color: themeColors.primary }]}>최종 수정일: 2026.06.15</Text>

          <Text style={styles.sectionTitle}>제1조 (목적)</Text>
          <Text style={styles.body}>
            이 약관은 Spenlog(이하 "회사")가 제공하는 가계부 서비스(이하 "서비스")의 이용과 관련하여
            회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
          </Text>

          <Text style={styles.sectionTitle}>제2조 (정의)</Text>
          <Text style={styles.body}>
            "이용자"란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.
            "콘텐츠"란 이용자가 서비스를 이용하면서 생성한 지출 내역, 카테고리, 설정 등 모든 정보를 말합니다.
          </Text>

          <Text style={styles.sectionTitle}>제3조 (약관의 효력 및 변경)</Text>
          <Text style={styles.body}>
            본 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력을 발생합니다.
            회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있습니다.
          </Text>

          <Text style={styles.sectionTitle}>제4조 (서비스의 제공 및 변경)</Text>
          <Text style={styles.body}>
            회사는 자연어 입력 기반 지출 기록, 예산 관리, 리포트 등의 기능을 제공하며,
            서비스의 내용은 운영상 또는 기술상의 필요에 따라 변경될 수 있습니다.
          </Text>

          <Text style={styles.sectionTitle}>제5조 (이용자의 의무)</Text>
          <Text style={styles.body}>
            이용자는 서비스 이용 시 관계 법령과 본 약관의 규정을 준수해야 하며,
            타인의 정보를 도용하거나 서비스를 부정한 목적으로 사용해서는 안 됩니다.
          </Text>

          <Text style={styles.sectionTitle}>제6조 (면책조항)</Text>
          <Text style={styles.body}>
            회사는 이용자가 입력한 정보의 정확성에 대해 보증하지 않으며,
            서비스 내 AI 분석 결과는 참고용으로만 제공됩니다.
          </Text>

          <Text style={styles.placeholderNote}>
            ※ 본 약관은 앱 출시 전 최종 확정됩니다.
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
