# 2048 게임 — 구현 스펙 (Build 서브에이전트용)

## 0. 개요

방향키(↑↓←→) 또는 모바일 스와이프로 4x4 격자의 숫자 타일을 밀어 같은 숫자끼리 합치는 퍼즐 게임.
순수 HTML/CSS/JavaScript(바닐라), 외부 라이브러리·빌드 도구 없음. `/apps/2048/` 폴더 안에서 완전히 자체 완결.

이 스펙 문서에 명시된 파일만 생성한다. 블로그의 다른 파일(`index.html`, `css/`, `js/`, `content/`)은 이번 Build 단계에서 건드리지 않는다.

## 1. 파일 구조

```
/apps/2048/
  index.html      # 게임 페이지 마크업
  style.css       # 스타일 (다크모드, 반응형, 타일 애니메이션 포함)
  game.js         # 게임 로직 전체 (상태, 입력, 렌더링)
  spec.md         # 본 문서
```

3개 코드 파일로 충분하다. 별도 assets 폴더는 불필요(이모지/CSS로만 표현).

## 2. index.html 설계

- `lang="ko"`, `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수.
- `<title>2048 | My Blog</title>`
- `<link rel="stylesheet" href="style.css">`
- 블로그로 돌아가는 링크: `<a class="back-link" href="../../index.html">← 블로그로</a>` (앱이 블로그 루트 기준 `/apps/2048/`에 위치하므로 상대경로 `../../index.html`은 잘못된 깊이다 — `/apps/2048/index.html`에서 블로그 루트 `index.html`까지는 두 단계 위이므로 `../../index.html`이 아니라 `../../index.html`을 실제로는 `..\..\index.html`로 착각하지 않도록 Build 단계에서 직접 상대경로 깊이를 검증할 것. 정확히는 `apps/2048/` → 상위 `apps/` → 상위 루트이므로 `../../index.html`이 맞다).
- 헤더 영역: 게임 제목 "2048", 간단한 설명 문구("타일을 밀어 2048을 만드세요"), 다크모드 토글 버튼(`#theme-toggle`, 블로그와 동일한 아이디/이모지 방식이되 독립 스크립트로 구현).
- 점수판 영역(`.scoreboard`):
  - `.score-box`(현재 점수) — 라벨 "SCORE", 값 `#score`
  - `.score-box`(최고 점수) — 라벨 "BEST", 값 `#best-score`
  - `.new-game-btn`(`#new-game-btn`) — "새 게임" 버튼
- 게임 보드 영역(`#board-container` > `#board`):
  - `#board`는 배경 그리드(고정 16칸, 빈 셀 표시용 `.grid-cell` 16개)를 자식으로 가짐.
  - 실제 숫자 타일은 JS가 동적으로 `.tile` 요소를 생성해 `#board` 안에 절대 위치(`position:absolute`)로 배치한다(그리드 셀과는 별도 레이어).
  - 게임 종료/승리 오버레이: `#game-message`(`.game-message` 클래스, 기본 `hidden`), 내부에 메시지 텍스트(`#message-text`, 예: "게임 오버!" / "2048 달성!"), "다시 시도" 버튼(`#retry-btn`), 승리 시에는 "계속하기" 버튼(`#keep-playing-btn`)도 포함(둘 다 마크업에 넣고 JS가 상황에 따라 보이기/숨기기).
- 조작 안내 텍스트: 두 개의 span(`.hint-desktop`, `.hint-mobile`)을 넣고 미디어쿼리로 display 전환.
- 스크립트 로드: `<script src="game.js"></script>` 하나만 (IIFE로 캡슐화, 전역 오염 방지).

### DOM 스켈레톤 예시

