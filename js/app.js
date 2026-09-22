window.App = window.App || {};
(function () {
  'use strict';

  var QUOTES = [
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

  function initQuote() {
    var textEl = document.getElementById('quote-text');
    var authorEl = document.getElementById('quote-author');
    if (!textEl || !authorEl) return;
    var today = new Date().toDateString();
    var lastDate = App.Storage.get('quote-date', '');
    var idx;
    if (lastDate === today) {
      idx = App.Storage.get('quote-idx', 0);
      if (typeof idx !== 'number' || idx < 0 || idx >= QUOTES.length) idx = 0;
    } else {
      idx = Math.floor(Math.random() * QUOTES.length);
      App.Storage.set('quote-date', today);
      App.Storage.set('quote-idx', idx);
    }
    textEl.textContent = QUOTES[idx].text;
    authorEl.textContent = QUOTES[idx].author;
  }

  function initOnboarding() {
    var onboarding = document.getElementById('onboarding');
    if (!onboarding) return;
    var shown = App.Storage.get('onboarding-done', false);
    if (shown) {
      onboarding.classList.add('hidden');
      return;
    }
    onboarding.classList.remove('hidden');
    var bgBtn = document.getElementById('onboard-bg');
    var bmBtn = document.getElementById('onboard-bm');
    var startBtn = document.getElementById('onboard-start');
    function dismiss() {
      App.Storage.set('onboarding-done', true);
      onboarding.style.opacity = '0';
      onboarding.style.transition = 'opacity 0.4s ease';
      setTimeout(function () { onboarding.classList.add('hidden'); }, 400);
    }
    if (bgBtn) bgBtn.addEventListener('click', function () {
      dismiss();
      setTimeout(function () {
        var overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.classList.remove('hidden');
      }, 500);
    });
    if (bmBtn) bmBtn.addEventListener('click', function () {
      dismiss();
      setTimeout(function () {
        var addBtn = document.getElementById('add-bookmark-btn');
        if (addBtn) addBtn.click();
      }, 500);
    });
    if (startBtn) startBtn.addEventListener('click', dismiss);
  }

  // Robust resize delegated to LayoutManager (js/layout.js) - smooth rAF + snap + multi-handle
  function initResize() {
    if (window.App && App.Layout && typeof App.Layout.init === 'function') {
      App.Layout.init();
    }
  }

  // Restore saved widget layout (delegates to Layout module if available)
  function initWidgetLayout() {
    if (window.App && App.Layout && typeof App.Layout.applyStoredLayout === 'function') {
      try { App.Layout.applyStoredLayout(); return; } catch (e) {}
    }
    var layout = App.Storage.get('widget-layout', null);
    if (!layout || !Array.isArray(layout.order)) return;
    var order = layout.order;
    var panel = document.getElementById('widgets-panel');
    var left = document.getElementById('left-col');
    if (!panel || !left) return;
    var map = {};
    document.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { map[w.dataset.widgetId] = w; });
    order.forEach(function (item) {
      var w = map[item.id];
      if (!w) return;
      var target = item.parent === 'left' ? left : panel;
      if (target === left) {
        var spacer = left.querySelector('.center-spacer');
        if (spacer) left.insertBefore(w, spacer.nextSibling);
        else left.appendChild(w);
      } else {
        target.appendChild(w);
      }
    });
  }

  function saveWidgetLayout() {
    if (window.App && App.Layout && typeof App.Layout.saveLayout === 'function') {
      var left = document.getElementById('left-col');
      var panel = document.getElementById('widgets-panel');
      var order = [];
      if (left) left.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { order.push({ id: w.dataset.widgetId, parent: 'left' }); });
      if (panel) panel.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { order.push({ id: w.dataset.widgetId, parent: 'right' }); });
      App.Layout.saveLayout(order);
      return;
    }
    var left2 = document.getElementById('left-col');
    var panel2 = document.getElementById('widgets-panel');
    var order2 = [];
    left2.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { order2.push({ id: w.dataset.widgetId, parent: 'left' }); });
    panel2.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { order2.push({ id: w.dataset.widgetId, parent: 'right' }); });
    App.Storage.set('widget-layout', { order: order2 });
  }

  function initWidgetDrag() {
    var dragState = null;

    function getDropContainer(element) {
      if (!element || !element.closest) return null;
      var container = element.closest('#widgets-panel, #left-col');
      return container && container.querySelector ? container : null;
    }

    function placePlaceholder(container, before) {
      if (!container || !dragState || before === dragState.widget) return;
      if (before) container.insertBefore(dragState.placeholder, before);
      else {
        var spacer = container.id === 'left-col' ? container.querySelector('.center-spacer') : null;
        if (spacer) container.insertBefore(dragState.placeholder, spacer.nextSibling);
        else container.appendChild(dragState.placeholder);
      }
    }

    function movePlaceholder(e) {
      if (!dragState) return;
      var target = document.elementFromPoint(e.clientX, e.clientY);
      var widget = target && target.closest ? target.closest('.widget[data-widget-id]') : null;
      if (widget && widget !== dragState.widget) {
        var rect = widget.getBoundingClientRect();
        placePlaceholder(widget.parentNode, e.clientY < rect.top + rect.height / 2 ? widget : widget.nextElementSibling);
      } else {
        placePlaceholder(getDropContainer(target), null);
      }
      e.preventDefault();
    }

    function finishDrag() {
      if (!dragState) return;
      var widget = dragState.widget;
      dragState.placeholder.replaceWith(widget);
      widget.style.display = '';
      widget.classList.remove('dragging');
      document.body.classList.remove('widget-dragging');
      document.removeEventListener('pointermove', movePlaceholder);
      document.removeEventListener('pointerup', finishDrag);
      document.removeEventListener('pointercancel', finishDrag);
      dragState = null;
      saveWidgetLayout();
    }

    document.querySelectorAll('.widget[data-widget-id]').forEach(function (widget) {
      widget.setAttribute('draggable', 'false');
      var handle = widget.querySelector('.drag-handle');
      var header = widget.querySelector('.widget-header');
      function startDrag(e) {
        if (e.button !== 0 || dragState || !document.body.classList.contains('customize-mode')) return;
        if (e.currentTarget === header && e.target.closest('button, input, textarea, a, .resize-handle')) return;
        e.preventDefault();
        var placeholder = document.createElement('div');
        placeholder.className = 'widget-drop-placeholder';
        placeholder.style.height = widget.offsetHeight + 'px';
        placeholder.style.width = widget.offsetWidth + 'px';
        widget.parentNode.insertBefore(placeholder, widget);
        dragState = { widget: widget, placeholder: placeholder };
        widget.style.display = 'none';
        widget.classList.add('dragging');
        document.body.classList.add('widget-dragging');
        document.addEventListener('pointermove', movePlaceholder);
        document.addEventListener('pointerup', finishDrag);
        document.addEventListener('pointercancel', finishDrag);
      }
      if (handle) handle.addEventListener('pointerdown', startDrag);
      if (header) header.addEventListener('pointerdown', startDrag);
    });
  }

  function initCustomizeBar() {
    var btn = document.getElementById('btn-customize');
    var bar = document.getElementById('customize-bar');
    var done = document.getElementById('customize-done');
    var reset = document.getElementById('customize-reset');
    if (!btn || !bar) return;

    function enter() {
      document.body.classList.add('customize-mode');
      document.getElementById('dashboard').classList.add('customize-mode');
      bar.classList.remove('hidden');
    }
    function exit() {
      document.body.classList.remove('customize-mode');
      var dash = document.getElementById('dashboard');
      if (dash) dash.classList.remove('customize-mode');
      bar.classList.add('hidden');
      saveWidgetLayout();
    }
    btn.addEventListener('click', enter);
    if (done) done.addEventListener('click', exit);
    if (reset) reset.addEventListener('click', function () {
      App.Storage.del('widget-layout');
      App.Storage.del('widget-dimensions');
      location.reload();
    });
    // Also allow exiting via clicking outside or Escape
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bar.classList.contains('hidden')) exit(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    try { initWidgetLayout(); } catch (e) { console.warn('WidgetLayout init failed', e); }
    try { App.Background.init(); } catch (e) { console.warn('Background init failed', e); }
    try { App.Clock.init(); } catch (e) { console.warn('Clock init failed', e); }
    try { App.Search.init(); } catch (e) { console.warn('Search init failed', e); }
    try { App.Bookmarks.init(); } catch (e) { console.warn('Bookmarks init failed', e); }
    try { App.Calendar.init(); } catch (e) { console.warn('Calendar init failed', e); }
    try { App.Todo.init(); } catch (e) { console.warn('Todo init failed', e); }
    try { App.Notes.init(); } catch (e) { console.warn('Notes init failed', e); }
    try { App.Pomodoro.init(); } catch (e) { console.warn('Pomodoro init failed', e); }
    try { App.Reminders.init(); } catch (e) { console.warn('Reminders init failed', e); }
    try { App.History.init(); } catch (e) { console.warn('History init failed', e); }
    try { App.Settings.init(); } catch (e) { console.warn('Settings init failed', e); }
    try { initQuote(); } catch (e) { console.warn('Quote init failed', e); }
    try { initOnboarding(); } catch (e) { console.warn('Onboarding init failed', e); }
    try { initResize(); } catch (e) { console.warn('Resize init failed', e); }
    try { initWidgetDrag(); } catch (e) { console.warn('WidgetDrag init failed', e); }
    try { initCustomizeBar(); } catch (e) { console.warn('CustomizeBar init failed', e); }
  });
})();
