# Spenlog 개발 현황 정리
> 마지막 업데이트: 2026-06-09

---

## 1. 왜 변경사항이 반영 안 됐나

### 핵심 원인: 파일 잘림(Truncation) 버그
Claude 코워크 도구(Edit/Write)로 특정 길이 이상의 파일을 쓸 때 **내용이 중간에 잘려서 저장**되는 버그가 있음.
예) `page.tsx` 116번째 줄에서 딱 잘림 → Turbopack이 JSX 파싱 실패 → `npm run build` exit code 1

### 결과
- `48c24d4` 커밋부터 시작해서 Vercel 빌드가 계속 실패 상태
- 빌드 실패 = 배포 없음 = 화면에서 아무것도 안 바뀜

### 해결 방법 (지금부터 적용)
- 파일 수정 후 항상 `tail -c 50 파일명`으로 끝 확인
- 긴 파일(200줄+)은 Edit 도구 대신 Python `open().write()`로 전체 재작성
- 커밋 전 잘린 파일 목록 점검

### 현재 상태 (2026-06-09 기준)
- `18b4fa1` 커밋까지 push 완료
- 잘린 파일: 전부 복원 완료
- Vercel 빌드: 진행 중 (마지막 에러: `SettingsForm hasGoogle` Props 누락 → 수정됨)

---

## 2. 프로젝트 개요

**Spenlog** — AI 자연어 입력 기반 가계부 PWA

| 항목 | 내용 |
|------|------|
| 한 줄 설명 | "스타벅스 육천원 카드" 한 줄로 지출 자동 분류 |
| 타깃 | 소비 관리 원하는 MZ세대 |
| 감성 | 핀터레스트 스타일 대시보드 |
| 배포 URL | https://spenlog-nr7t.vercel.app |
| 레포 | https://github.com/hiyazzzz/spenlog |

---

## 3. 기술 스택

| 항목 | 내용 |
|------|------|
| Framework | Next.js 16.2.7 (App Router, Turbopack) |
| CSS | Tailwind v4 (`@import "tailwindcss"`) |
| DB | Supabase (PostgreSQL + RLS) |
| AI | Gemini API (`@google/generative-ai`) |
| 배포 | Vercel |
| 언어 | TypeScript |
| 상태관리 | Zustand |

---

## 4. 화면/기능 구조

```
/login              이메일·구글 로그인
/onboarding         9단계 온보딩 (아래 참조)
/ (dashboard)       홈 — 커버배너·AI입력·카테고리그리드·최근지출
/add                지출 수동 입력 폼
/history            지출/수입 내역 + 검색/필터
/budget             카테고리별 월 예산 설정 + AI 추천
/category           카테고리 관리 (ON/OFF, 색상)
/analytics          분석 (카테고리별 도넛차트)
/assets             자산 탭 — 예산/카드/고정비/계좌
/report             월간 리포트
/settings           설정 (닉네임·수입·목표·테마·로그아웃·탈퇴)

API Routes:
/api/ai-input       Gemini AI 자연어 파싱
/api/ai-coach       리포트 AI 코치
/api/budget-recommend  카테고리별 예산 AI 추천
/api/push           Web Push 알림
/auth/callback      OAuth 콜백
/auth/check         로그인 후 온보딩 여부 확인
/auth/link-handler  게스트 → 구글 연동
```

### 온보딩 9단계 구성
1. nickname — 닉네임
2. theme — 테마 선택
3. income — 월 수입
4. saving — 저축 목표
5. budget — 카테고리별 예산
6. assets — 자산 연결 (건너뜀 가능)
7. cards — 카드 등록
8. fixedcosts — 고정비/고정저축 등록 ← 이번 세션 추가
9. categories — 카테고리 확인

---

## 5. DB 스키마 (Supabase)

### 주요 테이블
| 테이블 | 역할 |
|--------|------|
| users | 프로필·설정·프리미엄 상태 |
| expenses | 지출/수입 내역 (type: expense/income/transfer) |
| budgets | 카테고리별 월 예산 |
| categories | 커스텀 카테고리 |
| fixed_costs | 고정비·고정저축 (kind: 고정지출/고정저축) |
| cards | 카드 정보 |
| accounts | 계좌 정보 |
| savings_payments | 카드 납부 기록 |
| push_subscriptions | 웹 푸시 구독 정보 |
| greeting_templates | AI 인사말 템플릿 |

### ⚠️ Supabase에 적용 필요한 마이그레이션 SQL
아래 SQL이 **Supabase Dashboard > SQL Editor**에서 아직 실행 안 됐을 수 있음.
반드시 확인하고 미적용 항목 실행:

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

-- 지출 타입
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 카드 납부 루틴
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

-- 예산 소스
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

