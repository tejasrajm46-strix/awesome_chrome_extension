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

  document.addEventListener('DOMContentLoaded', function () {
    App.Background.init();
    App.Clock.init();
    App.Search.init();
    App.Bookmarks.init();
    App.Calendar.init();
    App.Todo.init();
    App.Notes.init();
    App.Reminders.init();
    App.History.init();
    App.Settings.init();
    initQuote();
    initOnboarding();
  });
})();
