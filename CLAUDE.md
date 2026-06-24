@AGENTS.md
# Spenlog 코워크 필수 지침 v7
> 마지막 업데이트: 2026-06-24
> 이전 버전 대비 변경: 3순위 작업 4종 완료 처리 (온보딩 UI, 카드 루틴, 예산 AI 추천, 홈 UI 정돈)

---

## 프로젝트 개요

Spenlog는 AI 자연어 입력 기반 가계부 PWA 앱이야.
"스타벅스 육천원 카드" 한 줄 입력으로 지출이 자동 분류되고,
핀터레스트 감성 대시보드로 소비를 관리하는 서비스야.

- GitHub: https://github.com/hiyazzzz/spenlog
- 배포 URL: https://spenlog.vercel.app
- 환경: Windows 로컬 + Vercel 배포

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 앱 구조 | **pnpm 모노레포** — `apps/web` (Next.js), `apps/mobile` (Expo) |
| Web Framework | Next.js 16.2.7 (App Router) — `apps/web` |
| Mobile Framework | Expo (Expo Router, React Native) — `apps/mobile` |
| CSS | Tailwind v4 — `@import "tailwindcss"` 방식 |
| DB | Supabase (PostgreSQL + RLS) |
| AI | Gemini API (`@google/generative-ai`) |
| 배포 (Web) | Vercel — git push 시 자동 배포 |
| 배포 (Mobile) | Expo Go / 개발 빌드 — `expo start` |
| 언어 | TypeScript |
| 상태관리 | Zustand (`apps/mobile`), `@spenlog/types`, `@spenlog/utils` 공유 패키지 |

> ⚠️ Next.js 16 + Tailwind v4는 기존 학습 데이터와 다를 수 있음
> 반드시 `node_modules/next/dist/docs/` 가이드 먼저 확인 후 코드 작성

---

## 📱 모노레포 구조 및 배포 규칙

### 앱 역할 분리

| 앱 | 경로 | 역할 |
|----|------|------|
| **Web (Vercel)** | `apps/web/` | API Route 서버 (`/api/*`), 웹 UI |
| **Mobile (Expo)** | `apps/mobile/` | 실제 유저용 앱 (iOS/Android) |
| **공유 패키지** | `packages/` | types, utils, supabase 클라이언트 |

### 핵심 구조 이해

- 모바일 앱은 Vercel에 배포된 Next.js API를 HTTP로 호출함
- `EXPO_PUBLIC_API_URL` = Vercel 배포 URL (현재: `https://spenlog-nr7t.vercel.app`)
- AI 파싱, 탈퇴, CSV 내보내기 등 **서버 사이드 로직은 모두 `apps/web/src/app/api/`에 있음**

### 🚨 코드 수정 시 배포 규칙

| 수정 위치 | 반영 방법 |
|-----------|----------|
| `apps/mobile/` | `expo start` 후 hot reload로 즉시 확인 |
| `apps/web/src/app/api/` | **반드시 git push → Vercel 자동 배포 후 테스트** |
| `apps/web/src/` (웹 UI) | git push → Vercel 배포 |
| `packages/` | 양쪽 앱 모두 영향 — 양쪽 다 테스트 |
| `supabase 마이그레이션` | Supabase SQL Editor에서 직접 실행 |

> ⚠️ `apps/web/api/` 변경 후 Vercel 배포 전에 모바일에서 테스트하면 구 버전 API로 테스트하는 것임. 순서 지킬 것.

---

## 🚨 필수 개발 원칙 (모든 작업에 적용)

### 1. 기존 코드 우선 파악
- 모든 작업 시작 전 관련 파일/컴포넌트 먼저 읽기
- `src/app/api/` 폴더 구조 파악 후 API Route 경로 확인
- 기존 DB 테이블 구조 파악 후 재사용 가능한 것 먼저 활용

### 2. 최소 수정 원칙
- 기존에 구현된 기능은 절대 제거하거나 구조를 바꾸지 말 것
- 기획서는 "추가/보완" 방향으로만 적용
- UI는 유지하고 로직만 추가하는 방식 우선

