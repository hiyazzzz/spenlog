# SPENLOG — 진행 현황 & TODO
> 마지막 업데이트: 2026-06-03

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | Spenlog (Spending + Log) |
| 타겟 | 절약에 관심 많은 2030 |
| 핵심 기능 | AI 자연어 입력 → 자동 분류 → 핀터레스트 감성 가계부 |
| 기술 스택 | Next.js 16 (PWA) + Supabase + Claude API + Vercel |
| 배포 URL | https://spenlog-nr7t.vercel.app |
| 로컬 포트 | http://localhost:3001 |
| GitHub | https://github.com/hiyazzzz/spenlog.git |

---

## ✅ 완료된 작업

### 환경 & 인프라
- [x] Next.js 16 + Supabase + Claude API + Vercel 셋업
- [x] Tailwind v4 문법으로 수정 (`@import "tailwindcss"`)
- [x] `tailwind.config.mjs` 삭제 (v4 자동 감지)
- [x] `_middleware.ts` → `proxy.ts` 로 마이그레이션 (Next.js 16 규격)
- [x] PWA 설정 (`next.config.ts`, `manifest.json`, 아이콘 192/512px)
- [x] Vercel 배포 완료 + 환경변수 설정
- [x] Supabase 인증 설정 (Redirect URLs, Email Confirm OFF)

### 인증
- [x] 로그인/회원가입 페이지 (에러 메시지 표시, 자동 리다이렉트)
- [x] 비밀번호 재설정 메일 발송
- [x] 온보딩 닉네임 설정 페이지 (첫 로그인 시 자동 진입)
- [x] auth callback 라우트

### 대시보드 (홈)
- [x] Supabase에서 데이터 fetch → 컴포넌트에 props 전달
- [x] DashboardHeader (닉네임, 이번 달 총 지출, 저축 목표)
- [x] AI 자연어 입력 → Claude API 분류 → 미리보기 → 저장
- [x] AI 입력 플레이스홀더 개선 (예시 3개 줄바꿈)
- [x] 카테고리별 예산 달성률 바
- [x] 최근 지출 내역 + 삭제 버튼 (2탭 확인)

### 분석 페이지
- [x] 월별 네비게이션 (‹ 2026년 6월 ›)
- [x] 전월 대비 지출 비교
- [x] SVG 도넛 차트 (카테고리 비율)
- [x] 카테고리별 지출 바

### 지출 관리 페이지 (`/add`)
- [x] 기록하기 탭 (수동 입력 폼)
- [x] 전체 내역 탭 (검색 + 카테고리 필터)

### 예산 관리 (`/budget`)
- [x] 카테고리별 예산 등록/수정

### 고정비 관리 (`/fixed`)
- [x] 고정비 CRUD (추가/삭제, 월정액/연정액/기타)
- [x] BottomNav에 고정비 탭 추가

### 설정 (`/settings`)
- [x] 페이지 존재 (상세 기능 미구현)

---

## 🔴 다음 스텝 (우선순위 높음)

### STEP 1 — 테마 색상 실시간 적용
- [ ] `settings/page.tsx`에 테마 선택 UI (Burgundy / Sage / Lavender / Terracotta)
- [ ] 선택 시 `users` 테이블 `theme` 업데이트
- [ ] `useUserStore`에 테마 저장 → CSS 변수로 전역 적용
- [ ] 대시보드, 분석, 고정비 등 하드코딩된 `#6B1E2E` → CSS 변수로 교체

### STEP 2 — 설정 페이지 완성
- [ ] 닉네임 변경
- [ ] 월 수입 설정
- [ ] 저축 목표 설정
- [ ] 로그아웃 버튼
- [ ] 계정 탈퇴

### STEP 3 — 온보딩 확장
- [ ] 닉네임 이후 → 월 수입 / 저축 목표 입력 단계 추가
- [ ] 온보딩 완료 후 대시보드 진입

