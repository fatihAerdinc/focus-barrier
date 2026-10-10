// popup.js — Focus Barrier v2.1

(() => {
  const settingsBtn = document.getElementById("openSettings");
  const supportBtn = document.getElementById("openSupport");

  const SUPPORT_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLScNWhr51Qg7tv9ou69RgtdJrjEUyVwTZx8LLp4ZuZ-r7CcbqQ/viewform?usp=dialog";

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  }

  if (supportBtn) {
    supportBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: SUPPORT_URL });
    });
  }

  // If this page doesn't have the full settings UI, stop here.
  const modeSelect = document.getElementById("mode");
  if (!modeSelect) return;

  const newSiteInput = document.getElementById("newSite");
  const addBtn = document.getElementById("addBtn");
  const siteListDiv = document.getElementById("siteList");
  const feedbackEl = document.getElementById("addFeedback");
  const smartToggle = document.getElementById("smartDetection");
  const doomToggle = document.getElementById("doomscrollDetect");
  const longToggle = document.getElementById("longVideoDetect");
  const longSessionMinutesInput = document.getElementById("longSessionMinutes");
  const longSessionRow = document.getElementById("longSessionRow");
  const subToggles = document.getElementById("subToggles");
  const modeDescriptionEl = document.getElementById("modeDescription");
  const modeInfoEl = document.getElementById("modeInfo");
  const infoPopover = document.getElementById("infoPopover");
  const infoPopoverTitle = document.getElementById("infoPopoverTitle");
  const infoPopoverBody = document.getElementById("infoPopoverBody");

  let activeInfoAnchor = null;
  let repositionRaf = null;
  let followRaf = null;

  function hideInfoPopover() {
    if (!infoPopover) return;
    infoPopover.classList.remove("show");
    infoPopover.setAttribute("aria-hidden", "true");
    activeInfoAnchor = null;
    if (repositionRaf != null) cancelAnimationFrame(repositionRaf);
    repositionRaf = null;
    if (followRaf != null) cancelAnimationFrame(followRaf);
    followRaf = null;
  }

  function requestInfoPopoverReposition() {
    if (repositionRaf != null) cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      repositionRaf = null;
      repositionInfoPopover();
    });
  }

  function repositionInfoPopover() {
    if (!infoPopover?.classList.contains("show")) return;
    if (!activeInfoAnchor) return;

    const rect = activeInfoAnchor.getBoundingClientRect();
    const pad = 8;

    // Must measure after it becomes visible.
    const popRect = infoPopover.getBoundingClientRect();

    let left = rect.left;
    let top = rect.bottom + pad;

    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - popRect.width - 8);
    left = Math.min(maxLeft, Math.max(minLeft, left));

    // Prefer underneath; flip above if needed.
    if (top + popRect.height > window.innerHeight - 8) {
      const aboveTop = rect.top - popRect.height - pad;
      if (aboveTop >= 8) top = aboveTop;
    }

    infoPopover.style.left = `${left}px`;
    infoPopover.style.top = `${top}px`;
  }

  function startFollowingPopover() {
    if (followRaf != null) cancelAnimationFrame(followRaf);
    const loop = () => {
      if (!infoPopover?.classList.contains("show") || !activeInfoAnchor) {
        followRaf = null;
        return;
      }
      repositionInfoPopover();
      followRaf = requestAnimationFrame(loop);
    };
    followRaf = requestAnimationFrame(loop);
  }

  function showInfoPopover(anchorEl, { title, body }) {
    if (!infoPopover || !infoPopoverTitle || !infoPopoverBody) return;
    if (!anchorEl) return;

    infoPopoverTitle.textContent = title || "Info";
    infoPopoverBody.textContent = body || "";

    infoPopover.classList.add("show");
    infoPopover.setAttribute("aria-hidden", "false");
    activeInfoAnchor = anchorEl;

    requestInfoPopoverReposition();
    startFollowingPopover();
  }

  function renderModeDescription(mode) {
    if (!modeDescriptionEl) return;
    const copy = {
      easy: "One confirmation unlocks all blocked sites in this tab until you close it.",
      balanced: "Confirm once per blocked site per tab; navigating inside that site stays unlocked.",
      strict: "Confirm every unique URL; any new page or video needs a fresh confirmation."
    };
    const text = copy[mode] || "";
    modeDescriptionEl.textContent = text;
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

  function wireInfoIcon(el) {
    if (!el) return;
    const onActivate = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const title = el.dataset.title || "Info";
      const body = el.dataset.info || el.title || "";
      if (!body) return;

      if (activeInfoAnchor === el && infoPopover?.classList.contains("show")) {
        hideInfoPopover();
        return;
      }
      showInfoPopover(el, { title, body });
    };

    el.addEventListener("click", onActivate);
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") onActivate(ev);
    });
  }

  // Global close handlers
  document.addEventListener("click", (ev) => {
    if (!infoPopover?.classList.contains("show")) return;
    const target = ev.target;
    if (target instanceof Element) {
      if (target.closest(".info-popover")) return;
      if (target.closest(".info-icon")) return;
    }
    hideInfoPopover();
  });
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") hideInfoPopover();
  });

