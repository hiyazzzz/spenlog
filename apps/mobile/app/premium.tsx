import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, CARD_SHADOW, getThemeColors } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { getProfile } from '@/lib/api/settings';
import { getOfferings, purchasePremium, restorePurchases } from '@/lib/revenuecat';
import type { PurchasesPackage } from 'react-native-purchases';

export default function PremiumScreen() {
  const router = useRouter();
  const [themeColors, setThemeColors] = useState(getThemeColors(undefined));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const profile = await getProfile(userId);
        setThemeColors(getThemeColors(profile?.theme));
      }

      const offerings = await getOfferings();
      const current = offerings?.current;
      if (!current) {
        setError('상품 정보를 불러오지 못했어요');
        setPackages([]);
        return;
      }
      setPackages(current.availablePackages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handlePurchase(pkg: PurchasesPackage) {
    if (purchasingId) return;
    setPurchasingId(pkg.identifier);
    try {
      await purchasePremium(pkg);
      Alert.alert('구매 완료', '프리미엄 구독이 적용됐어요');
      router.back();
    } catch (e: any) {
      if (e?.userCancelled) return;
      Alert.alert('구매 실패', e?.message ?? '결제 중 문제가 발생했어요');
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    try {
      await restorePurchases();
      Alert.alert('복원 완료', '구매 내역을 복원했어요');
      router.back();
    } catch (e: any) {
      Alert.alert('복원 실패', e?.message ?? '구매 복원 중 문제가 발생했어요');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>프리미엄 업그레이드</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.heroCard, { backgroundColor: themeColors.primaryLight }]}>
        <Text style={[styles.heroTitle, { color: themeColors.accent }]}>✨ Spenlog 프리미엄</Text>
        <Text style={styles.heroDesc}>프리미엄 테마, CSV 내보내기, AI 리포트 코치 등{'\n'}모든 기능을 제한 없이 이용해보세요</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : packages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>이용 가능한 상품이 없어요</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {packages.map(pkg => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[styles.planCard, { borderColor: themeColors.primary }]}
              onPress={() => handlePurchase(pkg)}
              disabled={!!purchasingId}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{pkg.product.title || pkg.identifier}</Text>
                {!!pkg.product.description && <Text style={styles.planDesc}>{pkg.product.description}</Text>}
              </View>
              {purchasingId === pkg.identifier ? (
                <ActivityIndicator color={themeColors.primary} />
              ) : (
                <Text style={[styles.planPrice, { color: themeColors.primary }]}>{pkg.product.priceString}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
        {restoring ? (
          <ActivityIndicator size="small" color={COLORS.gray500} />
        ) : (
          <Text style={styles.restoreBtnText}>구매 복원</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800 },

  heroCard: { borderRadius: RADIUS.xl, padding: 20, marginBottom: 20 },
  heroTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  heroDesc: { fontSize: 13, color: COLORS.gray600, lineHeight: 20 },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  errorText: { fontSize: 13, color: COLORS.gray500 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.gray100 },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray700 },

  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: RADIUS.lg, borderWidth: 1.5,
    padding: 16, ...CARD_SHADOW,
  },
  planTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  planDesc: { fontSize: 12, color: COLORS.gray400, marginTop: 4 },
  planPrice: { fontSize: 15, fontWeight: '800' },

  restoreBtn: { alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingVertical: 12 },
  restoreBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
});
