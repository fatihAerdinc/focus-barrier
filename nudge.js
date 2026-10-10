// nudge.js — Focus Barrier v2.1

// ─── Shared sound helper ──────────────────────────────────────────────────────
function playNudgeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

// ─── Nudge banner (doomscroll + long_stay notification) ──────────────────────
function showNudgeBanner(reason, payload = {}) {
  const existing = document.getElementById("focus-barrier-nudge");
  if (existing) existing.remove();

  let text = "⚠️ Doomscroll detected — is this intentional?";
  if (reason === "long_stay") {
    const elapsedMinutes = Number.isFinite(payload.elapsedMinutes) ? payload.elapsedMinutes : null;
    text = Number.isFinite(elapsedMinutes)
      ? `🕒 You've been here ${elapsedMinutes} minutes. Time to wrap up.`
      : "🕒 You've been here a while. Time to wrap up.";
  }

  playNudgeSound();

  const mount = document.fullscreenElement || document.body;

  const banner = document.createElement("div");
  banner.id = "focus-barrier-nudge";
  banner.innerHTML = `
    <div style="
      background:#1a1e26; color:#e8eaf0;
      border:2px solid #337ab7; padding:15px 18px;
      border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.5);
      font-family:system-ui,sans-serif;
      position:fixed; top:20px; right:20px; z-index:2147483646;
      display:flex; align-items:center; gap:12px; max-width:320px;
    ">
      <div>
        <strong style="color:#337ab7;display:block;margin-bottom:3px;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;">Focus Barrier</strong>
        <span style="font-size:0.9rem;">${text}</span>
      </div>
      <button id="fb-close-nudge" style="background:none;border:none;color:#8da1b9;cursor:pointer;font-size:1.1rem;font-weight:bold;padding:0;flex-shrink:0;line-height:1;">✕</button>
    </div>
  `;
  mount.appendChild(banner);
  document.getElementById("fb-close-nudge").onclick = () => banner.remove();
  setTimeout(() => { if (document.getElementById("focus-barrier-nudge")) banner.remove(); }, 8000);
}

