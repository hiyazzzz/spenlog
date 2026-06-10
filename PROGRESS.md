# Spenlog 개발 진행 현황
> 마지막 업데이트: 2026-06-10

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 서비스 | AI 자연어 입력 기반 가계부 PWA |
| GitHub | https://github.com/hiyazzzz/spenlog |
| 배포 URL | https://spenlog.vercel.app |
| 스택 | Next.js 16 / Tailwind v4 / Supabase / Gemini API / Vercel |

---

## 완료된 작업 목록

### 🔴 버그 수정

#### 빌드 에러
- **VAPID 키 빌드 에러** (`src/app/api/push/send/route.ts`)
  - 원인: 모듈 레벨에서 `webpush.setVapidDetails()` 실행 → 빌드 시 env 없어서 크래시
  - 수정: GET 핸들러 내부로 이동 + 키 존재 여부 런타임 체크
- **virtiofs 파일 트런케이션** (반복 발생)
  - VM FUSE 마운트 특성상 파일이 잘려 보이는 현상
  - 영향 파일: `SettingsForm.tsx`, `tsconfig.json`, `AssetsClient.tsx`, `page.tsx` 등 다수
  - 대응: Python `open().write()` 방식으로 파일 전체 재작성

#### AI 파싱
- **AI 자연어 입력 fetch 경로 불일치** (`src/app/api/ai-input/route.ts`)
  - 프론트 fetch 경로 vs API Route 경로 대조 후 수정
  - Gemini API 타임아웃 처리 추가
  - OCR 모듈 레벨 Anthropic 초기화 크래시 수정

#### 인증 / 온보딩
- **온보딩 반복 노출 버그**
  - `onboarding_completed` 플래그 저장/체크 로직 추가 (`src/app/api/auth/check/route.ts`)
  - 완료 시 DB 저장: `onboarding_completed`, `init_setup_completed` 플래그 3종
- **게스트 구글 연동 404**
  - `/auth/link-handler` 신규 생성, 케이스 A/B 분기 (기존 구글 계정 / 신규 연동)
  - `/api/migrate-guest` API Route: service_role로 RLS 우회해 데이터 이전

#### 예산 / 카테고리
- **예산 페이지 카테고리 3개만 표시**
  - 서버에서 커스텀 카테고리 없을 시 기본 5개 fallback 추가
  - `'수입'` 카테고리 예산에서 제외
  - 토글 OFF 시 DB 예산 삭제 로직 추가
- **카테고리 페이지 빈 화면**
  - 서버 seed: `upsert` → 단순 `insert` + 재조회 fallback
  - 클라이언트 seed: `useEffect` fallback (anonymous RLS 우회)
  - RLS 실패해도 기본 카테고리 UI 렌더링 (fallback id `fallback-0` ~ `fallback-5`)
- **예산 토글 레이아웃**
  - 최종: `[카테고리명(no box)] [금액 입력(white box)] [토글(no box)]` 한 줄
  - 프로그레스 바는 입력박스 아래 들여쓰기로 정렬

#### 테마
- **설정 화면 테마 표시 오류** (`src/components/settings/SettingsForm.tsx`)
  - `router.refresh()` + `useEffect([profile.theme])` 조합이 DB 값으로 덮어쓰는 버그
  - localStorage를 source of truth로 변경, DB는 fire-and-forget
  - 초기값: `localStorage` → DB 순으로 fallback

#### 자산 탭
- **자산 온보딩 배너 재노출**
  - 닫기 시 `localStorage.setItem('spenlog_asset_banner_dismissed', 'true')` 저장
  - 초기값에서 localStorage 먼저 체크 → DB 업데이트 실패해도 재노출 방지

#### 내역 탭
- **수입 미표시 버그**
  - `expenses` 테이블 `type` 컬럼 추가 + `formatCurrency` ₩ 기호 수정
  - `spentMap`에서 `type === 'expense'`만 포함

#### 카드 루틴
- **납부 루틴 DB 컬럼 불일치**
  - `savings_payments` 테이블 컬럼 재확인 후 쿼리 수정
  - 초기 로딩 `useEffect` 추가

---

### 🟢 신규 기능 구현

#### 인증
- **구글 + 게스트 전용 로그인** (이메일 제거)
- **구글 계정 연동** (`/auth/link-handler`)
  - 케이스 A: 기존 구글 계정 → 데이터 이전 후 구 계정 삭제
  - 케이스 B: 신규 구글 계정 → 직접 연동

#### AI 기능
- **예산 AI 추천** (`/api/budget-recommend`)
  - 최근 3개월 지출 기반 카테고리별 예산 자동 추천
  - 커스텀 카테고리 동적 처리 (하드코딩 없음)
  - 무료 기능으로 제공 (프리미엄 게이팅 해제)

#### 홈 화면
- **홈 UI 정돈**
  - 저축 달성률 C안 (심플 바)
  - 카테고리 현황 "전체보기" 링크 → `/category`
  - 최소 높이 통일, `formatCurrency` 적용