```html
<body>
  <div class="app-shell">
    <header class="game-header">
      <a class="back-link" href="../../index.html">← 블로그로</a>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="테마 전환">🌙</button>
    </header>

    <h1 class="game-title">2048</h1>
    <p class="game-desc">타일을 밀어 같은 숫자를 합쳐보세요.</p>

    <div class="scoreboard">
      <div class="score-box">
        <span class="score-label">SCORE</span>
        <span class="score-value" id="score">0</span>
      </div>
      <div class="score-box">
        <span class="score-label">BEST</span>
        <span class="score-value" id="best-score">0</span>
      </div>
      <button id="new-game-btn" class="new-game-btn" type="button">새 게임</button>
    </div>

    <div id="board-container">
      <div id="board" role="application" aria-label="2048 게임 보드">
        <!-- 16개 .grid-cell 은 정적으로 넣거나 JS가 생성 -->
        <div id="game-message" class="game-message" hidden>
          <p id="message-text"></p>
          <div class="message-actions">
            <button id="retry-btn" type="button">다시 시도</button>
            <button id="keep-playing-btn" type="button" hidden>계속하기</button>
          </div>
        </div>
      </div>
    </div>

    <p class="hint">
      <span class="hint-desktop">방향키(↑↓←→)로 이동하세요</span>
      <span class="hint-mobile">보드를 스와이프해서 이동하세요</span>
    </p>
  </div>

  <script src="game.js"></script>
</body>
```

## 3. style.css 설계

### 3.1 색상/변수

블로그의 변수 네이밍(`--bg`, `--fg`, `--muted`, `--accent`, `--border`)을 재사용하되, 2048 전용 타일 색상 변수를 추가한다. 라이트 기본값 + `prefers-color-scheme: dark` + `[data-theme="dark"]`/`[data-theme="light"]` 오버라이드를 블로그와 동일한 패턴으로 둔다(game.js가 블로그와 같은 `localStorage['theme']` 키를 공유해서 동기화).

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --accent: #2563eb;
  --border: #e5e5e5;

  --board-bg: #bbada0;
  --cell-bg: rgba(238, 228, 218, 0.35);
  --tile-text-dark: #3c3a32;
  --tile-text-light: #f9f6f2;

  --tile-2: #eee4da;
  --tile-4: #ede0c8;
  --tile-8: #f2b179;
  --tile-16: #f59563;
  --tile-32: #f67c5f;
  --tile-64: #f65e3b;
  --tile-128: #edcf72;
  --tile-256: #edcc61;
  --tile-512: #edc850;
  --tile-1024: #edc53f;
  --tile-2048: #edc22e;
  --tile-super: #3c3a32; /* 4096 이상 */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121212;
    --fg: #eaeaea;
    --muted: #a0a0a0;
    --accent: #6ea8fe;
    --border: #2e2e2e;
    --board-bg: #3a3630;
    --cell-bg: rgba(255, 255, 255, 0.08);
  }
}

[data-theme="dark"] {
  --bg: #121212;
  --fg: #eaeaea;
  --muted: #a0a0a0;
  --accent: #6ea8fe;
  --border: #2e2e2e;
  --board-bg: #3a3630;
  --cell-bg: rgba(255, 255, 255, 0.08);
}
```

타일 값→색상 매핑은 CSS 속성 선택자로 처리: `.tile[data-value="2"]`, `.tile[data-value="4"]` ... `.tile[data-value="2048"]`, 4096 이상은 `.tile-super`(공통 진한 배경 + 흰 글씨, 폰트 크기 축소).

### 3.2 레이아웃

- `.app-shell`: `max-width: 480px; margin: 0 auto; padding: 1.5rem 1rem;` (블로그 `main#app`의 `max-width: 700px`보다 좁게 잡아 게임판에 맞춤).
- `#board-container`: `width: 100%; max-width: 420px; margin: 0 auto; aspect-ratio: 1 / 1;` — 정사각형 유지, 모바일에서도 화면 폭에 맞춰 축소.
- `#board`: `position: relative; width: 100%; height: 100%; background: var(--board-bg); border-radius: 8px; padding: 12px; box-sizing: border-box;`
- 배경 그리드(`.grid-cell` 16개): `display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 12px;` 이 grid 레이어가 `#board`를 꽉 채우고, 각 `.grid-cell`은 `background: var(--cell-bg); border-radius: 6px;`.
- `.tile`: `position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-weight: 700; box-sizing: border-box; transition: left 100ms ease-in-out, top 100ms ease-in-out, transform 100ms ease-in-out;` — `width`/`height`/`left`/`top`은 JS가 픽셀 값으로 계산해 인라인 스타일로 지정(4.4절 참고).
- 타일 폰트 크기는 자릿수에 따라 달라져야 하므로 `.tile[data-value]`의 길이에 따라 클래스(`.tile-digits-1~4`)를 부여하거나 CSS `clamp()`로 대응.

