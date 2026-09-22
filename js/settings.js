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
        App.Storage.set('search-engine', b.dataset.engine);
        applySearchEngine();
        if (App.Search && App.Search.init) App.Search.init();
      });
    });

    document.querySelectorAll('.pomodoro-set-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var duration = b.dataset.duration;
        var breakTime = b.dataset.break;
        if (duration) {
          App.Pomodoro.setSetting('workMinutes', parseInt(duration, 10));
        }
        if (breakTime) {
          App.Pomodoro.setSetting('breakMinutes', parseInt(breakTime, 10));
        }
        // Visual feedback
        document.querySelectorAll('.pomodoro-set-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });
    // Highlight active pomodoro duration on open
    (function applyPomodoroActive() {
      var s = App.Pomodoro.getSettings();
      document.querySelectorAll('.pomodoro-set-btn[data-duration]').forEach(function (b) {
        b.classList.toggle('active', parseInt(b.dataset.duration,10) === s.workMinutes);
      });
      document.querySelectorAll('.pomodoro-set-btn[data-break]').forEach(function (b) {
        b.classList.toggle('active', parseInt(b.dataset.break,10) === s.breakMinutes);
      });
    })();

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
