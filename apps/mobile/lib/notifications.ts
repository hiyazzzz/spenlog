import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] 실제 기기에서만 푸시 토큰을 등록할 수 있어요 (시뮬레이터 제외)')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] 알림 권한이 거부됐어요')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6B1E2E',
    })
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    return token.data
  } catch (e) {
    console.warn('[Push] Expo Push Token 획득 실패 (projectId 미설정일 수 있어요):', e)
    return null
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  const deviceInfo = [Device.brand, Device.modelName, `(${Platform.OS})`]
    .filter(Boolean)
    .join(' ')

  await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: token,
      p256dh: 'expo',
      auth: 'expo',
      device_info: deviceInfo,
    },
    { onConflict: 'endpoint' }
  )
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: trigger ?? null,
  })
}
