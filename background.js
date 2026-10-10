// background.js — Focus Barrier v2.1

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseHttpUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (_) {
    return null;
  }
  if (
    url.protocol === "chrome-extension:" ||
    url.protocol === "chrome:" ||
    url.protocol === "edge:"
  ) {
    return null;
  }
  return url;
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

async function incrementInterventions() {
  const data = await chrome.storage.local.get(["interventions"]);
  const count = (data.interventions || 0) + 1;
  await chrome.storage.local.set({ interventions: count });
}

const ANALYTICS_DEFAULTS = {
  installCount: 0,
  firstInstallAt: 0,
  blockedAttempts: 0,
  pauseViews: 0,
  pauseContinues: 0,
  pauseAbandons: 0,
  doomscrollTriggers: 0,
  longSessionHalfwayNudges: 0,
  longSessionExpiries: 0,
  megaBlocks: 0,
  interceptLatencyTotalMs: 0,
  interceptLatencySamples: 0
};

async function readAnalytics() {
  const data = await chrome.storage.local.get(Object.keys(ANALYTICS_DEFAULTS));
  return { ...ANALYTICS_DEFAULTS, ...data };
}

async function incrementAnalytics(key, amount = 1) {
  const analytics = await readAnalytics();
  const current = Number(analytics[key]) || 0;
  await chrome.storage.local.set({ [key]: current + amount });
}

async function recordInterceptLatency(startTimeMs) {
  const elapsedMs = Math.max(0, performance.now() - startTimeMs);
  const analytics = await readAnalytics();
  await chrome.storage.local.set({
    interceptLatencyTotalMs: (Number(analytics.interceptLatencyTotalMs) || 0) + elapsedMs,
    interceptLatencySamples: (Number(analytics.interceptLatencySamples) || 0) + 1
  });
}

async function getConfig() {
  const data = await chrome.storage.local.get([
    "blockedSites",
    "megaBlockedSites",
    "mode",
    "smartDetection",
    "doomscrollDetect",
    "longVideoDetect",
    "longSessionMinutes"
  ]);

  const megaBlockedSitesRaw = Array.isArray(data.megaBlockedSites) ? data.megaBlockedSites : [];
  const megaBlockedSites = megaBlockedSitesRaw.map(normalizeDomainInput).filter(Boolean);
  const megaSet = new Set(megaBlockedSites);

  const blockedSitesRaw = Array.isArray(data.blockedSites) ? data.blockedSites : [];
  const blockedSitesNormalized = blockedSitesRaw.map(normalizeDomainInput).filter(Boolean);
  const blockedSites = blockedSitesNormalized.filter((site) => !megaSet.has(site));

  const parsedLongMinutes = parseInt(data.longSessionMinutes, 10);
  const longSessionMinutes = Number.isFinite(parsedLongMinutes)
    ? Math.min(180, Math.max(5, parsedLongMinutes))
    : 60;

  return {
    blockedSites,
    megaBlockedSites,
    mode: data.mode || "easy",
    smartDetection: Boolean(data.smartDetection),
    doomscrollDetect: data.doomscrollDetect !== false,
    longVideoDetect: data.longVideoDetect !== false,
    longSessionMinutes
  };
}

// ─── Authorization + blocklist helpers ───────────────────────────────────────
async function getTabAuth(tabId) {
  const data = await chrome.storage.session.get(tabId.toString());
  return data[tabId.toString()] || null;
}

function isAuthorizedForUrl({ mode, hostname, urlString, tabAuth }) {
  if (!tabAuth || tabAuth.authorized !== true) return false;
  if (mode === "easy") return true;
  if (mode === "balanced") return hostname.includes(tabAuth.domain);
  return urlString === tabAuth.exactUrl;
}

function getBlockedSiteKey({ blockedSites, hostname }) {
  return blockedSites.find((site) => hostname.includes(site)) || null;
}

function getMegaBlockedSiteKey({ megaBlockedSites, hostname }) {
  return megaBlockedSites.find((site) => hostname.includes(site)) || null;
}

function isYouTube(hostname) {
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
}
function isInstagram(hostname) {
  return hostname === "instagram.com" || hostname.endsWith(".instagram.com");
}
function isTikTok(hostname) {
  return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
}

function getDoomscrollKind(hostname, urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return "other";

  if (isTikTok(hostname)) return "shortform";
  if (isYouTube(hostname) && parsed.pathname.includes("/shorts")) return "shortform";
  if (isInstagram(hostname) && parsed.pathname.includes("/reel")) return "shortform";
  return "other";
}

