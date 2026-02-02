// Audience Multiplayer - Message Handler
// Routes messages from popup and content scripts to appropriate handlers
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').Config} Config */
import { TOKEN_EXPIRY_DURATION_MS } from './constants.js';
import { saveConfig, saveLocalState } from './storage.js';
import { disconnectTwitch, authenticateTwitch, disconnectTwitchAuth } from './twitch.js';
import { disconnectAID } from './aid.js';
/**
 * Creates a message handler with injected dependencies.
 * @param {State} state - Application state
 * @param {Object} deps - Handler dependencies
 * @param {function(): Object} deps.getPublicState - Get serializable state
 * @param {function(): void} deps.broadcastState - Broadcast state to popup
 * @param {function(): void} deps.doConnectTwitch - Connect to Twitch
 * @param {function(): Promise<void>} deps.doConnectAID - Connect to AI Dungeon
 * @param {function(): Promise<void>} deps.doUpdatePlayerName - Update player character name
 * @param {function(): void} deps.handleStartVote - Start voting phase
 * @param {function(): void} deps.handleEndVote - End voting phase
 * @param {function(): void} deps.handleTogglePause - Toggle pause state
 * @returns {function(Object, chrome.runtime.MessageSender): Promise<Object>}
 */
export const createMessageHandler = (state, deps) => {
  const {
    getPublicState,
    broadcastState,
    doConnectTwitch,
    doConnectAID,
    doUpdatePlayerName,
    handleStartVote,
    handleEndVote,
    handleTogglePause
  } = deps;
  /**
   * Handles messages from popup and content scripts.
   * @param {Object} message - The message object
   * @param {chrome.runtime.MessageSender} sender - Message sender info
   * @returns {Promise<Object>} Response object
   */
  return async (message, sender) => {
    switch (message.type) {
      case 'TOKEN_UPDATE':
        return handleTokenUpdate(state, message, doConnectAID);
      case 'SHORTID_UPDATE':
        return handleShortIdUpdate(state, message, doConnectAID);
      case 'GET_STATE':
        return getPublicState();
      case 'SAVE_CONFIG':
        return handleSaveConfig(state, message, doConnectTwitch, doUpdatePlayerName, broadcastState);
      case 'START_VOTE':
        handleStartVote();
        return { success: true };
      case 'END_VOTE':
        handleEndVote();
        return { success: true };
      case 'TOGGLE_PAUSE':
        handleTogglePause();
        return { success: true };
      case 'CONNECT_TWITCH':
        return handleConnectTwitch(doConnectTwitch);
      case 'DISCONNECT_TWITCH':
        disconnectTwitch(state);
        return { success: true };
      case 'TWITCH_AUTH':
        return await authenticateTwitch(state, saveConfig, doConnectTwitch);
      case 'TWITCH_LOGOUT':
        return await disconnectTwitchAuth(state, saveConfig);
      default:
        return { error: 'Unknown message type' };
    }
  };
};
/**
 * Handles TOKEN_UPDATE from content script.
 * @param {State} state
 * @param {Object} message
 * @param {function(): Promise<void>} doConnectAID
 * @returns {Promise<Object>}
 */
const handleTokenUpdate = async (state, message, doConnectAID) => {
  state.firebaseToken = message.token;
  state.tokenExpiry = Date.now() + TOKEN_EXPIRY_DURATION_MS;
  if (message.origin) {
    state.aidOrigin = message.origin;
  }
  await saveLocalState(state);
  console.log('[Token] Updated from content script, origin:', state.aidOrigin);
  try {
    await doConnectAID();
  } catch (err) {
    console.log('[AID] Connection deferred:', err.message);
  }
  return { success: true };
};
/**
 * Handles SHORTID_UPDATE from content script.
 * @param {State} state
 * @param {Object} message
 * @param {function(): Promise<void>} doConnectAID
 * @returns {Promise<Object>}
 */
const handleShortIdUpdate = async (state, message, doConnectAID) => {
  const shortIdChanged = state.shortId !== message.shortId;
  const originChanged = message.origin && state.aidOrigin !== message.origin;
  if (shortIdChanged || originChanged) {
    state.shortId = message.shortId;
    if (message.origin) {
      state.aidOrigin = message.origin;
    }
    await saveLocalState(state);
    console.log('[ShortId] Updated:', state.shortId, 'origin:', state.aidOrigin);
    disconnectAID(state);
    try {
      await doConnectAID();
    } catch (err) {
      console.log('[AID] Connection deferred:', err.message);
    }
  }
  return { success: true };
};
/**
 * Handles SAVE_CONFIG from popup.
 * @param {State} state
 * @param {Object} message
 * @param {function(): void} doConnectTwitch
 * @param {function(): Promise<void>} doUpdatePlayerName
 * @param {function(): void} broadcastState
 * @returns {Promise<Object>}
 */
const handleSaveConfig = async (state, message, doConnectTwitch, doUpdatePlayerName, broadcastState) => {
  const oldChannel = state.config.twitchChannel;
  const oldToken = state.config.twitchOAuthToken;
  const oldPlayerName = state.config.playerCharacterName;
  await saveConfig(state, message.config);
  // Broadcast updated state to popup so UI reflects changes immediately
  broadcastState();
  // Reconnect Twitch if channel or token changed
  const channelChanged = message.config.twitchChannel !== undefined && message.config.twitchChannel !== oldChannel;
  const tokenChanged = message.config.twitchOAuthToken !== undefined && message.config.twitchOAuthToken !== oldToken;
  if (channelChanged || tokenChanged) {
    disconnectTwitch(state);
    try {
      doConnectTwitch();
    } catch (err) {
      console.log('[Twitch] Connection deferred:', err.message);
    }
  }
  // Update player character name in AID if it changed
  const playerNameChanged = message.config.playerCharacterName !== undefined && message.config.playerCharacterName !== oldPlayerName;
  if (playerNameChanged) {
    try {
      await doUpdatePlayerName();
    } catch (err) {
      console.log('[AID] Player name update deferred:', err.message);
    }
  }
  return { success: true };
};
/**
 * Handles CONNECT_TWITCH from popup.
 * @param {function(): void} doConnectTwitch
 * @returns {Object}
 */
const handleConnectTwitch = (doConnectTwitch) => {
  try {
    doConnectTwitch();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
