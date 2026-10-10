// tour.js — Focus Barrier spotlight tour

(() => {
  const PAGE = document.body?.dataset?.fbPage || "";

  const STEPS = [
    // Step 0 — Welcome (popup)
    {
      page: "popup",
      kind: "center",
      title: "Welcome to Focus Barrier",
      body: "This quick tour will show you how everything works — it only takes a minute.",
      buttons: { skip: "Skip Tour", next: "Get Started \u2192" }
    },
    // Step 1 — Strictness Mode (popup)
    {
      page: "popup",
      target: "#strictnessSection",
      position: "below",
      title: "Strictness Mode",
      body:
        'Controls how strictly sites are blocked. "Balanced" confirms once per tab — you can browse freely within the site after that. Raise it when you need to focus harder. Try changing the mode to continue.'
    },
    // Step 2 — Smart Detections (popup)
    {
      page: "popup",
      target: "#smartDetectionsSection",
      position: "below",
      title: "Smart Detections",
      body:
        "These automatically detect when you've fallen into mindless habits — doomscrolling, tab-switching on autopilot, or sessions that have gone on too long — and interrupt you before it becomes a problem. Toggle it on to continue."
    },
    // Step 3 — Block a Site (popup)
    {
      page: "popup",
      target: "#blockSiteSection",
      position: "above",
      title: "Block a Site",
      body:
        'Type any site — like youtube.com — and hit "Add Site to Block." Focus Barrier will intercept it every time you try to visit. Add one to continue.'
    },
    // Step 4 — Settings (popup)
    {
      page: "popup",
      target: "#openSettings",
      position: "below-left",
      title: "Settings",
      body:
        "Tap this anytime to access advanced options, including Permanent Block (sites you can never bypass) and your intervention history. Click the gear to continue."
    },
    // Step 5 — Countdown (options)
    {
      page: "options",
      target: "#countdownSection",
      position: "below",
      title: "Countdown Timer",
      body:
        "After you type YES to pass a block, this is how many seconds you must wait. A longer countdown gives you more time to reconsider. The default is 10 seconds. Press Save to continue."
    },
    // Step 6 — Finish (options)
    {
      page: "options",
      kind: "center",
      title: "You're all set!",
      body:
        "Focus Barrier is running in the background. Every time it stops you, that's one more mindless visit avoided.",
      buttons: { done: "Done" }
    }
  ];

  let currentIndex = 0;
  let overlayEl = null;
  let spotlightEl = null;
  let tooltipEl = null;
  let highlightedEl = null;
  let interactiveCleanup = null;

  function getStepsForPage(page) {
    return STEPS.map((s, i) => ({ ...s, _index: i })).filter((s) => s.page === page);
  }

  function removeHighlight() {
    if (highlightedEl) highlightedEl.classList.remove("fb-tour-highlight");
    highlightedEl = null;
  }

  function clearInteractiveHandlers() {
    if (typeof interactiveCleanup === "function") interactiveCleanup();
    interactiveCleanup = null;
  }

  function removeOverlay() {
    clearInteractiveHandlers();
    removeHighlight();
    if (overlayEl) overlayEl.remove();
    overlayEl = null;
    spotlightEl = null;
    if (tooltipEl) tooltipEl.remove();
    tooltipEl = null;
    document.documentElement.classList.remove("fb-tour-center");
    document.removeEventListener("keydown", onKeyDown, true);
  }

  function ensureOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.id = "fb-tour-overlay";
    spotlightEl = document.createElement("div");
    spotlightEl.id = "fb-tour-spotlight";
    overlayEl.appendChild(spotlightEl);

    document.body.appendChild(overlayEl);
    tooltipEl = document.createElement("div");
    tooltipEl.id = "fb-tour-tooltip";
    document.body.appendChild(tooltipEl);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function onKeyDown(ev) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      endTour();
    }
  }

  function setSpotlightFromRect(rect) {
    const pad = 10;
    const left = rect.left - pad;
    const top = rect.top - pad;
    const width = rect.width + pad * 2;
    const height = rect.height + pad * 2;

    spotlightEl.style.left = `${Math.round(left)}px`;
    spotlightEl.style.top = `${Math.round(top)}px`;
    spotlightEl.style.width = `${Math.round(width)}px`;
    spotlightEl.style.height = `${Math.round(height)}px`;
  }

  function computeTooltipPosition(rect, placement) {
    const pad = 10;
    const tipRect = tooltipEl.getBoundingClientRect();

    let left = rect.left;
    let top = rect.bottom + pad;

    if (placement === "above") top = rect.top - tipRect.height - pad;
    if (placement === "below-left") {
      left = rect.left - tipRect.width + rect.width;
      top = rect.bottom + pad;
    }

    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - tipRect.width - 8);
    left = Math.min(maxLeft, Math.max(minLeft, left));

    const minTop = 8;
    const maxTop = Math.max(minTop, window.innerHeight - tipRect.height - 8);
    top = Math.min(maxTop, Math.max(minTop, top));

    return { left, top };
  }

  async function persistResume(stepIndex) {
    await chrome.storage.local.set({
      focusBarrierTourResume: { stepIndex, ts: Date.now() }
    });
  }

  async function clearResume() {
    await chrome.storage.local.remove(["focusBarrierTourResume"]);
  }

  async function endTour() {
    removeOverlay();
    await chrome.storage.local.set({ focusBarrierTourSeen: true });
    await clearResume();
  }

  async function pauseTourForResume(stepIndex) {
    await persistResume(stepIndex);
    removeOverlay();
  }

  function renderTooltip({ title, body, counterText, buttons }) {
    tooltipEl.innerHTML = `
      <div class="row">
        <div class="title">${title}</div>
        <div class="counter">${counterText}</div>
      </div>
      <div class="body">${body}</div>
      <div class="actions">
        <div class="left"></div>
        <div class="right"></div>
      </div>
    `;

    const left = tooltipEl.querySelector(".actions .left");
    const right = tooltipEl.querySelector(".actions .right");
    const actions = tooltipEl.querySelector(".actions");

    function btn(label, cls, onClick) {
      const b = document.createElement("button");
      b.className = `fb-tour-btn ${cls || ""}`.trim();
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return b;
    }

    if (buttons?.skip) left.appendChild(btn(buttons.skip, "ghost", () => endTour()));
    if (buttons?.prev) right.appendChild(btn(buttons.prev, "", () => prev()));
    if (buttons?.next)
      right.appendChild(btn(buttons.next, "primary", () => next()));
    if (buttons?.done) right.appendChild(btn(buttons.done, "primary full", () => endTour()));

    const onlyDone =
      Boolean(buttons?.done) && !buttons?.skip && !buttons?.prev && !buttons?.next;
    if (onlyDone) actions.classList.add("single");
  }

  async function showStep(globalIndex) {
    ensureOverlay();
    clearInteractiveHandlers();
    removeHighlight();

    const step = STEPS[globalIndex];
    const counterText = `${globalIndex + 1} of ${STEPS.length}`;

    document.documentElement.classList.toggle("fb-tour-center", step.kind === "center");

    const buttons = step.buttons || { skip: "Skip", prev: "Prev", next: "Next" };
    const isFirst = globalIndex === 0;
    const isFinish = step.kind === "center" && buttons.done;

    const computedButtons = { ...buttons };
    if (!computedButtons.skip && !isFinish) computedButtons.skip = "Skip";
    if (!computedButtons.prev && !isFirst && !isFinish) computedButtons.prev = "Prev";
    if (!computedButtons.next && !isFinish) computedButtons.next = "Next";

    if (isFirst) {
      computedButtons.prev = null;
      computedButtons.skip = buttons.skip || "Skip Tour";
      computedButtons.next = buttons.next || "Get Started →";
    }

    // Prefer demonstrating interactions over clicking Next.
    if (!isFirst && !isFinish) {
      computedButtons.next = null;
    }

    renderTooltip({
      title: step.title,
      body: step.body,
      counterText,
      buttons: computedButtons
    });

    if (step.kind === "center") return;

    const targetEl = document.querySelector(step.target);
    if (!targetEl) {
      // If the target isn't present, skip forward.
      next();
      return;
    }

    highlightedEl = targetEl;
    highlightedEl.classList.add("fb-tour-highlight");

    try {
      targetEl.scrollIntoView({ block: "center", inline: "center" });
    } catch (_) {}

    const rect = targetEl.getBoundingClientRect();
    setSpotlightFromRect(rect);

    // Position tooltip after it renders so we can measure it.
    const pos = computeTooltipPosition(rect, step.position);
    tooltipEl.style.left = `${Math.round(pos.left)}px`;
    tooltipEl.style.top = `${Math.round(pos.top)}px`;

    // Interactive advancement: demonstrate features by using them.
    if (globalIndex === 1) {
      const select = document.querySelector("#mode");
      if (select) {
        const onChange = () => next();
        select.addEventListener("change", onChange, { once: true });
        interactiveCleanup = () => select.removeEventListener("change", onChange);
      }
    } else if (globalIndex === 2) {
      const master = document.querySelector("#smartDetection");
      if (master) {
        const onChange = () => next();
        master.addEventListener("change", onChange, { once: true });
        interactiveCleanup = () => master.removeEventListener("change", onChange);
      }
    } else if (globalIndex === 3) {
      const addBtn = document.querySelector("#addBtn");
      if (addBtn) {
        const onClick = () => next();
        addBtn.addEventListener("click", onClick, { once: true });
        interactiveCleanup = () => addBtn.removeEventListener("click", onClick);
      }
    } else if (globalIndex === 4) {
      const gear = document.querySelector("#openSettings");
      if (gear) {
        const onClick = () => next();
        gear.addEventListener("click", onClick, { once: true });
        interactiveCleanup = () => gear.removeEventListener("click", onClick);
      }
    } else if (globalIndex === 5) {
      const saveBtn = document.querySelector("#timerSaveBtn");
      const input = document.querySelector("#timer");
      if (saveBtn) {
        const onClick = () => next();
        saveBtn.addEventListener("click", onClick, { once: true });
        interactiveCleanup = () => saveBtn.removeEventListener("click", onClick);
      } else if (input) {
        const onEnter = (ev) => {
          if (ev.key === "Enter") next();
        };
        input.addEventListener("keydown", onEnter);
        interactiveCleanup = () => input.removeEventListener("keydown", onEnter);
      }
    }
  }

  async function next() {
    const step = STEPS[currentIndex];

    // Let the user open Settings themselves to continue.
    if (step.page === "popup" && currentIndex === 4) {
      await pauseTourForResume(5);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= STEPS.length) {
      await endTour();
      return;
    }

    // If the next step is on a different page, pause and let the user navigate.
    if (STEPS[nextIndex].page !== PAGE) {
      currentIndex = nextIndex;
      await pauseTourForResume(currentIndex);
      return;
    }

    currentIndex = nextIndex;
    await persistResume(currentIndex);
    await showStep(currentIndex);
  }

  async function prev() {
    const prevIndex = Math.max(0, currentIndex - 1);
    if (prevIndex === currentIndex) return;

    // If prev step is on a different page, pause and let the user navigate.
    if (STEPS[prevIndex].page !== PAGE) {
      currentIndex = prevIndex;
      await pauseTourForResume(currentIndex);
      return;
    }

    currentIndex = prevIndex;
    await persistResume(currentIndex);
    await showStep(currentIndex);
  }

  async function startTour({ startIndex = 0 } = {}) {
    currentIndex = startIndex;
    await chrome.storage.local.set({ focusBarrierTourSeen: true });
    await persistResume(currentIndex);
    await showStep(currentIndex);
  }

  async function maybeAutoStart() {
    const data = await chrome.storage.local.get(["focusBarrierTourSeen", "focusBarrierTourResume"]);
    const resume = data.focusBarrierTourResume;
    if (resume && Number.isFinite(resume.stepIndex) && STEPS[resume.stepIndex]?.page === PAGE) {
      await startTour({ startIndex: resume.stepIndex });
      return;
    }
    if (PAGE === "popup" && data.focusBarrierTourSeen !== true) {
      await startTour({ startIndex: 0 });
    }
  }

  window.FocusBarrierTour = {
    startTour,
    endTour
  };

  // Auto-start when included on a page.
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    window.addEventListener("DOMContentLoaded", () => {
      maybeAutoStart().catch(() => {});
    });
  }
})();
