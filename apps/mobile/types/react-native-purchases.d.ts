// TODO: react-native-purchases 패키지 설치 후 이 파일 삭제
// 설치 명령: npx expo install react-native-purchases
declare module 'react-native-purchases' {
  export enum LOG_LEVEL {
    VERBOSE = 'VERBOSE',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
  }

  export interface PurchasesStoreProduct {
    identifier: string
    title: string
    description: string
    priceString: string
    price: number
    currencyCode: string
  }

  export interface PurchasesPackage {
    identifier: string
    packageType: string
    product: PurchasesStoreProduct
    offeringIdentifier: string
  }

  export interface PurchasesOffering {
    identifier: string
    serverDescription: string
    availablePackages: PurchasesPackage[]
    monthly: PurchasesPackage | null
    annual: PurchasesPackage | null
  }

  export interface PurchasesOfferings {
    current: PurchasesOffering | null
    all: Record<string, PurchasesOffering>
  }

  export interface CustomerInfo {
    entitlements: {
      active: Record<string, unknown>
      all: Record<string, unknown>
    }
    activeSubscriptions: string[]
  }

  export interface PurchasesConfiguration {
    apiKey: string
    appUserID?: string | null
  }

  export interface PurchaseResult {
    customerInfo: CustomerInfo
  }

  const Purchases: {
    setLogLevel(level: LOG_LEVEL): void
    configure(config: PurchasesConfiguration): void
    getOfferings(): Promise<PurchasesOfferings>
    purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult>
    restorePurchases(): Promise<CustomerInfo>
    getCustomerInfo(): Promise<CustomerInfo>
  }

  export default Purchases
}
