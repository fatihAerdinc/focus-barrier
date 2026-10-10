// options.js — small helpers for options.html (keeps popup.js reusable)

function scrollToHash() {
  const hash = (location.hash || "#general").toLowerCase();
  const id = hash.replace("#", "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshInterventions() {
  const el = document.getElementById("interventionCount");
  if (!el) return;
  const data = await chrome.storage.local.get(["interventions"]);
  el.textContent = data.interventions || 0;
}

function formatTimestamp(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "First install: n/a";
  return `First install: ${new Date(parsed).toLocaleDateString()}`;
}

async function refreshAnalytics() {
  const ids = {
    blockedAttempts: "metricBlockedAttempts",
    pauseViews: "metricPauseViews",
    pauseContinues: "metricPauseContinues",
    pauseAbandons: "metricPauseAbandons",
    doomscrollTriggers: "metricDoomscrollTriggers",
    longSessionHalfwayNudges: "metricLongHalfway",
    longSessionExpiries: "metricLongExpiries",
    installCount: "metricInstallCount"
  };

  const fields = Object.keys(ids).concat([
    "firstInstallAt",
    "interceptLatencyTotalMs",
    "interceptLatencySamples"
  ]);
  const data = await chrome.storage.local.get(fields);

  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(data[key] || 0);
  }

  const pauseViews = Number(data.pauseViews) || 0;
  const pauseContinues = Number(data.pauseContinues) || 0;
  const pauseAbandons = Number(data.pauseAbandons) || 0;
  const continueRate = pauseViews > 0 ? Math.round((pauseContinues / pauseViews) * 100) : 0;
  const abandonRate = pauseViews > 0 ? Math.round((pauseAbandons / pauseViews) * 100) : 0;

  const continueRateEl = document.getElementById("metricContinueRate");
  if (continueRateEl) continueRateEl.textContent = `${continueRate}%`;

  const continueDetailEl = document.getElementById("metricContinueDetail");
  if (continueDetailEl) continueDetailEl.textContent = `Continues / pause views, abandon rate ${abandonRate}%`;

  const avgLatency = Number(data.interceptLatencySamples) > 0
    ? Number(data.interceptLatencyTotalMs || 0) / Number(data.interceptLatencySamples)
    : 0;
  const latencyEl = document.getElementById("metricInterceptLatency");
  if (latencyEl) latencyEl.textContent = `${avgLatency.toFixed(1)} ms`;

  const detailEl = document.getElementById("metricInterceptDetail");
  if (detailEl) {
    const sampleCount = Number(data.interceptLatencySamples) || 0;
    detailEl.textContent = sampleCount > 0
      ? `${sampleCount} measured intercepts`
      : "Decision-time measurement";
  }

  const installDetailEl = document.getElementById("metricFirstInstall");
  if (installDetailEl) installDetailEl.textContent = formatTimestamp(data.firstInstallAt);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  refreshInterventions().catch(() => {});
  refreshAnalytics().catch(() => {});
});

function clampTimerSeconds(raw, fallback = 10) {
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(300, Math.max(1, parsed));
}

async function initCountdownSettings() {
  const input = document.getElementById("timer");
  const saveBtn = document.getElementById("timerSaveBtn");
  if (!input || !saveBtn) return;

  const data = await chrome.storage.local.get(["timer"]);
  const current = clampTimerSeconds(data.timer, 10);
  input.value = String(current);

  async function save() {
    const next = clampTimerSeconds(input.value, current);
    input.value = String(next);
    await chrome.storage.local.set({ timer: next });
  }

  saveBtn.addEventListener("click", () => save().catch(() => {}));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") save().catch(() => {});
  });
}

function normalizeDomainInput(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split("/")[0] || "";
  s = s.split("?")[0] || "";
  s = s.split("#")[0] || "";
  s = s.trim().replace(/\.+$/, "");
  if (s && !s.includes(".")) s = `${s}.com`;
  return s;
}

function renderMegaList(container, sites) {
  if (!container) return;
  container.innerHTML = "";

  const list = Array.isArray(sites) ? sites : [];
  if (list.length === 0) {
    const el = document.createElement("div");
    el.className = "empty";
    el.textContent = "No permanently blocked sites yet.";
    container.appendChild(el);
    return;
  }

  list.forEach((site) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div><code>${site}</code></div>
      <button type="button">Remove</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      await confirmRemovalWithDelay({
        itemLabel: site,
        seconds: 5,
        onConfirm: async () => {
          const data = await chrome.storage.local.get(["megaBlockedSites"]);
          const current = Array.isArray(data.megaBlockedSites) ? data.megaBlockedSites : [];
          const next = current.filter((x) => x !== site);
          await chrome.storage.local.set({ megaBlockedSites: next });
          renderMegaList(container, next);
        }
      });
    });
    container.appendChild(row);
  });
}

