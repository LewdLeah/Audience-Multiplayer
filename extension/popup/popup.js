// Audience Multiplayer - Popup Script
import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_NAME,
  DEFAULT_VOTE_DURATION_SECONDS,
  MIN_VOTE_DURATION_SECONDS,
  MIN_AUTO_REPEAT_SECONDS,
  OPENROUTER_MODELS_URL
} from '../background/constants.js';
const elements = {
  popOut: document.getElementById('pop-out'),
  aidStatus: document.getElementById('aid-status'),
  twitchStatus: document.getElementById('twitch-status'),
  youtubeStatus: document.getElementById('youtube-status'),
  phase: document.getElementById('phase'),
  timerDisplay: document.getElementById('timer-display'),
  submissionCount: document.getElementById('submission-count'),
  startVote: document.getElementById('start-vote'),
  endVote: document.getElementById('end-vote'),
  pauseBtn: document.getElementById('pause-btn'),
  twitchChannel: document.getElementById('twitch-channel'),
  twitchAuth: document.getElementById('twitch-auth'),
  twitchAuthStatus: document.getElementById('twitch-auth-status'),
  youtubeUrl: document.getElementById('youtube-url'),
  youtubeError: document.getElementById('youtube-error'),
  playerCharacterName: document.getElementById('player-character-name'),
  partyMemberName: document.getElementById('party-member-name'),
  openrouterKey: document.getElementById('openrouter-key'),
  apiKeyStatus: document.getElementById('api-key-status'),
  forgetApiKey: document.getElementById('forget-api-key'),
  model: document.getElementById('model'),
  voteDuration: document.getElementById('vote-duration'),
  autoRepeat: document.getElementById('auto-repeat'),
  debugMode: document.getElementById('debug-mode'),
  saveSettings: document.getElementById('save-settings'),
  subCount: document.getElementById('sub-count'),
  submissionList: document.getElementById('submission-list'),
  aiContextSection: document.getElementById('ai-context-section'),
  aiModel: document.getElementById('ai-model'),
  aiTimestamp: document.getElementById('ai-timestamp'),
  aiSystemPrompt: document.getElementById('ai-system-prompt'),
  aiUserPrompt: document.getElementById('ai-user-prompt'),
  aiResponse: document.getElementById('ai-response')
};
let timerInterval = null;
let cachedState = null;
let autoSaveTimeout = null;
/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-safe string
 */
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
/**
 * Formats seconds as mm:ss
 * @param {number} seconds - Seconds to format
 * @returns {string} Formatted time string
 */
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
/**
 * Updates the timer display based on current state
 * @returns {void}
 */
const updateTimerDisplay = () => {
  if (!cachedState) {
    elements.timerDisplay.textContent = '';
    elements.timerDisplay.className = 'timer-display';
    return;
  }
  const now = Date.now();
  const isPaused = cachedState.isPaused;
  // During vote phase (paused or active)
  if (cachedState.phase === 'vote') {
    let remaining;
    if (isPaused && cachedState.pausedVoteRemaining) {
      // Paused: show frozen time
      remaining = Math.ceil(cachedState.pausedVoteRemaining / 1000);
    } else if (cachedState.voteEndTime) {
      // Active: show countdown
      remaining = Math.max(0, Math.ceil((cachedState.voteEndTime - now) / 1000));
    } else {
      return;
    }
    const pauseIndicator = isPaused ? '⏸ ' : '⏱ ';
    elements.timerDisplay.textContent = `${pauseIndicator}${formatTime(remaining)}`;
    elements.timerDisplay.className = 'timer-display active' + (isPaused ? ' paused' : '');
    return;
  }
  // During idle with auto-repeat (paused or active)
  if (cachedState.phase === 'idle') {
    let remaining;
    if (isPaused && cachedState.pausedAutoRepeatRemaining) {
      // Paused: show frozen time
      remaining = Math.ceil(cachedState.pausedAutoRepeatRemaining / 1000);
    } else if (cachedState.nextVoteStartTime) {
      // Active: show countdown
      remaining = Math.max(0, Math.ceil((cachedState.nextVoteStartTime - now) / 1000));
    } else {
      // No timer active
      elements.timerDisplay.textContent = '';
      elements.timerDisplay.className = 'timer-display';
      return;
    }
    const pauseIndicator = isPaused ? '⏸ ' : '';
    elements.timerDisplay.textContent = `${pauseIndicator}Next vote in ${formatTime(remaining)}`;
    elements.timerDisplay.className = 'timer-display waiting' + (isPaused ? ' paused' : '');
    return;
  }
  // No timer active
  elements.timerDisplay.textContent = '';
  elements.timerDisplay.className = 'timer-display';
};
/**
 * Starts the timer update interval
 * @returns {void}
 */
