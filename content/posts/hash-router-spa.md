# 해시 라우터로 SPA 만들기

리액트 라우터 같은 라이브러리 없이도, 목록 페이지와 글 페이지를 오가는 SPA를 만들 수 있었습니다. 핵심은 URL의 해시(`#` 뒤 부분)입니다.

## 라우트는 두 종류뿐

이 블로그는 라우트가 단순합니다.

- `#/` 또는 빈 해시 → 글 목록
- `#/post/슬러그` → 글 본문

```
function parseHash() {
  var hash = location.hash.replace(/^#/, '');
  if (hash === '' || hash === '/') return { name: 'list' };
  var m = hash.match(/^\/post\/([^/]+)$/);
  if (m) return { name: 'post', slug: decodeURIComponent(m[1]) };
  return { name: 'list' };
}
```

## hashchange 이벤트가 전부

라우터의 핵심은 딱 두 가지 이벤트에 반응하는 것뿐입니다.

1. `hashchange` — 사용자가 링크를 클릭하거나 주소창을 바꿨을 때
2. `DOMContentLoaded` — 처음 페이지를 열었을 때 (새로고침 포함)

```
window.addEventListener('hashchange', function () {
  onRoute(parseHash());
});
document.addEventListener('DOMContentLoaded', function () {
  onRoute(parseHash());
});
```

## 링크는 그냥 앵커 태그로

`<a href="#/post/hello-world">` 같은 평범한 앵커 태그만 쓰면, 클릭 핸들러를 따로 만들지 않아도 브라우저가 알아서 해시를 바꿔주고 `hashchange`가 발생합니다. 덕분에 뒤로가기/앞으로가기 버튼도 별도 코드 없이 그대로 동작합니다.

## 배운 점

라우팅 라이브러리가 하는 일은 결국 "URL을 읽고, 그에 맞는 화면을 그린다"는 것뿐입니다. 라우트 종류가 몇 개 안 되는 작은 프로젝트라면, 이렇게 직접 만든 몇 줄짜리 라우터로도 충분하다는 걸 느꼈습니다.
