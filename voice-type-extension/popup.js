// popup.js
const statusText = document.getElementById("statusText");

function setStatus(text, color = "gray") {
  statusText.innerHTML = `Status: <span style="color:${color};">${text}</span>`;
}

document.getElementById("startBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ cmd: "native_start" }, (resp) => {
    if (resp && resp.ok) {
      setStatus("Listening...", "green");
      console.log("Voice typing started");
    } else {
      setStatus("Error", "red");
      console.error("Could not start:", resp);
    }
  });
});

document.getElementById("stopBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ cmd: "native_stop" }, (resp) => {
    if (resp && resp.ok) {
      setStatus("Stopped", "red");
      console.log("Voice typing stopped");
    } else {
      console.error("Stop error:", resp);
    }
  });
});
