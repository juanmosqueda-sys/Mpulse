# EAiSER Campus

Campus version of EAiSER for San José State University, built at SpartHill Hacks 2026 for the MomntumAI track.

Students report broken or unsafe things three ways — **type it, say it, or snap it** — and the app classifies each report and routes it to the right campus department. A separate **Community** tab handles issues that need a crowd behind them before a department sees them.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

Works on a phone at 390px and on desktop (centered column).

## What's in it

| File | What it does |
|---|---|
| `index.html` | App shell and tab bar |
| `css/app.css` | Design tokens (SJSU blue `#0055A2`, gold `#E5A823`), light and dark themes, all components |
| `js/data.js` | Departments, issue types, building list, routing keywords, seeded reports and posts |
| `js/app.js` | Views (Home, Review, Community, Post detail, My reports), classifier, voting, verification, persistence |
| `assets/` | SJSU seal |

## Screens

1. **Home** — text report box, hold-to-talk, live campus map with open-issue pins, list of open issues
2. **Review** — AI-filled issue type, building pinned on the SJSU map (tap any building to change it), severity; "N other students reported this"; department named before submit; read-back button
3. **Community** — anonymous posts, upvote/downvote, `votes/100` progress, status (Collecting support → Under campus review → Response received → Resolved), official department updates, sort by Trending / Near me / Most supported / Recently posted
4. **My work orders** — map of your open orders, and a status timeline per order: Submitted → Routed → Acknowledged → Fixed

## How routing works

`classify(text)` in `app.js` matches keywords from `ISSUE_TYPES` and `BUILDINGS` in `data.js`. Each issue type maps to one department: **Facilities**, **IT**, **Safety** (University Police), **Library**, or **Housing**. Issues that block access (elevator, door, ramp/path) also notify the **Accessible Education Center** (`coDept`).

Every submit creates a work order (`WO-####`) with a status timeline. Matching open reports (same type + building) form a cluster, which drives the "N others reported this" card and merges the new order into the existing one.

Community posts route to their department when net votes reach `VOTE_THRESHOLD` (100). Voting requires a verified `@sjsu.edu` address.

## Campus map

`campusMap()` in `app.js` draws a schematic SJSU map from the `x, y, w, h` fields in `BUILDINGS`. Positions are approximate (4th St to 10th St, San Fernando to San Salvador). Every building is a real `<button>`, so the map works by keyboard and screen reader. To add a building, add a row to `BUILDINGS`.

## Accessibility

- **Spoken mode** (speaker button in the header): the app reads each screen aloud with the browser's speech synthesis — the review summary, the department it routes to, and confirmation when a work order opens.
- **Read back** on the review screen reads the full report before submitting.
- Focus moves to the heading on every screen change; every control has a label; the map buildings are labelled with their status; touch targets are 44px or larger; all status colors also differ in lightness.
- Hold-to-talk is the primary path for anyone who can't see the screen well enough to type.

## Demo limitations

- **Voice**: browsers refuse the microphone inside the hosted preview, so hold-to-talk inserts a sample transcript. Wire `voiceEnd()` to the Web Speech API or a transcription endpoint for a real build.
- **Photo**: the camera opens and the photo attaches, but classification is from text and the type chips, not the image. Location comes from the map tap, not photo GPS. Hook `classify()` to a vision model and read EXIF GPS for the real version.
- **Verification**: any `@sjsu.edu` address verifies instantly. Replace with SSO.
- **Department updates**: the "post as department" form on a post is a demo stand-in for a department login.
- **Persistence**: `localStorage` only. Everything is sample data.

## Interview evidence this is built on

12 SJSU students interviewed on Oct 23, 2026. 10 were asked whether they had reported a problem or knew where to; none had, and none could name the channel. Problems named: elevators (3), library outlets, printers, Wi‑Fi, faucets, trash, library website, scooter safety.
