window.App = window.App || {};
window.App.Calendar = (function () {
  var daysEl, myEl;
  var viewDate = new Date();
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function render() {
    var y = viewDate.getFullYear(), m = viewDate.getMonth();
    myEl.textContent = MONTHS[m] + ' ' + y;
    var fd = new Date(y, m, 1).getDay();
    var dim = new Date(y, m + 1, 0).getDate();
    var dip = new Date(y, m, 0).getDate();
    var t = new Date();
    var isThisMonth = (m === t.getMonth() && y === t.getFullYear());
    daysEl.innerHTML = '';
    for (var i = fd - 1; i >= 0; i--) {
      var d = document.createElement('div');
      d.className = 'cal-day other-month';
      d.textContent = dip - i;
      daysEl.appendChild(d);
    }
    for (var j = 1; j <= dim; j++) {
      var d2 = document.createElement('div');
      d2.className = 'cal-day';
      d2.textContent = j;
      if (isThisMonth && j === t.getDate()) d2.classList.add('today');
      daysEl.appendChild(d2);
    }
    var total = fd + dim, rem = (7 - (total % 7)) % 7;
    for (var k = 1; k <= rem; k++) {
      var d3 = document.createElement('div');
      d3.className = 'cal-day other-month';
      d3.textContent = k;
      daysEl.appendChild(d3);
    }
  }

  function init() {
    daysEl = document.getElementById('cal-days');
    myEl = document.getElementById('cal-month-year');
    var prevBtn = document.getElementById('cal-prev');
    var nextBtn = document.getElementById('cal-next');
    if (!daysEl || !myEl) return;
    if (prevBtn) prevBtn.addEventListener('click', function () { viewDate.setMonth(viewDate.getMonth() - 1); render(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { viewDate.setMonth(viewDate.getMonth() + 1); render(); });
    render();
  }

  return { init: init };
})();