// ─── Initialize from storage ──────────────────────────────────────────────────
chrome.storage.local.get([
  "mode", "blockedSites",
  "smartDetection", "doomscrollDetect", "longVideoDetect",
  "longSessionMinutes"
], (data) => {
  modeSelect.value = data.mode || "easy";

  renderModeDescription(modeSelect.value);

  smartToggle.checked = !!data.smartDetection;
  doomToggle.checked  = data.doomscrollDetect !== false; // default on
  if (longToggle) longToggle.checked = data.longVideoDetect !== false; // default on
  subToggles.classList.toggle("collapsed", !data.smartDetection);

  if (longSessionRow && longToggle) {
    longSessionRow.style.display = longToggle.checked ? "flex" : "none";
  }

  if (longSessionMinutesInput) {
    const limit = parseInt(data.longSessionMinutes, 10);
    longSessionMinutesInput.value = Number.isFinite(limit)
      ? Math.min(180, Math.max(5, limit))
      : 60;
  }

  renderSites(Array.isArray(data.blockedSites) ? data.blockedSites : []);
});

  // Wire info icons (mode + inline ones)
  if (modeInfoEl) {
    modeInfoEl.dataset.title = "Strictness mode";
    modeInfoEl.dataset.info =
      "Strictness determines how harsh the blocks will be. You can always change it. Specifics for each strictness are shown below once selected.";
  }
document.querySelectorAll(".info-icon").forEach((el) => wireInfoIcon(el));

// ─── Auto-save mode + timer ───────────────────────────────────────────────────
modeSelect.addEventListener("change", () => {
  chrome.storage.local.set({ mode: modeSelect.value });
  renderModeDescription(modeSelect.value);
});

// ─── Smart detection toggles ──────────────────────────────────────────────────
smartToggle.addEventListener("change", () => {
  const on = smartToggle.checked;
  chrome.storage.local.set({ smartDetection: on });
  subToggles.classList.toggle("collapsed", !on);
});

doomToggle.addEventListener("change", () => {
  chrome.storage.local.set({ doomscrollDetect: doomToggle.checked });
});

if (longToggle) {
  longToggle.addEventListener("change", () => {
    chrome.storage.local.set({ longVideoDetect: longToggle.checked });
    if (longSessionRow) {
      longSessionRow.style.display = longToggle.checked ? "flex" : "none";
    }
  });
}

if (longSessionMinutesInput) {
  longSessionMinutesInput.addEventListener("change", () => {
    const parsed = parseInt(longSessionMinutesInput.value, 10);
    const clamped = Number.isFinite(parsed) ? Math.min(180, Math.max(5, parsed)) : 60;
    longSessionMinutesInput.value = clamped;
    chrome.storage.local.set({ longSessionMinutes: clamped });
  });
}

