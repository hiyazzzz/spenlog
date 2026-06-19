import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, useAppTheme, useThemeColors } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { checkOnboardingStatus } from '@/lib/api/settings';
import { useThemeStore } from '@/store/themeStore';

export default function TabLayout() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const { themeColors: tc } = useThemeColors();
  const setStoreTheme = useThemeStore(s => s.setTheme);
  const setIsGuest = useThemeStore(s => s.setIsGuest);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) {
        // 게스트 모드: 온보딩 완료 여부 확인
        setStoreTheme('Burgundy');
        const guestDone = await AsyncStorage.getItem('guest_onboarding_completed');
        if (!active) return;
        if (!guestDone) {
          router.replace('/onboarding');
          return;
        }
        setReady(true);
        return;
      }
      // 실제 로그인 유저 — 게스트 플래그 해제
      setIsGuest(false);
      const completed = await checkOnboardingStatus(uid);
      if (!active) return;
      if (!completed) {
        router.replace('/onboarding');
        return;
      }
      setReady(true);
    })();
    return () => { active = false; };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: tc.primary,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      tabBarInactiveTintColor: colors.gray400,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '내역',
          tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: '자산',
          tabBarIcon: ({ color }) => <Ionicons name="wallet" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: '리포트',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="fixed-costs"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="budget"
        options={{ href: null }}
      />
    </Tabs>
  );
}