### 3.3 애니메이션

```css
@keyframes tile-appear {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes tile-merge {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.tile.tile-new { animation: tile-appear 150ms ease-out; }
.tile.tile-merged { animation: tile-merge 150ms ease-out; }
```

JS는 새로 생성된 타일에는 `tile-new` 클래스를, 병합으로 생긴 타일에는 `tile-merged` 클래스를 붙였다가 애니메이션 종료 후(또는 다음 렌더 시) 제거한다.

### 3.4 점수판/버튼 스타일

- `.scoreboard`: `display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;`
- `.score-box`: `background: var(--board-bg); color: #fff; border-radius: 6px; padding: 0.5rem 1rem; text-align: center; min-width: 70px;` — `.score-label`은 작은 대문자 텍스트, `.score-value`는 굵고 큰 숫자.
- `.new-game-btn`, `#retry-btn`, `#keep-playing-btn`: `background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.5rem 1rem; cursor: pointer; font-weight: 600;`
- `.game-message`: `position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; background: rgba(255,255,255,0.85); border-radius: 8px; text-align: center;` — 다크모드에서는 `background: rgba(18,18,18,0.85);`. `[hidden]` 속성으로 표시/숨김 제어.

### 3.5 반응형

```css
@media (max-width: 480px) {
  .app-shell { padding: 1rem 0.75rem; }
  .game-title { font-size: 1.5rem; }
  #board-container { max-width: 100%; }
  .hint-desktop { display: none; }
}
@media (min-width: 481px) {
  .hint-mobile { display: none; }
}
```

`#board`에는 `touch-action: none;`을 지정해 스와이프 시 브라우저 기본 스크롤/줌 제스처와 충돌하지 않도록 한다.

## 4. game.js 설계

전체를 `(function () { ... })();` IIFE로 감싸 전역 오염을 방지한다. `DOMContentLoaded` 시점에 초기화한다.

### 4.1 상태 데이터 구조

```js
const SIZE = 4;
const STORAGE_KEY_BEST = '2048-best-score';
const STORAGE_KEY_THEME = 'theme'; // 블로그(js/theme.js)와 동일한 key 공유

let state = {
  board: [],       // number[4][4], 0 = 빈 칸, 그 외는 2,4,8...
  score: 0,
  best: 0,
  isOver: false,
  hasWon: false,        // 2048 타일을 만든 적이 있는지
  keepPlaying: false,   // 승리 후에도 계속 플레이 중인지
};
```

보드는 단순 2차원 숫자 배열로 관리한다. 렌더링 시마다 DOM을 전부 새로 그려도 4x4=16칸이라 성능 문제 없음(간단함 우선).

### 4.2 핵심 함수 목록

