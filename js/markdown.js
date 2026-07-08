// 경량 마크다운 -> HTML 파서.
// 지원: 헤딩(#-######), 문단, 굵게/기울임, 링크, 이미지, 순서/비순서 목록,
//       펜스 코드블록, 인라인 코드, 인용, 수평선(hr).
// 미지원(의도적): 중첩 목록, 표, 각주, 참조 링크, HTML 통과.
var Markdown = (function () {
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function parseInline(text) {
    var html = escapeHtml(text);
    // 인라인 코드 (다른 규칙보다 먼저 처리해 내용을 보호)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 이미지 (링크보다 먼저)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
    // 링크
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // 굵게
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // 기울임 (굵게 처리 이후)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    return html;
  }

  function isBlank(line) {
    return /^\s*$/.test(line);
  }

  function render(source) {
    var lines = source.replace(/\r\n/g, '\n').split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) {
        i++;
        continue;
      }

      // 펜스 코드블록
      var fenceMatch = line.match(/^```(.*)$/);
      if (fenceMatch) {
        var codeLines = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // 닫는 ``` 건너뛰기
        out.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
        continue;
      }

      // 헤딩
      var headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        var level = headingMatch[1].length;
        out.push('<h' + level + '>' + parseInline(headingMatch[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      // 수평선
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // 인용
      if (/^>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote><p>' + parseInline(quoteLines.join(' ')) + '</p></blockquote>');
        continue;
      }

      // 비순서 목록
      if (/^[-*+]\s+/.test(line)) {
        var ulItems = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
          ulItems.push('<li>' + parseInline(lines[i].replace(/^[-*+]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ul>' + ulItems.join('') + '</ul>');
        continue;
      }

      // 순서 목록
      if (/^\d+\.\s+/.test(line)) {
        var olItems = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          olItems.push('<li>' + parseInline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ol>' + olItems.join('') + '</ol>');
        continue;
      }

      // 문단 (그 외 연속 줄)
      var paraLines = [];
      while (i < lines.length && !isBlank(lines[i]) &&
             !/^```/.test(lines[i]) &&
             !/^(#{1,6})\s+/.test(lines[i]) &&
             !/^>\s?/.test(lines[i]) &&
             !/^[-*+]\s+/.test(lines[i]) &&
             !/^\d+\.\s+/.test(lines[i]) &&
             !/^\s*([-*_])\s*(\1\s*){2,}$/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      out.push('<p>' + parseInline(paraLines.join(' ')) + '</p>');
    }

    return out.join('\n');
  }

  return { render: render };
})();
