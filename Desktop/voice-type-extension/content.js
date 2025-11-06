// content.js - simple recognition and send to background for Python rephrase
(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;

  async function getSettings() {
    return new Promise(res => chrome.storage.local.get(['tone','rephrase'], s => res({ tone: s.tone || 'none', rephrase: typeof s.rephrase === 'undefined' ? true : s.rephrase })));
  }

  function getActiveEditable() {
    const el = document.activeElement;
    if (!el) return null;
    const t = el.tagName;
    if (t === 'TEXTAREA' || (t === 'INPUT' && /text|search|email|url|tel/.test(el.type))) return el;
    if (el.isContentEditable) return el;
    return null;
  }

  function insertTextToElement(target, text) {
    if (!target) return false;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      const start = target.selectionStart || 0, end = target.selectionEnd || 0, val = target.value || '';
      target.value = val.slice(0,start) + text + val.slice(end);
      const pos = start + text.length;
      target.setSelectionRange(pos,pos);
      target.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    }
    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (!sel.rangeCount) { target.appendChild(document.createTextNode(text)); return true; }
      const range = sel.getRangeAt(0); range.deleteContents();
      const node = document.createTextNode(text); range.insertNode(node);
      range.setStartAfter(node); range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range);
      target.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    }
    return false;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.cmd === 'python_response') {
      const payload = msg.payload || {};
      if (!payload.ok) { console.warn('python error', payload.error); return; }
      const result = payload.result || '';
      const target = getActiveEditable();
      if (!insertTextToElement(target, result + ' ')) {
        try { navigator.clipboard.writeText(result); console.info('Copied rephrased to clipboard'); }
        catch (e) { console.warn('Could not insert or copy'); }
      }
    } else if (msg && msg.cmd === 'start_recognition') {
      startRecognition(); sendResponse({ ok: true });
    } else if (msg && msg.cmd === 'stop_recognition') {
      stopRecognition(); sendResponse({ ok: true });
    }
  });

  function startRecognition() {
    if (!SpeechRecognition) { alert('Web Speech API not supported'); return; }
    if (listening) return;
    recognition = new SpeechRecognition();
    recognition.continuous = true; recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = async (evt) => {
      let final = '';
      for (let i = evt.resultIndex; i < evt.results.length; ++i) if (evt.results[i].isFinal) final += evt.results[i][0].transcript;
      final = final.trim(); if (!final) return;
      const s = await getSettings();
      // send to background which will forward to the native Python host
      chrome.runtime.sendMessage({ cmd: 'send_to_python', text: final, tone: s.tone, rephrase: s.rephrase }, (resp) => {
        if (!resp || !resp.ok) {
          // fallback: insert original text
          const target = getActiveEditable(); if (target) insertTextToElement(target, final + ' ');
        }
      });
    };
    recognition.onerror = (e) => { console.error('rec error', e); stopRecognition(); };
    recognition.onend = () => { listening = false; recognition = null; };
    try { recognition.start(); listening = true; console.log('recognition started'); } catch (e) { console.error(e); }
  }

  function stopRecognition() { if (!listening || !recognition) return; recognition.stop(); listening=false; recognition=null; }
})();
