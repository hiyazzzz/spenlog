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

## ✅ 완료된 작업 (전체)

### 환경 & 인프라
- [x] Next.js 16 + Tailwind v4 + Supabase + Claude API + Vercel
- [x] proxy.ts (Next.js 16 미들웨어), PWA, CSS 변수 테마 시스템
- [x] GitHub PAT 설정 (자동 push 가능)

### 인증 & 온보딩
- [x] 로그인/회원가입 (에러 UI, 자동 리다이렉트)
- [x] 비밀번호 재설정
- [x] 온보딩 3단계: 닉네임 → 월 수입 → 저축 목표
- [x] 아기자기 닉네임 추천 (의성/의태어 조합)

### 대시보드 (홈)
- [x] 닉네임/지출/저축 목표 헤더
- [x] 저축 진행률 바 (목표 달성 시 🎉)
- [x] AI 자연어 입력 → Claude 분류 → 미리보기 → 저장
- [x] 카테고리별 예산 달성률 (80% 주의, 초과 알림)
- [x] 최근 지출 내역 + 수정/삭제
- [x] 로딩 스켈레톤

### 분석 페이지
- [x] 월별 네비게이션
- [x] 누적 지출 SVG 라인 차트
- [x] 카테고리 도넛 차트
- [x] 카테고리별 전월 대비 (▲▼ %)
- [x] 로딩 스켈레톤

### 지출 관리 (/add)
- [x] 기록하기 탭 (수동 입력)
- [x] 전체 내역 탭 (검색 + 카테고리 필터)
- [x] 인라인 수정/삭제 (삭제 2탭 확인)

### 예산 (/budget)
- [x] 카테고리별 월 예산 등록 (월별로 분리 저장)
- [x] 전체 달성률 + 카테고리별 지출 대비 실시간 표시
- [x] 초과/주의 색상 피드백

### 고정비 (/fixed)
- [x] CRUD (월정액/연정액/기타, 결제일)
- [x] 이번 달 expenses에 일괄 반영 버튼

### 설정 (/settings)
- [x] 닉네임/수입/저축 목표/테마 변경
- [x] 로그아웃
- [x] 계정 탈퇴 (2단계 확인, 데이터 전체 삭제)

---

## 🟡 다음 작업 (남은 항목)

### 이메일 템플릿 커스텀 (Supabase 대시보드 직접)
- [ ] Authentication → Email Templates → Reset Password 한국어로 수정

### Post-MVP
- [ ] 소셜 로그인 (카카오, 구글)
- [ ] OCR 영수증 스캔 입력
- [ ] 월말 절약 리포트 / 목표 달성 요약
- [ ] 다크모드
- [ ] 프리미엄 구독 모델 (Claude API 비용 커버)

---

## 기술 주의사항

| 항목 | 내용 |
|------|------|
| Next.js 버전 | 16.2.7 (미들웨어 = `proxy.ts`, export = `proxy`) |
| Tailwind 버전 | v4 (`@import "tailwindcss"`, config 파일 없음) |
| CSS import | `globals.css`는 루트 `layout.tsx`에서만 import |
| 파일 작성 | Python `open().write()` 사용 (null byte 방지) |
| git push | GitHub PAT 설정 완료 (자동 push 가능) |
| 테마 | CSS 변수 (`--color-primary` 등), ThemeProvider로 런타임 적용 |
