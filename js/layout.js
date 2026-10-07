window.App = window.App || {};
window.App.Layout = (function () {
  'use strict';

  // ---- configuration -----------------------------------------------------
  var STORAGE_KEY = 'free-widget-layout';
  var VERSION_KEY = 'free-widget-layout-version';
  var SHAPE_KEY = 'widget-shapes';
  var AUTO_KEY = 'widget-auto-arrange';
  // v4 stores one profile per size class instead of a single flat map, so a
  // layout saved on a laptop is never applied unchanged to a large monitor.
  var LAYOUT_VERSION = 4;

  var MIN_WIDTH = 120;
  var MIN_HEIGHT = 72;
  var BOTTOM_CLEARANCE = 24; // breathing room kept between a widget and the fold
  var GAP = 20;          // minimum vertical gap enforced between widgets
  var GRID = 8;          // snap step for move/resize
  var STEP = 8;          // keyboard nudge step
  var EDGE = 12;         // hard inset from the canvas edge
  // The Customize / Settings buttons are position:fixed at the top-right, so the
  // band they occupy is a fixed number of pixels whatever the viewport height is
  // (16px offset + 42px button + breathing room). The first widget therefore gets
  // a fixed clearance off the top rather than a fraction of the height — a pure
  // fraction would tuck it straight under those buttons on a short screen.
  // 78px clears the tallest case: at <980px the button sits at top:26px with a
  // 42px height, so its bottom edge is 68px; the extra 10px is breathing room.
  var TOP_CLEARANCE = 78;

  var MIN_WIDTHS = { bookmarks: 260, clock: 180, search: 220, quote: 200 };
  // The bookmark panel is the one widget whose body is a list of many items, so
  // its height has to leave room for the controls above and below that list
  // (title, page/board rows, search and sort row, status line). A box shorter
  // than its own chrome cannot be honoured: the controls would be squeezed out of
  // it. 440px is the measured chrome at its widest wrapping plus one card row.
  var MIN_HEIGHTS = { bookmarks: 440 };

  function read(key, fallback) { return App.Storage.get(key, fallback); }
  function save(key, value) { App.Storage.set(key, value); }
  function finite(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function snap(value) { return Math.round(value / GRID) * GRID; }
  function getWidgets() {
    return Array.prototype.slice.call(document.querySelectorAll('.free-widget[data-widget-id]'));
  }
  function minWidthFor(id) { return MIN_WIDTHS[id] || MIN_WIDTH; }
  function minHeightFor(id) { return MIN_HEIGHTS[id] || MIN_HEIGHT; }

  // ---- size classes ------------------------------------------------------
  // Driven by the container width, not the window: the dashboard is what the
  // widgets actually live in, and the two can differ (side panels, zoom).
  // Boundaries match the stylesheet's own breakpoints (980px / 1440px) so the
  // widget arrangement and the card grid switch together instead of fighting.
  function sizeClassFor(width) {
    if (width < 980) return 'compact';
    if (width < 1440) return 'wide';
    return 'large';
  }

  // Layout basis. Horizontal math is container-relative; vertical fractions are
  // viewport-relative on purpose: the canvas grows to fit its content, so using
  // its own height as the basis would feed back into itself and creep downward
  // on every resize.
  // A resize event can be delivered *before* the canvas has been re-laid out, so
  // at that moment the canvas still reports its previous width. Sizing widgets
  // from that stale number leaves them laid out for a viewport that no longer
  // exists (it only shows up when the window grows, never when it shrinks).
  // The dashboard is full-width with no horizontal padding, so the live viewport
  // width is the same number once layout has settled and the correct one during
  // the transition. Taking the larger of the two resolves the race either way.
  function basis(canvas) {
    var rect = canvas.getBoundingClientRect();
    var viewportWidth = window.innerWidth || rect.width;
    var width = Math.max(1, rect.width, viewportWidth);
    var height = Math.max(1, window.innerHeight);
    return { width: width, height: height, top: rect.top + window.scrollY };
  }

  function inset(width) { return Math.min(24, Math.max(EDGE, width * 0.025)); }

  // ---- defaults ---------------------------------------------------------
  // Vertical positions are pure fractions of the viewport height. The previous
  // implementation mixed fractions with pixel floors (430/height), which pushed
  // the bookmarks widget below the fold on short or zoomed screens.
  function defaultPositions(width, height) {
    var cls = sizeClassFor(width);
    height = height || window.innerHeight || 1;
    var top = Math.max(TOP_CLEARANCE, height * 0.02) / height;
    if (cls === 'compact') {
      return {
        clock:     { x: 0.05, y: top, w: 0.90, h: 0 },
        search:    { x: 0.05, y: 0.16, w: 0.90, h: 0 },
        quote:     { x: 0.05, y: 0.29, w: 0.90, h: 0 },
        bookmarks: { x: 0.05, y: 0.38, w: 0.90, h: 0 }
      };
    }
    if (cls === 'wide') {
      return {
        clock:     { x: 0.405, y: top, w: 0.19, h: 0 },
        search:    { x: 0.04,  y: 0.22, w: 0.40, h: 0 },
        quote:     { x: 0.53,  y: 0.30, w: 0.43, h: 0 },
        bookmarks: { x: 0.53,  y: 0.38, w: 0.43, h: 0 }
      };
    }
    return {
      clock:     { x: 0.405, y: top, w: 0.19, h: 0 },
      search:    { x: 0.03,  y: 0.22, w: 0.33, h: 0 },
      quote:     { x: 0.63,  y: 0.30, w: 0.34, h: 0 },
      bookmarks: { x: 0.63,  y: 0.38, w: 0.34, h: 0 }
    };
  }

  // ---- saved data -------------------------------------------------------
  // Reject anything that is not a usable proportion. This is the guard that
  // stops a resize from baking zero/NaN geometry into the saved layout.
  function sanitizeEntry(entry, fallback) {
    if (!entry || typeof entry !== 'object') return fallback;
    var x = Number(entry.x), y = Number(entry.y), w = Number(entry.w), h = Number(entry.h);
    if (!isFinite(x) || !isFinite(y) || !isFinite(w)) return fallback;
    if (x < 0 || y < 0 || w <= 0) return fallback;
    if (w > 1) return fallback;
    return {
      x: clamp(x, 0, 1),
      y: clamp(y, 0, 4),
      w: clamp(w, 0.02, 1),
      h: isFinite(h) && h > 0 ? clamp(h, 0.02, 4) : 0
    };
  }

  function loadProfiles() {
    var raw = read(STORAGE_KEY, null);
    if (!raw || typeof raw !== 'object') return {};
    if (raw.profiles && typeof raw.profiles === 'object') return raw.profiles;
    // Legacy flat map: attribute it to the class that was on screen when it was
    // saved, rather than discarding the user's arrangement outright.
    var legacy = {};
    Object.keys(raw).forEach(function (id) {
      if (id === 'version' || id === 'profiles') return;
      if (raw[id] && typeof raw[id] === 'object') legacy[id] = raw[id];
    });
    if (!Object.keys(legacy).length) return {};
    var migrated = {};
    migrated[sizeClassFor(window.innerWidth)] = legacy;
    return migrated;
  }

  function applyGeometry(widget, entry, defaults, box) {
    var id = widget.dataset.widgetId;
    var def = defaults[id] || { x: 0.04, y: 0.05, w: 0.9, h: 0 };
    var data = sanitizeEntry(entry, def);
    var margin = inset(box.width);
    var available = Math.max(80, box.width - margin * 2);
    var min = Math.min(minWidthFor(id), available);
    var width = clamp(data.w * box.width, min, available);
    var left = clamp(data.x * box.width, margin, Math.max(margin, box.width - width - margin));
    var top = Math.max(0, data.y * box.height);
    var height = data.h > 0 ? Math.max(minHeightFor(id), data.h * box.height) : 0;
    widget.style.position = 'absolute';
    widget.style.left = Math.round(left) + 'px';
    widget.style.top = Math.round(top) + 'px';
    widget.style.width = Math.round(width) + 'px';
    widget.style.height = height ? Math.round(height) + 'px' : 'auto';
  }

  // ---- overlap resolution ------------------------------------------------
  // Single pass in document order: a widget only ever needs to clear the ones
  // already placed above it that share horizontal space. Terminates, and it is
  // what makes "widgets never overlap" a property of the layout rather than a
  // hope.
  function measure(widget) {
    var left = parseFloat(widget.style.left) || 0;
    var top = parseFloat(widget.style.top) || 0;
    var width = widget.offsetWidth || parseFloat(widget.style.width) || 0;
    var height = widget.offsetHeight || 0;
    return { left: left, top: top, width: width, height: height, right: left + width, bottom: top + height };
  }

  function resolveOverlaps(widgets, box) {
    var placed = [];
    widgets.slice().sort(function (a, b) {
      return (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0);
    }).forEach(function (widget) {
      setAvailableHeight(widget, box);
      var box2 = measure(widget);
      var limit = 0;
      placed.forEach(function (other) {
        var horizontal = Math.min(box2.right, other.right) - Math.max(box2.left, other.left);
        if (horizontal > 1) limit = Math.max(limit, other.bottom + GAP);
      });
      if (box2.top < limit) {
        widget.style.top = Math.round(limit) + 'px';
        box2.top = limit;
        box2.bottom = limit + box2.height;
      }
      placed.push(box2);
    });
  }

  function clampAll(widgets, box) {
    var margin = inset(box.width);
    widgets.forEach(function (widget) {
      var width = widget.offsetWidth || parseFloat(widget.style.width) || 0;
      var left = parseFloat(widget.style.left) || 0;
      var top = parseFloat(widget.style.top) || 0;
      var maxLeft = Math.max(margin, box.width - width - margin);
      widget.style.left = Math.round(clamp(left, margin, maxLeft)) + 'px';
      widget.style.top = Math.round(Math.max(0, top)) + 'px';
    });
  }

  // How much room a widget has before it runs off the bottom of the screen,
  // published as a custom property. The bookmark panel is the one widget whose
  // content has no natural upper bound (a library can hold any number of
  // bookmarks), so the stylesheet caps it at this value and lets its list scroll
  // inside: a panel that a resize committed at a fixed height, and a library that
  // later outgrew it, both stop painting cards outside their own box.
  function setAvailableHeight(widget, box) {
    var top = parseFloat(widget.style.top) || 0;
    var documentTop = box.top + top;
    var available = Math.max(MIN_HEIGHT, (window.innerHeight || 1) - documentTop - BOTTOM_CLEARANCE);
    widget.style.setProperty('--widget-available-height', Math.round(available) + 'px');
  }

  function updateCanvasHeight(canvas, widgets, box) {
    var bottom = window.innerHeight;
    widgets.forEach(function (widget) {
      // Set before the height is read so the canvas is measured from the panel
      // the user will actually see, not from its uncapped content.
      setAvailableHeight(widget, box);
      bottom = Math.max(bottom, (parseFloat(widget.style.top) || 0) + widget.offsetHeight + 48);
    });
    canvas.style.minHeight = Math.ceil(bottom) + 'px';
    widgets.forEach(function (widget) {
      widget.style.setProperty('--widget-canvas-top', box.top + 'px');
    });
  }

  // ---- main --------------------------------------------------------------
  function init() {
    var canvas = document.getElementById('dashboard');
    var customize = document.getElementById('btn-customize');
    var editBar = document.getElementById('widget-edit-bar');
    var done = document.getElementById('widget-edit-done');
    var reset = document.getElementById('widget-edit-reset');
    var autoButton = document.getElementById('widget-edit-auto');
    var shapeButton = document.getElementById('widget-edit-style');
    var shapeTarget = document.getElementById('widget-shape-target');
    var shapeSelect = document.getElementById('widget-shape');
    var shapeSettings = document.querySelector('.widget-shape-settings');
    var widgets = getWidgets();
    if (!canvas || !customize || !editBar || !widgets.length) return;

    var profiles = loadProfiles();
    var shapes = read(SHAPE_KEY, {}) || {};
    var autoArrange = read(AUTO_KEY, false) === true;
    var selected = null;
    var action = null;
    var frame = null;
    var pointerBound = false;

    canvas.classList.add('freeform-canvas');
    canvas.dataset.layoutClass = sizeClassFor(canvas.getBoundingClientRect().width);

    function currentDefaults() {
      var box = basis(canvas);
      return defaultPositions(box.width, box.height);
    }

    function applyLayout() {
      var box = basis(canvas);
      var cls = sizeClassFor(box.width);
      canvas.dataset.layoutClass = cls;
      var defaults = currentDefaults();
      var saved = autoArrange ? {} : (profiles[cls] || {});
      widgets.forEach(function (widget) {
        applyGeometry(widget, saved[widget.dataset.widgetId], defaults, box);
      });
      // Widget heights depend on content, so overlaps can only be judged after
      // the first pass has been laid out.
      resolveOverlaps(widgets, box);
      clampAll(widgets, box);
      updateCanvasHeight(canvas, widgets, box);
    }

    // After a user gesture the DOM holds the arrangement the user just made, so
    // this normalises *that* and persists it. It must never call applyLayout(),
    // which re-derives geometry from the saved profiles and would therefore
    // throw the gesture away.
    function commitGesture() {
      var box = basis(canvas);
      resolveOverlaps(widgets, box);
      clampAll(widgets, box);
      updateCanvasHeight(canvas, widgets, box);
      commit();
    }

    function commit() {
      var box = basis(canvas);
      var cls = sizeClassFor(box.width);
      var data = {};
      widgets.forEach(function (widget) {
        var id = widget.dataset.widgetId;
        var width = widget.offsetWidth || parseFloat(widget.style.width) || 0;
        var heightStyle = widget.style.height;
        var height = heightStyle && heightStyle !== 'auto' ? (widget.offsetHeight || 0) : 0;
        if (!isFinite(width) || width < minWidthFor(id) * 0.5) return; // never persist a degenerate box
        data[id] = {
          x: clamp((parseFloat(widget.style.left) || 0) / box.width, 0, 1),
          y: Math.max(0, (parseFloat(widget.style.top) || 0) / box.height),
          w: clamp(width / box.width, 0.02, 1),
          h: height ? clamp(height / box.height, 0.02, 4) : 0
        };
      });
      if (!Object.keys(data).length) return;
      profiles[cls] = data;
      save(STORAGE_KEY, { version: LAYOUT_VERSION, profiles: profiles });
      save(VERSION_KEY, LAYOUT_VERSION);
    }

    // ---- shapes ---------------------------------------------------------
    function applyShape(widget) {
      widget.classList.remove('shape-square', 'shape-capsule');
      var shape = shapes[widget.dataset.widgetId];
      if (shape === 'square') widget.classList.add('shape-square');
      else if (shape === 'capsule') widget.classList.add('shape-capsule');
    }

    function updateShapeSelect() {
      if (!shapeSelect || !shapeTarget) return;
      var id = (selected && selected.dataset.widgetId) || shapeTarget.value;
      shapeSelect.value = shapes[id] || 'soft';
    }

    function selectWidget(widget) {
      if (!widget) return;
      if (selected) selected.classList.remove('widget-selected');
      selected = widget;
      widget.classList.add('widget-selected');
      if (shapeTarget) shapeTarget.value = widget.dataset.widgetId;
      updateShapeSelect();
    }

    // ---- pointer: move and resize ---------------------------------------
    function bindPointerListeners() {
      if (pointerBound) return;
      pointerBound = true;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', endPointerAction);
      document.addEventListener('pointercancel', endPointerAction);
    }

    function unbindPointerListeners() {
      pointerBound = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endPointerAction);
      document.removeEventListener('pointercancel', endPointerAction);
    }

    function startMove(event, widget) {
      var box = basis(canvas);
      var rect = widget.getBoundingClientRect();
      action = {
        type: 'move', widget: widget, startX: event.clientX, startY: event.clientY,
        left: rect.left - canvas.getBoundingClientRect().left, top: rect.top - canvas.getBoundingClientRect().top,
        box: box
      };
      document.body.classList.add('widget-pointer-active');
      bindPointerListeners();
    }

    function startResize(event, widget, direction) {
      var canvasRect = canvas.getBoundingClientRect();
      var rect = widget.getBoundingClientRect();
      action = {
        type: 'resize', widget: widget, direction: direction,
        startX: event.clientX, startY: event.clientY,
        left: rect.left - canvasRect.left, top: rect.top - canvasRect.top,
        width: rect.width, height: rect.height, box: basis(canvas)
      };
      widget.classList.add('is-resizing');
      document.body.classList.add('widget-pointer-active');
      bindPointerListeners();
    }

    function onPointerMove(event) {
      if (!action) return;
      var current = action;
      var dx = event.clientX - current.startX;
      var dy = event.clientY - current.startY;
      var box = current.box;
      var id = current.widget.dataset.widgetId;
      var margin = inset(box.width);
      var min = Math.min(minWidthFor(id), Math.max(80, box.width - margin * 2));
      var minHeight = minHeightFor(id);

      if (current.type === 'move') {
        var width = current.widget.offsetWidth;
        var maxLeft = Math.max(margin, box.width - width - margin);
        current.widget.style.left = snap(clamp(current.left + dx, margin, maxLeft)) + 'px';
        current.widget.style.top = snap(Math.max(0, current.top + dy)) + 'px';
      } else {
        var left = current.left, width2 = current.width, height = current.height, top = current.top;
        var dir = current.direction;
        if (dir.indexOf('e') >= 0) {
          width2 = clamp(current.width + dx, min, Math.max(min, box.width - left - margin));
        }
        if (dir.indexOf('w') >= 0) {
          var right = current.left + current.width;
          width2 = clamp(current.width - dx, min, Math.max(min, right - margin));
          left = right - width2;
        }
        if (dir.indexOf('s') >= 0) height = Math.max(minHeight, current.height + dy);
        if (dir.indexOf('n') >= 0) {
          var bottom = current.top + current.height;
          height = Math.max(minHeight, current.height - dy);
          top = bottom - height;
        }
        left = clamp(left, margin, Math.max(margin, box.width - min - margin));
        width2 = clamp(width2, min, Math.max(min, box.width - left - margin));
        current.widget.style.left = snap(left) + 'px';
        current.widget.style.top = snap(Math.max(0, top)) + 'px';
        current.widget.style.width = snap(width2) + 'px';
        current.widget.style.height = snap(height) + 'px';
      }
      updateCanvasHeight(canvas, widgets, basis(canvas));
      event.preventDefault();
    }

    function endPointerAction(event) {
      if (!action) return;
      var widget = action.widget;
      var wasResize = action.type === 'resize';
      action = null;
      widget.classList.remove('is-resizing');
      document.body.classList.remove('widget-pointer-active');
      unbindPointerListeners();
      // Cancelled gesture: restore the saved arrangement, change nothing.
      if (event && event.type === 'pointercancel') { applyLayout(); return; }
      commitGesture();
    }

    function nudge(widget, dx, dy) {
      var box = basis(canvas);
      var margin = inset(box.width);
      var width = widget.offsetWidth;
      var maxLeft = Math.max(margin, box.width - width - margin);
      var left = (parseFloat(widget.style.left) || 0) + dx;
      var top = (parseFloat(widget.style.top) || 0) + dy;
      widget.style.left = snap(clamp(left, margin, maxLeft)) + 'px';
      widget.style.top = snap(Math.max(0, top)) + 'px';
      commitGesture();
    }

    function keyboardResize(widget, direction, key) {
      var box = basis(canvas);
      var margin = inset(box.width);
      var id = widget.dataset.widgetId;
      var min = Math.min(minWidthFor(id), Math.max(80, box.width - margin * 2));
      var delta = (key === 'ArrowLeft' || key === 'ArrowUp') ? -STEP : STEP;
      var minHeight = minHeightFor(id);
      var height = widget.offsetHeight;
      var top = parseFloat(widget.style.top) || 0;
      var left = parseFloat(widget.style.left) || 0;
      var width = widget.offsetWidth;
      if (direction === 'e') {
        width = clamp(width + (key === 'ArrowRight' ? STEP : key === 'ArrowLeft' ? -STEP : 0), min, Math.max(min, box.width - left - margin));
      } else if (direction === 'w') {
        width = clamp(width + (key === 'ArrowLeft' ? STEP : key === 'ArrowRight' ? -STEP : 0), min, Math.max(min, box.width - margin));
        left = Math.max(margin, left + (widget.offsetWidth - width));
      } else if (direction === 's') {
        height = Math.max(minHeight, height + (key === 'ArrowDown' ? STEP : key === 'ArrowUp' ? -STEP : 0));
      } else if (direction === 'n') {
        var bottom = top + height;
        height = Math.max(minHeight, height + (key === 'ArrowUp' ? STEP : key === 'ArrowDown' ? -STEP : 0));
        top = Math.max(0, bottom - height);
      } else {
        return;
      }
      if (width) widget.style.width = snap(width) + 'px';
      widget.style.height = snap(height) + 'px';
      widget.style.left = snap(left) + 'px';
      widget.style.top = snap(top) + 'px';
      commitGesture();
    }

    // ---- wire each widget ------------------------------------------------
    widgets.forEach(function (widget) {
      var id = widget.dataset.widgetId;

      var handles = document.createElement('div');
      handles.className = 'widget-resize-handles';
      ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (direction) {
        var handle = document.createElement('span');
        handle.className = 'widget-resize-handle handle-' + direction;
        handle.dataset.direction = direction;
        handle.setAttribute('tabindex', '0');
        handle.setAttribute('role', 'button');
        handle.setAttribute('aria-label', 'Resize ' + id + ' from the ' + direction + ' edge');
        handle.addEventListener('pointerdown', function (event) {
          if (!document.body.classList.contains('widget-edit-mode')) return;
          event.preventDefault();
          event.stopPropagation();
          selectWidget(widget);
          startResize(event, widget, direction);
        });
        handle.addEventListener('keydown', function (event) {
          if (!document.body.classList.contains('widget-edit-mode')) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectWidget(widget);
            return;
          }
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          selectWidget(widget);
          if (event.shiftKey) {
            var dx = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;
            var dy = event.key === 'ArrowUp' ? -STEP : event.key === 'ArrowDown' ? STEP : 0;
            nudge(widget, dx, dy);
          } else {
            keyboardResize(widget, direction, event.key);
          }
        });
        handles.appendChild(handle);
      });
      widget.appendChild(handles);
      applyShape(widget);

      widget.addEventListener('pointerdown', function (event) {
        if (!document.body.classList.contains('widget-edit-mode')) return;
        if (event.target.closest('button,input,textarea,select,a,.widget-resize-handles')) return;
        event.preventDefault();
        selectWidget(widget);
        if (event.button === 0) startMove(event, widget);
      });
    });

    // ---- edit mode -------------------------------------------------------
    function setEditMode(enabled) {
      document.body.classList.toggle('widget-edit-mode', enabled);
      editBar.classList.toggle('hidden', !enabled);
      customize.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      // The descriptive placeholder belongs to the customize-mode guidance, so it
      // is swapped in here beside the other hints rather than living in the markup.
      var searchField = document.getElementById('bookmark-search');
      if (searchField) {
        var searchHint = searchField.getAttribute(enabled ? 'data-placeholder-long' : 'data-placeholder-short');
        if (searchHint) searchField.placeholder = searchHint;
      }
      if (enabled && !selected) selectWidget(widgets[0]);
      if (!enabled) {
        if (selected) selected.classList.remove('widget-selected');
        selected = null;
        // Leaving edit mode keeps whatever the user arranged, rather than
        // re-deriving it from the previously saved profile.
        commitGesture();
      }
    }

    function setAutoArrange(enabled) {
      autoArrange = !!enabled;
      save(AUTO_KEY, autoArrange);
      if (autoButton) {
        autoButton.setAttribute('aria-pressed', autoArrange ? 'true' : 'false');
        autoButton.textContent = autoArrange ? 'Auto arrange: on' : 'Auto arrange: off';
      }
      applyLayout();
      if (!autoArrange) commit();
    }

    if (autoButton) {
      autoButton.setAttribute('aria-pressed', autoArrange ? 'true' : 'false');
      autoButton.textContent = autoArrange ? 'Auto arrange: on' : 'Auto arrange: off';
      autoButton.addEventListener('click', function () { setAutoArrange(!autoArrange); });
    }

    customize.addEventListener('click', function () {
      setEditMode(!document.body.classList.contains('widget-edit-mode'));
    });
    done.addEventListener('click', function () { setEditMode(false); });

    reset.addEventListener('click', function () {
      // Explicit, and scoped: only the arrangement is cleared. Bookmarks,
      // shapes and every unrelated preference are left alone.
      App.Storage.del(STORAGE_KEY);
      App.Storage.del(VERSION_KEY);
      save(VERSION_KEY, LAYOUT_VERSION);
      profiles = {};
      autoArrange = false;
      save(AUTO_KEY, false);
      applyLayout();
    });

    if (shapeButton) {
      shapeButton.addEventListener('click', function () {
        if (selected && shapeTarget) shapeTarget.value = selected.dataset.widgetId;
        updateShapeSelect();
        var settings = document.getElementById('settings-overlay');
        if (settings) settings.classList.remove('hidden');
        if (shapeSettings) shapeSettings.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (shapeTarget) shapeTarget.focus();
      });
    }
    if (shapeTarget) {
      shapeTarget.addEventListener('change', function () {
        selectWidget(widgets.filter(function (widget) {
          return widget.dataset.widgetId === shapeTarget.value;
        })[0]);
      });
    }
    if (shapeSelect) {
      shapeSelect.addEventListener('change', function () {
        var target = widgets.filter(function (widget) {
          return widget.dataset.widgetId === (shapeTarget ? shapeTarget.value : 'bookmarks');
        })[0];
        if (!target) return;
        shapes[target.dataset.widgetId] = shapeSelect.value;
        save(SHAPE_KEY, shapes);
        applyShape(target);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('widget-edit-mode')) setEditMode(false);
    });

    // ---- responsive ------------------------------------------------------
    // Coalesced into one frame, and it never writes to storage. Re-deriving from
    // the saved proportions each time is what keeps a resize from destroying the
    // user's layout; the old handler re-persisted fitted pixel geometry on every
    // event, so layouts drifted and eventually overlapped.
    function scheduleReflow() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        frame = null;
        applyLayout();
        // applyLayout is idempotent, so one extra pass on the following frame
        // costs nothing and closes the window where the first pass read a
        // not-yet-settled container size.
        requestAnimationFrame(applyLayout);
      });
    }

    window.addEventListener('resize', scheduleReflow);
    window.addEventListener('orientationchange', scheduleReflow);
    if (typeof ResizeObserver === 'function') {
      var observedWidth = canvas.getBoundingClientRect().width;
      new ResizeObserver(function () {
        var width = canvas.getBoundingClientRect().width;
        if (Math.abs(width - observedWidth) < 1) return;
        observedWidth = width;
        scheduleReflow();
      }).observe(canvas);
    }
    // Browser zoom and display-scale changes do not always fire a resize event,
    // but they do change the device pixel ratio.
    var lastRatio = window.devicePixelRatio;
    window.addEventListener('resize', function () {
      if (window.devicePixelRatio === lastRatio) return;
      lastRatio = window.devicePixelRatio;
      scheduleReflow();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { scheduleReflow(); }).catch(function () {});
    }

    applyLayout();
    // Second pass once web fonts and favicons have settled, since they change
    // widget heights and therefore overlap decisions.
    requestAnimationFrame(function () {
      setTimeout(function () {
        if (!action) applyLayout();
      }, 400);
    });
  }

  return { init: init };
})();