// ─── Add site ─────────────────────────────────────────────────────────────────
addBtn.addEventListener("click", () => {
  const site = normalizeDomainInput(newSiteInput.value);
  if (!site) return;

  chrome.storage.local.get(["blockedSites", "megaBlockedSites"], (data) => {
    const sites = data.blockedSites || [];
    const mega = Array.isArray(data.megaBlockedSites) ? data.megaBlockedSites : [];
    if (mega.map((x) => normalizeDomainInput(x)).includes(site)) {
      showFeedback(`"${site}" is Mega Blocked. Remove it from Mega Block first.`, "warn");
      return;
    }
    if (sites.includes(site)) {
      showFeedback(`"${site}" is already blocked.`, "warn");
      return;
    }
    sites.push(site);
    chrome.storage.local.set({ blockedSites: sites }, () => {
      renderSites(sites);
      newSiteInput.value = "";
      showFeedback(`"${site}" added.`, "ok");
    });
  });
});

function showFeedback(msg, type) {
  feedbackEl.textContent = msg;
  feedbackEl.style.color = type === "ok" ? "#5cb85c" : "#e68a00";
  clearTimeout(feedbackEl._t);
  feedbackEl._t = setTimeout(() => { feedbackEl.textContent = ""; }, 2500);
}

// ─── Render site list ─────────────────────────────────────────────────────────
function renderSites(sites) {
  siteListDiv.innerHTML = "<label>Currently Blocked:</label>";
  sites.forEach((site, index) => {
    const item = document.createElement("div");
    item.className = "site-item";
    item.id = `item-${index}`;
    item.innerHTML = `
      <span class="site-name">${site}</span>
      <div class="dots-btn" data-index="${index}">&#8942;</div>
      <div class="dropdown-menu" id="menu-${index}">
        <div class="edit-opt"   data-index="${index}">Edit</div>
        <div class="remove-opt" data-index="${index}" style="color:#d9534f;">Remove</div>
      </div>
    `;
    siteListDiv.appendChild(item);
  });
}

// ─── Click handler ────────────────────────────────────────────────────────────
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("dots-btn")) {
    const index = e.target.dataset.index;
    const menu  = document.getElementById(`menu-${index}`);
    document.querySelectorAll(".dropdown-menu").forEach(m => m !== menu && m.classList.remove("show"));
    menu.classList.toggle("show");
    return;
  }

  if (!e.target.closest(".site-item")) {
    document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("show"));
  }

  if (e.target.classList.contains("remove-opt")) {
    const index = parseInt(e.target.dataset.index, 10);
    chrome.storage.local.get(["blockedSites"], (data) => {
      const sites = data.blockedSites || [];
      sites.splice(index, 1);
      chrome.storage.local.set({ blockedSites: sites }, () => renderSites(sites));
    });
  }

  if (e.target.classList.contains("edit-opt")) {
    const index   = parseInt(e.target.dataset.index, 10);
    const itemRow = document.getElementById(`item-${index}`);
    const current = itemRow.querySelector(".site-name").textContent;
    itemRow.innerHTML = `
      <input type="text" class="edit-input" id="input-${index}"
             value="${current}"
             style="flex:1;padding:6px 8px;border-radius:4px;border:1px solid var(--pri);background:#12151c;color:#fff;font-size:0.85rem;margin-bottom:0;">
      <div class="save-opt" data-index="${index}"
           style="color:var(--pri);font-weight:700;cursor:pointer;margin-left:10px;white-space:nowrap;">SAVE</div>
    `;
    const inp = document.getElementById(`input-${index}`);
    inp.focus(); inp.select();
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") saveEdit(index); });
  }

  if (e.target.classList.contains("save-opt")) {
    saveEdit(parseInt(e.target.dataset.index, 10));
  }
});

async function saveEdit(index) {
  const el = document.getElementById(`input-${index}`);
  if (!el) return;
  const newValue = normalizeDomainInput(el.value);
  if (!newValue) return;
  const data  = await chrome.storage.local.get(["blockedSites", "megaBlockedSites"]);
  const sites = data.blockedSites || [];
  const mega = Array.isArray(data.megaBlockedSites) ? data.megaBlockedSites : [];
  if (mega.map((x) => normalizeDomainInput(x)).includes(newValue)) {
    showFeedback(`"${newValue}" is Mega Blocked. Remove it from Mega Block first.`, "warn");
    renderSites(sites);
    return;
  }
  sites[index] = newValue;
  await chrome.storage.local.set({ blockedSites: sites });
  renderSites(sites);
}
})();
