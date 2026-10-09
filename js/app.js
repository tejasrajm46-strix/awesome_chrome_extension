window.App = window.App || {};

// Quote of the day, drawn either from the built-in library, from the lines the
// user typed into Settings, or from both. Owns its own storage keys so the rest
// of the app never has to know how a quote is chosen.
window.App.Quote = (function () {
  'use strict';

  var BUILT_IN = [
    { text: 'A little progress each day adds up to big results.', author: 'Keep Going' },
    { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt' },
    { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
    { text: 'Everything you can imagine is real.', author: 'Pablo Picasso' },
    { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
    { text: 'Dream big and dare to fail.', author: 'Norman Vaughan' },
    { text: 'What you get by achieving your goals is not as important as what you become.', author: 'Zig Ziglar' },
    { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
    { text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
    { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' }
  ];

  var TEXT_KEY = 'quotes-text';
  var SOURCE_KEY = 'quote-source';
  var PICK_KEY = 'quote-pick';
  var SOURCES = ['both', 'builtin', 'custom'];
  // A line is "quote — author", the credit being optional. The last separator
  // wins, so a dash inside the quote itself is not mistaken for the credit.
  var SEPARATORS = [' — ', ' – ', ' -- ', ' - ', ' | '];

  function parse(text) {
    var quotes = [];
    String(text == null ? '' : text).split(/\r?\n/).forEach(function (line) {
      var value = line.trim();
      if (!value || value.charAt(0) === '#') return; // a blank line, or a note to self
      var author = '';
      for (var i = 0; i < SEPARATORS.length; i++) {
        var at = value.lastIndexOf(SEPARATORS[i]);
        if (at > 0) {
          author = value.slice(at + SEPARATORS[i].length).trim();
          value = value.slice(0, at).trim();
          break;
        }
      }
      if (value) quotes.push({ text: value, author: author });
    });
    return quotes;
  }

  function mine() { return parse(App.Storage.get(TEXT_KEY, '')); }

  function source() {
    var value = App.Storage.get(SOURCE_KEY, 'both');
    return SOURCES.indexOf(value) < 0 ? 'both' : value;
  }

  function pool() {
    var mode = source();
    if (mode === 'custom') return mine();
    if (mode === 'builtin') return BUILT_IN;
    return BUILT_IN.concat(mine());
  }

  // Which quotes the widget rotates through. An empty pool would leave the widget
  // blank, so "my quotes only" with nothing typed falls back to the library.
  function active() {
    var list = pool();
    return list.length ? list : BUILT_IN;
  }

  // The stored pick is only trusted while the pool it was drawn from is unchanged,
  // so editing the list re-picks instead of sliding the old index onto a quote the
  // user never saw. Cheap string hash is enough: the pool is a handful of lines.
  function signature(list) {
    var seed = list.map(function (q) { return q.text + '\u0000' + q.author; }).join('\u0001');
    var hash = 5381;
    for (var i = 0; i < seed.length; i++) hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
    return list.length + ':' + hash;
  }

  function roll(size, avoid) {
    if (size < 2) return 0;
    var index = Math.floor(Math.random() * size);
    return index === avoid ? (index + 1) % size : index;
  }

  function remember(list, index) {
    App.Storage.set(PICK_KEY, { date: new Date().toDateString(), sig: signature(list), idx: index });
    return index;
  }

  // One quote a day, the same all day, chosen when the day or the list changes.
  function today(list) {
    var saved = App.Storage.get(PICK_KEY, null);
    if (saved && typeof saved === 'object' && saved.date === new Date().toDateString() &&
        saved.sig === signature(list) && typeof saved.idx === 'number' &&
        saved.idx >= 0 && saved.idx < list.length) {
      return saved.idx;
    }
    return remember(list, roll(list.length, -1));
  }

  var shown = null;

  function render() {
    var textEl = document.getElementById('quote-text');
    var authorEl = document.getElementById('quote-author');
    if (!textEl || !authorEl) return;
    var list = active();
    var index = shown === null ? today(list) : shown;
    if (!(index >= 0 && index < list.length)) index = remember(list, roll(list.length, -1));
    shown = index;
    textEl.textContent = list[index].text;
    authorEl.textContent = list[index].author || '';
  }

  return {
    init: render,
    // Re-read the list and pick for it — used after Settings edits the lines.
    refresh: function () { shown = null; render(); },
    // Hand the user a different quote straight away and keep it for the day.
    shuffle: function () {
      var list = active();
      shown = remember(list, roll(list.length, shown === null ? -1 : shown));
      render();
      return list[shown];
    },
    parse: parse
  };
})();

(function () {
  'use strict';

  function initOnboarding() {
    var onboarding = document.getElementById('onboarding');
    if (!onboarding) return;
    var shown = App.Storage.get('onboarding-done', false);
    if (shown) { onboarding.classList.add('hidden'); return; }
    onboarding.classList.remove('hidden');
    var bgBtn = document.getElementById('onboard-bg');
    var bmBtn = document.getElementById('onboard-bm');
    var startBtn = document.getElementById('onboard-start');
    function dismiss() {
      App.Storage.set('onboarding-done', true);
      onboarding.style.opacity = '0'; onboarding.style.transition = 'opacity 0.4s ease';
      setTimeout(function () { onboarding.classList.add('hidden'); }, 400);
    }
    if (bgBtn) bgBtn.addEventListener('click', function () {
      dismiss(); setTimeout(function () { var overlay = document.getElementById('settings-overlay'); if (overlay) overlay.classList.remove('hidden'); }, 500);
    });
    if (bmBtn) bmBtn.addEventListener('click', function () {
      dismiss(); setTimeout(function () { var addBtn = document.getElementById('add-bookmark-btn'); if (addBtn) addBtn.click(); }, 500);
    });
    if (startBtn) startBtn.addEventListener('click', dismiss);
  }

  document.addEventListener('DOMContentLoaded', function () {
    try { App.Background.init(); } catch (e) { console.warn('Background init failed', e); }
    try { App.Clock.init(); } catch (e) { console.warn('Clock init failed', e); }
    try { App.Search.init(); } catch (e) { console.warn('Search init failed', e); }
    try { App.Bookmarks.init(); } catch (e) { console.warn('Bookmarks init failed', e); }
    try { App.Workspace.init(); } catch (e) { console.warn('Workspace init failed', e); }
    try { App.Settings.init(); } catch (e) { console.warn('Settings init failed', e); }
    try { App.Quote.init(); } catch (e) { console.warn('Quote init failed', e); }
    try { initOnboarding(); } catch (e) { console.warn('Onboarding init failed', e); }
    try { App.Layout.init(); } catch (e) { console.warn('Widget layout init failed', e); }
  });
})();