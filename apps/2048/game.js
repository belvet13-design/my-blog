(function () {
  'use strict';

  var SIZE = 4;
  var STORAGE_KEY_BEST = '2048-best-score';
  var STORAGE_KEY_THEME = 'theme'; // 블로그(js/theme.js)와 동일한 key 공유
  var BOARD_PADDING = 12; // style.css의 #board padding과 동일한 값
  var BOARD_GAP = 12; // style.css의 #board gap과 동일한 값
  var SWIPE_THRESHOLD = 30; // px

  var DIRECTION_ROTATIONS = { left: 0, up: 3, right: 2, down: 1 };

  var root = document.documentElement;

  var state = {
    board: [],       // number[4][4], 0 = 빈 칸
    score: 0,
    best: 0,
    isOver: false,
    hasWon: false,
    keepPlaying: false,
  };

  var boardEl, boardContainerEl, scoreEl, bestScoreEl, gameMessageEl, messageTextEl,
    retryBtn, keepPlayingBtn, newGameBtn, themeToggleBtn;

  // ---- 보드 유틸 ----

  function createEmptyBoard() {
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      board.push(new Array(SIZE).fill(0));
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function getEmptyCells(board) {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) cells.push({ r: r, c: c });
      }
    }
    return cells;
  }

  function addRandomTile(board) {
    var empties = getEmptyCells(board);
    if (empties.length === 0) return null;
    var pick = empties[Math.floor(Math.random() * empties.length)];
    board[pick.r][pick.c] = Math.random() < 0.9 ? 2 : 4;
    return pick;
  }

  function arraysEqual(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // 길이 4인 1차원 배열(왼쪽 방향 기준)을 압축+병합
  function slideAndMergeLine(line) {
    var values = line.filter(function (v) { return v !== 0; });
    var result = [];
    var mergedIndices = [];
    var gained = 0;
    var i = 0;
    while (i < values.length) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        var merged = values[i] * 2;
        result.push(merged);
        mergedIndices.push(result.length - 1);
        gained += merged;
        i += 2; // 병합된 두 칸을 건너뜀 (같은 타일이 다시 병합되지 않도록)
      } else {
        result.push(values[i]);
        i += 1;
      }
    }
    while (result.length < SIZE) {
      result.push(0);
    }
    var moved = !arraysEqual(result, line);
    return { line: result, gained: gained, moved: moved, mergedIndices: mergedIndices };
  }

  // 4x4 행렬을 90도 시계방향으로 회전 (숫자/불리언 등 어떤 값이든 동작하는 범용 함수)
  function rotate90CW(matrix) {
    var result = createEmptyBoard();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        result[c][SIZE - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  function rotateBoard(matrix, times) {
    var result = matrix;
    var n = ((times % 4) + 4) % 4;
    for (var i = 0; i < n; i++) {
      result = rotate90CW(result);
    }
    return result;
  }

  function isGameOver(board) {
    if (getEmptyCells(board).length > 0) return false;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = board[r][c];
        if (c + 1 < SIZE && board[r][c + 1] === v) return false;
        if (r + 1 < SIZE && board[r + 1][c] === v) return false;
      }
    }
    return true;
  }

  function checkWin(board) {
    return board.some(function (row) {
      return row.some(function (v) { return v >= 2048; });
    });
  }

  // ---- 이동 처리 ----

  function move(direction) {
    if (state.isOver) return;
    if (state.hasWon && !state.keepPlaying) return;

    var rot = DIRECTION_ROTATIONS[direction];
    var board = rotateBoard(state.board, rot);
    var mergedMask = createEmptyBoard();

    var moved = false;
    var totalGained = 0;

    for (var r = 0; r < SIZE; r++) {
      var res = slideAndMergeLine(board[r]);
      board[r] = res.line;
      res.mergedIndices.forEach(function (idx) { mergedMask[r][idx] = 1; });
      totalGained += res.gained;
      if (res.moved) moved = true;
    }

    board = rotateBoard(board, (4 - rot) % 4);
    mergedMask = rotateBoard(mergedMask, (4 - rot) % 4);

    if (!moved) return; // 보드에 변화 없으면 아무 것도 하지 않음(새 타일 생성 X)

    state.board = board;
    state.score += totalGained;
    updateBest();
    var newTilePos = addRandomTile(state.board);

    if (!state.hasWon && checkWin(state.board)) {
      state.hasWon = true;
    }

    if (isGameOver(state.board)) {
      state.isOver = true;
    }

    render(newTilePos, mergedMask);
  }

  // ---- 점수 ----

  function loadBest() {
    var raw = localStorage.getItem(STORAGE_KEY_BEST);
    var n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  function updateBest() {
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(STORAGE_KEY_BEST, String(state.best));
    }
  }

  // ---- 렌더링 ----

  function render(newTilePos, mergedMask) {
    var boardRect = boardEl.getBoundingClientRect();
    var innerSize = boardRect.width - BOARD_PADDING * 2;
    var cellSize = (innerSize - BOARD_GAP * 3) / 4;

    // 기존 타일 전부 제거 (그리드 배경 셀과 오버레이는 유지)
    var existingTiles = boardEl.querySelectorAll('.tile');
    existingTiles.forEach(function (el) { el.remove(); });

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = state.board[r][c];
        if (v === 0) continue;

        var tileEl = document.createElement('div');
        tileEl.className = 'tile';

        if (v > 2048) {
          tileEl.classList.add('tile-super');
        }

        if (newTilePos && r === newTilePos.r && c === newTilePos.c) {
          tileEl.classList.add('tile-new');
        }
        if (mergedMask && mergedMask[r][c]) {
          tileEl.classList.add('tile-merged');
        }

        tileEl.dataset.value = String(v);
        tileEl.textContent = v;
        tileEl.style.width = cellSize + 'px';
        tileEl.style.height = cellSize + 'px';
        tileEl.style.left = (BOARD_PADDING + c * (cellSize + BOARD_GAP)) + 'px';
        tileEl.style.top = (BOARD_PADDING + r * (cellSize + BOARD_GAP)) + 'px';
        boardEl.appendChild(tileEl);
      }
    }

    scoreEl.textContent = String(state.score);
    bestScoreEl.textContent = String(state.best);

    if (state.isOver) {
      messageTextEl.textContent = '게임 오버!';
      keepPlayingBtn.hidden = true;
      gameMessageEl.hidden = false;
    } else if (state.hasWon && !state.keepPlaying) {
      messageTextEl.textContent = '2048 달성!';
      keepPlayingBtn.hidden = false;
      gameMessageEl.hidden = false;
    } else {
      gameMessageEl.hidden = true;
    }
  }

  // ---- 게임 시작/재시작 ----

  function newGame() {
    state.board = createEmptyBoard();
    state.score = 0;
    state.isOver = false;
    state.hasWon = false;
    state.keepPlaying = false;
    addRandomTile(state.board);
    addRandomTile(state.board);
    render();
  }

  // ---- 입력 처리 ----

  var KEY_TO_DIRECTION = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };

  function handleKeydown(e) {
    var direction = KEY_TO_DIRECTION[e.key];
    if (!direction) return;
    e.preventDefault();
    move(direction);
  }

  var touchStartX = 0;
  var touchStartY = 0;

  function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    var touch = e.changedTouches[0];
    if (!touch) return;
    var deltaX = touch.clientX - touchStartX;
    var deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX > 0 ? 'right' : 'left');
    } else {
      move(deltaY > 0 ? 'down' : 'up');
    }
  }

  // ---- 테마 (블로그와 동일한 localStorage['theme'] 키 공유) ----

  function currentTheme() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateToggleLabel() {
    if (!themeToggleBtn) return;
    themeToggleBtn.textContent = currentTheme() === 'dark' ? '☀' : '🌙';
  }

  function syncThemeFromStorage() {
    var stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored === 'light' || stored === 'dark') {
      root.setAttribute('data-theme', stored);
    }
    updateToggleLabel();
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY_THEME, next);
    updateToggleLabel();
  }

  // ---- 유틸 ----

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // ---- 초기화 ----

  document.addEventListener('DOMContentLoaded', function () {
    boardEl = document.getElementById('board');
    boardContainerEl = document.getElementById('board-container');
    scoreEl = document.getElementById('score');
    bestScoreEl = document.getElementById('best-score');
    gameMessageEl = document.getElementById('game-message');
    messageTextEl = document.getElementById('message-text');
    retryBtn = document.getElementById('retry-btn');
    keepPlayingBtn = document.getElementById('keep-playing-btn');
    newGameBtn = document.getElementById('new-game-btn');
    themeToggleBtn = document.getElementById('theme-toggle');

    syncThemeFromStorage();
    state.best = loadBest();
    newGame();

    document.addEventListener('keydown', handleKeydown);
    boardContainerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    boardContainerEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    newGameBtn.addEventListener('click', newGame);
    retryBtn.addEventListener('click', newGame);
    keepPlayingBtn.addEventListener('click', function () {
      state.keepPlaying = true;
      render();
    });
    themeToggleBtn.addEventListener('click', toggleTheme);
    window.addEventListener('resize', debounce(function () { render(); }, 100));
  });
})();
