# 픽셀 아트 에디터 — 구현 스펙 (Build 서브에이전트용)

## 0. 개요

16x16 격자에 마우스(클릭/드래그) 또는 터치(탭/드래그)로 도트를 찍어 그림을 그리는 미니 픽셀 아트 에디터.
색상 팔레트에서 색을 고르거나 커스텀 색상을 선택해 칠할 수 있고, 지우개 도구와 전체 지우기 기능을 제공하며, 완성한 그림을 PNG 파일로 다운로드할 수 있다.

순수 HTML/CSS/JavaScript(바닐라), 외부 라이브러리·빌드 도구 없음(canvas API는 브라우저 내장이므로 사용). `/apps/pixel-art/` 폴더 안에서 완전히 자체 완결.

이 스펙 문서에 명시된 파일만 생성한다. 블로그의 다른 파일(`index.html`, `css/`, `js/`, `content/`)과 `/apps/2048/`은 이번 Build 단계에서 건드리지 않는다.

## 1. 파일 구조

```
/apps/pixel-art/
  index.html      # 에디터 페이지 마크업
  style.css       # 스타일 (다크모드, 반응형)
  editor.js       # 에디터 로직 전체 (상태, 입력, 렌더링, PNG 내보내기)
  spec.md         # 본 문서
```

3개 코드 파일로 충분하다(`/apps/2048/`과 동일한 구성 관례). 별도 assets 폴더는 불필요.

## 2. 격자 구현 방식 결정: `<canvas>` vs div 256개

**결론: `<canvas>` 하나로 구현한다.** 이유는 다음과 같다.

1. **터치 드래그 처리 통일**: Pointer Events(`pointerdown`/`pointermove`/`pointerup`)를 캔버스 엘리먼트 하나에만 바인딩하고, 좌표 → 셀(row, col) 계산 함수 하나로 마우스와 터치를 동일하게 처리할 수 있다. div 256개 방식은 마우스는 `mouseenter`로 자연스럽게 셀 전환을 감지할 수 있지만, 터치는 손가락이 이동해도 이벤트가 `touchstart` 시점의 엘리먼트에서만 발생하므로 매 `touchmove`마다 `document.elementFromPoint()`로 현재 손가락 아래의 엘리먼트를 다시 찾아야 한다. 결국 좌표 계산이 필요한 건 canvas 방식과 마찬가지인데 DOM 탐색 비용까지 추가된다.
2. **반응형/격자선 처리**: canvas는 CSS 표시 크기와 backing store 해상도(`devicePixelRatio`)를 분리해서 관리하기 쉽고, 리사이즈 시 셀 크기를 계산식 하나로 다시 그리면 끝난다. 격자선도 한 번의 루프로 깔끔하게 그릴 수 있다. div grid는 셀 border로 격자선을 표현하면 인접 셀 border가 겹쳐 두꺼워 보이는 문제를 추가로 처리해야 한다.
3. **PNG 내보내기와 로직 공유**: 어차피 PNG 저장에는 canvas API(`toBlob`/`toDataURL`)가 필요하다. 편집 화면도 canvas로 통일하면 "픽셀 데이터 배열 → 화면에 그리기"와 "픽셀 데이터 배열 → 내보내기용 canvas에 그리기"가 같은 데이터 구조(16x16 배열)를 그대로 재사용하는 유사한 코드 경로가 되어 유지보수가 쉽다. div 방식이면 편집 화면(DOM)과 내보내기(canvas)가 서로 다른 렌더링 방식이라 변환 코드가 이원화된다.
4. 16x16=256칸 규모에서는 두 방식 다 성능 문제는 없다(이 항목은 선택 근거가 아니라 참고용).

## 3. index.html 설계

