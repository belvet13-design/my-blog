# Build 지침 — 2048 게임 구현

## 역할

너는 Build 서브에이전트다. `C:\Users\User\Desktop\my-blog\apps\2048\spec.md`에 이미 작성된 설계를 그대로 구현하는 것이 임무다. 설계를 바꾸지 말고 스펙을 충실히 따른다. 다만 pseudo-code 수준으로 적힌 부분은 실제 동작하는 JavaScript로 정확하게 옮겨야 한다.

## 범위 (반드시 지킬 것)

- **수정/생성 가능한 파일은 다음 3개뿐이다:**
  - `C:\Users\User\Desktop\my-blog\apps\2048\index.html`
  - `C:\Users\User\Desktop\my-blog\apps\2048\style.css`
  - `C:\Users\User\Desktop\my-blog\apps\2048\game.js`
- 이 외의 어떤 파일도 건드리지 않는다. 특히 다음은 절대 수정 금지:
  - `C:\Users\User\Desktop\my-blog\index.html`
  - `C:\Users\User\Desktop\my-blog\css\style.css`
  - `C:\Users\User\Desktop\my-blog\js\*` (전부)
  - `C:\Users\User\Desktop\my-blog\content\*`
  - `C:\Users\User\Desktop\my-blog\apps\2048\spec.md` (읽기만 하고 수정하지 않는다)
- 새 폴더나 별도 assets 디렉터리를 만들 필요는 없다(spec.md 1장 참고).
- npm, 빌드 도구, 프레임워크, 번들러를 도입하지 않는다. 순수 HTML/CSS/JS.
- 외부 라이브러리는 사용하지 않는다(CDN 포함 불필요 — 2048은 바닐라로 충분).

## 구현 순서

1. `apps/2048/spec.md`를 처음부터 끝까지 읽는다.
2. 기존 블로그 관례 참고를 위해 다음 파일을 읽는다 (읽기만, 수정 금지):
   - `css/style.css` — CSS 변수 네이밍과 다크모드 패턴(`prefers-color-scheme` + `[data-theme]`) 확인
   - `js/theme.js` — `localStorage`의 `theme` 키를 어떻게 읽고 `document.documentElement`에 반영하는지 확인
3. `apps/2048/index.html`을 스펙 2장의 DOM 스켈레톤에 따라 작성한다.
4. `apps/2048/style.css`를 스펙 3장에 따라 작성한다 (색상 변수, 레이아웃, 애니메이션, 점수판/버튼, 반응형).
5. `apps/2048/game.js`를 스펙 4장에 따라 작성한다 (IIFE, 상태 관리, 핵심 함수들, 렌더링, 초기화). pseudo-code를 실제 동작하는 JS로 정확히 구현할 것 — 특히 `slideAndMergeLine`(연속 3개 이상 병합 시 1회만 병합되는 로직), `rotateBoard`(4방향 통일 처리), `isGameOver` 판정을 꼼꼼히 검증한다.
6. `../../index.html` 상대경로가 실제로 블로그 루트를 가리키는지 파일 구조상으로 확인한다 (`apps/2048/index.html` → `apps/` → 루트, 즉 2단계 상위이므로 `../../index.html`이 맞는지 검산).

## 완료 기준

- 방향키 4방향으로 타일이 밀리고 합쳐진다.
- 같은 값이 연속 3개 이상일 때 정확히 1회만 병합된다 (예: `[2,2,2,0]` → `[4,2,0,0]`).
- 이동해도 보드에 변화가 없으면 새 타일이 생성되지 않는다.
- 보드가 꽉 찼고 인접 병합 가능 쌍이 없으면 게임 오버 처리된다.
- 2048 타일 도달 시 승리 메시지가 뜨고 "계속하기"로 이어서 플레이할 수 있다.
- 현재 점수와 최고 점수(localStorage, 새로고침 후에도 유지)가 정확히 표시된다.
- 새 게임 버튼과 다시 시도 버튼이 정상 동작한다.
- 모바일 터치 스와이프로도 조작 가능하다.
- 다크모드가 블로그와 동일한 `localStorage['theme']` 방식으로 동작한다.

## 참고

이 지침 파일(`BUILD_INSTRUCTIONS.md`)은 작업 완료 후 삭제하지 않아도 된다. 신경 쓰지 말고 3개 파일 구현에만 집중해라.

작업이 끝나면 무엇을 만들었는지, spec.md와 다르게 구현한 부분이 있다면 무엇이고 왜인지 간단히 보고해라.
