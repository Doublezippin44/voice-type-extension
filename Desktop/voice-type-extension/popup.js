// popup.js
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const toneSelect = document.getElementById('tone');
const rephraseToggle = document.getElementById('rephraseToggle');

async function sendToActiveTab(msg, callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    callback && callback({ ok: false, error: 'No active tab' });
    return;
  }
  chrome.tabs.sendMessage(tab.id, msg, callback);
}

startBtn.addEventListener('click', async () => {
  const tone = toneSelect.value;
  const rephrase = rephraseToggle.checked;
  // store prefs
  chrome.storage.local.set({ tone, rephrase });
  sendToActiveTab({ cmd: 'start_recognition' }, (resp) => {
    status.textContent = resp && resp.ok ? 'Listening — focus a text field' : 'Failed to start';
    if (resp && resp.ok) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
    }
  });
});

stopBtn.addEventListener('click', async () => {
  sendToActiveTab({ cmd: 'stop_recognition' }, (resp) => {
    status.textContent = 'Stopped.';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['tone', 'rephrase']);
  if (data.tone) toneSelect.value = data.tone;
  if (typeof data.rephrase !== 'undefined') rephraseToggle.checked = data.rephrase;
});
