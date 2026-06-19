import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/store/themeStore';

let WebBrowser: any = null;
let AuthSession: any = null;
let QueryParams: any = null;

try {
  WebBrowser = require('expo-web-browser');
  AuthSession = require('expo-auth-session');
  QueryParams = require('expo-auth-session/build/QueryParams');
  WebBrowser?.maybeCompleteAuthSession();
} catch {
  // expo-web-browser / expo-auth-session 미설치 - 구글 로그인 비활성화
}

// Expo Go: exp://IP:port/--/ 반환 (spenlog:// 아님)
// 개발 빌드(expo run:ios/android): spenlog:// 반환
const redirectTo = AuthSession?.makeRedirectUri({ scheme: 'spenlog' });
console.log('[Google OAuth] redirectTo:', redirectTo);

async function createSessionFromUrl(url: string) {
  if (!QueryParams) return null;
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

export default function LoginScreen() {
  const router = useRouter();
  const setStoreTheme = useThemeStore(s => s.setTheme);
  const setIsGuest = useThemeStore(s => s.setIsGuest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleLogin() {
    if (!WebBrowser || !AuthSession) {
      Alert.alert('구글 로그인을 위해 앱을 업데이트해 주세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error('로그인 URL을 가져오지 못했어요');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const session = await createSessionFromUrl(result.url);
        if (session) {
          router.replace('/(tabs)');
          return;
        }
        throw new Error('세션 정보를 가져오지 못했어요');
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // 사용자가 로그인 취소
      } else {
        throw new Error('구글 로그인에 실패했어요');
      }
    } catch (e: any) {
      setError(e?.message ?? '구글 로그인 중 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <Text style={styles.logo}>Spenlog</Text>
        <Text style={styles.tagline}>천천히, 꾸준히</Text>
        <Text style={styles.tagline}>나만의 가계부</Text>
      </View>

      <View style={styles.bottom}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.gray500} />
          ) : (
            <>
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Google로 계속하기</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={async () => {
            // 이전 세션 완전 초기화 후 게스트로 진입
            await supabase.auth.signOut();
            setStoreTheme('Burgundy');
            setIsGuest(true);
            router.replace('/onboarding');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.guestBtnText}>게스트로 둘러보기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginBottom: 12 },
  tagline: { fontSize: 14, color: COLORS.gray500, lineHeight: 22 },

  bottom: { padding: 24, paddingBottom: 48, gap: 14 },
  errorText: { fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 4 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingVertical: 14, minHeight: 48,
  },
  googleIcon: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { fontSize: 12, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.gray400 },

  guestBtn: { alignItems: 'center', paddingVertical: 12 },
  guestBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500, textDecorationLine: 'underline' },
});
