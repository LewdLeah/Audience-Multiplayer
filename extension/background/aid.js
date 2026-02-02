// Audience Multiplayer - AI Dungeon Module
// Handles AI Dungeon WebSocket connection and GraphQL API calls
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').AIDContext} AIDContext */
/** @typedef {import('./types.js').Config} Config */
import {
  getAidGraphqlUrl,
  getAidWsUrl,
  AID_WS_PROTOCOL,
  DEFAULT_PLAYER_NAME,
  DEFAULT_PARTY_MEMBER_NAME
} from './constants.js';
export class AIDError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'AIDError';
  }
}
/**
 * Disconnects from AI Dungeon WebSocket if connected.
 * @param {State} state - Application state (mutated: aidSocket)
 * @returns {void}
 */
export const disconnectAID = (state) => {
  if (state.aidSocket) {
    // Store reference before nulling to allow onclose handler to identify stale socket
    const socket = state.aidSocket;
    state.aidSocket = null;
    socket.close();
  }
  // Clear playerId to prevent stale IDs when switching adventures
  state.playerId = null;
  return;
};
/**
 * Subscribes to contextUpdate for the current adventure.
 * @param {State} state - Application state
 * @returns {void}
 */
const subscribeToContext = (state) => {
  if (!state.aidSocket || state.aidSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  const subscribeMsg = {
    id: crypto.randomUUID(),
    type: 'subscribe',
    payload: {
      query: `subscription ContextUpdate($shortId: String!) {
        contextUpdate(shortId: $shortId) {
          adventureId
          actionId
          key
          time
          contextSections
          memories
          versionInfo
          approximateAdventureTokens
        }
      }`,
      variables: { shortId: state.shortId }
    }
  };
  state.aidSocket.send(JSON.stringify(subscribeMsg));
  console.log('[AID] Subscribed to contextUpdate for:', state.shortId);
  return;
};
/**
 * Connects to AI Dungeon WebSocket and subscribes to context updates.
 * @param {State} state - Application state (mutated: aidSocket, context)
 * @param {function(): void} onContextUpdate - Called when context is updated
 * @throws {AIDError} If missing token or shortId
 * @returns {void}
 */
export const connectAID = (state, onContextUpdate) => {
  if (!state.firebaseToken || !state.shortId) {
    throw new AIDError('Cannot connect - missing Firebase token or adventure shortId');
  }
  if (state.aidSocket?.readyState === WebSocket.OPEN) {
    console.log('[AID] Already connected');
    return;
  }
  const wsUrl = getAidWsUrl(state.aidOrigin);
  console.log('[AID] Connecting to WebSocket:', wsUrl);
  const socket = new WebSocket(wsUrl, AID_WS_PROTOCOL);
  state.aidSocket = socket;
  socket.onopen = () => {
    // Check if this socket is still the current one
    if (state.aidSocket !== socket) {
      return;
    }
    console.log('[AID] WebSocket connected');
    socket.send(JSON.stringify({
      type: 'connection_init',
      payload: { Authorization: `firebase ${state.firebaseToken}` }
    }));
  };
  socket.onmessage = (event) => {
    if (state.aidSocket !== socket) {
      return;
    }
    const msg = JSON.parse(event.data);
    if (msg.type === 'connection_ack') {
      console.log('[AID] Connection acknowledged, subscribing...');
      subscribeToContext(state);
      onContextUpdate();
    } else if (msg.type === 'next' && msg.payload?.data?.contextUpdate) {
      state.context = msg.payload.data.contextUpdate;
      const sections = state.context.contextSections || [];
      const sectionTypes = sections.map(s => s.type);
      const hasText = sections.filter(s => s.text).length;
      console.log('[AID] Context updated:', sections.length, 'sections:', sectionTypes, '| with text:', hasText);
      onContextUpdate();
    } else if (msg.type === 'error') {
      console.error('[AID] GraphQL error:', msg.payload);
    }
  };
  socket.onclose = () => {
    console.log('[AID] WebSocket closed');
    if (state.aidSocket === socket) {
      state.aidSocket = null;
      onContextUpdate();
    }
  };
  socket.onerror = (err) => {
    console.error('[AID] WebSocket error:', err);
  };
  return;
};
/**
 * Fetches the adventure ID from the shortId.
 * @param {State} state - Application state
 * @returns {Promise<string>} The adventure ID
 * @throws {AIDError} If fetch fails or adventure not found
 */
export const fetchAdventureId = async (state) => {
  if (!state.firebaseToken || !state.shortId) {
    throw new AIDError('Cannot fetch adventure - missing token or shortId');
  }
  const query = `
    query GetAdventure($shortId: String) {
      adventure(shortId: $shortId) {
        id
      }
    }
  `;
  const graphqlUrl = getAidGraphqlUrl(state.aidOrigin);
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `firebase ${state.firebaseToken}`
    },
    body: JSON.stringify({
      operationName: 'GetAdventure',
      query,
      variables: { shortId: state.shortId }
    })
  });
  if (!response.ok) {
    throw new AIDError(`Failed to fetch adventure: HTTP ${response.status}`);
  }
  const result = await response.json();
  if (!result.data?.adventure?.id) {
    throw new AIDError('Adventure not found');
  }
  console.log('[AID] Fetched adventureId:', result.data.adventure.id);
  return result.data.adventure.id;
};
/**
 * Fetches the most recent action from the adventure.
 * @param {State} state - Application state
 * @returns {Promise<string|null>} The most recent action text, or null
 */
