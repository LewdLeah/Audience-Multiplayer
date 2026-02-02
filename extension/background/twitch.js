// Audience Multiplayer - Twitch Module
// Handles Twitch IRC WebSocket connection, OAuth, and message parsing
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').Config} Config */
/** @typedef {import('./types.js').TwitchMessage} TwitchMessage */
/** @typedef {import('./types.js').TwitchAuthResult} TwitchAuthResult */
import { TWITCH_CLIENT_ID, TWITCH_SCOPES, TWITCH_IRC_URL, TWITCH_BOT_NICK } from './constants.js';
export class TwitchError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'TwitchError';
  }
}
/**
 * Parses a Twitch IRC PRIVMSG line into user, text, and badge info.
 * Handles both tagged and untagged formats.
 * @param {string} line - Raw IRC line
 * @returns {TwitchMessage|null} Parsed message or null if not a PRIVMSG
 */
export const parseTwitchMessage = (line) => {
  // Tagged format: @badge-info=...;badges=broadcaster/1,moderator/1;... :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
  // Untagged format: :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
  let isBroadcaster = false;
  let isMod = false;
  // Extract badges from tags if present
  if (line.startsWith('@')) {
    const badgesMatch = line.match(/badges=([^;]*)/);
    if (badgesMatch) {
      const badges = badgesMatch[1].toLowerCase();
      isBroadcaster = badges.includes('broadcaster');
      isMod = badges.includes('moderator');
    }
  }
  // Extract user and message
  const match = line.match(/:(\w+)!.*PRIVMSG #\w+ :(.+)/);
  if (!match) {
    return null;
  }
  return {
    user: match[1],
    text: match[2].trim(),
    isBroadcaster,
    isMod
  };
};
/**
 * Disconnects from Twitch IRC if connected.
 * @param {State} state - Application state (mutated: twitchSocket)
 * @returns {void}
 */
export const disconnectTwitch = (state) => {
  if (state.twitchSocket) {
    state.twitchSocket.close();
    state.twitchSocket = null;
  }
  return;
};
/**
 * Sends a message to the configured Twitch channel.
 * @param {State} state - Application state
 * @param {string} message - Message to send
 * @returns {void}
 */
export const sendTwitchMessage = (state, message) => {
  if (state.twitchSocket?.readyState === WebSocket.OPEN && state.config.twitchChannel) {
    state.twitchSocket.send(`PRIVMSG #${state.config.twitchChannel.toLowerCase()} :${message}`);
  }
  return;
};
/**
 * Connects to Twitch IRC and joins the configured channel.
 * @param {State} state - Application state (mutated: twitchSocket)
 * @param {Config} config - User configuration
 * @param {function(string): void} onMessage - Called with each IRC line containing PRIVMSG
 * @throws {TwitchError} If missing channel or token
 * @returns {void}
 */
export const connectTwitch = (state, config, onMessage, onConnectionChange = () => {}) => {
  if (!config.twitchChannel || !config.twitchOAuthToken) {
    throw new TwitchError('Cannot connect - missing Twitch channel or OAuth token');
  }
  if (state.twitchSocket?.readyState === WebSocket.OPEN) {
    console.log('[Twitch] Already connected');
    return;
  }
  console.log('[Twitch] Connecting...');
  state.twitchSocket = new WebSocket(TWITCH_IRC_URL);
  state.twitchSocket.onopen = () => {
    console.log('[Twitch] Connected, authenticating...');
    // Request tags capability to get badge info for mod check
    state.twitchSocket.send('CAP REQ :twitch.tv/tags');
    state.twitchSocket.send(`PASS ${config.twitchOAuthToken}`);
    state.twitchSocket.send(`NICK ${TWITCH_BOT_NICK}`);
    state.twitchSocket.send(`JOIN #${config.twitchChannel.toLowerCase()}`);
    onConnectionChange();
  };
  state.twitchSocket.onmessage = (event) => {
    const lines = event.data.split('\r\n');
    for (const line of lines) {
      if (line.startsWith('PING')) {
        state.twitchSocket.send('PONG :tmi.twitch.tv');
      } else if (line.includes('PRIVMSG')) {
        onMessage(line);
      }
    }
  };
  state.twitchSocket.onclose = () => {
    console.log('[Twitch] Disconnected');
    state.twitchSocket = null;
    onConnectionChange();
  };
  state.twitchSocket.onerror = (err) => {
    console.error('[Twitch] Error:', err);
  };
  return;
};
/**
 * Initiates Twitch OAuth flow and stores the token.
 * @param {State} state - Application state
 * @param {function(State, Partial<Config>): Promise<void>} saveConfigFn - Function to save config
 * @returns {Promise<TwitchAuthResult>}
 */
export const authenticateTwitch = async (state, saveConfigFn, doConnectTwitch) => {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', TWITCH_SCOPES.join(' '));
  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });
    // Extract token from URL fragment: ...#access_token=xxx&token_type=bearer
    const fragment = new URL(responseUrl).hash.substring(1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      throw new Error('No access token in response');
    }
    // Store as oauth:token format for IRC
    const oauthToken = `oauth:${accessToken}`;
    await saveConfigFn(state, { twitchOAuthToken: oauthToken });
    console.log('[Twitch] OAuth successful');
    // Reconnect with new token using the proper handler
    disconnectTwitch(state);
    if (doConnectTwitch) {
      try {
        doConnectTwitch();
      } catch (err) {
        console.log('[Twitch] Post-auth connection deferred:', err.message);
      }
    }
    return { success: true };
  } catch (err) {
    console.error('[Twitch] OAuth error:', err);
    return { success: false, error: err.message };
  }
};
/**
 * Disconnects from Twitch and clears the OAuth token.
 * @param {State} state - Application state
 * @param {function(State, Partial<Config>): Promise<void>} saveConfigFn - Function to save config
 * @returns {Promise<TwitchAuthResult>}
 */
export const disconnectTwitchAuth = async (state, saveConfigFn) => {
  await saveConfigFn(state, { twitchOAuthToken: '' });
  disconnectTwitch(state);
  console.log('[Twitch] Disconnected and token cleared');
  return { success: true };
};
