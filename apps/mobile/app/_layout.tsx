import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { getCurrentUserId } from '@/lib/supabase';
import { initRevenueCat } from '@/lib/revenuecat';
import { AppThemeProvider } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { registerForPushNotifications, savePushToken } from '@/lib/notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    loadTheme();
    (async () => {
      const uid = await getCurrentUserId();
      initRevenueCat(uid ?? undefined);

      if (uid) {
        const token = await registerForPushNotifications();
        if (token) await savePushToken(uid, token);
      }
    })();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] 알림 수신:', notification.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Push] 알림 탭:', response.notification.request.content.title);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [loadTheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AppThemeProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="category" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="app-guide" options={{ headerShown: false }} />
        <Stack.Screen name="premium" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