### 3. 충돌 시 반드시 보고
- 기획서 vs 기존 코드 충돌 시 임의 결정 금지
- 먼저 보고하고 방향 확인 후 진행
- 판단이 필요한 부분은 진행 전에 먼저 물어보기

### 4. DB 변경 분리
- 스키마 변경(컬럼 추가/삭제)은 마이그레이션 SQL 별도 제시
- 기존 데이터에 영향 없는 방향으로 (DEFAULT 값 포함)

### 5. 단계별 진행
- 한 기능 완료 + 빌드 에러 없음 확인 후 다음으로 넘어가기
- 작업 완료 시 변경된 파일 목록 요약 제공

### 6. 환경변수 주의
- ₩ 기호 직접 입력 (Python raw string 또는 open().write() — `\u20a9` 방지)
- 환경변수 필요 시 목록으로 정리해서 안내
- `npm run build` 로 빌드 에러 반드시 확인

### 7. 양쪽 앱 배포 원칙
- `apps/web/` 변경 → git push → Vercel 배포 완료 후 모바일 테스트 (순서 반드시 지킬 것)
- `apps/mobile/` 변경 → expo start 확인
- API 경로/응답 변경 시 `EXPO_PUBLIC_API_URL` + 모바일 fetch 경로 동시 확인
- **파일 수정은 반드시 Edit/Write 툴 사용. bash의 Python `open().write()` 절대 금지** (virtiofs 잘림 버그 — null byte 오염·잘림 발생)
- 파일 수정 후 즉시 검증 필수: `python3 -c "c=open('파일','rb').read(); assert b'\\x00' not in c and len(c)>100, '손상됨'"` + 마지막 5줄 확인
- 대형 파일(200줄+) 수정 시 전체 재작성 대신 Edit 툴로 해당 구간만 교체

### 8. 기획 방향 이탈 시 사전 논의
- 기획서 스펙 대비 구현 방향이 크게 달라질 것 같으면 코드 작성 전 반드시 보고
- 기술적 제약으로 기획 변경이 필요한 경우 → 대안 2-3개 제시 후 선택 받기
- "이렇게 하면 더 낫겠다"는 판단도 먼저 물어볼 것 (임의 결정 금지)

---

## 환경변수 목록

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# AI
GEMINI_API_KEY=

# 개발 환경 프리미엄 전체 해제 (개발 중: true / 출시 전: false)
NEXT_PUBLIC_PREMIUM_BYPASS=true

# 푸시 알림 (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=

# RevenueCat (Capacitor 전환 후 추가)
NEXT_PUBLIC_REVENUECAT_IOS_KEY=
NEXT_PUBLIC_REVENUECAT_ANDROID_KEY=

# Expo 모바일 앱 전용 (apps/mobile/.env)
EXPO_PUBLIC_API_URL=https://spenlog-nr7t.vercel.app   # Vercel 배포 URL (vercel.app 도메인 확인 필수)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 프리미엄 접근 제어 (필수 숙지)

모든 프리미엄 기능 체크는 반드시 아래 함수 하나로 통일.
개별 컴포넌트에서 `is_premium` 직접 체크 금지.

```ts
// src/lib/premium.ts
export function isPremiumUnlocked(user: User | null): boolean {
  if (process.env.NEXT_PUBLIC_PREMIUM_BYPASS === 'true') return true
  if (!user) return false
  if (user.is_developer) return true
  if (user.is_premium && user.premium_expires_at) {
    return new Date(user.premium_expires_at) > new Date()
  }
  if (user.trial_started_at) {
    const trialEnd = new Date(user.trial_started_at)
    trialEnd.setDate(trialEnd.getDate() + 90)
    return new Date() < trialEnd
  }
  return false
}
```

---

## 현재 완료된 기능 (건드리지 말 것)

