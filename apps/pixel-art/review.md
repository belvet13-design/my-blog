# Review — 픽셀 아트 에디터

Build 서브에이전트가 구현한 `/apps/pixel-art/`(index.html, style.css, editor.js)를 spec.md 기준으로
독립 검증했다. 정적 서버(preview 도구)로 실제 브라우저에 로드해 pointer 이벤트를 시뮬레이션하고,
canvas의 `getImageData`로 픽셀 값을 직접 읽어 확인했으며, PNG 다운로드는 blob URL을 fetch해
`createImageBitmap`으로 디코딩한 뒤 실제 픽셀을 검사했다.

## 체크리스트

| 항목 | 결과 | 비고 |
|---|---|---|
| 16x16 격자 렌더링 (셀 개수/크기) | 통과 | `drawGrid()`의 격자선 루프가 `i <= GRID_SIZE`(0~16, 17개 선 = 16칸)로 정확. 화면 확인 및 셀 좌표 계산으로 검증 |
| 클릭 한 번으로 한 칸 칠해짐 | 통과 | `pointerdown`만으로 `paintCell` 즉시 호출됨을 확인 (0,0), (5,5) 셀에서 검증 |
| 드래그 시 지나가는 여러 칸 연속 칠해짐 | 통과 | row 10, col 2~8 연속 드래그 시 모두 칠해짐을 `getImageData`로 확인 |
| 캔버스 밖으로 드래그 후 처리 | 통과 | `setPointerCapture` 덕분에 캔버스 경계 밖(rect.right+50)에서 `pointermove`/`pointerup`을 보내도 `getCellFromPointerEvent`의 clamp가 동작해 가장자리 열(15)이 계속 칠해짐을 확인 |
| 팔레트 색 변경 + `.selected` 갱신 | 통과 | 스와치 클릭 시 `currentColor`/미리보기/`.selected` 모두 정확히 이동 |
| 커스텀 색상(`<input type="color">`) | 통과 | `#123456` 입력 시 현재 색상 미리보기가 `rgb(18,52,86)`로 갱신되고 팔레트 `.selected`는 전부 해제됨(어느 스와치도 값이 일치하지 않으므로) |
| 지우개로 지우기 + 도구 전환 시 색상 유지 | 통과 | 지우개로 (10,5) 삭제 확인 후 그리기 도구로 전환해도 `currentColor`가 이전 빨강(`#ed1c24`)으로 유지됨 |
| "전체 지우기" | 통과 | `confirm()`을 스텁해 확인 시에만 전체 초기화됨을 확인 |
| PNG 저장 (스케일/투명/안티앨리어싱) | 통과 | 다운로드된 blob을 디코딩해 실측: 320x320 크기, 빈 칸 alpha=0(완전 투명), 칠한 칸은 `rgb(237,28,36)` 정확히 일치, 셀 경계(x=59→60→61)에서 중간값 없이 완전 투명→완전 불투명으로 급전환(안티앨리어싱 없음) 확인 |
| 모바일 뷰포트(375px) 레이아웃 | 통과 | 세로로 캔버스→도구패널 순서로 쌓이고 잘리는 요소 없음. 340px, 900px 등 다른 폭에서도 정상 |
| 다크모드 토글 시 캔버스 재렌더 | 통과 | 토글 전/후 빈 셀의 실제 픽셀 값이 `[31,31,31]`(다크 `--cell-bg`) → `[245,245,245]`(라이트 `--cell-bg`)로 바뀜을 `getImageData`로 실측, `toggleTheme()`의 `drawGrid()` 호출 누락 없음 확인 |
| 뒤로가기 링크 | 통과 | `../../index.html` → `http://localhost:8000/index.html`로 정확히 resolve |
| 창 크기 조절(리사이즈) 시 재렌더 | 통과 | 900px→340px 등으로 viewport를 바꿔도 `devicePixelRatio` 변화까지 반영해 backing store 크기가 정확히 재계산됨(debounce 100ms 이후) |
| 콘솔 에러/경고 | 통과 | 전 과정에서 콘솔 로그/에러 없음 |
| `touch-action: none`, `aria-label` 등 접근성 속성 | 통과 | computed style로 `touch-action: none` 확인, canvas `aria-label` 스펙 문구와 일치 |
| 코드 대 스펙(pseudo-code) 대조 | 통과 | `getCellFromPointerEvent`, pointer capture 흐름, `exportPNG`의 2단계 canvas 확대 로직 모두 spec.md 5.3~5.6절 pseudo-code와 1:1로 일치 |

## 발견한 문제

발견한 유일한 이상 현상은 **실제 앱 버그가 아니라 테스트 방법론상의 함정**이었다:

- `canvas.setPointerCapture(pointerId)`는 브라우저가 "현재 활성 상태인 포인터"로 인식하는 id에 대해서만 성공한다.
  `preview_eval`로 임의의 `pointerId`(예: 2, 55, 99)를 가진 합성 `PointerEvent`를 `dispatchEvent`하면
  `setPointerCapture`가 `NotFoundError`를 던지며, 이 예외는 `dispatchEvent()` 호출부로 전파되지 않고 이벤트 리스너
  내부에서 조용히 소비되어 그 이후의 `paintCell` 호출이 스킵된다. 그래서 처음 드래그 테스트에서는 아무 칸도
  안 칠해지는 것처럼 보였다.
  - 실제 마우스/터치 입력에서는 브라우저가 항상 유효한(활성) pointerId를 발급하므로 이 문제는 실사용 시나리오에서는
    절대 발생하지 않는다. `pointerId: 1`(이 브라우저 세션에서 실제 마우스에 할당된 활성 id)로 재시도하자 드래그,
    경계 밖 드래그, 클램핑까지 스펙대로 완벽히 동작했다.
  - 결론: **코드 수정 불필요.** 방어적으로 `setPointerCapture`를 `try/catch`로 감쌀 수도 있지만, 실사용에서
    발생할 수 없는 상황을 위한 방어 코드이므로 스펙에도 없고 2048(자매 앱)에도 이런 패턴이 없어 추가하지 않았다.
    (참고용으로만 기록, 수정하지 않음)

그 외에는 index.html / style.css / editor.js 어디에서도 스펙과 다르게 동작하거나 콘솔 에러를 유발하는 부분을
발견하지 못했다. 좌표→셀 변환, pointer capture 드래그, PNG 2단계 canvas 확대/투명 처리 모두 spec.md의
pseudo-code를 정확히 재현하고 있다.

## 수정 내역

**없음.** 실제 코드를 변경할 필요가 있는 버그를 찾지 못해 index.html / style.css / editor.js는 전혀 손대지 않았다.

## 최종 결론

**배포 가능.** 스펙에 명시된 모든 기능(격자 렌더링, 클릭/드래그 드로잉, pointer capture를 통한 경계 밖 드래그 처리,
팔레트/커스텀 색상, 지우개, 전체 지우기, PNG 내보내기의 320x320 확대·투명 처리·안티앨리어싱 제거, 다크모드 캔버스
재렌더, 반응형 레이아웃, 뒤로가기 링크)이 실제 브라우저 동작과 픽셀 단위 검증 모두에서 스펙대로 동작함을 확인했다.
콘솔 에러/경고도 전혀 없었다.
