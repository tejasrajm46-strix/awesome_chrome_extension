window.App = window.App || {};
window.App.Layout = (function () {
  'use strict';

  var GRID = 12; // snap grid in px
  var SNAP_ENABLED = true;
  var DEFAULTS = {
    bookmarks: { w: 0, h: 0 }, // 0 = auto (full width in left col)
    calendar: { minW: 260, maxW: 420, minH: 220, maxH: 420 },
    todo: { minW: 240, maxW: 420, minH: 180, maxH: 500 },
    notes: { minW: 260, maxW: 420, minH: 180, maxH: 520 },
    pomodoro: { minW: 240, maxW: 380, minH: 200, maxH: 380 },
    reminders: { minW: 240, maxW: 420, minH: 180, maxH: 460 },
    recent: { minW: 240, maxW: 420, minH: 180, maxH: 460 }
  };
  var GLOBAL_MIN_W = 220, GLOBAL_MAX_W = 560, GLOBAL_MIN_H = 140, GLOBAL_MAX_H = 640;

  function snap(v) { return SNAP_ENABLED ? Math.round(v / GRID) * GRID : Math.round(v); }

  // ---------- Storage ----------
  function saveDimensions(id, w, h) {
    var dims = App.Storage.get('widget-dimensions', {});
    dims[id] = { width: w, height: h };
    App.Storage.set('widget-dimensions', dims);
    // also try chrome.storage.sync/local for sync across devices if available
    try { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.set({ ['ntd_widget-dimensions']: dims }); } catch (e) {}
  }
  function loadDimensions() { return App.Storage.get('widget-dimensions', {}); }
  function saveLayout(order) { App.Storage.set('widget-layout', { order: order }); try { if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ ['ntd_widget-layout']: { order: order } }); } catch (e) {} }
  function loadLayout() { return App.Storage.get('widget-layout', null); }

  // Apply stored sizes synchronously (call as early as possible to prevent flicker)
  function applyStoredSizes() {
    var dims = loadDimensions();
    Object.keys(dims).forEach(function (id) {
      var d = dims[id];
      if (!d || typeof d.width !== 'number' || typeof d.height !== 'number') return;
      var el = document.getElementById(id + '-section');
      if (!el) return;
      var cfg = DEFAULTS[id] || {};
      var minW = cfg.minW || GLOBAL_MIN_W, maxW = cfg.maxW || GLOBAL_MAX_W;
      var minH = cfg.minH || GLOBAL_MIN_H, maxH = cfg.maxH || GLOBAL_MAX_H;
      // bookmarks with w=0 means auto
      if (id === 'bookmarks' && d.width === 0) return;
      var w = Math.max(minW, Math.min(maxW, d.width));
      var h = Math.max(minH, Math.min(maxH, d.height));
      el.style.width = snap(w) + 'px';
      el.style.height = snap(h) + 'px';
      el.style.flexShrink = '0';
    });
  }

  function applyStoredLayout() {
    var layout = loadLayout();
    if (!layout || !Array.isArray(layout.order)) return;
    var panel = document.getElementById('widgets-panel');
    var left = document.getElementById('left-col');
    if (!panel || !left) return;
    var map = {};
    document.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { map[w.dataset.widgetId] = w; });
    layout.order.forEach(function (item) {
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

  // ---------- Resize ----------
  var active = null; // {el, id, startX, startY, startW, startH, dir, cfg}
  var raf = null, pendingW = 0, pendingH = 0;

  function getConstraints(id) {
    var c = DEFAULTS[id] || {};
    return {
      minW: c.minW || GLOBAL_MIN_W,
      maxW: c.maxW || Math.min(GLOBAL_MAX_W, window.innerWidth - 80),
      minH: c.minH || GLOBAL_MIN_H,
      maxH: c.maxH || GLOBAL_MAX_H
    };
  }

  function onMove(e) {
    if (!active) return;
    var dx = e.clientX - active.startX;
    var dy = e.clientY - active.startY;
    var c = active.cfg;
    var newW = active.startW, newH = active.startH;
    if (active.dir.indexOf('e') !== -1) newW = snap(Math.max(c.minW, Math.min(c.maxW, active.startW + dx)));
    if (active.dir.indexOf('w') !== -1) newW = snap(Math.max(c.minW, Math.min(c.maxW, active.startW - dx)));
    if (active.dir.indexOf('s') !== -1) newH = snap(Math.max(c.minH, Math.min(c.maxH, active.startH + dy)));
    if (active.dir.indexOf('n') !== -1) newH = snap(Math.max(c.minH, Math.min(c.maxH, active.startH - dy)));
    pendingW = newW; pendingH = newH;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = null;
      if (!active) return;
      if (active.dir.indexOf('e') !== -1 || active.dir.indexOf('w') !== -1) active.el.style.width = pendingW + 'px';
      if (active.dir.indexOf('s') !== -1 || active.dir.indexOf('n') !== -1) active.el.style.height = pendingH + 'px';
    });
    e.preventDefault();
  }

  function onUp() {
    if (!active) return;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    // flush pending size directly
    if (pendingW) active.el.style.width = pendingW + 'px';
    if (pendingH) active.el.style.height = pendingH + 'px';
    var el = active.el, id = active.id;
    var w = parseFloat(el.style.width) || el.offsetWidth;
    var h = parseFloat(el.style.height) || el.offsetHeight;
    saveDimensions(id, Math.round(w), Math.round(h));
    el.classList.remove('resizing');
    document.body.classList.remove('resizing-active');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('mouseleave', onUp);
    active = null;
    pendingW = 0; pendingH = 0;
  }

  function makeHandles(widget) {
    if (widget.querySelector('.resize-handle-se')) return;
    widget.style.position = 'relative';
    var handles = [
      { dir: 'e', cls: 'resize-handle-e', title: 'Drag to resize width' },
      { dir: 's', cls: 'resize-handle-s', title: 'Drag to resize height' },
      { dir: 'se', cls: 'resize-handle-se', title: 'Drag to resize' }
    ];
    handles.forEach(function (h) {
      var el = document.createElement('div');
      el.className = 'resize-handle ' + h.cls;
      el.dataset.dir = h.dir;
      el.setAttribute('title', h.title);
      // Prevent widget drag when interacting with resize
      el.setAttribute('draggable', 'false');
      el.addEventListener('mousedown', function (e) {
        // Don't trigger widget drag, don't bubble to inner controls
        e.preventDefault();
        e.stopPropagation();
        // Ignore if clicking inner interactive elements (shouldn't happen, handle is isolated)
        var id = widget.dataset.widgetId;
        active = {
          el: widget,
          id: id,
          startX: e.clientX,
          startY: e.clientY,
          startW: widget.offsetWidth,
          startH: widget.offsetHeight,
          dir: h.dir,
          cfg: getConstraints(id)
        };
        widget.classList.add('resizing');
        document.body.classList.add('resizing-active');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('mouseleave', onUp);
      });
      // Touch support
      el.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        e.preventDefault();
        e.stopPropagation();
        var id = widget.dataset.widgetId;
        active = {
          el: widget,
          id: id,
          startX: t.clientX,
          startY: t.clientY,
          startW: widget.offsetWidth,
          startH: widget.offsetHeight,
          dir: h.dir,
          cfg: getConstraints(id)
        };
        widget.classList.add('resizing');
        document.body.classList.add('resizing-active');
        document.addEventListener('touchmove', function te(ev) {
          var tt = ev.touches[0];
          onMove({ clientX: tt.clientX, clientY: tt.clientY, preventDefault: function () {} });
        }, { passive: false });
        document.addEventListener('touchend', function tu() {
          document.removeEventListener('touchmove', te);
          document.removeEventListener('touchend', tu);
          onUp();
        });
      }, { passive: false });
      widget.appendChild(el);
    });
  }

  function init() {
    // Apply sizes before handles to avoid FOUC
    applyStoredSizes();
    // Create handles for each widget
    document.querySelectorAll('.widget[data-widget-id]').forEach(function (w) { makeHandles(w); });
    // Re-apply on resize of viewport to clamp
    window.addEventListener('resize', function () {
      // clamp existing custom sizes that now exceed viewport
      var dims = loadDimensions();
      var changed = false;
      Object.keys(dims).forEach(function (id) {
        var el = document.getElementById(id + '-section');
        if (!el) return;
        var c = getConstraints(id);
        var curW = parseFloat(el.style.width) || 0;
        if (curW > c.maxW) { el.style.width = c.maxW + 'px'; dims[id].width = c.maxW; changed = true; }
      });
      if (changed) App.Storage.set('widget-dimensions', dims);
    });
  }

  return {
    init: init,
    applyStoredSizes: applyStoredSizes,
    applyStoredLayout: applyStoredLayout,
    saveDimensions: saveDimensions,
    loadDimensions: loadDimensions,
    saveLayout: saveLayout,
    GRID: GRID
  };
})();
