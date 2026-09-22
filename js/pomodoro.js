window.App = window.App || {};
window.App.Pomodoro = (function () {
  var settings = {
    workMinutes: 25,
    breakMinutes: 5,
    sessionsUntilLongBreak: 4,
    longBreakMinutes: 15
  };

  var state = {
    isRunning: false,
    isWorkPhase: true,
    remainingTime: 25 * 60,
    totalSessions: 0,
    completedSessions: 0,
    intervalId: null,
    linkedTaskId: null
  };

  var displayEl, startBtn, stopBtn, resetBtn;
  var sessionDisplay, progressBar, phaseLabel;

  function formatTime(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function updateDisplay() {
    if (displayEl) {
      displayEl.textContent = formatTime(state.remainingTime);
      displayEl.style.color = state.isWorkPhase ? 'var(--accent)' : 'var(--success)';
    }
    if (progressBar) {
      var total = (state.isWorkPhase ? settings.workMinutes : (state.completedSessions === 0 && state.totalSessions > 0 ? settings.longBreakMinutes : settings.breakMinutes)) * 60;
      // Use workMinutes as denominator for work phase, breakMinutes for break
      var denom = state.isWorkPhase ? settings.workMinutes * 60 : (state.isWorkPhase ? settings.workMinutes * 60 : settings.breakMinutes * 60);
      // Simpler: progress based on elapsed
      var max = state.isWorkPhase ? settings.workMinutes * 60 : settings.breakMinutes * 60;
      // For long break, max is longBreakMinutes
      if (!state.isWorkPhase && state.completedSessions === 0 && state.totalSessions > 0) max = settings.longBreakMinutes * 60;
      var progress = 1 - state.remainingTime / max;
      progressBar.style.width = Math.max(0, Math.min(100, progress * 100)) + '%';
    }
    if (sessionDisplay) {
      sessionDisplay.textContent = 'Sessions: ' + state.totalSessions + (state.isWorkPhase ? ' \u2022 Work' : ' \u2022 Break');
    }
    if (phaseLabel) {
      phaseLabel.textContent = state.isWorkPhase ? 'Work' : 'Break';
    }
  }

  function notify(title, body) {
    try {
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icons/icon128.png',
          title: title,
          message: body
        });
      }
    } catch (e) {}
    // Fallback: audio beep via Web Audio if available
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      o.start(); o.stop(ctx.currentTime + 0.3);
    } catch (e2) {}
  }

  function startTimer() {
    if (state.isRunning) return;
    // Load linked task from storage if not already set
    if (state.linkedTaskId === null || state.linkedTaskId === undefined) {
      var stored = App.Storage.get('linked-task', null);
      if (stored !== null && stored !== undefined) state.linkedTaskId = stored;
    }

    if (state.intervalId) clearInterval(state.intervalId);
    state.isRunning = true;
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    if (resetBtn) resetBtn.disabled = false;

    state.intervalId = setInterval(function () {
      state.remainingTime--;
      updateDisplay();
      App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });

      if (state.remainingTime <= 0) {
        clearInterval(state.intervalId);
        state.intervalId = null;
        state.isRunning = false;
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;

        if (state.isWorkPhase) {
          // Work session complete - auto-complete linked task
          state.completedSessions++;
          notify('Work session complete!', 'Time for a break.');

          if (state.linkedTaskId !== null && state.linkedTaskId !== undefined) {
            var todos = App.Storage.get('todos', []);
            if (todos[state.linkedTaskId] && !todos[state.linkedTaskId].done) {
              todos[state.linkedTaskId].done = true;
              // Keep linked marker for visual feedback then clear
              todos[state.linkedTaskId].linkedPomodoro = false;
              App.Storage.set('todos', todos);
              if (window.App && window.App.Todo && typeof window.App.Todo.render === 'function') {
                try { window.App.Todo.render(); } catch (e) {}
              }
            }
            // Clear link after completion
            state.linkedTaskId = null;
            App.Storage.del('linked-task');
          }

          // Decide break length
          if (state.completedSessions >= settings.sessionsUntilLongBreak) {
            state.isWorkPhase = false;
            state.remainingTime = settings.longBreakMinutes * 60;
            state.totalSessions++;
            state.completedSessions = 0;
          } else {
            state.isWorkPhase = false;
            state.remainingTime = settings.breakMinutes * 60;
          }
          updateDisplay();
          App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });
        } else {
          // Break complete, start next work session (paused state, user must press Start)
          notify('Break over!', 'Ready for next work session.');
          state.isWorkPhase = true;
          state.totalSessions++;
          state.remainingTime = settings.workMinutes * 60;
          updateDisplay();
          App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.isRunning = false;
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });
  }

  function resetTimer() {
    stopTimer();
    state.remainingTime = settings.workMinutes * 60;
    state.isWorkPhase = true;
    // Do not reset totalSessions? Keep completed history but reset current cycle? Spec says reset all.
    state.completedSessions = 0;
    state.linkedTaskId = null;
    App.Storage.del('linked-task');
    updateDisplay();
    App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });
    if (progressBar) progressBar.style.width = '0%';
  }

  function init() {
    displayEl = document.getElementById('pomodoro-display');
    startBtn = document.getElementById('pomodoro-start');
    stopBtn = document.getElementById('pomodoro-stop');
    resetBtn = document.getElementById('pomodoro-reset');
    sessionDisplay = document.getElementById('pomodoro-sessions');
    progressBar = document.getElementById('pomodoro-progress');

    if (!displayEl) return;

    // Load settings from storage
    var saved = App.Storage.get('pomodoro-settings', null);
    if (saved && typeof saved === 'object') {
      if (typeof saved.workMinutes === 'number') settings.workMinutes = saved.workMinutes;
      if (typeof saved.breakMinutes === 'number') settings.breakMinutes = saved.breakMinutes;
      if (typeof saved.longBreakMinutes === 'number') settings.longBreakMinutes = saved.longBreakMinutes;
      if (typeof saved.sessionsUntilLongBreak === 'number') settings.sessionsUntilLongBreak = saved.sessionsUntilLongBreak;
    }

    var savedState = App.Storage.get('pomodoro-state', null);
    if (savedState && typeof savedState === 'object') {
      if (typeof savedState.remainingTime === 'number') state.remainingTime = savedState.remainingTime;
      if (typeof savedState.isWorkPhase === 'boolean') state.isWorkPhase = savedState.isWorkPhase;
      if (typeof savedState.totalSessions === 'number') state.totalSessions = savedState.totalSessions;
      if (typeof savedState.completedSessions === 'number') state.completedSessions = savedState.completedSessions;
      if (savedState.linkedTaskId !== undefined) state.linkedTaskId = savedState.linkedTaskId;
    } else {
      state.remainingTime = settings.workMinutes * 60;
    }

    // Also load standalone linked-task key for backward compat
    var legacyLink = App.Storage.get('linked-task', null);
    if (legacyLink !== null && state.linkedTaskId === null) state.linkedTaskId = legacyLink;

    updateDisplay();
    // Ensure progress bar starts correct
    if (progressBar) {
      var initialMax = state.isWorkPhase ? settings.workMinutes * 60 : settings.breakMinutes * 60;
      var prog = 1 - state.remainingTime / initialMax;
      progressBar.style.width = Math.max(0, Math.min(100, prog * 100)) + '%';
    }

    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.addEventListener('click', stopTimer);
    }
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);

    // Re-enable start button
    if (startBtn) startBtn.disabled = false;
  }

  function saveState() {
    App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });
    App.Storage.set('pomodoro-settings', settings);
    if (state.linkedTaskId !== null) App.Storage.set('linked-task', state.linkedTaskId);
  }

  function setSetting(key, value) {
    if (settings[key] !== undefined) {
      var num = parseInt(value, 10);
      if (!isNaN(num) && num > 0 && num < 180) {
        settings[key] = num;
        App.Storage.set('pomodoro-settings', settings);
        // If not running, update remaining time to reflect new duration for next session
        if (!state.isRunning && state.isWorkPhase && key === 'workMinutes') {
          state.remainingTime = settings.workMinutes * 60;
          updateDisplay();
        }
        if (!state.isRunning && !state.isWorkPhase && key === 'breakMinutes') {
          state.remainingTime = settings.breakMinutes * 60;
          updateDisplay();
        }
      }
    }
  }

  function linkTask(id) {
    var idx = parseInt(id, 10);
    if (isNaN(idx)) return;
    state.linkedTaskId = idx;
    App.Storage.set('linked-task', idx);
    App.Storage.set('pomodoro-state', { remainingTime: state.remainingTime, isWorkPhase: state.isWorkPhase, totalSessions: state.totalSessions, completedSessions: state.completedSessions, linkedTaskId: state.linkedTaskId });
  }

  return {
    init: init,
    saveState: saveState,
    setSetting: setSetting,
    getSettings: function () { return settings; },
    getState: function () { return state; },
    linkTask: linkTask,
    start: startTimer,
    stop: stopTimer,
    reset: resetTimer
  };
})();
