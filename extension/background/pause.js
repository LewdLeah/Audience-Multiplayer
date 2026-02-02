// Audience Multiplayer - Pause Module
// Handles pause/resume logic for vote and auto-repeat timers
/** @typedef {import('./types.js').State} State */
import { setAutoRepeatTimer, clearAutoRepeatTimer } from './state.js';
/**
 * Pauses the current timer (vote or auto-repeat).
 * Saves remaining time and clears the active timer.
 * @param {State} state - Application state (mutated)
 * @returns {void}
 */
const pauseTimers = (state) => {
  if (state.phase === 'vote' && state.voteEndTime) {
    // Pause during vote phase
    state.pausedVoteRemaining = Math.max(0, state.voteEndTime - Date.now());
    if (state.voteTimer) {
      clearTimeout(state.voteTimer);
      state.voteTimer = null;
    }
    console.log('[Pause] Vote paused with', Math.round(state.pausedVoteRemaining / 1000), 's remaining');
  } else if (state.phase === 'idle' && state.nextVoteStartTime) {
    // Pause during auto-repeat countdown
    state.pausedAutoRepeatRemaining = Math.max(0, state.nextVoteStartTime - Date.now());
    clearAutoRepeatTimer(state);
    console.log('[Pause] Auto-repeat paused with', Math.round(state.pausedAutoRepeatRemaining / 1000), 's remaining');
  }
};
/**
 * Resumes timers with saved remaining time.
 * @param {State} state - Application state (mutated)
 * @param {function(): void} onVoteEnd - Callback when vote timer expires
 * @param {function(): void} onAutoRepeatStart - Callback when auto-repeat timer expires
 * @param {function(): void} scheduleAutoRepeat - Callback to schedule fresh auto-repeat
 * @returns {void}
 */
const resumeTimers = (state, onVoteEnd, onAutoRepeatStart, scheduleAutoRepeat) => {
  if (state.phase === 'vote' && state.pausedVoteRemaining) {
    // Resume vote phase
    state.voteEndTime = Date.now() + state.pausedVoteRemaining;
    state.voteTimer = setTimeout(onVoteEnd, state.pausedVoteRemaining);
    console.log('[Pause] Vote resumed with', Math.round(state.pausedVoteRemaining / 1000), 's remaining');
    state.pausedVoteRemaining = null;
  } else if (state.phase === 'idle' && state.pausedAutoRepeatRemaining) {
    // Resume auto-repeat countdown
    state.nextVoteStartTime = Date.now() + state.pausedAutoRepeatRemaining;
    const timer = setTimeout(() => {
      state.nextVoteStartTime = null;
      state.autoRepeatTimer = null;
      onAutoRepeatStart();
    }, state.pausedAutoRepeatRemaining);
    setAutoRepeatTimer(state, timer);
    console.log('[Pause] Auto-repeat resumed with', Math.round(state.pausedAutoRepeatRemaining / 1000), 's remaining');
    state.pausedAutoRepeatRemaining = null;
  } else if (state.phase === 'idle' && state.config.autoRepeatCooldownSeconds) {
    // No saved time, start fresh
    scheduleAutoRepeat();
  }
};
/**
 * Toggles pause state - freezes or resumes countdown timers.
 * @param {State} state - Application state (mutated)
 * @param {function(): void} onVoteEnd - Callback when vote timer expires
 * @param {function(): void} onAutoRepeatStart - Callback when auto-repeat timer expires
 * @param {function(): void} scheduleAutoRepeat - Callback to schedule fresh auto-repeat
 * @param {function(): void} broadcastState - Callback to notify UI
 * @returns {void}
 */
export const togglePause = (state, onVoteEnd, onAutoRepeatStart, scheduleAutoRepeat, broadcastState) => {
  state.isPaused = !state.isPaused;
  console.log('[Pause] Paused:', state.isPaused);
  if (state.isPaused) {
    pauseTimers(state);
  } else {
    resumeTimers(state, onVoteEnd, onAutoRepeatStart, scheduleAutoRepeat);
  }
  broadcastState();
};
