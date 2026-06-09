@AGENTS.md
# Spenlog 코워크 필수 지침 v3
> 마지막 업데이트: 2026-06-05
> 이전 버전 대비 변경: 기획서 전면 업데이트 반영, 우선순위 재정렬, 개발 원칙 강화

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
| Framework | Next.js 16.2.7 (App Router) |
| CSS | Tailwind v4 — `@import "tailwindcss"` 방식 |
| DB | Supabase (PostgreSQL + RLS) |
| AI | Gemini API (`@google/generative-ai`) |
| 배포 | Vercel |
| 언어 | TypeScript |
| 상태관리 | Zustand |

> ⚠️ Next.js 16 + Tailwind v4는 기존 학습 데이터와 다를 수 있음
> 반드시 `node_modules/next/dist/docs/` 가이드 먼저 확인 후 코드 작성

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

---

## 미결 이슈 (작업 전 확인 필요)

| 이슈 | 내용 | 확인 방법 |
|------|------|---------|
| AI 파싱 에러 | fetch 경로 vs API Route 경로 불일치 추정 | src/app/api/ 폴더 + 프론트 fetch 경로 대조 |
| 게스트 온보딩 미노출 | 온보딩 완료 플래그 미체크 추정 | 온보딩 라우팅 로직 확인 |
| 구글 연동 버튼 무반응 | 핸들러 미구현 | 연동 버튼 onClick 확인 |

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
```

---

## 작업 우선순위

### 🔴 1순위 — 앱이 안 돌아가는 것

1. **AI 파싱 에러 수정**
   - 기획서: `spenlog_spec_ai_parsing_v2.docx`
   - 작업 전: src/app/api/ 폴더 구조 + 프론트 fetch 경로 대조
   - 핵심: 경로 불일치 수정 + Gemini API 정상 연동 확인

2. **온보딩 반복 노출 버그 수정**
   - 기획서: `spenlog_onboarding_flow_spec_v1.md`
   - 작업 전: 온보딩 라우팅 로직 + 완료 플래그 체크 방식 확인
   - 핵심: 플래그 저장/체크 로직 추가 (기존 UI 건드리지 말 것)

3. **개발자 계정 프리미엄 전체 해제**
   - 기획서: `spenlog_dev_environment_spec_v1.md`
   - `src/lib/premium.ts` 신규 생성
   - 기존 is_premium 체크 전부 isPremiumUnlocked()로 교체

### 🔴 2순위 — 개발 진행을 막는 것

4. **구글 계정 연동**
   - 기획서: `spenlog_google_auth_spec_v1.md`
   - 작업 전: 현재 구글 로그인 코드 + 연동 버튼 �핸들러 확인
   - 핵심: /auth/link-handler 신규 생성, 케이스 A/B 분기 처리

5. **내역 탭 수입 미표시 버그**
   - 기획서: `spenlog_spec_history_tab_v2.docx`
   - 작업 전: 현재 조회 쿼리 + expenses 테이블 type 컬럼 여부 확인
   - formatCurrency 헬퍼 함수 추가 (₩ 기호 버그 동시 수정)

### 🟡 3순위 — 기획 확정 후 개발

6. **온보딩 화면 UI 상세**
   - 기획서: `spenlog_onboarding_spec_v2.md`, `spenlog_onboarding_flow_spec_v1.md`

7. **카드 루틴 자동화**
   - 기획서: `spenlog_card_routine_spec_v1.md`
   - 작업 전: 자산 탭 카드 섹션 현재 구조 확인

8. **예산 AI 추천**
   - 기획서: `spenlog_budget_ai_spec_v1.md`, `spenlog_budget_spec_v1.md`
   - 작업 전: 예산 화면 구조 + 카테고리 토글 ON/OFF 로직 확인
   - AI 추천 대상: 유저 활성 카테고리 동적 처리 (하드코딩 금지)

9. **홈 화면 UI 정돈**
   - 기획서: `spenlog_spec_home_ui_v2.docx`
   - 데이터 로직 건드리지 말고 스타일만 수정

10. **홈 편집 오버레이**
    - 기획서: `spenlog_home_edit_overlay_spec_v1.md`, `spenlog_home_custom_spec_v1.md`

11. **자산 탭 루틴화**
    - 기획서: `spenlog_spec_asset_routine_v2.docx`

12. **리포트 AI 코치**
    - 기획서: `spenlog_spec_report_coach_v2.docx`

### 🟢 4순위 — 위 것들 끝나고

13. 캘린더 뷰 — `spenlog_history_calendar_spec_v1.md`
14. 프리미엄 페이지 — `spenlog_spec_premium_page_v1.docx`
15. 프리미엄 기능 연동 통합 — `spenlog_premium_integration_spec_v1.md`
16. 푸시 알림 시스템 — `spenlog_push_notification_spec_v1.md`
17. 앱 가이드 다시보기 — `spenlog_app_guide_spec_v1.md`
18. 설정 탭 — `spenlog_settings_tab_spec_v2.md`
19. 소셜 로그인 + 게스트 모드 — `spenlog_social_login_spec_v1.md`
20. CSV 내보내기 — `spenlog_csv_export_spec_v1.md`
21. Capacitor + 결제 연동 — `spenlog_payment_integration_spec_v1.md`

---

## 작업 완료 후 보고 양식

각 작업 완료 시 아래 형식으로 보고:

```
1. 수정/추가한 파일 목록
2. DB 변경사항 (마이그레이션 SQL)
3. 기존 코드와 충돌한 부분 및 처리 방법
4. 테스트 필요 항목
5. 다음 작업 전 확인 필요 사항
```

---

## 출시 전 최종 체크리스트

- [ ] Vercel Production `NEXT_PUBLIC_PREMIUM_BYPASS=false` 전환
- [ ] 개발자 이메일 계정 `is_developer=true` DB 설정
- [ ] 프리미엄 게이팅 전체 화면 확인
- [ ] 이용약관 + 개인정보처리방침 페이지 존재 확인
- [ ] 구매 복원 버튼 존재 확인 (앱스토어 심사 필수)
- [ ] 게스트 모드 정상 동작 확인 (앱스토어 심사 필수)
- [ ] Apple Developer Program 등록 ($99/년)
- [ ] Google Play Console 등록 ($25)