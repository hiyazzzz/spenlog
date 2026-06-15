# Spenlog 다음 작업 기획서

> 작성일: 2026-06-05  
> 대상 파일: Next.js 14 App Router + Supabase (`spenlog-nr7t.vercel.app`)

---

## 1. 자산 탭 월 수입 "W0" 깨짐 버그

### 현상
자산 탭 상단 "월 수입" 섹션 summary에 `₩0` 또는 `W0`로 표시됨.

### 원인
`AssetsClient.tsx` Line 307에서 수입을 이렇게 렌더링:
```tsx
summary={monthlyIncome > 0 ? '₩' + monthlyIncome.toLocaleString() : '미설정'}
```
- `profile?.income`이 `null` 또는 `0`이면 `'미설정'`으로 분기됨 → 정상
- `income`이 있을 때 `₩` + 숫자 문자열 연결 방식 → 폰트/렌더링 환경에 따라 `₩` 기호가 `W`로 깨짐
- 반면 홈 탭은 `formatCurrency()` 함수(`src/lib/format.ts`)를 import해서 사용 → 정상 표시

### 수정 범위
`AssetsClient.tsx` 내 `₩` + `.toLocaleString()` 패턴 전체를 `formatCurrency()`로 교체.

### 수정 방법

**Step 1 — import 추가**
```tsx
// AssetsClient.tsx 상단
import { formatCurrency } from '@/lib/format'
```

**Step 2 — 교체 대상 (Line 기준 참고)**

| 위치 | 현재 코드 | 교체 |
|------|-----------|------|
| L307 summary | `'₩' + monthlyIncome.toLocaleString()` | `formatCurrency(monthlyIncome)` |
| L310 대형 숫자 | `₩{monthlyIncome.toLocaleString()}` | `{formatCurrency(monthlyIncome)}` |
| L343 예산 summary | `'총 ₩' + totalBudget.toLocaleString() + ' 설정'` | `` `총 ${formatCurrency(totalBudget)} 설정` `` |
| L364 계좌 summary | `'총 잔액 ₩' + totalBalance.toLocaleString()` | `` `총 잔액 ${formatCurrency(totalBalance)}` `` |
| L384, L439, L445 등 | 기타 `.toLocaleString()` 패턴 | 동일하게 교체 |

> **참고:** `formatCurrency`가 이미 `₩` 기호와 천단위 구분을 포함해 반환하는지 `src/lib/format.ts`에서 먼저 확인할 것. 만약 기호 없이 숫자만 반환한다면 `₩{formatCurrency(v)}`로 사용.

### 검증
- 월 수입 설정된 유저 → summary에 `₩3,000,000` 정상 표시
- 미설정 유저 → `'미설정'` 표시 유지
- iOS Safari / Android Chrome PWA에서도 기호 정상 렌더링 확인

---

## 2. AI 예산 추천 (Gemini 기반 실제 추천)

### 현재 상태
- `budget/page.tsx` → `BudgetForm.tsx` → AI 탭에 **알뜰/균형/여유** 3가지 프리셋 존재
- 프리셋은 `income × 고정비율`로 단순 계산 (실제 AI 없음)
- `api/ai-coach/route.ts`에 Gemini 2.0 Flash 호출 로직 존재 → 패턴 재사용 가능

### 목표
사용자의 **실제 지출 이력** 기반으로 Gemini가 카테고리별 예산을 추천해주는 API 구현.  
기존 프리셋 3종은 유지하되, "AI 맞춤 추천" 버튼 추가.

### 구현 설계

#### A. API Route 신규 생성 — `app/api/budget-recommend/route.ts`

**Input (POST body)**
```ts
{
  income: number              // 월 수입
  fixedSavings: number        // 고정저축 합계
  recentExpenses: {           // 최근 3개월 지출 (expenses 테이블)
    category: string
    amount: number
    month: string             // 'YYYY-MM'
  }[]
  currentBudgets: {           // 현재 설정된 예산 (없으면 [])
    category: string
    amount: number
  }[]
}
```

**Gemini 프롬프트 전략**
```
사용자의 최근 3개월 지출 패턴을 분석해 다음 달 카테고리별 예산을 추천하세요.
카테고리: 생활비, 활동비, 고정비, 친목비, 예비비
조건:
- 총 예산은 (월 수입 - 고정저축) 이내
- 각 카테고리 금액은 1000원 단위로 반올림
- 최근 지출이 많은 카테고리는 합리적 상한선 제안
- 한 카테고리가 총 예산의 60% 초과 금지
응답은 JSON만 출력:
{"생활비": 500000, "활동비": 200000, "고정비": 300000, "친목비": 150000, "예비비": 100000, "reason": "2줄 이내 추천 근거"}
```

**Fallback**: Gemini 실패 시 기존 프리셋 중 `'균형'` 비율로 자동 계산해 반환.

#### B. BudgetForm.tsx 수정

AI 탭에 "✨ AI 맞춤 추천" 버튼 추가 (기존 3개 프리셋 아래):
```
[💰 알뜰하게]  [⚖️ 균형있게]  [🌈 여유있게]
─────────────────────────────────────────
[✨ 내 소비패턴 기반 AI 추천 받기]  ← 신규
```

- 버튼 클릭 → `/api/budget-recommend` POST 호출
- 로딩 스피너 표시 (≈2-3초 예상)
- 성공 시 → 카테고리별 금액 채워주고 Gemini 추천 근거 1줄 표시
- 실패 시 → 프리셋 fallback + 토스트 "AI 추천에 실패했어요. 프리셋을 적용했어요."