-- 고정비 kind 컬럼
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS kind text DEFAULT '고정지출';
```

---

## 6. 완료된 작업 목록

| # | 내용 | 커밋 |
|---|------|------|
| 1 | category/page.tsx seed 에러 핸들링 강화 + upsert | 56bed74 |
| 2 | categories SQL 픽스 파일 생성 | 56bed74 |
| 3 | git index 오염 수정 | 내부 처리 |
| 4 | budget-recommend API 커스텀 카테고리 지원 | 49e1753 |
| 5 | BudgetForm fallbackAmounts + allCategories 전달 | 49e1753 |
| 6 | expenses 테이블 type/source 컬럼 마이그레이션 | 2eff33a |
| 7 | AddExpenseForm 지출 저장 시 type:'expense' 추가 | 2eff33a |
| 8 | src/lib/premium.ts 생성 (isPremiumUnlocked) | 2eff33a |
| 9 | auth/check onboarding_completed 플래그 체크 | 2eff33a |
| 10 | formatCurrency ₩ 기호 수정 | 20f239b |
| 11 | 구글 계정 연동 (link-handler + migrate-guest API) | 20f239b |
| 12 | 카드 루틴 납부 기록 바텀시트 | 20f239b |
| 13 | 홈 UI 정돈 (카테고리 전체보기·minHeight) | 20f239b |
| 14 | 카드 납부 루틴 DB 컬럼 불일치 수정 | ae76109 |
| 15 | BudgetForm '수입' 카테고리 제외 + OFF 시 DB 삭제 | dd3827f |
| 16 | CategoryPage spentMap expense 타입만 포함 | dd3827f |
| 17 | 빌드 에러 수정 (tsconfig.json) | 436764f |
| 18 | 잘린 파일 6개 복원 | 0edc00e |
| 19 | 온보딩 9단계 (고정비 단계 추가) | 0edc00e |
| 20 | 홈 편집 오버레이 (backdrop blur) | 0edc00e |
| 21 | 저축 달성 C안 (고정저축 + max잔여) | 570ed58 |
| 22 | 카테고리 현황 "카테고리 관리 →" + /category 링크 | 0edc00e |
| 23 | SettingsForm hasGoogle Props 추가 | 18b4fa1 |
| 24 | settings/page.tsx hasGoogle 전달 추가 | 현재 커밋 |

---

## 7. 앞으로 해야 할 작업

### 🔴 즉시 (배포 안정화)
- [ ] Vercel 빌드 성공 확인
- [ ] Supabase 마이그레이션 SQL 전체 실행 확인
- [ ] 주요 플로우 동작 테스트 (로그인 → 온보딩 → 홈)

### 🟡 3순위 — 기획 완성
| 항목 | 기획서 파일 |
|------|------------|
| 예산 AI 추천 UI | spenlog_budget_ai_spec_v1.md |
| 홈 편집 오버레이 개선 | spenlog_home_edit_overlay_spec_v1.md |
| 리포트 AI 코치 | spenlog_spec_report_coach_v2.docx |
| 카드 루틴 자동화 고도화 | spenlog_card_routine_spec_v1.md |

### 🟢 4순위 — 추가 기능
| 항목 | 기획서 파일 |
|------|------------|
| 캘린더 뷰 | spenlog_history_calendar_spec_v1.md |
| 프리미엄 페이지 | spenlog_spec_premium_page_v1.docx |
| 프리미엄 기능 연동 통합 | spenlog_premium_integration_spec_v1.md |
| 푸시 알림 시스템 | spenlog_push_notification_spec_v1.md |
| 앱 가이드 다시보기 | spenlog_app_guide_spec_v1.md |
| 설정 탭 개편 | spenlog_settings_tab_spec_v2.md |
| 소셜 로그인 + 게스트 모드 | spenlog_social_login_spec_v1.md |
| CSV 내보내기 | spenlog_csv_export_spec_v1.md |
| Capacitor + 결제 연동 | spenlog_payment_integration_spec_v1.md |

---

## 8. 알려진 이슈

| 이슈 | 원인 추정 | 상태 |
|------|-----------|------|
| AI 파싱 에러 | /api/ai-input fetch 경로 vs API Route 불일치 | 미수정 |
| 게스트 온보딩 미노출 | 온보딩 완료 플래그 미체크 | 부분수정 |
| 구글 연동 버튼 무반응 | settings/page.tsx hasGoogle 미전달 | 수정됨 |

---

## 9. 프리미엄 제어 로직

```ts
// src/lib/premium.ts
export function isPremiumUnlocked(user: User | null): boolean {
  if (process.env.NEXT_PUBLIC_PREMIUM_BYPASS === 'true') return true  // 개발 중
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

현재 `NEXT_PUBLIC_PREMIUM_BYPASS=true`로 개발 중. 출시 전 `false`로 전환 필요.

---

## 10. 출시 전 체크리스트

- [ ] Vercel Production `NEXT_PUBLIC_PREMIUM_BYPASS=false` 전환
- [ ] 개발자 계정 `is_developer=true` DB 설정
- [ ] 이용약관 + 개인정보처리방침 페이지 생성
- [ ] 구매 복원 버튼 구현 (앱스토어 심사 필수)
- [ ] 게스트 모드 정상 동작 확인 (앱스토어 심사 필수)
- [ ] Apple Developer Program 등록 ($99/년)
- [ ] Google Play Console 등록 ($25)