- `lang="ko"`, `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수.
- `<title>픽셀 아트 에디터 | My Blog</title>`
- `<link rel="stylesheet" href="style.css">`
- 블로그로 돌아가는 링크: `/apps/pixel-art/index.html` 기준 블로그 루트까지 두 단계 위이므로 `<a class="back-link" href="../../index.html">← 블로그로</a>` (2048과 동일한 상대 경로 깊이).
- 헤더 영역: 뒤로가기 링크 + 다크모드 토글 버튼(`#theme-toggle`, 2048과 동일한 아이디/이모지 방식이되 독립 스크립트로 구현).
- 제목/설명: `<h1>픽셀 아트 에디터</h1>`, `<p>16x16 격자에 그림을 그려보세요.</p>`
- 에디터 레이아웃(`.editor-layout`): 캔버스 영역(`.canvas-wrap`)과 도구 패널(`.tools-panel`)을 좌우(데스크톱)/상하(모바일)로 배치.
  - `.canvas-wrap` 안에 `<canvas id="pixel-canvas">` 하나. `width`/`height` attribute는 JS가 초기화 시 `devicePixelRatio`를 반영해 동적으로 설정하므로 마크업에는 생략(또는 placeholder로 `320`/`320`을 넣어도 무방, JS가 덮어씀).
  - `.tools-panel` 안에:
    - 현재 색상 표시(`.current-color-row`): 라벨 + `#current-color-preview`(색상 스와치 박스)
    - 팔레트(`#palette`): 미리 정의된 색상 스와치 버튼들이 JS로 렌더링되는 컨테이너
    - 커스텀 색상(`.custom-color-row`): `<label for="custom-color">커스텀 색상</label>` + `<input type="color" id="custom-color" value="#000000">`
    - 도구 버튼(`.tool-buttons`): `#draw-tool-btn`("✏️ 그리기", 기본 `active`), `#eraser-tool-btn`("🧹 지우개")
    - 액션 버튼(`.action-buttons`): `#clear-btn`("전체 지우기"), `#download-btn`("PNG로 저장", `.primary` 스타일)
- 하단 안내 텍스트: "마우스로 클릭하거나 드래그해서 칠하세요. 모바일에서는 손가락으로 그리세요."
- 스크립트 로드: `<script src="editor.js"></script>` 하나만 (IIFE로 캡슐화).

### DOM 스켈레톤 예시

```html
<body>
  <div class="app-shell">
    <header class="app-header">
      <a class="back-link" href="../../index.html">← 블로그로</a>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="테마 전환">🌙</button>
    </header>

    <h1 class="app-title">픽셀 아트 에디터</h1>
    <p class="app-desc">16x16 격자에 그림을 그려보세요.</p>

    <div class="editor-layout">
      <div class="canvas-wrap">
        <canvas id="pixel-canvas" width="320" height="320"
                aria-label="16x16 픽셀 아트 캔버스, 클릭 또는 드래그로 색칠"></canvas>
      </div>

      <div class="tools-panel">
        <div class="current-color-row">
          <span class="current-color-label">현재 색상</span>
          <span id="current-color-preview" class="current-color-preview"></span>
        </div>

        <div id="palette" class="palette" role="group" aria-label="색상 팔레트"></div>

        <div class="custom-color-row">
          <label for="custom-color">커스텀 색상</label>
          <input type="color" id="custom-color" value="#000000">
        </div>

        <div class="tool-buttons" role="group" aria-label="도구 선택">
          <button id="draw-tool-btn" class="tool-btn active" type="button">✏️ 그리기</button>
          <button id="eraser-tool-btn" class="tool-btn" type="button">🧹 지우개</button>
        </div>

        <div class="action-buttons">
          <button id="clear-btn" class="action-btn" type="button">전체 지우기</button>
          <button id="download-btn" class="action-btn primary" type="button">PNG로 저장</button>
        </div>
      </div>
    </div>

    <p class="hint">마우스로 클릭하거나 드래그해서 칠하세요. 모바일에서는 손가락으로 그리세요.</p>
  </div>

  <script src="editor.js"></script>
</body>
```

## 4. style.css 설계

### 4.1 색상/변수

블로그·2048과 동일한 변수 네이밍(`--bg`, `--fg`, `--muted`, `--accent`, `--border`)을 그대로 사용하고, 에디터 전용 변수를 추가한다. 라이트 기본값 + `prefers-color-scheme: dark` + `[data-theme]` 오버라이드를 2048과 동일한 패턴으로 둔다.

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --accent: #2563eb;
  --border: #e5e5e5;

  --cell-bg: rgba(0, 0, 0, 0.04);      /* 캔버스 안, 색이 칠해지지 않은 빈 셀 */
  --grid-line: var(--border);           /* 캔버스 격자선 색 */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121212;
    --fg: #eaeaea;
    --muted: #a0a0a0;
    --accent: #6ea8fe;
    --border: #2e2e2e;
    --cell-bg: rgba(255, 255, 255, 0.06);
  }
}

