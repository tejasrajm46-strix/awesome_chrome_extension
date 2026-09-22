window.App = window.App || {};
window.App.Todo = (function () {
  var form, input, list;
  var todos = [];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function save() { App.Storage.set('todos', todos); }

  function render() {
    if (!list) return;
    list.innerHTML = '';
    todos.forEach(function (t, i) {
      var linkMark = t.linkedPomodoro ? '<span class="pomodoro-link" style="color:var(--accent);font-size:10px;margin-left:6px">\uD83D\uDD17</span>' : '';
      var li = document.createElement('li');
      li.className = 'todo-item';
      li.innerHTML =
        '<button class="todo-check ' + (t.done ? 'done' : '') + '" data-i="' + i + '">' + (t.done ? '&#10003;' : '') + '</button>' +
        '<span class="todo-text ' + (t.done ? 'done' : '') + '" style="flex:1">' + esc(t.text) + linkMark + '</span>' +
        '<button class="todo-delete" data-i="' + i + '">&times;</button>';
      list.appendChild(li);
    });

    list.querySelectorAll('.todo-check').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.dataset.i, 10);
        if (isNaN(idx) || !todos[idx]) return;
        todos[idx].done = !todos[idx].done;
        save(); render();
      });
    });

    list.querySelectorAll('.todo-delete').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.dataset.i, 10);
        if (isNaN(idx)) return;
        todos.splice(idx, 1);
        save(); render();
      });
    });
  }

  function linkTaskToPomodoro(taskId) {
    var idx = parseInt(taskId, 10);
    if (isNaN(idx) || idx < 0 || idx >= todos.length) return;
    // Clear previous links
    todos.forEach(function (t) { t.linkedPomodoro = false; });
    todos[idx].linkedPomodoro = true;
    save();
    // Persist for pomodoro to pick up on start
    if (window.App && App.Pomodoro && App.Pomodoro.linkTask) {
      App.Pomodoro.linkTask(idx);
    } else {
      App.Storage.set('linked-task', idx);
    }
    render();
  }

  function init() {
    form = document.getElementById('todo-form');
    input = document.getElementById('todo-input');
    list = document.getElementById('todo-list');
    if (!form || !input || !list) return;

    var stored = App.Storage.get('todos', []);
    // Migrate old format: ensure each has done + linkedPomodoro
    todos = Array.isArray(stored) ? stored.map(function (t) {
      if (typeof t === 'string') return { text: t, done: false, linkedPomodoro: false };
      return { text: t.text || '', done: !!t.done, linkedPomodoro: !!t.linkedPomodoro };
    }) : [];

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      todos.unshift({ text: v, done: false, linkedPomodoro: false });
      save(); input.value = ''; render();
    });

    render();
  }

  return { init: init, render: render, linkTaskToPomodoro: linkTaskToPomodoro, getTodos: function(){ return todos; } };
})();
