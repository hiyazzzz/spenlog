
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, useAppTheme, useThemeColors } from '@/constants/theme';
import { getCurrentUserId } from '@/lib/supabase';
import { checkOnboardingStatus } from '@/lib/api/settings';
import { useThemeStore } from '@/store/themeStore';

const HIDDEN_ROUTES = new Set(['analytics', 'fixed-costs', 'budget']);

interface TabBarProps {
  state: {
    routes: Array<{ key: string; name: string }>;
    index: number;
  };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: { navigate: (name: string) => void };
}

function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { themeColors: tc } = useThemeColors();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter(r => !HIDDEN_ROUTES.has(r.name));

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingBottom: insets.bottom,
      height: 52 + insets.bottom,
    }}>
      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.routes[state.index]?.key === route.key;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}
            onPress={() => {
              if (!isFocused) navigation.navigate(route.name);
            }}
            activeOpacity={0.7}
          >
            <View style={{
              width: '60%',
              height: 3,
              backgroundColor: isFocused ? tc.primary : 'transparent',
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
              marginBottom: 8,
            }} />
            <Text style={{
              fontSize: 12,
              fontWeight: isFocused ? '700' : '500',
              color: isFocused ? tc.primary : colors.gray400,
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const setStoreTheme = useThemeStore(s => s.setTheme);
  const setIsGuest = useThemeStore(s => s.setIsGuest);

  useEffect(() => {
    let active = true;
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) {
        const { isGuest: isGuestMode } = useThemeStore.getState();
        if (isGuestMode) {
          const guestDone = await AsyncStorage.getItem('guest_onboarding_completed');
          if (!active) return;
          if (!guestDone) { router.replace('/onboarding'); return; }
          const guestTheme = await AsyncStorage.getItem('guest_theme');
          if (guestTheme && active) setStoreTheme(guestTheme);
        }
        if (!active) return;
        setReady(true);
        return;
      }
      setIsGuest(false);
      const completed = await checkOnboardingStatus(uid);
      if (!active) return;
      if (!completed) { router.replace('/onboarding'); return; }
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
    <Tabs
      tabBar={(props: any) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="history" options={{ title: '내역' }} />
      <Tabs.Screen name="assets" options={{ title: '자산' }} />
      <Tabs.Screen name="report" options={{ title: '리포트' }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
      <Tabs.Screen name="fixed-costs" options={{ href: null }} />
      <Tabs.Screen name="budget" options={{ href: null }} />
    </Tabs>
  );
}