[data-theme="dark"] {
  --bg: #121212;
  --fg: #eaeaea;
  --muted: #a0a0a0;
  --accent: #6ea8fe;
  --border: #2e2e2e;
  --cell-bg: rgba(255, 255, 255, 0.06);
}
```

캔버스 안의 배경색/빈 셀 색/격자선 색은 CSS로 직접 칠해지는 게 아니라, editor.js가 `getComputedStyle`로 `--bg`, `--cell-bg`, `--grid-line` 값을 읽어 `ctx.fillStyle`/`ctx.strokeStyle`에 사용한다(canvas 내부는 CSS가 직접 적용되지 않으므로 4.2절 및 5절 참고).

### 4.2 레이아웃

- `body`: 블로그와 동일한 폰트 스택(`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) 상속, `background: var(--bg); color: var(--fg);`
- `.app-shell`: `max-width: 700px; margin: 0 auto; padding: 1.5rem 1rem;` (팔레트 패널까지 포함하므로 2048의 480px보다 넓게 잡음)
- `.app-header`: `display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-bottom:1rem;` (2048의 `.game-header`와 동일한 구조)
- `.back-link`: `color: var(--accent); text-decoration: none; font-size: 0.95rem;`
- `.theme-toggle`: `background:none; border:1px solid var(--border); border-radius:6px; padding:0.35rem 0.6rem; cursor:pointer; color:var(--fg); min-width:44px; min-height:44px;`
- `.app-title`: `margin:0 0 0.25rem; font-size:2rem; text-align:center;`
- `.app-desc`: `margin:0 0 1.25rem; color:var(--muted); text-align:center;`
- `.editor-layout`: `display:flex; gap:1.5rem; align-items:flex-start; justify-content:center; flex-wrap:wrap;`
- `.canvas-wrap`: `flex:0 0 auto; width:100%; max-width:400px; aspect-ratio:1/1;` — 정사각형 유지, 뷰포트 폭에 맞춰 축소.
- `#pixel-canvas`: `width:100%; height:100%; display:block; border-radius:8px; border:1px solid var(--border); background:var(--bg); touch-action:none; cursor:crosshair;` — `touch-action:none`으로 터치 드래그 시 페이지 스크롤/확대 제스처와 충돌 방지(2048의 `#board`와 동일한 목적).
- `.tools-panel`: `flex:1 1 240px; max-width:320px; width:100%; display:flex; flex-direction:column; gap:1rem;`
- `.current-color-row`: `display:flex; align-items:center; gap:0.5rem;`
- `.current-color-preview`: `display:inline-block; width:32px; height:32px; border-radius:6px; border:1px solid var(--border);`
- `.palette`: `display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem;`
- `.swatch`: `width:100%; aspect-ratio:1/1; min-width:36px; min-height:36px; border-radius:6px; border:2px solid var(--border); cursor:pointer; padding:0;`
- `.swatch.selected`: `border-color:var(--accent); box-shadow:0 0 0 2px var(--accent);`
- `.custom-color-row`: `display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;`
- `#custom-color`: `min-width:44px; min-height:44px; border:1px solid var(--border); border-radius:6px; background:none; cursor:pointer; padding:2px;`
- `.tool-buttons`, `.action-buttons`: `display:flex; gap:0.75rem; flex-wrap:wrap;`
- `.tool-btn`, `.action-btn`: `flex:1 1 auto; min-height:44px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--fg); cursor:pointer; font-weight:600; padding:0.5rem 0.75rem; font-size:0.9rem;`
- `.tool-btn.active`: `background:var(--accent); color:#fff; border-color:var(--accent);`
- `.action-btn.primary`: `background:var(--accent); color:#fff; border-color:var(--accent);`
- `.hint`: `text-align:center; color:var(--muted); font-size:0.9rem; margin-top:1.25rem;`

### 4.3 반응형

```css
@media (max-width: 680px) {
  .editor-layout { flex-direction: column; align-items: center; }
  .tools-panel { max-width: 400px; }
}
@media (max-width: 480px) {
  .app-shell { padding: 1rem 0.75rem; }
  .app-title { font-size: 1.5rem; }
  .canvas-wrap { max-width: 100%; }
  .palette { grid-template-columns: repeat(4, 1fr); }
}
```

