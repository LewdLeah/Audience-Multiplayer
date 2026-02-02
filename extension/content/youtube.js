// Audience Multiplayer - YouTube Live Chat DOM Scraper
// Reads chat messages from YouTube livestreams via DOM observation
// IMPORTANT: This script relies on YouTube's internal DOM structure
// If YouTube changes their chat HTML, this will break and need updating
const SELECTORS = {
  chatFrame: 'iframe#chatframe',
  messageList: '#items.yt-live-chat-item-list-renderer',
  messageItem: 'yt-live-chat-text-message-renderer',
  authorName: '#author-name',
  messageText: '#message'
};
// Track which messages we've already processed (by element reference)
const processedMessages = new WeakSet();
let observer = null;
let isConnected = false;
/**
 * Validates that expected DOM structure exists and reports specific errors.
 * @param {Document} chatDoc - The chat iframe's document
 * @returns {{valid: boolean, missing: string[]}}
 */
const validateDOMStructure = (chatDoc) => {
  const missing = [];
  if (!chatDoc.querySelector(SELECTORS.messageList)) {
    missing.push(`messageList (${SELECTORS.messageList})`);
  }
  // Check for at least one message item to validate structure
  const sampleMessage = chatDoc.querySelector(SELECTORS.messageItem);
  if (sampleMessage) {
    if (!sampleMessage.querySelector(SELECTORS.authorName)) {
      missing.push(`authorName (${SELECTORS.authorName})`);
    }
    if (!sampleMessage.querySelector(SELECTORS.messageText)) {
      missing.push(`messageText (${SELECTORS.messageText})`);
    }
  }
  return { valid: missing.length === 0, missing };
};
/**
 * Reports DOM breakage to the background script with specific details.
 * @param {string[]} missing - List of missing selectors
 */
const reportBreakage = (missing) => {
  const details = {
    timestamp: new Date().toISOString(),
    missing,
    url: window.location.href,
    message: 'YouTube Live chat DOM structure has changed. The extension needs an update to work with the new structure.'
  };
  console.error('[YouTube] DOM breakage detected:', details);
  chrome.runtime.sendMessage({
    type: 'YOUTUBE_DOM_ERROR',
    details
  }).catch(() => {});
  return;
};
/**
 * Extracts user and text from a chat message element.
 * @param {Element} messageEl - The yt-live-chat-text-message-renderer element
 * @returns {{user: string, text: string}|null}
 */
const extractMessage = (messageEl) => {
  const authorEl = messageEl.querySelector(SELECTORS.authorName);
  const textEl = messageEl.querySelector(SELECTORS.messageText);
  if (!authorEl || !textEl) {
    return null;
  }
  let user = authorEl.textContent?.trim();
  const text = textEl.textContent?.trim();
  if (!user || !text) {
    return null;
  }
  // Strip leading @ from YouTube usernames
  if (user.startsWith('@')) {
    user = user.slice(1);
  }
  return { user, text };
};
/**
 * Processes new chat messages and forwards them to the background script.
 * @param {Element} messageEl - The chat message element
 */
const processMessage = (messageEl) => {
  if (processedMessages.has(messageEl)) {
    return;
  }
  processedMessages.add(messageEl);
  const parsed = extractMessage(messageEl);
  if (!parsed) {
    return;
  }
  chrome.runtime.sendMessage({
    type: 'YOUTUBE_CHAT_MESSAGE',
    user: parsed.user,
    text: parsed.text
  }).catch(() => {});
  return;
};
/**
 * Sets up MutationObserver on the chat message list.
 * @param {Document} chatDoc - The chat iframe's document
 */