- 이메일/구글 로그인, 비밀번호 재설정
- 온보딩 3단계 (닉네임 → 수입 → 저축목표)
- 홈 대시보드 (저축 진행률, AI 자연어 입력, 예산 달성률, 최근 지출)
- 지출 수동 입력 + 검색/필터
- 카테고리별 월 예산
- 고정비 CRUD
- 설정 (닉네임/수입/목표/테마/로그아웃/탈퇴)
- 월간 리포트 페이지
- PWA + Vercel 배포
- `isPremiumUnlocked()` 통합 함수 (`apps/mobile/lib/premium.ts`)
- 구글 계정 연동/해제 (`settings.tsx`)
- 테마 즉시 동기화 — `useThemeColors()` hook (Zustand store 기반)
- 게스트 모드 홈화면 (로그인 유도 UI, 에러 없이 표시)
- 로그아웃 플로우 재설계 — 게스트/일반 분기, AsyncStorage 초기화
- 탈퇴 soft delete (`/api/delete-account` — `users.is_deleted=true`, Auth 유저 유지)
- CSV 내보내기 (`settings.tsx` + `/api/export/csv`)
- 다크 모드 (`AppThemeProvider`, AsyncStorage `dark_mode`)
- 온보딩 화면 UI 상세 (기획서 스펙 기반 구현 완료)
- 카드 루틴 자동화
- 예산 AI 추천
- 홈 화면 UI 정돈

---

## 미결 이슈 (작업 전 확인 필요)

| 이슈 | 상태 | 내용 | 확인 방법 |
|------|------|------|---------|
| AI 파싱 에러 | ✅ 해결 | Vercel URL 불일치 수정 완료 | — |
| 게스트 온보딩 미노출 | ✅ 해결 | `_layout.tsx` `guest_onboarding_completed` 플래그 체크 + 라우팅 구현 완료 | — |
| 구글 연동 버튼 무반응 | ✅ 해결 | `settings.tsx` `handleLinkGoogle` 구현 완료 | — |
| 탈퇴 후 재로그인 처리 | 🟡 부분해결 | `is_deleted=true` 계정 재로그인 시 안내 → "새 프로필 생성" 자동화 미구현 | `index.tsx` load 함수 — 현재 수동 로그아웃 유도만 |

---

## DB 스키마 추가 필요 항목

작업 순서에 따라 아래 마이그레이션 적용:

```sql
-- 온보딩 플래그
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS init_setup_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asset_setup_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asset_setup_skipped boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guide_completed boolean DEFAULT false;

-- 프리미엄 관련
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_developer boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_status text DEFAULT 'free_trial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at timestamp DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at timestamp;

-- 홈 커스텀
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_cover_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_1 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_2 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_3 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_4 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS greeting_last_ids text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gif_autoplay boolean DEFAULT true;

-- 지출 타입
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 루틴화
CREATE TABLE IF NOT EXISTS savings_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  fixed_cost_id uuid REFERENCES fixed_costs(id),
  card_id uuid REFERENCES cards(id),
  month text,
  amount integer,
  paid_at timestamp,
  created_at timestamp DEFAULT now()
);

-- 예산 AI 추천 소스
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 인사말 템플릿
CREATE TABLE IF NOT EXISTS greeting_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- 푸시 알림
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_info text,
  created_at timestamp DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_expense_reminder boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_due_date_reminder boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_due_date_unprocessed boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_report boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_permission_asked boolean DEFAULT false;

-- ✅ 2026-06-19 적용 완료: 탈퇴 soft delete
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted) WHERE is_deleted = true;
```

---

## 작업 우선순위

### 🔴 1순위 — 앱이 안 돌아가는 것

1. ~~**AI 파싱 에러 수정**~~ ✅ 완료

2. ~~**온보딩 반복 노출 버그 수정**~~ ✅ 완료 — `_layout.tsx` 게스트/로그인 분기 + 플래그 체크

3. ~~**개발자 계정 프리미엄 전체 해제**~~ ✅ 완료 — `isPremiumUnlocked()` 전체 교체


### 🔴 2순위 — 개발 진행을 막는 것