---

## 🟡 우선순위 중간 (기능 고도화)

### 지출 수정
- [ ] `ExpenseItem`에 수정 버튼 → 인라인 편집 또는 모달

### 분석 페이지 고도화
- [ ] 일별 지출 추이 라인 차트 (SVG 또는 경량 라이브러리)
- [ ] 카테고리별 전월 대비 상세 비교

### 고정비 고도화
- [ ] 고정비 자동으로 이번 달 expenses에 반영 기능

### 예산 고도화
- [ ] 예산 초과 알림 표시

---

## 🟢 우선순위 낮음 (편의성 / 폴리싱)

### 이메일 템플릿 커스텀
- [ ] Supabase 대시보드 → Authentication → Email Templates
- [ ] "Reset Password" 메일 한국어 + 스펜로그 브랜딩

### PWA
- [ ] 모바일 "홈 화면에 추가" 테스트

### UX 개선
- [ ] 지출 저장 후 `window.location.reload()` → `router.refresh()`로 교체 (부드러운 UX)
- [ ] 로딩 스켈레톤 UI

### Post-MVP
- [ ] 소셜 로그인 (카카오, 구글)
- [ ] OCR 영수증 스캔 입력
- [ ] 절약 목표 달성 리포트
- [ ] 다크모드
- [ ] 프리미엄 구독 모델

---

## 현재 파일 구조

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          ✅
│   │   └── reset-password/page.tsx ✅
│   ├── (dashboard)/
│   │   ├── layout.tsx              ✅
│   │   ├── page.tsx                ✅
│   │   ├── add/page.tsx            ✅
│   │   ├── analytics/page.tsx      ✅
│   │   ├── budget/page.tsx         ✅
│   │   ├── fixed/page.tsx          ✅
│   │   └── settings/page.tsx       ⚠️ 미완성
│   ├── api/ai-input/route.ts       ✅
│   ├── auth/callback/route.ts      ✅
│   ├── onboarding/page.tsx         ✅
│   ├── globals.css                 ✅
│   └── layout.tsx                  ✅
├── components/
│   ├── analytics/
│   │   ├── CategoryDonutChart.tsx  ✅ (순수 SVG)
│   │   └── MonthNav.tsx            ✅
│   ├── budget/BudgetForm.tsx       ✅
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx     ✅
│   │   ├── CategorySummary.tsx     ✅
│   │   └── RecentExpenses.tsx      ✅
│   ├── expense/
│   │   ├── AiInputBox.tsx          ✅
│   │   ├── AddExpenseForm.tsx      ✅
│   │   ├── AddTabs.tsx             ✅
│   │   ├── ExpenseFilter.tsx       ✅
│   │   └── ExpenseItem.tsx         ✅
│   ├── fixed/FixedCostList.tsx     ✅
│   ├── onboarding/OnboardingForm.tsx ✅
│   └── ui/BottomNav.tsx            ✅
├── lib/
│   ├── supabase/client.ts          ✅
│   ├── supabase/server.ts          ✅
│   ├── themes.ts                   ✅
│   └── claude.ts                   ✅
├── store/useUserStore.ts           ✅
├── types/index.ts                  ✅
├── proxy.ts                        ✅ (Next.js 16 미들웨어)
└── fonts/PretendardVariable.woff2  ✅
```

---

## 기술 주의사항

| 항목 | 내용 |
|------|------|
| Next.js 버전 | 16.2.7 (미들웨어 = `proxy.ts`, export = `proxy`) |
| Tailwind 버전 | v4 (`@import "tailwindcss"`, config 파일 없음) |
| CSS import | `globals.css`는 루트 `layout.tsx`에서만 import |
| 파일 작성 | Write 툴 대신 Python `open().write()` 사용 (null byte 방지) |
| git push | 로컬 터미널에서 직접 실행 필요 (GitHub 인증 불가) |
