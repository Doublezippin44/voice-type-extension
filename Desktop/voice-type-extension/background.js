// background.js (service worker)
const NATIVE_NAME = "com.voicetype.native"; // must match host_manifest.json "name"
let port = null;
const pending = {};

function ensurePort() {
  if (port) return port;
  try {
    console.log('connecting to native host', NATIVE_NAME);
    port = chrome.runtime.connectNative(NATIVE_NAME);
  } catch (e) {
    console.error('connectNative failed', e, chrome.runtime.lastError);
    port = null;
    return null;
  }
  port.onMessage.addListener((msg) => {
    if (!msg || !msg.requestId) return;
    const req = pending[msg.requestId];
    if (!req) return;
    chrome.tabs.sendMessage(req.tabId, { cmd: 'python_response', payload: msg });
    delete pending[msg.requestId];
  });
  port.onDisconnect.addListener(() => {
    console.warn('native disconnected', chrome.runtime.lastError);
    port = null;
    Object.keys(pending).forEach(id => {
      const req = pending[id];
      if (req && req.tabId) chrome.tabs.sendMessage(req.tabId, { cmd: 'python_response', payload: { ok:false, error:'native_disconnected' }});
      delete pending[id];
    });
  });
  return port;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.cmd === 'send_to_python') {
    const text = msg.text || '';
    const tone = msg.tone || 'none';
    const rephrase = !!msg.rephrase;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const p = ensurePort();
    if (!p) { sendResponse({ ok: false, error: 'native_connect_failed' }); return true; }
    pending[requestId] = { tabId: sender.tab ? sender.tab.id : null };
    p.postMessage({ requestId, cmd: 'tone', text, tone, rephrase });
    sendResponse({ ok: true, requestId });
    return true;
  }
});
