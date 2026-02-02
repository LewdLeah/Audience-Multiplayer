// Audience Multiplayer - Type Definitions
// JSDoc typedefs for shared types across background modules
/**
 * User configuration stored in chrome.storage.sync.
 * @typedef {Object} Config
 * @property {string} openRouterApiKey - OpenRouter API key for LLM calls
 * @property {string} model - Model identifier (e.g. 'deepseek/deepseek-chat')
 * @property {string} twitchChannel - Twitch channel name to join
 * @property {string} twitchOAuthToken - OAuth token for Twitch IRC (format: 'oauth:xxx')
 * @property {number} voteDurationSeconds - How long voting phase lasts
 * @property {number} maxTokens - Max tokens for LLM responses
 * @property {boolean} debugMode - Enable debug features (duplicate votes, etc.)
 * @property {string} playerCharacterName - Streamer's character name in the story
 * @property {string} partyMemberName - Character name for Twitch chat actions
 * @property {string} youtubeUrl - YouTube livestream URL (optional)
 * @property {number|null} autoRepeatCooldownSeconds - Seconds after vote ends before next auto-vote (null = disabled)
 */
/**
 * A user submission during the vote phase.
 * @typedef {Object} Submission
 * @property {string} user - Username who submitted
 * @property {string} text - The action text
 * @property {number} timestamp - Unix timestamp of submission
 * @property {Set<string>} votes - Set of usernames who voted for this
 * @property {number} [debugVoteCount] - Debug mode vote counter (bypasses Set dedup)
 */
/**
 * Context update received from AI Dungeon WebSocket.
 * @typedef {Object} AIDContext
 * @property {string} adventureId - The adventure's internal ID
 * @property {string} actionId - Current action ID
 * @property {string} key - Context key
 * @property {number} time - Timestamp
 * @property {Array<{type: string, text: string}>} contextSections - Story sections
 * @property {Array} memories - Adventure memories
 * @property {Object} versionInfo - Version metadata
 * @property {number} approximateAdventureTokens - Token count estimate
 */
/**
 * Application state for the background service worker.
 * @typedef {Object} State
 * @property {'idle'|'vote'|'combine'} phase - Current phase of the voting cycle
 * @property {Submission[]} submissions - Current submissions in this vote cycle
 * @property {AIDContext|null} context - Latest context update from AI Dungeon
 * @property {string|null} shortId - Current adventure shortId from URL
 * @property {string|null} aidOrigin - Origin hostname (e.g., "play.aidungeon.com")
 * @property {string|null} firebaseToken - Firebase auth token for AID API
 * @property {number|null} tokenExpiry - Token expiry timestamp
 * @property {WebSocket|null} twitchSocket - Twitch IRC WebSocket connection
 * @property {WebSocket|null} aidSocket - AI Dungeon GraphQL WebSocket connection
 * @property {number|null} voteTimer - setTimeout handle for vote duration
 * @property {number|null} autoRepeatTimer - setTimeout handle for auto-repeat delay
 * @property {number|null} voteEndTime - Timestamp when current vote phase ends
 * @property {number|null} nextVoteStartTime - Timestamp when next auto vote starts
 * @property {boolean} isPaused - Whether voting is paused
 * @property {number|null} pausedVoteRemaining - Remaining ms in vote phase when paused
 * @property {number|null} pausedAutoRepeatRemaining - Remaining ms until next auto vote when paused
 * @property {string|null} playerId - Current player's ID from the adventure
 * @property {Config} config - User configuration
 * @property {AICallDebug|null} lastAICall - Debug info for last OpenRouter call
 * @property {boolean} youtubeConnected - YouTube tab detected and chat readable
 * @property {string|null} youtubeVideoId - Current YouTube video ID
 * @property {YouTubeDOMError|null} youtubeError - DOM breakage error details
 */
/**
 * Debug info for the "Combined" call.
 * @typedef {Object} AICallDebug
 * @property {string} systemPrompt - The system prompt used
 * @property {string} userPrompt - The user prompt sent to OpenRouter
 * @property {string} response - The AI's response
 * @property {string} model - Model used for the call
 * @property {number} timestamp - When the call was made
 */
/**
 * Callbacks passed to modules for cross-cutting concerns.
 * @typedef {Object} Callbacks
 * @property {function(): void} broadcastState - Notify popup/UI of state change
 * @property {function(string): void} sendTwitchMessage - Send a message to Twitch chat
 */
/**
 * Parsed Twitch IRC PRIVMSG.
 * @typedef {Object} TwitchMessage
 * @property {string} user - Username who sent the message
 * @property {string} text - Message content
 * @property {boolean} isBroadcaster - Whether user has broadcaster badge
 * @property {boolean} isMod - Whether user has moderator badge
 */
/**
 * Result of Twitch OAuth flow.
 * @typedef {Object} TwitchAuthResult
 * @property {boolean} success - Whether auth succeeded
 * @property {string} [error] - Error message if failed
 */
/**
 * YouTube DOM breakage error details.
 * @typedef {Object} YouTubeDOMError
 * @property {string} timestamp - ISO timestamp when error occurred
 * @property {string[]} missing - List of missing selectors
 * @property {string} url - URL where error occurred
 * @property {string} message - Human-readable error message
 */
/**
 * Dependencies injected into voting module for decoupling.
 * @typedef {Object} VotingDeps
 * @property {function(State, string, function(string): void): Promise<void>} submitToAID - Submit action to AI Dungeon
 * @property {function(Config, AIDContext|null, Submission[], string|null): Promise<{result: string, debugInfo: Object|null}>} recursiveMerge - Merge submissions via LLM
 * @property {function(State): Promise<string|null>} fetchMostRecentAction - Fetch most recent action from AID
 */
/**
 * Result wrapper for operations that can fail.
 * @template T
 * @typedef {Object} Result
 * @property {boolean} ok - Whether the operation succeeded
 * @property {T} [value] - The result value (if ok)
 * @property {string} [error] - Error message (if not ok)
 */
// This file exports an empty object to satisfy ES module requirements
// Without `export {}`, this file wouldn't be recognized as a module by bundlers
// and import statements like `import('./types.js')` would fail
// The actual "exports" are the JSDoc @typedef declarations above, which
// TypeScript and editors can resolve via the import() syntax in JSDoc comments
// This pattern gives us type safety without requiring TypeScript compilation
export {};