function getConfirmModal() {
  const modal = document.getElementById("confirmModal");
  const body = document.getElementById("confirmBody");
  const cancelBtn = document.getElementById("confirmCancel");
  const okBtn = document.getElementById("confirmOk");
  if (!modal || !body || !cancelBtn || !okBtn) return null;

  return { modal, body, cancelBtn, okBtn };
}

function confirmRemovalWithDelay({ itemLabel, seconds = 5, onConfirm }) {
  const ui = getConfirmModal();
  if (!ui) return Promise.resolve(onConfirm());

  return new Promise((resolve) => {
    let remaining = seconds;
    let tickId = null;

    function close() {
      if (tickId != null) clearInterval(tickId);
      tickId = null;
      ui.okBtn.disabled = true;
      ui.okBtn.textContent = `Remove (${seconds})`;
      ui.modal.classList.remove("show");
      ui.modal.setAttribute("aria-hidden", "true");
      ui.cancelBtn.onclick = null;
      ui.okBtn.onclick = null;
      ui.modal.onclick = null;
    }

    ui.body.innerHTML = `Remove <code>${itemLabel}</code>? This requires a ${seconds}-second delay.`;
    ui.modal.classList.add("show");
    ui.modal.setAttribute("aria-hidden", "false");

    ui.okBtn.disabled = true;
    ui.okBtn.textContent = `Remove (${remaining})`;

    ui.cancelBtn.onclick = () => {
      close();
      resolve();
    };

    ui.modal.onclick = (ev) => {
      if (ev.target === ui.modal) {
        close();
        resolve();
      }
    };

    ui.okBtn.onclick = async () => {
      if (ui.okBtn.disabled) return;
      close();
      await onConfirm();
      resolve();
    };

    tickId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(tickId);
        tickId = null;
        ui.okBtn.disabled = false;
        ui.okBtn.textContent = "Remove";
      } else {
        ui.okBtn.textContent = `Remove (${remaining})`;
      }
    }, 1000);
  });
}


async function initMegaBlockSettings() {
  const input = document.getElementById("megaDomainInput");
  const addBtn = document.getElementById("megaAddBtn");
  const listEl = document.getElementById("megaList");
  if (!input || !addBtn || !listEl) return;

  const data = await chrome.storage.local.get(["megaBlockedSites"]);
  const current = Array.isArray(data.megaBlockedSites) ? data.megaBlockedSites : [];
  renderMegaList(listEl, current);

  async function addCurrent() {
    const normalized = normalizeDomainInput(input.value);
    if (!normalized) return;

    const data2 = await chrome.storage.local.get(["megaBlockedSites", "blockedSites"]);
    const sites = Array.isArray(data2.megaBlockedSites) ? data2.megaBlockedSites : [];

    // Ensure a site can't be both permanently blocked and regularly blocked.
    const blockedSites = Array.isArray(data2.blockedSites) ? data2.blockedSites : [];
    const blockedFiltered = blockedSites
      .map((x) => normalizeDomainInput(x))
      .filter((x) => x && x !== normalized);

    if (sites.includes(normalized)) {
      input.value = "";
      renderMegaList(listEl, sites);
      return;
    }
    const next = [...sites, normalized].sort();
    await chrome.storage.local.set({ megaBlockedSites: next, blockedSites: blockedFiltered });
    input.value = "";
    renderMegaList(listEl, next);
  }

  addBtn.addEventListener("click", () => addCurrent().catch(() => {}));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") addCurrent().catch(() => {});
  });
}

function initPrivacyAndTutorial() {
  const privacyBtn = document.getElementById("privacyBtn");

  const tutorialBtn = document.getElementById("tutorialBtn");
  const tourHint = document.getElementById("tourHint");

  privacyBtn?.addEventListener("click", () => {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("privacy.html") });
    } catch (_) {
      window.open("privacy.html", "_blank");
    }
  });

  tutorialBtn?.addEventListener("click", async () => {
    try {
      await chrome.storage.local.set({
        focusBarrierTourSeen: true,
        focusBarrierTourResume: { stepIndex: 0, ts: Date.now() }
      });
    } catch (_) {}

    if (tourHint) {
      tourHint.hidden = false;
      try {
        tourHint.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (_) {}
    }
  });
}

window.addEventListener("hashchange", scrollToHash);
window.addEventListener("DOMContentLoaded", () => {
  // Ensure default route
  if (!location.hash) history.replaceState(null, "", "#general");
  scrollToHash();
  refreshInterventions();
  refreshAnalytics().catch(() => {});
  initCountdownSettings().catch(() => {});
  initMegaBlockSettings().catch(() => {});
  initPrivacyAndTutorial();
});
