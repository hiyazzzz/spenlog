# Z-Index / Stacking Order Guideline

> 마지막 업데이트: 2026-07-01  
> 실제 코드베이스 값 기준으로 작성. 코드 수정 없이 문서화만 함.

---

## 웹 (Next.js / CSS)

### 레이어 표

| 레이어 | 값 | 설명 | 실사용 위치 |
|--------|-----|------|-------------|
| base | 0 (auto) | 일반 흐름 | 대부분의 카드/컨텐츠 |
| sticky-header | 10 | 스크롤 고정 헤더, 커버 버튼 | `AssetsClient.tsx` 탭 바(`top: 58`), `HomeEditModal.tsx` sticky 헤더, `HomeFAB` FAB 버튼(`z-40`=40) |
| dropdown-backdrop | 600 | 드롭다운 닫기 백드롭 (클릭 투명 영역) | `HistoryClient.tsx` `WebDropdownPicker` 백드롭 |
| dropdown-panel | 601 | 드롭다운 옵션 패널 | `HistoryClient.tsx` `WebDropdownPicker` 패널 |
| fab-open-backdrop | 50 | FAB 확장 시 백드롭 | `BottomNav.tsx` FAB 오픈 오버레이 |
| modal-backdrop | 500 | 바텀시트형 모달 반투명 배경 | `HistoryClient.tsx` 수정 모달 |
| modal | 9999 | 전체화면 모달, confirm 팝업, 토스트 | `AiInputBox.tsx`, `SettingsForm.tsx`, `HistoryClient.tsx` 삭제 confirm, `BudgetForm.tsx` 토스트, `OnboardingForm.tsx`, `AppGuide.tsx`, `OfflineBanner.tsx`(9998) |
| guide | 10001 | 온보딩 가이드 오버레이 (최상위) | `GuideOverlay.tsx`, `AssetsGuide.tsx` |

### 사용 규칙

1. **dropdown 레이어(600/601)는 반드시 modal(9999) 보다 낮게 유지.** 모달이 열렸을 때 드롭다운이 위에 뜨는 현상 방지.
2. **BottomNav는 z-index 미지정.** `fixed bottom-0`만 사용 중 — 다른 요소와 겹칠 경우 `z-20` 정도 명시 추가 필요.
3. **sticky-header(10)는 BottomNav/modal 아래에 있어야 함.** 스크롤 시 헤더가 모달 위에 뜨지 않도록.
4. **guide(10001)는 최상위 예약값.** 온보딩 외 용도로 사용 금지.
5. **toast 위치:** 9999 사용 중. modal과 같은 레벨이므로 모달 위에 토스트를 띄우려면 10000 이상 필요 (현재 미분리).

### 현재 비일관성 (참고용)

| 위치 | 현재 값 | 권장 |
|------|---------|------|
| `HistoryClient.tsx` 수정 모달 backdrop | 500 | 9999로 통일 또는 500 레이어 명시 |
| `HomeEditModal.tsx` overlay | 100 | 9999 레이어로 올리는 게 안전 |
| `AssetsClient.tsx` dialog | 9999 | 일관성 OK |
| `OfflineBanner.tsx` | 9998 | 의도적 — modal 아래에 배너 표시하려면 유지 |

---

## 모바일 (React Native)

React Native는 컴포넌트 트리 순서(위에 렌더된 것이 아래)로 자연스러운 스태킹이 결정되며, `zIndex`는 형제 컴포넌트 간에만 영향을 줌.

### 실사용 값

| 값 | 설명 | 위치 |
|----|------|------|
| 1 | 헤더 wrap — 스크롤 위에 고정 | `assets.tsx` headerWrap |
| 10 | 커버 버튼, 온보딩 건너뛰기 | `index.tsx` coverEditBtn, `onboarding.tsx` skipBtn |
| 100 | 드롭다운 팝업 패널 | `fixed-costs.tsx` 드롭다운 |

### 모바일 규칙

1. **Modal/SlideUpModal 컴포넌트:** React Native `Modal`은 자체적으로 최상위 레이어에 렌더됨. `zIndex` 불필요.
2. **드롭다운(100)은 모달 내부에서만 사용.** 모달 밖에서 쓰면 native Modal 뒤에 숨을 수 있음.
3. **Keyboard/StatusBar와 겹침 주의:** `paddingTop: 56` (status bar height) 또는 `SafeAreaView` 사용 — z-index로 해결하지 말 것.

---

## 신규 컴포넌트 추가 시 체크리스트

- [ ] 드롭다운이면: backdrop 600 + panel 601
- [ ] 바텀시트/모달이면: 9999 (또는 9998 if 배너)
- [ ] 온보딩 가이드이면: 10001
- [ ] 모달 위에 토스트가 필요하면: 10000
- [ ] 이미 9999인 요소 위에 뭔가 올려야 하면: 10000–10001 범위, 단 반드시 팀 논의