const startTimerInterval = () => {
  if (timerInterval) {
    return;
  }
  timerInterval = setInterval(updateTimerDisplay, 450);
  return;
};
/**
 * Stops the timer update interval
 * @returns {void}
 */
const stopTimerInterval = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  return;
};
/**
 * Collects current settings from form and saves to storage (debounced)
 * @returns {void}
 */
const autoSaveSettings = () => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  autoSaveTimeout = setTimeout(async () => {
    // Parse and clamp vote duration
    let voteDuration = parseInt(elements.voteDuration.value) || DEFAULT_VOTE_DURATION_SECONDS;
    voteDuration = Math.max(voteDuration, MIN_VOTE_DURATION_SECONDS);
    // Parse auto-repeat
    let autoRepeat = null;
    const autoRepeatInput = elements.autoRepeat.value.trim();
    if (autoRepeatInput) {
      autoRepeat = parseInt(autoRepeatInput);
      if (isNaN(autoRepeat) || autoRepeat <= 0) {
        autoRepeat = null;
      } else {
        autoRepeat = Math.max(autoRepeat, MIN_AUTO_REPEAT_SECONDS);
      }
    }
    const config = {
      twitchChannel: elements.twitchChannel.value.trim(),
      model: elements.model.value,
      voteDurationSeconds: voteDuration,
      autoRepeatCooldownSeconds: autoRepeat,
      debugMode: elements.debugMode.checked,
      playerCharacterName: elements.playerCharacterName.value.trim(),
      partyMemberName: elements.partyMemberName.value.trim(),
      youtubeUrl: elements.youtubeUrl.value.trim()
    };
    // Include API key if user typed something new
    if (elements.openrouterKey.value) {
      config.openRouterApiKey = elements.openrouterKey.value.trim();
    }
    await chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config });
  }, 500); // 500ms debounce
  return;
};
const updateUI = (state) => {
  // Cache state for timer updates
  cachedState = state;
  // Start timer interval if needed (active timers, not when paused)
  const hasActiveTimer = !state.isPaused && (
    (state.phase === 'vote' && state.voteEndTime) ||
    (state.phase === 'idle' && state.nextVoteStartTime)
  );
  const hasPausedTimer = state.isPaused && (
    state.pausedVoteRemaining || state.pausedAutoRepeatRemaining
  );
  if (hasActiveTimer) {
    startTimerInterval();
  } else {
    stopTimerInterval();
  }
  // Always update display (paused timers need to show too)
  updateTimerDisplay();
  // Connection status
  elements.aidStatus.className = 'status-dot ' + (state.aidConnected ? 'connected' : 'disconnected');
  elements.twitchStatus.className = 'status-dot ' + (state.twitchConnected ? 'connected' : 'disconnected');
  elements.aidStatus.title = 'AI Dungeon: ' + (state.aidConnected ? 'Connected' : 'Disconnected');
  elements.twitchStatus.title = 'Twitch: ' + (state.twitchConnected ? 'Connected' : 'Disconnected');
  // YouTube status (only show if URL is configured)
  const hasYoutubeUrl = state.config?.youtubeUrl;
  if (hasYoutubeUrl) {
    elements.youtubeStatus.style.display = '';
    if (state.youtubeError) {
      elements.youtubeStatus.className = 'status-dot error';
      elements.youtubeStatus.title = 'YouTube: Error - ' + state.youtubeError.message;
    } else {
      elements.youtubeStatus.className = 'status-dot ' + (state.youtubeConnected ? 'connected' : 'disconnected');
      elements.youtubeStatus.title = 'YouTube: ' + (state.youtubeConnected ? 'Connected' : 'Waiting for live chat tab');
    }
  } else {
    elements.youtubeStatus.style.display = 'none';
  }
  // Phase
  elements.phase.textContent = state.phase;
  elements.phase.className = 'phase-value ' + state.phase;
  // Submission count
  if (state.phase === 'vote') {
    elements.submissionCount.textContent = `${state.submissionCount} submissions`;
  } else {
    elements.submissionCount.textContent = '';
  }
  // Buttons
  elements.startVote.disabled = state.phase !== 'idle';
  elements.endVote.disabled = state.phase !== 'vote';
  // Pause button
  const hasAutoRepeat = !!state.config?.autoRepeatCooldownSeconds;
  elements.pauseBtn.style.display = hasAutoRepeat ? '' : 'none';
  elements.pauseBtn.textContent = state.isPaused ? '▶' : '⏸';
  elements.pauseBtn.title = state.isPaused ? 'Resume auto-repeat' : 'Pause auto-repeat';
  elements.pauseBtn.className = 'btn btn-pause' + (state.isPaused ? ' paused' : '');
  // Submissions
  elements.subCount.textContent = `(${state.submissionCount})`;
  elements.submissionList.innerHTML = '';
  if (!state.submissions || state.submissions.length === 0) {
    const li = document.createElement('li');
    li.className = 'no-submissions';
    li.textContent = 'No submissions yet';
    elements.submissionList.appendChild(li);
  } else {
    for (const sub of state.submissions) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="user">${escapeHtml(sub.user)}:</span> ${escapeHtml(sub.text)}`;
      elements.submissionList.appendChild(li);
    }
  }
  // "Combined" call debug info
  if (state.lastAICall) {
    elements.aiContextSection.style.display = 'block';
    elements.aiModel.textContent = state.lastAICall.model;
    const time = new Date(state.lastAICall.timestamp);
    elements.aiTimestamp.textContent = time.toLocaleTimeString();
    elements.aiSystemPrompt.textContent = state.lastAICall.systemPrompt || '';
    elements.aiUserPrompt.textContent = state.lastAICall.userPrompt || '';
    elements.aiResponse.textContent = state.lastAICall.response;
  } else {
    elements.aiContextSection.style.display = 'none';
  }
  // Dynamic config-dependent UI (NOT settings fields - those are loaded once in init)
  if (state.config) {
    // YouTube error banner (only show if URL configured AND error exists)
    if (state.config.youtubeUrl && state.youtubeError) {
      elements.youtubeError.style.display = 'block';
    } else {
      elements.youtubeError.style.display = 'none';
    }
    // API key status
    if (state.config.hasOpenRouterKey) {
      elements.apiKeyStatus.textContent = '✓ Saved';
      elements.apiKeyStatus.className = 'status-saved';
      elements.forgetApiKey.style.display = 'inline-block';
    } else {
      elements.apiKeyStatus.textContent = '(vote mode)';
      elements.apiKeyStatus.className = 'status-none';
      elements.forgetApiKey.style.display = 'none';
    }
    // Twitch auth button state
    if (state.config.hasTwitchToken) {
      elements.twitchAuth.textContent = 'Disconnect';
      elements.twitchAuth.className = 'btn btn-disconnect';
      elements.twitchAuthStatus.textContent = '✓ Connected';
      elements.twitchAuthStatus.className = 'auth-connected';
    } else {
      elements.twitchAuth.textContent = 'Connect Twitch';
      elements.twitchAuth.className = 'btn btn-twitch';
      elements.twitchAuthStatus.textContent = '';
      elements.twitchAuthStatus.className = '';
    }
  }
  return;
};
elements.popOut.addEventListener('click', () => {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html'),
    type: 'popup',
    width: 400,
    height: 600
  });
  window.close();
});
elements.startVote.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'START_VOTE' });
});
elements.endVote.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'END_VOTE' });
});
elements.pauseBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' });
});
elements.twitchAuth.addEventListener('click', async () => {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (state.config?.hasTwitchToken) {
    // Disconnect
    elements.twitchAuth.disabled = true;
    elements.twitchAuth.textContent = 'Disconnecting...';
    await chrome.runtime.sendMessage({ type: 'TWITCH_LOGOUT' });
  } else {
    // Connect via OAuth
    elements.twitchAuth.disabled = true;
    elements.twitchAuth.textContent = 'Connecting...';
    const result = await chrome.runtime.sendMessage({ type: 'TWITCH_AUTH' });
    if (!result.success) {
      elements.twitchAuthStatus.textContent = result.error || 'Auth failed';
      elements.twitchAuthStatus.className = 'auth-error';
    }
  }
  elements.twitchAuth.disabled = false;
  // Refresh state
  const newState = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  updateUI(newState);
});
elements.saveSettings.addEventListener('click', async () => {
  // Parse and clamp vote duration (minimum 5s)
  let voteDuration = parseInt(elements.voteDuration.value) || DEFAULT_VOTE_DURATION_SECONDS;
  voteDuration = Math.max(voteDuration, MIN_VOTE_DURATION_SECONDS);
  elements.voteDuration.value = voteDuration;
  // Parse auto-repeat (null if empty, clamp minimum 20s if set)
  let autoRepeat = null;
  const autoRepeatInput = elements.autoRepeat.value.trim();
  if (autoRepeatInput) {
    autoRepeat = parseInt(autoRepeatInput);
    if (isNaN(autoRepeat) || autoRepeat <= 0) {
      autoRepeat = null;
    } else {
      autoRepeat = Math.max(autoRepeat, MIN_AUTO_REPEAT_SECONDS);
      elements.autoRepeat.value = autoRepeat;
    }
  }
  const config = {
    twitchChannel: elements.twitchChannel.value.trim(),
    model: elements.model.value,
    voteDurationSeconds: voteDuration,
    autoRepeatCooldownSeconds: autoRepeat,
    debugMode: elements.debugMode.checked,
    playerCharacterName: elements.playerCharacterName.value.trim(),
    partyMemberName: elements.partyMemberName.value.trim(),
    youtubeUrl: elements.youtubeUrl.value.trim()
  };
  // Only include OpenRouter key if modified
  if (elements.openrouterKey.value) {
    config.openRouterApiKey = elements.openrouterKey.value.trim();
  }
  await chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config });
  elements.saveSettings.textContent = 'Saved!';
  setTimeout(() => {
    elements.saveSettings.textContent = 'Save Settings';
  }, 1500);
});
elements.forgetApiKey.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config: { openRouterApiKey: '' } });
  elements.openrouterKey.value = '';
  const newState = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  updateUI(newState);
});
// Auto-save settings on change (debounced)
const autoSaveInputs = [
  elements.twitchChannel,
  elements.youtubeUrl,
  elements.playerCharacterName,
  elements.partyMemberName,
  elements.openrouterKey,
  elements.voteDuration,
  elements.autoRepeat
];
autoSaveInputs.forEach(input => {
  input.addEventListener('input', autoSaveSettings);
});
elements.model.addEventListener('change', autoSaveSettings);
elements.debugMode.addEventListener('change', autoSaveSettings);
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE') {
    updateUI(message.state);
  }
  return;
});
/**
 * Fetches available models from OpenRouter and populates the dropdown
 * Filters for text input/output modalities, sorted by popularity
 * Falls back to default model if fetch fails
 * @param {string} [selectedModel] - Model ID to select after populating
 * @returns {Promise<void>}
 */
const populateModels = async (selectedModel) => {
  try {
    const response = await fetch(OPENROUTER_MODELS_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }
    const json = await response.json();
    const models = json.data?.models || [];
    // Filter: must support text input AND text output
    const textModels = models.filter(model => {
      const input = model.input_modalities || [];
      const output = model.output_modalities || [];
      return input.includes('text') && output.includes('text');
    });
    // Clear and populate dropdown
    elements.model.innerHTML = '';
    for (const model of textModels) {
      const option = document.createElement('option');
      option.value = model.slug;
      option.textContent = model.name;
      elements.model.appendChild(option);
    }
    // Select the saved model, or default
    elements.model.value = selectedModel || DEFAULT_MODEL;
    // If saved model not in list, select first available
    if (!elements.model.value && elements.model.options.length > 0) {
      elements.model.value = elements.model.options[0].value;
    }
  } catch (err) {
    console.warn('Failed to fetch OpenRouter models, using fallback:', err);
    elements.model.innerHTML = '';
    const option = document.createElement('option');
    option.value = DEFAULT_MODEL;
    option.textContent = DEFAULT_MODEL_NAME;
    elements.model.appendChild(option);
    elements.model.value = DEFAULT_MODEL;
  }
  return;
};
/**
 * Loads settings into form fields (called once on init, never again)
 * @param {Object} config - Config object from state
 * @returns {void}
 */
const loadSettings = (config) => {
  if (!config) {
    return;
  }
  elements.twitchChannel.value = config.twitchChannel || '';
  // Model is set by populateModels, not here
  elements.voteDuration.value = config.voteDurationSeconds || DEFAULT_VOTE_DURATION_SECONDS;
  elements.autoRepeat.value = config.autoRepeatCooldownSeconds || '';
  elements.debugMode.checked = config.debugMode || false;
  elements.playerCharacterName.value = config.playerCharacterName || '';
  elements.partyMemberName.value = config.partyMemberName || '';
  elements.youtubeUrl.value = config.youtubeUrl || '';
  return;
};
const init = async () => {
  // Detect if running in a tab (popped out) vs popup
  const views = chrome.extension.getViews({ type: 'popup' });
  const isPopup = views.includes(window);
  if (!isPopup) {
    document.body.classList.add('popped-out');
  }
  // Restore details open/closed state
  const detailsState = await chrome.storage.local.get('detailsState');
  const saved = detailsState.detailsState || {};
  document.querySelectorAll('details').forEach(details => {
    const id = details.className.split(' ')[0]; // Use first class as ID
    if (saved[id] !== undefined) {
      details.open = saved[id];
    }
    // Save state when toggled
    details.addEventListener('toggle', async () => {
      const current = await chrome.storage.local.get('detailsState');
      const state = current.detailsState || {};
      state[id] = details.open;
      await chrome.storage.local.set({ detailsState: state });
    });
  });
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  loadSettings(state.config); // Load settings ONCE here
  await populateModels(state.config?.model); // Fetch models and select saved one
  updateUI(state); // Then update dynamic UI
  return;
};
init();
