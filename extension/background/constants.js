// Audience Multiplayer - Constants
// Centralized configuration values and magic numbers
// Token expiry buffer (55 minutes) - slightly less than full hour for safety
export const TOKEN_EXPIRY_DURATION_MS = 55 * 60 * 1000;
// Twitch configuration
export const TWITCH_CLIENT_ID = '23lk121a5jnaxjv6e2pjqrpl7y6b7t';
export const TWITCH_SCOPES = ['chat:read', 'chat:edit'];
export const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';
export const TWITCH_BOT_NICK = 'audiencemultiplayer';
// AI Dungeon environment-to-API mapping
const AID_API_MAP = {
  'play.aidungeon.com': 'api.aidungeon.com',
  'beta.aidungeon.com': 'api-beta.aidungeon.com',
  'alpha.aidungeon.com': 'api-alpha.aidungeon.com'
};
/**
 * Gets the GraphQL API URL for the given origin.
 * @param {string} [origin] - Origin hostname (e.g., "play.aidungeon.com")
 * @returns {string} The GraphQL URL
 */
export const getAidGraphqlUrl = (origin) => {
  const apiHost = AID_API_MAP[origin] || 'api.aidungeon.com';
  return `https://${apiHost}/graphql`;
};
/**
 * Gets the WebSocket URL for the given origin.
 * @param {string} [origin] - Origin hostname (e.g., "play.aidungeon.com")
 * @returns {string} The WebSocket URL
 */
export const getAidWsUrl = (origin) => {
  const apiHost = AID_API_MAP[origin] || 'api.aidungeon.com';
  return `wss://${apiHost}/graphql`;
};
export const AID_WS_PROTOCOL = 'graphql-transport-ws';
// OpenRouter configuration
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_REFERER = 'https://github.com/LewdLeah/Audience-Multiplayer';
export const OPENROUTER_TITLE = 'Audience Multiplayer';
// Submission limits
export const MAX_SUBMISSION_LENGTH = 200;
// Default values
export const DEFAULT_MODEL = 'deepseek/deepseek-v3.2';
export const DEFAULT_MODEL_NAME = 'DeepSeek: DeepSeek V3.2';
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/frontend/models/find?order=top-weekly';
export const DEFAULT_VOTE_DURATION_SECONDS = 40;
export const DEFAULT_MAX_TOKENS = 150;
export const DEFAULT_PLAYER_NAME = 'You';
export const DEFAULT_PARTY_MEMBER_NAME = 'Elara';
// Periodic voting limits
export const MIN_VOTE_DURATION_SECONDS = 5;
export const MIN_AUTO_REPEAT_SECONDS = 20;
