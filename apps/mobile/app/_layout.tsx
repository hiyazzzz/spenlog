import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { getCurrentUserId } from '@/lib/supabase';
import { initRevenueCat } from '@/lib/revenuecat';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      const uid = await getCurrentUserId();
      initRevenueCat(uid ?? undefined);
    })();
  }, []);

  return (
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
  );
}