#### C. budget/page.tsx 수정
Server Component에서 최근 3개월 expenses를 쿼리해 `BudgetForm`에 전달:
```ts
// 최근 3개월 날짜 계산
const threeMonthsAgo = dayjs().subtract(2, 'month').format('YYYY-MM')

const { data: recentExpenses } = await supabase
  .from('expenses')
  .select('category, amount, date')
  .eq('user_id', user.id)
  .neq('type', 'transfer')   // transfer 제외
  .gte('date', `${threeMonthsAgo}-01`)
  .lt('date', `${nextMonth}-01`)
```

### 환경변수
기존 `GEMINI_API_KEY` 그대로 사용 (신규 추가 없음).

### 검증
- 지출 이력 없는 신규 유저 → Fallback 프리셋으로 자동 처리, UI 오류 없음
- 지출 이력 있는 유저 → Gemini 추천 금액 합계가 `(income - fixedSavings)` 이내인지 확인
- API 오류 시 → 토스트 표시 + 프리셋 fallback 정상 동작

---

## 3. 푸시 알림 (Service Worker + VAPID + Vercel Cron)

### 현재 상태
- `public/sw.js`: next-pwa Workbox 기반 SW 존재 (캐싱 전용, push event 없음)
- DB `users` 테이블: `push_enabled`, `push_due_date_reminder`, `push_due_date_unprocessed`, `push_report`, `push_expense_reminder` 컬럼 존재
- `SettingsForm.tsx`: 알림 토글 UI 완성, DB 저장까지 됨
- **미구현**: 구독 저장 로직, VAPID 키 생성, SW push handler, Cron 발송 API

### 구현 설계

#### A. 환경 준비

**VAPID 키 생성** (1회):
```bash
npx web-push generate-vapid-keys
```
→ Vercel 환경변수에 추가:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@spenlog.app
```

**패키지 설치**:
```bash
npm install web-push
npm install -D @types/web-push
```

#### B. DB — 구독 저장 테이블

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);
```

#### C. SW 수정 — `public/sw.js` or `src/sw.ts`

> next-pwa는 Workbox 기반이라 `sw.js`가 빌드 시 자동 생성됨. Custom push handler는 `next.config.js`의 `customWorkerSrc` 옵션으로 추가 SW 파일 병합.

`src/worker/push-handler.ts` 신규 생성:
```ts
// push 이벤트 수신
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Spenlog', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

#### D. 클라이언트 — 구독 등록

`src/lib/push.ts` 신규 생성:
```ts
export async function subscribePush(userId: string) {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  })
  // 구독 정보를 서버에 저장
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ userId, subscription: sub.toJSON() }),
  })
}
```

`SettingsForm.tsx` 수정:
- "알림 전체" 토글 ON 시 → `Notification.requestPermission()` → 허용이면 `subscribePush()` 호출
- 이미 구독됐으면 skip

#### E. API Routes

**`app/api/push/subscribe/route.ts`**  
구독 정보를 `push_subscriptions` 테이블에 upsert.

**`app/api/push/send/route.ts`** (Cron용 내부 API, `Authorization: Bearer CRON_SECRET`)  
```ts
// 발송 유형 param으로 분기
// type: 'due_date_reminder' | 'due_date_unprocessed' | 'report'
```
발송 로직:
1. 오늘 날짜 기준으로 대상 유저 필터 (`push_enabled = true` AND 해당 type 토글 ON)
2. `due_date_reminder`: `fixed_costs.due_day`가 오늘+7일인 항목 있는 유저
3. `due_date_unprocessed`: `savings_payments.is_paid = false` AND `due_day = 오늘`인 유저
4. `report`: 매월 1일 → 전월 리포트 요약 발송
5. `web-push.sendNotification(subscription, payload)` 호출
6. 410 Gone 응답 시 → 해당 구독 삭제 (만료 처리)

#### F. Vercel Cron 설정

`vercel.json` 수정:
```json
{
  "crons": [
    {
      "path": "/api/push/send?type=due_date_reminder",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/push/send?type=due_date_unprocessed",
      "schedule": "0 20 * * *"
    },
    {
      "path": "/api/push/send?type=report",
      "schedule": "0 8 1 * *"
    }
  ]
}
```

> Vercel Cron은 Hobby 플랜에서 하루 1회 무료. 3개 Cron이면 Pro 플랜 필요 → **due_date_reminder + unprocessed를 하나의 Cron으로 합치는 방안** 검토.

#### G. 환경변수 추가 목록

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
CRON_SECRET=랜덤_시크릿_값    # Cron 호출 인증용
```

### 구현 순서 (권장)

1. VAPID 키 생성 + Vercel 환경변수 등록
2. `push_subscriptions` 테이블 Supabase에 생성
3. SW push handler 추가 + next.config.js customWorkerSrc 설정
4. `/api/push/subscribe` API 구현
5. SettingsForm에 구독 요청 로직 연결
6. `/api/push/send` API 구현 + 로컬 테스트
7. `vercel.json` Cron 등록 + Vercel 배포

### 검증
- Android Chrome에서 PWA 설치 후 알림 허용 → 구독 DB 저장 확인
- `/api/push/send` 직접 POST로 즉시 발송 테스트
- 구독 만료 시 자동 삭제 로직 동작 확인
- iOS 17+ Safari에서 PWA 설치 후 알림 동작 확인 (iOS 16 이하 미지원)

---

## 우선순위 및 예상 소요

| 작업 | 난이도 | 예상 시간 | 선행 조건 |
|------|--------|-----------|-----------|
| W0 버그 수정 | 🟢 낮음 | 30분 | 없음 |
| AI 예산 추천 | 🟡 중간 | 2-3시간 | 없음 |
| 푸시 알림 | 🔴 높음 | 1-2일 | VAPID 키, Vercel Pro 플랜 검토 |

**권장 순서**: W0 버그 → AI 예산 추천 → 푸시 알림