| 함수 | 역할 |
|---|---|
| `createEmptyBoard()` | 4x4 0으로 채운 배열 반환 |
| `cloneBoard(board)` | 깊은 복사 |
| `getEmptyCells(board)` | 빈 칸 좌표 `{r,c}` 목록 반환 |
| `addRandomTile(board)` | 빈 칸 중 랜덤 위치에 90% 확률로 2, 10% 확률로 4 배치, 배치된 좌표 반환 |
| `slideAndMergeLine(line)` | 길이 4인 1차원 배열(왼쪽 방향 기준)을 압축+병합하여 `{ line, gained, moved }` 반환 — **핵심 알고리즘** |
| `rotateBoard(board, times)` | 보드를 90도 시계방향 * times 회전(모든 방향을 "왼쪽 이동" 로직 하나로 처리하기 위함) |
| `move(direction)` | `'up'\|'down'\|'left'\|'right'` 받아 보드 전체에 이동/병합 적용, 점수 갱신, 변화 있으면 새 타일 추가 |
| `isGameOver(board)` | 빈 칸이 없고 인접 타일 중 병합 가능한 쌍도 없으면 true |
| `checkWin(board)` | 보드에 2048 이상 값이 있는지 확인 |
| `render()` | 현재 `state`를 DOM에 반영(점수판, 타일, 오버레이) |
| `newGame()` | state 초기화, 빈 보드 + 타일 2개 생성 후 렌더 |
| `updateBest()` | `state.score > state.best`면 갱신 + `localStorage` 저장 |
| `loadBest()` | `localStorage`에서 최고 점수 로드 |
| `handleKeydown(e)` | 방향키 매핑 → `move()` 호출, `preventDefault()` |
| `handleTouchStart(e)` / `handleTouchEnd(e)` | 스와이프 좌표 계산 → 방향 판정 → `move()` 호출 |
| `syncThemeFromStorage()` | `localStorage['theme']` 읽어 `document.documentElement`에 `data-theme` 반영(블로그와 시각적 통일) |
| `toggleTheme()` | 테마 토글 버튼 클릭 시 라이트/다크 전환 + `localStorage` 저장 |

### 4.3 핵심 로직 pseudo-code

**슬라이드+병합 (한 줄, "왼쪽" 방향 기준으로 정규화):**

```
function slideAndMergeLine(line):
    values = line.filter(v => v !== 0)   # 압축: 빈칸 제거
    result = []
    gained = 0
    i = 0
    while i < values.length:
        if i+1 < values.length and values[i] === values[i+1]:
            merged = values[i] * 2
            result.push(merged)
            gained += merged
            i += 2                # 병합된 두 칸을 건너뜀 (같은 타일이 다시 병합되지 않도록)
        else:
            result.push(values[i])
            i += 1
    while result.length < 4:
        result.push(0)            # 남은 칸은 0으로 채움
    moved = !arraysEqual(result, line)
    return { line: result, gained, moved }
```

**방향별 처리 (회전으로 통일):**

```
DIRECTION_ROTATIONS = { left: 0, up: 1, right: 2, down: 3 }
# rotateBoard(board, n)은 n번 시계방향 90도 회전.
# 각 방향에 대해: 보드를 회전시켜 "왼쪽 이동" 문제로 바꾼 뒤, 처리 후 반대 방향으로 되돌린다.

function move(direction):
    if state.isOver: return
    if state.hasWon and not state.keepPlaying: return

    rot = DIRECTION_ROTATIONS[direction]
    board = rotateBoard(state.board, rot)

    moved = false
    totalGained = 0

    for each row in board (4개):
        { line, gained, moved: rowMoved } = slideAndMergeLine(row)
        board[rowIndex] = line
        totalGained += gained
        if rowMoved: moved = true

    board = rotateBoard(board, (4 - rot) % 4)   # 원래 방향으로 되돌림

    if not moved:
        return   # 보드에 변화 없으면 아무 것도 하지 않음(새 타일 생성 X)

    state.board = board
    state.score += totalGained
    updateBest()
    newTilePos = addRandomTile(state.board)

    if not state.hasWon and checkWin(state.board):
        state.hasWon = true
        # 승리 오버레이 표시, "계속하기"/"다시 시작" 버튼 노출

    if isGameOver(state.board):
        state.isOver = true
        # 게임 오버 오버레이 표시

    render(newTilePos)
```

**rotateBoard(board, times):** 표준 2차원 배열 90도 시계방향 회전을 `times`번 반복 적용하는 순수 함수.

```
function rotateBoard(board, times):
    result = board
    repeat times:
        result = rotate90CW(result)
    return result

function rotate90CW(board):
    new_board = createEmptyBoard()
    for r in 0..3:
        for c in 0..3:
            new_board[c][SIZE-1-r] = board[r][c]
    return new_board
```

**랜덤 타일 생성:**

