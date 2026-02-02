// Audience Multiplayer - Background Service Worker
// Orchestrates: AID WebSocket, Twitch IRC, OpenRouter, phase state machine
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').Callbacks} Callbacks */
import { loadConfig, loadLocalState } from './storage.js';
import { connectTwitch, disconnectTwitch, sendTwitchMessage, parseTwitchMessage } from './twitch.js';
import {
  connectAID,
  disconnectAID,
  submitToAID,
  fetchPlayerId,
  updatePlayerName,
  getResolvedPlayerName,
  fetchMostRecentAction
} from './aid.js';
import { recursiveMerge } from './openrouter.js';
import { setVoteTimer, combineSubmissions, handleSubmission, handleVote } from './voting.js';
import { createMessageHandler } from './messages.js';
import {
  createInitialState,
  getPublicState,
  transitionToVote,
  transitionToCombine,
  transitionToIdle,
  setAutoRepeatTimer,
  clearAutoRepeatTimer,
  setYouTubeConnected,
  setYouTubeDisconnected,
  setYouTubeError
} from './state.js';
import { togglePause } from './pause.js';
import { MIN_VOTE_DURATION_SECONDS, MIN_AUTO_REPEAT_SECONDS } from './constants.js';
/** @type {State} */
const state = createInitialState();
/**
 * Broadcasts current state to popup/UI.
 * @returns {void}
 */
const broadcastState = () => {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', state: getPublicState(state) }).catch(() => {});
  return;
};
/**
 * Sends a message to Twitch chat.
 * @param {string} message - Message to send
 * @returns {void}
 */
const sendTwitchMsg = (message) => {
  sendTwitchMessage(state, message);
  return;
};
/** @type {Callbacks} */
const callbacks = {
  broadcastState,
  sendTwitchMessage: sendTwitchMsg
};
/**
 * Handles chat messages from Twitch.
 * Commands (!vote, !tally) are only allowed for broadcaster/moderators.
 * @param {import('./types.js').TwitchMessage} message - Parsed Twitch message with badges
 * @returns {void}
 */
const handleTwitchChatMessage = (message) => {
  const { user, text, isBroadcaster, isMod } = message;
  const canUseCommands = isBroadcaster || isMod;
  // Check for commands (mods + broadcaster only)
  if (text.toLowerCase() === '!vote') {
    if (canUseCommands) {
      handleStartVote();
    }
    return;
  }
  if (text.toLowerCase() === '!tally') {
    if (canUseCommands) {
      handleEndVote();
    }
    return;
  }
  // During vote phase, parse votes and submissions
  if (state.phase !== 'vote') {
    return;
  }
  // Check for vote pattern: +1 @username or @username +1
  const voteMatch = text.match(/^(?:\+1\s+@(\w+)|@(\w+)\s+\+1)$/i);
  if (voteMatch) {
    const targetUser = (voteMatch[1] || voteMatch[2]).toLowerCase();
    handleVote(state, user, targetUser, state.config.debugMode);
    broadcastState();
    return;
  }
  // Check for submission prefix: > action or >action
  const submissionMatch = text.match(/^>\s*(.+)$/);
  if (submissionMatch) {
    const actionText = submissionMatch[1].trim();
    handleSubmission(state, user, actionText, state.config.debugMode);
    broadcastState();
  }
  return;
};
/**
 * Handles chat messages from YouTube.
 * Commands are NOT allowed from YouTube - only votes and submissions.
 * @param {string} user - YouTube username
 * @param {string} text - Message content
 * @returns {void}
 */
