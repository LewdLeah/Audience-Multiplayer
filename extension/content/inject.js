// Audience Multiplayer - Injected Script
// Runs in page context to access Firebase auth
(async () => {
  try {
    let token = null;
    // Try compat/namespaced Firebase (v8 style)
    if (typeof firebase !== 'undefined' && firebase.auth) {
      console.log('[AMP] Found firebase global');
      const user = firebase.auth().currentUser;
      if (user) {
        token = await user.getIdToken(true);
        console.log('[AMP] Got token from firebase.auth()');
      }
    }
    // Try IndexedDB - scan ALL databases
    if (!token) {
      try {
        const dbs = await indexedDB.databases();
        console.log('[AMP] IndexedDB databases:', dbs.map(d => d.name));
        for (const dbInfo of dbs) {
          if (!dbInfo.name) {
            continue;
          }
          try {
            const db = await new Promise((resolve, reject) => {
              const req = indexedDB.open(dbInfo.name);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            const stores = Array.from(db.objectStoreNames);
            for (const storeName of stores) {
              try {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const all = await new Promise((resolve, reject) => {
                  const req = store.getAll();
                  req.onsuccess = () => resolve(req.result);
                  req.onerror = () => reject(req.error);
                });
                for (const item of all) {
                  // Firebase v9 format - direct
                  if (item?.stsTokenManager?.accessToken) {
                    token = item.stsTokenManager.accessToken;
                    console.log('[AMP] Found token in', dbInfo.name, '/', storeName);
                    break;
                  }
                  // Firebase format - nested in value property
                  if (item?.value?.stsTokenManager?.accessToken) {
                    token = item.value.stsTokenManager.accessToken;
                    console.log('[AMP] Found token in', dbInfo.name, '/', storeName, '(nested)');
                    break;
                  }
                }
              } catch (e) {
                // Skip stores we can't read
              }
              if (token) {
                break;
              }
            }
            db.close();
            if (token) {
              break;
            }
          } catch (e) {
            // Skip databases we can't open
          }
        }
      } catch (e) {
        console.log('[AMP] IndexedDB scan failed:', e);
      }
    }
    // Try localStorage
    if (!token) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        try {
          const parsed = JSON.parse(val);
          if (parsed?.stsTokenManager?.accessToken) {
            token = parsed.stsTokenManager.accessToken;
            console.log('[AMP] Found token in localStorage:', key);
            break;
          }
        } catch {}
      }
    }
    if (token) {
      window.postMessage({ type: 'AMP_TOKEN', token }, '*');
    } else {
      console.log('[AMP] Could not find token. Run this in console to debug:');
      console.log('[AMP] indexedDB.databases().then(dbs => console.log(dbs))');
      window.postMessage({ type: 'AMP_TOKEN_ERROR', error: 'Could not find Firebase token' }, '*');
    }
  } catch (err) {
    window.postMessage({ type: 'AMP_TOKEN_ERROR', error: err.message }, '*');
  }
})();
