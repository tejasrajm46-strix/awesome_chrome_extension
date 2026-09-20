window.App = window.App || {};
window.App.Notes = (function () {
  var textarea, countEl;

  function updateCount() {
    if (countEl) countEl.textContent = textarea.value.length + ' chars';
  }

  function init() {
    textarea = document.getElementById('notes-textarea');
    countEl = document.getElementById('notes-count');
    var clearBtn = document.getElementById('notes-clear');
    if (!textarea) return;

    textarea.value = App.Storage.get('notes', '');
    updateCount();

    textarea.addEventListener('input', function () {
      App.Storage.set('notes', textarea.value);
      updateCount();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        textarea.value = '';
        App.Storage.set('notes', '');
        updateCount();
      });
    }
  }

  return { init: init };
})();