const handleYouTubeChatMessage = (user, text) => {
  // During vote phase only, parse votes and submissions (no commands)
  if (state.phase !== 'vote') {
    return;
  }
  // Check for vote pattern: +1 @username or @username +1
  const voteMatch = text.match(/^(?:\+1\s+@(\w+)|@(\w+)\s+\+1)$/i);
  if (voteMatch) {
    const targetUser = (voteMatch[1] || voteMatch[2]).toLowerCase();
    handleVote(state, user, targetUser, state.config.debugMode);
    broadcastState();
    return;
  }
  // Check for submission prefix: > action or >action
  const submissionMatch = text.match(/^>\s*(.+)$/);
  if (submissionMatch) {
    const actionText = submissionMatch[1].trim();
    handleSubmission(state, user, actionText, state.config.debugMode);
    broadcastState();
    return;
  }
  return;
};
/**
 * Handles incoming Twitch IRC messages.
 * @param {string} line - Raw IRC line
 * @returns {void}
 */
const handleTwitchMessage = (line) => {
  const parsed = parseTwitchMessage(line);
  if (!parsed) {
    return;
  }
  handleTwitchChatMessage(parsed);
  return;
};
/**
 * Handles YouTube chat connection event.
 * @param {string} videoId - YouTube video ID
 * @returns {void}
 */
const handleYouTubeConnectedEvent = (videoId) => {
  setYouTubeConnected(state, videoId);
  broadcastState();
  return;
};
/**
 * Handles YouTube chat disconnection event.
 * @returns {void}
 */
const handleYouTubeDisconnectedEvent = () => {
  setYouTubeDisconnected(state);
  broadcastState();
  return;
};
/**
 * Handles YouTube DOM breakage error.
 * @param {import('./types.js').YouTubeDOMError} details - Error details
 * @returns {void}
 */
const handleYouTubeDOMErrorEvent = (details) => {
  setYouTubeError(state, details);
  broadcastState();
  return;
};
/**
 * Starts a vote and sets up the timer.
 * @returns {void}
 */
const handleStartVote = () => {
  // Clear any pending auto-repeat timer when manually starting
  clearAutoRepeatTimer(state);
  // Clear pause state when starting a new vote
  state.isPaused = false;
  state.pausedVoteRemaining = null;
  state.pausedAutoRepeatRemaining = null;
  if (!transitionToVote(state)) {
    return;
  }
  // Clamp vote duration to minimum
  const duration = Math.max(state.config.voteDurationSeconds, MIN_VOTE_DURATION_SECONDS);
  // Track vote end time for UI timer
  state.voteEndTime = Date.now() + (duration * 1000);
  console.log('[Phase] Vote started for', duration, 'seconds');
  callbacks.sendTwitchMessage(`📝 Voting started! Submit with > action, vote with +1 @name (${duration}s)`);
  callbacks.broadcastState();
  setVoteTimer(state, handleEndVote);
  return;
};
/**
 * Ends voting and triggers combine.
 * @returns {void}
 */
const handleEndVote = () => {
  // Clear vote pause state when ending
  state.pausedVoteRemaining = null;
  if (!transitionToCombine(state)) {
    return;
  }
  console.log('[Phase] Vote ended with', state.submissions.length, 'submissions');
  const hasApiKey = !!state.config.openRouterApiKey;
  const action = hasApiKey ? 'Blending...' : 'Tallying votes...';
  callbacks.sendTwitchMessage(`⏱️ Voting closed! ${state.submissions.length} submission${state.submissions.length === 1 ? '' : 's'} received. ${action}`);
  callbacks.broadcastState();
  combineAndSubmit();
  return;
};
/**
 * Schedules the next auto-vote if configured and not paused.
 * @returns {void}
 */
const scheduleAutoRepeat = () => {
  // Don't schedule if paused
  if (state.isPaused) {
    console.log('[Phase] Auto-repeat skipped (paused)');
    return;
  }
  const interval = state.config.autoRepeatCooldownSeconds;
  if (!interval) {
    return;
  }
  // Clamp to minimum
  const delaySeconds = Math.max(interval, MIN_AUTO_REPEAT_SECONDS);
  state.nextVoteStartTime = Date.now() + (delaySeconds * 1000);
  console.log('[Phase] Auto-repeat scheduled in', delaySeconds, 'seconds');
  const timer = setTimeout(() => {
    state.nextVoteStartTime = null;
    state.autoRepeatTimer = null;
    handleStartVote();
  }, delaySeconds * 1000);
  setAutoRepeatTimer(state, timer);
  callbacks.broadcastState();
  return;
};
/**
 * Toggles pause state - freezes countdown timers.
 * @returns {void}
 */
