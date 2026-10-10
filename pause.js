// pause.js — Focus Barrier v2.1

const params   = new URLSearchParams(window.location.search);
const target   = params.get("target");
const tabId    = params.get("tabId");
const hostname = params.get("hostname");
const site     = params.get("site") || hostname;
const mode     = params.get("mode") || "balanced";
const expired  = params.get("expired") === "true";
const reason   = params.get("reason") || "";
const limitMinutesParam = parseInt(params.get("limitMinutes"), 10);
const limitMinutes = Number.isFinite(limitMinutesParam) ? limitMinutesParam : 60;

const input         = document.getElementById("input");
const statusMessage = document.getElementById("statusMessage");
const continueBtn   = document.getElementById("continue");
const submitBtn     = document.getElementById("submit");
const subtitleEl    = document.getElementById("subtitle");
let pauseResolved   = false;

async function markPauseAbandoned() {
  if (pauseResolved) return;
  pauseResolved = true;
  try {
    await chrome.runtime.sendMessage({
      type: "PAUSE_ABANDONED",
      hostname,
      site,
      mode,
      expired,
      reason
    });
  } catch (_) {}
}

// ─── Expired state (watchdog long-session hard end) ───────────────────────────
if (expired) {
  subtitleEl.innerHTML = `Your ${limitMinutes}-minute session on <strong>${hostname}</strong> ended.<br>Type YES to re-enter intentionally.`;
}

// ─── Doomscroll reason ───────────────────────────────────────────────────────
if (!expired && reason === "doomscroll") {
  subtitleEl.innerHTML = `Doomscrolling detected on <strong>${hostname}</strong>.<br>Type <strong>YES</strong> to continue intentionally.`;
}

// ─── Read timer from storage (not hardcoded) ──────────────────────────────────
let countdownSeconds = 10;
chrome.storage.local.get(["timer"], (data) => {
  const parsed = parseInt(data.timer, 10);
  if (!isNaN(parsed) && parsed > 0) countdownSeconds = parsed;
});

// ─── Double-submit guard ──────────────────────────────────────────────────────
let countdownStarted = false;

function handleSubmit() {
  if (countdownStarted) return;

  if (input.value.trim().toUpperCase() !== "YES") {
    markPauseAbandoned().finally(() => {
      chrome.runtime.sendMessage({ action: "close_tab" });
    });
    return;
  }

  countdownStarted   = true;
  submitBtn.disabled = true;
  input.disabled     = true;

  let remaining = countdownSeconds;
  statusMessage.textContent = `Patience... ${remaining}s left`;

  // Only count down while the user is actually on this tab (pause when hidden).
  let lastVisibleAt = document.hidden ? null : Date.now();
  const tickMs = 250;

  const interval = setInterval(() => {
    if (document.hidden) {
      lastVisibleAt = null;
      return;
    }
    if (lastVisibleAt == null) lastVisibleAt = Date.now();

    const now = Date.now();
    const elapsedMs = now - lastVisibleAt;
    if (elapsedMs < 1000) return;

    const dec = Math.floor(elapsedMs / 1000);
    remaining -= dec;
    lastVisibleAt += dec * 1000;

    if (remaining <= 0) {
      clearInterval(interval);
      statusMessage.textContent = "Choice confirmed.";
      continueBtn.disabled = false;
      return;
    }
    statusMessage.textContent = `Patience... ${remaining}s left`;
  }, tickMs);
}

submitBtn.addEventListener("click", handleSubmit);
input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSubmit(); });
input.addEventListener("paste",   (e) => e.preventDefault());
window.addEventListener("beforeunload", () => {
  if (!pauseResolved) {
    chrome.runtime.sendMessage({
      type: "PAUSE_ABANDONED",
      hostname,
      site,
      mode,
      expired,
      reason
    }).catch(() => {});
  }
});

// ─── Proceed: write mode-aware auth, then navigate ────────────────────────────
continueBtn.addEventListener("click", async () => {
  const sessionUpdate = {};

  if (mode === "easy") {
    // Easy: a single flag — background will allow all blocked domains
    sessionUpdate[tabId] = { authorized: true, domain: site, easy: true };
  } else if (mode === "strict") {
    // Strict: lock to exact URL only
    sessionUpdate[tabId] = { authorized: true, domain: site, exactUrl: target };
  } else {
    // Balanced (default): unlock this domain only
    sessionUpdate[tabId] = { authorized: true, domain: site };
  }

  await chrome.storage.session.set(sessionUpdate);
  pauseResolved = true;
  chrome.runtime.sendMessage({
    type: "PAUSE_CONTINUE",
    hostname,
    site,
    mode,
    expired,
    reason
  }).catch(() => {});
  chrome.runtime.sendMessage({
    type: "SESSION_START",
    domain: site,
    url: target || `https://${hostname}`
  });

  // Prevent the pause page itself from staying in the tab's Back/Forward history.
  // After proceeding, Back/Forward will skip over `pause.html`.
  window.location.replace(target || `https://${hostname}`);
});
