// TODO: react-native-purchases 패키지 설치 필요 — npx expo install react-native-purchases
// 설치 전까지는 apps/mobile/types/react-native-purchases.d.ts 의 임시 타입 선언을 사용함
import Purchases, { LOG_LEVEL, type PurchasesPackage, type PurchasesOfferings, type CustomerInfo } from 'react-native-purchases'
import { Platform } from 'react-native'

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? ''
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? ''

export function initRevenueCat(userId?: string) {
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY
  if (!apiKey) return
  Purchases.setLogLevel(LOG_LEVEL.ERROR)
  Purchases.configure({ apiKey, appUserID: userId ?? null })
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    return await Purchases.getOfferings()
  } catch {
    return null
  }
}

export async function purchasePremium(packageToPurchase: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(packageToPurchase)
  return customerInfo
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return await Purchases.restorePurchases()
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo()
  } catch {
    return null
  }
}
