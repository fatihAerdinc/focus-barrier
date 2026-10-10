# Focus Barrier

Focus Barrier is a Chrome extension that helps users make intentional choices before visiting distracting websites. Rather than completely locking people out, it introduces a short pause that gives them time to reconsider whether they want to continue.

## Project Goal

Distraction is often automatic: open a tab, type a familiar site, and start scrolling before consciously deciding to do so. Focus Barrier is designed as a **decision interrupter**, not just a blocker. It adds friction at the moment of distraction while still allowing the user to continue intentionally.

The extension supports customizable blocked sites, different levels of strictness, countdown-based pause screens, and optional smart-detection interventions for long sessions and frequent navigation.

## Features

- Add and remove websites that you want to pause before visiting.
- Choose between three focus modes:
  - **Easy:** one confirmation unlocks blocked sites for the current tab.
  - **Balanced:** one confirmation unlocks the current domain for the tab.
  - **Strict:** one confirmation unlocks only the exact URL.
- Require users to type `YES` and wait through a configurable countdown before continuing.
- Track interventions locally in the browser.
- Optionally detect rapid URL changes associated with doomscrolling and show a nudge.
- Optionally limit continuous sessions on the same URL, with a halfway check-in and a re-confirmation barrier when the limit ends.
- Create permanent blocks for domains that should never be bypassed.
- Keep settings and analytics local to the user’s browser profile.

## How It Works

1. Add distracting domains in the extension popup, such as `youtube.com` or `chess.com`.
2. When you open one of those sites, Focus Barrier redirects you to a short pause screen.
3. Type `YES` and wait for the configured countdown to finish.
4. Choose **Continue** only if visiting the site is intentional.
5. Optional smart-detection features can nudge you during doomscrolling or long, uninterrupted sessions.

## Installation for Development

1. Download or clone this repository.
2. Open Chrome and visit `chrome://extensions`.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select this project folder.
6. Pin Focus Barrier from Chrome’s Extensions menu if you want quick access to its popup.

Whenever you change extension files, return to `chrome://extensions` and click **Reload** on Focus Barrier before testing again.

## Using Focus Barrier

### Set up blocked sites

Open the extension popup and add the domains you want to pause before visiting. Use domain names such as `youtube.com`, not full URLs such as `https://www.youtube.com/watch?...`.

### Choose a mode

- Choose **Easy** when you want a single intentional decision to apply broadly within a tab.
- Choose **Balanced** for the recommended default: one intentional decision per domain in a tab.
- Choose **Strict** when you want a fresh decision for every exact URL.

### Configure the pause

Use the settings page to choose how long the pause countdown lasts. The countdown only runs while the pause tab is visible.

### Enable smart detection

Smart detection is optional. When enabled, it can:

- Warn you after repeated URL changes over a short period.
- Monitor a continuous session on the same URL.
- Show a halfway check-in during a long session.
- Return you to a pause screen when the chosen session limit ends.

Long-session limits can be set from **5 to 180 minutes**.

## Privacy

Focus Barrier is designed to operate locally. It uses browser tab information, local storage, page scripts, and background timers only to provide focus features such as pause screens, nudges, limits, and settings.

- No account is required.
- No camera, microphone, or location access is required.
- The extension does not sell, rent, or share browsing information with third parties.
- Settings, blocked sites, and local intervention metrics remain in the browser profile unless the browser itself syncs or exports them.

See the in-extension Privacy Policy for the complete policy.

## Technology

- JavaScript
- HTML and CSS
- Chrome Extensions Manifest V3
- Chrome extension APIs including `tabs`, `storage`, `alarms`, and `scripting`

## Permissions

Focus Barrier requests only the browser capabilities needed for its features:

- **Tabs:** identify the current website and respond to navigation.
- **Storage:** save settings, blocked sites, local session state, and local metrics.
- **Scripting:** show page-level nudges and focus interventions.
- **Alarms / background service worker:** coordinate timing and session-related checks.

## Local Metrics

The settings page can display locally stored metrics such as blocked attempts, pause views, continues, abandonments, doomscroll triggers, long-session nudges, session expiries, and average interception decision time. These values are local product metrics for the current browser profile, not cross-user analytics.

## Project Status

Focus Barrier is actively being prepared for publication. Future improvements may include refined onboarding, accessibility enhancements, additional focus workflows, and optional aggregate analytics only if users explicitly opt in.

## License

Add a license here before publishing if you want to specify how others may use, modify, or distribute this project.
