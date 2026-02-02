// Audience Multiplayer - Content Script
// Runs on AI Dungeon pages to extract Firebase token and shortId
// Content scripts run in an isolated context and cannot use ES module imports
// These constants are duplicated from background/constants.js - keep in sync
const TOKEN_REFRESH_INTERVAL_MS = 45 * 60 * 1000;
const URL_POLL_INTERVAL_MS = 1000;
const FIREBASE_INIT_DELAY_MS = 3000;
const TOKEN_EXTRACTION_TIMEOUT_MS = 10000;
let lastUrl = window.location.href;
// Prevents concurrent token extraction attempts
let isExtractingToken = false;
const extractShortId = () => {
  // URL format: play.aidungeon.com/adventure/SHORTID/...
  const match = window.location.pathname.match(/\/adventure\/([^\/]+)/);
  return match ? match[1] : null;
};
const extractToken = () => new Promise((resolve, reject) => {
  const handler = (event) => {
    if (event.source !== window) {
      return;
    }
    if (event.data.type === 'AMP_TOKEN') {
      window.removeEventListener('message', handler);
      resolve(event.data.token);
    } else if (event.data.type === 'AMP_TOKEN_ERROR') {
      window.removeEventListener('message', handler);
      reject(new Error(event.data.error));
    }
  };
  window.addEventListener('message', handler);
  // Inject via src to bypass CSP (web_accessible_resources)
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/inject.js');
  script.onload = () => script.remove();
  script.onerror = () => {
    window.removeEventListener('message', handler);
    reject(new Error('Failed to load inject script'));
  };
  document.documentElement.appendChild(script);
  setTimeout(() => {
    window.removeEventListener('message', handler);
    reject(new Error('Token extraction timeout'));
  }, TOKEN_EXTRACTION_TIMEOUT_MS);
});
const syncShortId = () => {
  const shortId = extractShortId();
  if (shortId) {
    chrome.runtime.sendMessage({ type: 'SHORTID_UPDATE', shortId, origin: window.location.hostname });
    console.log('[AMP] ShortId synced:', shortId, 'origin:', window.location.hostname);
  }
  return;
};
const syncToken = async () => {
  // Prevent concurrent extraction attempts
  if (isExtractingToken) {
    console.log('[AMP] Token extraction already in progress, skipping');
    return;
  }
  isExtractingToken = true;
  try {
    const token = await extractToken();
    await chrome.runtime.sendMessage({ type: 'TOKEN_UPDATE', token, origin: window.location.hostname });
    console.log('[AMP] Token synced');
  } catch (err) {
    console.log('[AMP] Token sync failed:', err.message);
  } finally {
    isExtractingToken = false;
  }
  return;
};
const checkUrlChange = () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('[AMP] URL changed, syncing shortId...');
    syncShortId();
  }
  return;
};
const init = async () => {
  console.log('[AMP] Content script loaded');
  // Wait for page to fully load
  await new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
  // Initial delay for Firebase to initialize
  await new Promise(resolve => setTimeout(resolve, FIREBASE_INIT_DELAY_MS));
  // Sync shortId
  syncShortId();
  // Sync token
  await syncToken();
  // Refresh token periodically
  setInterval(syncToken, TOKEN_REFRESH_INTERVAL_MS);
  // Watch for URL changes (SPA navigation)
  setInterval(checkUrlChange, URL_POLL_INTERVAL_MS);
  // Also sync when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncShortId();
      syncToken();
    }
  });
  return;
};
init();
