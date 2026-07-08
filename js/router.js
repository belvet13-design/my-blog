var Router = (function () {
  function parseHash() {
    var hash = location.hash.replace(/^#/, '');
    if (hash === '' || hash === '/') {
      return { name: 'list' };
    }
    var postMatch = hash.match(/^\/post\/([^/]+)$/);
    if (postMatch) {
      return { name: 'post', slug: decodeURIComponent(postMatch[1]) };
    }
    return { name: 'list' };
  }

  function start(onRoute) {
    window.addEventListener('hashchange', function () {
      onRoute(parseHash());
    });
    document.addEventListener('DOMContentLoaded', function () {
      onRoute(parseHash());
    });
  }

  return { start: start };
})();
