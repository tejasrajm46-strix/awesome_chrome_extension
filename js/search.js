window.App = window.App || {};
window.App.Search = (function () {
  var form, input, box, enginePill, engineLabel, dropdown;
  var activeIdx = -1, suggestions = [], abortCtrl = null;

  var ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' }
  };

  function getEngine() {
    return App.Storage.get('search-engine', 'google');
  }

  function doSearch(q) {
    if (!q) return;
    var engine = ENGINES[getEngine()] || ENGINES.google;
    window.location.href = engine.url + encodeURIComponent(q);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function init() {
    form = document.getElementById('search-form');
    input = document.getElementById('search-input');
    box = document.getElementById('suggestions-box');
    enginePill = document.getElementById('search-engine-pill');
    engineLabel = document.getElementById('engine-label');
    dropdown = document.getElementById('engine-dropdown');
    if (!form || !input || !box) return;

    updateEngineLabel();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      doSearch(input.value.trim());
    });

    enginePill.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    dropdown.querySelectorAll('.engine-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.Storage.set('search-engine', btn.dataset.engine);
        updateEngineLabel();
        dropdown.classList.add('hidden');
      });
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== enginePill) {
        dropdown.classList.add('hidden');
      }
    });

    input.addEventListener('input', function () {
      var q = input.value.trim();
      activeIdx = -1;
      if (q.length < 2) { box.classList.add('hidden'); return; }
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();
      var tid = setTimeout(function () { abortCtrl.abort(); }, 3000);
      fetch('https://clients1.google.com/complete/search?client=chrome&hl=en&json=t&q=' + encodeURIComponent(q), { signal: abortCtrl.signal })
        .then(function (r) { clearTimeout(tid); return r.text(); })
        .then(function (text) {
          var match = text.match(/\[[\s\S]*?\]/);
          var data = match ? JSON.parse(match[0]) : [];
          suggestions = data.slice(0, 8);
          if (!suggestions.length) { box.classList.add('hidden'); return; }
          box.innerHTML = '';
          suggestions.forEach(function (s) {
            var div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>' + esc(s) + '</span>';
            div.addEventListener('click', function () {
              input.value = s;
              doSearch(s);
            });
            box.appendChild(div);
          });
          box.classList.remove('hidden');
        }).catch(function () {});
    });

    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('.suggestion-item');
      if (box.classList.contains('hidden') || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); updateActive(items); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, -1); updateActive(items); }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); input.value = suggestions[activeIdx]; doSearch(suggestions[activeIdx]); }
      else if (e.key === 'Escape') { box.classList.add('hidden'); }
    });

    function updateActive(items) {
      items.forEach(function (it, i) { it.classList.toggle('active', i === activeIdx); });
    }

    document.addEventListener('click', function (e) {
      if (!form.contains(e.target) && !box.contains(e.target)) box.classList.add('hidden');
    });
  }

  function updateEngineLabel() {
    if (engineLabel) {
      var eng = ENGINES[getEngine()];
      engineLabel.textContent = eng ? eng.name : 'Google';
    }
  }

  function getEngines() { return ENGINES; }
  function getCurrentEngine() { return getEngine(); }

  return { init: init, getEngines: getEngines, getCurrentEngine: getCurrentEngine };
})();