모바일에서는 캔버스가 위, 도구 패널이 아래로 쌓이는 세로 배치가 된다.

## 5. editor.js 설계

전체를 `(function () { ... })();` IIFE로 감싸 전역 오염을 방지한다. `DOMContentLoaded` 시점에 초기화한다.

### 5.1 상태 데이터 구조

```js
var GRID_SIZE = 16;
var STORAGE_KEY_THEME = 'theme'; // 블로그(js/theme.js)와 동일한 key 공유
var EXPORT_SCALE = 20;           // PNG 저장 시 셀당 확대 배율 (5.6절 참고)

var DEFAULT_PALETTE = [
  '#000000', '#7f7f7f', '#ffffff', '#c3c3c3',
  '#ed1c24', '#ff7f27', '#fff200', '#22b14c',
  '#00a2e8', '#3f48cc', '#a349a4', '#ffaec9',
  '#b97a57', '#ffc90e', '#99d9ea', '#c8bfe7'
];

var pixels = [];          // number[16][16], 각 칸은 색상 문자열('#rrggbb') 또는 null(빈 칸/투명)
var currentColor = DEFAULT_PALETTE[0];
var currentTool = 'draw'; // 'draw' | 'erase'
var isPointerDown = false;
var lastPaintedCell = null; // { row, col } — 같은 칸 재도색으로 인한 불필요한 재렌더 방지
```

보드는 16x16 2차원 배열로 관리한다(2048의 board 관리 방식과 동일한 철학: 단순 배열 + 매번 전체 재렌더, 256칸 규모라 성능 문제 없음).

### 5.2 핵심 함수 목록

| 함수 | 역할 |
|---|---|
| `createEmptyGrid()` | 16x16 `null`로 채운 배열 반환 |
| `resizeCanvasForDPR()` | `devicePixelRatio`를 반영해 canvas의 실제 backing store 크기와 CSS 표시 크기를 동기화 |
| `getThemeColors()` | `getComputedStyle`로 `--bg`/`--cell-bg`/`--grid-line` 현재 값을 읽어 반환 |
| `drawGrid()` | `pixels` 배열 전체를 캔버스에 다시 그림(배경 → 셀 채우기 → 격자선) |
| `getCellFromPointerEvent(e)` | pointer 이벤트의 clientX/Y를 캔버스 좌표로 변환 후 (row, col) 계산, 0~15 범위로 clamp |
| `paintCell(row, col)` | 현재 도구/색상에 따라 `pixels[row][col]` 갱신, 값이 바뀌었을 때만 `drawGrid()` 호출 |
| `handlePointerDown(e)` / `handlePointerMove(e)` / `endStroke(e)` | 드로우 모드(클릭/드래그로 칠하기) 이벤트 처리 — 5.4절 pseudo-code 참고 |
| `renderPalette()` | `DEFAULT_PALETTE`를 `#palette`에 스와치 버튼으로 렌더링 |
| `selectColor(color)` | `currentColor` 갱신 + 도구를 `'draw'`로 전환 + 선택 상태 UI 갱신 |
| `updateSelectedSwatch()` | 현재 `currentColor`와 일치하는 스와치에 `.selected` 클래스 부여 |
| `updateToolButtons()` | `currentTool`에 따라 `#draw-tool-btn`/`#eraser-tool-btn`에 `.active` 클래스 토글 |
| `updateCurrentColorPreview()` | `#current-color-preview`의 배경색을 `currentColor`로 갱신 |
| `handleClear()` | `confirm()`으로 확인 후 `pixels` 전체를 빈 칸으로 초기화하고 다시 그림 |
| `exportPNG()` | `pixels` 배열을 PNG Blob으로 변환해 다운로드 — 5.6절 pseudo-code 참고 |
| `syncThemeFromStorage()` / `toggleTheme()` | `localStorage['theme']` 기반 다크모드 동기화/토글(2048 game.js와 동일 패턴), 토글 시 `drawGrid()`도 다시 호출 |
| `debounce(fn, wait)` | 리사이즈 핸들러 디바운스용 유틸 |

