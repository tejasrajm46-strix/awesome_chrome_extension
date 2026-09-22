window.App = window.App || {};
window.App.Search = (function () {
  var form, input, box, enginePill, engineLabel, dropdown;
  var activeIdx = -1, suggestions = [], abortCtrl = null, debounceTimer = null;

  var ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=', suggest: 'https://suggestqueries.google.com/complete/search?client=chrome&q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', suggest: 'https://api.bing.com/osjson.aspx?query=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', suggest: 'https://duckduckgo.com/ac/?q=' },
    brave: { name: 'Brave', url: 'https://search.brave.com/search?q=', suggest: 'https://search.brave.com/api/suggest?q=' }
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

  function parseSuggestions(text) {
    try {
      var data = JSON.parse(text);
      // Google/Bing: ["query", ["sug1","sug2",...]]
      if (Array.isArray(data) && Array.isArray(data[1])) return data[1].slice(0, 8);
      // DuckDuckGo: [{"phrase":"hello world"}, ...]
      if (Array.isArray(data) && data.length && typeof data[0] === 'object' && data[0].phrase) {
        return data.map(function (o) { return o.phrase; }).slice(0, 8);
      }
      // Brave: ["query", ["sug1",...]] same as Google
      if (Array.isArray(data)) return data.slice(0, 8).filter(function (x) { return typeof x === 'string'; });
    } catch (e) {
      // Fallback: try to extract first JSON array via regex for malformed responses
      try {
        var match = text.match(/\[[\s\S]*\]/);
        if (match) {
          var parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && Array.isArray(parsed[1])) return parsed[1].slice(0, 8);
          if (Array.isArray(parsed)) return parsed.slice(0, 8).filter(function (x) { return typeof x === 'string'; });
        }
      } catch (e2) {}
    }
    return [];
  }

  function fetchSuggestions(q) {
    var eng = ENGINES[getEngine()] || ENGINES.google;
    var url = (eng.suggest || ENGINES.google.suggest) + encodeURIComponent(q);
    // DuckDuckGo needs &type=list, Brave needs no extra, but ensure hl
    if (getEngine() === 'duckduckgo') url = 'https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list';

    if (abortCtrl) try { abortCtrl.abort(); } catch (e) {}
    abortCtrl = new AbortController();
    var tid = setTimeout(function () { try { abortCtrl.abort(); } catch (e) {} }, 4000);

    return fetch(url, { signal: abortCtrl.signal, headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        clearTimeout(tid);
        if (!r.ok) throw new Error('suggest http ' + r.status);
        return r.text();
      })
      .then(function (text) {
        return parseSuggestions(text);
      })
      .catch(function (err) {
        clearTimeout(tid);
        // Fallback: try Google suggestqueries if primary engine fails and wasn't Google
        if (getEngine() !== 'google') {
          return fetch('https://suggestqueries.google.com/complete/search?client=chrome&q=' + encodeURIComponent(q))
            .then(function (r) { return r.text(); })
            .then(function (t) { return parseSuggestions(t); })
            .catch(function () { return []; });
        }
        return [];
      });
  }

  function renderSuggestions(list) {
    suggestions = list;
    if (!list.length) { box.classList.add('hidden'); return; }
    box.innerHTML = '';
    list.forEach(function (s) {
      var div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>' + esc(s) + '</span>';
      div.addEventListener('mousedown', function (e) {
        e.preventDefault();
        input.value = s;
        box.classList.add('hidden');
        doSearch(s);
      });
      box.appendChild(div);
    });
    box.classList.remove('hidden');
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
      box.classList.add('hidden');
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
        // Refresh suggestions for new engine if input has value
        if (input.value.trim().length >= 2) {
          fetchSuggestions(input.value.trim()).then(renderSuggestions);
        }
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
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        fetchSuggestions(q).then(renderSuggestions);
      }, 180);
    });

    // Also trigger on focus if already has value (e.g., after engine change)
    input.addEventListener('focus', function () {
      var q = input.value.trim();
      if (q.length >= 2) {
        fetchSuggestions(q).then(renderSuggestions);
      }
    });

    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('.suggestion-item');
      var isHidden = box.classList.contains('hidden');
      if (e.key === 'ArrowDown') {
        if (isHidden || !items.length) return;
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        updateActive(items);
      } else if (e.key === 'ArrowUp') {
        if (isHidden || !items.length) return;
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, -1);
        updateActive(items);
        if (activeIdx >= 0) input.value = suggestions[activeIdx];
      } else if (e.key === 'Enter' && activeIdx >= 0 && !isHidden) {
        e.preventDefault();
        input.value = suggestions[activeIdx];
        box.classList.add('hidden');
        doSearch(suggestions[activeIdx]);
      } else if (e.key === 'Escape') {
        box.classList.add('hidden');
        activeIdx = -1;
      }
    });

    function updateActive(items) {
      items.forEach(function (it, i) { it.classList.toggle('active', i === activeIdx); });
      if (activeIdx >= 0 && items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', function (e) {
      if (!form.contains(e.target) && !box.contains(e.target)) box.classList.add('hidden');
    });

    // Hide on blur with slight delay to allow click
    input.addEventListener('blur', function () {
      setTimeout(function () { box.classList.add('hidden'); }, 180);
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
