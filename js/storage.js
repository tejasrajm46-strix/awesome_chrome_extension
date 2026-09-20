window.App = window.App || {};
window.App.Storage = (function () {
  var PREFIX = 'ntd_';
  return {
    get: function (k, fallback) {
      try {
        var v = localStorage.getItem(PREFIX + k);
        return v !== null ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (k, v) {
      try {
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
        return true;
      } catch (e) {
        try { localStorage.removeItem(PREFIX + k); } catch (_) {}
        return false;
      }
    },
    del: function (k) {
      try { localStorage.removeItem(PREFIX + k); } catch (e) {}
    }
  };
})();

window.App.IDB = (function () {
  var DB = 'premium-newtab', STORE = 'blobs';
  function open() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  return {
    put: function (key, blob) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var tx = db.transaction(STORE, 'readwrite');
          var q = tx.objectStore(STORE).put(blob, key);
          q.onsuccess = function () { res(true); };
          q.onerror = function () { rej(q.error); };
        });
      });
    },
    get: function (key) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var tx = db.transaction(STORE, 'readonly');
          var q = tx.objectStore(STORE).get(key);
          q.onsuccess = function () { res(q.result || null); };
          q.onerror = function () { rej(q.error); };
        });
      });
    },
    del: function (key) {
      return open().then(function (db) {
        return new Promise(function (res) {
          var tx = db.transaction(STORE, 'readwrite');
          var q = tx.objectStore(STORE).delete(key);
          q.onsuccess = function () { res(true); };
          q.onerror = function () { res(false); };
        });
      }).catch(function () { return false; });
    }
  };
})();

window.App.BG_BLOB_KEY = 'bg-video-blob';