### 5.3 캔버스 초기화 및 렌더링 pseudo-code

```
function resizeCanvasForDPR():
    dpr = window.devicePixelRatio || 1
    rect = canvasWrapEl.getBoundingClientRect()   # .canvas-wrap은 aspect-ratio:1/1이라 정사각형
    displaySize = round(rect.width)

    canvas.style.width = displaySize + 'px'
    canvas.style.height = displaySize + 'px'
    canvas.width = round(displaySize * dpr)
    canvas.height = round(displaySize * dpr)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    # 이후 그리기 좌표는 모두 CSS px 기준으로 다루면 된다 (dpr 보정은 transform이 대신 처리)

function getThemeColors():
    styles = getComputedStyle(document.documentElement)
    return {
        bg: styles.getPropertyValue('--bg').trim(),
        emptyCell: styles.getPropertyValue('--cell-bg').trim(),
        gridLine: styles.getPropertyValue('--grid-line').trim()
    }

function drawGrid():
    rect = canvas.getBoundingClientRect()   # CSS px 기준 정사각형 크기
    cellSize = rect.width / GRID_SIZE
    colors = getThemeColors()

    ctx.clearRect(0, 0, rect.width, rect.height)
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, rect.width, rect.height)

    for r in 0..15:
        for c in 0..15:
            color = pixels[r][c]
            ctx.fillStyle = color ? color : colors.emptyCell
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)

    # 격자선 (1px 선명하게: 정수 좌표 + 0.5 보정)
    ctx.strokeStyle = colors.gridLine
    ctx.lineWidth = 1
    for i in 0..16:
        pos = round(i * cellSize) + 0.5
        ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, rect.height); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(rect.width, pos); ctx.stroke()
```

`drawGrid()`는 테마 토글, 리사이즈, 픽셀 변경 등 상태가 바뀔 때마다 전체를 다시 그리는 단순한 방식을 쓴다(256칸이라 비용 미미, 2048의 "전체 재생성" 철학과 동일).

### 5.4 드래그로 칠하기 (Pointer Events) pseudo-code

Pointer Events(`pointerdown`/`pointermove`/`pointerup`/`pointercancel`)는 마우스와 터치를 동일한 API로 처리하므로 별도의 mouse/touch 분기 없이 하나의 로직으로 구현한다(현대 브라우저·모바일 Safari 포함 모두 지원). `canvas.setPointerCapture()`로 포인터를 캡처해 두면 손가락/마우스가 캔버스 경계를 살짝 벗어나도 `pointermove`/`pointerup`이 계속 캔버스로 전달된다.

```
function getCellFromPointerEvent(e):
    rect = canvas.getBoundingClientRect()
    x = e.clientX - rect.left
    y = e.clientY - rect.top
    cellSize = rect.width / GRID_SIZE
    col = floor(x / cellSize)
    row = floor(y / cellSize)
    col = clamp(col, 0, GRID_SIZE - 1)   # 경계 밖으로 드래그해도 가장자리 칸이 계속 칠해지도록 보정
    row = clamp(row, 0, GRID_SIZE - 1)
    return { row, col }

function paintCell(row, col):
    newValue = (currentTool === 'erase') ? null : currentColor
    if pixels[row][col] === newValue: return   # 변화 없으면 재렌더 생략
    pixels[row][col] = newValue
    drawGrid()

function handlePointerDown(e):
    e.preventDefault()                          # 터치 스크롤/길게 누르기 컨텍스트 메뉴 방지
    canvas.setPointerCapture(e.pointerId)
    isPointerDown = true
    cell = getCellFromPointerEvent(e)
    lastPaintedCell = cell
    paintCell(cell.row, cell.col)               # 클릭만 해도 즉시 한 칸 칠해짐

function handlePointerMove(e):
    if not isPointerDown: return
    e.preventDefault()
    cell = getCellFromPointerEvent(e)
    if lastPaintedCell and cell.row === lastPaintedCell.row and cell.col === lastPaintedCell.col:
        return                                   # 같은 칸 안에서는 다시 칠하지 않음(불필요한 재렌더 방지)
    lastPaintedCell = cell
    paintCell(cell.row, cell.col)

function endStroke(e):
    isPointerDown = false
    lastPaintedCell = null
    if canvas.hasPointerCapture(e.pointerId):
        canvas.releasePointerCapture(e.pointerId)

# 바인딩 (모두 canvas 하나에만)
canvas.addEventListener('pointerdown', handlePointerDown)
canvas.addEventListener('pointermove', handlePointerMove)
canvas.addEventListener('pointerup', endStroke)
canvas.addEventListener('pointercancel', endStroke)
```

