(function () {
  var app = document.getElementById('app');
  var postsCache = null;

  function fetchPosts() {
    if (postsCache) return Promise.resolve(postsCache);
    return fetch('content/posts.json')
      .then(function (res) {
        if (!res.ok) throw new Error('posts.json 로드 실패');
        return res.json();
      })
      .then(function (posts) {
        posts.sort(function (a, b) { return b.date.localeCompare(a.date); });
        postsCache = posts;
        return posts;
      });
  }

  function showList() {
    fetchPosts()
      .then(function (posts) {
        app.innerHTML = Views.renderList(posts);
      })
      .catch(function () {
        app.innerHTML = Views.renderMessage('글 목록을 불러오지 못했습니다.');
      });
  }

  function showPost(slug) {
    fetchPosts()
      .then(function (posts) {
        var meta = posts.filter(function (p) { return p.slug === slug; })[0];
        if (!meta) {
          app.innerHTML = Views.renderMessage('글을 찾을 수 없습니다.');
          return;
        }
        return fetch('content/posts/' + meta.file)
          .then(function (res) {
            if (!res.ok) throw new Error('글 로드 실패');
            return res.text();
          })
          .then(function (markdown) {
            var html = Markdown.render(markdown);
            app.innerHTML = Views.renderPost(meta, html);
            window.scrollTo(0, 0);
          });
      })
      .catch(function () {
        app.innerHTML = Views.renderMessage('글을 불러오지 못했습니다.');
      });
  }

  function onRoute(route) {
    if (route.name === 'post') {
      showPost(route.slug);
    } else {
      showList();
    }
  }

  Router.start(onRoute);
})();
