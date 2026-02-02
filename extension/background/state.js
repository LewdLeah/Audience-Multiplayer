// Audience Multiplayer - State Management
// Explicit state transitions and mutations
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').Config} Config */
/** @typedef {import('./types.js').Submission} Submission */
import {
  DEFAULT_MODEL,
  DEFAULT_VOTE_DURATION_SECONDS,
  DEFAULT_MAX_TOKENS
} from './constants.js';
/**
 * Creates the initial application state.
 * @returns {State}
 */
export const createInitialState = () => ({
  phase: 'idle',
  submissions: [],
  context: null,
  shortId: null,
  aidOrigin: null,
  firebaseToken: null,
  tokenExpiry: null,
  twitchSocket: null,
  aidSocket: null,
  voteTimer: null,
  autoRepeatTimer: null,
  voteEndTime: null,
  nextVoteStartTime: null,
  isPaused: false,
  pausedVoteRemaining: null,
  pausedAutoRepeatRemaining: null,
  playerId: null,
  lastAICall: null,
  youtubeConnected: false,
  youtubeVideoId: null,
  youtubeError: null,
  config: {
    openRouterApiKey: '',
    model: DEFAULT_MODEL,
    twitchChannel: '',
    twitchOAuthToken: '',
    voteDurationSeconds: DEFAULT_VOTE_DURATION_SECONDS,
    maxTokens: DEFAULT_MAX_TOKENS,
    debugMode: false,
    playerCharacterName: '',
    partyMemberName: '',
    youtubeUrl: '',
    autoRepeatCooldownSeconds: null
  }
});
/**
 * Transitions to vote phase. Only valid from idle.
 * @param {State} state
 * @returns {boolean} True if transition succeeded
 */
export const transitionToVote = (state) => {
  if (state.phase !== 'idle') {
    console.log('[State] Cannot transition to vote - current phase:', state.phase);
    return false;
  }
  state.phase = 'vote';
  state.submissions = [];
  console.log('[State] Transitioned: idle -> vote');
  return true;
};
/**
 * Transitions to combine phase. Only valid from vote.
 * @param {State} state
 * @returns {boolean} True if transition succeeded
 */
export const transitionToCombine = (state) => {
  if (state.phase !== 'vote') {
    console.log('[State] Cannot transition to combine - current phase:', state.phase);
    return false;
  }
  if (state.voteTimer) {
    clearTimeout(state.voteTimer);
    state.voteTimer = null;
  }
  state.phase = 'combine';
  console.log('[State] Transitioned: vote -> combine');
  return true;
};
/**
 * Transitions to idle phase. Valid from any phase.
 * @param {State} state
 * @returns {void}
 */
export const transitionToIdle = (state) => {
  const oldPhase = state.phase;
  if (state.voteTimer) {
    clearTimeout(state.voteTimer);
    state.voteTimer = null;
  }
  state.voteEndTime = null;
  state.phase = 'idle';
  console.log('[State] Transitioned:', oldPhase, '-> idle');
  return;
};
/**
 * Sets the auto-repeat timer handle.
 * @param {State} state
 * @param {number|null} timer
 * @returns {void}
 */
export const setAutoRepeatTimer = (state, timer) => {
  state.autoRepeatTimer = timer;
  return;
};
/**
 * Clears the auto-repeat timer if running.
 * @param {State} state
 * @returns {void}
 */
export const clearAutoRepeatTimer = (state) => {
  if (state.autoRepeatTimer) {
    clearTimeout(state.autoRepeatTimer);
    state.autoRepeatTimer = null;
  }
  state.nextVoteStartTime = null;
  return;
};
/**
 * Updates the Firebase token and expiry.
 * @param {State} state
 * @param {string} token
 * @param {number} expiry
 * @returns {void}
 */
export const setFirebaseToken = (state, token, expiry) => {
  state.firebaseToken = token;
  state.tokenExpiry = expiry;
  console.log('[State] Firebase token updated, expires:', new Date(expiry).toISOString());
  return;
};
/**
 * Updates the adventure shortId.
 * @param {State} state
 * @param {string} shortId
 * @returns {boolean} True if shortId changed
 */
export const setShortId = (state, shortId) => {
  if (state.shortId === shortId) {
    return false;
  }
  state.shortId = shortId;
  console.log('[State] ShortId updated:', shortId);
  return true;
};
/**
 * Updates the AI Dungeon context.
 * @param {State} state
 * @param {import('./types.js').AIDContext} context
 * @returns {void}
 */
