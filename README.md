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

`js/map.js` mounts a live map centered on SJSU with every open alert as a waypoint marker, colored by status. Three providers, chosen in `js/config.js`:

| Provider | When | What you get |
|---|---|---|
| **Google Maps 3D** | `GOOGLE_MAPS_KEY` is set | Photorealistic 3D campus, tilted 67°, extruded pins, tap a building to select it |
| **OpenStreetMap** | no key (default) | Real 2D map via Leaflet, colored markers, tap to select |
| **Schematic** | `MAP_PROVIDER: 'schematic'` | Offline block diagram; used in the hosted preview, which blocks outside map servers |

**Get the 3D map (5 minutes):** console.cloud.google.com → create a project → APIs & Services → Enable **Maps JavaScript API** → Credentials → Create API key → the live site's key is in `js/config.js`, restricted to `https://juanmosqueda-sys.github.io/*`. For local 3D, create your own key and put it in `js/config.local.js` (gitignored). The free tier covers a hackathon many times over. Restrict the key to your domain before you publish anywhere public.

Building coordinates live in `BUILDINGS` in `js/data.js` and are approximate; verify against the official campus map before production. Tapping the map picks the nearest building within 140 m.

## AI triage (the AI decides, not the reporter)

`classify()` assigns every submission to one of three categories from its text, and the reporter cannot override it:

| Category | Trigger | What happens |
|---|---|---|
| **Broken — needs fixing** | default | Work order `WO-####` to the right department; merged with matching open reports |
| **Alert staff and students** | hazard words (`ALERT_KW`) or emergency words (`EMERGENCY_KW`) | Grouped with matching alerts by building. Held as *Awaiting staff verification*. A staff member confirms before anyone is notified; then a loud alert fires and the banner appears on Home. |
| **Suggestion or feedback** | suggestion phrasing (`SUGGESTION_KW`) | Posted to Community as *Suggestion*; reaches staff at 100 votes |

**Trust check.** Prank-like text, fewer than three words, repeated characters, or no recognizable issue and location → *Held for review*. Nothing is routed or announced until a staff member releases it.

**Emergency routing.** Fire, weapon, injury and similar words mark the report *critical*, route it to University Police on submit, and open a sheet with 911 and UPD (408) 924-2222 to copy.

**Staff controls** are demo buttons inside each report's timeline on My reports: verify/dismiss an alert, release/dismiss a held report, advance a work order (Assigned → In progress → Fixed → Verified). They stand in for a department login.

**Spoken commands** work through hold-to-talk or typed into the box: "report this problem…", "alert students about this…", "suggest an improvement…", "what am I seeing?", "go to my reports", "what are the alerts", "what's near me". A spoken hint ("alert students…") is recorded, but the AI still picks the category and says so if it disagrees.

## Assist mode (voice-first, for blind and low-vision users)

Tap the speaker icon in the header, or open the app at `index.html#assist`. High-contrast dark palette, 17px base type, 48px+ targets, one large hold-to-talk button, and four big actions: What am I seeing?, Read alerts, My reports, Near me. Every screen change and result is spoken. Haptics fire on submit and on hazards. Verified dangers trigger a loud three-tone alert plus speech and vibration regardless of settings.

**Launching from a physical button.** A web app can't read the power or volume buttons; the OS owns them. Both platforms let you bind a hardware gesture to open a URL, and the app launches straight into Assist mode from `#assist`:

- **iPhone, Back Tap:** Settings → Accessibility → Touch → Back Tap → Triple Tap → pick a Shortcut that opens `https://<your-host>/index.html#assist`.
- **iPhone 15 Pro and later, Action Button:** Settings → Action Button → Shortcut → same shortcut.
- **iPhone, Accessibility Shortcut (triple-click side button):** Settings → Accessibility → Accessibility Shortcut; this can only pick accessibility features, so pair it with VoiceOver and use Back Tap for the app.
- **Android, Quick Tap:** Settings → System → Gestures → Quick Tap → Open app (after Add to Home Screen).
- **Bluetooth clicker or hardware keyboard:** Space or Enter = hold to talk; Escape ×3 toggles Assist mode.

"What am I seeing?" opens the camera; in this prototype the description is a fixed demo sentence, labelled as such. Replace it with a vision-model call in `photo-input`'s change handler.

## Accessibility

- **Spoken mode** (speaker button in the header): the app reads each screen aloud with the browser's speech synthesis — the review summary, the department it routes to, and confirmation when a work order opens.
- **Read back** on the review screen reads the full report before submitting.
- Focus moves to the heading on every screen change; every control has a label; the map buildings are labelled with their status; touch targets are 44px or larger; all status colors also differ in lightness.
- Hold-to-talk is the primary path for anyone who can't see the screen well enough to type.

## Demo limitations

- **Voice**: hold-to-talk uses the browser's Web Speech API (Safari 14.5+, Chrome, Edge) over HTTPS. The first use asks for microphone permission. Where the API is missing or the mic is blocked, it falls back to a labelled sample transcript so the demo still runs.
- **Photo**: the camera opens and the photo attaches, but classification is from text and the type chips, not the image. Location comes from the map tap, not photo GPS. Hook `classify()` to a vision model and read EXIF GPS for the real version.
- **Verification**: any `@sjsu.edu` address verifies instantly. Replace with SSO.
- **Department updates**: the "post as department" form on a post is a demo stand-in for a department login.
- **Persistence**: `localStorage` only. Everything is sample data.

## Interview evidence this is built on

12 SJSU students interviewed on Oct 23, 2026. 10 were asked whether they had reported a problem or knew where to; none had, and none could name the channel. Problems named: elevators (3), library outlets, printers, Wi‑Fi, faucets, trash, library website, scooter safety.
