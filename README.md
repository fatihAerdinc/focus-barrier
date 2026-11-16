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

## Privacy Policy

**Last updated: November 15, 2026**

Focus Barrier is a browser extension designed to help users avoid distractions, doomscrolling, and other unwanted browsing habits by allowing users to set blocked websites, time limits, and focus interventions.

### Information We Access

Focus Barrier may access the following information solely to provide its functionality:

- **Current tab information:** Focus Barrier may read the URL of the current browser tab to determine whether the user has opened a website they have chosen to monitor or block.
- **Local storage:** The extension stores settings, blocked websites, preferences, and local session/intervention counts on the user’s device.
- **Page scripting:** The extension may run scripts on selected websites to display pause pages, warnings, nudges, or other focus interventions.
- **Background timing:** The extension may use browser alarms or background timers to track focus sessions, time limits, and related interventions.
- **Selected website access:** The extension may access websites or domains that the user has chosen to monitor or block.

### How We Use Information

Information accessed by Focus Barrier is used only to provide its features, including blocking or warning users about selected websites, enforcing time limits, and displaying focus interventions.

**Focus Barrier does not sell, rent, or share users’ browsing information with third parties.**

### Local Data Storage

Focus Barrier is designed to operate locally. URLs are processed locally only to identify user-selected sites and provide blocking or focus interventions. Settings, blocked websites, and session/intervention information are stored on the user’s device and do not need to be sent to an external server.

We do not require users to create an account or provide personal information to use the extension.

### Information We Do Not Collect

Focus Barrier does not require or collect:

- Camera access
- Microphone access
- Location data
- Account or login information
- Browsing information for external analytics, advertising, or user tracking purposes
- Personal information for the purpose of tracking users

### Third-Party Services

Focus Barrier does not require an external server to provide its core functionality. We do not use users’ browsing activity for advertising or tracking purposes.

### Changes to This Privacy Policy

If the extension’s data practices change, this Privacy Policy may be updated to reflect those changes. The updated policy will include a new “Last updated” date.

### Contact

If you have questions or concerns about this Privacy Policy or Focus Barrier, please contact the developer through the contact information provided on the extension’s store listing.

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
