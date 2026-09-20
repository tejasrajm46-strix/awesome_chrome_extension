window.App = window.App || {};
window.App.Reminders = (function () {
  var form, input, timeInput, list;
  var reminders = [];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function save() { App.Storage.set('reminders', reminders); }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var now = new Date();
    var diff = d - now;
    if (diff < 0 && diff > -86400000) return 'Today';
    if (diff >= 0 && diff < 86400000) return 'Today';
    return d.toLocaleDateString();
  }

  function checkNotifications() {
    var now = new Date();
    reminders.forEach(function (r) {
      if (r.done || !r.time) return;
      var t = new Date(r.time);
      var diff = t - now;
      if (diff > -60000 && diff < 60000) {
        if (typeof chrome !== 'undefined' && chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon128.png',
            title: 'Reminder',
            message: r.text
          });
        }
      }
    });
  }

  function render() {
    list.innerHTML = '';
    reminders.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = 'reminder-item' + (r.done ? ' completed' : '');
      li.innerHTML =
        '<button class="reminder-check ' + (r.done ? 'done' : '') + '" data-i="' + i + '">' + (r.done ? '&#10003;' : '') + '</button>' +
        '<div class="reminder-info"><span class="reminder-text">' + esc(r.text) + '</span>' +
        (r.time ? '<span class="reminder-date">' + formatTime(r.time) + '</span>' : '') + '</div>' +
        '<button class="reminder-delete" data-i="' + i + '">&times;</button>';
      list.appendChild(li);
    });

    list.querySelectorAll('.reminder-check').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.dataset.i);
        reminders[idx].done = !reminders[idx].done;
        save(); render();
      });
    });

    list.querySelectorAll('.reminder-delete').forEach(function (b) {
      b.addEventListener('click', function () {
        reminders.splice(parseInt(b.dataset.i), 1);
        save(); render();
      });
    });
  }

  function init() {
    form = document.getElementById('reminder-form');
    input = document.getElementById('reminder-input');
    timeInput = document.getElementById('reminder-time');
    list = document.getElementById('reminder-list');
    if (!form || !input || !list) return;

    reminders = App.Storage.get('reminders', []);

    if (typeof chrome !== 'undefined' && chrome.notifications) {
      chrome.permissions.contains({ permissions: ['notifications'] }, function (granted) {
        if (!granted) {
          chrome.permissions.request({ permissions: ['notifications'] }, function () {});
        }
      });
    }

    setInterval(checkNotifications, 30000);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = input.value.trim();
      if (!t) return;
      var time = timeInput.value || null;
      reminders.unshift({ text: t, time: time, done: false });
      save(); input.value = ''; timeInput.value = ''; render();
    });

    render();
  }

  return { init: init };
})();