// ─── Long-stay overlay (steel blue blur, 5-second delay on button) ────────────
function showLongStayOverlay(payload = {}) {
  if (document.getElementById("fb-longstay-overlay")) return;

  playNudgeSound();

  const limitMinutes = Number.isFinite(payload.limitMinutes) ? payload.limitMinutes : null;
  const elapsedMinutes = Number.isFinite(payload.elapsedMinutes) ? payload.elapsedMinutes : null;
  const isHalfway = payload.phase === "halfway";
  const headline = isHalfway ? "Halfway check-in" : "Still watching?";
  const detail = isHalfway
    ? (Number.isFinite(limitMinutes)
      ? `You're halfway through your <strong style="color:#fff;">${limitMinutes}-minute</strong> limit.`
      : "You're halfway through your time limit.")
    : (Number.isFinite(elapsedMinutes)
      ? `You've been here for <strong style="color:#fff;">${elapsedMinutes} minutes</strong>.`
      : "You've been here for a while.");

  const mount = document.fullscreenElement || document.body;

  const overlay = document.createElement("div");
  overlay.id = "fb-longstay-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:2147483647;
    display:flex; align-items:center; justify-content:center;
    background:rgba(15,20,30,0.72);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    font-family:system-ui,sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      background:#1e2738; color:#e8eaf0;
      border:1px solid #337ab7; border-radius:14px;
      padding:40px 36px; width:340px; text-align:center;
      box-shadow:0 0 40px rgba(51,122,183,0.25), 0 12px 40px rgba(0,0,0,0.7);
    ">
      <div style="font-size:2rem;margin-bottom:12px;">⏱</div>
      <h2 style="margin:0 0 10px;font-size:1.35rem;font-weight:800;color:#e8eaf0;">${headline}</h2>
      <p style="margin:0 0 28px;color:#8da1b9;font-size:0.95rem;line-height:1.5;">
        ${detail}<br>Is this still intentional?
      </p>
      <button id="fb-continue-btn" disabled style="
        width:100%; padding:14px; margin-bottom:12px;
        background:#3c4a5c; color:#8da1b9;
        border:1px solid #2d3644; border-bottom:4px solid #222830;
        border-radius:8px; font-size:1rem; font-weight:700;
        text-transform:uppercase; cursor:not-allowed;
        transition:all 0.15s;
      ">Continue <span id="fb-delay-counter">(5)</span></button>
      <button id="fb-back-btn" style="
        width:100%; padding:14px;
        background:none; color:#8da1b9;
        border:1px solid #3c4a5c; border-radius:8px;
        font-size:0.9rem; font-weight:600; cursor:pointer;
        transition:background 0.15s;
      ">Take a break</button>
    </div>
  `;

  mount.appendChild(overlay);

  // 5-second delay before Continue becomes active
  let remaining = 5;
  const counter = document.getElementById("fb-delay-counter");
  const continueBtn = document.getElementById("fb-continue-btn");

  const tick = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(tick);
      counter.textContent = "";
      continueBtn.disabled = false;
      continueBtn.style.cssText = `
        width:100%; padding:14px; margin-bottom:12px;
        background:#337ab7; color:#fff;
        border:1px solid #23527c; border-bottom:4px solid #23527c;
        border-radius:8px; font-size:1rem; font-weight:700;
        text-transform:uppercase; cursor:pointer;
        transition:all 0.05s;
      `;
      continueBtn.onmousedown = () => {
        continueBtn.style.transform = "translateY(3px)";
        continueBtn.style.borderBottomWidth = "1px";
      };
    } else {
      counter.textContent = `(${remaining})`;
    }
  }, 1000);

  // Continue: dismiss overlay, unblur
  continueBtn.addEventListener("click", () => {
    if (continueBtn.disabled) return;
    dismissOverlay();
  });

  // Take a break: close the tab (content scripts cannot navigate to chrome:// URLs).
  document.getElementById("fb-back-btn").addEventListener("click", () => {
    dismissOverlay();
    try {
      chrome.runtime.sendMessage({ action: "close_tab" });
    } catch (_) {
      // Fall back: at least navigate away from the current page.
      window.location.href = "about:blank";
    }
  });

  function dismissOverlay() {
    clearInterval(tick);
    overlay.remove();
  }
}

// ─── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NUDGE") {
    showNudgeBanner(msg.reason, msg);
  }
  if (msg.type === "LONG_STAY_OVERLAY") {
    showLongStayOverlay(msg);
  }
  if (msg.type === "LONG_STAY_REFRESH") {
    refreshLongStayStatus().catch(() => {});
  }
});

// ─── URL change notifier (SPA-safe) ──────────────────────────────────────────
// Does not read page content; only observes location changes and informs the background.
(function setupUrlChangeNotifier() {
  let lastHref = location.href;

  function notifyIfChanged() {
    const href = location.href;
    if (href === lastHref) return;
    lastHref = href;
    try {
      chrome.runtime.sendMessage({ type: "URL_CHANGED", url: href });
    } catch (_) {
      // ignore
    }
    refreshLongStayStatus().catch(() => {});
  }

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    notifyIfChanged();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    notifyIfChanged();
    return result;
  };

  window.addEventListener("popstate", notifyIfChanged);
  window.addEventListener("hashchange", notifyIfChanged);

  // Initial ping (helps pages that load into a different canonical URL).
  notifyIfChanged();
})();

// ─── Long-session continuous timer (same URL) ────────────────────────────────
let longStayEnabled = false;
let longStayLimitMs = 0;
let longStayBaselineUrl = null;
let longStayStartedAt = 0;
let longStayHalfwayShown = false;
let longStayExpiredFired = false;
let longStayGeneration = 0;
let longStayHalfTimeoutId = null;
let longStayEndTimeoutId = null;
let longStayVerifyTimeoutId = null;

function computeLongStayVerifyIntervalMs(limitMs) {
  // Check at a percentage of the session limit. Keep it reasonably frequent to catch
  // "left and came back" cases where URL change events might not fire (SPA edge cases).
  const byPercent = Math.round(limitMs * 0.1); // 10%
  return Math.max(30_000, Math.min(5 * 60_000, byPercent));
}

function nextAlignedTimeMs(nowMs, intervalMs) {
  const next = Math.ceil(nowMs / intervalMs) * intervalMs;
  return next === nowMs ? next + intervalMs : next;
}

function clearLongStayTimers() {
  if (longStayHalfTimeoutId != null) clearTimeout(longStayHalfTimeoutId);
  if (longStayEndTimeoutId != null) clearTimeout(longStayEndTimeoutId);
  if (longStayVerifyTimeoutId != null) clearTimeout(longStayVerifyTimeoutId);
  longStayHalfTimeoutId = null;
  longStayEndTimeoutId = null;
  longStayVerifyTimeoutId = null;
}

function resetLongStayBaseline(nextUrl) {
  longStayBaselineUrl = nextUrl;
  longStayStartedAt = Date.now();
  longStayHalfwayShown = false;
  longStayExpiredFired = false;
}

function scheduleLongStayTimers() {
  clearLongStayTimers();
  if (!longStayEnabled || !longStayBaselineUrl || !longStayLimitMs || longStayLimitMs <= 0) return;

  const gen = ++longStayGeneration;
  const now = Date.now();
  const halfAt = longStayStartedAt + Math.floor(longStayLimitMs / 2);
  const endAt = longStayStartedAt + longStayLimitMs;

  const halfDelay = Math.max(0, halfAt - now);
  const endDelay = Math.max(0, endAt - now);

  longStayHalfTimeoutId = setTimeout(() => {
    if (gen !== longStayGeneration) return;
    handleLongStayHalfway().catch(() => {});
  }, halfDelay);

  longStayEndTimeoutId = setTimeout(() => {
    if (gen !== longStayGeneration) return;
    handleLongStayEnd().catch(() => {});
  }, endDelay);

  const verifyIntervalMs = computeLongStayVerifyIntervalMs(longStayLimitMs);
  const verifyAt = nextAlignedTimeMs(now, verifyIntervalMs);
  longStayVerifyTimeoutId = setTimeout(() => {
    if (gen !== longStayGeneration) return;
    handleLongStayVerify().catch(() => {});
  }, Math.max(0, verifyAt - now));
}

async function refreshLongStayStatus(urlOverride) {
  const href = typeof urlOverride === "string" ? urlOverride : location.href;
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "LONG_STAY_STATUS_REQUEST",
      url: href
    });
  } catch (_) {
    return;
  }

  const active = Boolean(response?.active);
  const limitMinutes = parseInt(response?.limitMinutes, 10);
  if (!active || !Number.isFinite(limitMinutes) || limitMinutes <= 0) {
    longStayEnabled = false;
    longStayLimitMs = 0;
    longStayBaselineUrl = null;
    longStayStartedAt = 0;
    longStayHalfwayShown = false;
    longStayExpiredFired = false;
    clearLongStayTimers();
    return;
  }

  const nextLimitMs = Math.max(5, limitMinutes) * 60_000;

  const limitChanged = longStayEnabled && longStayLimitMs !== nextLimitMs;
  const urlChanged = longStayEnabled && longStayBaselineUrl && longStayBaselineUrl !== href;
  const wasDisabled = !longStayEnabled;

  longStayEnabled = true;
  longStayLimitMs = nextLimitMs;

  if (wasDisabled || urlChanged || limitChanged || !longStayBaselineUrl) {
    resetLongStayBaseline(href);
  }

  scheduleLongStayTimers();
}

async function verifyStillOnBaselineUrl() {
  if (!longStayEnabled || !longStayBaselineUrl) return false;

  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "LONG_STAY_VERIFY",
      baselineUrl: longStayBaselineUrl
    });
  } catch (_) {
    // If background is unavailable, fall back to checking the current document URL.
    return location.href === longStayBaselineUrl;
  }

  const currentUrl =
    typeof response?.url === "string" && response.url.length > 0 ? response.url : location.href;
  if (currentUrl !== longStayBaselineUrl) {
    resetLongStayBaseline(currentUrl);
    await refreshLongStayStatus(currentUrl);
    return false;
  }
  return true;
}

async function handleLongStayHalfway() {
  if (!longStayEnabled || longStayHalfwayShown) return;
  if (!(await verifyStillOnBaselineUrl())) return;

  const now = Date.now();
  const elapsedMs = now - longStayStartedAt;
  if (elapsedMs < longStayLimitMs / 2) {
    scheduleLongStayTimers();
    return;
  }

  longStayHalfwayShown = true;
  const limitMinutes = Math.max(1, Math.round(longStayLimitMs / 60_000));
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  chrome.runtime.sendMessage({
    type: "LONG_STAY_HALFWAY",
    url: longStayBaselineUrl,
    limitMinutes,
    elapsedMinutes
  }).catch(() => {});
  showLongStayOverlay({
    phase: "halfway",
    limitMinutes,
    elapsedMinutes
  });
}

async function handleLongStayEnd() {
  if (!longStayEnabled || longStayExpiredFired) return;
  if (!(await verifyStillOnBaselineUrl())) return;

  const now = Date.now();
  const elapsedMs = now - longStayStartedAt;
  if (elapsedMs < longStayLimitMs) {
    scheduleLongStayTimers();
    return;
  }

  longStayExpiredFired = true;
  const limitMinutes = Math.max(1, Math.round(longStayLimitMs / 60_000));
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  chrome.runtime
    .sendMessage({
      type: "LONG_STAY_EXPIRED",
      url: longStayBaselineUrl,
      limitMinutes,
      elapsedMinutes
    })
    .catch(() => {});
}

async function handleLongStayVerify() {
  if (!longStayEnabled) return;
  await verifyStillOnBaselineUrl();
  scheduleLongStayTimers();
}

refreshLongStayStatus().catch(() => {});
