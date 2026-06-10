# Spenlog 작업 현황
> 마지막 업데이트: 2026-06-11

---

## ✅ 어제~오늘 완료

| 작업 | 파일 |
|------|------|
| 카테고리 이미지 삭제 버튼 (제거 버튼) | HomeEditModal.tsx |
| 홈 편집 모달 ↔ 홈화면 UI 동기화 (한줄기록, 최근지출) | HomeEditModal.tsx |
| 홈 편집 모달 좌우 패딩/max-width 통일 (max-w-md) | HomeEditModal.tsx |
| 카메라 이모지 전부 제거 | HomeEditModal.tsx |
| 친목비 카테고리 추가 (4개 동기화) | HomeEditModal.tsx |
| 실제 지출금액/예산 바 표시 (catMap 계산) | HomeEditModal.tsx, page.tsx |
| 하단 탭바 프리뷰 추가 | HomeEditModal.tsx |
| UI shift fix — position:fixed + scrollY 보정 | HomeEditModal.tsx |
| 한줄기록 헤더 아이콘 pencil SVG 동기화 | HomeEditModal.tsx |
| 모달 헤더 높이 56px (홈 pt-14 일치) | HomeEditModal.tsx |
| 구글 연동 prompt: select_account 추가 | SettingsForm.tsx |

---

## 🔴 1순위 — 앱이 안 돌아가는 것

### 1. AI 파싱 에러
- **증상**: 자연어 입력 후 AI 분류 안 됨
- **추정 원인**: 프론트 fetch 경로 vs API Route 경로 불일치
- **작업 전 확인**: `src/app/api/` 폴더 구조 + AiInputBox fetch 경로 대조
- **파일**: `src/app/api/ai-input/route.ts` (또는 유사), `AiInputBox.tsx`

### 2. 온보딩 반복 노출 버그
- **증상**: 로그인할 때마다 온보딩이 다시 뜸
- **추정 원인**: `onboarding_completed` 플래그 미저장/미체크
- **작업 전 확인**: 온보딩 라우팅 로직 + 완료 시 플래그 저장 여부
- **파일**: `src/app/onboarding/page.tsx`, `OnboardingForm.tsx`

### 3. 개발자 계정 프리미엄 전체 해제
- **작업**: `src/lib/premium.ts` 이미 존재 여부 확인 후 기존 is_premium 직접 체크를 `isPremiumUnlocked()`로 교체
- **파일**: premium.ts 적용 여부 미확인 컴포넌트들

---

## 🔴 2순위 — 개발 진행을 막는 것

### 4. 구글 연동 /auth/link-handler
- **현재 상태**: `prompt: select_account` 추가 완료. 리다이렉트 후 처리 미구현
- **남은 작업**: `/auth/link-handler/page.tsx` — 케이스 A(연동 성공), B(이미 다른 계정에 연결됨) 분기 처리
- **파일**: `src/app/auth/link-handler/page.tsx` (현재 파일 존재, 내용 확인 필요)

### 5. 내역 탭 수입 미표시 + ₩ 기호 버그
- **증상 1**: 내역 탭에서 수입 내역이 안 보임
- **증상 2**: `formatCurrency` 에서 ₩ 대신 이상한 문자 출력 가능성
- **작업 전 확인**: `expenses` 테이블 `type` 컬럼 존재 여부, 현재 조회 쿼리 필터 조건
- **파일**: `HistoryClient.tsx`, `src/lib/format.ts`

---

## 🟡 3순위 — 기획 확정 후 개발

| # | 작업 | 기획서 | 주의사항 |
|---|------|--------|----------|
| 6 | 온보딩 화면 UI 상세 | spenlog_onboarding_spec_v2.md | 기존 라우팅 건드리지 말 것 |
| 7 | 카드 루틴 자동화 | spenlog_card_routine_spec_v1.md | 자산 탭 카드 섹션 현재 구조 먼저 확인 |
| 8 | 예산 AI 추천 | spenlog_budget_ai_spec_v1.md | 활성 카테고리 동적 처리, 하드코딩 금지 |
| 9 | 홈 편집 오버레이 고도화 | spenlog_home_edit_overlay_spec_v1.md | 현재 HomeEditModal 기반으로 확장 |
| 10 | 자산 탭 루틴화 | spenlog_spec_asset_routine_v2.docx | — |
| 11 | 리포트 AI 코치 | spenlog_spec_report_coach_v2.docx | — |

---

## 🟢 4순위 — 위 것들 끝나고

캘린더 뷰 / 프리미엄 페이지 / 프리미엄 기능 통합 / 푸시 알림 / 앱 가이드 / 설정 탭 고도화 / CSV 내보내기 / Capacitor + 결제 연동

---

## 방향 제안

### 1안 — 버그 클리어 트랙 (안정성 우선)
```
AI 파싱 에러 fix
→ 온보딩 반복 버그 fix
→ 내역 탭 수입 fix + ₩ 버그
→ 구글 연동 link-handler 완성
→ isPremiumUnlocked 전체 교체
→ 이후 3순위 기능
```
**장점**: 기존 기능이 전부 정상 동작하는 상태에서 기능 추가 시작  
**단점**: 기능 개발이 좀 늦어짐  
**추천 상황**: 곧 외부 공개(테스트 유저 초대 등) 계획 있을 때

### 2안 — 병렬 트랙 (빠른 기능 완성 우선)
```
AI 파싱 에러 fix (필수 — 핵심 기능)
내역 탭 수입 fix (빠름 — 조회 쿼리 수정)
↕ 병렬
예산 AI 추천 (3순위 중 임팩트 큰 것)
홈 편집 오버레이 고도화
→ 이후 온보딩 버그, 구글 연동 마무리
```
**장점**: 앱이 더 풍성해지는 걸 빨리 볼 수 있음  
**단점**: 버그 있는 채로 기능이 쌓임  
**추천 상황**: 혼자 개발하면서 동기부여 유지하고 싶을 때

---

## Vercel 배포 순서

```bash
# 1. 로컬 빌드 에러 확인 (Windows 터미널에서)
cd C:\naver-economy-blog\output\components\spenlog
npm run build

# 2. 에러 없으면 커밋 + 푸시
git add -A
git commit -m "feat: HomeEditModal UI sync + scroll fix + Google select_account"
git push origin main

# 3. Vercel 자동 배포 확인
# https://vercel.com 대시보드 또는 https://spenlog.vercel.app
```