const doomscrollStateByTabId = new Map();

// ─── Instagram home (/) 3-minute pause (alarm-based, background-safe) ─────────
// IMPORTANT: MV3 service workers can restart at any time, so this logic must be stateless.
// We rely on alarms persisted by Chrome, not in-memory maps.
const IG_HOME_LIMIT_MS = 3 * 60_000;

function getIgHomeAlarmName(tabId) {
  return `fb-ig-home:${tabId}`;
}

function isInstagramHomeUrlString(urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return false;
  const hostname = parsed.hostname.replace(/^www\./, "");
  if (!isInstagram(hostname)) return false;
  // Instagram often adds query params on the home feed; treat any "/" as home,
  // but keep Reels behavior unchanged (handled by /reel path elsewhere).
  return parsed.pathname === "/";
}

async function clearIgHome(tabId) {
  await chrome.alarms.clear(getIgHomeAlarmName(tabId));
}

async function maybeHandleInstagramHome(tabId, urlString) {
  const decisionStartedAt = performance.now();
  if (!isInstagramHomeUrlString(urlString)) {
    await clearIgHome(tabId);
    return;
  }

  const config = await getConfig();
  if (!config.smartDetection || !config.doomscrollDetect) {
    await clearIgHome(tabId);
    return;
  }

  const parsed = parseHttpUrl(urlString);
  if (!parsed) return;
  const hostname = parsed.hostname.replace(/^www\./, "");

  const siteKey = getBlockedSiteKey({ blockedSites: config.blockedSites, hostname });
  if (!siteKey) {
    await clearIgHome(tabId);
    return;
  }

  const tabAuth = await getTabAuth(tabId);
  const isAuth = isAuthorizedForUrl({
    mode: config.mode,
    hostname,
    urlString,
    tabAuth
  });
  if (!isAuth) {
    await clearIgHome(tabId);
    return;
  }

  const alarmName = getIgHomeAlarmName(tabId);
  const existingAlarm = await chrome.alarms.get(alarmName);
  if (existingAlarm) return;
  chrome.alarms.create(alarmName, { when: Date.now() + IG_HOME_LIMIT_MS });
}

async function handleIgHomeAlarm(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    await clearIgHome(tabId);
    return;
  }
  const tabUrl = typeof tab?.url === "string" ? tab.url : null;
  if (!tabUrl || !isInstagramHomeUrlString(tabUrl)) {
    await clearIgHome(tabId);
    return;
  }

  const config = await getConfig();
  if (!config.smartDetection || !config.doomscrollDetect) {
    await clearIgHome(tabId);
    return;
  }

  const parsed = parseHttpUrl(tabUrl);
  if (!parsed) {
    await clearIgHome(tabId);
    return;
  }
  const hostname = parsed.hostname.replace(/^www\./, "");

  const siteKey = getBlockedSiteKey({ blockedSites: config.blockedSites, hostname });
  if (!siteKey) {
    await clearIgHome(tabId);
    return;
  }

  const tabAuth = await getTabAuth(tabId);
  const isAuth = isAuthorizedForUrl({
    mode: config.mode,
    hostname,
    urlString: tabUrl,
    tabAuth
  });
  if (!isAuth) {
    await clearIgHome(tabId);
    return;
  }

  await chrome.storage.session.remove(tabId.toString());
  await incrementInterventions();
  await incrementAnalytics("blockedAttempts");
  await incrementAnalytics("pauseViews");
  await incrementAnalytics("doomscrollTriggers");
  await recordInterceptLatency(decisionStartedAt);

  const pauseUrl =
    chrome.runtime.getURL("pause.html") +
    `?target=${encodeURIComponent(tabUrl)}` +
    `&tabId=${tabId}` +
    `&hostname=${encodeURIComponent(hostname)}` +
    `&site=${encodeURIComponent(siteKey)}` +
    `&mode=${encodeURIComponent(config.mode)}` +
    `&reason=doomscroll`;

  await clearIgHome(tabId);
  chrome.tabs.update(tabId, { url: pauseUrl }).catch(() => {});
}

