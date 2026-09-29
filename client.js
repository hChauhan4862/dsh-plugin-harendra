/**
 * dsh-plugin-harendra: one self-contained client module with four features.
 *
 * Focus timer  — `conversation.composer.dock`: a compact pill under the
 * composer card.
 * Water reminder — `sidebar.footer.action`: a bottle button beside Settings,
 * present on every screen whether or not a session is open; its confirmation
 * card lives in `shell.overlay`, the frame-wide floating layer, so the sidebar
 * can never clip it.
 * Sound alerts — a renderless watcher in `shell.overlay` plays a short tone,
 * never a desktop notification, when an unfocused tab would otherwise hide a
 * waiting question, a stopped run, or one of this plugin's own reminders.
 * Tab icon — a renderless watcher mirrors the same state into the favicon.
 *
 * Both timers run on absolute deadlines, so a throttled background tab, a page
 * reload, or a sleeping laptop cannot drift them. Every resource (locale
 * dictionaries, the ticker, the listeners, the slot registrations) is installed
 * inside `apply` and disposed with this module's fiber.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-harendra',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-plugin-harendra';
    const DOCK_SLOT = 'conversation.composer.dock';
    const SIDEBAR_SLOT = 'sidebar.footer.action';
    const OVERLAY_SLOT = 'shell.overlay';

    /** Kept under their original names so pre-existing state survives every refactor. */
    const POMODORO_KEY = 'dsh.pomodoro.state.v1';
    const WATER_KEY = 'dsh.water.state.v1';
    /** Alert-sound preference. 'always' so a fresh install is audible immediately. */
    const SOUND_KEY = 'dsh.sound.state.v1';
    const SOUND_MODES = ['always', 'away', 'off'];

    const TICK_MS = 250;
    const FLASH_MS = 6000;
    const LONG_BREAK_EVERY = 4;
    /** Pomodoro phase lengths in milliseconds. */
    const PHASES = { focus: 25 * 60 * 1000, short: 5 * 60 * 1000, long: 15 * 60 * 1000 };

    /** Hydration cadence: remind after 45 minutes, re-ask 5 minutes after "later". */
    const WATER_INTERVAL_MS = 45 * 60 * 1000;
    const WATER_SNOOZE_MS = 5 * 60 * 1000;
    const WATER_MINUTES = WATER_INTERVAL_MS / 60000;
    const WATER_SNOOZE_MINUTES = WATER_SNOOZE_MS / 60000;

    const DICTS = {
      en: {
        focus: 'Focus',
        short: 'Break',
        long: 'Long break',
        start: 'Start',
        pause: 'Pause',
        reset: 'Reset',
        skip: 'Skip',
        sessions: '{count} done',
        summary: '{phase}, {time} remaining',
        water: 'Water',
        waterShort: '{minutes}m',
        waterDue: 'Drink water',
        waterDueTitle: 'Time to drink water',
        waterDueBody: 'It has been {minutes} minutes since your last glass · {glasses} today',
        waterNextBody: 'Next reminder in {minutes} minutes · {glasses} today',
        waterDrank: 'I drank water',
        waterLater: 'In {minutes} min',
        waterClose: 'Close',
        soundHeading: 'Alert sound',
        soundButton: 'Alert sound: {mode}',
        soundAlways: 'Always',
        soundAlwaysHint: 'Every alert, focused or not',
        soundAway: 'Only when away',
        soundAwayHint: 'Only while this tab is not focused',
        soundOff: 'Muted',
        soundOffHint: 'No sound at all',
        peakPanel: 'Pricing clock',
        peakLoading: 'Rate now',
        peakPeak: 'Peak rate',
        peakOff: 'Off-peak rate',
        peakNext: 'Next change in {time}',
        peakNextLabel: 'Next change',
        peakNextNone: 'No change within two weeks',
        peakHours: 'Peak hours',
        peakDaysLabel: 'Days',
        peakDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
        peakEveryDay: 'Every day',
        peakWeekdays: 'Monday to Friday',
        peakHolidayNext: 'Next holiday',
        peakDuration: '{h}h {m}m',
        peakDurationMinutes: '{m}m',
        peakDurationDays: '{d}d {h}h',
        peakUpdated: 'Updated {date}',
        peakChooseModel: 'Change model',
        peakDone: 'Done',
        peakLive: 'live',
        peakCache: 'cached',
        peakBundled: 'offline',
        settingsTitle: 'Harendra plugin',
        settingsSubtitle: 'Features',
        featurePomodoro: 'Focus timer',
        featureWater: 'Water reminder',
        featureSound: 'Sound alerts',
        featureFavicon: 'Tab favicon',
        featurePricing: 'Pricing clock',
        featureOn: 'On',
        featureOff: 'Off',
      },
      zh: {
        focus: '专注',
        short: '休息',
        long: '长休息',
        start: '开始',
        pause: '暂停',
        reset: '重置',
        skip: '跳过',
        sessions: '已完成 {count} 个',
        summary: '{phase}，剩余 {time}',
        water: '喝水',
        waterShort: '{minutes} 分钟',
        waterDue: '该喝水了',
        waterDueTitle: '该喝水了',
        waterDueBody: '距离上次喝水已 {minutes} 分钟 · 今天 {glasses} 杯',
        waterNextBody: '距离下次提醒还有 {minutes} 分钟 · 今天 {glasses} 杯',
        waterDrank: '我喝了',
        waterLater: '{minutes} 分钟后',
        waterClose: '关闭',
        soundHeading: '提示音',
        soundButton: '提示音：{mode}',
        soundAlways: '始终播放',
        soundAlwaysHint: '无论是否在前台都播放',
        soundAway: '仅在离开时',
        soundAwayHint: '仅当标签页不在前台时播放',
        soundOff: '静音',
        soundOffHint: '完全不播放',
        peakPanel: '费率时钟',
        peakLoading: '当前费率',
        peakPeak: '高峰费率',
        peakOff: '低谷费率',
        peakNext: '{time} 后切换',
        peakNextLabel: '下次切换',
        peakNextNone: '两周内无变化',
        peakHours: '高峰时段',
        peakDaysLabel: '日期',
        peakDays: '周日,周一,周二,周三,周四,周五,周六',
        peakEveryDay: '每天',
        peakWeekdays: '周一至周五',
        peakHolidayNext: '下个节假日',
        peakDuration: '{h} 小时 {m} 分',
        peakDurationMinutes: '{m} 分钟',
        peakDurationDays: '{d} 天 {h} 小时',
        peakUpdated: '更新于 {date}',
        peakChooseModel: '切换模型',
        peakDone: '完成',
        peakLive: '在线',
        peakCache: '缓存',
        peakBundled: '离线',
        settingsTitle: 'Harendra 插件',
        settingsSubtitle: '功能开关',
        featurePomodoro: '专注计时',
        featureWater: '喝水提醒',
        featureSound: '提示音',
        featureFavicon: '标签页图标',
        featurePricing: '费率时钟',
        featureOn: '开',
        featureOff: '关',
      },
    };

    // ---------------------------------------------------------------- shared

    /** Local calendar day, used to reset the glass count. */
    function today() {
      const date = new Date();
      return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    }

    function readStored(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    function writeStored(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // No durable storage: both timers still run correctly for this page.
      }
    }

    function useStore(store) {
      const [, forceRender] = React.useState(0);
      React.useEffect(() => {
        const unsubscribe = store.subscribe(() => forceRender((n) => n + 1));
        // Resync in case the store changed between render and effect.
        forceRender((n) => n + 1);
        return unsubscribe;
      }, [store]);
      return store.getSnapshot();
    }

    // ---------------------------------------------------------- sound alerts

    /** Focused means the tab is visible AND its window has focus; anything else is "away". */
    function isTabFocused() {
      return document.visibilityState === 'visible' && document.hasFocus() === true;
    }

    /**
     * Alert tones: [offset seconds, frequency Hz, peak gain]. The plugin plays
     * these itself and never raises a desktop notification, so nothing here
     * depends on a browser or OS notification permission.
     */
    /**
     * Four tones that differ in register, waveform, rhythm AND envelope — pitch
     * order alone was too subtle to tell apart at a glance.
     */
    const TONES = {
      /** Question or approval: a high, urgent triangle trill, repeated twice. */
      alert: { wave: 'triangle', decay: 0.20, notes: [[0, 1319, 0.9], [0.11, 1760, 0.92], [0.22, 1319, 0.9], [0.33, 1760, 0.92], [0.62, 1319, 0.9], [0.73, 1760, 0.92], [0.84, 1319, 0.9], [0.95, 1760, 0.92]] },
      /** Run completed: one slow, warm rise low in the range — soft and final. */
      done: { wave: 'sine', decay: 0.45, notes: [[0, 587, 0.9], [0.24, 784, 0.95]] },
      /** The user stopped a turn: a short low double thud, like a door closing. */
      interrupted: { wave: 'triangle', decay: 0.16, notes: [[0, 330, 1], [0.14, 220, 1]] },
      /** A timer reminder: two mid blips, quieter than the rest. */
      reminder: { wave: 'sine', decay: 0.26, notes: [[0, 880, 0.72], [0.16, 1175, 0.76]] },
    };

    /**
     * Sound-only alerts for what a backgrounded tab would otherwise hide: a
     * question or approval waiting, a run that stopped, and this plugin's own
     * reminders. The Harness ships no client event for those states, so the
     * session signals come from the status/list hooks and are diffed here, which
     * also means a remount of the watcher never re-sounds something already
     * played.
     *
     * Everything is gated on the tab not being focused: while you are looking at
     * the screen the UI already shows these states, and a beep would be noise.
     */
    function createAlerter() {
      const announcedComplete = new Set();
      /** Last running state per session, so a stop can be detected directly. */
      const previouslyRunning = new Map();
      /** Things that still need you, held until resolved. */
      const attention = new Map();
      /** When a session's turn was stopped by the user, so it does not also chime. */
      const interruptedAt = new Map();
      /** How often an unanswered question sounds again, and its ticker. */
      const REPEAT_MS = 20000;
      let repeater = null;
      const listeners = new Set();
      const saved = readStored(SOUND_KEY);
      let mode = saved && SOUND_MODES.includes(saved.mode) ? saved.mode : 'always';
      let menuOpen = false;
      let audio = null;

      const notify = () => {
        for (const listener of [...listeners]) listener();
      };

      /** Whether a tone may play right now: the preference first, then focus. */
      const audible = () => {
        if (mode === 'off') return false;
        if (mode === 'away') return !isTabFocused();
        return true;
      };

      /** A tone requested while the context could not play yet. */
      let queued = null;

      /** Play a queued tone once the context is actually running. */
      const flushQueued = () => {
        if (queued === null || audio === null || audio.state !== 'running') return;
        const item = queued;
        queued = null;
        if (Date.now() - item.at <= 30000) emit(item.kind);
      };

      /**
       * Create/resume the audio context from a gesture. Sound may only start after
       * user activation, and a context created without it stays suspended — so this
       * runs on every gesture rather than only the first, and a tone requested in
       * the meantime waits here instead of disappearing.
       */
      const unlock = () => {
        try {
          const Ctor = window.AudioContext || window.webkitAudioContext;
          if (typeof Ctor !== 'function') return;
          if (audio === null) {
            audio = new Ctor();
            audio.onstatechange = () => flushQueued();
            busyUntil = 0;
          }
          if (audio.state !== 'running') {
            const resumed = audio.resume();
            if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
          }
        } catch (error) {
          audio = null;
        }
        flushQueued();
      };

      /** End of the last scheduled tone, so two events can never overlap. */
      let busyUntil = 0;

      /** Schedule one alert tone on the audio context. */
      const emit = (kind) => {
        if (audio === null) return;
        try {
          const tone = TONES[kind] || TONES.reminder;
          const notes = Array.isArray(tone.notes) ? tone.notes : TONES.reminder.notes;
          const decay = typeof tone.decay === 'number' ? tone.decay : 0.34;
          // Tones queue up instead of stacking. Overlap is the only thing that
          // could clip, and the limiter that would fix it costs several dB on
          // every note — a worse trade than waiting a beat.
          const destination = audio.destination;
          const start = Math.max(audio.currentTime, busyUntil);
          for (const [offset, frequency, peak] of notes) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = tone.wave || 'sine';
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(peak, start + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + decay);
            oscillator.connect(gain).connect(destination);
            oscillator.start(start + offset);
            oscillator.stop(start + offset + decay + 0.02);
          }
          const last = notes[notes.length - 1];
          busyUntil = start + last[0] + decay + 0.02;
        } catch (error) {
          // A failed tone must never disturb the page.
        }
      };

      /**
       * Play a tone, waiting for a suspended context to resume first. Scheduling
       * onto a context that is still suspended is one way a tone silently
       * disappears even though a gesture has already happened.
       */
      const play = (kind) => {
        if (audio !== null && audio.state === 'running') {
          emit(kind);
          return;
        }
        // No context, or one still suspended: hold the tone and release it through
        // the next gesture or state change rather than dropping it silently.
        queued = { kind, at: Date.now() };
        unlock();
      };

      /** A completion tone waiting just long enough to learn it was a stop. */
      let donePending = null;
      const scheduleDone = (sessionId) => {
        cancelDone(sessionId);
        const handle = window.setTimeout(() => {
          donePending = null;
          alert('done');
        }, 350);
        donePending = { sessionId, handle };
      };
      const cancelDone = (sessionId) => {
        if (donePending === null || (sessionId !== undefined && donePending.sessionId !== sessionId)) return;
        window.clearTimeout(donePending.handle);
        donePending = null;
      };

      /** One event, played as the preference allows. */
      const alert = (kind) => {
        if (!audible()) return false;
        play(kind || 'reminder');
        return true;
      };

      /** Sound everything held that has not sounded yet, as the preference allows. */
      const flush = () => {
        if (!audible()) return 0;
        let undelivered = 0;
        let loudest = 'reminder';
        for (const item of attention.values()) {
          if (item.sounded) continue;
          undelivered += 1;
          if (item.kind === 'alert') loudest = 'alert';
        }
        if (undelivered === 0) return 0;
        const now = Date.now();
        for (const item of attention.values()) {
          if (item.sounded) continue;
          item.sounded = true;
          item.soundedAt = now;
        }
        play(loudest);
        return undelivered;
      };

      /**
       * Hold (or refresh) something that needs the user. It stays held until
       * resolved, so a request that appears while the tab is focused still sounds
       * the moment the user steps away rather than being lost.
       */
      const hold = (key, kind, identity, repeat) => {
        const existing = attention.get(key);
        const same = existing !== undefined && existing.identity === identity;
        attention.set(key, {
          kind,
          identity,
          repeat: repeat === true,
          sounded: same ? existing.sounded : false,
          soundedAt: same ? existing.soundedAt : undefined,
        });
        if (repeat === true) ensureRepeater();
        flush();
      };

      const clear = (key) => {
        attention.delete(key);
      };

      /**
       * A blocking question keeps sounding until it is answered: one trill is easy
       * to miss entirely, and the moment the interaction disappears the map empties
       * and the ticker retires itself.
       */
      const ensureRepeater = () => {
        if (repeater !== null) return;
        repeater = window.setInterval(() => {
          let pending = false;
          for (const item of attention.values()) {
            if (item.repeat !== true) continue;
            pending = true;
            // A repeat obeys the same preference as the first sound.
            if (!audible()) continue;
            play(item.kind);
            item.sounded = true;
            item.soundedAt = Date.now();
          }
          if (!pending) stopRepeater();
        }, REPEAT_MS);
      };

      const stopRepeater = () => {
        if (repeater === null) return;
        window.clearInterval(repeater);
        repeater = null;
      };

      /** Back for a while? Let something unresolved sound again when you next leave. */
      const rearm = () => {
        const now = Date.now();
        for (const item of attention.values()) {
          if (item.sounded && item.soundedAt !== undefined && now - item.soundedAt > 60000) {
            item.sounded = false;
            item.soundedAt = undefined;
          }
        }
      };

      return {
        getSnapshot: () => ({ mode, menuOpen, ready: audio !== null, focused: isTabFocused() }),
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        openMenu() {
          menuOpen = true;
          unlock();
          notify();
        },
        closeMenu() {
          if (!menuOpen) return;
          menuOpen = false;
          notify();
        },
        /** Choose a mode explicitly; the click is also the gesture that permits sound. */
        setMode(next) {
          if (!SOUND_MODES.includes(next)) return;
          mode = next;
          menuOpen = false;
          writeStored(SOUND_KEY, { mode });
          unlock();
          if (mode !== 'off') play(mode === 'always' ? 'alert' : 'reminder');
          notify();
        },
        unlock,
        alert,
        /** Drop timers so a replaced module leaves nothing sounding behind. */
        dispose() {
          stopRepeater();
          cancelDone();
        },
        /**
         * Forget everything observed so far: used when the sound feature is switched
         * back on, so a stop that happened while it was off never replays.
         */
        resetTracking() {
          previouslyRunning.clear();
          announcedComplete.clear();
          interruptedAt.clear();
          attention.clear();
          stopRepeater();
          cancelDone();
        },
        /** Leaving the tab sounds what waits; coming back re-arms it. */
        watchFocus() {
          const onBlur = () => {
            if (!isTabFocused()) flush();
          };
          const onFocus = () => rearm();
          window.addEventListener('blur', onBlur);
          window.addEventListener('focus', onFocus);
          document.addEventListener('visibilitychange', onBlur);
          return () => {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onBlur);
          };
        },
        /** A question, plan review, or approval is waiting in some session. */
        sessions(statuses, summaries) {
          if (statuses == null || typeof statuses.forEach !== 'function') return;
          statuses.forEach((status, sessionId) => {
            if (status == null) return;
            const summary = summaries ? summaries[sessionId] : undefined;
            // Delegated work: a finishing subagent or teammate stays quiet.
            if (summary && (summary.origin === 'subagent' || summary.parentId != null)) return;

            const pending = status.pendingInteraction;
            const pendingKey = pending && pending.key ? pending.key : null;
            if (pendingKey === null) clear('ask:' + sessionId);
            else hold('ask:' + sessionId, 'alert', pendingKey, true);

            // A stop is signalled by the running state going false. The client's
            // `completionUnread` flag cannot serve here: it is only set for a stop
            // OUTSIDE the main view, so a run ending in the session you have open
            // would never sound — which is exactly the case that was missed.
            const wasRunning = previouslyRunning.get(sessionId);
            previouslyRunning.set(sessionId, status.running);
            if (status.running === true) {
              // Re-arm: the next stop is a new event.
              announcedComplete.delete(sessionId);
            } else if ((wasRunning === true || status.completionUnread === true) && !announcedComplete.has(sessionId)) {
              announcedComplete.add(sessionId);
              const stopped = interruptedAt.get(sessionId);
              // The interrupted tone already covered this stop; two sounds for one
              // event would be noise, so only an uninterrupted stop chimes. The
              // short delay lets the stop marker win the race when it lands later.
              if (stopped !== undefined && Date.now() - stopped < 15000) interruptedAt.delete(sessionId);
              else scheduleDone(sessionId);
            }
          });
        },
        /** A turn the user stopped: its own tone, and no completion chime after it. */
        interrupt(sessionId) {
          if (typeof sessionId === 'string') interruptedAt.set(sessionId, Date.now());
          cancelDone(sessionId);
          if (!audible()) return false;
          play('interrupted');
          return true;
        },
        /** The water reminder is held while it is due, so stepping away sounds it. */
        water(due, nextDueAt) {
          if (due !== true) {
            clear('water');
            return;
          }
          hold('water', 'reminder', String(nextDueAt));
        },
      };
    }

    // --------------------------------------------------------------- pomodoro

    const durationOf = (phase) => PHASES[phase] || PHASES.focus;
    const isPhase = (value) => value === 'focus' || value === 'short' || value === 'long';

    /** The phase that follows `phase`, given how many focus blocks are done. */
    function followingPhase(phase, completed) {
      if (phase !== 'focus') return 'focus';
      return completed % LONG_BREAK_EVERY === 0 ? 'long' : 'short';
    }

    /** Restore across reloads; an expired deadline advances exactly once. */
    function restorePomodoro() {
      const saved = readStored(POMODORO_KEY);
      if (!saved || !isPhase(saved.phase)) return null;
      const completed = Number.isFinite(saved.completed) && saved.completed > 0 ? Math.floor(saved.completed) : 0;

      if (saved.running && Number.isFinite(saved.endAt)) {
        const remaining = saved.endAt - Date.now();
        if (remaining > 0) {
          return { phase: saved.phase, running: true, remainingMs: remaining, endAt: saved.endAt, completed, finished: false };
        }
        const done = saved.phase === 'focus' ? completed + 1 : completed;
        const phase = followingPhase(saved.phase, done);
        return { phase, running: false, remainingMs: durationOf(phase), endAt: null, completed: done, finished: true };
      }

      const remaining = Number.isFinite(saved.remainingMs) && saved.remainingMs > 0 ? saved.remainingMs : durationOf(saved.phase);
      return { phase: saved.phase, running: false, remainingMs: remaining, endAt: null, completed, finished: false };
    }

    function createPomodoroStore(alerter) {
      const initial = restorePomodoro();
      const idle = () => ({ seq: 0, from: null, to: null, reason: null });
      let state = initial
        ? {
            phase: initial.phase,
            running: initial.running,
            remainingMs: initial.remainingMs,
            endAt: initial.endAt,
            completed: initial.completed,
            flashUntil: initial.finished ? Date.now() + FLASH_MS : 0,
            transition: idle(),
          }
        : {
            phase: 'focus',
            running: false,
            remainingMs: durationOf('focus'),
            endAt: null,
            completed: 0,
            flashUntil: 0,
            transition: idle(),
          };
      const listeners = new Set();

      const persist = () => writeStored(POMODORO_KEY, {
        phase: state.phase,
        running: state.running,
        remainingMs: state.remainingMs,
        endAt: state.endAt,
        completed: state.completed,
      });
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };
      const commit = (next) => {
        state = next;
        persist();
        notify();
      };

      const store = {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        start() {
          if (state.running) return;
          const remaining = state.remainingMs > 0 ? state.remainingMs : durationOf(state.phase);
          commit({ ...state, running: true, remainingMs: remaining, endAt: Date.now() + remaining, flashUntil: 0 });
        },
        pause() {
          if (!state.running || state.endAt == null) return;
          commit({ ...state, running: false, remainingMs: Math.max(0, state.endAt - Date.now()), endAt: null, flashUntil: 0 });
        },
        reset() {
          commit({ ...state, running: false, endAt: null, remainingMs: durationOf(state.phase), flashUntil: 0 });
        },
        /** End the current phase now; a finished focus block starts its break. */
        skip() {
          store.advance(state.phase === 'focus', 'manual');
        },
        advance(autoStart, reason) {
          const done = state.phase === 'focus' ? state.completed + 1 : state.completed;
          const phase = followingPhase(state.phase, done);
          const total = durationOf(phase);
          const transition = { seq: state.transition.seq + 1, from: state.phase, to: phase, reason: reason || 'auto' };
          commit({
            phase,
            running: autoStart,
            remainingMs: total,
            endAt: autoStart ? Date.now() + total : null,
            completed: done,
            flashUntil: Date.now() + FLASH_MS,
            transition,
          });
          if (transition.reason !== 'auto') return;
          // A phase that ended by itself is worth sounding for an unfocused user.
          alerter.alert(transition.from === 'focus' ? 'done' : 'reminder');
        },
        tick() {
          if (state.flashUntil !== 0 && Date.now() >= state.flashUntil) {
            state = { ...state, flashUntil: 0 };
            notify();
          }
          if (!state.running || state.endAt == null) return;
          const remaining = state.endAt - Date.now();
          if (remaining <= 0) {
            store.advance(state.phase === 'focus', 'auto');
            return;
          }
          if (Math.ceil(remaining / 1000) === Math.ceil(state.remainingMs / 1000)) return;
          state = { ...state, remainingMs: remaining };
          notify();
        },
      };
      return store;
    }

    function formatClock(totalSeconds) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }

    // ------------------------------------------------------------------ water

    /** Restore the cycle; an overdue deadline is already due when the page opens. */
    function restoreWater() {
      const now = Date.now();
      const day = today();
      const saved = readStored(WATER_KEY);
      if (!saved || !Number.isFinite(saved.nextDueAt)) {
        return { lastDrinkAt: now, nextDueAt: now + WATER_INTERVAL_MS, remainingMs: WATER_INTERVAL_MS, glasses: 0, day, due: false, manualOpen: false };
      }
      const glasses = Number.isFinite(saved.glasses) && saved.glasses > 0 ? Math.floor(saved.glasses) : 0;
      const nextDueAt = saved.nextDueAt;
      const remainingMs = Math.max(0, nextDueAt - now);
      return {
        lastDrinkAt: Number.isFinite(saved.lastDrinkAt) ? saved.lastDrinkAt : now,
        nextDueAt,
        remainingMs,
        glasses: saved.day === day ? glasses : 0,
        day,
        due: remainingMs === 0,
        manualOpen: false,
      };
    }

    function createWaterStore() {
      let state = restoreWater();
      const listeners = new Set();

      const persist = () => writeStored(WATER_KEY, {
        lastDrinkAt: state.lastDrinkAt,
        nextDueAt: state.nextDueAt,
        glasses: state.glasses,
        day: state.day,
      });
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };
      const commit = (next) => {
        state = next;
        persist();
        notify();
      };

      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        /** Confirmed: record the glass and start the next interval. */
        drink() {
          const now = Date.now();
          const day = today();
          commit({
            ...state,
            lastDrinkAt: now,
            nextDueAt: now + WATER_INTERVAL_MS,
            remainingMs: WATER_INTERVAL_MS,
            glasses: (state.day === day ? state.glasses : 0) + 1,
            day,
            due: false,
            manualOpen: false,
          });
        },
        /** Not now: re-ask shortly instead of restarting the full interval. */
        later() {
          const now = Date.now();
          commit({ ...state, nextDueAt: now + WATER_SNOOZE_MS, remainingMs: WATER_SNOOZE_MS, due: false, manualOpen: false });
        },
        /** Open the card from the bottle to check the countdown. */
        open() {
          const remainingMs = Math.max(0, state.nextDueAt - Date.now());
          commit({ ...state, remainingMs, due: remainingMs === 0, manualOpen: true });
        },
        close() {
          commit({ ...state, manualOpen: false });
        },
        tick() {
          const now = Date.now();
          const remainingMs = Math.max(0, state.nextDueAt - now);
          const due = remainingMs === 0;
          const day = today();
          const rolled = state.day !== day;
          const minuteChanged = Math.ceil(remainingMs / 60000) !== Math.ceil(state.remainingMs / 60000);
          if (due === state.due && !minuteChanged && !rolled) return;
          state = { ...state, remainingMs, due, day, glasses: rolled ? 0 : state.glasses };
          if (rolled) persist();
          notify();
        },
      };
    }

    // ------------------------------------------------------------------ icons

    const svg = (children, size) => h('svg', {
      width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false,
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    }, children);

    const tomatoIcon = () => h('svg', {
      width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false,
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
    }, h('circle', { cx: 8, cy: 9.3, r: 5.1, fill: 'currentColor', stroke: 'none' }),
      h('path', { d: 'M8 4.3V2.4M8 4.3 5.9 3.1M8 4.3l2.1-1.2' }));
    const playIcon = () => svg(h('path', { d: 'M5.6 3.4 12 8l-6.4 4.6z', fill: 'currentColor', stroke: 'none' }), 12);
    const pauseIcon = () => svg(h('path', { d: 'M6.2 4.1v7.8M9.8 4.1v7.8' }), 12);
    const resetIcon = () => svg(h('path', { d: 'M3.6 8a4.4 4.4 0 1 0 1.4-3.2M3.3 3.4v3.1h3.1' }), 12);
    const skipIcon = () => svg(h('path', { d: 'M4.2 3.9 9.8 8l-5.6 4.1z', fill: 'currentColor', stroke: 'none' }), 12);

    /** Bottle outline: the water level rises as the next reminder approaches. */
    const BOTTLE_BODY = 'M6.4 3.3h3.2v1.1c0 .5.2.9.6 1.3.9.8 1.4 1.9 1.4 3.1v4.3c0 .9-.7 1.6-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6V8.8c0-1.2.5-2.3 1.4-3.1.4-.4.6-.8.6-1.3V3.3Z';
    const FILL_TOP = 3.4;
    const FILL_BOTTOM = 13.4;

    function bottleIcon(level) {
      const clamped = Math.min(1, Math.max(0, level));
      const top = FILL_BOTTOM - clamped * (FILL_BOTTOM - FILL_TOP);
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('defs', null, h('clipPath', { id: 'hp-bottle-clip' }, h('path', { d: BOTTLE_BODY }))),
        h('g', { clipPath: 'url(#hp-bottle-clip)' },
          h('rect', { x: 3, y: top, width: 10, height: Math.max(0, FILL_BOTTOM - top), className: 'hp-water' })),
        h('path', { d: BOTTLE_BODY, className: 'hp-outline' }),
        h('rect', { x: 6.4, y: 1.6, width: 3.2, height: 1.7, rx: 0.6, className: 'hp-cap' }));
    }

    /** Speaker glyph: two waves for "always", one wave + dot for "only when away", a cross for muted. */
    const speakerIcon = (mode) => h('svg', {
      width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false,
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
    },
      h('path', { d: 'M3 6.3h2.1l3.1-2.6v8.6L5.1 9.7H3z' }),
      mode === 'off'
        ? h('path', { d: 'M10.7 6.4l3 3.2M13.7 6.4l-3 3.2' })
        : mode === 'away'
          ? h('path', { d: 'M10.9 6.3a2.7 2.7 0 0 1 0 3.4' })
          : h('path', { d: 'M10.7 5.6a3.7 3.7 0 0 1 0 4.8M12.4 4.2a6 6 0 0 1 0 7.6' }),
      mode === 'away' ? h('circle', { cx: 13.6, cy: 4.5, r: 1.7, className: 'hp-sound-dot' }) : null);

    // ----------------------------------------------------------------- styles

    const POMODORO_CSS = [
      '.hp-root{display:flex;justify-content:center;padding:2px 0}',
      '.hp-pill{display:inline-flex;align-items:center;gap:8px;padding:3px 6px 3px 10px;',
      'border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);',
      'color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;',
      'user-select:none;transition:border-color 200ms ease}',
      '.hp-pill[data-phase="focus"] .hp-tomato{color:var(--dsw-alias-brand-primary)}',
      '.hp-pill[data-phase="short"] .hp-tomato,.hp-pill[data-phase="long"] .hp-tomato{color:var(--dsw-alias-state-success-primary)}',
      '.hp-tomato{display:inline-flex;align-items:center}',
      '.hp-phase{color:var(--dsw-alias-label-secondary)}',
      '.hp-time{font-weight:600;min-width:42px;text-align:center;letter-spacing:.02em}',
      '.hp-track{position:relative;width:48px;height:3px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}',
      '.hp-fill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width 250ms linear}',
      '.hp-pill[data-phase="short"] .hp-fill,.hp-pill[data-phase="long"] .hp-fill{background:var(--dsw-alias-state-success-primary)}',
      '.hp-count{color:var(--dsw-alias-label-secondary);font-size:11px;min-width:46px;text-align:right}',
      '.hp-btn-sm{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;',
      'border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color 150ms ease,color 150ms ease}',
      '.hp-btn-sm:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.hp-btn-sm:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '@keyframes hp-flash{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 3px var(--dsw-alias-state-success-primary)}}',
      '.hp-pill[data-done="1"]{animation:hp-flash 900ms ease-in-out 5}',
      '@media (prefers-reduced-motion: reduce){.hp-pill[data-done="1"]{animation:none}.hp-fill{transition:none}}',
    ].join('');

    /** Styles shared by the two sidebar-foot controls (the bottle and the bell). */
    const CONTROL_CSS = [
      '.hp-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;',
      'border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;',
      'transition:background-color 150ms ease,color 150ms ease}',
      '.hp-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.hp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.hp-btn[data-due="1"]{color:var(--dsw-alias-state-warn-primary)}',
      '.hp-icon{display:inline-flex}',
      '.hp-dot{position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);animation:hp-pulse 1.6s ease-in-out infinite}',
      '@keyframes hp-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.6}}',
      '@media (prefers-reduced-motion: reduce){.hp-dot{animation:none}}',
    ].join('');

    const WATER_CSS = [
      '.hp-outline{fill:none;stroke:currentColor;stroke-width:1.2;stroke-linejoin:round}',
      '.hp-cap{fill:currentColor;opacity:.8}',
      '.hp-water{fill:var(--dsw-alias-brand-primary)}',
      '.hp-btn[data-due="1"] .hp-water{fill:var(--dsw-alias-state-warn-primary)}',
      '.hp-layer{position:fixed;left:16px;bottom:72px;z-index:30;pointer-events:none}',
      '.hp-card{pointer-events:auto;box-sizing:border-box;width:264px;padding:12px;border-radius:12px;',
      'border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);',
      'font-size:13px;line-height:18px;box-shadow:0 6px 20px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent)}',
      '.hp-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '.hp-title{font-weight:600}',
      '.hp-body{margin:0 0 10px;color:var(--dsw-alias-label-secondary)}',
      '.hp-actions{display:flex;gap:8px}',
      '.hp-accept,.hp-later{padding:6px 10px;border-radius:8px;font-size:12px;line-height:16px;cursor:pointer;',
      'background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);',
      'transition:background-color 150ms ease}',
      '.hp-accept{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.hp-later{margin-left:auto}',
      '.hp-accept:hover,.hp-later:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.hp-accept:focus-visible,.hp-later:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
    ].join('');

    /** The sound control and the mode menu it opens. */
    const SOUND_CSS = [
      '.hp-btn[data-sound="off"]{color:var(--dsw-alias-state-idle-primary)}',
      '.hp-btn[data-open="1"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.hp-sound-dot{fill:var(--dsw-alias-brand-primary);stroke:none}',
      '.hp-layer.hp-sound-layer{position:fixed;left:16px;bottom:72px;z-index:34}',
      '.hp-menu{pointer-events:auto;box-sizing:border-box;width:252px;padding:8px;border-radius:12px;',
      'border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);',
      'font-size:13px;line-height:18px;box-shadow:0 6px 20px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent)}',
      '.hp-menu-title{padding:2px 8px 8px;color:var(--dsw-alias-label-secondary);font-size:11px;',
      'text-transform:uppercase;letter-spacing:.04em}',
      '.hp-menu-row{display:grid;grid-template-columns:14px 1fr;column-gap:8px;align-items:center;width:100%;',
      'padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);',
      'font:inherit;text-align:left;cursor:pointer}',
      '.hp-menu-row:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.hp-menu-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.hp-menu-row[data-active="1"] .hp-menu-label{color:var(--dsw-alias-brand-primary)}',
      '.hp-menu-check{grid-row:span 2;color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.hp-menu-label{font-weight:600}',
      '.hp-menu-hint{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:14px}',
    ].join('');

    // ----------------------------------------------------------------- favicon

    const BUSY_FRAMES = 10;
    const BUSY_FRAME_MS = 120;

    /**
     * One frame of the tab icon: the DeepSeek mark on a state-coloured disc. A
     * filled disc with a white mark reads at 16px, where a thin ring around the
     * dark glyph did not.
     * @param mark - data URL of the white DeepSeek mark.
     * @param kind - 'busy' | 'waiting' | 'stopped'.
     * @param frame - rotation step for the busy arc.
     */
    function faviconSvg(mark, kind, frame) {
      const disc = kind === 'busy' ? '#4d6bfe' : kind === 'waiting' ? '#f6c344' : '#8a919e';
      const arc = kind === 'busy'
        ? '<g transform="rotate(' + ((frame * 360) / BUSY_FRAMES) + ' 25 25)">'
          + '<circle cx="25" cy="25" r="20.5" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-dasharray="26 103"/></g>'
        : '';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">'
        + '<circle cx="25" cy="25" r="24" fill="' + disc + '"/>'
        + '<image x="12" y="12" width="26" height="26" href="' + mark + '"/>'
        + arc + '</svg>';
    }

    /**
     * The session state, mirrored into the tab icon: a spinning arc while any
     * session works, an amber disc while a question or approval waits for you, and
     * a grey disc when nothing is in flight.
     *
     * A favicon has no slot, so this rewrites the page's own `<link rel="icon">`
     * elements and restores their original hrefs when the plugin unloads. The mark
     * comes from the page's own favicon file, so the indicator stays on-brand
     * rather than approximating the logo.
     *
     * The arc is driven from a Worker because a hidden tab clamps page timers to
     * roughly one tick per second — which is exactly what made it stall and then
     * jump in the background. A worker keeps its own clock; if the environment
     * refuses one (CSP, no Blob), it falls back to a page interval.
     */
    function createFavicon() {
      const links = [...document.querySelectorAll('link[rel~="icon"]')];
      const original = links.map((node) => node.getAttribute('href'));
      const cache = new Map();
      let mark = null;
      let wanted = 'stopped';
      let applied = null;
      let interval = null;
      let worker = null;
      let workerUrl = null;
      let frame = 0;

      const paint = (kind, index) => {
        if (mark === null || links.length === 0) return;
        const tag = kind + ':' + index;
        if (tag === applied) return;
        applied = tag;
        let url = cache.get(tag);
        if (url === undefined) {
          url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(faviconSvg(mark, kind, index));
          cache.set(tag, url);
        }
        for (const node of links) node.setAttribute('href', url);
      };
      const tick = () => {
        frame = (frame + 1) % BUSY_FRAMES;
        paint('busy', frame);
      };
      const stopWorker = () => {
        if (worker !== null) {
          worker.onmessage = null;
          worker.onerror = null;
          try {
            worker.terminate();
          } catch (error) {
            // Terminating is best effort.
          }
          worker = null;
        }
        if (workerUrl !== null) {
          try {
            URL.revokeObjectURL(workerUrl);
          } catch (error) {
            // Nothing to release.
          }
          workerUrl = null;
        }
      };
      const stopTicker = () => {
        if (interval !== null) {
          window.clearInterval(interval);
          interval = null;
        }
        stopWorker();
      };
      const startTicker = () => {
        try {
          const source = 'let h=null;onmessage=function(e){if(e.data==="start"){clearInterval(h);h=setInterval(function(){postMessage(1)},'
            + BUSY_FRAME_MS + ')}else{clearInterval(h);h=null}}';
          workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
          worker = new Worker(workerUrl);
          worker.onmessage = tick;
          worker.onerror = () => {
            // A refused worker still leaves the page interval as a fallback.
            stopWorker();
            if (interval === null && wanted === 'busy') interval = window.setInterval(tick, BUSY_FRAME_MS);
          };
          worker.postMessage('start');
          return true;
        } catch (error) {
          stopWorker();
          return false;
        }
      };
      const startBusy = () => {
        if (interval !== null || worker !== null) return;
        frame = 0;
        paint('busy', 0);
        if (!startTicker()) interval = window.setInterval(tick, BUSY_FRAME_MS);
      };
      const settle = (kind) => {
        stopTicker();
        frame = 0;
        paint(kind, 0);
      };

      return {
        /** Read the page's own favicon so the mark matches the shipped brand. */
        start() {
          const fetchMark = async (name) => {
            const response = await window.fetch(new URL(name, document.baseURI).href);
            if (!response.ok) throw new Error(String(response.status));
            return 'data:image/svg+xml;base64,' + window.btoa(await response.text());
          };
          // The white mark sits on a coloured disc, so it reads in either scheme.
          fetchMark('favicon-dark.svg').catch(() => fetchMark('favicon.svg')).then((dataUrl) => {
            mark = dataUrl;
            applied = null;
            if (wanted === 'busy') startBusy();
            else paint(wanted, 0);
          }).catch(() => {
            // Without the mark, leave the host's favicon rather than a bare disc.
          });
        },
        /** `busy` while any session works; `waiting` while one needs an answer. */
        update(busy, waiting) {
          wanted = waiting ? 'waiting' : busy ? 'busy' : 'stopped';
          if (mark === null) return;
          if (wanted === 'busy') startBusy();
          else settle(wanted);
        },
        dispose() {
          stopTicker();
          links.forEach((node, index) => {
            const href = original[index];
            if (href === null) node.removeAttribute('href');
            else node.setAttribute('href', href);
          });
        },
      };
    }

    // ------------------------------------------------------------- peak hours

    /**
     * The published pricing clock this indicator reads: peak/off-peak windows in
     * their own time zone, weekday rules, Chinese public holidays, and dated
     * campaign overrides. Fetched and cached, with a built-in copy so the
     * indicator is correct with no network at all.
     */
    const PEAK_URL = 'https://apetersson.github.io/qnd/deepseek-clock/pricing.json';
    const PEAK_KEY = 'dsh.peak.data.v1';
    const PEAK_SELECT_KEY = 'dsh.peak.selected.v1';
    const PEAK_FRESH_MS = 12 * 60 * 60 * 1000;
    const PEAK_FAST_MS = 2 * 24 * 60 * 60 * 1000;
    const PEAK_LONG_MS = 14 * 24 * 60 * 60 * 1000;
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const PEAK_FALLBACK = {
      schemaVersion: 1,
      updatedAt: '2026-09-28',
      defaultProfile: 'deepseek-v4',
      profiles: [{
        id: 'deepseek-v4',
        provider: 'DeepSeek',
        model: 'V4.1 Flash',
        product: 'API',
        title: 'DeepSeek pricing clock',
        schedule: {
          timeZone: 'UTC',
          peakDays: [1, 2, 3, 4, 5],
          peakWindows: [{ start: '01:00', end: '04:00' }, { start: '06:00', end: '10:00' }],
          publicHolidayDates: [
            '2026-01-01', '2026-01-02', '2026-01-03', '2026-02-15', '2026-02-16', '2026-02-17',
            '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
            '2026-04-04', '2026-04-05', '2026-04-06', '2026-05-01', '2026-05-02', '2026-05-03',
            '2026-05-04', '2026-05-05', '2026-06-19', '2026-06-20', '2026-06-21', '2026-09-25',
            '2026-09-26', '2026-09-27', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
            '2026-10-05', '2026-10-06', '2026-10-07',
          ],
          publicHolidayName: 'Chinese public holiday',
          publicHolidayTimeZone: 'Asia/Shanghai',
          windowName: 'peak',
          offDayName: 'Weekend',
          sourceTitle: 'Peak hours (UTC):',
          sourceWindows: '01:00–04:00 · 06:00–10:00',
          sourceNote: 'Mon–Fri except Chinese public holidays · weekends and public holidays are fully off-peak · off-peak is half the peak rate',
        },
        periods: {
          peak: { name: 'Peak rate', status: 'Peak rate is active now', badge: '2×', detail: '2× the off-peak rate' },
          offPeak: { name: 'Off-peak rate', status: 'Off-peak rate is active now', badge: '1×', detail: 'Base rate' },
        },
        source: 'https://api-docs.deepseek.com/quick_start/pricing/',
        verifiedAt: '2026-09-28',
      }],
    };

    const zoneCache = new Map();
    const clockCache = new Map();

    /** Formatter for a named zone, falling back to UTC if the zone is unknown. */
    function zoneFormatter(timeZone) {
      let formatter = zoneCache.get(timeZone);
      if (formatter === undefined) {
        const options = {
          hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit',
          year: 'numeric', month: '2-digit', day: '2-digit',
        };
        try {
          formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
        } catch (error) {
          formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
        }
        zoneCache.set(timeZone, formatter);
      }
      return formatter;
    }

    /** Wall clock in one zone: weekday index, minutes past midnight, YYYY-MM-DD. */
    function zoneParts(instant, timeZone) {
      const parts = zoneFormatter(timeZone).formatToParts(new Date(instant));
      const value = (type) => {
        for (const part of parts) if (part.type === type) return part.value;
        return '';
      };
      return {
        weekday: Math.max(0, WEEKDAYS.indexOf(value('weekday'))),
        minutes: ((Number(value('hour')) % 24) * 60) + Number(value('minute')),
        date: value('year') + '-' + value('month') + '-' + value('day'),
      };
    }

    const minutesOf = (text) => {
      const [hour, minute] = String(text || '00:00').split(':');
      return ((Number(hour) || 0) * 60) + (Number(minute) || 0);
    };

    /** Does a wall-clock minute fall inside any of these windows (midnight wrap included)? */
    function windowsHit(windows, minutes) {
      for (const window of windows || []) {
        const start = minutesOf(window.start);
        const end = minutesOf(window.end);
        if (window.allDay === true || start === end) return true;
        if (end > start ? (minutes >= start && minutes < end) : (minutes >= start || minutes < end)) return true;
      }
      return false;
    }

    function overrideCovers(override, instant, local) {
      const start = override.startAt === undefined ? NaN : Date.parse(override.startAt);
      const end = override.endAt === undefined ? NaN : Date.parse(override.endAt);
      if (Number.isFinite(start) && instant < start) return false;
      if (Number.isFinite(end) && instant >= end) return false;
      if (override.startDate !== undefined && local.date < override.startDate) return false;
      if (override.endDate !== undefined && local.date > override.endDate) return false;
      if (Array.isArray(override.days) && !override.days.includes(local.weekday)) return false;
      if (Array.isArray(override.windows) && override.windows.length > 0 && !windowsHit(override.windows, local.minutes)) return false;
      return true;
    }

    function holidayOn(schedule, instant) {
      const dates = schedule.publicHolidayDates;
      if (!Array.isArray(dates) || dates.length === 0) return null;
      const zone = schedule.publicHolidayTimeZone || schedule.timeZone || 'UTC';
      const date = zoneParts(instant, zone).date;
      return dates.includes(date) ? date : null;
    }

    /** The period key in force at one instant: an override, else peak or off-peak. */
    function periodAt(profile, instant) {
      const schedule = profile.schedule || {};
      const local = zoneParts(instant, schedule.timeZone || 'UTC');
      for (const override of schedule.overrides || []) {
        if (override.period === undefined) continue;
        if (profile.periods === undefined || profile.periods[override.period] === undefined) continue;
        if (overrideCovers(override, instant, local)) return override.period;
      }
      if (holidayOn(schedule, instant) !== null) return 'offPeak';
      if (!(schedule.peakDays || []).includes(local.weekday)) return 'offPeak';
      return windowsHit(schedule.peakWindows, local.minutes) ? 'peak' : 'offPeak';
    }

    /** The next minute at which the period changes, or null within two weeks. */
    function nextChange(profile, instant, current) {
      const scan = (step, from, to) => {
        for (let at = from; at <= to; at += step) {
          if (periodAt(profile, at) === current) continue;
          for (let minute = at; minute > at - step; minute -= 60000) {
            if (periodAt(profile, minute - 60000) === current) return minute;
          }
          return at;
        }
        return null;
      };
      return scan(5 * 60 * 1000, instant + 60000, instant + PEAK_FAST_MS)
        || scan(30 * 60 * 1000, instant + PEAK_FAST_MS, instant + PEAK_LONG_MS);
    }

    /** The instant at which a wall-clock time occurs in a zone (iterated for DST). */
    function instantOfWallClock(date, timeZone, hhmm) {
      const [year, month, day] = date.split('-').map(Number);
      const minutes = minutesOf(hhmm);
      const target = Date.UTC(year, (month || 1) - 1, day || 1, Math.floor(minutes / 60), minutes % 60, 0, 0);
      let guess = target;
      for (let i = 0; i < 3; i += 1) {
        const parts = zoneParts(guess, timeZone);
        const [gy, gm, gd] = parts.date.split('-').map(Number);
        const asUtc = Date.UTC(gy, (gm || 1) - 1, gd || 1, Math.floor(parts.minutes / 60), parts.minutes % 60, 0, 0);
        if (asUtc === target) break;
        guess += target - asUtc;
      }
      return guess;
    }

    function clockFormat(instant, timeZone) {
      const key = timeZone === undefined ? 'local' : timeZone;
      let formatter = clockCache.get(key);
      if (formatter === undefined) {
        const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
        try {
          formatter = new Intl.DateTimeFormat([], timeZone === undefined ? options : { ...options, timeZone });
        } catch (error) {
          formatter = new Intl.DateTimeFormat([], options);
        }
        clockCache.set(key, formatter);
      }
      return formatter.format(new Date(instant));
    }

    /** The peak windows in the viewer's own time zone, one entry per window. */
    function hoursInViewerZone(schedule) {
      const zone = schedule.timeZone || 'UTC';
      const date = zoneParts(Date.now(), zone).date;
      const hours = [];
      for (const window of schedule.peakWindows || []) {
        if (window.allDay === true) continue;
        hours.push(clockFormat(instantOfWallClock(date, zone, window.start)) + '–' + clockFormat(instantOfWallClock(date, zone, window.end)));
      }
      return hours;
    }

    function upcomingHoliday(schedule, instant) {
      const dates = schedule.publicHolidayDates;
      if (!Array.isArray(dates) || dates.length === 0) return null;
      const zone = schedule.publicHolidayTimeZone || schedule.timeZone || 'UTC';
      const today = zoneParts(instant, zone).date;
      const next = dates.filter((date) => date >= today).sort()[0];
      if (next === undefined) return null;
      return { date: next, name: schedule.publicHolidayName || null, inDays: Math.round((Date.parse(next + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000) };
    }

    function durationText(ms, t) {
      const total = Math.max(0, Math.round(ms / 60000));
      const days = Math.floor(total / 1440);
      const hours = Math.floor((total % 1440) / 60);
      const minutes = total % 60;
      if (days > 0) return t('peakDurationDays', { d: days, h: hours });
      return hours > 0 ? t('peakDuration', { h: hours, m: minutes }) : t('peakDurationMinutes', { m: minutes });
    }

    function dayNamesText(schedule, t) {
      const names = t('peakDays').split(',');
      const days = Array.isArray(schedule.peakDays) ? schedule.peakDays : [];
      if (days.length === 7) return t('peakEveryDay');
      if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) return t('peakWeekdays');
      return days.map((day) => names[day] || '').filter(Boolean).join(' · ');
    }

    /** Everything the indicator shows, for one instant, for the selected model. */
    function describePeak(data, instant, t, selectedId) {
      const profiles = Array.isArray(data.profiles) ? data.profiles : [];
      const profile = profiles.find((item) => item.id === selectedId)
        || profiles.find((item) => item.id === data.defaultProfile)
        || profiles[0];
      if (profile === undefined) return null;
      const schedule = profile.schedule || {};
      const periods = profile.periods || {};
      const periodKey = periodAt(profile, instant);
      const info = periods[periodKey] || {};
      const nextAt = nextChange(profile, instant, periodKey);
      return {
        profileId: profile.id || null,
        provider: profile.provider || null,
        model: profile.model || null,
        updatedAt: data.updatedAt || null,
        periodKey,
        isPeak: periodKey === 'peak',
        info: {
          name: info.name || null,
          badge: typeof info.badge === 'string' ? info.badge : null,
          detail: info.detail || null,
          tone: info.tone || null,
        },
        nextAt,
        nextInMs: nextAt === null ? null : Math.max(0, nextAt - instant),
        holiday: upcomingHoliday(schedule, instant),
        hours: hoursInViewerZone(schedule),
        days: dayNamesText(schedule, t),
        profiles: profiles.map((item) => {
          const key = periodAt(item, instant);
          const itemInfo = (item.periods || {})[key] || {};
          return {
            id: item.id || null,
            provider: item.provider || null,
            model: item.model || null,
            badge: typeof itemInfo.badge === 'string' ? itemInfo.badge : null,
            special: itemInfo.tone === 'special',
            active: item.id === profile.id,
          };
        }),
      };
    }

    function createPeakStore(t) {
      let data = null;
      let source = 'bundled';
      let snapshot = null;
      let panelOpen = false;
      let listOpen = false;
      const stored = readStored(PEAK_SELECT_KEY);
      let selectedId = stored !== null && typeof stored === 'object' && typeof stored.id === 'string' ? stored.id : null;
      const listeners = new Set();

      const publish = () => {
        const next = data === null ? null : describePeak(data, Date.now(), t, selectedId);
        if (next !== null) {
          next.source = source;
          next.panelOpen = panelOpen;
          next.listOpen = listOpen;
        }
        snapshot = next;
        for (const listener of [...listeners]) listener();
      };
      const accept = (parsed, from) => {
        if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) return false;
        data = parsed;
        source = from;
        publish();
        return true;
      };
      const load = () => {
        const cached = readStored(PEAK_KEY);
        const cachedUsable = cached !== null && typeof cached === 'object' && cached.data !== undefined;
        if (cachedUsable && (Date.now() - (cached.at || 0)) < PEAK_FRESH_MS && accept(cached.data, 'cache')) return;
        window.fetch(PEAK_URL, { cache: 'no-store' })
          .then((response) => (response.ok ? response.json() : null))
          .then((parsed) => {
            if (accept(parsed, 'live')) writeStored(PEAK_KEY, { at: Date.now(), data: parsed });
          })
          .catch(() => {
            // Offline or blocked: the cached copy or the built-in schedule stands.
            if (cachedUsable) accept(cached.data, 'cache');
          });
      };

      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        start() {
          accept(PEAK_FALLBACK, 'bundled');
          load();
        },
        tick: publish,
        /** Follow another model's schedule; the choice outlives the page. */
        selectProfile(id) {
          if (typeof id !== 'string') return;
          selectedId = id;
          listOpen = false;
          writeStored(PEAK_SELECT_KEY, { id });
          publish();
        },
        toggleList() {
          listOpen = !listOpen;
          publish();
        },
        openPanel() {
          panelOpen = true;
          listOpen = false;
          publish();
        },
        closePanel() {
          if (!panelOpen) return;
          panelOpen = false;
          listOpen = false;
          publish();
        },
      };
    }

    /** The pricing clock and its detail panel. */
    const PEAK_CSS = [
      '.hp-peak-btn{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.hp-peak-badge{font-weight:700}',
      '.hp-peak-dot{width:9px;height:9px;border-radius:50%;background:currentColor}',
      '.hp-peak-btn[data-phase="peak"]{color:var(--dsw-alias-state-warn-primary)}',
      '.hp-peak-btn[data-phase="off"]{color:var(--dsw-alias-state-success-primary)}',
      '.hp-peak-btn[data-special="1"]{color:var(--dsw-alias-brand-primary)}',
      '.hp-peak-btn[data-open="1"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.hp-layer.hp-peak-layer{position:fixed;left:16px;bottom:72px;z-index:34}',
      '.hp-peak-panel{pointer-events:auto;box-sizing:border-box;width:300px;padding:12px;border-radius:12px;',
      'border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);',
      'font-size:13px;line-height:18px;box-shadow:0 6px 20px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent)}',
      '.hp-peak-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}',
      '.hp-peak-status{font-weight:600}',
      '.hp-peak-status[data-phase="peak"]{color:var(--dsw-alias-state-warn-primary)}',
      '.hp-peak-status[data-phase="off"]{color:var(--dsw-alias-state-success-primary)}',
      '.hp-peak-status[data-special="1"]{color:var(--dsw-alias-brand-primary)}',
      '.hp-peak-provider{color:var(--dsw-alias-label-secondary);font-size:11px;text-align:right}',
      '.hp-peak-detail{margin:0 0 6px;color:var(--dsw-alias-label-secondary)}',
      '.hp-peak-rows{display:grid;gap:4px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px}',
      '.hp-peak-row{display:grid;grid-template-columns:96px 1fr;gap:8px}',
      '.hp-peak-key{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}',
      '.hp-peak-lines{display:grid;gap:2px;font-variant-numeric:tabular-nums}',
      '.hp-peak-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;',
      'border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:15px}',
      '.hp-peak-change{padding:2px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-brand-primary);',
      'font:inherit;font-size:11px;cursor:pointer}',
      '.hp-peak-change:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.hp-peak-change:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.hp-peak-list{display:grid;gap:2px;margin-top:8px;max-height:190px;overflow-y:auto;',
      'border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px}',
      '.hp-peak-pick{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center;width:100%;',
      'padding:6px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:12px;line-height:16px;text-align:left;cursor:pointer}',
      '.hp-peak-pick:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.hp-peak-pick:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.hp-peak-pick[data-active="1"] .hp-peak-pickname{color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.hp-peak-pick[data-special="1"] .hp-peak-pickbadge{color:var(--dsw-alias-brand-primary)}',
      '.hp-peak-check{color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.hp-peak-pickname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.hp-peak-pickbadge{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
    ].join('');

    /** Compact rate badge in the sidebar foot: peak, off-peak, or a live promotion. */
    function PeakButton(props) {
      const store = props.peak;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(store);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      if (!featureEnabled(featureState, 'pricing')) return null;
      const badge = state !== null && state.info.badge !== null && state.info.badge.length <= 5 ? state.info.badge : null;
      const name = state === null ? t('peakLoading') : (state.info.name || (state.isPeak ? t('peakPeak') : t('peakOff')));
      const when = state === null || state.nextAt === null ? t('peakNextNone') : t('peakNext', { time: durationText(state.nextInMs, t) });
      const label = name + ' · ' + when;

      return h('div', { className: 'hp-icon' },
        h('style', null, CONTROL_CSS + PEAK_CSS),
        h('button', {
          type: 'button',
          className: 'hp-btn hp-peak-btn',
          'data-phase': state !== null && state.isPeak ? 'peak' : 'off',
          'data-special': state !== null && state.info.tone === 'special' ? '1' : '0',
          'data-open': state !== null && state.panelOpen ? '1' : '0',
          title: label,
          'aria-label': label,
          'aria-haspopup': 'dialog',
          'aria-expanded': state !== null && state.panelOpen ? 'true' : 'false',
          onClick: () => (state !== null && state.panelOpen ? store.closePanel() : store.openPanel()),
        },
          badge === null
            ? h('span', { className: 'hp-peak-dot', 'aria-hidden': true })
            : h('span', { className: 'hp-peak-badge' }, badge)));
    }

    /** One rate, the few conditions behind it, and the model it follows. */
    function PeakPanel(props) {
      const { peak } = props;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(peak);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      const open = state !== null && state.panelOpen === true && featureEnabled(featureState, 'pricing');

      React.useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.hp-peak-btn, .hp-peak-panel')) return;
          peak.closePanel();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') peak.closePanel();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [peak, open]);

      if (!open) return null;
      const rows = [];
      const push = (label, value) => {
        const lines = (Array.isArray(value) ? value : [value]).filter((line) => typeof line === 'string' && line !== '');
        if (lines.length === 0) return;
        rows.push(h('div', { className: 'hp-peak-row', key: label },
          h('span', { className: 'hp-peak-key' }, label),
          h('span', { className: 'hp-peak-lines' },
            lines.map((line, index) => h('span', { key: line }, (index === 0 ? '' : '· ') + line)))));
      };
      push(t('peakHours'), state.hours);
      push(t('peakDaysLabel'), state.days);
      push(t('peakNextLabel'), state.nextAt === null
        ? t('peakNextNone')
        : durationText(state.nextInMs || 0, t) + ' · ' + clockFormat(state.nextAt));
      if (state.holiday !== null) push(t('peakHolidayNext'), state.holiday.date);

      const origin = t(state.source === 'live' ? 'peakLive' : state.source === 'cache' ? 'peakCache' : 'peakBundled');

      return h('div', { className: 'hp-layer hp-peak-layer' },
        h('style', null, CONTROL_CSS + PEAK_CSS),
        h('div', { className: 'hp-peak-panel', role: 'dialog', 'aria-label': t('peakPanel') },
          h('div', { className: 'hp-peak-head' },
            h('span', {
              className: 'hp-peak-status',
              'data-phase': state.isPeak ? 'peak' : 'off',
              'data-special': state.info.tone === 'special' ? '1' : '0',
            }, (state.info.badge === null ? '' : state.info.badge + ' ') + (state.info.name || (state.isPeak ? t('peakPeak') : t('peakOff')))),
            h('span', { className: 'hp-peak-provider' }, state.provider || '')),
          state.info.detail === null ? null : h('p', { className: 'hp-peak-detail' }, state.info.detail),
          h('div', { className: 'hp-peak-rows' }, rows),
          h('div', { className: 'hp-peak-foot' },
            h('span', null, t('peakUpdated', { date: state.updatedAt || '—' }) + ' · ' + origin),
            h('button', { type: 'button', className: 'hp-peak-change', onClick: () => peak.toggleList() },
              t(state.listOpen ? 'peakDone' : 'peakChooseModel'))),
          state.listOpen
            ? h('div', { className: 'hp-peak-list' },
              state.profiles.map((item) => h('button', {
                key: item.id,
                type: 'button',
                role: 'menuitemradio',
                'aria-checked': item.active ? 'true' : 'false',
                className: 'hp-peak-pick',
                'data-active': item.active ? '1' : '0',
                'data-special': item.special ? '1' : '0',
                onClick: () => peak.selectProfile(item.id),
              },
                h('span', { className: 'hp-peak-check', 'aria-hidden': true }, item.active ? '✓' : ''),
                h('span', { className: 'hp-peak-pickname' }, [item.provider, item.model].filter(Boolean).join(' · ')),
                h('span', { className: 'hp-peak-pickbadge' }, item.badge || ''))))
            : null));
    }

    // -------------------------------------------------------------- features

    /** Every feature the HC panel can switch, with its dictionary key. */
    const FEATURE_ROWS = [
      ['pomodoro', 'featurePomodoro'],
      ['water', 'featureWater'],
      ['sound', 'featureSound'],
      ['favicon', 'featureFavicon'],
      ['pricing', 'featurePricing'],
    ];
    const FEATURE_KEYS = FEATURE_ROWS.map(([key]) => key);
    const FEATURES_KEY = 'dsh.harendra.features.v1';

    /**
     * Which features are on. Switching one off must stop its work, not just hide
     * its button, so the stores read this rather than duplicating a flag.
     */
    function createFeaturesStore() {
      const saved = readStored(FEATURES_KEY);
      let state = {};
      for (const key of FEATURE_KEYS) state[key] = true;
      if (saved !== null && typeof saved === 'object') {
        for (const key of FEATURE_KEYS) {
          if (typeof saved[key] === 'boolean') state[key] = saved[key];
        }
      }
      let panelOpen = false;
      const listeners = new Set();
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };

      return {
        getSnapshot: () => ({ ...state, panelOpen }),
        /** Re-publish without changing anything; used while the panel is open. */
        refresh: notify,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        isOn(key) {
          return state[key] === true;
        },
        toggle(key) {
          if (!FEATURE_KEYS.includes(key)) return;
          state = { ...state, [key]: state[key] !== true };
          writeStored(FEATURES_KEY, state);
          notify();
        },
        openPanel() {
          panelOpen = true;
          notify();
        },
        closePanel() {
          if (!panelOpen) return;
          panelOpen = false;
          notify();
        },
      };
    }

    /** The plugin's own settings surface: plain text in the sidebar foot. */
    const FEATURE_CSS = [
      '.hp-hc-btn{font-size:11px;font-weight:700;letter-spacing:.04em}',
      '.hp-hc-btn[data-open="1"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      // Self-contained on purpose: a panel must never depend on another component's
      // style element for its own placement, or switching that component off would
      // leave this one unpositioned at the corner of the frame.
      '.hp-layer.hp-feature-layer{position:fixed;left:16px;bottom:72px;z-index:34}',
      '.hp-feature-panel{pointer-events:auto;box-sizing:border-box;width:238px;padding:12px;border-radius:12px;',
      'border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);',
      'font-size:13px;line-height:18px;box-shadow:0 6px 20px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent)}',
      '.hp-feature-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px}',
      '.hp-feature-name{font-weight:700;letter-spacing:.04em}',
      '.hp-feature-sub{color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.hp-feature-rows{display:grid;gap:2px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px}',
      '.hp-feat{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;width:100%;padding:7px 8px;',
      'border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;',
      'font-size:12px;line-height:16px;text-align:left;cursor:pointer}',
      '.hp-feat:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.hp-feat:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.hp-feat[data-on="0"] .hp-feat-label{color:var(--dsw-alias-label-secondary)}',
      '.hp-feat-state{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.hp-feat[data-on="1"] .hp-feat-state{color:var(--dsw-alias-state-success-primary)}',
    ].join('');

    /** "HC" beside the other controls; opens the feature switches. */
    function HCButton(props) {
      const features = props.features;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const [open, setOpen] = React.useState(() => features.getSnapshot().panelOpen);
      const label = t('settingsTitle');

      return h('div', { className: 'hp-icon' },
        h('style', null, CONTROL_CSS + FEATURE_CSS),
        h('button', {
          type: 'button',
          className: 'hp-btn hp-hc-btn',
          'data-open': open ? '1' : '0',
          title: label,
          'aria-label': label,
          'aria-haspopup': 'dialog',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => {
            if (open) features.closePanel();
            else features.openPanel();
            setOpen(!open);
          },
        }, 'HC'));
    }

    /** One switch per feature, so any of them can be silenced without uninstalling. */
    function SettingsPanel(props) {
      const { features } = props;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const [state, setState] = React.useState(() => features.getSnapshot());
      const open = state.panelOpen === true;
      // The panel is its own writer while open, so it updates from the click that
      // changed it rather than waiting on a subscription round trip.
      const sync = () => setState(features.getSnapshot());

      React.useEffect(() => {
        const unsubscribe = features.subscribe(sync);
        sync();
        return unsubscribe;
      }, [features]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.hp-hc-btn, .hp-feature-panel')) return;
          features.closePanel();
          sync();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            features.closePanel();
            sync();
          }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [features, open]);

      if (!open) return null;
      return h('div', { className: 'hp-layer hp-feature-layer' },
        h('style', null, CONTROL_CSS + FEATURE_CSS),
        h('div', { className: 'hp-feature-panel', role: 'dialog', 'aria-label': t('settingsTitle') },
          h('div', { className: 'hp-feature-head' },
            h('span', { className: 'hp-feature-name' }, 'HC'),
            h('span', { className: 'hp-feature-sub' }, t('settingsSubtitle'))),
          h('div', { className: 'hp-feature-rows' },
            FEATURE_ROWS.map(([key, labelKey]) => {
              const on = state[key] === true;
              return h('button', {
                key,
                type: 'button',
                role: 'switch',
                'aria-checked': on ? 'true' : 'false',
                className: 'hp-feat',
                'data-on': on ? '1' : '0',
                onClick: () => {
                  features.toggle(key);
                  sync();
                },
              },
                h('span', { className: 'hp-feat-label' }, t(labelKey)),
                h('span', { className: 'hp-feat-state' }, t(on ? 'featureOn' : 'featureOff')));
            }))));
    }

    // ------------------------------------------------------------- components

    function IconButton(props) {
      return h('button', {
        type: 'button',
        className: 'hp-btn-sm',
        title: props.label,
        'aria-label': props.label,
        onClick: props.onClick,
      }, props.icon());
    }

    /** Fallback when a slot has no Chat snapshot hook. */
    const useNoChat = () => undefined;

    /**
     * The newest assistant row's anchor, but only while it reads as interrupted.
     * Scanning back to the first row that carries a status keeps this cheap enough
     * to run on every streaming publication.
     */
    function selectInterruptedSeq(snapshot) {
      if (snapshot === undefined || snapshot === null) return undefined;
      const order = snapshot.order;
      const nodes = snapshot.nodes;
      if (!Array.isArray(order) || nodes === undefined || nodes === null || typeof nodes.get !== 'function') return undefined;
      for (let index = order.length - 1; index >= 0; index -= 1) {
        const node = nodes.get(order[index]);
        const data = node === undefined || node === null ? undefined : node.data;
        if (data === undefined || data.status === undefined) continue;
        return data.status === 'interrupted' ? (node.anchorSeq === undefined ? order[index] : node.anchorSeq) : undefined;
      }
      return undefined;
    }

    /** Used when a slot is registered without the feature store: nothing is hidden. */
    const FEATURES_ALWAYS_ON = { getSnapshot: () => ({}), subscribe: () => () => {} };

    /** A feature is on unless the store explicitly switched it off. */
    const featureEnabled = (state, key) => state[key] !== false;

    function PomodoroView(props) {
      const store = props.pomodoro;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(store);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      const soundOn = featureEnabled(featureState, 'sound');

      // A stop is only distinguishable from a completion here: the Chat row that
      // ends an aborted turn carries status 'interrupted' instead of 'settled'.
      const alerter = props.alerter;
      const sessionId = props.sessionId;
      const useChat = typeof props.useChat === 'function' ? props.useChat : useNoChat;
      const interruptedAt = useChat(selectInterruptedSeq);
      const seenInterrupt = React.useRef(undefined);
      React.useEffect(() => {
        if (interruptedAt === undefined) return;
        if (seenInterrupt.current === undefined || soundOn !== true) {
          // Already-stopped history, or sound is off: record it without buzzing.
          seenInterrupt.current = interruptedAt;
          return;
        }
        if (seenInterrupt.current === interruptedAt) return;
        seenInterrupt.current = interruptedAt;
        alerter.interrupt(sessionId);
      }, [alerter, sessionId, interruptedAt, soundOn]);

      if (!featureEnabled(featureState, 'pomodoro')) return null;

      const total = durationOf(state.phase);
      const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
      const time = formatClock(seconds);
      const elapsed = total > 0 ? Math.min(1, Math.max(0, 1 - state.remainingMs / total)) : 0;
      const phaseLabel = t(state.phase);

      return h('div', { className: 'hp-root' },
        h('style', null, POMODORO_CSS),
        h('div', {
          className: 'hp-pill',
          'data-phase': state.phase,
          'data-done': state.flashUntil > Date.now() ? '1' : '0',
          role: 'group',
          'aria-label': t('summary', { phase: phaseLabel, time }),
        },
          h('span', { className: 'hp-tomato', 'aria-hidden': true }, tomatoIcon()),
          h('span', { className: 'hp-phase' }, phaseLabel),
          h('span', { className: 'hp-time', role: 'timer' }, time),
          h('span', { className: 'hp-track', 'aria-hidden': true },
            h('span', { className: 'hp-fill', style: { width: (elapsed * 100).toFixed(2) + '%' } })),
          h('span', { className: 'hp-count' }, t('sessions', { count: state.completed })),
          h(IconButton, {
            label: state.running ? t('pause') : t('start'),
            onClick: state.running ? store.pause : store.start,
            icon: state.running ? pauseIcon : playIcon,
          }),
          h(IconButton, { label: t('reset'), onClick: store.reset, icon: resetIcon }),
          h(IconButton, { label: t('skip'), onClick: store.skip, icon: skipIcon }),
        ));
    }

    function WaterButton(props) {
      const store = props.water;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(store);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      if (!featureEnabled(featureState, 'water')) return null;

      const level = Math.min(1, Math.max(0, 1 - state.remainingMs / WATER_INTERVAL_MS));
      const minutes = Math.max(0, Math.ceil(state.remainingMs / 60000));
      const label = state.due ? t('waterDue') : t('water') + ' · ' + t('waterShort', { minutes });

      return h('div', { className: 'hp-icon' },
        h('style', null, CONTROL_CSS + WATER_CSS),
        h('button', {
          type: 'button',
          className: 'hp-btn',
          'data-due': state.due ? '1' : '0',
          title: label,
          'aria-label': label,
          'aria-expanded': state.due || state.manualOpen ? 'true' : 'false',
          onClick: () => {
            if (state.due || state.manualOpen) store.close();
            else store.open();
          },
        },
          bottleIcon(level),
          state.due ? h('span', { className: 'hp-dot', 'aria-hidden': true }) : null));
    }

    function WaterPrompt(props) {
      const store = props.water;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(store);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);

      if (!featureEnabled(featureState, 'water')) return null;
      if (!state.due && !state.manualOpen) return null;
      const minutes = Math.max(0, Math.ceil(state.remainingMs / 60000));
      const level = state.due ? 1 : Math.min(1, Math.max(0, 1 - state.remainingMs / WATER_INTERVAL_MS));

      return h('div', { className: 'hp-layer' },
        h('style', null, CONTROL_CSS + WATER_CSS),
        h('div', { className: 'hp-card', role: 'status', 'aria-live': 'polite' },
          h('div', { className: 'hp-head' },
            h('span', { className: 'hp-icon' }, bottleIcon(level)),
            h('span', { className: 'hp-title' }, state.due ? t('waterDueTitle') : t('water'))),
          h('p', { className: 'hp-body' }, state.due
            ? t('waterDueBody', { minutes: WATER_MINUTES, glasses: state.glasses })
            : t('waterNextBody', { minutes, glasses: state.glasses })),
          h('div', { className: 'hp-actions' },
            h('button', {
              type: 'button',
              className: 'hp-accept',
              onClick: store.drink,
            }, t('waterDrank')),
            h('button', {
              type: 'button',
              className: 'hp-later',
              onClick: state.due ? store.later : store.close,
            }, state.due ? t('waterLater', { minutes: WATER_SNOOZE_MINUTES }) : t('waterClose')))));
    }

    /** The sound control: opens the menu that names every mode. */
    function SoundButton(props) {
      const alerter = props.alerter;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(alerter);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      if (!featureEnabled(featureState, 'sound')) return null;
      const modeLabel = t(state.mode === 'always' ? 'soundAlways' : state.mode === 'away' ? 'soundAway' : 'soundOff');
      const label = t('soundButton', { mode: modeLabel });

      return h('div', { className: 'hp-icon' },
        h('style', null, CONTROL_CSS + SOUND_CSS),
        h('button', {
          type: 'button',
          className: 'hp-btn hp-sound-btn',
          'data-sound': state.mode,
          'data-open': state.menuOpen ? '1' : '0',
          title: label,
          'aria-label': label,
          'aria-haspopup': 'menu',
          'aria-expanded': state.menuOpen ? 'true' : 'false',
          onClick: () => (state.menuOpen ? alerter.closeMenu() : alerter.openMenu()),
        }, speakerIcon(state.mode)));
    }

    /** The three modes, named, with the active one ticked. */
    function SoundMenu(props) {
      const { alerter } = props;
      const t = typeof props.t === 'function' ? props.t : props.boundT;
      const state = useStore(alerter);
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);

      React.useEffect(() => {
        if (!state.menuOpen) return undefined;
        const onPointerDown = (event) => {
          const target = event.target;
          // The button toggles itself and the menu's own rows must survive the
          // press, since this runs in the capture phase before their click.
          if (target instanceof Element && target.closest('.hp-menu, .hp-sound-btn')) return;
          alerter.closeMenu();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') alerter.closeMenu();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [alerter, state.menuOpen]);

      if (!state.menuOpen || !featureEnabled(featureState, 'sound')) return null;
      const options = [
        { key: 'always', label: t('soundAlways'), hint: t('soundAlwaysHint') },
        { key: 'away', label: t('soundAway'), hint: t('soundAwayHint') },
        { key: 'off', label: t('soundOff'), hint: t('soundOffHint') },
      ];

      return h('div', { className: 'hp-layer hp-sound-layer' },
        h('style', null, CONTROL_CSS + SOUND_CSS),
        h('div', { className: 'hp-menu', role: 'menu', 'aria-label': t('soundHeading') },
          h('div', { className: 'hp-menu-title' }, t('soundHeading')),
          options.map((option) => h('button', {
            key: option.key,
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': state.mode === option.key ? 'true' : 'false',
            className: 'hp-menu-row',
            'data-active': state.mode === option.key ? '1' : '0',
            onClick: () => alerter.setMode(option.key),
          },
            h('span', { className: 'hp-menu-check', 'aria-hidden': true }, state.mode === option.key ? '✓' : ''),
            h('span', { className: 'hp-menu-label' }, option.label),
            h('span', { className: 'hp-menu-hint' }, option.hint)))));
    }

    /** Renderless: sounds alerts for the states that reach an unfocused tab. */
    function AlertWatcher(props) {
      const { alerter, water } = props;
      const statuses = props.useSessionStatus((map) => map);
      const summaries = props.useSessions((list) => (list ? list.byId : undefined));
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      const soundOn = featureEnabled(featureState, 'sound');
      const waterOn = featureEnabled(featureState, 'water');

      React.useEffect(() => {
        if (!soundOn) return;
        alerter.sessions(statuses, summaries);
      }, [alerter, statuses, summaries, soundOn]);

      // The reminder is held while due, so it survives being seen in a focused tab.
      const waterState = useStore(water);
      React.useEffect(() => {
        // Sound off or reminder off: drop anything held rather than sounding it.
        if (!soundOn || !waterOn) {
          alerter.water(false, 0);
          return;
        }
        alerter.water(waterState.due, waterState.nextDueAt);
      }, [alerter, waterState.due, waterState.nextDueAt, soundOn, waterOn]);

      return null;
    }

    /** Renderless: mirrors the aggregate session state into the tab icon. */
    function SessionFavicon(props) {
      const { favicon } = props;
      const statuses = props.useSessionStatus((map) => map);
      const summaries = props.useSessions((list) => (list ? list.byId : undefined));
      const featureState = useStore(props.features || FEATURES_ALWAYS_ON);
      const faviconOn = featureEnabled(featureState, 'favicon');

      React.useEffect(() => {
        if (!faviconOn) return;
        let busy = false;
        let waiting = false;
        if (statuses != null && typeof statuses.forEach === 'function') {
          statuses.forEach((status, sessionId) => {
            if (status == null) return;
            const summary = summaries ? summaries[sessionId] : undefined;
            // Delegated work is not what the tab should report.
            if (summary && (summary.origin === 'subagent' || summary.parentId != null)) return;
            if (status.pendingInteraction != null) waiting = true;
            if (status.running === true) busy = true;
          });
        }
        favicon.update(busy, waiting);
      }, [favicon, statuses, summaries, faviconOn]);

      return null;
    }

    // -------------------------------------------------------------------- wire

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const boundT = ctx.locale.bind(NS);
        const features = createFeaturesStore();
        const alerter = createAlerter();
        const pomodoro = createPomodoroStore(alerter);
        const water = createWaterStore();
        const favicon = createFavicon();
        const syncFavicon = () => {
          if (features.isOn('favicon')) favicon.start();
          else favicon.dispose();
        };
        syncFavicon();
        ctx.effect(() => () => favicon.dispose());
        // Switching the tab icon off restores the host's own icon, rather than
        // leaving the page advertising a state the user asked not to see.
        ctx.effect(() => {
          let last = features.isOn('favicon');
          return features.subscribe(() => {
            const next = features.isOn('favicon');
            if (next === last) return;
            last = next;
            syncFavicon();
          });
        });
        // A re-enabled sound feature starts clean, so a stop that happened while it
        // was off never replays as a fresh chime.
        ctx.effect(() => {
          let last = features.isOn('sound');
          return features.subscribe(() => {
            const next = features.isOn('sound');
            if (next === last) return;
            last = next;
            alerter.resetTracking();
          });
        });
        const peak = createPeakStore(boundT);
        peak.start();
        ctx.effect(() => {
          const handle = window.setInterval(() => {
            if (features.isOn('pricing')) peak.tick();
          }, 30000);
          return () => window.clearInterval(handle);
        });

        ctx.effect(() => {
          const offEn = ctx.locale.register(NS, 'en', DICTS.en);
          const offZh = ctx.locale.register(NS, 'zh', DICTS.zh);
          return () => {
            offEn();
            offZh();
          };
        });

        ctx.effect(() => {
          const handle = window.setInterval(() => {
            // A switched-off feature must do no work, not merely render nothing.
            if (features.isOn('pomodoro')) pomodoro.tick();
            if (features.isOn('water')) water.tick();
            // While its panel is open, keep the gated controls in step with it.
            if (features.getSnapshot().panelOpen) features.refresh();
          }, TICK_MS);
          return () => window.clearInterval(handle);
        });

        // Leaving the tab sounds whatever is waiting; coming back re-arms it.
        ctx.effect(() => alerter.watchFocus());
        ctx.effect(() => () => alerter.dispose());

        // Browsers allow audio only after a gesture, per page load, and a context
        // created without activation stays suspended. So every gesture re-attempts
        // the resume, and a tone that could not play yet is released here.
        ctx.effect(() => {
          const unlock = () => alerter.unlock();
          window.addEventListener('pointerdown', unlock);
          window.addEventListener('keydown', unlock);
          return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
          };
        });

        ctx.slots.inject(DOCK_SLOT, () => ctx.slots.register({
          name: DOCK_SLOT,
          id: 'harendra-pomodoro',
          order: 5,
          locale: NS,
          inject: () => ({ pomodoro, alerter, boundT, features }),
        }, PomodoroView));

        ctx.slots.inject(SIDEBAR_SLOT, () => ctx.slots.register({
          name: SIDEBAR_SLOT,
          id: 'harendra-settings',
          order: 9,
          locale: NS,
          inject: () => ({ features, boundT }),
        }, HCButton));

        ctx.slots.inject(SIDEBAR_SLOT, () => ctx.slots.register({
          name: SIDEBAR_SLOT,
          id: 'harendra-water',
          order: 10,
          locale: NS,
          inject: () => ({ water, boundT, features }),
        }, WaterButton));

        ctx.slots.inject(SIDEBAR_SLOT, () => ctx.slots.register({
          name: SIDEBAR_SLOT,
          id: 'harendra-sound',
          order: 11,
          locale: NS,
          inject: () => ({ alerter, boundT, features }),
        }, SoundButton));

        ctx.slots.inject(SIDEBAR_SLOT, () => ctx.slots.register({
          name: SIDEBAR_SLOT,
          id: 'harendra-peak',
          order: 12,
          locale: NS,
          inject: () => ({ peak, boundT, features }),
        }, PeakButton));

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'harendra-settings-panel',
          order: 38,
          locale: NS,
          inject: () => ({ features, boundT }),
        }, SettingsPanel));

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'harendra-peak-panel',
          order: 39,
          locale: NS,
          inject: () => ({ peak, boundT, features }),
        }, PeakPanel));

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'harendra-water-prompt',
          order: 40,
          locale: NS,
          inject: () => ({ water, boundT, features }),
        }, WaterPrompt));

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'harendra-sound-menu',
          order: 41,
          locale: NS,
          inject: () => ({ alerter, boundT, features }),
        }, SoundMenu));

        // Renderless: owns no pixels, only the decision to sound a tone.
        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'harendra-alert-watcher',
          order: 42,
          inject: () => ({ alerter, water, features }),
        }, AlertWatcher));

        // Renderless: mirrors any session's state into the tab icon.
        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'harendra-favicon',
          order: 43,
          inject: () => ({ favicon, features }),
        }, SessionFavicon));
      },
    };
  },
});