이 방식으로 "마우스 다운 후 드래그하면 지나가는 칸들도 같은 색으로 칠해지는" 드로우 모드가 마우스와 터치 모두에서 동일하게 동작한다.

### 5.5 팔레트/도구 UI pseudo-code

```
function renderPalette():
    paletteEl.innerHTML = ''
    for color in DEFAULT_PALETTE:
        btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'swatch'
        btn.style.backgroundColor = color
        btn.dataset.color = color
        btn.setAttribute('aria-label', color)
        btn.addEventListener('click', function() { selectColor(color) })
        paletteEl.appendChild(btn)
    updateSelectedSwatch()

function selectColor(color):
    currentColor = color
    currentTool = 'draw'                        # 색을 고르면 자동으로 그리기 도구로 전환
    updateSelectedSwatch()
    updateToolButtons()
    updateCurrentColorPreview()

function updateSelectedSwatch():
    for btn in paletteEl.querySelectorAll('.swatch'):
        btn.classList.toggle('selected', btn.dataset.color === currentColor)

function updateToolButtons():
    drawToolBtn.classList.toggle('active', currentTool === 'draw')
    eraserToolBtn.classList.toggle('active', currentTool === 'erase')

function updateCurrentColorPreview():
    currentColorPreviewEl.style.backgroundColor = currentColor

function handleClear():
    if not confirm('전체 그림을 지우시겠습니까?'): return
    pixels = createEmptyGrid()
    drawGrid()

# 바인딩
customColorInput.addEventListener('input', function(e) { selectColor(e.target.value) })
drawToolBtn.addEventListener('click', function() { currentTool = 'draw'; updateToolButtons() })
eraserToolBtn.addEventListener('click', function() { currentTool = 'erase'; updateToolButtons() })
clearBtn.addEventListener('click', handleClear)
```

지우개 도구는 `currentTool = 'erase'`로 전환만 하고 `currentColor`는 그대로 보존한다(지우개를 껐다 켜도 이전에 고르던 색이 유지되도록). 커스텀 색상(`<input type="color">`)에서 색을 고르면 `selectColor()`가 호출되어 팔레트 스와치의 `.selected`는 자동으로 해제된다(어느 스와치의 `dataset.color`도 커스텀 값과 일치하지 않으므로).

### 5.6 PNG 저장 로직 pseudo-code

**설계 결정: 16x16 원본 그대로가 아니라 320x320(셀당 20px)로 확대해서 저장한다.** 16x16 그대로 저장하면 대부분의 이미지 뷰어/미리보기에서 점 하나 크기로 보여 실용성이 없다. 확대 시 반드시 `imageSmoothingEnabled = false`를 설정해 안티앨리어싱(자동 블러) 없이 픽셀 경계가 선명하게 유지되도록 한다 — 이게 없으면 `drawImage()`로 16x16 → 320x320 확대할 때 브라우저 기본 보간(bilinear)이 적용되어 픽셀 아트 특유의 선명한 계단 경계 대신 뿌옇게 뭉개진 이미지가 된다.

내보내기는 화면에 보이는 편집용 canvas(빈 칸을 `--cell-bg`로 칠하고 격자선을 그리는 canvas)를 직접 캡처하지 않는다. 빈 칸이 실제 투명(alpha 0)이어야 하고 격자선도 결과물에 없어야 하므로, **별도의 두 단계 임시 canvas**를 만들어 처리한다.