export const fetchMostRecentAction = async (state) => {
  console.log('[AID] Fetching most recent action...');
  if (!state.firebaseToken || !state.shortId) {
    console.log('[AID] Cannot fetch recent action - missing token or shortId');
    return null;
  }
  const graphqlUrl = getAidGraphqlUrl(state.aidOrigin);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `firebase ${state.firebaseToken}`
  };
  try {
    // First get the action count
    const countQuery = `
      query GetActionCount($shortId: String) {
        adventure(shortId: $shortId) {
          actionCount
        }
      }
    `;
    const countResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operationName: 'GetActionCount',
        query: countQuery,
        variables: { shortId: state.shortId }
      })
    });
    if (!countResponse.ok) {
      console.warn('[AID] Failed to fetch action count: HTTP', countResponse.status);
      return null;
    }
    const countResult = await countResponse.json();
    const actionCount = countResult.data?.adventure?.actionCount || 0;
    if (actionCount === 0) {
      console.log('[AID] No actions in adventure');
      return null;
    }
    // Fetch last 5 actions using offset
    const offset = Math.max(0, actionCount - 5);
    const actionsQuery = `
      query GetRecentActions($shortId: String, $offset: Int) {
        adventure(shortId: $shortId) {
          actionWindow(limit: 5, offset: $offset) {
            type
            text
          }
        }
      }
    `;
    const actionsResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operationName: 'GetRecentActions',
        query: actionsQuery,
        variables: { shortId: state.shortId, offset }
      })
    });
    if (!actionsResponse.ok) {
      console.warn('[AID] Failed to fetch recent actions: HTTP', actionsResponse.status);
      return null;
    }
    const actionsResult = await actionsResponse.json();
    const actions = actionsResult.data?.adventure?.actionWindow || [];
    console.log('[AID] Got', actions.length, 'actions (offset:', offset, 'of', actionCount, ')');
    // Get the most recent action (last in array)
    const validTypes = ['do', 'say', 'story', 'start', 'continue'];
    const recentAction = actions.findLast(a => validTypes.includes(a.type));
    if (typeof recentAction?.text === 'string') {
      const text = recentAction.text.trim();
      console.log('[AID] Fetched recent action:', recentAction.type, '-', text.substring(0, 50) + '...');
      return text;
    }
    console.log('[AID] No valid recent action found');
    return null;
  } catch (err) {
    console.error('[AID] Error fetching recent action:', err);
    return null;
  }
};
/**
 * Ensures the adventure is in third-person mode.
 * @param {State} state - Application state
 * @param {string} adventureId - The adventure ID
 * @returns {Promise<boolean>} True if mode was changed, false if already set
 * @throws {AIDError} If update fails
 */
