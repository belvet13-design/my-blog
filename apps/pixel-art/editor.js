(function () {
  'use strict';

  var GRID_SIZE = 16;
  var STORAGE_KEY_THEME = 'theme'; // 블로그(js/theme.js)와 동일한 key 공유
  var EXPORT_SCALE = 20;           // PNG 저장 시 셀당 확대 배율

  var DEFAULT_PALETTE = [
    '#000000', '#7f7f7f', '#ffffff', '#c3c3c3',
    '#ed1c24', '#ff7f27', '#fff200', '#22b14c',
    '#00a2e8', '#3f48cc', '#a349a4', '#ffaec9',
    '#b97a57', '#ffc90e', '#99d9ea', '#c8bfe7'
  ];

  var root = document.documentElement;

  var pixels = [];          // string[16][16], 각 칸은 색상 문자열('#rrggbb') 또는 null(빈 칸/투명)
  var currentColor = DEFAULT_PALETTE[0];
  var currentTool = 'draw'; // 'draw' | 'erase'
  var isPointerDown = false;
  var lastPaintedCell = null; // { row, col } — 같은 칸 재도색으로 인한 불필요한 재렌더 방지

  var canvas, ctx, canvasWrapEl, paletteEl, customColorInput, currentColorPreviewEl,
    drawToolBtn, eraserToolBtn, clearBtn, downloadBtn, themeToggleBtn;

  // ---- 상태 유틸 ----

  function createEmptyGrid() {
    var grid = [];
    for (var r = 0; r < GRID_SIZE; r++) {
      grid.push(new Array(GRID_SIZE).fill(null));
    }
    return grid;
  }

  // ---- 캔버스 초기화 및 렌더링 ----

  function resizeCanvasForDPR() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvasWrapEl.getBoundingClientRect();
    var displaySize = Math.round(rect.width);

    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
    canvas.width = Math.round(displaySize * dpr);
    canvas.height = Math.round(displaySize * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 이후 그리기 좌표는 모두 CSS px 기준으로 다루면 된다 (dpr 보정은 transform이 대신 처리)
  }

  function getThemeColors() {
    var styles = getComputedStyle(root);
    return {
      bg: styles.getPropertyValue('--bg').trim(),
      emptyCell: styles.getPropertyValue('--cell-bg').trim(),
      gridLine: styles.getPropertyValue('--grid-line').trim()
    };
  }

  function drawGrid() {
    var rect = canvas.getBoundingClientRect(); // CSS px 기준 정사각형 크기
    var cellSize = rect.width / GRID_SIZE;
    var colors = getThemeColors();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var color = pixels[r][c];
        ctx.fillStyle = color ? color : colors.emptyCell;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    // 격자선 (1px 선명하게: 정수 좌표 + 0.5 보정)
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1;
    for (var i = 0; i <= GRID_SIZE; i++) {
      var pos = Math.round(i * cellSize) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, rect.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(rect.width, pos);
      ctx.stroke();
    }
  }

  // ---- 드래그로 칠하기 (Pointer Events) ----

  function getCellFromPointerEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var cellSize = rect.width / GRID_SIZE;
    var col = Math.floor(x / cellSize);
    var row = Math.floor(y / cellSize);
    col = Math.min(Math.max(col, 0), GRID_SIZE - 1); // 경계 밖으로 드래그해도 가장자리 칸이 계속 칠해지도록 보정
    row = Math.min(Math.max(row, 0), GRID_SIZE - 1);
    return { row: row, col: col };
  }

  function paintCell(row, col) {
    var newValue = (currentTool === 'erase') ? null : currentColor;
    if (pixels[row][col] === newValue) return; // 변화 없으면 재렌더 생략
    pixels[row][col] = newValue;
    drawGrid();
  }

  function handlePointerDown(e) {
    e.preventDefault(); // 터치 스크롤/길게 누르기 컨텍스트 메뉴 방지
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true;
    var cell = getCellFromPointerEvent(e);
    lastPaintedCell = cell;
    paintCell(cell.row, cell.col); // 클릭만 해도 즉시 한 칸 칠해짐
  }

  function handlePointerMove(e) {
    if (!isPointerDown) return;
    e.preventDefault();
    var cell = getCellFromPointerEvent(e);
    if (lastPaintedCell && cell.row === lastPaintedCell.row && cell.col === lastPaintedCell.col) {
      return; // 같은 칸 안에서는 다시 칠하지 않음(불필요한 재렌더 방지)
    }
    lastPaintedCell = cell;
    paintCell(cell.row, cell.col);
  }

  function endStroke(e) {
    isPointerDown = false;
    lastPaintedCell = null;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  // ---- 팔레트/도구 UI ----

  function renderPalette() {
    paletteEl.innerHTML = '';
    DEFAULT_PALETTE.forEach(function (color) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      btn.setAttribute('aria-label', color);
      btn.addEventListener('click', function () { selectColor(color); });
      paletteEl.appendChild(btn);
    });
    updateSelectedSwatch();
  }

  function selectColor(color) {
    currentColor = color;
    currentTool = 'draw'; // 색을 고르면 자동으로 그리기 도구로 전환
    updateSelectedSwatch();
    updateToolButtons();
    updateCurrentColorPreview();
  }

  function updateSelectedSwatch() {
    var swatches = paletteEl.querySelectorAll('.swatch');
    swatches.forEach(function (btn) {
      btn.classList.toggle('selected', btn.dataset.color === currentColor);
    });
  }

  function updateToolButtons() {
    drawToolBtn.classList.toggle('active', currentTool === 'draw');
    eraserToolBtn.classList.toggle('active', currentTool === 'erase');
  }

  function updateCurrentColorPreview() {
    currentColorPreviewEl.style.backgroundColor = currentColor;
  }

  function handleClear() {
    if (!confirm('전체 그림을 지우시겠습니까?')) return;
    pixels = createEmptyGrid();
    drawGrid();
  }

  // ---- PNG 저장 ----

  function exportPNG() {
    // 1단계: 16x16 1:1 캔버스에 "순수 픽셀 데이터"만 그리기 (배경/격자선 없음, 빈 칸은 투명)
    var small = document.createElement('canvas');
    small.width = GRID_SIZE;
    small.height = GRID_SIZE;
    var sctx = small.getContext('2d');
    sctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var color = pixels[r][c];
        if (color) {
          sctx.fillStyle = color;
          sctx.fillRect(c, r, 1, 1);
        }
        // color가 null이면 그대로 둔다 → 기본적으로 alpha 0 (투명) 유지
      }
    }

    // 2단계: 320x320으로 확대 (셀당 20px), 안티앨리어싱 끄기
    var big = document.createElement('canvas');
    big.width = GRID_SIZE * EXPORT_SCALE; // 16 * 20 = 320
    big.height = GRID_SIZE * EXPORT_SCALE;
    var bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = false; // 핵심: 확대 시 픽셀 경계 선명하게 유지
    bctx.drawImage(small, 0, 0, big.width, big.height);

    // 3단계: PNG로 변환 후 다운로드
    if (big.toBlob) {
      big.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        triggerDownload(url);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, 'image/png');
    } else {
      // 구형 브라우저 fallback
      var dataUrl = big.toDataURL('image/png');
      triggerDownload(dataUrl);
    }
  }

  function triggerDownload(url) {
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pixel-art.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---- 테마 (2048 game.js와 동일 패턴, 블로그와 localStorage['theme'] 키 공유) ----

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
    drawGrid(); // --bg/--cell-bg/--grid-line 값이 바뀌므로 캔버스를 반드시 다시 그려야 함
  }

  // ---- 유틸 ----

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx2 = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx2, args); }, wait);
    };
  }

  // ---- 초기화 ----

  document.addEventListener('DOMContentLoaded', function () {
    canvas = document.getElementById('pixel-canvas');
    ctx = canvas.getContext('2d');
    canvasWrapEl = document.querySelector('.canvas-wrap');
    paletteEl = document.getElementById('palette');
    customColorInput = document.getElementById('custom-color');
    currentColorPreviewEl = document.getElementById('current-color-preview');
    drawToolBtn = document.getElementById('draw-tool-btn');
    eraserToolBtn = document.getElementById('eraser-tool-btn');
    clearBtn = document.getElementById('clear-btn');
    downloadBtn = document.getElementById('download-btn');
    themeToggleBtn = document.getElementById('theme-toggle');

    pixels = createEmptyGrid();

    syncThemeFromStorage();
    renderPalette();
    updateToolButtons();
    updateCurrentColorPreview();
    resizeCanvasForDPR();
    drawGrid();

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    customColorInput.addEventListener('input', function (e) { selectColor(e.target.value); });
    drawToolBtn.addEventListener('click', function () { currentTool = 'draw'; updateToolButtons(); });
    eraserToolBtn.addEventListener('click', function () { currentTool = 'erase'; updateToolButtons(); });
    clearBtn.addEventListener('click', handleClear);
    downloadBtn.addEventListener('click', exportPNG);
    themeToggleBtn.addEventListener('click', toggleTheme);

    window.addEventListener('resize', debounce(function () {
      resizeCanvasForDPR();
      drawGrid();
    }, 100));
  });
})();
