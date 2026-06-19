import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_SHADOW, useThemeColors } from '@/constants/theme';

const GUIDE_ITEMS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'sparkles-outline',
    title: 'AI 자연어 입력',
    desc: '"스타벅스 육천원 카드"처럼 한 줄로 입력하면 금액, 카테고리, 결제수단이 자동으로 분류돼요.',
  },
  {
    icon: 'home-outline',
    title: '홈 대시보드',
    desc: '저축 목표 진행률, 이번 달 예산 달성률, 최근 지출 내역을 한눈에 확인할 수 있어요.',
  },
  {
    icon: 'pricetags-outline',
    title: '카테고리 관리',
    desc: '기본 카테고리 외에 나만의 카테고리를 추가하거나 숨길 수 있어요.',
  },
  {
    icon: 'wallet-outline',
    title: '예산 관리',
    desc: '카테고리별로 월 예산을 설정하고, AI 추천 예산을 받아볼 수 있어요.',
  },
  {
    icon: 'repeat-outline',
    title: '고정비 관리',
    desc: '매달 반복되는 고정 지출과 고정 저축을 등록하고 납부 여부를 관리할 수 있어요.',
  },
  {
    icon: 'bar-chart-outline',
    title: '월간 리포트',
    desc: '한 달 동안의 소비 패턴을 분석한 리포트와 AI 코치 피드백을 받아볼 수 있어요.',
  },
  {
    icon: 'color-palette-outline',
    title: '테마 설정',
    desc: '설정 탭에서 앱 전체의 색상 테마를 내 취향에 맞게 바꿀 수 있어요.',
  },
];

export default function AppGuideScreen() {
  const router = useRouter();
  const { themeColors } = useThemeColors();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>앱 가이드</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: themeColors.accent }]}>
          Spenlog의 주요 기능을 소개해요
        </Text>

        {GUIDE_ITEMS.map((item) => (
          <View key={item.title} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: themeColors.primaryLight }]}>
              <Ionicons name={item.icon} size={20} color={themeColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
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

  intro: { fontSize: 14, fontWeight: '700', marginBottom: 16 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 10, ...CARD_SHADOW,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray800, marginBottom: 4 },
  itemDesc: { fontSize: 12, lineHeight: 18, color: COLORS.gray600 },
});
