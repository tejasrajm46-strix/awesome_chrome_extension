window.App = window.App || {};
window.App.Clock = (function () {
  var timeEl, ampmEl, dateEl, greetEl;
  var timer = null;
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function getGreeting(h) {
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }

  function tick() {
    var now = new Date();
    var h = now.getHours();
    var m = String(now.getMinutes()).padStart(2, '0');
    var use24 = App.Storage.get('clock-format', '12') === '24';

    if (use24) {
      timeEl.textContent = String(h).padStart(2, '0') + ':' + m;
      ampmEl.textContent = '';
    } else {
      var h12 = h % 12 || 12;
      var ap = h < 12 ? 'AM' : 'PM';
      timeEl.textContent = h12 + ':' + m;
      ampmEl.textContent = ap;
    }

    dateEl.textContent = DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
    greetEl.textContent = getGreeting(h);
  }

  function init() {
    timeEl = document.getElementById('clock-time');
    ampmEl = document.getElementById('clock-ampm');
    dateEl = document.getElementById('clock-date');
    greetEl = document.getElementById('greeting');
    if (!timeEl || !dateEl || !greetEl) return;
    tick();
    // init() is re-run when Settings flips 12/24-hour, so the previous timer is
    // cleared first — otherwise every toggle leaves another interval ticking.
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  return { init: init };
})();