- **홈 편집 오버레이** (`HomeEditModal`)
  - 커버 이미지 / 카테고리 카드 3개 인플레이스 편집
  - 편집 모드 = 홈 화면과 동일 레이아웃 + 딤 오버레이
  - 프리미엄 사용자만 저장 가능 (무료: 미리보기만)

#### 카드 루틴
- **납부 상태 배지** + **기록 바텀시트**
  - `savings_payments` 테이블 기반 납부 완료/미완료 표시
  - 납부 기록 바텀시트에서 직접 처리

#### 프리미엄 제어
- **`src/lib/premium.ts` 신규 생성**
  - `isPremiumUnlocked(user)` 단일 함수로 프리미엄 체크 통일
  - `NEXT_PUBLIC_PREMIUM_BYPASS=true`이면 개발 중 전체 해제

#### 설정 탭
- **카테고리 관리 링크** 추가
- **구글 계정 연동 버튼** 연결
- **계정 탭** 분리 (닉네임/수입/목표)

#### CSV 내보내기
- `/api/export-csv` API Route 신규 생성
- 설정 탭 UI에 내보내기 버튼 추가

#### 앱 가이드
- 5단계 오버레이 컴포넌트 (`AssetsGuide`) 구현

#### 푸시 알림
- `vercel.json` cron 3개 추가 (지출 리마인더 / 납부일 / 월간 리포트)

#### 테마
- 테마 팔레트 카드 UI (색상 픽커 제거 → 카드 선택)
- 8가지 테마 + 홈 커버 / 카테고리 카드에 테마 컬러 반영

---

## DB 마이그레이션 현황

### ✅ 적용 완료 (Supabase SQL Editor에서 실행)
```sql
-- expenses 타입/소스 컬럼
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- categories RLS 정책 (2026-06-10 적용)
CREATE POLICY "Users can read own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);
```

### ⏳ 아직 미적용 (필요 시 실행)
```sql
-- 온보딩 플래그
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS init_setup_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asset_setup_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asset_setup_skipped boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guide_completed boolean DEFAULT false;

-- 프리미엄
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

-- 예산 AI 추천 소스
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

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
```

---

## 환경변수 목록

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# AI
GEMINI_API_KEY=

# 개발 환경 프리미엄 전체 해제 (개발: true / 출시 전: false)
NEXT_PUBLIC_PREMIUM_BYPASS=true

# 푸시 알림 (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=

# 게스트 데이터 이전용 (서비스롤)
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 현재 알려진 이슈

| 이슈 | 상태 | 원인 추정 |
|------|------|---------|
| 카테고리 페이지 빈 화면 | 🟡 완화 (fallback UI 추가) | categories 테이블 RLS 미설정 → SQL Editor에서 정책 추가로 근본 해결 |
| 자산 온보딩 배너 재노출 | 🟡 완화 (localStorage 방어) | `asset_setup_skipped` 컬럼 미존재 또는 DB 업데이트 실패 |
| 구글 연동 버튼 무반응 | ✅ 수정됨 | link-handler + migrate-guest API 구현 |
| AI 파싱 에러 | ✅ 수정됨 | fetch 경로 불일치 + Gemini 타임아웃 처리 |
| 테마 버건디 표시 | ✅ 수정됨 | localStorage source of truth 적용 |

---

## 남은 작업 (CLAUDE.md 기준 우선순위)

### 🟡 3순위 (기획 확정 후)
- [ ] 온보딩 화면 UI 상세 (`spenlog_onboarding_spec_v2.md`)
- [ ] 예산 AI 추천 고도화 (현재 기본 구현 완료)
- [ ] 홈 편집 오버레이 완성 (`spenlog_home_edit_overlay_spec_v1.md`)
- [ ] 자산 탭 루틴화 (`spenlog_spec_asset_routine_v2.docx`)
- [ ] 리포트 AI 코치 (`spenlog_spec_report_coach_v2.docx`)

### 🟢 4순위
- [ ] 캘린더 뷰
- [ ] 프리미엄 페이지 + 결제 연동
- [ ] 푸시 알림 시스템 완성 (cron은 완료, 구독 UI 미완)
- [ ] 앱 가이드 다시보기
- [ ] 설정 탭 상세 완성
- [ ] Capacitor 전환 (iOS/Android 앱화)

---

## 출시 전 최종 체크리스트

- [ ] Vercel Production `NEXT_PUBLIC_PREMIUM_BYPASS=false` 전환
- [ ] 개발자 이메일 계정 `is_developer=true` DB 설정
- [ ] 프리미엄 게이팅 전체 화면 확인
- [ ] 이용약관 + 개인정보처리방침 페이지
- [ ] 구매 복원 버튼 (앱스토어 심사 필수)
- [ ] 게스트 모드 정상 동작 확인 (앱스토어 심사 필수)
- [ ] Apple Developer Program 등록 ($99/년)
- [ ] Google Play Console 등록 ($25)
