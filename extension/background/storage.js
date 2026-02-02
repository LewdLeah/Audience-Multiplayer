// Audience Multiplayer - Storage Module
// Handles chrome.storage.sync (config) and chrome.storage.local (state)
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').Config} Config */
/**
 * Loads user configuration from chrome.storage.sync into state.
 * @param {State} state - Application state (mutated: state.config)
 * @returns {Promise<void>}
 */
export const loadConfig = async (state) => {
  const stored = await chrome.storage.sync.get([
    'openRouterApiKey', 'model', 'twitchChannel', 'twitchOAuthToken',
    'voteDurationSeconds', 'maxTokens', 'debugMode',
    'playerCharacterName', 'partyMemberName', 'youtubeUrl', 'autoRepeatCooldownSeconds'
  ]);
  state.config = { ...state.config, ...stored };
  console.log('[Config] Loaded:', Object.keys(stored).length, 'keys');
  return;
};
/**
 * Saves configuration updates to chrome.storage.sync and state.
 * @param {State} state - Application state (mutated: state.config)
 * @param {Partial<Config>} updates - Config fields to update
 * @returns {Promise<void>}
 */
export const saveConfig = async (state, updates) => {
  await chrome.storage.sync.set(updates);
  state.config = { ...state.config, ...updates };
  console.log('[Config] Saved:', Object.keys(updates));
  return;
};
/**
 * Loads persisted local state (token, shortId) from chrome.storage.local.
 * @param {State} state - Application state (mutated: firebaseToken, tokenExpiry, shortId)
 * @returns {Promise<void>}
 */
export const loadLocalState = async (state) => {
  const stored = await chrome.storage.local.get(['firebaseToken', 'tokenExpiry', 'shortId', 'aidOrigin', 'playerId']);
  if (stored.firebaseToken) {
    state.firebaseToken = stored.firebaseToken;
  }
  if (stored.tokenExpiry) {
    state.tokenExpiry = stored.tokenExpiry;
  }
  if (stored.shortId) {
    state.shortId = stored.shortId;
  }
  if (stored.aidOrigin) {
    state.aidOrigin = stored.aidOrigin;
  }
  if (stored.playerId) {
    state.playerId = stored.playerId;
  }
  return;
};
/**
 * Saves current local state (token, shortId) to chrome.storage.local.
 * @param {State} state - Application state to persist
 * @returns {Promise<void>}
 */
export const saveLocalState = async (state) => {
  await chrome.storage.local.set({
    firebaseToken: state.firebaseToken,
    tokenExpiry: state.tokenExpiry,
    shortId: state.shortId,
    aidOrigin: state.aidOrigin,
    playerId: state.playerId
  });
  return;
};