// ─── Long-session (same-URL) status + expiry (continuous timer runs in content script) ───
async function getLongStayStatusForUrl(tabId, urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return { active: false, limitMinutes: 60 };

  const config = await getConfig();
  if (!config.smartDetection || !config.longVideoDetect) {
    return { active: false, limitMinutes: config.longSessionMinutes };
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  const siteKey = getBlockedSiteKey({ blockedSites: config.blockedSites, hostname });
  if (!siteKey) return { active: false, limitMinutes: config.longSessionMinutes };

  // Only after authorization.
  const tabAuth = await getTabAuth(tabId);
  const isAuth = isAuthorizedForUrl({
    mode: config.mode,
    hostname,
    urlString,
    tabAuth
  });
  return {
    active: Boolean(isAuth),
    limitMinutes: config.longSessionMinutes,
    hostname,
    siteKey,
    mode: config.mode
  };
}

function getContentKey(kind, hostname, urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return urlString;

  if (kind === "shortform") {
    if (isTikTok(hostname)) {
      const m = parsed.pathname.match(/\/video\/(\d+)/);
      if (m) return `tiktok:${m[1]}`;
      return `tiktok:${parsed.pathname}`;
    }
    if (isYouTube(hostname)) {
      const m = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
      if (m) return `ytshorts:${m[1]}`;
      return `ytshorts:${parsed.pathname}`;
    }
    if (isInstagram(hostname)) {
      const m = parsed.pathname.match(/\/reels?\/([^/?#]+)/);
      if (m) return `igreel:${m[1]}`;
      return `igreel:${parsed.pathname}`;
    }
  }

  // Default: treat content as "path-level" to avoid false positives from query param changes.
  return `${hostname}${parsed.pathname}`;
}

function recordDoomscrollChange(tabId, kind, hostname, urlString) {
  const now = Date.now();
  const state = doomscrollStateByTabId.get(tabId) || {
    kind,
    lastUrl: null,
    lastContentKey: null,
    times: [],
    warmupUntil: 0
  };

  if (state.kind !== kind) {
    state.kind = kind;
    state.lastUrl = null;
    state.lastContentKey = null;
    state.times = [];
  }

  const contentKey = getContentKey(kind, hostname, urlString);

  // Ignore non-content URL churn (e.g., YouTube Shorts adding params on first load).
  if (state.lastContentKey === contentKey) {
    state.lastUrl = urlString;
    doomscrollStateByTabId.set(tabId, state);
    return state;
  }

  state.lastUrl = urlString;
  state.lastContentKey = contentKey;

  // Warmup after authorization to prevent immediate false positives on initial loads.
  if (now < state.warmupUntil) {
    doomscrollStateByTabId.set(tabId, state);
    return state;
  }

  state.times.push(now);

  // Prune old timestamps to keep memory bounded.
  const maxAgeMs = kind === "shortform" ? 6 * 60 * 1000 : 2 * 60 * 1000;
  state.times = state.times.filter((t) => now - t <= maxAgeMs);

  // Keep only the last few transitions we care about.
  if (state.times.length > 6) state.times = state.times.slice(-6);

  doomscrollStateByTabId.set(tabId, state);
  return state;
}

function isDoomscrolling(kind, times) {
  if (kind === "shortform") {
    // Shortform: trigger if the user switches content 4+ times within 8 minutes.
    if (!times || times.length < 4) return false;
    const t1 = times[times.length - 4];
    const t4 = times[times.length - 1];
    return (t4 - t1) <= 8 * 60 * 1000;
  }

  // Other blocked sites: 3 changes where each is within 30–60s of the previous,
  // spanning no more than ~90 seconds total.
  if (!times || times.length < 3) return false;
  const t1 = times[times.length - 3];
  const t2 = times[times.length - 2];
  const t3 = times[times.length - 1];
  return (t2 - t1) <= 60 * 1000 && (t3 - t2) <= 60 * 1000 && (t3 - t1) <= 90 * 1000;
}

async function triggerPauseForDoomscroll(tabId, urlString, hostname, siteKey, mode) {
  const decisionStartedAt = performance.now();
  // Force a new barrier by clearing auth, then redirect to pause.
  await chrome.storage.session.remove(tabId.toString());
  await incrementInterventions();
  await incrementAnalytics("blockedAttempts");
  await incrementAnalytics("pauseViews");
  await incrementAnalytics("doomscrollTriggers");
  await recordInterceptLatency(decisionStartedAt);

  const pauseUrl =
    chrome.runtime.getURL("pause.html") +
    `?target=${encodeURIComponent(urlString)}` +
    `&tabId=${tabId}` +
    `&hostname=${encodeURIComponent(hostname)}` +
    `&site=${encodeURIComponent(siteKey)}` +
    `&mode=${encodeURIComponent(mode)}` +
    `&reason=doomscroll`;

  chrome.tabs.update(tabId, { url: pauseUrl }).catch(() => {});
}

// ─── Main blocker: redirect to pause.html unless authorized ──────────────────
async function maybeEnforceBlocker(tabId, urlString) {
  const decisionStartedAt = performance.now();
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return;

  const hostname = parsed.hostname.replace(/^www\./, "");
  const config = await getConfig();

  const megaKey = getMegaBlockedSiteKey({ megaBlockedSites: config.megaBlockedSites, hostname });
  if (megaKey) {
    await chrome.storage.session.remove(tabId.toString());
    await incrementInterventions();
    await incrementAnalytics("blockedAttempts");
    await incrementAnalytics("megaBlocks");
    await recordInterceptLatency(decisionStartedAt);

    const megaUrl =
      chrome.runtime.getURL("mega.html") +
      `?target=${encodeURIComponent(urlString)}` +
      `&tabId=${tabId}` +
      `&hostname=${encodeURIComponent(hostname)}` +
      `&site=${encodeURIComponent(megaKey)}`;
    chrome.tabs.update(tabId, { url: megaUrl }).catch(() => {});
    return;
  }

  const siteKey = getBlockedSiteKey({ blockedSites: config.blockedSites, hostname });
  if (!siteKey) return;

  const tabAuth = await getTabAuth(tabId);
  const isAuth = isAuthorizedForUrl({
    mode: config.mode,
    hostname,
    urlString,
    tabAuth
  });

  if (!isAuth) {
    await incrementInterventions();
    await incrementAnalytics("blockedAttempts");
    await incrementAnalytics("pauseViews");
    await recordInterceptLatency(decisionStartedAt);
    const pauseUrl =
      chrome.runtime.getURL("pause.html") +
      `?target=${encodeURIComponent(urlString)}` +
      `&tabId=${tabId}` +
      `&hostname=${encodeURIComponent(hostname)}` +
      `&site=${encodeURIComponent(siteKey)}` +
      `&mode=${encodeURIComponent(config.mode)}`;
    chrome.tabs.update(tabId, { url: pauseUrl });
    return;
  }
}

async function maybeHandleDoomscroll(tabId, urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return;

  const config = await getConfig();
  if (!config.smartDetection || !config.doomscrollDetect) return;

  const hostname = parsed.hostname.replace(/^www\./, "");
  const siteKey = getBlockedSiteKey({ blockedSites: config.blockedSites, hostname });
  if (!siteKey) {
    doomscrollStateByTabId.delete(tabId);
    return;
  }

  // Only after authorization.
  const tabAuth = await getTabAuth(tabId);
  const isAuth = isAuthorizedForUrl({
    mode: config.mode,
    hostname,
    urlString,
    tabAuth
  });
  if (!isAuth) {
    doomscrollStateByTabId.delete(tabId);
    return;
  }

  const kind = getDoomscrollKind(hostname, urlString);
  // Shortform platforms only (YouTube Shorts / Instagram Reels / TikTok).
  // For other blocked sites, do not attempt doomscroll detection to avoid false positives
  // from normal link navigation.
  if (kind !== "shortform") {
    doomscrollStateByTabId.delete(tabId);
    return;
  }
  const state = recordDoomscrollChange(tabId, kind, hostname, urlString);
  if (!isDoomscrolling(kind, state.times)) return;

  doomscrollStateByTabId.delete(tabId);
  await triggerPauseForDoomscroll(tabId, urlString, hostname, siteKey, config.mode);
}

// ─── Wiring ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SESSION_START") {
    (async () => {
      const tabId = sender.tab?.id;
      if (!Number.isFinite(tabId)) return;
      // Start (or reset) doomscroll state when they authorize a blocked site.
      const existing = doomscrollStateByTabId.get(tabId);
      const now = Date.now();
      if (existing) {
        existing.times = [];
        existing.warmupUntil = now + 10_000;
        doomscrollStateByTabId.set(tabId, existing);
      } else {
        doomscrollStateByTabId.set(tabId, {
          kind: "other",
          lastUrl: null,
          lastContentKey: null,
          times: [],
          warmupUntil: now + 10_000
        });
      }

      // Nudge the content script to re-evaluate whether long-session tracking should be enabled.
      chrome.tabs.sendMessage(tabId, { type: "LONG_STAY_REFRESH" }).catch(() => {});

      // Start IG home (/) timer immediately after authorization if applicable.
      try {
        const tab = await chrome.tabs.get(tabId);
        if (typeof tab?.url === "string") await maybeHandleInstagramHome(tabId, tab.url);
      } catch (_) {
        // ignore
      }
    })()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.action === "close_tab") {
    if (sender.tab?.id != null) chrome.tabs.remove(sender.tab.id);
  }

  if (message.type === "URL_CHANGED") {
    const tabId = sender.tab?.id;
    const urlString = message.url;
    if (!Number.isFinite(tabId) || typeof urlString !== "string") return;
    maybeEnforceBlocker(tabId, urlString).catch(() => {});
    maybeHandleInstagramHome(tabId, urlString).catch(() => {});
    maybeHandleDoomscroll(tabId, urlString).catch(() => {});
  }

  if (message.type === "LONG_STAY_STATUS_REQUEST") {
    (async () => {
      const tabId = sender.tab?.id;
      const urlString = message.url;
      if (!Number.isFinite(tabId) || typeof urlString !== "string") return;
      const status = await getLongStayStatusForUrl(tabId, urlString);
      sendResponse({ ok: true, active: status.active, limitMinutes: status.limitMinutes });
    })().catch(() => sendResponse({ ok: false, active: false, limitMinutes: 60 }));
    return true;
  }

  if (message.type === "LONG_STAY_VERIFY") {
    (async () => {
      const tabId = sender.tab?.id;
      if (!Number.isFinite(tabId)) return;
      const tab = await chrome.tabs.get(tabId);
      const url = typeof tab?.url === "string" ? tab.url : null;
      sendResponse({ ok: true, url });
    })().catch(() => sendResponse({ ok: false, url: null }));
    return true;
  }

  if (message.type === "LONG_STAY_EXPIRED") {
    (async () => {
      const tabId = sender.tab?.id;
      const urlString = message.url;
      if (!Number.isFinite(tabId) || typeof urlString !== "string") return;

      const status = await getLongStayStatusForUrl(tabId, urlString);
      if (!status.active) return;

      // Force a new barrier by clearing auth, then redirect to pause.
      await chrome.storage.session.remove(tabId.toString());
      await incrementInterventions();
      await incrementAnalytics("blockedAttempts");
      await incrementAnalytics("pauseViews");
      await incrementAnalytics("longSessionExpiries");

      const pauseUrl =
        chrome.runtime.getURL("pause.html") +
        `?target=${encodeURIComponent(urlString)}` +
        `&tabId=${tabId}` +
        `&hostname=${encodeURIComponent(status.hostname)}` +
        `&site=${encodeURIComponent(status.siteKey)}` +
        `&mode=${encodeURIComponent(status.mode)}` +
        `&expired=true` +
        `&limitMinutes=${encodeURIComponent(String(status.limitMinutes))}` +
        `&reason=long_session`;

      chrome.tabs.update(tabId, { url: pauseUrl }).catch(() => {});
    })()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "LONG_STAY_HALFWAY") {
    incrementAnalytics("longSessionHalfwayNudges").catch(() => {});
  }

  if (message.type === "PAUSE_CONTINUE") {
    incrementAnalytics("pauseContinues").catch(() => {});
  }

  if (message.type === "PAUSE_ABANDONED") {
    incrementAnalytics("pauseAbandons").catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ focusBarrierTourSeen: false }).catch(() => {});
    chrome.storage.local.remove(["focusBarrierTourResume"]).catch(() => {});
    (async () => {
      const analytics = await readAnalytics();
      await chrome.storage.local.set({
        installCount: (Number(analytics.installCount) || 0) + 1,
        firstInstallAt: analytics.firstInstallAt || Date.now()
      });
    })().catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  doomscrollStateByTabId.delete(tabId);
  clearIgHome(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  maybeEnforceBlocker(tabId, changeInfo.url).catch(() => {});
  maybeHandleInstagramHome(tabId, changeInfo.url).catch(() => {});
  maybeHandleDoomscroll(tabId, changeInfo.url).catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const name = alarm?.name || "";
  if (!name.startsWith("fb-ig-home:")) return;
  const tabId = parseInt(name.split(":")[1], 10);
  if (!Number.isFinite(tabId)) return;
  handleIgHomeAlarm(tabId).catch(() => {});
});
