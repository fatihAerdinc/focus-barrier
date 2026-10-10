// mega.js — interstitial for Mega Block

const params = new URLSearchParams(window.location.search);
const hostname = params.get("hostname");
const site = params.get("site") || hostname;

const subtitleEl = document.getElementById("subtitle");
if (subtitleEl) {
  subtitleEl.innerHTML = `You can’t visit <strong>${site || "this site"}</strong>.<br>It is permanently blocked.`;
}

function closeTab() {
  try {
    chrome.runtime.sendMessage({ action: "close_tab" });
  } catch (_) {
    window.close();
  }
}

document.getElementById("close")?.addEventListener("click", () => {
  closeTab();
});

let remaining = 30;
const countdownEl = document.getElementById("countdown");
if (countdownEl) countdownEl.textContent = `Auto closing in ${remaining} seconds\u2026`;
const tick = setInterval(() => {
  remaining -= 1;
  if (countdownEl) countdownEl.textContent = `Auto closing in ${remaining} seconds\u2026`;
  if (remaining <= 0) {
    clearInterval(tick);
    closeTab();
  }
}, 1000);
