window.App = window.App || {};
window.App.Bookmarks = (function () {
  'use strict';

  var DEFAULT_BOARDS = ['Home', 'Dev & Code', 'Daily', 'Work', 'Entertainment', 'Shopping', 'Learning', 'News & Reading', 'Social', 'AI Tools'];
  var DEFAULT_BOOKMARKS = [
    { name: 'Google', url: 'https://google.com', category: 'Home' },
    { name: 'YouTube', url: 'https://youtube.com', category: 'Entertainment' },
    { name: 'GitHub', url: 'https://github.com', category: 'Dev & Code' },
    { name: 'Reddit', url: 'https://reddit.com', category: 'Social' },
    { name: 'Twitter', url: 'https://x.com', category: 'Social' },
    { name: 'Notion', url: 'https://notion.so', category: 'Work' }
  ];

  function init() {
    // Legacy seed / migration source only. The workspace module owns the bookmark
    // UI, the card-size control and the live data, so this must not rewrite the
    // stored data on every load -- it only seeds when the data is truly absent.
    if (Array.isArray(App.Storage.get('bookmarks', null))) return;

    var categories = App.Storage.get('bookmark-categories', null);
    if (!Array.isArray(categories)) categories = DEFAULT_BOARDS.slice();
    DEFAULT_BOARDS.forEach(function (name) {
      if (!categories.some(function (item) { return String(item).toLowerCase() === name.toLowerCase(); })) categories.push(name);
    });

    var bookmarks = DEFAULT_BOOKMARKS.map(function (bookmark) {
      return { name: bookmark.name, url: bookmark.url, category: bookmark.category };
    });
    bookmarks = bookmarks.filter(function (bookmark) {
      if (!bookmark || typeof bookmark !== 'object') return false;
      try {
        var url = new URL(String(bookmark.url || '').match(/^https?:\/\//i) ? bookmark.url : 'https://' + bookmark.url);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
        bookmark.url = url.href;
      } catch (error) { return false; }
      bookmark.id = bookmark.id || 'bm-' + Math.random().toString(36).slice(2, 10);
      bookmark.name = String(bookmark.name || bookmark.title || bookmark.url).slice(0, 200);
      bookmark.category = categories.indexOf(bookmark.category) >= 0 ? bookmark.category : 'Home';
      bookmark.description = String(bookmark.description || '').slice(0, 500);
      bookmark.addedAt = Number(bookmark.addedAt) || Date.now();
      bookmark.uses = Number(bookmark.uses) || 0;
      return true;
    });
    App.Storage.set('bookmark-categories', categories);
    App.Storage.set('bookmarks', bookmarks);
  }

  return { init: init };
})();