```
function addRandomTile(board):
    empties = getEmptyCells(board)
    if empties.length === 0: return null
    { r, c } = empties[random_index]
    board[r][c] = (Math.random() < 0.9) ? 2 : 4
    return { r, c }
```

**게임 오버 판정:**

```
function isGameOver(board):
    if getEmptyCells(board).length > 0: return false
    for r in 0..3:
        for c in 0..3:
            v = board[r][c]
            if c+1 < 4 and board[r][c+1] === v: return false   # 오른쪽 인접 병합 가능
            if r+1 < 4 and board[r+1][c] === v: return false   # 아래쪽 인접 병합 가능
    return true
```

**승리 판정:** `board.some(row => row.some(v => v >= 2048))`. 승리 시 즉시 게임을 끝내지 않고, 오버레이에서 "계속하기"를 누르면 `state.keepPlaying = true`로 설정해 게임 오버 시까지 계속 진행 가능하게 한다(원조 2048 동작 재현).

### 4.4 렌더링(타일 위치 계산)

```
function render(newTilePos):
    boardEl = #board
    boardRect = board.getBoundingClientRect()
    padding = 12   # CSS와 동일 값 상수로 관리
    gap = 12
    innerSize = boardRect.width - padding*2
    cellSize = (innerSize - gap*3) / 4

    기존 .tile 요소 전부 제거 (초기 구현은 단순 전체 재생성)

    for r in 0..3:
        for c in 0..3:
            v = state.board[r][c]
            if v === 0: continue
            tileEl = document.createElement('div')
            tileEl.className = 'tile'
            if newTilePos and r === newTilePos.r and c === newTilePos.c:
                tileEl.classList.add('tile-new')
            tileEl.dataset.value = v
            tileEl.textContent = v
            tileEl.style.width = cellSize + 'px'
            tileEl.style.height = cellSize + 'px'
            tileEl.style.left = (padding + c * (cellSize + gap)) + 'px'
            tileEl.style.top = (padding + r * (cellSize + gap)) + 'px'
            boardEl.appendChild(tileEl)

    #score.textContent = state.score
    #best-score.textContent = state.best

    if state.isOver:
        메시지 "게임 오버!" 표시, #game-message의 hidden 해제, 계속하기 버튼 숨김
    else if state.hasWon and not state.keepPlaying:
        메시지 "2048 달성!" 표시, #game-message hidden 해제, 계속하기+다시 시작 버튼 모두 노출
    else:
        #game-message에 hidden 다시 설정
```

**최소 구현 범위**: 값이 올바르게 갱신되고 새로 생긴 타일에 `tile-new` 등장 애니메이션이 적용되면 충분하다. 타일이 미끄러지듯 이동하는 애니메이션(개별 타일 id 추적)은 선택 구현(nice-to-have)으로 남긴다. `window.addEventListener('resize', debounce(render, 100))`로 리사이즈 시 `cellSize` 재계산.

### 4.5 초기화 흐름

```
DOMContentLoaded:
    syncThemeFromStorage()
    state.best = loadBest()
    newGame()
    document.addEventListener('keydown', handleKeydown)
    boardContainer.addEventListener('touchstart', handleTouchStart, { passive: true })
    boardContainer.addEventListener('touchend', handleTouchEnd, { passive: true })
    #new-game-btn.addEventListener('click', newGame)
    #retry-btn.addEventListener('click', newGame)
    #keep-playing-btn.addEventListener('click', () => { state.keepPlaying = true; render() })
    #theme-toggle.addEventListener('click', toggleTheme)
    window.addEventListener('resize', debounce(render, 100))

function newGame():
    state.board = createEmptyBoard()
    state.score = 0
    state.isOver = false
    state.hasWon = false
    state.keepPlaying = false
    addRandomTile(state.board)
    addRandomTile(state.board)
    render()
```

**handleKeydown 매핑**: `ArrowUp → 'up'`, `ArrowDown → 'down'`, `ArrowLeft → 'left'`, `ArrowRight → 'right'`. 매핑된 키인 경우에만 `e.preventDefault()` 호출해 페이지 스크롤 방지.

