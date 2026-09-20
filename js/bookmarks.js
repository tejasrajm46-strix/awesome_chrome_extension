window.App = window.App || {};
window.App.Bookmarks = (function () {
  var grid, modal, nameInput, urlInput, editIndexInput, titleEl;
  var bookmarks = [];

  function getDomain(u) {
    try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return ''; }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function save() {
    App.Storage.set('bookmarks', bookmarks);
  }

  function render() {
    grid.innerHTML = '';
    bookmarks.forEach(function (bm, i) {
      var domain = getDomain(bm.url);
      var a = document.createElement('a');
      a.href = bm.url;
      a.className = 'bm-item';
      a.title = bm.name + ' - ' + bm.url;
      a.draggable = true;
      a.dataset.index = i;
      a.innerHTML =
        '<div class="bm-icon"><img src="https://www.google.com/s2/favicons?domain=' + domain + '&sz=64" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><span style="display:none;width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.08);align-items:center;justify-content:center;font-size:16px;font-weight:700">' + bm.name.charAt(0).toUpperCase() + '</span></div>' +
        '<span class="bm-name">' + esc(bm.name) + '</span>' +
        '<button class="bm-edit" data-i="' + i + '" title="Edit">&#9998;</button>' +
        '<button class="bm-remove" data-i="' + i + '" title="Remove">&times;</button>';
      grid.appendChild(a);

      a.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', i);
        a.classList.add('dragging');
      });
      a.addEventListener('dragend', function () { a.classList.remove('dragging'); });
      a.addEventListener('dragover', function (e) { e.preventDefault(); a.classList.add('drag-over'); });
      a.addEventListener('dragleave', function () { a.classList.remove('drag-over'); });
      a.addEventListener('drop', function (e) {
        e.preventDefault();
        a.classList.remove('drag-over');
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        var toIdx = i;
        if (fromIdx === toIdx) return;
        var item = bookmarks.splice(fromIdx, 1)[0];
        bookmarks.splice(toIdx, 0, item);
        save();
        render();
      });
    });

    grid.querySelectorAll('.bm-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        bookmarks.splice(parseInt(btn.dataset.i), 1);
        save(); render();
      });
    });

    grid.querySelectorAll('.bm-edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var idx = parseInt(btn.dataset.i);
        openModal(idx);
      });
    });
  }

  function openModal(editIdx) {
    if (typeof editIdx === 'number' && editIdx >= 0) {
      titleEl.textContent = 'Edit Bookmark';
      nameInput.value = bookmarks[editIdx].name;
      urlInput.value = bookmarks[editIdx].url;
      editIndexInput.value = editIdx;
    } else {
      titleEl.textContent = 'Add Bookmark';
      nameInput.value = '';
      urlInput.value = '';
      editIndexInput.value = -1;
    }
    modal.classList.remove('hidden');
    nameInput.focus();
  }

  function init() {
    grid = document.getElementById('bookmarks-grid');
    modal = document.getElementById('bookmark-modal');
    nameInput = document.getElementById('bm-name');
    urlInput = document.getElementById('bm-url');
    editIndexInput = document.getElementById('bm-edit-index');
    titleEl = document.getElementById('bm-modal-title');
    var addBtn = document.getElementById('add-bookmark-btn');
    var closeBtn = document.getElementById('bm-modal-close');
    var saveBtn = document.getElementById('bm-save');
    if (!grid || !modal) return;

    bookmarks = App.Storage.get('bookmarks', [
      { name: 'Google', url: 'https://google.com' },
      { name: 'YouTube', url: 'https://youtube.com' },
      { name: 'GitHub', url: 'https://github.com' },
      { name: 'Reddit', url: 'https://reddit.com' },
      { name: 'Twitter', url: 'https://x.com' },
      { name: 'Notion', url: 'https://notion.so' }
    ]);

    render();

    if (addBtn) addBtn.addEventListener('click', function () { openModal(-1); });
    closeBtn.addEventListener('click', function () { modal.classList.add('hidden'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.add('hidden'); });
    saveBtn.addEventListener('click', function () {
      var n = nameInput.value.trim(), u = urlInput.value.trim();
      if (!n || !u) return;
      var idx = parseInt(editIndexInput.value);
      if (idx >= 0) {
        bookmarks[idx] = { name: n, url: u };
      } else {
        bookmarks.push({ name: n, url: u });
      }
      save(); render(); modal.classList.add('hidden');
    });
  }

  return { init: init };
})();
