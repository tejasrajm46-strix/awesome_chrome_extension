window.App = window.App || {};
window.App.Background = (function () {
  var bgLayer, bgImage, bgVideo, statusEl, fileInput;

  function resetMedia() {
    try { bgVideo.pause(); } catch (e) {}
    bgImage.classList.add('hidden');
    bgVideo.classList.add('hidden');
    bgImage.removeAttribute('src');
    bgVideo.removeAttribute('src');
    try { bgImage.src = ''; bgVideo.src = ''; } catch (e) {}
    bgLayer.style.background = '';
  }

  function showDefault() {
    bgLayer.style.background = 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)';
  }

  function playVideo() {
    bgVideo.classList.remove('hidden');
    try {
      var pr = bgVideo.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
  }

  function apply(type, data, url) {
    resetMedia();
    try {
      if (type === 'image' && data) {
        if (typeof data === 'string' && data.length < 6000000) {
          bgImage.src = data;
          bgImage.classList.remove('hidden');
        } else {
          App.Storage.del('bg-data');
          App.Storage.set('bg-type', 'default');
          showDefault();
        }
      } else if (type === 'videoblob') {
        showDefault();
        App.IDB.get(App.BG_BLOB_KEY).then(function (blob) {
          if (blob) {
            try {
              bgVideo.src = URL.createObjectURL(blob);
              playVideo();
            } catch (e) {}
          }
        }).catch(function () {});
      } else if (type === 'url' && url) {
        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
          bgVideo.src = url;
          playVideo();
        } else {
          bgImage.src = url;
          bgImage.classList.remove('hidden');
        }
      } else {
        showDefault();
      }
    } catch (e) {
      showDefault();
    }
  }

  function load() {
    var type = App.Storage.get('bg-type', 'default');
    var data = App.Storage.get('bg-data', '');
    var url = App.Storage.get('bg-url', '');
    apply(type, data, url);
  }

  function setStatus(msg, isErr) {
    if (statusEl) {
      statusEl.textContent = msg || '';
      statusEl.style.color = isErr ? '#ff6b6b' : 'var(--text-dim)';
    }
  }

  function init() {
    bgLayer = document.getElementById('bg-layer');
    bgImage = document.getElementById('bg-image');
    bgVideo = document.getElementById('bg-video');
    statusEl = document.getElementById('bg-status');
    fileInput = document.getElementById('bg-file-input');
    var uploadBtn = document.getElementById('bg-upload-btn');
    var removeBtn = document.getElementById('bg-remove-btn');
    var resetBtn = document.getElementById('bg-reset-btn');

    if (!bgLayer || !bgImage || !bgVideo) return;

    load();

    if (uploadBtn) {
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var isVideo = (f.type || '').indexOf('video') === 0;

        if (!isVideo && f.size > 3 * 1024 * 1024) {
          setStatus('Image too large (' + (f.size / 1048576).toFixed(1) + 'MB). Use under 3MB.', true);
          fileInput.value = '';
          return;
        }

        if (isVideo) {
          setStatus('Saving video, please wait...');
          App.Storage.del('bg-data');
          App.Storage.del('bg-url');
          App.IDB.del(App.BG_BLOB_KEY).then(function () {
            return App.IDB.put(App.BG_BLOB_KEY, f);
          }).then(function () {
            App.Storage.set('bg-type', 'videoblob');
            setStatus('Video applied!');
            load();
          }).catch(function () {
            App.Storage.set('bg-type', 'default');
            setStatus('Could not save video. Try a smaller file.', true);
            load();
          });
        } else {
          var reader = new FileReader();
          reader.onerror = function () { setStatus('Could not read image.', true); };
          reader.onload = function (ev) {
            var ok = App.Storage.set('bg-data', ev.target.result);
            if (!ok) {
              setStatus('Image too large for browser storage.', true);
              fileInput.value = '';
              return;
            }
            App.Storage.del('bg-url');
            App.IDB.del(App.BG_BLOB_KEY);
            App.Storage.set('bg-type', 'image');
            setStatus('Image applied!');
            load();
          };
          reader.readAsDataURL(f);
        }
        fileInput.value = '';
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        App.Storage.del('bg-data');
        App.Storage.del('bg-url');
        App.IDB.del(App.BG_BLOB_KEY);
        App.Storage.set('bg-type', 'default');
        setStatus('Background removed.');
        load();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        App.Storage.del('bg-data');
        App.Storage.del('bg-url');
        App.IDB.del(App.BG_BLOB_KEY);
        App.Storage.set('bg-type', 'default');
        setStatus('Reset to default.');
        load();
      });
    }
  }

  return { init: init };
})();
