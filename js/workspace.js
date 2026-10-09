window.App = window.App || {};
window.App.Workspace = (function () {
  'use strict';

  // Every bookmark keeper is one instance of this factory: its own library, its
  // own undo stack, its own DOM ids (all suffixed) and its own storage keys, so
  // two panels on the same dashboard never see each other's bookmarks.
  // ---- second keeper panel --------------------------------------------
  // Cloned from the first panel so both keepers share one markup source. Ids
  // are suffixed, which is what lets both instances address their own elements
  // with the same helper.
  function suffixIds(node, suffix) {
    Array.prototype.forEach.call(node.querySelectorAll('[id]'), function (element) {
      element.id = element.id + suffix;
    });
    Array.prototype.forEach.call(node.querySelectorAll('[for]'), function (label) {
      label.setAttribute('for', label.getAttribute('for') + suffix);
    });
  }
  function buildSecondKeeper() {
    if (document.getElementById('bookmarks-section-2')) return;
    var source = document.getElementById('bookmarks-section');
    if (!source) return;
    var clone = source.cloneNode(true);
    suffixIds(clone, '-2');
    clone.id = 'bookmarks-section-2';
    clone.classList.add('widget-bookmarks-2');
    clone.setAttribute('data-widget-id', 'bookmarks-2');
    clone.setAttribute('aria-label', 'Bookmarks keeper 2');
    var heading = clone.querySelector('.bookmark-heading h1');
    if (heading) heading.textContent = 'Bookmarks';
    var more = clone.querySelector('.more-menu');
    if (more) more.removeAttribute('open');
    var search = clone.querySelector('.bookmark-filter input[type="search"]');
    if (search) search.value = '';
    var scopeSelect = clone.querySelector('[aria-label="Search scope"]');
    if (scopeSelect) scopeSelect.value = 'workspace';
    var sortSelect = clone.querySelector('[aria-label="Sort bookmarks"]');
    if (sortSelect) sortSelect.value = 'custom';
    var dashboard = document.getElementById('dashboard') || source.parentNode;
    dashboard.appendChild(clone);
    ['bookmark-modal', 'page-modal', 'category-modal', 'quick-save-modal'].forEach(function (id) {
      var modal = document.getElementById(id);
      if (!modal) return;
      var copy = modal.cloneNode(true);
      suffixIds(copy, '-2');
      copy.id = id + '-2';
      copy.classList.add('hidden');
      document.body.appendChild(copy);
    });
  }

  function create(opts) {
  opts = opts || {};
  var SUFFIX = opts.suffix || '';
  var isPrimary = !SUFFIX;
  var root = null;
  function byId(id) { return document.getElementById(id + SUFFIX); }
  function skey(key) { return key + SUFFIX; }
  var KEY = 'bookmark-workspace' + SUFFIX;
  var VERSION = 1;
  var BUILT_IN_BOARDS = ['Home', 'Dev & Code', 'Daily', 'Work', 'Entertainment', 'Shopping', 'Learning', 'News & Reading', 'Social', 'AI Tools'];
  var workspace;
  var activePage;
  var activeBoard;
  var searchScope = 'board';
  var query = '';
  var exact = false;
  var deletedView = false;
  var undoStack = [];
  var redoStack = [];
  var listeners = [];
  var editingId = null;
  var recentSearches = [];
  var favoriteOrder = [];
  // Set by setupUI; lets the Settings sliders and this toolbar show the same
  // value after either one moves.
  var syncCardControls = null;

  // True when the event is happening inside this keeper (its panel, one of its
  // inputs, or a modal it owns), so the second panel's shortcuts stay silent
  // while the first one is the one being used.
  function ownsActiveElement() {
    var active = document.activeElement;
    if (active && active !== document.body) {
      if (root && root.contains(active)) return true;
      if (SUFFIX && active.id && active.id.slice(-SUFFIX.length) === SUFFIX) return true;
    }
    return ['bookmark-modal', 'page-modal', 'category-modal', 'quick-save-modal'].some(function (base) {
      var modal = document.getElementById(base + SUFFIX);
      return modal && !modal.classList.contains('hidden');
    });
  }

  function makeId(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 10); }
  function emit() { listeners.slice().forEach(function (listener) { listener(); }); }
  function snapshot() { return JSON.stringify(workspace); }
  function persist() {
    App.Storage.set(KEY, workspace);
    App.Storage.set(skey('workspace-active-page'), activePage);
    App.Storage.set(skey('workspace-active-board'), activeBoard);
    emit();
  }
  function transact(change) {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
    change();
    persist();
  }
  function normalizeTags(value) {
    var tags = Array.isArray(value) ? value : String(value || '').split(/[,;]/);
    return tags.map(function (tag) { return String(tag || '').trim().replace(/^#+/, '').toLowerCase().slice(0, 32); })
      .filter(function (tag, index, list) { return !!tag && list.indexOf(tag) === index; }).slice(0, 12);
  }
  function validWebUrl(value) {
    try {
      var parsed = new URL(String(value || ''));
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) { return false; }
  }
  function pageById(id) { return workspace.pages.find(function (page) { return page.id === id; }); }
  function boardById(page, id) { return page && page.boards.find(function (board) { return board.id === id; }); }
  function currentPage() { return pageById(activePage) || workspace.pages[0]; }
  function currentBoard() { return boardById(currentPage(), activeBoard) || currentPage().boards[0]; }

  function normalize() {
    if (!workspace || !Array.isArray(workspace.pages)) workspace = { version: VERSION, pages: [] };
    workspace.pages = workspace.pages.filter(function (page) { return page && typeof page === 'object'; });
    workspace.pages.forEach(function (page) {
      page.id = page.id || makeId('page');
      page.name = String(page.name || 'Untitled page').slice(0, 40);
      page.boards = Array.isArray(page.boards) ? page.boards.filter(function (board) { return board && typeof board === 'object'; }) : [];
      if (!page.boards.length) page.boards.push({ id: makeId('board'), name: 'Home', bookmarks: [] });
      page.boards.forEach(function (board) {
        board.id = board.id || makeId('board');
        board.name = String(board.name || 'Untitled board').slice(0, 40);
        board.bookmarks = Array.isArray(board.bookmarks) ? board.bookmarks.filter(function (bookmark) {
          return bookmark && typeof bookmark === 'object' && validWebUrl(bookmark.url);
        }) : [];
        board.bookmarks.forEach(function (bookmark) {
          bookmark.id = bookmark.id || makeId('bookmark');
          bookmark.name = String(bookmark.name || bookmark.title || bookmark.url).slice(0, 200);
          bookmark.url = new URL(String(bookmark.url)).href;
          bookmark.description = String(bookmark.description || '').slice(0, 500);
          bookmark.tags = normalizeTags(bookmark.tags);
          if (!Number.isFinite(bookmark.addedAt)) bookmark.addedAt = Date.now();
          if (!Number.isFinite(bookmark.uses)) bookmark.uses = 0;
          bookmark.favorite = !!bookmark.favorite;
        });
      });
    });
    if (!workspace.pages.length) {
      workspace.pages.push({ id: makeId('page'), name: 'Home', boards: BUILT_IN_BOARDS.map(function (name) {
        return { id: makeId('board'), name: name, bookmarks: [] };
      }) });
    }
    if (!Array.isArray(workspace.trash)) workspace.trash = [];
    favoriteOrder = Array.isArray(workspace.favoriteOrder) ? workspace.favoriteOrder : [];
    var favoriteIds = [];
    workspace.pages.forEach(function (page) {
      page.boards.forEach(function (board) {
        board.bookmarks.forEach(function (bookmark) { if (bookmark.favorite) favoriteIds.push(bookmark.id); });
      });
    });
    favoriteOrder = favoriteOrder.filter(function (id, index, ids) { return favoriteIds.indexOf(id) >= 0 && ids.indexOf(id) === index; });
    favoriteIds.forEach(function (id) { if (favoriteOrder.indexOf(id) < 0) favoriteOrder.push(id); });
    workspace.favoriteOrder = favoriteOrder;
    var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    workspace.trash = workspace.trash.filter(function (entry) {
      return entry && entry.bookmark && validWebUrl(entry.bookmark.url) && Number(entry.deletedAt) >= cutoff;
    });
    if (!pageById(activePage)) activePage = workspace.pages[0].id;
    var page = currentPage();
    if (!boardById(page, activeBoard)) activeBoard = page.boards[0].id;
    workspace.version = VERSION;
  }

  function migrateLegacy() {
    var oldBookmarks = App.Storage.get('bookmarks', []);
    var oldBoards = App.Storage.get('bookmark-categories', BUILT_IN_BOARDS);
    if (!Array.isArray(oldBoards)) oldBoards = BUILT_IN_BOARDS;
    var boardNames = BUILT_IN_BOARDS.slice();
    oldBoards.forEach(function (name) {
      if (typeof name === 'string' && !boardNames.some(function (known) { return known.toLowerCase() === name.toLowerCase(); })) boardNames.push(name);
    });
    var page = { id: makeId('page'), name: 'Home', boards: boardNames.map(function (name) {
      return { id: makeId('board'), name: name, bookmarks: [] };
    }) };
    (Array.isArray(oldBookmarks) ? oldBookmarks : []).forEach(function (bookmark) {
      if (!bookmark || !validWebUrl(bookmark.url)) return;
      var board = page.boards.find(function (item) { return item.name === bookmark.category; }) || page.boards[0];
      board.bookmarks.push({
        id: bookmark.id || makeId('bookmark'),
        name: bookmark.name || bookmark.title || bookmark.url,
        url: bookmark.url,
        description: bookmark.description || '',
        tags: normalizeTags(bookmark.tags),
        addedAt: bookmark.addedAt || Date.now(),
        uses: bookmark.uses || 0,
        favorite: !!bookmark.favorite
      });
    });
    workspace = { version: VERSION, pages: [page], trash: [] };
    activePage = page.id;
    activeBoard = page.boards[0].id;
  }

  function init() {
    root = byId('bookmarks-section');
    workspace = App.Storage.get(KEY, null);
    // The first keeper inherits the legacy library; a second one starts empty
    // rather than duplicating it.
    if (!workspace) { if (isPrimary) migrateLegacy(); else workspace = { version: VERSION, pages: [] }; }
    activePage = App.Storage.get(skey('workspace-active-page'), activePage || (workspace.pages[0] && workspace.pages[0].id));
    normalize();
    activeBoard = App.Storage.get(skey('workspace-active-board'), currentPage().boards[0].id);
    normalize();
    setupUI();
    App.Storage.set(skey('workspace-active-page'), activePage);
    App.Storage.set(skey('workspace-active-board'), activeBoard);
    App.Storage.set(KEY, workspace);
  }

  function setActive(pageId, boardId) {
    activePage = pageById(pageId) ? pageId : activePage;
    var page = currentPage();
    activeBoard = boardById(page, boardId) ? boardId : page.boards[0].id;
    App.Storage.set(skey('workspace-active-page'), activePage);
    App.Storage.set(skey('workspace-active-board'), activeBoard);
    emit();
  }

  function addPage(name) {
    name = String(name || '').trim();
    if (!name || workspace.pages.some(function (page) { return page.name.toLowerCase() === name.toLowerCase(); })) return false;
    var page = { id: makeId('page'), name: name.slice(0, 40), boards: [{ id: makeId('board'), name: 'Home', bookmarks: [] }] };
    transact(function () { workspace.pages.push(page); activePage = page.id; activeBoard = page.boards[0].id; });
    setActive(activePage, activeBoard);
    return true;
  }

  function addBoard(name) {
    name = String(name || '').trim();
    var page = currentPage();
    if (!name || page.boards.some(function (board) { return board.name.toLowerCase() === name.toLowerCase(); })) return false;
    var board = { id: makeId('board'), name: name.slice(0, 40), bookmarks: [] };
    transact(function () { page.boards.push(board); activeBoard = board.id; });
    setActive(activePage, activeBoard);
    return true;
  }
  function renamePage(pageId, name) {
    var page = pageById(pageId);
    name = String(name || '').trim();
    if (!page || !name || workspace.pages.some(function (item) { return item.id !== pageId && item.name.toLowerCase() === name.toLowerCase(); })) return false;
    transact(function () { page.name = name.slice(0, 40); });
    return true;
  }
  function renameBoard(pageId, boardId, name) {
    var page = pageById(pageId), board = boardById(page, boardId);
    name = String(name || '').trim();
    if (!board || !name || page.boards.some(function (item) { return item.id !== boardId && item.name.toLowerCase() === name.toLowerCase(); })) return false;
    transact(function () { board.name = name.slice(0, 40); });
    return true;
  }
  function deletePage(pageId) {
    var index = workspace.pages.findIndex(function (page) { return page.id === pageId; });
    if (index < 0 || workspace.pages.length < 2) return false;
    var page = workspace.pages[index];
    transact(function () {
      page.boards.forEach(function (board) {
        board.bookmarks.forEach(function (bookmark) {
          workspace.trash.unshift({ id: makeId('deleted'), deletedAt: Date.now(), pageId: page.id, pageName: page.name, boardId: board.id, boardName: board.name, bookmark: bookmark });
        });
      });
      workspace.pages.splice(index, 1);
      workspace.favoriteOrder = workspace.favoriteOrder.filter(function (id) { return !page.boards.some(function (board) { return board.bookmarks.some(function (bookmark) { return bookmark.id === id; }); }); });
      favoriteOrder = workspace.favoriteOrder;
      if (activePage === pageId) { activePage = workspace.pages[0].id; activeBoard = workspace.pages[0].boards[0].id; }
    });
    return true;
  }
  function deleteBoard(pageId, boardId) {
    var page = pageById(pageId), index = page ? page.boards.findIndex(function (board) { return board.id === boardId; }) : -1;
    if (index < 0 || page.boards.length < 2) return false;
    var board = page.boards[index];
    transact(function () {
      board.bookmarks.forEach(function (bookmark) {
        workspace.trash.unshift({ id: makeId('deleted'), deletedAt: Date.now(), pageId: page.id, pageName: page.name, boardId: board.id, boardName: board.name, bookmark: bookmark });
      });
      page.boards.splice(index, 1);
      workspace.favoriteOrder = workspace.favoriteOrder.filter(function (id) { return !board.bookmarks.some(function (bookmark) { return bookmark.id === id; }); });
      favoriteOrder = workspace.favoriteOrder;
      if (activePage === pageId && activeBoard === boardId) activeBoard = page.boards[0].id;
    });
    return true;
  }

  function createBookmark(data) {
    data = data || {};
    var name = String(data.name || '').trim();
    var url = String(data.url || '').trim();
    if (!name || !url) return false;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!validWebUrl(url)) return false;
    url = new URL(url).href;
    var page = pageById(data.pageId) || currentPage();
    var board = boardById(page, data.boardId) || page.boards[0];
    if (board.bookmarks.some(function (bookmark) { return new URL(bookmark.url).href === url; })) return false;
    var bookmark = { id: makeId('bookmark'), name: name.slice(0, 200), url: url, description: String(data.description || '').slice(0, 500), tags: normalizeTags(data.tags), addedAt: Date.now(), uses: 0, favorite: false };
    transact(function () { board.bookmarks.unshift(bookmark); activePage = page.id; activeBoard = board.id; });
    setActive(page.id, board.id);
    return true;
  }

  function findBookmark(bookmarkId) {
    var result = null;
    workspace.pages.some(function (page) {
      return page.boards.some(function (board) {
        var index = board.bookmarks.findIndex(function (bookmark) { return bookmark.id === bookmarkId; });
        if (index < 0) return false;
        result = { page: page, board: board, index: index, bookmark: board.bookmarks[index] };
        return true;
      });
    });
    return result;
  }

  function updateBookmark(bookmarkId, updates) {
    var found = findBookmark(bookmarkId);
    if (!found) return false;
    var destinationPage = pageById(updates.pageId || found.page.id);
    var destinationBoard = boardById(destinationPage, updates.boardId || found.board.id);
    var name = String(updates.name || '').trim();
    var url = String(updates.url || '').trim();
    if (!destinationBoard || !name || !url) return false;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!validWebUrl(url)) return false;
    url = new URL(url).href;
    if (destinationBoard.bookmarks.some(function (bookmark) { return bookmark.id !== bookmarkId && new URL(bookmark.url).href === url; })) return false;
    transact(function () {
      if (found.board !== destinationBoard) found.board.bookmarks.splice(found.index, 1);
      found.bookmark.name = name.slice(0, 200);
      found.bookmark.url = url;
      found.bookmark.description = String(updates.description || '').slice(0, 500);
      found.bookmark.tags = normalizeTags(updates.tags);
      if (found.board !== destinationBoard) destinationBoard.bookmarks.push(found.bookmark);
      activePage = destinationPage.id;
      activeBoard = destinationBoard.id;
    });
    return true;
  }

  function moveBookmark(bookmarkId, pageId, boardId) {
    var found = findBookmark(bookmarkId);
    var page = pageById(pageId);
    var board = boardById(page, boardId);
    if (!found || !board) return false;
    if (found.board.id === board.id) return true;
    if (board.bookmarks.some(function (bookmark) { return new URL(bookmark.url).href === new URL(found.bookmark.url).href; })) return false;
    transact(function () { found.board.bookmarks.splice(found.index, 1); board.bookmarks.push(found.bookmark); });
    return true;
  }

  function toggleFavorite(bookmarkId) {
    var found = findBookmark(bookmarkId);
    if (!found) return false;
    transact(function () {
      found.bookmark.favorite = !found.bookmark.favorite;
      if (found.bookmark.favorite && favoriteOrder.indexOf(bookmarkId) < 0) favoriteOrder.push(bookmarkId);
      if (!found.bookmark.favorite) favoriteOrder = favoriteOrder.filter(function (id) { return id !== bookmarkId; });
      workspace.favoriteOrder = favoriteOrder;
    });
    return true;
  }
  function moveFavorite(bookmarkId, targetId) {
    var source = favoriteOrder.indexOf(bookmarkId), target = favoriteOrder.indexOf(targetId);
    if (source < 0 || target < 0 || source === target) return false;
    transact(function () { favoriteOrder.splice(source, 1); favoriteOrder.splice(target, 0, bookmarkId); workspace.favoriteOrder = favoriteOrder; });
    return true;
  }
  function openBookmark(bookmarkId, mode) {
    var found = findBookmark(bookmarkId);
    if (!found) return false;
    if (mode === 'incognito') {
      if (typeof chrome === 'undefined' || !chrome.extension || !chrome.extension.isAllowedIncognitoAccess) { alert('Incognito access is unavailable. Enable it for this extension in Chrome settings.'); return false; }
      chrome.extension.isAllowedIncognitoAccess(function (allowed) {
        if (!allowed) { alert('Enable “Allow in incognito” for this extension in chrome://extensions.'); return; }
        chrome.windows.create({ url: found.bookmark.url, incognito: true }, function () {
          if (!chrome.runtime.lastError) recordBookmarkUse(bookmarkId);
        });
      });
    } else if (mode === 'current') {
      recordBookmarkUse(bookmarkId);
      window.location.href = found.bookmark.url;
    } else {
      var opened = window.open(found.bookmark.url, '_blank', 'noopener');
      if (opened) recordBookmarkUse(bookmarkId);
    }
    return true;
  }
  function recordBookmarkUse(bookmarkId, redraw) {
    var found = findBookmark(bookmarkId);
    if (!found) return;
    found.bookmark.uses += 1;
    found.bookmark.lastUsed = Date.now();
    App.Storage.set(KEY, workspace);
    if (redraw !== false) emit();
  }

  function captureTab(tab) {
    tab = tab || {};
    var url = tab.url || '';
    var title = tab.title || url;
    if (!validWebUrl(url) || !title) return false;
    try { url = new URL(url).href; } catch (error) { return false; }
    var board = currentBoard();
    if (board.bookmarks.some(function (bookmark) { return new URL(bookmark.url).href === url; })) return 'exists';
    transact(function () {
      board.bookmarks.unshift({ id: makeId('bookmark'), name: String(title).slice(0, 200), url: url, description: '', addedAt: Date.now(), uses: 0, favorite: false });
    });
    return true;
  }

  function removeBookmark(bookmarkId) {
    var found = findBookmark(bookmarkId);
    if (!found) return false;
    transact(function () {
      found.board.bookmarks.splice(found.index, 1);
      workspace.trash.unshift({ id: makeId('deleted'), deletedAt: Date.now(), pageId: found.page.id, pageName: found.page.name, boardId: found.board.id, boardName: found.board.name, bookmark: found.bookmark });
    });
    return true;
  }

  function restoreBookmark(deletedId) {
    var index = workspace.trash.findIndex(function (entry) { return entry.id === deletedId; });
    if (index < 0) return false;
    var item = workspace.trash[index];
    var page = pageById(item.pageId) || currentPage();
    var board = boardById(page, item.boardId) || page.boards[0];
    if (board.bookmarks.some(function (bookmark) { return new URL(bookmark.url).href === new URL(item.bookmark.url).href; })) return false;
    transact(function () {
      item = workspace.trash.splice(index, 1)[0];
      page = pageById(item.pageId) || currentPage();
      board = boardById(page, item.boardId) || page.boards[0];
      board.bookmarks.push(item.bookmark);
    });
    return true;
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(snapshot());
    workspace = JSON.parse(undoStack.pop());
    normalize();
    persist();
    return true;
  }
  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(snapshot());
    workspace = JSON.parse(redoStack.pop());
    normalize();
    persist();
    return true;
  }

  function matches(bookmark) {
    if (!query) return true;
    var fields = [bookmark.name, bookmark.url, bookmark.description, bookmark.pageName, bookmark.boardName, normalizeTags(bookmark.tags).join(' '), normalizeTags(bookmark.tags).map(function (tag) { return '#' + tag; }).join(' ')].map(function (value) {
      return String(value || '').toLowerCase().trim();
    });
    if (exact) return fields.some(function (field) { return field === query; });
    return query.split(/\s+/).every(function (token) {
      return fields.some(function (field) { return field.indexOf(token) >= 0; });
    });
  }

  function getVisibleBookmarks() {
    if (deletedView) {
      return workspace.trash.map(function (entry) {
        return Object.assign({}, entry.bookmark, { deletedId: entry.id, pageName: entry.pageName, boardName: entry.boardName });
      }).filter(matches);
    }
    var results = [];
    workspace.pages.forEach(function (page) {
      page.boards.forEach(function (board) {
        board.bookmarks.forEach(function (bookmark) {
          results.push(Object.assign({}, bookmark, { pageId: page.id, pageName: page.name, boardId: board.id, boardName: board.name }));
        });
      });
    });
    var page = currentPage();
    var board = currentBoard();
    if (searchScope === 'recently-visited') results = results.filter(function (bookmark) { return bookmark.lastUsed; }).sort(function (a, b) { return b.lastUsed - a.lastUsed; }).slice(0, 20);
    else if (searchScope === 'favorites') results = results.filter(function (bookmark) { return bookmark.favorite; }).sort(function (a, b) { return favoriteOrder.indexOf(a.id) - favoriteOrder.indexOf(b.id); });
    else if (searchScope === 'page') results = results.filter(function (bookmark) { return bookmark.pageId === page.id; });
    else if (searchScope === 'board') results = results.filter(function (bookmark) { return bookmark.pageId === page.id && bookmark.boardId === board.id; });
    return results.filter(matches);
  }

  function setQuery(value, isExact, scope) {
    query = String(value || '').trim().toLowerCase();
    if (typeof isExact === 'boolean') exact = isExact;
    if (['workspace', 'page', 'board', 'favorites', 'recently-visited'].indexOf(scope) >= 0) searchScope = scope;
    if (query) { recentSearches = [query].concat(recentSearches.filter(function (item) { return item !== query; })).slice(0, 8); App.Storage.set(skey('bookmark-recent-searches'), recentSearches); }
    emit();
  }

  function dataForExport() {
    return { format: 'glass-newtab-workspace', version: VERSION, exportedAt: new Date().toISOString(), workspace: workspace };
  }

  function importJSON(data) {
    var incoming = data && (data.workspace || data);
    if (!incoming || !Array.isArray(incoming.pages)) throw new Error('This file does not contain a valid workspace.');
    var imported = JSON.parse(JSON.stringify(incoming));
    imported.pages = imported.pages.filter(function (page) { return page && typeof page === 'object'; });
    imported.pages.forEach(function (page) {
      page.id = makeId('page');
      page.boards = Array.isArray(page.boards) ? page.boards.filter(function (board) { return board && typeof board === 'object'; }) : [];
      page.boards.forEach(function (board) {
        board.id = makeId('board');
        board.bookmarks = Array.isArray(board.bookmarks) ? board.bookmarks.filter(function (bookmark) { return bookmark && typeof bookmark === 'object'; }) : [];
        board.bookmarks.forEach(function (bookmark) { bookmark.id = makeId('bookmark'); });
      });
    });
    if (!imported.pages.length) throw new Error('This workspace contains no pages.');
    transact(function () { imported.pages.forEach(function (page) { workspace.pages.push(page); }); normalize(); });
    return imported.pages.length;
  }

  function parseBookmarksFile(text, fileName) {
    var links = [];
    var lower = String(fileName || '').toLowerCase();
    if (lower.endsWith('.json')) {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        links = parsed.filter(function (item) { return item && typeof item === 'object'; }).map(function (item) {
          return { name: String(item.name || item.title || item.url || ''), url: String(item.url || ''), description: String(item.description || ''), tags: normalizeTags(item.tags), pageName: String(item.page || ''), boardName: String(item.board || item.category || '') };
        }).filter(function (item) { return validWebUrl(item.url); });
      } else if (parsed && (parsed.workspace || parsed.pages)) return importJSON(parsed);
      else throw new Error('This JSON file does not contain bookmarks or a workspace.');
    } else if (lower.endsWith('.csv')) {
      links = parseCSV(text).map(function (row) {
        return { name: String(row.name || row.title || row.url || ''), url: String(row.url || ''), description: String(row.description || ''), tags: normalizeTags(row.tags), pageName: String(row.page || ''), boardName: String(row.board || row.category || '') };
      }).filter(function (item) { return validWebUrl(item.url); });
    } else {
      var doc = new DOMParser().parseFromString(text, 'text/html');
      doc.querySelectorAll('a[href]').forEach(function (anchor) {
        var href = anchor.getAttribute('href') || '';
        if (!validWebUrl(href) && /^https?:\/\//i.test(href)) href = new URL(href).href;
        if (validWebUrl(href)) links.push({ name: anchor.textContent.trim() || href, url: href, description: '' });
      });
    }    var known = {};
    workspace.pages.forEach(function (page) {
      page.boards.forEach(function (board) { board.bookmarks.forEach(function (bookmark) { known[bookmark.url] = true; }); });
    });
    var additions = links.filter(function (item) {
      var canonical = new URL(item.url).href;
      if (known[canonical]) return false;
      known[canonical] = true;
      item.url = canonical;
      return true;
    }).map(function (item) {
      return { id: makeId('bookmark'), name: item.name || item.url, url: item.url, description: item.description || '', tags: normalizeTags(item.tags), addedAt: Date.now(), uses: 0, favorite: false, pageName: item.pageName || '', boardName: item.boardName || '' };
    });
    if (additions.length) {
      var fallbackPage = currentPage(), fallbackBoard = currentBoard();
      transact(function () {
        additions.forEach(function (item) {
          var page = fallbackPage, board = fallbackBoard;
          if (item.pageName) {
            page = workspace.pages.find(function (candidate) { return candidate.name.toLowerCase() === item.pageName.toLowerCase(); });
            if (!page) { page = { id: makeId('page'), name: item.pageName.slice(0, 40), boards: [] }; workspace.pages.push(page); }
            board = null;
          }
          if (item.boardName) {
            board = page.boards.find(function (candidate) { return candidate.name.toLowerCase() === item.boardName.toLowerCase(); });
            if (!board) { board = { id: makeId('board'), name: item.boardName.slice(0, 40), bookmarks: [] }; page.boards.push(board); }
          }
          if (!board) {
            board = page.boards[0];
            if (!board) { board = { id: makeId('board'), name: 'Home', bookmarks: [] }; page.boards.push(board); }
          }
          delete item.pageName; delete item.boardName;
          board.bookmarks.unshift(item);
        });
        normalize();
      });
    }
    return additions.length;
  }

  function setupUI() {
    var pageTabs = byId('page-tabs');
    var boardTabs = byId('category-tabs');
    var pageScroller = setupTabScroller(byId('page-tabs-scroller'));
    var boardScroller = setupTabScroller(byId('category-tabs-scroller'));
    var statusLine = byId('bookmarks-status');
    var grid = byId('bookmarks-grid');
    var empty = byId('bookmarks-empty');
    var search = byId('bookmark-search');
    var scope = byId('bookmark-search-scope');
    var title = root ? root.querySelector('.bookmark-heading h1') : null;
    var addPageButton = byId('add-page-btn');
    var addBoardButton = byId('add-category-btn');
    var inlinePageButton = byId('page-add-inline');
    var inlineBoardButton = byId('board-add-inline');
    var addBookmarkButton = byId('add-bookmark-btn');
    var undoButton = byId('undo-action-btn');
    var redoButton = byId('redo-action-btn');
    var trashButton = byId('trash-view-btn');
    var trashCount = byId('trash-count');
    var importInput = byId('workspace-import-file');
    var bookmarkModal = byId('bookmark-modal');
    var quickSaveModal = byId('quick-save-modal');
    var pageSelect = byId('bm-page');
    var boardSelect = byId('bm-category');
    var saveBookmarkButton = byId('bm-save');
    var savedScope = App.Storage.get(skey('bookmark-search-scope'), 'workspace');
    if (['workspace', 'page', 'board', 'favorites', 'recently-visited'].indexOf(savedScope) < 0) savedScope = 'board';
    searchScope = savedScope;
    if (scope) scope.value = savedScope;
    exact = !!App.Storage.get(skey('bookmark-exact-search'), false);
    recentSearches = App.Storage.get(skey('bookmark-recent-searches'), []);
    if (!Array.isArray(recentSearches)) recentSearches = [];

    function renderTabs() {
      var boardLabel = root ? root.querySelector('.board-label span') : null;
      if (boardLabel) boardLabel.textContent = deletedView ? 'Items you can restore' : 'Groups in this page';
      // Rebuilding the rows would otherwise snap them back to the first page or
      // board, so a board picked from the end of the row would scroll out from
      // under the pointer that picked it.
      var pageScrollLeft = pageTabs ? pageTabs.scrollLeft : 0;
      var boardScrollLeft = boardTabs ? boardTabs.scrollLeft : 0;
      if (pageTabs) {
        pageTabs.innerHTML = '';
        workspace.pages.forEach(function (page) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'page-tab' + (page.id === activePage && searchScope === 'page' ? ' active' : '');
          button.textContent = page.name;
          button.title = 'Click to open; right-click to rename or delete';
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', page.id === activePage && searchScope === 'page' ? 'true' : 'false');
          button.addEventListener('contextmenu', function (event) {
            event.preventDefault();
            var value = prompt('Rename page, or leave blank to delete:', page.name);
            if (value === null) return;
            if (value.trim()) {
              if (!renamePage(page.id, value)) alert('Page names must be unique and cannot be empty.');
            } else if (workspace.pages.length < 2) alert('Keep at least one page.');
            else if (confirm('Move bookmarks in “' + page.name + '” to Trash and delete this page?')) deletePage(page.id);
          });
          button.addEventListener('click', function () {
            deletedView = false;
            if (scope) { scope.value = 'page'; scope.disabled = false; }
            App.Storage.set(skey('bookmark-search-scope'), 'page');
            searchScope = 'page';
            setActive(page.id, page.boards[0] && page.boards[0].id);
          });
          button.addEventListener('dragover', function (event) {
            if (event.dataTransfer.types.indexOf('text/workspace-bookmark') >= 0) event.preventDefault();
          });
          button.addEventListener('drop', function (event) {
            event.preventDefault();
            var targetBoard = page.boards[0];
            if (targetBoard && moveBookmark(event.dataTransfer.getData('text/workspace-bookmark'), page.id, targetBoard.id)) setActive(page.id, targetBoard.id);
          });
          pageTabs.appendChild(button);
        });
      }
      if (boardTabs) {
        boardTabs.innerHTML = '';
        currentPage().boards.forEach(function (board) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'category-tab' + (board.id === activeBoard && searchScope === 'board' && !deletedView ? ' active' : '');
          button.innerHTML = '<span>' + escapeText(board.name) + '</span><span class="category-count">' + board.bookmarks.length + '</span>';
          button.title = 'Click to open; right-click to rename or delete';
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', board.id === activeBoard && searchScope === 'board' && !deletedView ? 'true' : 'false');
          button.addEventListener('contextmenu', function (event) {
            event.preventDefault();
            var value = prompt('Rename board, or leave blank to delete:', board.name);
            if (value === null) return;
            if (value.trim()) {
              if (!renameBoard(currentPage().id, board.id, value)) alert('Board names must be unique within this page.');
            } else if (currentPage().boards.length < 2) alert('Keep at least one board on each page.');
            else if (confirm('Move bookmarks in “' + board.name + '” to Trash and delete this board?')) deleteBoard(currentPage().id, board.id);
          });
          button.addEventListener('click', function () {
            deletedView = false;
            if (scope) { scope.value = 'board'; scope.disabled = false; }
            App.Storage.set(skey('bookmark-search-scope'), 'board');
            searchScope = 'board';
            setActive(activePage, board.id);
          });
          button.addEventListener('dragover', function (event) {
            if (event.dataTransfer.types.indexOf('text/workspace-bookmark') >= 0) event.preventDefault();
          });
          button.addEventListener('drop', function (event) {
            event.preventDefault();
            var bookmarkId = event.dataTransfer.getData('text/workspace-bookmark');
            var source = findBookmark(bookmarkId);
            if (source && (source.page.id !== activePage || source.board.id !== board.id) && moveBookmark(bookmarkId, activePage, board.id)) setActive(activePage, board.id);
          });
          boardTabs.appendChild(button);
        });
      }
      if (pageTabs) pageTabs.scrollLeft = pageScrollLeft;
      if (boardTabs) boardTabs.scrollLeft = boardScrollLeft;
      if (pageScroller) pageScroller.sync();
      if (boardScroller) boardScroller.sync();
    }

    // How much of the library is on screen, so a list that scrolls never reads as
    // a list that lost entries.
    function updateStatusLine(count) {
      if (!statusLine) return;
      var scopeLabel = { workspace: 'All pages', page: currentPage().name, board: currentBoard().name, favorites: 'Favorites', 'recently-visited': 'Recently visited' };
      var label = deletedView ? 'Trash' : (scopeLabel[searchScope] || 'All pages');
      var noun = count === 1 ? 'bookmark' : 'bookmarks';
      statusLine.textContent = deletedView ? count + ' deleted ' + noun : count + ' ' + noun + ' \u00b7 ' + label;
    }

    // The fade at the foot of the list is only honest while something is below it,
    // so it follows the scroll position rather than the number of cards.
    function syncScrollAffordance() {
      if (!grid) return;
      grid.classList.toggle('is-scrollable', grid.scrollHeight - grid.scrollTop - grid.clientHeight > 1);
    }

    function renderCards() {
      if (!grid) return;
      // Re-rendering rebuilds every card, which would otherwise drop a long list
      // back to its first row — the same problem as a clipped list, reached from
      // the other direction.
      var previousScrollTop = grid.scrollTop;
      grid.innerHTML = '';
      var results = getVisibleBookmarks();
      var emptyMessage = empty && empty.querySelector('strong');
      var emptyHint = empty && empty.querySelector('span:last-child');
      if (empty) empty.classList.toggle('hidden', results.length > 0);
      if (emptyMessage) emptyMessage.textContent = deletedView ? 'Trash is empty' : 'No bookmarks found';
      if (emptyHint) emptyHint.textContent = deletedView ? 'Deleted bookmarks can be restored here.' : 'Try another search, or add a bookmark to this board.';
      var sort = byId('bookmark-sort');
      var sortMode = sort ? sort.value : 'custom';
      if (!deletedView && sortMode === 'az') results.sort(function (a, b) { return a.name.localeCompare(b.name); });
      else if (!deletedView && sortMode === 'recent') results.sort(function (a, b) { return b.addedAt - a.addedAt; });
      else if (!deletedView && sortMode === 'used') results.sort(function (a, b) { return b.uses - a.uses || a.name.localeCompare(b.name); });

      results.forEach(function (bookmark) {
        var card = document.createElement('article');
        card.className = 'bm-item workspace-bookmark-card';
        card.dataset.id = bookmark.id || bookmark.deletedId;
        // Programmatic focus target for arrow-key navigation: in Trash the link
        // has no href and so cannot take focus, so the card itself does.
        card.tabIndex = -1;
        var link = document.createElement('a');
        link.className = 'bm-link';
        link.href = bookmark.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = (bookmark.name || bookmark.url) + ' — ' + bookmark.url;
        link.setAttribute('aria-label', (bookmark.name || bookmark.url) + ', ' + bookmark.url);
        var icon = document.createElement('span');
        icon.className = 'bm-icon';
        var image = document.createElement('img');
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.loading = 'lazy';
        var fallback = document.createElement('span');
        fallback.className = 'bm-fallback';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = (bookmark.name || '?').charAt(0).toUpperCase();
        fallback.hidden = true;
        function showFaviconFallback() {
          image.hidden = true;
          fallback.hidden = false;
          icon.classList.add('bm-icon--fallback');
        }
        try { image.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(bookmark.url).hostname) + '&sz=64'; }
        catch (error) { showFaviconFallback(); }
        image.addEventListener('error', showFaviconFallback);
        icon.appendChild(image);
        icon.appendChild(fallback);
        var text = document.createElement('span');
        text.className = 'bm-text';
        var name = document.createElement('strong');
        name.className = 'bm-name';
        name.textContent = bookmark.name || bookmark.url;
        name.title = name.textContent;
        text.appendChild(name);
        // A card with no description of its own used to print its raw URL here, so
        // every such card carried a redundant "https://…" line. The name is enough;
        // the URL is already the link target and is on the link's title/aria-label.
        var descriptionText = String(bookmark.description || '').trim();
        if (descriptionText) {
          var description = document.createElement('span');
          description.className = 'bm-description';
          description.textContent = descriptionText;
          text.appendChild(description);
        }
        if (bookmark.tags && bookmark.tags.length) {
          var tags = document.createElement('span');
          tags.className = 'bookmark-tags';
          tags.textContent = bookmark.tags.map(function (tag) { return '#' + tag; }).join(' ');
          text.appendChild(tags);
        }
        link.appendChild(icon);
        link.appendChild(text);
        card.appendChild(link);

        if (deletedView) {
          link.removeAttribute('href');
          link.removeAttribute('target');
          link.classList.add('disabled');
          var restoreButton = actionButton('Restore', 'restore-bookmark');
          restoreButton.addEventListener('click', function () { restoreBookmark(bookmark.deletedId); });
          card.appendChild(restoreButton);
        } else {
          link.addEventListener('click', function () {
            recordBookmarkUse(bookmark.id, false);
            window.setTimeout(emit, 0);
          });
          var cardLabel = bookmark.name || bookmark.url;
          var editButton = actionButton('Edit', 'edit-bookmark');
          editButton.setAttribute('aria-label', 'Edit ' + cardLabel);
          editButton.addEventListener('click', function () { openBookmarkEditor(bookmark); });
          var favoriteButton = actionButton(bookmark.favorite ? '★' : '☆', 'favorite-bookmark');
          favoriteButton.title = bookmark.favorite ? 'Remove from favorites' : 'Add to favorites';
          favoriteButton.setAttribute('aria-label', favoriteButton.title);
          favoriteButton.setAttribute('aria-pressed', String(!!bookmark.favorite));
          favoriteButton.addEventListener('click', function () { toggleFavorite(bookmark.id); });
          var removeButton = actionButton('×', 'delete-bookmark');
          removeButton.setAttribute('aria-label', 'Move to trash');
          removeButton.addEventListener('click', function () { removeBookmark(bookmark.id); });
          var openOptions = document.createElement('details');
          openOptions.className = 'bookmark-open-options';
          var openSummary = document.createElement('summary');
          openSummary.textContent = '↗';
          openSummary.title = 'Open options';
          openSummary.setAttribute('aria-label', 'Open ' + cardLabel);
          openOptions.appendChild(openSummary);
          [['New tab', 'new'], ['Current tab', 'current'], ['Incognito', 'incognito']].forEach(function (option) {
            var choice = actionButton(option[0], 'open-' + option[1]);
            choice.addEventListener('click', function () { openBookmark(bookmark.id, option[1]); openOptions.open = false; });
            openOptions.appendChild(choice);
          });
          card.appendChild(editButton);
          card.appendChild(favoriteButton);
          card.appendChild(removeButton);
          card.appendChild(openOptions);
          card.draggable = true;
          card.addEventListener('dragstart', function (event) {
            event.dataTransfer.setData('text/workspace-bookmark', bookmark.id);
            if (searchScope === 'favorites') event.dataTransfer.setData('text/favorite-bookmark', bookmark.id);
            event.dataTransfer.effectAllowed = 'move';
          });
          card.addEventListener('dragover', function (event) {
            var types = event.dataTransfer.types;
            if (types.indexOf('text/workspace-bookmark') >= 0 || types.indexOf('text/favorite-bookmark') >= 0) { event.preventDefault(); card.classList.add('drag-over'); }
          });
          card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
          card.addEventListener('drop', function (event) {
            if (event.dataTransfer.types.indexOf('text/favorite-bookmark') >= 0) {
              event.preventDefault(); event.stopPropagation(); card.classList.remove('drag-over');
              moveFavorite(event.dataTransfer.getData('text/favorite-bookmark'), bookmark.id);
              return;
            }
            event.preventDefault();
            card.classList.remove('drag-over');
            var source = findBookmark(event.dataTransfer.getData('text/workspace-bookmark'));
            if (!source || source.bookmark.id === bookmark.id) return;
            if (source.page.id !== bookmark.pageId || source.board.id !== bookmark.boardId) {
              if (moveBookmark(source.bookmark.id, bookmark.pageId, bookmark.boardId)) setActive(bookmark.pageId, bookmark.boardId);
              return;
            }
            transact(function () {
              var moved = source.board.bookmarks.splice(source.index, 1)[0];
              var targetIndex = source.board.bookmarks.findIndex(function (item) { return item.id === bookmark.id; });
              source.board.bookmarks.splice(Math.max(0, targetIndex), 0, moved);
            });
          });
        }
        grid.appendChild(card);
      });

      if (title) title.textContent = deletedView ? 'Recently Deleted' : (searchScope === 'favorites' ? 'Favorites' : 'Bookmarks');
      if (addBookmarkButton) addBookmarkButton.disabled = deletedView;
      if (addPageButton) addPageButton.disabled = deletedView;
      if (addBoardButton) addBoardButton.disabled = deletedView;
      if (inlinePageButton) inlinePageButton.disabled = deletedView;
      if (inlineBoardButton) inlineBoardButton.disabled = deletedView;
      if (trashCount) trashCount.textContent = workspace.trash.length;
      if (undoButton) undoButton.disabled = !undoStack.length;
      if (redoButton) redoButton.disabled = !redoStack.length;
      if (trashButton) trashButton.classList.toggle('active', deletedView);
      document.body.classList.toggle('privacy-mode', App.Storage.get('privacy-mode', false));
      updateStatusLine(results.length);
      grid.scrollTop = previousScrollTop;
      syncScrollAffordance();
    }

    function updateEditorPages() {
      var selectedPage = pageSelect && pageSelect.value;
      var selectedBoard = boardSelect && boardSelect.value;
      var quickSelectedPage = byId('quick-save-page') && byId('quick-save-page').value;
      var quickSelectedBoard = byId('quick-save-board') && byId('quick-save-board').value;
      populateLocationSelects(pageSelect, boardSelect, selectedPage || activePage, selectedBoard);
      populateLocationSelects(byId('quick-save-page'), byId('quick-save-board'), quickSelectedPage || activePage, quickSelectedBoard);
    }
    // ---- page / board picker ------------------------------------------
    // Two ways around the library: compact dropdowns (the default) and the old
    // scrollable pill rows. The choice is remembered so the panel comes back
    // the way it was left.
    var pageField = byId('page-select');
    var boardField = byId('board-select');
    var selectorRow = byId('workspace-selectors');
    var pickerButton = byId('selector-mode-btn');
    var pickerRows = root ? Array.prototype.slice.call(root.querySelectorAll('.picker-rows')) : [];
    // Suffixed like every other preference, so each keeper remembers its own
    // picker instead of one panel's choice switching the other one over.
    var pickerMode = App.Storage.get(skey('bookmark-picker-mode'), 'dropdown');
    if (pickerMode !== 'rows') pickerMode = 'dropdown';

    function applyPickerMode() {
      var rows = pickerMode === 'rows';
      if (selectorRow) selectorRow.classList.toggle('hidden', rows);
      pickerRows.forEach(function (row) { row.classList.toggle('hidden', !rows); });
      if (pickerButton) {
        pickerButton.textContent = rows ? 'Dropdowns' : 'Pill rows';
        pickerButton.setAttribute('aria-pressed', String(rows));
        pickerButton.title = rows ? 'Switch to the compact dropdown pickers' : 'Switch to scrollable pill rows';
      }
      if (pageScroller) pageScroller.sync();
      if (boardScroller) boardScroller.sync();
    }
    if (pickerButton) pickerButton.addEventListener('click', function () {
      pickerMode = pickerMode === 'rows' ? 'dropdown' : 'rows';
      App.Storage.set(skey('bookmark-picker-mode'), pickerMode);
      applyPickerMode();
    });
    applyPickerMode();

    function syncSelectors() {
      if (pageField) {
        pageField.innerHTML = '';
        workspace.pages.forEach(function (page) {
          var option = document.createElement('option');
          option.value = page.id;
          option.textContent = page.name;
          pageField.appendChild(option);
        });
        pageField.value = activePage;
      }
      if (boardField) {
        var page = currentPage();
        boardField.innerHTML = '';
        page.boards.forEach(function (board) {
          var option = document.createElement('option');
          option.value = board.id;
          option.textContent = board.name + ' (' + board.bookmarks.length + ')';
          boardField.appendChild(option);
        });
        boardField.value = activeBoard;
      }
    }

    if (pageField) {
      pageField.addEventListener('change', function () {
        var page = pageById(pageField.value);
        if (!page) return;
        deletedView = false;
        if (scope) { scope.value = 'page'; scope.disabled = false; }
        App.Storage.set(skey('bookmark-search-scope'), 'page');
        searchScope = 'page';
        setActive(page.id, page.boards[0] && page.boards[0].id);
      });
      pageField.addEventListener('contextmenu', function (event) { event.preventDefault(); renameActivePage(); });
    }
    if (boardField) {
      boardField.addEventListener('change', function () {
        if (!boardById(currentPage(), boardField.value)) return;
        deletedView = false;
        if (scope) { scope.value = 'board'; scope.disabled = false; }
        App.Storage.set(skey('bookmark-search-scope'), 'board');
        searchScope = 'board';
        setActive(activePage, boardField.value);
      });
      boardField.addEventListener('contextmenu', function (event) { event.preventDefault(); renameActiveBoard(); });
    }

    function deleteActivePage() {
      var page = currentPage();
      if (workspace.pages.length < 2) { alert('Keep at least one page.'); return; }
      if (confirm('Move bookmarks in “' + page.name + '” to Trash and delete this page?')) deletePage(page.id);
    }
    function deleteActiveBoard() {
      var board = currentBoard();
      if (currentPage().boards.length < 2) { alert('Keep at least one board on each page.'); return; }
      if (confirm('Move bookmarks in “' + board.name + '” to Trash and delete this board?')) deleteBoard(currentPage().id, board.id);
    }
    function renameActivePage() {
      var page = currentPage();
      var value = prompt('Rename page, or leave blank to delete:', page.name);
      if (value === null) return;
      if (value.trim()) { if (!renamePage(page.id, value)) alert('Page names must be unique and cannot be empty.'); }
      else deleteActivePage();
    }
    function renameActiveBoard() {
      var board = currentBoard();
      var value = prompt('Rename board, or leave blank to delete:', board.name);
      if (value === null) return;
      if (value.trim()) { if (!renameBoard(currentPage().id, board.id, value)) alert('Board names must be unique within this page.'); }
      else deleteActiveBoard();
    }
    [['rename-page-btn', renameActivePage], ['rename-board-btn', renameActiveBoard],
     ['delete-page-btn', deleteActivePage], ['delete-board-btn', deleteActiveBoard]].forEach(function (pair) {
      var button = byId(pair[0]);
      if (button) button.addEventListener('click', pair[1]);
    });

    // ---- layout: grid, vertical list or compact list -------------------
    // Stored per keeper, so one panel can hold a card grid while the other is a
    // vertical list. A fresh install opens on the vertical list: the panel ships
    // as a tall narrow column, and full-width rows read better there than a card
    // grid squeezed into one column.
    var panel = root || byId('bookmarks-section');
    var layoutButtons = panel ? Array.prototype.slice.call(panel.querySelectorAll('.layout-option')) : [];
    var layoutMode = App.Storage.get(skey('bookmark-layout'), 'list');
    if (['grid', 'list', 'compact'].indexOf(layoutMode) < 0) layoutMode = 'list';
    function applyLayoutMode() {
      if (panel) panel.dataset.layout = layoutMode;
      layoutButtons.forEach(function (button) {
        var active = button.dataset.layout === layoutMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    layoutButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        layoutMode = button.dataset.layout;
        App.Storage.set(skey('bookmark-layout'), layoutMode);
        applyLayoutMode();
        emit();
      });
    });
    applyLayoutMode();

    // The list is the only scrollable region of the panel, so a wheel over the
    // heading, the search row or the status line used to do nothing at all — the
    // panel looked stuck unless the pointer happened to sit over the cards. Hand
    // those events to the list, so the panel reads as one scrollable column.
    if (panel && grid) {
      panel.addEventListener('wheel', function (event) {
        if (event.target && grid.contains(event.target)) return; // the list already has it
        if (grid.scrollHeight <= grid.clientHeight) return;      // nothing to scroll
        event.preventDefault();
        grid.scrollTop += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      }, { passive: false });
    }

    function render() { updateEditorPages(); renderTabs(); syncSelectors(); renderCards(); }
    listeners.push(render);
    if (addPageButton) addPageButton.addEventListener('click', function () { openNameModal('page-modal', 'page-name'); });
    if (addBoardButton) addBoardButton.addEventListener('click', function () { openNameModal('category-modal', 'category-name'); });
    if (inlinePageButton) inlinePageButton.addEventListener('click', function () { openNameModal('page-modal', 'page-name'); });
    if (inlineBoardButton) inlineBoardButton.addEventListener('click', function () { openNameModal('category-modal', 'category-name'); });
    if (grid) {
      grid.addEventListener('scroll', syncScrollAffordance, { passive: true });
      if (typeof ResizeObserver === 'function') new ResizeObserver(syncScrollAffordance).observe(grid);
    }
    // Arrow keys walk the grid, so a long library is reachable without tabbing
    // through every card. The row length is read from the laid-out grid, so the
    // same handler works for the card grid and the single-column list layouts.
    if (grid) grid.addEventListener('keydown', function (event) {
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(event.key) < 0) return;
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.workspace-bookmark-card'));
      if (!cards.length) return;
      var activeCard = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.workspace-bookmark-card') : null;
      var current = cards.indexOf(activeCard);
      if (current < 0) return;
      var columns = 1;
      try { columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1; } catch (error) { columns = 1; }
      var next = current;
      if (event.key === 'ArrowRight') next = current + 1;
      else if (event.key === 'ArrowLeft') next = current - 1;
      else if (event.key === 'ArrowDown') next = current + columns;
      else if (event.key === 'ArrowUp') next = current - columns;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = cards.length - 1;
      if (next < 0 || next >= cards.length || next === current) return;
      event.preventDefault();
      var target = cards[next].querySelector('.bm-link') || cards[next];
      if (target.focus) target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    bindNameModal('page-modal', 'page-name', 'page-modal-close', 'page-save', addPage);
    bindNameModal('category-modal', 'category-name', 'category-modal-close', 'category-save', addBoard);
    if (addBookmarkButton) addBookmarkButton.addEventListener('click', function () { openBookmarkEditor(null); });
    var quickSaveClose = byId('quick-save-close');
    var quickSaveSave = byId('quick-save-save');
    var quickSaveTitle = byId('quick-save-title');
    var quickSaveUrl = byId('quick-save-url');
    var quickSaveDescription = byId('quick-save-description');
    var quickSavePage = byId('quick-save-page');
    var quickSaveBoard = byId('quick-save-board');
    if (quickSavePage) quickSavePage.addEventListener('change', function () { fillBookmarkBoards(quickSavePage, quickSaveBoard); });
    function closeQuickSaveTab() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) chrome.runtime.sendMessage({ type: 'GLASS_CLOSE_QUICK_SAVE_TAB' });
      else window.close();
    }
    if (quickSaveClose) quickSaveClose.addEventListener('click', function () {
      quickSaveModal.classList.add('hidden');
      if (location.hash === '#quick-save') {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.remove('quickSaveDraft');
        closeQuickSaveTab();
      }
    });
    if (quickSaveModal) quickSaveModal.addEventListener('click', function (event) {
      if (event.target === quickSaveModal) {
        quickSaveModal.classList.add('hidden');
        if (location.hash === '#quick-save') closeQuickSaveTab();
      }
    });
    if (quickSaveSave) quickSaveSave.addEventListener('click', function () {
      var saved = createBookmark({ name: quickSaveTitle.value, url: quickSaveUrl.value, description: quickSaveDescription.value, pageId: quickSavePage.value, boardId: quickSaveBoard.value });
      if (!saved) { alert('Check the title and URL; this URL may already exist in the selected board.'); return; }
      quickSaveModal.classList.add('hidden');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.remove('quickSaveDraft');
      if (location.hash === '#quick-save') closeQuickSaveTab();
    });
    var closeBookmark = byId('bm-modal-close');
    if (closeBookmark) closeBookmark.addEventListener('click', function () { bookmarkModal.classList.add('hidden'); editingId = null; });
    if (bookmarkModal) bookmarkModal.addEventListener('click', function (event) {
      if (event.target === bookmarkModal) { bookmarkModal.classList.add('hidden'); editingId = null; }
    });
    document.addEventListener('keydown', function (event) {
      if (!isPrimary && !ownsActiveElement()) return;
      var target = event.target;
      var isTyping = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        var bookmarkSearch = byId('bookmark-search');
        if (bookmarkSearch) bookmarkSearch.focus();
      } else if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (scope) { scope.value = 'favorites'; scope.disabled = false; }
        searchScope = 'favorites';
        App.Storage.set(skey('bookmark-search-scope'), 'favorites');
        deletedView = false;
        emit();
      } else if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault(); undo();
      } else if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault(); redo();
      } else if (event.key === 'Escape') {
        document.querySelectorAll('.settings-overlay:not(.hidden)').forEach(function (overlay) { overlay.classList.add('hidden'); });
        if (location.hash === '#quick-save' && quickSaveModal && !quickSaveModal.classList.contains('hidden')) {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.remove('quickSaveDraft');
          closeQuickSaveTab();
        }
      }
    });
    if (pageSelect) pageSelect.addEventListener('change', function () { fillBookmarkBoards(pageSelect, boardSelect); });
    if (saveBookmarkButton) saveBookmarkButton.addEventListener('click', function () {
      var name = byId('bm-name').value.trim();
      var url = byId('bm-url').value.trim();
      var description = byId('bm-description').value.trim();
      var tagsInput = byId('bm-tags');
      var tags = tagsInput ? tagsInput.value : '';
      if (!name || !url) { (name ? byId('bm-url') : byId('bm-name')).focus(); return; }
      if (editingId) {
        if (!updateBookmark(editingId, { name: name, url: url, description: description, tags: tags, pageId: pageSelect.value, boardId: boardSelect.value })) {
          alert('Check the URL or destination board; this URL may already exist there.');
          return;
        }
      } else if (!createBookmark({ name: name, url: url, description: description, tags: tags, pageId: pageSelect.value, boardId: boardSelect.value })) {
        alert('Enter a valid web URL; duplicate URLs are not added to the same board.');
        return;
      }
      bookmarkModal.classList.add('hidden');
      editingId = null;
    });
    if (search) search.addEventListener('input', function () { deletedView = false; if (scope) scope.disabled = false; setQuery(search.value, exact, scope && scope.value); });
    if (scope) scope.addEventListener('change', function () {
      deletedView = false;
      scope.disabled = false;
      searchScope = scope.value;
      App.Storage.set(skey('bookmark-search-scope'), searchScope);
      emit();
    });
    var exactButton = byId('exact-search-btn');
    if (exactButton) {
      exactButton.classList.toggle('active', exact);
      exactButton.setAttribute('aria-pressed', String(exact));
      exactButton.addEventListener('click', function () {
        exact = !exact;
        App.Storage.set(skey('bookmark-exact-search'), exact);
        exactButton.classList.toggle('active', exact);
        exactButton.setAttribute('aria-pressed', String(exact));
        setQuery(search && search.value, exact, searchScope);
      });
    }
    bindTabKeyboard(pageTabs);
    bindTabKeyboard(boardTabs);
    if (undoButton) undoButton.addEventListener('click', undo);
    if (redoButton) redoButton.addEventListener('click', redo);
    if (trashButton) trashButton.addEventListener('click', function () { deletedView = !deletedView; if (scope) scope.disabled = deletedView; emit(); });
    var privacyButton = byId('privacy-mode-btn');
    if (privacyButton) {
      privacyButton.setAttribute('aria-pressed', String(!!App.Storage.get('privacy-mode', false)));
      privacyButton.classList.toggle('active', App.Storage.get('privacy-mode', false));
      privacyButton.addEventListener('click', function () {
        var value = !App.Storage.get('privacy-mode', false);
        App.Storage.set('privacy-mode', value);
        privacyButton.setAttribute('aria-pressed', String(value));
        privacyButton.classList.toggle('active', value);
        emit();
      });
    }
    var exportButton = byId('export-workspace-btn');
    if (exportButton) exportButton.addEventListener('click', exportWorkspace);
    var exportHtmlButton = byId('export-html-btn');
    if (exportHtmlButton) exportHtmlButton.addEventListener('click', exportBookmarksHTML);
    var exportCsvButton = byId('export-csv-btn');
    if (exportCsvButton) exportCsvButton.addEventListener('click', exportBookmarksCSV);
    var importButton = byId('import-workspace-btn');
    if (importButton && importInput) importButton.addEventListener('click', function () { importInput.click(); });
    var cardSize = App.Storage.get('bookmark-card-size', 'medium');
    if (['compact', 'medium', 'large'].indexOf(cardSize) < 0) cardSize = 'medium';
    document.body.dataset.cardSize = cardSize;
    root.querySelectorAll('.size-option').forEach(function (button) {
      button.classList.toggle('active', button.dataset.size === cardSize);
      button.setAttribute('aria-pressed', String(button.dataset.size === cardSize));
      button.addEventListener('click', function () {
        document.body.dataset.cardSize = button.dataset.size;
        App.Storage.set('bookmark-card-size', button.dataset.size);
        root.querySelectorAll('.size-option').forEach(function (option) {
          option.classList.toggle('active', option === button);
          option.setAttribute('aria-pressed', String(option === button));
        });
      });
    });

    // ---- card shape and columns ----------------------------------------
    // One preference record, two editors: these controls and the Settings
    // sliders read and write the same `bookmark-preferences` keys, so changing a
    // card's shape here moves the slider there and the other way round. Every
    // write re-reads the record first, because the sliders keep their own copy.
    var RADIUS_BY_SHAPE = { soft: 16, square: 8, pill: 28 };
    var COLUMN_MIN = 2, COLUMN_MAX = 6;
    var shapeButtons = Array.prototype.slice.call(root.querySelectorAll('.shape-option'));
    var columnButtons = Array.prototype.slice.call(root.querySelectorAll('.column-step'));
    var columnOutput = byId('column-count');
    var radiusControl = byId('radius-control');
    var radiusValue = byId('radius-value');
    var columnsControl = byId('columns-control');
    var columnsValue = byId('columns-value');

    function storedPrefs() { return App.Storage.get('bookmark-preferences', {}) || {}; }
    function storePref(key, value) {
      var current = storedPrefs();
      current[key] = value;
      App.Storage.set('bookmark-preferences', current);
    }
    // A narrow window shows fewer columns than asked for, so the setting and what
    // is on screen are separate numbers.
    function visibleColumnsFor(columns) {
      var width = window.innerWidth;
      return Math.min(columns, width <= 520 ? 1 : width <= 760 ? 2 : width <= 1050 ? 3 : columns);
    }
    function applyColumns(columns, persist) {
      columns = Math.max(COLUMN_MIN, Math.min(COLUMN_MAX, columns));
      document.documentElement.style.setProperty('--bookmark-columns', columns);
      document.documentElement.style.setProperty('--visible-bookmark-columns', visibleColumnsFor(columns));
      if (columnOutput) columnOutput.textContent = columns;
      if (columnsControl) columnsControl.value = columns;
      if (columnsValue) columnsValue.textContent = columns;
      columnButtons.forEach(function (button) {
        var step = Number(button.dataset.step);
        button.disabled = (step < 0 && columns <= COLUMN_MIN) || (step > 0 && columns >= COLUMN_MAX);
      });
      if (persist) storePref('columns', columns);
    }
    function applyShape(shape, persist) {
      if (!RADIUS_BY_SHAPE[shape]) shape = 'custom';
      var radius = RADIUS_BY_SHAPE[shape] || Math.max(8, Math.min(28, parseInt(storedPrefs().radius, 10) || 16));
      document.body.dataset.cardShape = shape;
      document.documentElement.style.setProperty('--card-radius', radius + 'px');
      if (radiusControl) radiusControl.value = radius;
      if (radiusValue) radiusValue.textContent = radius + 'px';
      shapeButtons.forEach(function (button) {
        var active = button.dataset.shape === shape;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (persist) {
        var current = storedPrefs();
        current.cardShape = shape;
        current.radius = radius;
        App.Storage.set('bookmark-preferences', current);
      }
    }
    shapeButtons.forEach(function (button) {
      button.addEventListener('click', function () { applyShape(button.dataset.shape, true); });
    });
    columnButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        applyColumns((parseInt(storedPrefs().columns, 10) || 4) + Number(button.dataset.step), true);
      });
    });
    syncCardControls = function () {
      var current = storedPrefs();
      applyColumns(parseInt(current.columns, 10) || 4, false);
      applyShape(current.cardShape || 'soft', false);
    };
    var savedPrefs = storedPrefs();
    applyColumns(parseInt(savedPrefs.columns, 10) || 4, false);
    applyShape(savedPrefs.cardShape || 'soft', false);
    var sortSelect = byId('bookmark-sort');
    if (sortSelect) {
      sortSelect.value = App.Storage.get(skey('bookmark-sort'), 'custom');
      sortSelect.addEventListener('change', function () { App.Storage.set(skey('bookmark-sort'), sortSelect.value); renderCards(); });
    }
    if (importInput) importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { alert('Imported ' + parseBookmarksFile(String(reader.result), file.name) + ' item(s).'); }
        catch (error) { alert(error.message || 'Could not import this file.'); }
        importInput.value = '';
      };
      reader.readAsText(file);
    });
    if (isPrimary && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.get('quickSaveDraft', function (data) {
      var draft = data && data.quickSaveDraft;
      if (!draft || !quickSaveModal) return;
      quickSaveTitle.value = draft.title || '';
      quickSaveUrl.value = draft.url || '';
      quickSaveDescription.value = '';
      populateLocationSelects(quickSavePage, quickSaveBoard, activePage, activeBoard);
      quickSaveModal.classList.remove('hidden');
      quickSaveTitle.focus();
    });
    if (location.hash === '#quick-save') setTimeout(function () { if (quickSaveTitle) quickSaveTitle.focus(); }, 0);
    if (isPrimary && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message && message.type === 'GLASS_NEW_TAB_QUICK_SAVE') {
        var saved = captureTab(message.tab);
        if (typeof sendResponse === 'function') sendResponse({ saved: saved === true || saved === 'exists' });
        if ((saved === true || saved === 'exists') && message.tab && chrome.storage && chrome.storage.local) removePendingQuickSave(message.tab.url);
      } else if (message && message.type === 'GLASS_NEW_TAB_QUICK_SAVES' && Array.isArray(message.bookmarks)) {
        message.bookmarks.forEach(captureTab);
      }
    });
    if (isPrimary && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.get('pendingQuickSaves', function (data) {
      var pending = data && data.pendingQuickSaves;
      if (Array.isArray(pending) && pending.length) {
        var remaining = pending.filter(function (bookmark) { var saved = captureTab(bookmark); return saved !== true && saved !== 'exists'; });
          chrome.storage.local.set({ pendingQuickSaves: remaining });
      }
    });
    var chromeImport = byId('import-chrome-bookmarks-btn');
    if (chromeImport) chromeImport.addEventListener('click', importChromeBookmarks);
    render();
  }

  function removePendingQuickSave(url) {
    chrome.storage.local.get('pendingQuickSaves', function (data) {
      var pending = Array.isArray(data.pendingQuickSaves) ? data.pendingQuickSaves : [];
      var index = pending.findIndex(function (item) { return item.url === url; });
      if (index >= 0) { pending.splice(index, 1); chrome.storage.local.set({ pendingQuickSaves: pending }); }
    });
  }
  function escapeText(value) { var node = document.createElement('span'); node.textContent = value; return node.innerHTML; }

  // ---- pages / boards scroller -----------------------------------------
  // The rows are one line tall whatever the library holds, so a page or board
  // that does not fit has to be reachable. The row scrolls with the wheel and
  // with buttons that only appear while it actually overflows; the native
  // scrollbar is hidden by the stylesheet because it was the only cue that the
  // list continued and it stole a row's worth of height to say so.
  function setupTabScroller(scroller) {
    if (!scroller) return null;
    var track = scroller.querySelector('.page-tabs, .category-tabs');
    if (!track) return null;
    var prev = scroller.querySelector('[data-scroll="prev"]');
    var next = scroller.querySelector('[data-scroll="next"]');
    function maxScroll() { return Math.max(0, track.scrollWidth - track.clientWidth); }
    function sync() {
      var max = maxScroll();
      scroller.classList.toggle('can-scroll', max > 1);
      if (prev) prev.disabled = track.scrollLeft <= 1;
      if (next) next.disabled = track.scrollLeft >= max - 1;
    }
    function step(direction) {
      track.scrollBy({ left: direction * Math.max(140, track.clientWidth * 0.7), behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', sync, { passive: true });
    track.addEventListener('wheel', function (event) {
      if (maxScroll() <= 1) return;
      var delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      track.scrollLeft += delta;
    }, { passive: false });
    // The row's own width changes whenever the widget is resized or the window
    // is, so overflow is re-judged from the track rather than from a resize event.
    if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(track);
    else window.addEventListener('resize', sync);
    scroller.sync = sync;
    return scroller;
  }
  function bindTabKeyboard(container) {
    if (!container) return;
    container.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
      var tabs = Array.prototype.slice.call(container.querySelectorAll('[role="tab"]'));
      if (!tabs.length) return;
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      var next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowLeft' ? (current - 1 + tabs.length) % tabs.length
        : (current + 1) % tabs.length;
      event.preventDefault();
      tabs[next].focus();
    });
  }
  function actionButton(label, className) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'bookmark-card-action ' + className;
    button.textContent = label;
    return button;
  }
  function openNameModal(modalId, inputId) {
    var modal = byId(modalId), input = byId(inputId);
    if (!modal || !input) return;
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();
  }
  function bindNameModal(modalId, inputId, closeId, saveId, create) {
    var modal = byId(modalId), input = byId(inputId);
    var close = byId(closeId), saveButton = byId(saveId);
    if (!modal || !input) return;
    if (close) close.addEventListener('click', function () { modal.classList.add('hidden'); });
    modal.addEventListener('click', function (event) { if (event.target === modal) modal.classList.add('hidden'); });
    function saveName() {
      if (create(input.value)) modal.classList.add('hidden');
      else { input.focus(); alert('Enter a unique name for this workspace.'); }
    }
    if (saveButton) saveButton.addEventListener('click', saveName);
    input.addEventListener('keydown', function (event) { if (event.key === 'Enter') saveName(); });
  }
  function populateLocationSelects(pageSelect, boardSelect, selectedPage, selectedBoard) {
    if (!pageSelect || !boardSelect) return;
    pageSelect.innerHTML = '';
    workspace.pages.forEach(function (page) {
      var option = document.createElement('option');
      option.value = page.id;
      option.textContent = page.name;
      pageSelect.appendChild(option);
    });
    pageSelect.value = pageById(selectedPage) ? selectedPage : activePage;
    fillBookmarkBoards(pageSelect, boardSelect);
    boardSelect.value = boardById(pageById(pageSelect.value), selectedBoard) ? selectedBoard : pageById(pageSelect.value).boards[0].id;
  }
  function fillBookmarkBoards(pageSelect, boardSelect) {
    if (!pageSelect || !boardSelect) return;
    var page = pageById(pageSelect.value);
    boardSelect.innerHTML = '';
    (page ? page.boards : []).forEach(function (board) {
      var option = document.createElement('option');
      option.value = board.id;
      option.textContent = board.name;
      boardSelect.appendChild(option);
    });
  }
  function openBookmarkEditor(bookmark) {
    var modal = byId('bookmark-modal');
    if (!modal) return;
    var pageSelect = byId('bm-page');
    var boardSelect = byId('bm-category');
    var nameInput = byId('bm-name');
    var urlInput = byId('bm-url');
    var descriptionInput = byId('bm-description');
    var tagsInput = byId('bm-tags');
    var title = byId('bm-modal-title');
    var save = byId('bm-save');
    editingId = bookmark ? bookmark.id : null;
    title.textContent = bookmark ? 'Edit bookmark' : 'Add bookmark';
    save.textContent = bookmark ? 'Save changes' : 'Add bookmark';
    nameInput.value = bookmark ? bookmark.name : '';
    urlInput.value = bookmark ? bookmark.url : '';
    descriptionInput.value = bookmark ? bookmark.description || '' : '';
    if (tagsInput) tagsInput.value = bookmark && bookmark.tags ? bookmark.tags.join(', ') : '';
    populateLocationSelects(pageSelect, boardSelect, bookmark ? bookmark.pageId : activePage, bookmark ? bookmark.boardId : activeBoard);
    modal.classList.remove('hidden');
    nameInput.focus();
  }

  function importChromeBookmarks() {
    if (typeof chrome === 'undefined' || !chrome.permissions) { alert('Chrome bookmark import is available in the installed extension.'); return; }
    chrome.permissions.request({ permissions: ['bookmarks'] }, function (granted) {
      if (!granted || !chrome.bookmarks) { alert('Bookmark access was not granted. You can still import an exported HTML file.'); return; }
      chrome.bookmarks.getTree(function (tree) {
        if (chrome.runtime.lastError) { alert(chrome.runtime.lastError.message); return; }
        var additions = [], known = {};
        workspace.pages.forEach(function (page) {
          page.boards.forEach(function (board) { board.bookmarks.forEach(function (bookmark) { known[bookmark.url] = true; }); });
        });
        function walk(nodes, folders) {
          (nodes || []).forEach(function (node) {
            if (node.url) {
              if (validWebUrl(node.url) && !known[node.url]) {
                known[node.url] = true;
                additions.push({ name: node.title || node.url, url: node.url, folder: folders[folders.length - 1] || 'Imported' });
              }
              return;
            }
            var ignored = /^(Bookmarks bar|Other bookmarks|Mobile bookmarks)$/i.test(node.title || '');
            walk(node.children, node.title && !ignored ? folders.concat(node.title) : folders);
          });
        }
        walk(tree, []);
        if (!additions.length) { alert('No new web bookmarks found.'); return; }
        var page = currentPage(), total = additions.length;
        transact(function () {
          additions.forEach(function (item) {
            var board = page.boards.find(function (candidate) { return candidate.name.toLowerCase() === item.folder.toLowerCase(); });
            if (!board) {
              board = { id: makeId('board'), name: item.folder.slice(0, 40), bookmarks: [] };
              page.boards.push(board);
            }
            board.bookmarks.push({ id: makeId('bookmark'), name: item.name, url: item.url, description: '', addedAt: Date.now(), uses: 0, favorite: false });
          });
        });
        alert('Imported ' + total + ' bookmarks from Chrome.');
      });
    });
  }

  function exportWorkspace() {
    downloadFile(JSON.stringify(dataForExport(), null, 2), 'application/json', 'glass-newtab-workspace-' + dateStamp() + '.json');
  }

  function downloadFile(content, type, fileName) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function dateStamp() { return new Date().toISOString().slice(0, 10); }
  function exportBookmarksHTML() {
    var rows = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Glass New Tab Bookmarks</TITLE>', '<H1>Glass New Tab Bookmarks</H1>', '<DL><p>'];
    function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    workspace.pages.forEach(function (page) {
      rows.push('<DT><H3>' + escapeHtml(page.name) + '</H3>', '<DL><p>');
      page.boards.forEach(function (board) {
        rows.push('<DT><H3>' + escapeHtml(board.name) + '</H3>', '<DL><p>');
        board.bookmarks.forEach(function (bookmark) {
          rows.push('<DT><A HREF="' + escapeHtml(bookmark.url) + '">' + escapeHtml(bookmark.name) + '</A>');
        });
        rows.push('</DL><p>');
      });
      rows.push('</DL><p>');
    });
    rows.push('</DL><p>');
    downloadFile(rows.join('\n'), 'text/html;charset=utf-8', 'glass-newtab-bookmarks-' + dateStamp() + '.html');
  }
  function exportBookmarksCSV() {
    function csv(value) { return '"' + String(value || '').replace(/"/g, '""') + '"'; }
    var rows = [['page', 'board', 'name', 'url', 'description', 'tags'].map(csv).join(',')];
    workspace.pages.forEach(function (page) {
      page.boards.forEach(function (board) {
        board.bookmarks.forEach(function (bookmark) {
          rows.push([page.name, board.name, bookmark.name, bookmark.url, bookmark.description, (bookmark.tags || []).join(';')].map(csv).join(','));
        });
      });
    });
    downloadFile('\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8', 'glass-newtab-bookmarks-' + dateStamp() + '.csv');
  }
  function parseCSV(text) {
    var records = [], record = [], value = '', quoted = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i += 1) {
      var char = text.charAt(i);
      if (quoted && char === '"' && text.charAt(i + 1) === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (!quoted && char === ',') { record.push(value); value = ''; }
      else if (!quoted && (char === '\n' || char === '\r')) {
        if (char === '\r' && text.charAt(i + 1) === '\n') i += 1;
        record.push(value); value = '';
        if (record.some(function (cell) { return cell.trim(); })) records.push(record);
        record = [];
      } else value += char;
    }
    record.push(value);
    if (record.some(function (cell) { return cell.trim(); })) records.push(record);
    if (!records.length) return [];
    var headers = records.shift().map(function (header) { return header.trim().toLowerCase(); });
    return records.map(function (cells) {
      var row = {};
      headers.forEach(function (header, index) { row[header] = cells[index] || ''; });
      return row;
    });
  }
  return {
      init: init,
    subscribe: function (listener) { listeners.push(listener); return function () { listeners = listeners.filter(function (item) { return item !== listener; }); }; },
    pages: function () { return workspace.pages; },
    boards: function (pageId) { var page = pageById(pageId || activePage); return page ? page.boards : []; },
    currentIds: function () { return { pageId: activePage, boardId: activeBoard }; },
    currentPage: currentPage,
    currentBoard: currentBoard,
    setActive: setActive,
    addPage: addPage,
    addBoard: addBoard,
    renamePage: renamePage,
    renameBoard: renameBoard,
    deletePage: deletePage,
    deleteBoard: deleteBoard,
    createBookmark: createBookmark,
    captureTab: captureTab,
    toggleFavorite: toggleFavorite,
    moveFavorite: moveFavorite,
    openBookmark: openBookmark,
    getVisibleBookmarks: getVisibleBookmarks,
    setQuery: setQuery,
    updateBookmark: updateBookmark,
    moveBookmark: moveBookmark,
    removeBookmark: removeBookmark,
    restoreBookmark: restoreBookmark,
    undo: undo,
    redo: redo,
    // Re-read the shared card preferences and show them: the Settings sliders
    // write the same record, and this is how the toolbar catches up with them.
    refreshCardPreferences: function () { if (syncCardControls) syncCardControls(); },
    setTrashView: function (value) { deletedView = !!value; emit(); },
    isTrashView: function () { return deletedView; },
    dataForExport: dataForExport,
    importJSON: importJSON,
    exportWorkspace: exportWorkspace,
    exportBookmarksHTML: exportBookmarksHTML,
    exportBookmarksCSV: exportBookmarksCSV
  };
  } // end create(opts)

  var instances = [];
  function forward(name) {
    return function () {
      var target = instances[0];
      return target && typeof target[name] === 'function' ? target[name].apply(target, arguments) : undefined;
    };
  }
  var api = {
    init: function () {
      buildSecondKeeper();
      instances = [create({ suffix: '' }), create({ suffix: '-2' })];
      instances.forEach(function (instance) { instance.init(); });
    },
    // Settings edits the shared card preferences; every keeper redraws from them.
    refreshCardPreferences: function () {
      instances.forEach(function (instance) { instance.refreshCardPreferences(); });
    },
    subscribe: function (listener) {
      var offs = instances.map(function (instance) { return instance.subscribe(listener); });
      return function () { offs.forEach(function (off) { if (off) off(); }); };
    },
    keepers: function () { return instances.slice(); }
  };
  ['pages', 'boards', 'currentIds', 'currentPage', 'currentBoard', 'setActive', 'addPage', 'addBoard',
   'renamePage', 'renameBoard', 'deletePage', 'deleteBoard', 'createBookmark', 'captureTab',
   'toggleFavorite', 'moveFavorite', 'openBookmark', 'getVisibleBookmarks', 'setQuery',
   'updateBookmark', 'moveBookmark', 'removeBookmark', 'restoreBookmark', 'undo', 'redo',
   'setTrashView', 'isTrashView', 'dataForExport', 'importJSON', 'exportWorkspace',
   'exportBookmarksHTML', 'exportBookmarksCSV'].forEach(function (name) { api[name] = forward(name); });
  return api;
})();
