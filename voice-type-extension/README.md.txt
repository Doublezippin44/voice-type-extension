# VoiceType Anywhere (Native Python)

Type anywhere on the web using only your voice — no cloud APIs.  
This Chrome extension listens to your mic (Web Speech API) and sends recognized text to a local Python native host that can rephrase it (casual, formal, friendly) before inserting it back into the page.

---

## 📁 Project structure

voice-type-extension/
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── content.js
└── native_host/
├── voicetype_host.py
├── host_manifest.template.json
├── voicetype_host.bat.template
└── test_sender.py

---

## ⚙️ Setup (Windows example)

1. Copy `native_host/host_manifest.template.json` → `host_manifest.json`  
   Edit `"path"` to your real `.bat` file and `"allowed_origins"` to your extension ID.

2. Register host:
   ```powershell
   $manifestPath = "C:\Users\<YOU>\Desktop\voice-type-extension\native_host\host_manifest.json"
   New-Item -Path "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.voicetype.native" -Force
   Set-ItemProperty -Path "HKCU:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.voicetype.native" -Name "(Default)" -Value $manifestPath

