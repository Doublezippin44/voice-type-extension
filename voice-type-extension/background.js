// background.js - connects to native host and relays status to popup
const NATIVE_NAME = "com.voicetype.native";
let port = null;

function connectNative() {
  try {
    port = chrome.runtime.connectNative(NATIVE_NAME);
    port.onMessage.addListener((msg) => {
      console.log("Native msg:", msg);
      // Broadcast to popup pages (or handle accordingly)
      // Store last message in session storage or runtime for popup to read.
      chrome.storage.session.set({ nativeLast: msg });
    });
    port.onDisconnect.addListener(() => {
      console.warn("Native disconnected", chrome.runtime.lastError);
      port = null;
    });
  } catch (e) {
    console.error("connectNative error", e);
    port = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.cmd === "native_start") {
    if (!port) connectNative();
    if (!port) {
      sendResponse({ ok: false, error: "cannot_connect_native" });
      return true;
    }
    port.postMessage({ cmd: "start" });
    sendResponse({ ok: true, status: "starting" });
    return true;
  }
  if (message && message.cmd === "native_stop") {
    if (!port) { sendResponse({ ok: false, error: "not_connected" }); return true; }
    port.postMessage({ cmd: "stop" });
    sendResponse({ ok: true, status: "stopping" });
    return true;
  }
});
