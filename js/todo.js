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
    list.innerHTML = '';
    todos.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'todo-item';
      li.innerHTML =
        '<button class="todo-check ' + (t.done ? 'done' : '') + '" data-i="' + i + '">' + (t.done ? '&#10003;' : '') + '</button>' +
        '<span class="todo-text ' + (t.done ? 'done' : '') + '">' + esc(t.text) + '</span>' +
        '<button class="todo-delete" data-i="' + i + '">&times;</button>';
      list.appendChild(li);
    });

    list.querySelectorAll('.todo-check').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.dataset.i);
        todos[idx].done = !todos[idx].done;
        save(); render();
      });
    });

    list.querySelectorAll('.todo-delete').forEach(function (b) {
      b.addEventListener('click', function () {
        todos.splice(parseInt(b.dataset.i), 1);
        save(); render();
      });
    });
  }

  function init() {
    form = document.getElementById('todo-form');
    input = document.getElementById('todo-input');
    list = document.getElementById('todo-list');
    if (!form || !input || !list) return;

    todos = App.Storage.get('todos', []);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      todos.unshift({ text: v, done: false });
      save(); input.value = ''; render();
    });

    render();
  }

  return { init: init };
})();
