// react-native-purchases는 개발 빌드(dev build)에서만 사용 가능한 네이티브 모듈.
// Expo Go 환경에서는 stub으로 대체 — 키가 설정되면 dev build로 전환 후 실제 모듈 연결.
// TODO: npx expo install react-native-purchases 후 아래 stub 제거하고 원래 import 복원

export type PurchasesOfferings = unknown
export type PurchasesPackage = unknown
export type CustomerInfo = unknown

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? ''
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? ''

export function initRevenueCat(userId?: string) {
  if (!IOS_KEY && !ANDROID_KEY) return
  // 키가 설정된 경우에만 RevenueCat 초기화 (dev build 필요)
  console.warn('[RevenueCat] 네이티브 모듈 미설치 — dev build에서 react-native-purchases 연결 필요')
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  return null
}

export async function purchasePremium(packageToPurchase: PurchasesPackage): Promise<CustomerInfo> {
  throw new Error('RevenueCat 미설치 — dev build 필요')
}

export async function restorePurchases(): Promise<CustomerInfo> {
  throw new Error('RevenueCat 미설치 — dev build 필요')
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  return null
}