**handleTouchStart/End**: `touchstart`에서 시작 좌표 기록, `touchend`에서 종료 좌표와 비교해 `deltaX`, `deltaY` 계산. `Math.abs(deltaX) > Math.abs(deltaY)`면 좌우, 아니면 상하로 판정. 최소 스와이프 거리(예: 20~30px) 미만이면 무시(오탐 방지).

## 5. 점수판 설계

- **현재 점수**: `state.score`, 매 이동마다 이번 턴에 합쳐진 타일 값의 합만큼 증가(`totalGained`).
- **최고 점수**: `localStorage.getItem('2048-best-score')`에서 로드, 게임 진행 중 `state.score`가 이를 초과하면 즉시 갱신하고 `localStorage.setItem`으로 저장. 새 게임을 시작해도 최고 점수는 초기화하지 않는다.
- **새 게임 버튼**: 확인창 없이 즉시 `newGame()` 호출(원조 2048과 동일한 UX).

## 6. UI/스타일 방향

- **다크모드**: 블로그와 동일한 `localStorage['theme']` 키 + `data-theme` 속성 패턴을 그대로 사용해 블로그와 시각적으로 통일한다. 앱을 블로그 없이 단독으로 열어도 `prefers-color-scheme`로 자동 대응.
- **반응형**: 보드는 `max-width: 420px`에서 시작해 뷰포트가 좁아지면 `width: 100%`로 줄어드는 정사각형(`aspect-ratio: 1/1`) 레이어. 모바일 우선으로 패딩/폰트 크기 조정.
- **색상 팔레트**: 원조 2048의 베이지/오렌지 계열 타일 색상(`--tile-2` ~ `--tile-2048`)을 그대로 채용하되, 보드 배경(`--board-bg`)과 점수판 배경은 다크모드에서 톤을 낮춘다. 블로그의 `--accent`(파란 계열)는 버튼(새 게임/다시 시도/계속하기)에만 사용해 포인트 컬러로 통일감을 준다.
- **타이포그래피**: 블로그 폰트 스택(`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)을 그대로 상속.

## 7. 접근성/모바일 고려사항

- `#board`에 `role="application"`, `aria-label="2048 게임 보드"` 부여.
- 버튼(`새 게임`, `다시 시도`, `계속하기`, 테마 토글)은 모두 `<button type="button">`으로 키보드 포커스/엔터 조작 가능해야 한다.
- 방향키 입력 시 페이지 스크롤이 발생하지 않도록 `keydown` 핸들러에서 방향키인 경우 `e.preventDefault()` 호출.
- **터치 스와이프**: 4.5절 참고. `#board`에 `touch-action: none`을 CSS로 지정해 스와이프 중 페이지 스크롤/확대와 충돌하지 않게 한다.
- 터치 타겟(버튼) 최소 크기 44x44px 이상 확보.
- 타일에는 색상 외에도 항상 숫자 텍스트가 표시되므로 색약 사용자 대응은 별도 조치 불필요.

## 8. Review 단계 체크리스트 (참고용, Build 범위 아님)

- 방향키 4방향 모두 정상 이동/병합되는지
- 같은 값 3개 이상 연속 시 이동 방향 우선으로 정확히 1회만 병합되는지 (예: `[2,2,2,0]` → `[4,2,0,0]`이 되어야 하며 `[4,4,0,0]`이 되면 버그)
- 이동해도 보드에 변화가 없으면 새 타일이 생기지 않는지
- 게임 오버 판정이 보드가 꽉 찼을 때 정확히 동작하는지(인접 병합 가능 칸이 있으면 오버 아님)
- 2048 타일 도달 시 승리 메시지가 뜨고, "계속하기" 선택 시 게임이 계속되는지
- 새로고침 후에도 최고 점수가 유지되는지 (localStorage)
- 모바일 뷰포트(375px 등)에서 보드가 잘리지 않고 스와이프로 조작되는지
- 다크모드 토글이 블로그와 동일하게 동작하는지
- `../../index.html` 상대경로가 실제로 블로그 루트로 정확히 연결되는지