export const setContext = (state, context) => {
  state.context = context;
  console.log('[State] Context updated:', context.contextSections?.length || 0, 'sections');
  return;
};
/**
 * Merges config updates into state.
 * @param {State} state
 * @param {Partial<Config>} updates
 * @returns {void}
 */
export const updateConfig = (state, updates) => {
  state.config = { ...state.config, ...updates };
  console.log('[State] Config updated:', Object.keys(updates));
  return;
};
/**
 * Sets the Twitch socket reference.
 * @param {State} state
 * @param {WebSocket|null} socket
 * @returns {void}
 */
export const setTwitchSocket = (state, socket) => {
  state.twitchSocket = socket;
  return;
};
/**
 * Sets the AID socket reference.
 * @param {State} state
 * @param {WebSocket|null} socket
 * @returns {void}
 */
export const setAIDSocket = (state, socket) => {
  state.aidSocket = socket;
  return;
};
/**
 * Sets the player ID for the current adventure.
 * @param {State} state
 * @param {string|null} playerId
 * @returns {void}
 */
export const setPlayerId = (state, playerId) => {
  state.playerId = playerId;
  console.log('[State] PlayerId updated:', playerId);
  return;
};
/**
 * Sets the vote timer handle.
 * @param {State} state
 * @param {number|null} timer
 * @returns {void}
 */
export const setVoteTimer = (state, timer) => {
  state.voteTimer = timer;
  return;
};
/**
 * Sets YouTube connected state.
 * @param {State} state
 * @param {string} videoId
 * @returns {void}
 */
export const setYouTubeConnected = (state, videoId) => {
  state.youtubeConnected = true;
  state.youtubeVideoId = videoId;
  state.youtubeError = null;
  console.log('[State] YouTube connected:', videoId);
  return;
};
/**
 * Sets YouTube disconnected state.
 * @param {State} state
 * @returns {void}
 */
export const setYouTubeDisconnected = (state) => {
  state.youtubeConnected = false;
  state.youtubeVideoId = null;
  console.log('[State] YouTube disconnected');
  return;
};
/**
 * Sets YouTube DOM error state.
 * @param {State} state
 * @param {import('./types.js').YouTubeDOMError} error
 * @returns {void}
 */
export const setYouTubeError = (state, error) => {
  state.youtubeConnected = false;
  state.youtubeError = error;
  console.log('[State] YouTube error:', error.message);
  return;
};
/**
 * Returns a serializable snapshot of state for the popup.
 * @param {State} state
 * @returns {Object} Public state object
 */
export const getPublicState = (state) => {
  // Serialize submissions with votes as arrays (Sets don't serialize to JSON)
  const serializedSubmissions = state.submissions.slice(0, 50).map(s => ({
    user: s.user,
    text: s.text,
    timestamp: s.timestamp,
    voteCount: s.debugVoteCount || s.votes.size
  }));
  return {
    phase: state.phase,
    submissionCount: state.submissions.length,
    submissions: serializedSubmissions,
    hasContext: !!state.context,
    shortId: state.shortId,
    hasToken: !!state.firebaseToken,
    twitchConnected: state.twitchSocket?.readyState === WebSocket.OPEN,
    aidConnected: state.aidSocket?.readyState === WebSocket.OPEN,
    youtubeConnected: state.youtubeConnected,
    youtubeVideoId: state.youtubeVideoId,
    youtubeError: state.youtubeError,
    lastAICall: state.lastAICall,
    voteEndTime: state.voteEndTime,
    nextVoteStartTime: state.nextVoteStartTime,
    isPaused: state.isPaused,
    pausedVoteRemaining: state.pausedVoteRemaining,
    pausedAutoRepeatRemaining: state.pausedAutoRepeatRemaining,
    config: {
      twitchChannel: state.config.twitchChannel,
      model: state.config.model,
      voteDurationSeconds: state.config.voteDurationSeconds,
      autoRepeatCooldownSeconds: state.config.autoRepeatCooldownSeconds,
      hasOpenRouterKey: !!state.config.openRouterApiKey,
      hasTwitchToken: !!state.config.twitchOAuthToken,
      debugMode: !!state.config.debugMode,
      playerCharacterName: state.config.playerCharacterName,
      partyMemberName: state.config.partyMemberName,
      youtubeUrl: state.config.youtubeUrl
    }
  };
};