const handleTogglePause = () => {
  togglePause(state, handleEndVote, handleStartVote, scheduleAutoRepeat, broadcastState);
  return;
};
/**
 * Combines submissions and submits to AID.
 * @returns {Promise<void>}
 */
const combineAndSubmit = async () => {
  await combineSubmissions(state, callbacks, {
    submitToAID,
    recursiveMerge,
    fetchMostRecentAction
  });
  transitionToIdle(state);
  // Schedule next auto-vote if configured
  scheduleAutoRepeat();
  callbacks.broadcastState();
  return;
};
/**
 * Connects to Twitch IRC with current config.
 * @throws {TwitchError} If missing channel or token
 * @returns {void}
 */
const doConnectTwitch = () => {
  connectTwitch(state, state.config, handleTwitchMessage, broadcastState);
  return;
};
/**
 * Connects to AI Dungeon WebSocket and initializes player character name.
 * @throws {AIDError} If missing token or shortId
 * @returns {Promise<void>}
 */
const doConnectAID = async () => {
  connectAID(state, broadcastState);
  // Fetch player ID and set initial character name (uses HTTP, not WebSocket)
  try {
    await fetchPlayerId(state);
    if (state.playerId) {
      const playerName = getResolvedPlayerName(state.config);
      await updatePlayerName(state, playerName);
    }
  } catch (err) {
    console.log('[AID] Player initialization deferred:', err.message);
  }
  return;
};
/**
 * Updates the player's character name in AI Dungeon.
 * Called when settings are saved with a new player character name.
 * @returns {Promise<void>}
 */
const doUpdatePlayerName = async () => {
  if (!state.playerId) {
    await fetchPlayerId(state);
  }
  if (state.playerId) {
    const playerName = getResolvedPlayerName(state.config);
    await updatePlayerName(state, playerName);
  }
  return;
};
const handleMessage = createMessageHandler(state, {
  getPublicState: () => getPublicState(state),
  broadcastState,
  doConnectTwitch,
  doConnectAID,
  doUpdatePlayerName,
  handleStartVote,
  handleEndVote,
  handleTogglePause
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle YouTube content script messages synchronously
  if (message.type === 'YOUTUBE_CHAT_MESSAGE') {
    // Only process if user has configured a YouTube URL
    if (state.config.youtubeUrl) {
      handleYouTubeChatMessage(message.user, message.text);
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === 'YOUTUBE_CONNECTED') {
    handleYouTubeConnectedEvent(message.videoId);
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === 'YOUTUBE_DISCONNECTED') {
    handleYouTubeDisconnectedEvent();
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === 'YOUTUBE_DOM_ERROR') {
    // Only show error if user has configured a YouTube URL
    if (state.config.youtubeUrl) {
      handleYouTubeDOMErrorEvent(message.details);
    }
    sendResponse({ ok: true });
    return false;
  }
  // Handle other messages via the async handler
  handleMessage(message, sender).then(sendResponse);
  return true;
});
/**
 * Initializes the background service worker.
 * @returns {Promise<void>}
 */
const init = async () => {
  console.log('[AMP] Initializing...');
  await loadConfig(state);
  await loadLocalState(state);
  if (state.firebaseToken && state.shortId) {
    try {
      await doConnectAID();
    } catch (err) {
      console.log('[AID] Initial connection deferred:', err.message);
    }
  }
  if (state.config.twitchChannel && state.config.twitchOAuthToken) {
    try {
      doConnectTwitch();
    } catch (err) {
      console.log('[Twitch] Initial connection deferred:', err.message);
    }
  }
  console.log('[AMP] Ready');
  return;
};
init();
