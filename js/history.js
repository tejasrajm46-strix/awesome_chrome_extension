window.App = window.App || {};
window.App.History = (function () {
  var list, clearBtn;

  function timeSince(ts) {
    var diff = Date.now() - ts;
    if (diff < 120000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return Math.floor(diff / 86400000) + 'd';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function loadHistory() {
    if (typeof chrome !== 'undefined' && chrome.history) {
      chrome.history.search({ text: '', maxResults: 7, startTime: Date.now() - 86400000 * 3 }, function (res) {
        list.innerHTML = '';
        res.forEach(function (item) {
          var domain = '';
          try { domain = new URL(item.url).hostname.replace('www.', ''); } catch (e) {}
          var li = document.createElement('li');
          li.className = 'recent-item';
          li.innerHTML =
            '<img class="recent-favicon" src="https://www.google.com/s2/favicons?domain=' + domain + '&sz=32" alt="" onerror="this.style.display=\'none\'" />' +
            '<a href="' + esc(item.url) + '" title="' + esc(item.title || '') + '">' + esc(item.title || item.url) + '</a>' +
            '<span class="recent-time">' + timeSince(item.lastVisitTime) + '</span>';
          list.appendChild(li);
        });
        if (!res.length) list.innerHTML = '<li class="recent-empty">No recent history</li>';
      });
    } else {
      list.innerHTML = '<li class="recent-empty">History unavailable</li>';
    }
  }

  function init() {
    list = document.getElementById('recent-list');
    clearBtn = document.getElementById('recent-clear');
    if (!list) return;
    loadHistory();
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        list.innerHTML = '<li class="recent-empty">No recent history</li>';
      });
    }
  }

  return { init: init };
})();
