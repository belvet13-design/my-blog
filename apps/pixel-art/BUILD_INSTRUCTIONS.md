# Build 지침 — 픽셀 아트 에디터 구현

## 역할

너는 Build 서브에이전트다. `C:\Users\User\Desktop\my-blog\apps\pixel-art\spec.md`에 이미 작성된 설계를 그대로 구현하는 것이 임무다. 설계를 바꾸지 말고 스펙을 충실히 따른다. 다만 pseudo-code 수준으로 적힌 부분은 실제 동작하는 JavaScript로 정확하게 옮겨야 한다.

## 범위 (반드시 지킬 것)

- **수정/생성 가능한 파일은 다음 3개뿐이다:**
  - `C:\Users\User\Desktop\my-blog\apps\pixel-art\index.html`
  - `C:\Users\User\Desktop\my-blog\apps\pixel-art\style.css`
  - `C:\Users\User\Desktop\my-blog\apps\pixel-art\editor.js`
- 이 외의 어떤 파일도 건드리지 않는다. 특히 다음은 절대 수정 금지:
  - `C:\Users\User\Desktop\my-blog\index.html`
  - `C:\Users\User\Desktop\my-blog\css\style.css`
  - `C:\Users\User\Desktop\my-blog\js\*` (전부)
  - `C:\Users\User\Desktop\my-blog\content\*`
  - `C:\Users\User\Desktop\my-blog\apps\2048\*` (전부, 참고용으로 읽기만 가능)
  - `C:\Users\User\Desktop\my-blog\apps\pixel-art\spec.md` (읽기만 하고 수정하지 않는다)
- npm, 빌드 도구, 프레임워크, 번들러를 도입하지 않는다. 순수 HTML/CSS/JS(canvas API 포함, 브라우저 내장이므로 사용 가능).
- 외부 라이브러리는 사용하지 않는다.

## 구현 순서

1. `apps/pixel-art/spec.md`를 처음부터 끝까지 읽는다.
2. 기존 관례 참고를 위해 다음 파일을 읽는다 (읽기만, 수정 금지):
   - `apps/2048/index.html`, `apps/2048/style.css`, `apps/2048/game.js` — 파일 구성, CSS 변수 네이밍, 다크모드 패턴, 뒤로가기 링크 패턴
   - `css/style.css`, `js/theme.js` — 블로그 원본 관례
3. `apps/pixel-art/index.html`을 스펙에 따라 작성한다.
4. `apps/pixel-art/style.css`를 스펙에 따라 작성한다 (색상 변수, 레이아웃, 반응형, 다크모드).
5. `apps/pixel-art/editor.js`를 스펙에 따라 작성한다 (canvas 격자 렌더링, pointer 이벤트로 드래그 칠하기, 색상 팔레트/커스텀 색상, 지우개, 전체 지우기, PNG 저장). pseudo-code를 실제 동작하는 JS로 정확히 구현하되 특히 다음을 꼼꼼히 검증한다:
   - pointerdown/move/up 좌표 → 셀 인덱스 변환이 정확한지 (경계값 포함)
   - `setPointerCapture`로 캔버스 밖으로 드래그해도 계속 칠해지는지
   - 같은 칸을 반복 통과할 때 불필요한 재렌더가 없는지
   - PNG 저장 시 320x320(또는 스펙에 명시된 배율)로 확대되며 `imageSmoothingEnabled = false`가 적용되어 픽셀 경계가 선명한지
   - 빈 칸이 실제로 투명(alpha 0)으로 저장되는지
   - 다크모드 토글 시 canvas 격자가 다시 그려지는지 (CSS만으로는 canvas 내부가 바뀌지 않으므로)

## 완료 기준

- 16x16 격자가 렌더링되고, 클릭 및 드래그로 칠해진다.
- 팔레트에서 색을 고르면 이후 칠하는 색이 바뀌고, 커스텀 색상 선택도 동작한다.
- 지우개 도구로 칠한 칸을 지울 수 있다.
- 전체 지우기 버튼이 모든 칸을 초기화한다.
- "PNG로 저장" 버튼을 누르면 확대된 PNG 파일이 다운로드되고, 빈 칸은 투명하게 저장된다.
- 모바일 터치로도 드래그 드로잉이 가능하고, 그리는 동안 페이지가 스크롤되지 않는다.
- 다크모드가 블로그와 동일한 `localStorage['theme']` 방식으로 동작하며 캔버스도 테마에 맞게 다시 그려진다.
- 뒤로가기 링크가 블로그 루트로 정확히 연결된다.

작업이 끝나면 무엇을 만들었는지, spec.md와 다르게 구현한 부분이 있다면 무엇이고 왜인지 간단히 보고해라.
