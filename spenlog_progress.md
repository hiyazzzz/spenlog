# SPENLOG — 진행 현황 & TODO
> 마지막 업데이트: 2026-06-03 (전면 개정)

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | Spenlog |
| 배포 URL | https://spenlog-nr7t.vercel.app |
| GitHub | https://github.com/hiyazzzz/spenlog.git |
| 스택 | Next.js 16 + Tailwind v4 + Supabase + Claude API + Vercel |

---

## 🔴 즉시 수정 필요 (버그)

### BUG-1 — \u20a9 텍스트 노출
- **원인**: Python으로 파일 쓸 때 raw string 미사용 → ₩ 기호가 `\u20a9`으로 저장됨
- **영향**: analytics/page.tsx, report/page.tsx, fixed/page.tsx
- **수정**: 해당 파일들 ₩ 기호 직접 교체

### BUG-2 — AI 입력 네트워크 오류
- **원인**: `claude-sonnet-4-20250514` → 유효하지 않은 모델명 / Supabase auth 체크 타이밍
- **수정**: 모델명 `claude-sonnet-4-6`으로 교체, auth 에러 핸들링 개선

### BUG-3 — 구글 로그인 후 로그인 안됨
- **원인**: auth/callback route에서 session 쿠키가 NextResponse에 반영 안됨
- **수정**: callback route를 NextResponse 기반으로 재작성

### BUG-4 — 구글 OAuth 화면 "supabase.co로 이동" 표시
- **수정**: Google Cloud Console → OAuth 동의 화면 → 앱 이름 "Spenlog"로 변경 (코드 외 작업)

### BUG-5 — 온보딩 숫자 입력 스피너 버튼
- **수정**: `type="number"` → `type="text" inputMode="numeric"` 교체

### BUG-6 — 테마 색상 변경 안됨
- **원인**: ThemeProvider가 DB에서 읽어서 CSS 변수 적용하는데, 설정 저장 후 레이아웃 re-render 안됨
- **수정**: SettingsForm에서 테마 클릭 시 즉시 CSS 변수 적용 + DB 저장 (저장 버튼 불필요)

---

## 🟡 UX/기능 개선

### UX-1 — 리포트 기본값 = 전월
- 현재: 이번 달 기본 표시
- 수정: 기본값을 전달로 변경 (이번 달 리포트는 다음 달 1일부터 의미)

### UX-2 — 리포트 "실제 저축" 계산 오정확
- 현재: income - totalSpent
- 수정: "이번 달 아낀 금액" = 전월 대비 감소분 또는 예산 잔여액으로 재정의

### UX-3 — 설정 탭 분리 (프로필 / 로그인 정보)
- 프로필 탭: 닉네임, 수입, 저축목표 (천단위 콤마 입력)
- 로그인 정보 탭: 이메일, 로그인 방식 (Google/이메일), 비밀번호 변경

### UX-4 — 설정 금액 입력 천단위 콤마
- income, saving_goal 입력 시 3자리마다 콤마 표시

### UX-5 — 테마 설정 UI 개선
- 색상명만 표시 (코드 제거), 클릭 즉시 적용+저장, "테마" 라벨

### UX-6 — 예산 AI 추천 탭
- 보수(수입의 30%)/보통(40%)/여유(55%) 기준 카테고리별 자동 배분
- "AI 추천 받기" 버튼 → 탭 전환

---

## 🟢 신규 기능

### NEW-1 — 가계부 초기 설정 온보딩 (온보딩 4단계)
현재 온보딩: 닉네임 → 수입 → 저축목표
추가할 단계: 예산 설정 → 통장/카드 등록 → 카테고리 설정

온보딩 전체 흐름:
1. 닉네임 설정
2. 월 수입 입력
3. 저축 목표 입력
4. 예산 설정 (AI 추천 / 직접 입력)
5. 자산 등록 (통장 추가 — 선택)
6. 카드 등록 (카드 추가 — 선택)
7. 카테고리 커스텀 (기본 제공, 추가/삭제 가능)

### NEW-2 — 통장 관리 페이지 (/accounts)
- accounts 테이블: id, user_id, name, bank, balance, type(입출금/적금/투자)
- CRUD: 통장 추가/수정/삭제
- 총 자산 합계 표시

### NEW-3 — 카드 관리 페이지 (/cards)
- cards 테이블: id, user_id, name, bank, due_day, limit_amount
- CRUD: 카드 추가/수정/삭제
- 이번 달 카드별 지출 연동

### NEW-4 — 카테고리 커스텀
- 기본 카테고리: 생활비, 활동비, 고정비, 친목비, 예비비
- 사용자 추가 카테고리: user_categories 테이블 (user_id, name, color)
- 설정 또는 온보딩에서 추가/삭제

### NEW-5 — 자산/부채 대시보드
- 총 자산 = 통장 잔액 합계
- 총 부채 = 카드 한도 사용액 (추후)
- 순자산 = 자산 - 부채

---

## ✅ 완료된 작업

### 환경 & 인프라
- [x] Next.js 16, Tailwind v4, proxy.ts, PWA, CSS 변수 테마 시스템
- [x] GitHub PAT 자동 push

### 인증
- [x] 이메일 로그인/회원가입 (에러 UI)
- [x] 구글 로그인 버튼 추가 (BUG-3 수정 필요)
- [x] 비밀번호 재설정

### 온보딩
- [x] 3단계: 닉네임 → 수입 → 저축목표

### 대시보드
- [x] 저축 진행률 바
- [x] AI 자연어 입력 + 영수증 스캔 (OCR)
- [x] 예산 달성률 (초과 알림)
- [x] 최근 지출 수정/삭제

### 분석
- [x] 월별 네비, 누적 라인 차트, 도넛 차트, 전월 대비

### 지출 관리
- [x] 수동 입력 + 검색/필터

### 예산
- [x] 카테고리별 월 예산 + 지출 대비

### 고정비
- [x] CRUD + 이번 달 자동 반영

### 설정
- [x] 닉네임/수입/목표/테마/로그아웃/탈퇴

### 리포트
- [x] 월간 리포트 페이지 (수정 필요)

### Post-MVP
- [x] 다크모드 토글
- [x] 구글 로그인 버튼

---

## 기술 주의사항

| 항목 | 내용 |
|------|------|
| 파일 작성 | Python `r-string` 또는 `open().write()` — ₩는 직접 입력 (\u20a9 방지) |
| Next.js | 16.2.7 — proxy.ts, proxy export |
| Tailwind | v4 — @import "tailwindcss" |
| CSS import | globals.css는 루트 layout.tsx에서만 |
| git push | PAT 설정 완료 |