4. ~~**구글 계정 연동**~~ ✅ 완료 — `settings.tsx` 연동/해제 구현


5. ~~**내역 탭 수입 미표시 버그**~~ ✅ 완료 — `history.tsx` type 필터/수입 배지/formatCurrency 모두 구현됨

### 🟡 3순위 — 기획 확정 후 개발

6. ~~**온보딩 화면 UI 상세**~~ ✅ 완료

7. ~~**카드 루틴 자동화**~~ ✅ 완료

8. ~~**예산 AI 추천**~~ ✅ 완료

9. ~~**홈 화면 UI 정돈**~~ ✅ 완료�

---

## 🔧 Expo 모바일 개발 환경

### 테스트 디바이스
- **유저는 iPhone + Expo Go 앱으로 확인**
- **웹은 Vercel URL(`https://spenlog-nr7t.vercel.app`)로 확인**
- **유저는 원격 작업이 많음** → 로컬에서 처리할 일(파일 실행, 포트 킬, IP 확인 등)은 **bat 파일로 만들어서 제공**

### 네트워크 설정 (필수)
- PC 랜선은 반드시 **공유기 LAN 포트**에 연결 (KT 모뎀 직결 금지)
- PC + 핸드폰 모두 `172.30.1.x` 대역이어야 통신 가능
- KT 모뎀 직결 시 PC가 `222.107.136.97` (공인 IP) → 핸드폰과 망 분리 → 연결 불가
- ngrok 터널은 KT 망에서 차단됨 → LAN 모드로만 사용

### git push (Vercel 배포) 방법
- **경로**: `C:\Users\curio\Desktop\spenlog` (프로젝트 루트)
- **방법**: Windows 탐색기에서 해당 폴더 열기 → 주소창에 `cmd` 입력 후 Enter → 아래 명령 실행
  ```
  git add -A
  git commit -m "커밋 메시지"
  git push
  ```
- 또는 `git_push.bat` 파일 만들어서 더블클릭으로 실행 가능 (아래 참고)
- Vercel 자동 배포 완료 확인: https://vercel.com/dashboard → 배포 상태 초록불 확인 후 모바일 테스트

> ⚠️ `apps/web/` 변경 후 Vercel 배포 **전**에 모바일 테스트하면 구 버전 API로 테스트하는 것임

### Expo 실행 방법
- `run_expo.bat` 더블클릭으로 실행 (C:\Users\curio\Desktop\spenlog\run_expo.bat)
- `--go` 플래그 필수: expo-dev-client가 설치돼 있어 없으면 dev build URL 생성 → Expo Go 인식 불가
- `--clear` 필수: metro 캐시 초기화

### Expo Go 호환성 (크래시 원인 목록)
- **react-native-reanimated 4.x + react-native-worklets** → Expo Go에서 JSI 모듈 레벨 크래시
  - category.tsx의 react-native-draggable-flatlist 임포트가 reanimated를 당겨서 발생
  - 해결: metro.config.js resolveRequest로 lib/stubs/draggable-flatlist.jsx stub 적용 중
  - dev build 전환 시 metro.config.js의 resolveRequest 블록 제거
- **react-native-purchases** → Expo Go 미지원. lib/revenuecat.ts stub으로 대체됨
- **expo-dev-client** 설치 상태 → expo start --go 플래그로 Expo Go 모드 강제

### virtiofs 파일 손상 강화 지침
- Edit/Write 툴도 Windows↔Linux 동기화 지연으로 잘림 발생 가능
- 가장 신뢰성 높은 방법: bash에서 python3으로 직접 파일 쓰기
  예: `python3 -c "with open('파일', 'w', encoding='utf-8') as f: f.write(content)"`
- 수정 후 반드시 검증: `python3 -c "c=open('파일','rb').read(); print(len(c),'bytes, null:', c.find(b'\\x00'))"`
- 기대 크기보다 작으면 bash로 재작성 (Edit/Write 툴 결과 믿지 말 것)
- app.json이 잘릴 경우: python3로 JSON 파싱해서 닫는 중괄호 수동 보완