export const ensureThirdPerson = async (state, adventureId) => {
  if (!state.firebaseToken || !state.shortId || !adventureId) {
    throw new AIDError('Cannot check third-person - missing required data');
  }
  const graphqlUrl = getAidGraphqlUrl(state.aidOrigin);
  // Query current adventure state
  const query = `
    query GetAdventure($shortId: String) {
      adventure(shortId: $shortId) {
        id
        thirdPerson
      }
    }
  `;
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `firebase ${state.firebaseToken}`
    },
    body: JSON.stringify({
      operationName: 'GetAdventure',
      query,
      variables: { shortId: state.shortId }
    })
  });
  if (!response.ok) {
    throw new AIDError(`Failed to check third-person: HTTP ${response.status}`);
  }
  const result = await response.json();
  const adventure = result.data?.adventure;
  if (!adventure) {
    throw new AIDError('Adventure not found for third-person check');
  }
  if (adventure.thirdPerson === true) {
    console.log('[AID] Third person already enabled');
    return false;
  }
  console.log('[AID] Enabling third person...');
  const mutation = `
    mutation UpdateAdventurePlot($input: AdventurePlotInput) {
      updateAdventurePlot(input: $input) {
        adventure {
          id
          thirdPerson
        }
        success
      }
    }
  `;
  const updateResponse = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `firebase ${state.firebaseToken}`
    },
    body: JSON.stringify({
      operationName: 'UpdateAdventurePlot',
      query: mutation,
      variables: {
        input: {
          shortId: state.shortId,
          thirdPerson: true
        }
      }
    })
  });
  if (!updateResponse.ok) {
    throw new AIDError(`Failed to enable third-person: HTTP ${updateResponse.status}`);
  }
  const updateResult = await updateResponse.json();
  if (!updateResult.data?.updateAdventurePlot?.success) {
    throw new AIDError('Failed to enable third-person mode');
  }
  console.log('[AID] Third person enabled');
  return true;
};
/**
 * Resolves the player's character name with fallbacks.
 * @param {Config} config - User configuration
 * @returns {string} Resolved player character name
 */
export const getResolvedPlayerName = (config) => {
  return config.playerCharacterName || config.twitchChannel || DEFAULT_PLAYER_NAME;
};
/**
 * Resolves the party member's character name with fallbacks.
 * @param {Config} config - User configuration
 * @returns {string} Resolved party member name
 */
export const getResolvedPartyName = (config) => {
  return config.partyMemberName || DEFAULT_PARTY_MEMBER_NAME;
};
/**
 * Fetches the current user's player ID from the adventure.
 * @param {State} state - Application state (mutated: playerId)
 * @returns {Promise<string|null>} The player ID or null if not found
 */
export const fetchPlayerId = async (state) => {
  if (!state.firebaseToken || !state.shortId) {
    console.log('[AID] Cannot fetch playerId - missing token or shortId');
    return null;
  }
  const graphqlUrl = getAidGraphqlUrl(state.aidOrigin);
  // Query both the current user (via user() with no args) and the adventure's players
  const query = `
    query GetCurrentUserAndPlayers($shortId: String) {
      user {
        id
      }
      adventure(shortId: $shortId) {
        id
        allPlayers {
          id
          userId
          characterName
        }
      }
    }
  `;
  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `firebase ${state.firebaseToken}`
      },
      body: JSON.stringify({
        operationName: 'GetCurrentUserAndPlayers',
        query,
        variables: { shortId: state.shortId }
      })
    });
    if (!response.ok) {
      console.warn('[AID] Failed to fetch players: HTTP', response.status);
      return null;
    }
    const result = await response.json();
    const currentUserId = result.data?.user?.id;
    const adventure = result.data?.adventure;
    if (!currentUserId) {
      console.warn('[AID] Could not get current user ID');
      return null;
    }
    if (!adventure) {
      console.warn('[AID] Adventure not found for player lookup');
      return null;
    }
    // Find the player that matches the current authenticated user
    const players = adventure.allPlayers || [];
    const myPlayer = players.find(p => p.userId === currentUserId);
    if (!myPlayer) {
      console.warn('[AID] Could not find matching player for user:', currentUserId, 'in players:', players.map(p => p.userId));
      return null;
    }
    state.playerId = myPlayer.id;
    console.log('[AID] Found playerId:', myPlayer.id, 'characterName:', myPlayer.characterName);
    return myPlayer.id;
  } catch (err) {
    console.error('[AID] Error fetching playerId:', err);
    return null;
  }
};
/**
 * Updates the player's character name via GraphQL mutation.
 * @param {State} state - Application state
 * @param {string} characterName - New character name
 * @returns {Promise<boolean>} True if update succeeded
 */