```
function exportPNG():
    # 1단계: 16x16 1:1 캔버스에 "순수 픽셀 데이터"만 그리기 (배경/격자선 없음, 빈 칸은 투명)
    small = document.createElement('canvas')
    small.width = GRID_SIZE
    small.height = GRID_SIZE
    sctx = small.getContext('2d')
    sctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE)
    for r in 0..15:
        for c in 0..15:
            color = pixels[r][c]
            if color:
                sctx.fillStyle = color
                sctx.fillRect(c, r, 1, 1)
            # color가 null이면 그대로 둔다 → 기본적으로 alpha 0 (투명) 유지

    # 2단계: 320x320으로 확대 (셀당 20px), 안티앨리어싱 끄기
    big = document.createElement('canvas')
    big.width = GRID_SIZE * EXPORT_SCALE   # 16 * 20 = 320
    big.height = GRID_SIZE * EXPORT_SCALE
    bctx = big.getContext('2d')
    bctx.imageSmoothingEnabled = false     # 핵심: 확대 시 픽셀 경계 선명하게 유지
    bctx.drawImage(small, 0, 0, big.width, big.height)

    # 3단계: PNG로 변환 후 다운로드
    if big.toBlob (존재하면):
        big.toBlob(function(blob):
            url = URL.createObjectURL(blob)
            triggerDownload(url)
            setTimeout(function() { URL.revokeObjectURL(url) }, 1000)
        , 'image/png')
    else:                                   # 구형 브라우저 fallback
        url = big.toDataURL('image/png')
        triggerDownload(url)

function triggerDownload(url):
    a = document.createElement('a')
    a.href = url
    a.download = 'pixel-art.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

downloadBtn.addEventListener('click', exportPNG)
```

### 5.7 테마 (2048 game.js와 동일 패턴, 블로그와 `localStorage['theme']` 키 공유)

```
function currentTheme():
    attr = root.getAttribute('data-theme')
    if attr === 'light' or attr === 'dark': return attr
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

function updateToggleLabel():
    themeToggleBtn.textContent = currentTheme() === 'dark' ? '☀' : '🌙'

function syncThemeFromStorage():
    stored = localStorage.getItem(STORAGE_KEY_THEME)
    if stored === 'light' or stored === 'dark':
        root.setAttribute('data-theme', stored)
    updateToggleLabel()

function toggleTheme():
    next = currentTheme() === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', next)
    localStorage.setItem(STORAGE_KEY_THEME, next)
    updateToggleLabel()
    drawGrid()   # --bg/--cell-bg/--grid-line 값이 바뀌므로 캔버스를 반드시 다시 그려야 함
```

### 5.8 초기화 흐름

```
DOMContentLoaded:
    canvas = #pixel-canvas, ctx = canvas.getContext('2d')
    canvasWrapEl = .canvas-wrap
    paletteEl = #palette, customColorInput = #custom-color
    currentColorPreviewEl = #current-color-preview
    drawToolBtn = #draw-tool-btn, eraserToolBtn = #eraser-tool-btn
    clearBtn = #clear-btn, downloadBtn = #download-btn
    themeToggleBtn = #theme-toggle

    pixels = createEmptyGrid()

    syncThemeFromStorage()
    renderPalette()
    updateToolButtons()
    updateCurrentColorPreview()
    resizeCanvasForDPR()
    drawGrid()

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', endStroke)
    canvas.addEventListener('pointercancel', endStroke)

    customColorInput.addEventListener('input', ...)
    drawToolBtn.addEventListener('click', ...)
    eraserToolBtn.addEventListener('click', ...)
    clearBtn.addEventListener('click', handleClear)
    downloadBtn.addEventListener('click', exportPNG)
    themeToggleBtn.addEventListener('click', toggleTheme)

    window.addEventListener('resize', debounce(function() {
        resizeCanvasForDPR()
        drawGrid()
    }, 100))
```

## 6. UI/스타일 방향

- **다크모드**: 2048과 동일하게 `localStorage['theme']` 키 + `data-theme` 속성 패턴을 독립 구현으로 재사용해 블로그와 시각적으로 통일한다. 앱을 블로그 없이 단독으로 열어도 `prefers-color-scheme`로 자동 대응. 캔버스 내부 색상은 CSS가 직접 적용되지 않으므로, 테마가 바뀔 때마다 `drawGrid()`를 다시 호출해 최신 CSS 변수 값을 반영해야 한다는 점이 2048과의 핵심 차이(2048은 DOM 기반이라 CSS만으로 테마 전환이 자동 반영됨).
- **반응형**: `.canvas-wrap`은 `max-width:400px`에서 시작해 뷰포트가 좁아지면 `width:100%`로 줄어드는 정사각형(`aspect-ratio:1/1`). 680px 이하에서는 도구 패널이 캔버스 아래로 쌓인다.
- **색상 팔레트**: MS Paint류의 익숙한 16색 기본 팔레트(5.1절 `DEFAULT_PALETTE`)를 4x4 그리드로 배치하고, 부족하면 `<input type="color">`로 임의 색상을 고를 수 있다.
- **톤**: 2048과 동일한 `--accent`(파란 계열)를 선택 상태(스와치 테두리, 활성 도구 버튼, PNG 저장 버튼)의 포인트 컬러로 사용해 두 앱 사이 통일감을 준다.
- **타이포그래피**: 블로그 폰트 스택을 그대로 상속.