const observeChat = (chatDoc) => {
  const messageList = chatDoc.querySelector(SELECTORS.messageList);
  if (!messageList) {
    console.error('[YouTube] Cannot find message list to observe');
    return;
  }
  // Process any existing messages
  const existingMessages = messageList.querySelectorAll(SELECTORS.messageItem);
  existingMessages.forEach(processMessage);
  // Watch for new messages
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node is a message or contains messages
          if (node.matches?.(SELECTORS.messageItem)) {
            processMessage(node);
          } else {
            const nestedMessages = node.querySelectorAll?.(SELECTORS.messageItem);
            nestedMessages?.forEach(processMessage);
          }
        }
      }
    }
  });
  observer.observe(messageList, { childList: true, subtree: true });
  console.log('[YouTube] Chat observer started');
  return;
};
/**
 * Notifies background that YouTube chat is connected.
 * @param {string} videoId - The YouTube video ID
 */
const notifyConnected = (videoId) => {
  if (isConnected) {
    return;
  }
  isConnected = true;
  chrome.runtime.sendMessage({
    type: 'YOUTUBE_CONNECTED',
    videoId
  }).catch(() => {});
  console.log('[YouTube] Connected to chat for video:', videoId);
  return;
};
/**
 * Notifies background that YouTube chat is disconnected.
 */
const notifyDisconnected = () => {
  if (!isConnected) {
    return;
  }
  isConnected = false;
  chrome.runtime.sendMessage({
    type: 'YOUTUBE_DISCONNECTED'
  }).catch(() => {});
  console.log('[YouTube] Disconnected from chat');
  return;
};
/**
 * Extracts video ID from YouTube URL.
 * @returns {string|null}
 */
const getVideoId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('v');
};
/**
 * Attempts to connect to the chat iframe.
 * YouTube loads the chat iframe dynamically, so we may need to retry.
 */
const tryConnect = () => {
  // Only run on the main YouTube page, not inside iframes
  if (window.self !== window.top) {
    // We're inside the chat iframe - this is where we observe
    initChatFrame();
    return;
  }
  // We're on the main page - nothing to do here
  // The content script will also run in the chat iframe due to all_frames: true
  return;
};
/**
 * Initializes observation when running inside the chat iframe.
 */
const initChatFrame = () => {
  const videoId = getVideoIdFromParent() || 'unknown';
  // Wait for chat to be ready
  const waitForChat = (attempts = 0) => {
    const messageList = document.querySelector(SELECTORS.messageList);
    if (messageList) {
      // Validate DOM structure
      const { valid, missing } = validateDOMStructure(document);
      if (!valid) {
        reportBreakage(missing);
        return;
      }
      notifyConnected(videoId);
      observeChat(document);
    } else if (attempts < 30) {
      // Retry for up to 30 seconds
      setTimeout(() => waitForChat(attempts + 1), 1000);
    } else {
      console.error('[YouTube] Chat message list not found after 30 attempts');
      reportBreakage([`messageList (${SELECTORS.messageList}) - element never appeared`]);
    }
  };
  waitForChat();
  return;
};
/**
 * Gets video ID from the live chat iframe URL.
 * YouTube uses various parameter names depending on context.
 * @returns {string|null}
 */
const getVideoIdFromParent = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    // Try common parameter names YouTube uses
    const videoId = params.get('v') || params.get('video_id') || params.get('videoId');
    if (videoId) {
      return videoId;
    }
    // If no direct video ID, try to extract from continuation token or other params
    // Log the URL for debugging if we can't find it
    console.log('[YouTube] Live chat URL:', window.location.href);
    console.log('[YouTube] URL params:', Object.fromEntries(params.entries()));
    return null;
  } catch (err) {
    console.error('[YouTube] Error extracting video ID:', err);
    return null;
  }
};
/**
 * Checks if this is a YouTube live chat iframe.
 * @returns {boolean}
 */
const isLiveChatFrame = () => {
  return window.location.hostname === 'www.youtube.com' &&
         window.location.pathname === '/live_chat';
};
if (isLiveChatFrame()) {
  console.log('[YouTube] Live chat frame detected, initializing...');
  tryConnect();
} else if (window.self === window.top) {
  console.log('[YouTube] Main page detected, waiting for chat iframe...');
}
// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  notifyDisconnected();
});