export const updatePlayerName = async (state, characterName) => {
  if (!state.firebaseToken || !state.playerId) {
    console.log('[AID] Cannot update player name - missing token or playerId');
    return false;
  }
  const graphqlUrl = getAidGraphqlUrl(state.aidOrigin);
  const mutation = `
    mutation UpdatePlayer($input: PlayerInput!) {
      updatePlayer(input: $input) {
        success
        message
        player {
          id
          characterName
        }
      }
    }
  `;
  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `firebase ${state.firebaseToken}`
      },
      body: JSON.stringify({
        operationName: 'UpdatePlayer',
        query: mutation,
        variables: {
          input: {
            id: state.playerId,
            characterName
          }
        }
      })
    });
    if (!response.ok) {
      console.warn('[AID] Failed to update player name: HTTP', response.status);
      return false;
    }
    const result = await response.json();
    if (!result.data?.updatePlayer?.success) {
      console.warn('[AID] Player name update failed:', result.data?.updatePlayer?.message);
      return false;
    }
    console.log('[AID] Player name updated to:', characterName);
    return true;
  } catch (err) {
    console.error('[AID] Error updating player name:', err);
    return false;
  }
};
/**
 * Submits an action to AI Dungeon with the party member's character name.
 * @param {State} state - Application state
 * @param {string} actionText - The action text to submit
 * @param {function(string): void} sendTwitchMessage - Function to send Twitch message
 * @returns {Promise<void>}
 * @throws {AIDError} If submission fails
 */
export const submitToAID = async (state, actionText, sendTwitchMessage) => {
  if (!state.firebaseToken || !state.shortId) {
    throw new AIDError('Cannot submit - missing Firebase token or adventure shortId');
  }
  let adventureId = state.context?.adventureId;
  if (!adventureId) {
    console.log('[AID] No adventureId from context, fetching...');
    adventureId = await fetchAdventureId(state);
  }
  // Ensure third person is enabled before submitting
  await ensureThirdPerson(state, adventureId);
  // Get the party member name to use for this action
  const partyName = getResolvedPartyName(state.config);
  console.log('[AID] Submitting with characterName:', partyName);
  const graphqlUrl = getAidGraphqlUrl(state.aidOrigin);
  const key = crypto.randomUUID();
  const mutation = `
    mutation ActionRequest($input: ActionRequestInput!) {
      actionRequest(input: $input) {
        success
        message
        errorContext
      }
    }
  `;
  console.log('[AID] Submitting action:', { adventureId, type: 'do', text: actionText, characterName: partyName, key });
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `firebase ${state.firebaseToken}`
    },
    body: JSON.stringify({
      operationName: 'ActionRequest',
      query: mutation,
      variables: {
        input: {
          adventureId: String(adventureId),
          type: 'do',
          text: actionText,
          characterName: partyName,
          key
        }
      }
    })
  });
  if (!response.ok) {
    throw new AIDError(`Failed to submit action: HTTP ${response.status}`);
  }
  const result = await response.json();
  if (result.errors) {
    throw new AIDError(result.errors[0]?.message || 'GraphQL error during submission');
  }
  if (!result.data?.actionRequest?.success) {
    throw new AIDError(result.data?.actionRequest?.message || 'Action rejected by AI Dungeon');
  }
  console.log('[AID] Action submitted successfully');
  sendTwitchMessage('✅ Action submitted to AI Dungeon!');
};
