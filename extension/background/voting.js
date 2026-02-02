// Audience Multiplayer - Voting Module
// Handles submission/vote collection and combine logic
/** @typedef {import('./types.js').State} State */
/** @typedef {import('./types.js').Config} Config */
/** @typedef {import('./types.js').Submission} Submission */
/** @typedef {import('./types.js').Callbacks} Callbacks */
/** @typedef {import('./types.js').VotingDeps} VotingDeps */
import { MAX_SUBMISSION_LENGTH, MIN_VOTE_DURATION_SECONDS, DEFAULT_PARTY_MEMBER_NAME } from './constants.js';
/**
 * Adds or updates a submission from a user.
 * @param {State} state - Application state (mutated: submissions)
 * @param {string} user - Username submitting
 * @param {string} text - Action text
 * @param {boolean} debugMode - If true, allows duplicate submissions
 * @returns {void}
 */
export const handleSubmission = (state, user, text, debugMode) => {
  if (text.length === 0 || text.length > MAX_SUBMISSION_LENGTH) {
    return;
  }
  // Debug mode: always create new submission (no deduplication)
  if (debugMode) {
    const votes = new Set([user.toLowerCase()]);
    state.submissions.push({ user, text, timestamp: Date.now(), votes });
    console.log('[Voting] Submission from', user, ':', text.substring(0, 50));
    return;
  }
  // Normal mode: create or update submission with implicit self-vote
  const existing = state.submissions.find(s => s.user.toLowerCase() === user.toLowerCase());
  if (existing) {
    existing.text = text;
    existing.timestamp = Date.now();
    existing.votes.add(user.toLowerCase());
  } else {
    const votes = new Set([user.toLowerCase()]);
    state.submissions.push({ user, text, timestamp: Date.now(), votes });
  }
  console.log('[Voting] Submission from', user, ':', text.substring(0, 50));
  return;
};
/**
 * Records a vote for a user's submission.
 * @param {State} state - Application state (mutated: submissions)
 * @param {string} voter - Username voting
 * @param {string} targetUser - Username whose submission to vote for
 * @param {boolean} debugMode - If true, allows duplicate votes
 * @returns {void}
 */
export const handleVote = (state, voter, targetUser, debugMode) => {
  const submission = state.submissions.find(s => s.user.toLowerCase() === targetUser.toLowerCase());
  if (!submission) {
    return;
  }
  const alreadyVoted = submission.votes.has(voter.toLowerCase());
  if (debugMode || !alreadyVoted) {
    submission.votes.add(voter.toLowerCase());
    // In debug mode, increment a counter instead of using Set deduplication
    if (debugMode && alreadyVoted) {
      submission.debugVoteCount = (submission.debugVoteCount || submission.votes.size) + 1;
    }
    console.log('[Voting] Vote from', voter, 'for', targetUser);
  }
  return;
};
/**
 * Sets up the vote timer that ends voting after the configured duration.
 * @param {State} state - Application state (mutated: voteTimer)
 * @param {function(): void} onTimeout - Called when timer expires
 * @returns {void}
 */
export const setVoteTimer = (state, onTimeout) => {
  const duration = Math.max(state.config.voteDurationSeconds, MIN_VOTE_DURATION_SECONDS);
  state.voteTimer = setTimeout(onTimeout, duration * 1000);
  return;
};
/**
 * Gets the vote count for a submission (handles debug mode).
 * @param {Submission} submission - The submission
 * @returns {number} Vote count
 */
const getVoteCount = (submission) => {
  return submission.debugVoteCount || submission.votes.size;
};
/**
 * Combines submissions and submits the result to AI Dungeon.
 * @param {State} state - Application state
 * @param {Callbacks} callbacks - For broadcasting and Twitch messages
 * @param {VotingDeps} deps - Injected dependencies
 * @returns {Promise<void>}
 */
export const combineSubmissions = async (state, callbacks, deps) => {
  if (state.submissions.length === 0) {
    console.log('[Voting] No submissions to combine');
    callbacks.sendTwitchMessage('❌ No submissions received.');
    return;
  }
  const hasApiKey = !!state.config.openRouterApiKey;
  if (!hasApiKey) {
    // No-API mode: pick winner by vote count (tiebreak by recency)
    const sorted = [...state.submissions].sort((a, b) => {
      const voteDiff = getVoteCount(b) - getVoteCount(a);
      if (voteDiff !== 0) {
        return voteDiff;
      }
      return b.timestamp - a.timestamp;
    });
    const winner = sorted[0];
    const winnerVotes = getVoteCount(winner);
    console.log('[Voting] No API key - winner:', winner.text, 'with', winnerVotes, 'votes');
    callbacks.sendTwitchMessage(`🏆 Winner: "${winner.text}" (${winnerVotes} vote${winnerVotes === 1 ? '' : 's'})`);
    try {
      await deps.submitToAID(state, winner.text, callbacks.sendTwitchMessage);
    } catch (err) {
      console.error('[Voting] AID submit error:', err);
      callbacks.sendTwitchMessage(`❌ Error: ${err.message}`);
    }
    return;
  }
  // API mode: blend all submissions using recursive merge
  try {
    // Fetch the most recent action right before prompting
    const mostRecentAction = await deps.fetchMostRecentAction(state);
    const { result: combined, debugInfo } = await deps.recursiveMerge(state.config, state.context, state.submissions, mostRecentAction);
    // Store debug info for the popup
    if (debugInfo) {
      state.lastAICall = debugInfo;
    }
    console.log('[Voting] Combined result:', combined);
    const label = state.submissions.length === 1 ? 'Action' : 'Combined';
    const partyName = state.config.partyMemberName || DEFAULT_PARTY_MEMBER_NAME;
    callbacks.sendTwitchMessage(`✨ ${label}: "${partyName} ${combined}"`);
    await deps.submitToAID(state, combined, callbacks.sendTwitchMessage);
  } catch (err) {
    console.error('[Voting] Combine error:', err);
    callbacks.sendTwitchMessage(`❌ Error: ${err.message}`);
  }
};
