import { create } from 'zustand';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { PomodoroConfig, PomodoroMode, PomodoroSessionSummary } from '../types/pomodoro';

interface PomodoroState {
  mode: PomodoroMode;
  isActive: boolean;
  remainingSeconds: number;
  totalDurationSeconds: number;
  targetEndTime: number | null;
  currentSessionId: string | null;
  completedFocusSessions: number;
  config: PomodoroConfig;
  lastSummary: PomodoroSessionSummary | null;

  init: () => Promise<void>;
  startTimer: () => Promise<void>;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  switchMode: (mode: PomodoroMode) => void;
  updateConfig: (config: PomodoroConfig) => Promise<void>;
}

const DEFAULT_CONFIG: PomodoroConfig = {
  focus_duration_secs: 25 * 60,
  short_break_duration_secs: 5 * 60,
  long_break_duration_secs: 15 * 60,
  sessions_before_long_break: 4,
  auto_start_breaks: false,
  auto_start_focus: false,
  sound_enabled: true,
  notifications_enabled: true,
};

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  mode: 'focus',
  isActive: false,
  remainingSeconds: 25 * 60,
  totalDurationSeconds: 25 * 60,
  targetEndTime: null,
  currentSessionId: null,
  completedFocusSessions: 0,
  config: DEFAULT_CONFIG,
  lastSummary: null,

  init: async () => {
    try {
      const cfg = await api.getPomodoroConfig();
      if (cfg && cfg.focus_duration_secs) {
        set({
          config: cfg,
          remainingSeconds: cfg.focus_duration_secs,
          totalDurationSeconds: cfg.focus_duration_secs,
        });
      }
    } catch (err) {
      console.warn('Failed to load pomodoro config from DB, using defaults:', err);
    }
  },

  startTimer: async () => {
    const { mode, remainingSeconds, currentSessionId } = get();
    const now = Date.now();
    const targetEndTime = now + remainingSeconds * 1000;

    let sessionId = currentSessionId;
    if (!sessionId && mode === 'focus') {
      try {
        const session = await api.startPomodoro(mode, remainingSeconds);
        sessionId = session.id;
      } catch (err) {
        console.error('Failed to start pomodoro in DB:', err);
      }
    }

    set({
      isActive: true,
      targetEndTime,
      currentSessionId: sessionId,
    });
  },

  pauseTimer: () => {
    const { targetEndTime } = get();
    if (targetEndTime) {
      const remaining = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
      set({ isActive: false, remainingSeconds: remaining, targetEndTime: null });
    } else {
      set({ isActive: false });
    }
  },

  resetTimer: () => {
    const { mode, config } = get();
    const duration =
      mode === 'focus'
        ? config.focus_duration_secs
        : mode === 'short_break'
        ? config.short_break_duration_secs
        : config.long_break_duration_secs;

    set({
      isActive: false,
      remainingSeconds: duration,
      totalDurationSeconds: duration,
      targetEndTime: null,
      currentSessionId: null,
    });
  },

  tick: () => {
    const { isActive, targetEndTime, mode, currentSessionId, totalDurationSeconds, completedFocusSessions, config } = get();
    if (!isActive || !targetEndTime) return;

    const remaining = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));

    if (remaining <= 0) {
      // Session finished!
      playNotificationSound(config.sound_enabled);

      if (mode === 'focus') {
        const nextCompleted = completedFocusSessions + 1;
        const actualSecs = totalDurationSeconds;

        if (currentSessionId) {
          api.completePomodoro(currentSessionId, actualSecs)
            .then((summary) => set({ lastSummary: summary }))
            .catch(console.error);
        }

        confetti({ particleCount: 80, spread: 60 });

        const isLongBreak = nextCompleted % config.sessions_before_long_break === 0;
        const nextMode: PomodoroMode = isLongBreak ? 'long_break' : 'short_break';
        const nextDuration = isLongBreak ? config.long_break_duration_secs : config.short_break_duration_secs;

        set({
          isActive: config.auto_start_breaks,
          mode: nextMode,
          remainingSeconds: nextDuration,
          totalDurationSeconds: nextDuration,
          targetEndTime: config.auto_start_breaks ? Date.now() + nextDuration * 1000 : null,
          currentSessionId: null,
          completedFocusSessions: nextCompleted,
        });
      } else {
        // Break finished
        const nextDuration = config.focus_duration_secs;
        set({
          isActive: config.auto_start_focus,
          mode: 'focus',
          remainingSeconds: nextDuration,
          totalDurationSeconds: nextDuration,
          targetEndTime: config.auto_start_focus ? Date.now() + nextDuration * 1000 : null,
          currentSessionId: null,
        });
      }
    } else {
      set({ remainingSeconds: remaining });
    }
  },

  switchMode: (mode) => {
    const { config } = get();
    const duration =
      mode === 'focus'
        ? config.focus_duration_secs
        : mode === 'short_break'
        ? config.short_break_duration_secs
        : config.long_break_duration_secs;

    set({
      mode,
      isActive: false,
      remainingSeconds: duration,
      totalDurationSeconds: duration,
      targetEndTime: null,
      currentSessionId: null,
    });
  },

  updateConfig: async (config) => {
    await api.savePomodoroConfig(config);
    set({ config });
    get().resetTimer();
  },
}));

function playNotificationSound(enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Ignore audio context errors if browser audio is blocked
  }
}