## 7. 접근성/모바일 고려사항

- `#pixel-canvas`에 `aria-label="16x16 픽셀 아트 캔버스, 클릭 또는 드래그로 색칠"` 부여. 캔버스 자체는 스크린 리더로 그림을 그리는 조작이 불가능하다는 한계는 그림 그리기 앱의 본질적 특성으로 감수한다(2048의 방향키 기반 보드도 완전한 스크린 리더 조작성을 제공하지 않는 것과 같은 수준).
- 팔레트 스와치, 도구 버튼, 액션 버튼, 테마 토글은 모두 `<button type="button">`으로 키보드 포커스/엔터 조작 가능해야 한다.
- 모든 버튼과 `<input type="color">`는 최소 44x44px 터치 타겟 크기 확보(`.swatch`도 `min-width/height:36px` — 4열 그리드에서 패널 폭 안에 맞추기 위한 절충, 필요 시 `.tools-panel` 폭을 넓혀 36px 이상 확보해도 됨).
- **터치 드래그**: `#pixel-canvas`에 `touch-action:none`을 CSS로 지정하고, `pointerdown`/`pointermove` 핸들러에서 `e.preventDefault()`를 호출해 손가락으로 그리는 동안 페이지 스크롤/핀치줌과 충돌하지 않게 한다.
- 색상은 스와치 배경색과 함께 `aria-label`(hex 값 텍스트)도 제공하므로 색약 사용자도 어떤 색인지 스크린 리더로 확인 가능.
- `#custom-color`(`<input type="color">`)는 브라우저 기본 색상 선택기를 그대로 사용하므로 자체 키보드/터치 접근성은 브라우저가 보장한다.

## 8. Review 단계 체크리스트 (참고용, Build 범위 아님)

- 클릭 한 번으로 셀 하나가 즉시 칠해지는지
- 마우스 드래그 시 지나가는 모든 칸이 같은 색으로 칠해지는지 (같은 칸에 머무를 때 중복 렌더가 과도하게 발생하지 않는지)
- 모바일 터치 드래그로도 동일하게 칠해지고, 드래그 중 페이지가 스크롤되지 않는지
- 팔레트 스와치를 클릭하면 색이 바뀌고 `.selected` 표시가 정확히 이동하는지
- 커스텀 색상(`<input type="color">`)으로 고른 색이 정상적으로 칠해지고, 팔레트 스와치의 선택 표시는 해제되는지
- 지우개 도구가 칸을 투명(빈 칸)으로 되돌리는지, 지우개→그리기 전환 시 이전 색상이 유지되는지
- "전체 지우기" 클릭 시 확인창이 뜨고, 확인 시에만 전체가 초기화되는지
- "PNG로 저장" 클릭 시 320x320 PNG 파일이 다운로드되고, 빈 칸은 투명하게, 칠한 칸은 안티앨리어싱 없이 선명한 픽셀 경계로 저장되는지 (이미지 뷰어에서 확대해 픽셀 경계가 뭉개지지 않았는지 확인)
- 다크모드 토글 시 캔버스 배경/빈 셀/격자선 색이 즉시 다시 그려지는지 (토글 후 `drawGrid()` 누락 여부 확인)
- 창 크기 조절(리사이즈) 시 캔버스가 깨지지 않고 격자가 다시 올바르게 그려지는지
- 모바일 뷰포트(375px 등)에서 캔버스와 도구 패널이 세로로 잘 배치되고 잘리지 않는지
- `../../index.html` 상대경로가 실제로 블로그 루트로 정확히 연결되는지
