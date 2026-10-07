window.App = window.App || {};
window.App.Settings = (function () {
  var overlay, openBtn, closeBtn, resetBtn;

  function applyWidgetVisibility() {
    var hidden = App.Storage.get('hidden-widgets', []);
    document.querySelectorAll('[data-toggle]').forEach(function (cb) {
      var id = cb.dataset.toggle;
      cb.checked = hidden.indexOf(id) === -1;
      var el = document.getElementById(id + '-section') || document.getElementById(id + '-block') || document.getElementById(id + '-wrapper');
      if (el) {
        if (hidden.indexOf(id) > -1) el.classList.add('hidden');
        else el.classList.remove('hidden');
      }
    });
  }

  function applyMode() {
    var mode = App.Storage.get('theme-mode', 'glass');
    document.body.setAttribute('data-mode', mode);
    document.querySelectorAll('.mode-btn').forEach(function (button) { button.classList.toggle('active', button.dataset.mode === mode); });
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  function applyAccent() {
    var color = App.Storage.get('accent-color', '#5b8def');
    document.documentElement.style.setProperty('--accent', color);
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty('--accent-hover', 'rgb(' + Math.min(r + 25, 255) + ',' + Math.min(g + 25, 255) + ',' + Math.min(b + 25, 255) + ')');
    document.documentElement.style.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.3)');
    document.querySelectorAll('.accent-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.accent === color);
    });
    document.querySelectorAll('.accent-btn[data-accent="' + color + '"]').forEach(function (button) { button.classList.add('active'); });
  }

  function applyClockFormat() {
    var fmt = App.Storage.get('clock-format', '12');
    document.querySelectorAll('.format-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.format === fmt);
    });
  }

  function applySearchEngine() {
    var eng = App.Storage.get('search-engine', 'google');
    document.querySelectorAll('.engine-pick-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.engine === eng);
    });
  }

  function initCustomSearch() {
    var input = document.getElementById('custom-search-url');
    if (!input) return;
    input.value = App.Storage.get('custom-search-url', '');
    input.addEventListener('change', function () {
      var value = input.value.trim();
      if (!value) { App.Storage.del('custom-search-url'); return; }
      try {
        var template = new URL(value.replace(/%s/g, 'query'));
        if ((template.protocol !== 'http:' && template.protocol !== 'https:') || value.indexOf('%s') < 0) throw new Error('Invalid template');
        App.Storage.set('custom-search-url', value);
      } catch (error) {
        input.value = App.Storage.get('custom-search-url', '');
        alert('Use an http(s) search URL with %s where the search query belongs.');
      }
    });
  }

  function initBookmarkPreferences() {
    var prefs = App.Storage.get('bookmark-preferences', {});
    var controls = [
      { id: 'columns-control', key: 'columns', variable: '--bookmark-columns', suffix: '' },
      { id: 'transparency-control', key: 'transparency', variable: '--card-opacity', suffix: '%' },
      { id: 'blur-control', key: 'blur', variable: '--glass-blur', suffix: 'px' },
      { id: 'radius-control', key: 'radius', variable: '--card-radius', suffix: 'px' },
      { id: 'icon-size-control', key: 'iconSize', variable: '--bookmark-icon-size', suffix: 'px' }
    ];
    function applyControl(item, input) {
      var value = parseInt(input.value, 10);
      var variableValue = item.key === 'transparency' ? value / 100 : item.key === 'blur' ? 'blur(' + value + 'px)' : value + item.suffix;
      var outputIds = { columns: 'columns-value', transparency: 'transparency-value', blur: 'blur-value', radius: 'radius-value', iconSize: 'icon-size-value' };
      var output = document.getElementById(outputIds[item.key]);
      if (output) output.textContent = value + item.suffix;
      prefs[item.key] = value;
      if (item.key === 'columns') {
        var root = document.documentElement;
        root.style.setProperty('--bookmark-columns', value);
        var effective = Math.min(value, window.innerWidth <= 520 ? 1 : window.innerWidth <= 760 ? 2 : window.innerWidth <= 1050 ? 3 : value);
        root.style.setProperty('--visible-bookmark-columns', effective);
      } else if (item.key === 'transparency') {
        document.documentElement.style.setProperty('--card-opacity', String(value / 100));
      } else if (item.key === 'blur') {
        document.documentElement.style.setProperty('--glass-blur', 'blur(' + value + 'px)');
      } else if (item.key === 'radius') {
        document.documentElement.style.setProperty('--card-radius', value + 'px');
      } else if (item.key === 'iconSize') {
        document.documentElement.style.setProperty('--bookmark-icon-size', value + 'px');
      }
    }
    controls.forEach(function (item) {
      var input = document.getElementById(item.id); if (!input) return;
      if (typeof prefs[item.key] === 'number') input.value = prefs[item.key];
      applyControl(item, input);
      input.addEventListener('input', function () {
        applyControl(item, input);
        // The bookmark toolbar edits the same record, so the write merges into the
        // stored object instead of replacing it with this panel's older copy.
        var latest = App.Storage.get('bookmark-preferences', {}) || {};
        latest[item.key] = prefs[item.key];
        // Corner radius has a shape switch of its own in the toolbar; dragging
        // this slider makes the shape a custom one.
        if (item.key === 'radius') latest.cardShape = 'custom';
        App.Storage.set('bookmark-preferences', latest);
        // The toolbar owns the shape and column controls, so it re-reads the
        // record and redraws them from it.
        if (App.Workspace && App.Workspace.refreshCardPreferences) App.Workspace.refreshCardPreferences();
      });
    });
    window.addEventListener('resize', function () {
      // Read the live record rather than this panel's copy: the toolbar's column
      // stepper may have changed it since this closure was built.
      var stored = App.Storage.get('bookmark-preferences', {}) || {};
      var value = parseInt(stored.columns, 10) || 4;
      var effective = Math.min(value, window.innerWidth <= 520 ? 1 : window.innerWidth <= 760 ? 2 : window.innerWidth <= 1050 ? 3 : value);
      document.documentElement.style.setProperty('--visible-bookmark-columns', effective);
    });
    var descriptions = document.getElementById('description-toggle');
    if (descriptions) {
      descriptions.checked = App.Storage.get('bookmark-descriptions', false);
      document.body.classList.toggle('hide-bookmark-descriptions', !descriptions.checked);
      descriptions.addEventListener('change', function () { document.body.classList.toggle('hide-bookmark-descriptions', !descriptions.checked); App.Storage.set('bookmark-descriptions', descriptions.checked); });
    }
  }

  function init() {
    overlay = document.getElementById('settings-overlay');
    openBtn = document.getElementById('btn-settings');
    closeBtn = document.getElementById('settings-close');
    resetBtn = document.getElementById('settings-reset');
    if (!overlay || !openBtn) return;

    applyMode();
    applyAccent();
    applyClockFormat();
    applySearchEngine();
    applyWidgetVisibility();
    initBookmarkPreferences();
    initCustomSearch();

    openBtn.addEventListener('click', function () { overlay.classList.remove('hidden'); });
    closeBtn.addEventListener('click', function () { overlay.classList.add('hidden'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.add('hidden'); });

    document.querySelectorAll('.format-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        App.Storage.set('clock-format', b.dataset.format);
        applyClockFormat();
        if (App.Clock && App.Clock.init) App.Clock.init();
      });
    });

    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        App.Storage.set('theme-mode', b.dataset.mode);
        applyMode();
      });
    });

    document.querySelectorAll('.accent-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        App.Storage.set('accent-color', b.dataset.accent);
        applyAccent();
      });
    });

    document.querySelectorAll('.engine-pick-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (App.Search && App.Search.setEngine) App.Search.setEngine(b.dataset.engine);
        else App.Storage.set('search-engine', b.dataset.engine);
        applySearchEngine();
      });
    });

    document.querySelectorAll('[data-toggle]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var hidden = App.Storage.get('hidden-widgets', []);
        var id = cb.dataset.toggle;
        if (cb.checked) {
          var idx = hidden.indexOf(id);
          if (idx > -1) hidden.splice(idx, 1);
        } else {
          if (hidden.indexOf(id) === -1) hidden.push(id);
        }
        App.Storage.set('hidden-widgets', hidden);
        applyWidgetVisibility();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!confirm('Reset all settings?')) return;
        Object.keys(localStorage).filter(function (k) { return k.startsWith('ntd_'); }).forEach(function (k) {
          localStorage.removeItem(k);
        });
        App.IDB.del(App.BG_BLOB_KEY);
        location.reload();
      });
    }
  }

  return { init: init, applyWidgetVisibility: applyWidgetVisibility };
})();
