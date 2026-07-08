var Views = (function () {
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderList(posts) {
    if (!posts.length) {
      return '<p class="empty">아직 작성된 글이 없습니다.</p>';
    }
    var items = posts.map(function (post) {
      var tags = '';
      if (post.tags && post.tags.length) {
        tags = '<div class="post-tags">' +
          post.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') +
          '</div>';
      }
      var excerpt = post.excerpt ? '<p class="post-excerpt">' + escapeHtml(post.excerpt) + '</p>' : '';
      return (
        '<li class="post-item">' +
          '<a class="post-link" href="#/post/' + encodeURIComponent(post.slug) + '">' +
            '<h2 class="post-title">' + escapeHtml(post.title) + '</h2>' +
          '</a>' +
          '<time class="post-date">' + escapeHtml(post.date) + '</time>' +
          excerpt +
          tags +
        '</li>'
      );
    });
    return '<ul class="post-list">' + items.join('') + '</ul>';
  }

  function renderPost(meta, contentHtml) {
    return (
      '<article class="post">' +
        '<a class="back-link" href="#/">&larr; 목록으로</a>' +
        '<h1 class="post-title">' + escapeHtml(meta.title) + '</h1>' +
        '<time class="post-date">' + escapeHtml(meta.date) + '</time>' +
        '<div class="post-content">' + contentHtml + '</div>' +
      '</article>'
    );
  }

  function renderMessage(text) {
    return '<p class="message">' + escapeHtml(text) + '</p>';
  }

  return { renderList: renderList, renderPost: renderPost, renderMessage: renderMessage };
})();
