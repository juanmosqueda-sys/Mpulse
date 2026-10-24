// Mpulse — SJSU campus issue reporting. Vanilla JS, no build step.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- state ----------
const state = {
  view: 'home',
  draft: null,          // { text, type, building, detail, severity, photo, source }
  reports: [],          // user's own reports
  posts: SEED_POSTS.map((p) => ({ ...p, updates: [...p.updates] })),
  votes: {},            // postId -> 'up' | 'down'
  user: null,           // { email, verifiedAt }
  alerts: SEED_ALERTS.map((a) => ({ ...a })),
  sort: 'trending',
  filter: 'all',
};

function load() {
  try {
    const raw = localStorage.getItem('mpulse-campus') || localStorage.getItem('eaiser-campus');
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.reports = saved.reports || [];
    state.votes = saved.votes || {};
    state.user = saved.user || null;
    if (saved.alerts) state.alerts = saved.alerts;
    if (saved.newPosts) state.posts = [...saved.newPosts, ...state.posts.filter((p) => !saved.newPosts.some((n) => n.id === p.id))];
    if (saved.posts) {
      // keep seeded copy fresh, overlay persisted counts/updates
      state.posts = state.posts.map((p) => {
        const s = saved.posts.find((x) => x.id === p.id);
        return s ? { ...p, up: s.up, down: s.down, status: s.status, updates: s.updates } : p;
      });
    }
  } catch (e) { /* storage unavailable: run in memory */ }
}
function save() {
  try {
    localStorage.setItem('mpulse-campus', JSON.stringify({
      reports: state.reports, votes: state.votes, user: state.user, alerts: state.alerts,
      newPosts: state.posts.filter((p) => !SEED_POSTS.some((x) => x.id === p.id)),
      posts: state.posts.map(({ id, up, down, status, updates }) => ({ id, up, down, status, updates })),
    }));
  } catch (e) { /* ignore */ }
}

// ---------- helpers ----------
const typeById = (id) => ISSUE_TYPES.find((t) => t.id === id) || ISSUE_TYPES.at(-1);
const bldgById = (id) => BUILDINGS.find((b) => b.id === id);
const deptById = (id) => DEPARTMENTS[id];

function classify(text) {
  const t = ' ' + (text || '').toLowerCase() + ' ';
  let type = null;
  for (const it of ISSUE_TYPES) {
    if (it.kw.some((k) => t.includes(k))) { type = it; break; }
  }
  let building = null;
  for (const b of BUILDINGS) {
    if (b.kw.some((k) => t.includes(k))) { building = b; break; }
  }
  let detail = '';
  const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, ground: 1 };
  const floor = t.match(/(\d+)(?:st|nd|rd|th)?\s*floor/) || t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|ground)\s*floor/);
  if (floor) { const n = ORD[floor[1]] || parseInt(floor[1], 10); detail = `${n}${['st','nd','rd'][n-1] || 'th'} floor`; }
  const room = t.match(/\broom\s*(\w+)/);
  if (room) detail = (detail ? detail + ', ' : '') + 'room ' + room[1].toUpperCase();
  // --- triage: the AI, not the reporter, decides the category ---
  const has = (arr) => arr.some((k) => t.includes(k));
  const emergency = has(EMERGENCY_KW);
  let category = 'fix';
  if (has(SUGGESTION_KW) && !has(ALERT_KW)) category = 'suggestion';
  else if (has(ALERT_KW) || emergency) category = 'alert';
  // --- trust: hold prank-like, too-short or contentless reports for review ---
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  const reasons = [];
  if (has(PRANK_KW)) reasons.push('looks like a joke or test');
  if (words < 3) reasons.push('too short to act on');
  if (!type && !building && category === 'fix') reasons.push('no issue or location recognized');
  if (/(.)\1{4,}/.test(t)) reasons.push('repeated characters');
  const trust = reasons.length ? 'review' : 'ok';
  let severity = type?.severity || 'low';
  if (emergency) severity = 'critical'; else if (category === 'alert' && severity !== 'high') severity = 'high';
  return { type: type?.id || 'other', building: building?.id || null, detail, severity, confident: !!type, category, trust, reasons, emergency };
}

// Spoken or typed commands: navigate and read aloud without filing a report.
function parseCommand(text) {
  const t = (text || '').trim().toLowerCase();
  const m = t.match(/^(?:go to|open|show|take me to|read|what are|what's|whats)\s+(?:the\s+|my\s+)?(.+?)\s*[.?!]?$/);
  if (!m) return null;
  const target = m[1];
  if (/alert/.test(target)) return { cmd: 'alerts' };
  if (/report|work order|mine|my stuff/.test(target)) return { cmd: 'go', view: 'mine' };
  if (/communit|forum|post|suggestion/.test(target)) return { cmd: 'go', view: 'community' };
  if (/home|start/.test(target)) return { cmd: 'go', view: 'home' };
  if (/near|around|nearby|open issue/.test(target)) return { cmd: 'near' };
  return null;
}

// Topic for Community posts, guessed from the text. Maps to the department that would own it.
function topicFor(text) {
  const c = classify(text);
  const t = typeById(c.type);
  if (c.emergency) return { topic: 'Safety', dept: 'upd' };
  if (t.coDept === 'access' || /\b(wheelchair|ramp|accessib|elevator|braille|screen reader)\b/i.test(text)) return { topic: 'Accessibility', dept: 'access' };
  if (c.type === 'safety' || ALERT_KW.some((k) => (' ' + text.toLowerCase() + ' ').includes(k))) return { topic: 'Safety', dept: 'upd' };
  if (t.dept === 'it' || /\b(app|website|canvas|login|wifi|wi-fi|internet|printer|computer|laptop|charger|software)\b/i.test(text)) return { topic: 'Tech', dept: 'it' };
  if (/\b(dorm|housing|roommate|rent|laundry|campus village|joe west|washburn)\b/i.test(text)) return { topic: 'Housing', dept: 'housing' };
  if (/\b(hours|policy|open until|close|schedule|fee|tuition|parking permit|registration|advising|professor|class|exam|library)\b/i.test(text)) return { topic: 'Policy', dept: 'library' };
  if (c.type !== 'other') return { topic: 'Facilities', dept: 'fdo' };
  return { topic: 'Other', dept: 'fdo' };
}

const CATEGORY = {
  fix:        { label: 'Work order',               short: 'Work order', tone: 'blue',  what: 'Sent straight to the department that fixes it.' },
  alert:      { label: 'Campus alert',             short: 'Alert',      tone: 'red',   what: 'Grouped with matching reports. A staff member verifies it before students are notified.' },
  suggestion: { label: 'Suggestion',               short: 'Suggestion', tone: 'gold',  what: `Posted to Community. Reaches staff once it has ${VOTE_THRESHOLD} votes.` },
};

function findCluster(type, building) {
  return SEED_CLUSTERS.find((c) => c.type === type && c.building === building && c.status !== 'resolved') || null;
}

function fmtTime(iso) {
  const d = new Date(iso), now = new Date();
  const same = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (same) return `Today, ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time;
}
function ago(iso) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); return `${d}d`;
}
function fmtDate(iso) { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); }

const ICONS = {
  elevator: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 2v20"/><path d="M8 9l2-2 2 2"/><path d="M14 15l2 2 2-2"/></svg>',
  outlet:   '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  printer:  '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  wifi:     '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg>',
  generic:  '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  check:    '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  up:       '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
  down:     '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  comment:  '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  pin:      '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  shield:   '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
  send:     '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  spark:    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>',
  mic:      '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14213D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/></svg>',
  arrow:    '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
  back:     '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  bell:     '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  info:     '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
};
const iconFor = (type) => ICONS[type] || ICONS.generic;
ICONS.speaker = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>';
ICONS.map = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/></svg>';

// ---------- campus map ----------
// Schematic map of SJSU. Each building is a real <button>, so it works with a keyboard and a screen reader.
function campusMap({ selected = null, pins = [], interactive = false, height = 230 } = {}) {
  const pinFor = (id) => pins.find((p) => p.building === id);
  const blocks = BUILDINGS.map((b) => {
    const pin = pinFor(b.id);
    const sel = b.id === selected;
    const tag = interactive ? 'button' : 'div';
    const cls = ['bld', b.path ? 'path' : '', sel ? 'sel' : '', pin ? 'pin ' + pin.tone : ''].join(' ');
    const label = `${b.name}${pin ? `, ${pin.label}` : ''}${sel ? ', selected' : ''}`;
    return `<${tag} class="${cls}" ${interactive ? `type="button" data-bld="${b.id}" aria-pressed="${sel}"` : ''} aria-label="${esc(label)}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%">
      <span aria-hidden="true">${esc(b.abbr)}</span>${pin ? `<i aria-hidden="true" class="dot"></i>` : ''}${sel ? `<i aria-hidden="true" class="marker">${ICONS.pin}</i>` : ''}
    </${tag}>`;
  }).join('');
  return `<div class="map" style="height:${height}px" role="group" aria-label="SJSU campus map">
    <span class="street n" aria-hidden="true">E San Fernando St</span>
    <span class="street s" aria-hidden="true">E San Salvador St</span>
    <span class="street w" aria-hidden="true">S 4th St</span>
    <span class="street e" aria-hidden="true">S 10th St</span>
    <i class="lawn" aria-hidden="true" style="left:36%;top:14%;width:12%;height:12%"></i>
    <i class="lawn" aria-hidden="true" style="left:46%;top:56%;width:30%;height:6%"></i>
    ${blocks}
  </div>`;
}

// ---------- spoken mode (for low-vision use) ----------
const speech = { on: false, assist: false };
const buzz = (p) => { if (navigator.vibrate) { try { navigator.vibrate(p || 40); } catch (e) { /* ignore */ } } };
function speak(text) {
  if (!(speech.on || speech.assist) || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
}
function describeDraft() {
  const d = state.draft; if (!d) return '';
  const t = typeById(d.type), b = d.building ? bldgById(d.building) : null, dept = deptById(t.dept);
  const cluster = d.building ? findCluster(d.type, d.building) : null;
  return `Review. The AI identified this as ${d.confident ? t.label : 'unclear, it needs one more detail'}, ${CATEGORY[d.category || 'fix'].label}, going to ${dept.name}${t.coDept ? ' and ' + deptById(t.coDept).name : ''}. Location: ${b ? b.name : 'not set yet'}${d.detail ? ', ' + d.detail : ''}. Severity ${d.severity}. ${cluster ? cluster.count + ' other students reported this. ' : ''}Submit button is at the bottom.`;
}
const toneFor = (status) => ({ submitted: 'blue', routed: 'blue', pending: 'gold', acknowledged: 'gold', assigned: 'gold', in_progress: 'gold', resolved: 'green', verified: 'green', announced: 'red', review: 'neutral', dismissed: 'neutral' }[status] || 'neutral');

// ---------- views ----------
function render() {
  const el = $('#view');
  el.scrollTop = 0;
  window.scrollTo(0, 0);
  const v = state.view;
  el.classList.toggle('has-footer', v === 'review');
  el.innerHTML = v === 'home' ? Home() : v === 'review' ? Review() : v === 'community' ? Community() : v === 'post' ? PostDetail() : Mine();
  document.querySelectorAll('.tab').forEach((t) => {
    const cur = t.dataset.go === v || (v === 'post' && t.dataset.go === 'community') || (v === 'review' && t.dataset.go === 'snap' && state.draft?.source === 'photo');
    if (cur) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  bind();
  MapKit.mountAll((id) => { if (state.view === 'review' && state.draft) { state.draft.building = id; state.draft.autoBuilding = false; render(); speak(bldgById(id).name + ' selected'); } });
}

function header(title, sub) {
  return `
  <div class="topbar">
    <div class="brand">
      <div class="seal"><img src="assets/sjsu-seal.png" alt="San José State University seal"></div>
      <div><div class="brand-name">Mpulse <span>Campus</span></div><div class="brand-sub">San José State University</div></div>
    </div>
    <div class="row" style="gap:8px">
      <button class="icon-btn" aria-label="${speech.assist ? 'Turn off Assist mode' : 'Turn on Assist mode (voice-first, high contrast)'}" aria-pressed="${speech.assist}" data-act="assist" ${speech.assist ? 'style="background:var(--gold);color:#14213D;border-color:var(--gold)"' : ''}>${ICONS.speaker}</button>
      <button class="icon-btn" aria-label="Notifications" data-act="notif">${ICONS.bell}<span class="dot"></span></button>
    </div>
  </div>`;
}

function clusterPins() {
  return SEED_CLUSTERS.filter((c) => c.status !== 'resolved').map((c) => ({ building: c.building, tone: toneFor(c.status), label: `${clusterTitle(c)}, ${REPORT_STATUS[c.status]}` }));
}

function Home() {
  const near = SEED_CLUSTERS.slice(0, 3).map((c) => {
    const t = typeById(c.type), b = bldgById(c.building);
    const tone = toneFor(c.status);
    return `<button class="list-item" data-act="near" data-id="${c.id}">
      <span class="ico ${tone}">${iconFor(c.type)}</span>
      <span class="grow"><div class="title">${esc(clusterTitle(c))}</div><div class="sub">${esc(b.name)} · ${c.count} reports</div></span>
      <span class="pill ${tone}">${esc(REPORT_STATUS[c.status])}</span>
    </button>`;
  }).join('');
  const live = state.alerts.filter((a) => a.status === 'verified');
  const alertsHtml = live.length ? `<div class="alerts" role="region" aria-label="Campus alerts">
      <div class="row between"><span class="row" style="gap:6px;font-weight:800;font-size:13px;color:var(--red)">${ICONS.bell} ${live.length} campus alert${live.length > 1 ? 's' : ''}</span><button class="btn ghost" style="height:30px;padding:0 10px;font-size:12px" data-act="read-alerts" aria-label="Read alerts aloud">${ICONS.speaker} Read</button></div>
      ${live.map((a) => `<div class="stack" style="gap:2px"><b style="font-size:14px">${esc(a.title)}</b><span class="muted small">${esc(bldgById(a.building)?.name || 'Campus')}${a.detail ? ' · ' + esc(a.detail) : ''} · verified by ${esc(a.verifiedBy)} · ${ago(a.at)} ago</span>${a.note ? `<span style="font-size:13px">${esc(a.note)}</span>` : ''}</div>`).join('')}
    </div>` : '';
  if (speech.assist) return AssistHome(alertsHtml, live);
  return `
  ${header()}
  ${alertsHtml}
  <div class="stack" style="gap:4px;margin-top:6px">
    <h1>What's not working?</h1>
    <p class="muted" style="font-size:15px">Type it, say it, or snap it. We find the right department.</p>
  </div>
  <form class="report-box" id="text-form">
    <label for="report-text" class="eyebrow blue">Describe the issue</label>
    <textarea id="report-text" rows="2" placeholder="Wi‑Fi keeps dropping in the Art Building studios…"></textarea>
    <div class="row between">
      <span class="muted small">AI picks the department. No photo needed.</span>
      <button class="btn primary" type="submit" id="text-submit" disabled>Report ${ICONS.arrow}</button>
    </div>
  </form>
  <button class="voice" id="voice-btn" aria-label="Hold to talk">
    <span class="mic">${ICONS.mic}</span>
    <span class="grow"><div class="t">${matchMedia('(pointer: coarse)').matches ? 'Tap to talk' : 'Hold to talk'}</div><div class="s">Say what's wrong and where. We transcribe and route it.</div></span>
    <span class="wave" aria-hidden="true"><span style="height:10px"></span><span style="height:20px"></span><span style="height:14px"></span><span style="height:26px"></span><span style="height:16px"></span><span style="height:8px"></span></span>
  </button>
  <div class="row between" style="margin-top:6px">
    <h2>Open on campus</h2>
    <span class="muted small row" style="gap:4px">${ICONS.map} Live map</span>
  </div>
  ${mapHost({ pins: clusterPins(), height: 220 })}
  <div class="stack">${near}</div>`;
}

// Voice-first, high-contrast layout for blind and low-vision users.
function AssistHome(alertsHtml, live) {
  return `
  ${header()}
  <div class="stack" style="gap:4px"><h1 style="font-size:30px">Assist mode</h1><p class="muted" style="font-size:17px">Hold the big button and say what's wrong. Or say a command.</p></div>
  ${alertsHtml}
  <button class="voice assist-big" id="voice-btn" aria-label="Hold to talk">
    <span class="mic">${ICONS.mic}</span>
    <span class="grow"><div class="t">${matchMedia('(pointer: coarse)').matches ? 'Tap to talk' : 'Hold to talk'}</div><div class="s">"Report this problem" · "Alert students about this" · "Suggest an improvement" · "What am I seeing?"</div></span>
  </button>
  <div class="assist-grid">
    <button class="assist-btn" data-act="see" aria-label="What am I seeing? Opens the camera and describes it">${ICONS.map}<span>What am I seeing?</span></button>
    <button class="assist-btn" data-act="read-alerts" aria-label="Read campus alerts aloud">${ICONS.bell}<span>Read alerts (${live.length})</span></button>
    <button class="assist-btn" data-go="mine" aria-label="My reports">${ICONS.check}<span>My reports</span></button>
    <button class="assist-btn" data-act="read-near" aria-label="Read open issues near me">${ICONS.pin}<span>Near me</span></button>
  </div>
  <form class="report-box" id="text-form" style="margin-top:4px">
    <label for="report-text" class="eyebrow blue" style="font-size:13px">Or type it</label>
    <textarea id="report-text" rows="2" placeholder="Describe the problem or type a command…" style="font-size:18px"></textarea>
    <div class="row between"><span></span><button class="btn primary" type="submit" id="text-submit" disabled style="height:44px;font-size:15px">Send ${ICONS.arrow}</button></div>
  </form>`;
}

function clusterTitle(c) {
  return ({ elevator: 'Elevator out of service', outlet: 'Outlets not working', printer: 'Printers out of toner', wifi: 'Wi‑Fi dropping' })[c.type] || typeById(c.type).label + ' issue';
}

function Review() {
  const d = state.draft;
  // A draft started from the camera has no text yet; give it the default triage fields until a description arrives.
  if (!d.category) Object.assign(d, { category: 'fix', trust: 'ok', reasons: [], emergency: false });
  const t = typeById(d.type), b = d.building ? bldgById(d.building) : null, dept = deptById(t.dept);
  const cluster = d.building ? findCluster(d.type, d.building) : null;
  const sev = d.severity;
  const typeBlock = d.confident
    ? ''
    : `<div class="stack" style="gap:6px"><div class="row between"><div><div class="eyebrow">Issue type</div><div style="font-size:14px;font-weight:600;color:var(--gold-text)">Not sure yet</div></div><span class="pill gold">Needs detail</span></div>
       <label class="eyebrow" for="more-detail">Tell the AI more</label>
       <input class="field" id="more-detail" placeholder="e.g. the elevator door won't close" value="">
       <span class="muted small">It re-reads your description and picks the type and department itself.</span></div>`;
  const bOpts = `<option value="">Choose a building…</option>` + BUILDINGS.map((x) => `<option value="${x.id}" ${x.id === d.building ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const photo = d.photo
    ? `<div class="photo"><img src="${d.photo}" alt="Your photo of the issue"><span class="cap">Photo attached</span><button type="button" class="retake" data-act="retake">Retake</button></div>`
    : d.source === 'photo'
      ? `<div class="photo" style="flex-direction:column;gap:8px"><span style="opacity:.9;font-size:12px;font-weight:600">No photo yet</span><button type="button" class="retake" data-act="retake" style="position:static">Open camera</button></div>`
      : '';
  const srcLabel = ({ text: 'Typed', voice: d.sample ? 'Sample transcript (mic unavailable)' : 'Voice transcript', photo: 'Photo' })[d.source];
  const cat = CATEGORY[d.category];
  const hintNote = d.hint && d.hint !== d.category ? `<span class="muted small">You said "${esc(CATEGORY[d.hint].short.toLowerCase())}". The AI filed it as ${esc(cat.short.toLowerCase())} instead, based on what you described.</span>` : '';
  const headline = d.category === 'fix'
    ? (d.confident ? `${t.label} → ${dept.short}${t.coDept ? ' + ' + deptById(t.coDept).short : ''}` : 'Needs one more detail')
    : d.category === 'alert' ? `${d.emergency ? 'Emergency' : t.label !== 'Other' ? t.label + ' hazard' : 'Hazard'} → ${d.emergency ? 'University Police' : 'staff verification'}`
    : `Suggestion → ${deptById(topicFor(d.text || '').dept).short}`;
  const triage = `<div class="card pad stack triage ${cat.tone}" style="gap:6px">
      <div class="row between"><span class="eyebrow">AI decided</span><span class="pill ${cat.tone}">${esc(cat.short)}</span></div>
      <b style="font-size:16px">${esc(headline)}</b>
      <span class="muted" style="font-size:13px">${esc(cat.what)}</span>
      ${hintNote}
      ${d.emergency ? `<span class="row" style="gap:6px;font-size:13px;font-weight:700;color:var(--red)">${ICONS.bell} Possible emergency. University Police notified on submit. <button class="btn ghost" style="height:28px;padding:0 10px;font-size:12px" data-act="emergency">Numbers</button></span>` : ''}
    </div>
    ${d.trust === 'review' ? `<div class="card pad stack" style="border-color:var(--gold);background:var(--gold-soft);gap:4px"><b style="font-size:14px">This will be held for review</b><span class="muted small">Reason: ${esc(d.reasons.join(', '))}. A staff member looks at it before anything is routed or announced. Add detail to send it straight through.</span></div>` : ''}`;
  return `
  <div class="topbar">
    <button class="icon-btn back" data-go="home" aria-label="Back">${ICONS.back}</button>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <span style="font-size:15px;font-weight:700">Review report</span>
      <div class="progress-steps"><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
    </div>
    <span style="width:40px"></span>
  </div>
  ${photo}
  ${d.seeDesc ? `<div class="card pad stack" style="gap:4px;border-color:var(--blue)"><span class="eyebrow blue">What the AI sees</span><p style="font-size:14px">${esc(d.seeDesc)}</p></div>` : ''}
  ${d.text ? `<div class="card pad stack" style="gap:4px"><span class="eyebrow">${esc(srcLabel)}</span><p style="font-size:14px">${esc(d.text)}</p></div>` : ''}
  <div class="row" style="gap:8px"><span style="color:var(--blue)">${ICONS.spark}</span><span style="font-size:13px;font-weight:600;color:var(--blue)">${d.confident ? 'AI identified the issue and department. You can only correct the location.' : 'The AI needs a bit more to identify this.'}</span></div>
  ${triage}
  <div class="card pad stack">
    ${typeBlock}${typeBlock ? '<div class="hr"></div>' : ''}
    <div class="stack" style="gap:8px">
      <div class="row between"><span class="eyebrow">Location</span>${d.building && d.autoBuilding ? `<span class="pill green">${d.source === 'photo' ? 'From photo GPS' : 'Matched from text'}</span>` : d.building ? '' : '<span class="pill gold">Tap a building</span>'}</div>
      ${mapHost({ selected: d.building, pins: clusterPins(), interactive: true, height: 230 })}
      <span class="muted small">Tap a building on the map, or choose it below.</span>
      <label class="eyebrow" for="bldg" style="margin-top:2px">Building</label>
      <select class="field" id="bldg">${bOpts}</select>
      <label class="eyebrow" for="detail">Where in the building</label>
      <input class="field" id="detail" placeholder="Floor, room, or landmark (optional)" value="${esc(d.detail)}">
    </div>
    <div class="hr"></div>
    <div class="row between">
      <div><div class="eyebrow">Severity</div><div style="font-size:14px;font-weight:600">${sev === 'critical' ? 'Immediate safety response' : sev === 'high' ? 'Blocks access or safety' : sev === 'medium' ? 'Disrupts work or learning' : 'Routine maintenance'}</div></div>
      <span class="pill ${sev === 'critical' || sev === 'high' ? 'red' : sev === 'medium' ? 'gold' : 'neutral'}">${sev[0].toUpperCase() + sev.slice(1)}</span>
    </div>
  </div>
  ${cluster ? `<div class="match">
      <div class="avatars"><span style="background:var(--blue)"></span><span style="background:#1C88CA"></span><span class="n">+${Math.max(0, cluster.count - 2)}</span></div>
      <div class="stack" style="gap:2px"><b style="font-size:14px">${cluster.count} other students reported this</b><span class="muted small">First report ${fmtDate(cluster.first)} · most recent ${ago(cluster.last)} ago. You're not the only one.</span></div>
    </div>` : ''}
  <div class="row" style="padding:4px 2px;align-items:flex-start"><span style="color:var(--ink-2);margin-top:2px">${ICONS.send}</span><div><div class="muted small">${d.category === 'alert' ? 'Verified by' : d.category === 'suggestion' ? 'Reaches' : 'Creates a work order with'}</div><div style="font-size:13px;font-weight:600">${esc(dept.name)}</div>${t.coDept ? `<div class="row" style="gap:4px;font-size:12px;color:var(--blue);font-weight:600;margin-top:2px">${ICONS.shield} Also notifies ${esc(deptById(t.coDept).name)}</div>` : ''}</div></div>
  <div class="footer-cta">
    <div class="row" style="gap:8px">
      <button class="btn ghost" style="height:54px;border-radius:16px;padding:0 14px" data-act="readback" aria-label="Read this report back to me">${ICONS.speaker}</button>
      <button class="btn primary big" id="submit-report" ${(d.building && (d.confident || d.category !== 'fix')) || d.category === 'suggestion' || d.trust === 'review' ? '' : 'disabled'}>${d.trust === 'review' ? 'Submit for review' : d.category === 'alert' ? 'Submit alert' : d.category === 'suggestion' ? 'Post suggestion' : 'Submit work order'} ${ICONS.arrow}</button>
    </div>
    <span class="muted" style="text-align:center;font-size:11px">Prototype privacy note: your name is intended to be shared only with the department, never with other students.</span>
  </div>`;
}

function sortedPosts() {
  let ps = [...state.posts];
  if (state.filter === 'safety') ps = ps.filter((p) => p.category === 'Safety');
  if (state.filter === 'suggestions') ps = ps.filter((p) => p.kind === 'suggestion');
  if (state.filter === 'resolved') ps = ps.filter((p) => p.status === 'resolved');
  const score = (p) => (p.up - p.down) / Math.pow(1 + (Date.now() - new Date(p.at)) / 36e5, 0.6);
  if (state.sort === 'trending') ps.sort((a, b) => score(b) - score(a));
  if (state.sort === 'supported') ps.sort((a, b) => (b.up - b.down) - (a.up - a.down));
  if (state.sort === 'recent') ps.sort((a, b) => new Date(b.at) - new Date(a.at));
  if (state.sort === 'near') ps.sort((a, b) => ['mlk','paseo','su','art'].indexOf(a.building) - ['mlk','paseo','su','art'].indexOf(b.building));
  return ps;
}

function PostCard(p, full = false) {
  const net = p.up - p.down;
  const st = POST_STATUS[p.status];
  const my = state.votes[p.id];
  const b = bldgById(p.building);
  const routed = net >= VOTE_THRESHOLD || p.status !== 'collecting';
  const dept = deptById(p.dept);
  const progress = routed
    ? `<span class="row" style="gap:5px;font-size:12px;font-weight:600;color:var(--${p.status === 'resolved' ? 'green' : 'gold-text'})"><span style="width:7px;height:7px;border-radius:50%;background:var(--${p.status === 'resolved' ? 'green' : 'gold'})"></span>Routed to ${esc(dept.short)}</span>`
    : `<span class="row grow" style="gap:8px"><span class="bar"><span style="width:${Math.min(100, net / VOTE_THRESHOLD * 100)}%"></span></span><span class="num" style="font-size:12px;font-weight:600;color:var(--blue);white-space:nowrap">${net}/${VOTE_THRESHOLD} votes</span></span>`;
  const updates = p.updates.map((u) => `<div class="update"><b>${esc(u.by)} · ${ago(u.at)} ago</b>${esc(u.text)}</div>`).join('');
  return `
  <article class="card pad post" data-post="${p.id}">
    <div class="votes">
      <button class="vote" data-vote="up" data-id="${p.id}" aria-label="Upvote" aria-pressed="${my === 'up'}">${ICONS.up}</button>
      <span class="count num" style="${my === 'up' ? 'color:var(--blue)' : ''}">${net}</span>
      <button class="vote down" data-vote="down" data-id="${p.id}" aria-label="Downvote" aria-pressed="${my === 'down'}">${ICONS.down}</button>
    </div>
    <div class="stack grow" style="gap:8px">
      <div class="post-meta"><span class="av"></span><b>Anonymous Spartan</b><span>·</span><span>${ago(p.at)}</span><span class="pill ${st.tone}" style="margin-left:auto">${esc(st.label)}</span></div>
      <div class="post-meta" style="gap:4px;color:var(--ink-2)"><span class="pill ${p.category === 'Safety' ? 'red' : p.category === 'Accessibility' ? 'green' : 'blue'}">${esc(p.category)}</span>${p.kind === 'suggestion' ? '<span class="pill gold">Suggestion</span>' : ''}${p.aiRouted ? '<span class="muted small">· tagged by AI</span>' : ''}<span style="display:inline-flex;align-items:center;gap:3px">${ICONS.pin} ${esc(b ? b.name : 'Campus')}</span></div>
      <button class="post-title" data-open="${p.id}" style="all:unset;cursor:pointer"><h3>${esc(p.title)}</h3></button>
      <p>${esc(p.body)}</p>
      ${updates ? (full ? updates : updates.split('</div>')[0] + '</div>') : ''}
      <div class="row" style="gap:10px;font-size:12px;flex-wrap:wrap">
        <span class="row" style="gap:4px;color:var(--ink-2)">${ICONS.comment} ${p.comments}</span>
        ${progress}
      </div>
    </div>
  </article>`;
}

function Community() {
  const sorts = [['trending','Trending'],['near','Near me'],['supported','Most supported'],['recent','Recently posted']];
  const filters = [['all','All'],['safety','Safety'],['suggestions','Suggestions'],['resolved','Resolved']];
  const verified = state.user ? `<span class="verified">${ICONS.shield} ${esc(state.user.email)}</span>` : `<button class="btn ghost" style="height:30px;padding:0 10px;font-size:12px" data-act="verify">Verify SJSU account</button>`;
  return `
  <div class="topbar">
    <div class="stack" style="gap:3px"><h1>Community</h1><span class="muted">For things a photo can't capture</span></div>
    <button class="btn gold" style="height:40px;padding:0 14px" data-act="newpost">＋ Post</button>
  </div>
  <div class="chips scroll">${sorts.map(([k, l]) => `<button class="chip dark" data-sort="${k}" aria-pressed="${state.sort === k}">${l}</button>`).join('')}</div>
  <div class="row between" style="gap:8px">
    <div class="chips">${filters.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${state.filter === k}" style="padding:6px 12px;font-size:12px">${l}</button>`).join('')}</div>
    ${verified}
  </div>
  <div class="notice">${ICONS.info}<span>A post reaches its department at <b style="color:var(--ink)">${VOTE_THRESHOLD} votes</b>. Until then, it's a conversation. Voting needs a verified SJSU account.</span></div>
  <div class="stack">${sortedPosts().map((p) => PostCard(p)).join('')}</div>`;
}

function PostDetail() {
  const p = state.posts.find((x) => x.id === state.openPost);
  if (!p) { state.view = 'community'; return Community(); }
  const steps = ['collecting','review','response','resolved'];
  const idx = steps.indexOf(p.status);
  const tl = steps.map((s, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'now' : 'todo';
    return `<div class="tl ${cls}"><div class="rail"><span class="node ${cls}">${cls === 'done' ? ICONS.check : ''}</span>${i < steps.length - 1 ? `<span class="line ${i < idx ? 'done' : ''}"></span>` : ''}</div><div class="body"><b>${esc(POST_STATUS[s].label)}</b><span>${i === 0 ? `${p.up - p.down}/${VOTE_THRESHOLD} votes` : i <= idx ? 'Done' : 'Pending'}</span></div></div>`;
  }).join('');
  return `
  <div class="topbar">
    <button class="icon-btn back" data-go="community" aria-label="Back">${ICONS.back}</button>
    <span style="font-size:15px;font-weight:700">Discussion</span>
    <span style="width:40px"></span>
  </div>
  ${PostCard(p, true)}
  <div class="card pad stack">
    <h2>Status</h2>
    <div class="timeline">${tl}</div>
  </div>
  <div class="card pad stack">
    <div class="row between"><h2>Official updates</h2><span class="muted small">${p.updates.length}</span></div>
    ${p.updates.length ? p.updates.map((u) => `<div class="update"><b>${esc(u.by)} · ${fmtTime(u.at)}</b>${esc(u.text)}</div>`).join('') : `<p class="muted">No department response yet. Updates from ${esc(deptById(p.dept).name)} will appear here.</p>`}
    <div class="hr"></div>
    <form class="stack" id="official-form" style="gap:6px">
      <span class="eyebrow">Demo: post as ${esc(deptById(p.dept).short)}</span>
      <input class="field" id="official-text" placeholder="Write an update as the department…">
      <div class="row between"><span class="muted small">Officials sign in with a department account.</span><button class="btn primary" type="submit">Post update</button></div>
    </form>
  </div>`;
}

function Mine() {
  const rs = [...state.reports].sort((a, b) => new Date(b.at) - new Date(a.at));
  const counts = { all: rs.length, prog: rs.filter((r) => ['routed','pending','acknowledged','assigned','in_progress','review'].includes(r.status)).length, fixed: rs.filter((r) => ['resolved','verified','announced'].includes(r.status)).length };
  const cards = rs.map((r, i) => ReportCard(r, i === 0)).join('');
  return `
  <div class="stack" style="gap:3px"><h1>My work orders</h1><span class="muted">Every report becomes a work order with a status. You'll know what happened.</span></div>
  ${rs.length ? mapHost({ pins: rs.filter((r) => r.building).map((r) => ({ building: r.building, tone: toneFor(r.status), label: `${r.title}, ${REPORT_STATUS[r.status]}` })), height: 190 }) : ''}
  <div class="stats">
    <div class="stat"><b class="num">${counts.all}</b><span>Submitted</span></div>
    <div class="stat"><b class="num" style="color:var(--gold-text)">${counts.prog}</b><span>In progress</span></div>
    <div class="stat"><b class="num" style="color:var(--green)">${counts.fixed}</b><span>Done</span></div>
  </div>
  ${rs.length ? `<div class="stack">${cards}</div>` : `<div class="card pad stack" style="align-items:center;text-align:center;padding:28px 16px"><b>Nothing reported yet</b><span class="muted">Type, say, or snap something on the Home tab. It shows up here with a live status.</span><button class="btn primary" data-go="home">Report something</button></div>`}`;
}

function ReportCard(r, open) {
  const b = bldgById(r.building), dept = r.dept ? deptById(r.dept) : null;
  const tone = toneFor(r.status);
  const cat = CATEGORY[r.category || 'fix'];
  // timeline: every event so far, then the remaining expected steps
  const expected = r.category === 'alert' ? ['verified', 'announced'] : r.status === 'review' ? ['routed'] : ['assigned', 'in_progress', 'resolved', 'verified'];
  const done = r.events.map((e) => e.status);
  const todo = r.status === 'dismissed' ? [] : expected.filter((x) => !done.includes(x) && !(x === 'assigned' && done.includes('acknowledged')));
  const rows = [
    ...r.events.map((e, i) => ({ cls: i === r.events.length - 1 && todo.length && !['resolved','verified','announced'].includes(e.status) ? 'now' : 'done', label: e.status === 'routed' && dept ? `Routed to ${esc(dept.name)}` : REPORT_STATUS[e.status] || e.status, sub: `${fmtTime(e.at)}${e.note ? ' · ' + esc(e.note) : ''}` })),
    ...todo.map((x) => ({ cls: 'todo', label: REPORT_STATUS[x], sub: x === 'resolved' ? "We'll notify you" : 'Pending' })),
  ];
  const tl = rows.map((row, i) => `<div class="tl ${row.cls}"><div class="rail"><span class="node ${row.cls}">${row.cls === 'done' ? ICONS.check : ''}</span>${i < rows.length - 1 ? `<span class="line ${row.cls === 'done' ? 'done' : ''}"></span>` : ''}</div><div class="body"><b>${row.label}</b><span>${row.sub}</span></div></div>`).join('');
  // staff-side demo controls
  let staff = '';
  if (r.status === 'review') staff = `<div class="staff"><span class="eyebrow">Staff demo</span><div class="row" style="gap:8px"><button class="btn primary" style="height:34px" data-staff="release" data-id="${r.id}">Looks real · route it</button><button class="btn ghost" style="height:34px" data-staff="dismiss-review" data-id="${r.id}">Dismiss</button></div></div>`;
  else if (r.category === 'alert' && r.status === 'pending') staff = `<div class="staff"><span class="eyebrow">Staff demo · verify before announcing</span><div class="row" style="gap:8px"><button class="btn primary" style="height:34px;background:var(--red)" data-staff="verify" data-id="${r.alertId}">Confirmed · announce</button><button class="btn ghost" style="height:34px" data-staff="dismiss-alert" data-id="${r.alertId}">Can't confirm</button></div></div>`;
  else if (r.category !== 'alert' && ['routed','acknowledged','assigned','in_progress','resolved'].includes(r.status)) staff = `<div class="staff"><span class="eyebrow">Staff demo</span><button class="btn ghost" style="height:34px" data-staff="advance" data-id="${r.id}">Next: ${esc(REPORT_STATUS[{ routed: 'assigned', acknowledged: 'in_progress', assigned: 'in_progress', in_progress: 'resolved', resolved: 'verified' }[r.status]])}</button></div>`;
  return `
  <article class="card pad stack" style="gap:14px">
    <button class="row" data-toggle="${r.id}" style="all:unset;cursor:pointer;display:flex;align-items:flex-start;gap:12px;width:100%">
      <span class="ico ${tone}">${iconFor(r.type)}</span>
      <span class="grow"><div style="font-size:15px;font-weight:700">${esc(r.title)}</div><div class="muted small">${esc(b ? b.name : 'Campus')}${r.detail ? ' · ' + esc(r.detail) : ''} · ${r.id} · <span class="pill ${cat.tone}" style="font-size:10px;padding:2px 6px">${esc(cat.short)}</span>${r.coDept ? ' · ' + esc(deptById(r.coDept).short) + ' notified' : ''}</div></span>
      <span class="pill ${tone}">${esc(REPORT_STATUS[r.status])}</span>
    </button>
    <div class="timeline" ${open || r.open ? '' : 'hidden'}>${tl}${staff}</div>
  </article>`;
}

// ---------- actions ----------
function go(view) {
  state.view = view; render();
  const h = $('#view h1, #view .topbar span[style*="font-weight:700"]');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  if (view === 'review') speak(describeDraft());
  else if (view === 'mine') speak(`My work orders. ${state.reports.length} total.`);
  else if (view === 'community') speak('Community. Posts need 100 votes to reach a department.');
}

function startDraft(text, source, extra = {}) {
  const cmd = parseCommand(text);
  if (cmd && !extra.type) { runCommand(cmd); return; }
  const c = classify(text);
  state.draft = { text, source, type: c.type, building: c.building, autoBuilding: !!c.building, detail: c.detail, severity: c.severity, confident: c.confident, category: c.category, trust: c.trust, reasons: c.reasons, emergency: c.emergency, photo: null, ...extra };
  go('review');
  if (c.emergency) openEmergency();
}

// Spoken phrases that carry an intent hint before the description.
function handleUtterance(text, source, extra = {}) {
  const t = text.trim();
  const m = t.match(/^(report this problem|report this|alert students about this|alert students|suggest an improvement|suggestion|what am i seeing)[.,:]?\s*(.*)$/i);
  if (!m) return startDraft(t, source, extra);
  const head = m[1].toLowerCase(), rest = m[2].trim();
  if (head.startsWith('what am i seeing')) { state.pendingSee = true; speak('Opening the camera. Point it at the problem.'); $('#photo-input').click(); return; }
  const hint = head.startsWith('alert') ? 'alert' : head.startsWith('suggest') ? 'suggestion' : 'fix';
  if (!rest) { state.pendingHint = hint; speak(`Okay. ${hint === 'alert' ? 'Alert' : hint === 'suggestion' ? 'Suggestion' : 'Report'}. Now describe it, or take a photo.`); $('#photo-input').click(); return; }
  startDraft(rest, source, { ...extra, hint });
}

function runCommand(cmd) {
  const was = speech.on; speech.on = true;
  if (cmd.cmd === 'go') { go(cmd.view); }
  else if (cmd.cmd === 'alerts') {
    const live = state.alerts.filter((a) => a.status === 'verified');
    go('home');
    speak(live.length ? `${live.length} campus alert${live.length > 1 ? 's' : ''}. ` + live.map((a) => `${a.title} at ${bldgById(a.building)?.name || 'campus'}. ${a.note}`).join(' ') : 'No campus alerts right now.');
  }
  else if (cmd.cmd === 'near') { go('home'); speak('Open issues near you: ' + SEED_CLUSTERS.filter((c) => c.status !== 'resolved').map((c) => `${clusterTitle(c)} at ${bldgById(c.building).name}, ${REPORT_STATUS[c.status]}`).join('. ')); }
  speech.on = was;
  toast('Voice command: ' + (cmd.cmd === 'go' ? 'opened ' + cmd.view : cmd.cmd === 'alerts' ? 'reading alerts' : 'nearby issues'));
}

// Loud alert for verified dangers: audible tone + spoken message, regardless of spoken-mode setting.
function loudAlert(text) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.35 + 0.3);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * 0.35); o.stop(ac.currentTime + i * 0.35 + 0.32);
    }
  } catch (e) { /* no audio */ }
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance('Campus alert. ' + text); u.rate = 1; u.volume = 1; setTimeout(() => speechSynthesis.speak(u), 1100); } catch (e) { /* ignore */ } }
  if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) { /* ignore */ } }
}

function openEmergency() {
  sheet(`
    <div class="stack" style="gap:6px">
      <span class="pill red" style="align-self:flex-start">Possible emergency</span>
      <h2 style="font-size:20px">If someone is in danger, call now.</h2>
      <span class="muted">Your report is still being filed and routed to University Police. Don't wait on the app.</span>
    </div>
    <div class="stack" style="gap:8px">
      <div class="card pad row between" style="border-color:var(--red)"><div><div class="eyebrow" style="color:var(--red)">Emergency</div><div style="font-size:24px;font-weight:800" class="num">911</div></div><button class="btn primary" style="background:var(--red)" data-copy="911">Copy</button></div>
      <div class="card pad row between"><div><div class="eyebrow">SJSU University Police, 24/7</div><div style="font-size:20px;font-weight:800" class="num">(408) 924-2222</div></div><button class="btn ghost" data-copy="4089242222">Copy</button></div>
    </div>
    <span class="muted small">Tap a number to copy it, then dial from your phone app.</span>`);
  $('#sheet').querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copied ' + b.dataset.copy); } catch (e) { toast(b.dataset.copy); }
  }));
  const was = speech.on; speech.on = true; speak('This looks like an emergency. If someone is in danger call 911, or University Police at 4 0 8, 9 2 4, 2 2 2 2.'); speech.on = was;
}

function submitReport() {
  const d = state.draft;
  if (d.trust === 'review') return submitForReview();
  if (d.category === 'suggestion') return submitSuggestion();
  if (d.category === 'alert') return submitAlert();
  const t = typeById(d.type), dept = deptById(t.dept);
  const cluster = d.building ? findCluster(d.type, d.building) : null;
  const now = new Date().toISOString();
  const id = 'WO-' + String(1040 + state.reports.length + Math.floor(Math.random() * 9)).padStart(4, '0');
  const co = t.coDept ? deptById(t.coDept) : null;
  const events = [{ status: 'submitted', at: now, note: `took you ${d.seconds || 20} seconds · ${{ text: 'typed', voice: 'by voice', photo: 'with a photo' }[d.source]}` }];
  if (cluster) {
    events.push({ status: 'routed', at: now, note: `Merged with ${cluster.count} matching reports${co ? ' · ' + co.short + ' notified' : ''}` });
    cluster.events.filter((e) => e.status !== 'routed').forEach((e) => events.push({ ...e }));
  } else {
    events.push({ status: 'routed', at: now, note: `New work order${co ? ' · ' + co.short + ' notified' : ''}` });
  }
  const status = cluster ? cluster.status : 'routed';
  const title = cluster ? clusterTitle(cluster) : `${t.label} issue`;
  state.reports.push({ id, at: now, title, type: d.type, building: d.building, detail: d.detail, severity: d.severity, dept: dept.id, coDept: co?.id || null, status, events, source: d.source, photo: d.photo });
  if (cluster) cluster.count += 1;
  state.draft = null;
  save();
  go('mine');
  buzz([40, 30, 40]);
  const msg = `Work order ${id} opened with ${dept.short}${co ? ' and ' + co.short : ''}`;
  toast(msg); speak(msg + '. It is now in My reports.');
}

function submitForReview() {
  const d = state.draft, now = new Date().toISOString();
  const id = 'RV-' + String(200 + state.reports.length).padStart(4, '0');
  state.reports.push({ id, at: now, title: d.text.slice(0, 60) || 'Report', type: d.type, building: d.building, detail: d.detail, severity: d.severity, dept: null, status: 'review', category: d.category, source: d.source,
    events: [{ status: 'submitted', at: now, note: 'by ' + d.source }, { status: 'review', at: now, note: 'Held: ' + d.reasons.join(', ') + '. A staff member will look before anything is routed.' }] });
  state.draft = null; save(); go('mine');
  toast('Held for review. Nothing was sent yet.'); speak('Your report was held for review and not sent. ' + d.reasons.join(', ') + '.');
}

function submitSuggestion() {
  const d = state.draft, now = new Date().toISOString();
  const id = 'p' + Date.now();
  const b = d.building ? bldgById(d.building) : null;
  const tp = topicFor(d.text);
  state.posts.unshift({ id, title: d.text.length > 80 ? d.text.slice(0, 77) + '…' : d.text, body: d.text.length > 80 ? d.text : '', category: tp.topic, kind: 'suggestion', building: d.building, up: 1, down: 0, comments: 0, at: now, dept: tp.dept, status: 'collecting', updates: [], aiRouted: true });
  state.votes[id] = 'up';
  state.draft = null; state.sort = 'recent'; save(); go('community');
  toast('Filed as a suggestion. Collecting support.'); speak(`Filed as a suggestion in Community${b ? ' for ' + b.name : ''}. It reaches staff at ${VOTE_THRESHOLD} votes.`);
}

function submitAlert() {
  const d = state.draft, now = new Date().toISOString();
  const b = d.building ? bldgById(d.building) : null;
  const match = state.alerts.find((a) => a.building === d.building && a.status !== 'dismissed' && a.status !== 'resolved');
  if (match) { match.count += 1; }
  const id = match ? match.id : 'a' + Date.now();
  if (!match) state.alerts.unshift({ id, title: d.text.length > 60 ? d.text.slice(0, 57) + '…' : d.text, building: d.building, detail: d.detail, severity: d.severity, at: now, status: 'pending', count: 1, note: '', emergency: d.emergency });
  const rid = 'AL-' + String(300 + state.reports.length).padStart(4, '0');
  state.reports.push({ id: rid, at: now, alertId: id, title: d.text.slice(0, 60), type: d.type, building: d.building, detail: d.detail, severity: d.severity, dept: d.emergency ? 'upd' : typeById(d.type).dept, status: 'pending', category: 'alert', source: d.source,
    events: [{ status: 'submitted', at: now, note: 'by ' + d.source }, { status: 'pending', at: now, note: match ? `Grouped with ${match.count - 1} matching report${match.count > 2 ? 's' : ''} · staff verification required before announcement` : (d.emergency ? 'University Police notified immediately · staff verification required before campus announcement' : 'New alert · staff verification required before announcement') }] });
  state.draft = null; save(); go('mine');
  toast(match ? `Grouped with ${match.count - 1} other report${match.count > 2 ? 's' : ''}. Awaiting staff.` : 'Alert filed. Awaiting staff verification.');
  speak(`Filed as an alert${b ? ' at ' + b.name : ''}. ${match ? (match.count - 1) + ' other students reported the same thing. ' : ''}A staff member has to verify it before students are notified.`);
}

// Staff-side demo controls (stand-in for a department login).
function staffVerifyAlert(id) {
  const a = state.alerts.find((x) => x.id === id); if (!a) return;
  a.status = 'verified'; a.verifiedBy = 'Staff (demo)'; a.note = a.note || 'Please avoid the area until it is cleared.';
  state.reports.filter((r) => r.alertId === id).forEach((r) => { r.status = 'announced'; r.events.push({ status: 'verified', at: new Date().toISOString(), note: 'Verified by staff' }, { status: 'announced', at: new Date().toISOString(), note: 'Students and staff notified' }); });
  save(); render();
  loudAlert(`${a.title} at ${bldgById(a.building)?.name || 'campus'}. ${a.note}`);
}
function staffDismissAlert(id) {
  const a = state.alerts.find((x) => x.id === id); if (!a) return;
  a.status = 'dismissed';
  state.reports.filter((r) => r.alertId === id).forEach((r) => { r.status = 'dismissed'; r.events.push({ status: 'dismissed', at: new Date().toISOString(), note: 'Staff could not confirm the issue' }); });
  save(); render(); toast('Alert dismissed. No announcement sent.');
}
function staffAdvance(rid) {
  const r = state.reports.find((x) => x.id === rid); if (!r) return;
  const chain = ['routed', 'assigned', 'in_progress', 'resolved', 'verified'];
  const i = chain.indexOf(r.status === 'acknowledged' ? 'assigned' : r.status);
  const next = chain[Math.min(chain.length - 1, i + 1)];
  if (next === r.status) return;
  r.status = next;
  const notes = { assigned: 'Technician assigned', in_progress: 'Work started', resolved: 'Marked fixed by department', verified: 'Fix verified · map updated' };
  r.events.push({ status: next, at: new Date().toISOString(), note: notes[next] });
  save(); render(); toast(REPORT_STATUS[next]);
  if (next === 'resolved' || next === 'verified') speak(`${r.title} at ${bldgById(r.building)?.name || 'campus'} is ${REPORT_STATUS[next].toLowerCase()}.`);
}
function staffReleaseReview(rid, ok) {
  const r = state.reports.find((x) => x.id === rid); if (!r) return;
  if (ok) { r.status = 'routed'; r.dept = typeById(r.type).dept; r.events.push({ status: 'routed', at: new Date().toISOString(), note: 'Released by staff and routed' }); }
  else { r.status = 'dismissed'; r.events.push({ status: 'dismissed', at: new Date().toISOString(), note: 'Staff dismissed as not actionable' }); }
  save(); render();
}

function vote(id, dir) {
  if (!state.user) { openVerify(() => vote(id, dir)); return; }
  const p = state.posts.find((x) => x.id === id);
  const prev = state.votes[id];
  if (prev === dir) { state.votes[id] = null; p[dir] -= 1; }
  else {
    if (prev) p[prev] -= 1;
    state.votes[id] = dir; p[dir] += 1;
  }
  if (p.status === 'collecting' && p.up - p.down >= VOTE_THRESHOLD) {
    p.status = 'review';
    toast(`Reached ${VOTE_THRESHOLD} votes. Routed to ${deptById(p.dept).short}.`);
  }
  save(); render();
}

function openVerify(then) {
  sheet(`
    <div class="stack" style="gap:4px"><h2 style="font-size:18px">Verify your SJSU account</h2><span class="muted">One vote per student. Your email is never shown to other students.</span></div>
    <form class="stack" id="verify-form" style="gap:8px">
      <label class="eyebrow" for="sjsu-email">SJSU email</label>
      <input class="field" id="sjsu-email" type="email" placeholder="you@sjsu.edu" required pattern=".+@sjsu\\.edu$" inputmode="email">
      <span class="muted small" id="verify-err" hidden>Use your @sjsu.edu address.</span>
      <button class="btn primary big" type="submit">Send verification code</button>
      <span class="muted small" style="text-align:center">Demo: any @sjsu.edu address verifies instantly.</span>
    </form>`);
  $('#verify-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#sjsu-email').value.trim().toLowerCase();
    if (!/@sjsu\.edu$/.test(email)) { $('#verify-err').hidden = false; return; }
    state.user = { email, verifiedAt: new Date().toISOString() };
    save(); closeSheet(); toast('Verified as ' + email);
    if (then) then(); else render();
  });
}

function openNewPost() {
  if (!state.user) { openVerify(openNewPost); return; }
  sheet(`
    <div class="stack" style="gap:4px"><h2 style="font-size:18px">New post</h2><span class="muted">Posted as Anonymous Spartan. Routed to a department at ${VOTE_THRESHOLD} votes.</span></div>
    <form class="stack" id="post-form" style="gap:8px">
      <input class="field" id="np-title" placeholder="What's the issue?" required maxlength="90">
      <textarea class="field" id="np-body" rows="3" placeholder="Where, when, and what happened" style="height:auto;padding:10px 12px;resize:none"></textarea>
      <select class="field" id="np-bldg"><option value="">Location (optional, AI will try to detect it)</option>${BUILDINGS.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>
      <div class="row" style="gap:8px;font-size:12px;color:var(--ink-2)"><span style="color:var(--blue)">${ICONS.spark}</span><span>AI tags it: <b id="np-guess" style="color:var(--ink)">start typing…</b></span></div>
      <button class="btn primary big" type="submit">Post</button>
    </form>`);
  const guess = () => { const txt = ($('#np-title').value + ' ' + $('#np-body').value).trim(); const g = $('#np-guess'); if (!txt) { g.textContent = 'start typing…'; return; } const tp = topicFor(txt); const c = classify(txt); const b = c.building ? bldgById(c.building) : null; g.textContent = tp.topic + (b ? ' · ' + b.name : '') + ' → ' + deptById(tp.dept).short; if (b && !$('#np-bldg').value) $('#np-bldg').value = c.building; };
  $('#np-title').addEventListener('input', guess); $('#np-body').addEventListener('input', guess);
  $('#post-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = ($('#np-title').value + ' ' + $('#np-body').value).trim();
    const tp = topicFor(txt);
    const c = classify(txt);
    const id = 'p' + Date.now();
    state.posts.unshift({ id, title: $('#np-title').value.trim(), body: $('#np-body').value.trim(), category: tp.topic, kind: c.category === 'suggestion' ? 'suggestion' : undefined, building: $('#np-bldg').value || c.building || null, up: 1, down: 0, comments: 0, at: new Date().toISOString(), dept: tp.dept, status: 'collecting', updates: [], aiRouted: true });
    state.votes[id] = 'up';
    save(); closeSheet(); state.sort = 'recent'; render(); toast('Posted. Collecting support.');
  });
}

// voice: this runs inside a sandbox that refuses the microphone, so the demo transcribes a sample.
let holdTimer = null;
// Real speech recognition where the browser offers it (Safari 14.5+, Chrome, Edge). Needs HTTPS and a mic permission.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const rec = { obj: null, finalText: '', interim: '', active: false, failed: false };
let micGranted = false;
async function ensureMic() {
  if (micGranted) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true; // let SR try on its own
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micGranted = true; return true;
  } catch (e) { rec.failed = true; rec.err = e.name === 'NotAllowedError' ? 'not-allowed' : (e.name || String(e)); return false; }
}
function voiceStart(btn) {
  btn.classList.add('listening');
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  $('.t', btn).textContent = TOUCH ? 'Listening… tap to stop' : 'Listening…';
  $('.s', btn).textContent = SR ? (TOUCH ? 'Speak, then tap again' : 'Release when you\'re done') : 'Release to send';
  holdTimer = Date.now();
  rec.finalText = ''; rec.interim = ''; rec.active = false; rec.failed = false; rec.err = null;
  if (!SR) return;
  const startSR = () => {
    try {
      const r = new SR(); rec.obj = r;
      r.lang = 'en-US'; r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        let fin = '', inter = '';
        for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + ' '; else inter += t; }
        rec.finalText = fin.trim(); rec.interim = inter.trim();
        const shown = (rec.finalText + ' ' + rec.interim).trim();
        if (shown) $('.s', btn).textContent = '\u201c' + shown + '\u201d';
      };
      r.onerror = (e) => { rec.failed = true; rec.err = e.error; };
      r.onend = () => { rec.active = false; if (rec.pendingFinish) { rec.pendingFinish = false; finishVoice(btn); } };
      r.start(); rec.active = true;
    } catch (e) { rec.failed = true; rec.err = String(e); }
  };
  // Start recognition inside the gesture; ask for the mic explicitly the first time so iOS shows its prompt.
  if (micGranted) { startSR(); return; }
  // On iOS the permission request and recognition start both have to happen inside the tap.
  startSR();
  ensureMic().then((ok) => { if (!ok) { try { rec.obj && rec.obj.abort(); } catch (e) { /* ignore */ } } });
}
function voiceEnd(btn) {
  if (!btn.classList.contains('listening')) return;
  btn.classList.remove('listening');
  const held = (Date.now() - holdTimer) / 1000;
  $('.t', btn).textContent = matchMedia('(pointer: coarse)').matches ? 'Tap to talk' : 'Hold to talk';
  if (held < 0.4 && !matchMedia('(pointer: coarse)').matches) { $('.s', btn).textContent = "Say what's wrong and where. We transcribe and route it."; try { rec.obj && rec.obj.abort(); } catch (e) { /* ignore */ } toast('Hold the button while you talk'); return; }
  if (SR && rec.obj && rec.active && !rec.failed) {
    $('.s', btn).textContent = 'Transcribing…';
    rec.pendingFinish = true;
    try { rec.obj.stop(); } catch (e) { rec.pendingFinish = false; finishVoice(btn); }
    setTimeout(() => { if (rec.pendingFinish) { rec.pendingFinish = false; finishVoice(btn); } }, 2500);
    return;
  }
  finishVoice(btn);
}
function finishVoice(btn) {
  const held = (Date.now() - holdTimer) / 1000;
  $('.s', btn).textContent = "Say what's wrong and where. We transcribe and route it.";
  const heard = (rec.finalText || rec.interim || '').trim();
  buzz(30);
  if (heard) { handleUtterance(heard, 'voice', { seconds: Math.max(1, Math.round(held)) }); return; }
  if (SR && !rec.failed) { toast("Didn't catch that. Hold the button and speak, then release."); speak("I didn't catch that. Try again."); return; }
  // No speech API, or the mic was denied: say so plainly and let the person choose what to do.
  const blocked = rec.err === 'not-allowed' || rec.err === 'service-not-allowed';
  const why = !SR ? "This browser has no speech recognition." : blocked ? 'The microphone is blocked for this page (' + rec.err + '). Check Settings → Apps → Safari → Microphone, and that Dictation is enabled.' : "The microphone didn't start (" + (rec.err || 'no error reported') + ').';
  sheet(`
    <div class="stack" style="gap:6px"><h2 style="font-size:18px">Couldn\'t hear you</h2><span class="muted">${esc(why)} Opening this page in Safari or Chrome and allowing the microphone fixes it. Until then:</span></div>
    <div class="stack" style="gap:8px">
      <button class="btn primary big" data-voice-alt="type">Type it instead</button>
      <button class="btn ghost big" data-voice-alt="sample">Use a sample report (demo)</button>
    </div>`);
  const was = speech.on; speech.on = true; speak("I couldn't hear you. " + why + " You can type it instead."); speech.on = was;
  $('#sheet').querySelectorAll('[data-voice-alt]').forEach((b) => b.addEventListener('click', () => {
    closeSheet();
    if (b.dataset.voiceAlt === 'type') { const ta = $('#report-text'); if (ta) { ta.focus(); } return; }
    const samples = [
      'The elevator in Clark Hall is out again, second floor',
      'None of the outlets on the 6th floor of the library work',
      'There is water flooding the second floor hallway of Washburn Hall',
      'The ramp at the Student Union east entrance is blocked by a scooter pile',
    ];
    handleUtterance(samples[Math.floor(Math.random() * samples.length)], 'voice', { seconds: Math.max(3, Math.round(held)), sample: true });
  }));
}

function sheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-bg" id="sheet-bg"><div class="sheet" role="dialog" aria-modal="true">${html}<button class="btn ghost" data-act="close-sheet">Cancel</button></div></div>`;
  s.hidden = false;
  $('#sheet-bg').addEventListener('click', (e) => { if (e.target.id === 'sheet-bg') closeSheet(); });
  s.querySelector('[data-act="close-sheet"]').addEventListener('click', closeSheet);
  setTimeout(() => s.querySelector('input, textarea')?.focus(), 50);
}
function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

// ---------- bindings ----------
function bind() {
  const el = $('#view');

  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  const form = $('#text-form');
  if (form) {
    const ta = $('#report-text'), btn = $('#text-submit');
    const started = { t: null };
    ta.addEventListener('input', () => { btn.disabled = !ta.value.trim(); if (!started.t) started.t = Date.now(); });
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!ta.value.trim()) return; handleUtterance(ta.value.trim(), 'text', { seconds: started.t ? Math.round((Date.now() - started.t) / 1000) : 10 }); });
  }

  const v = $('#voice-btn');
  if (v) {
    const TOUCH = matchMedia('(pointer: coarse)').matches;
    v.addEventListener('contextmenu', (e) => e.preventDefault());
    if (TOUCH) {
      // Phones: tap to start, tap to stop. iOS only treats a tap (release) as a user gesture, so the mic must open here.
      v.addEventListener('click', (e) => { e.preventDefault(); if (v.classList.contains('listening')) voiceEnd(v); else voiceStart(v); });
    } else {
      v.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      const start = (e) => { e.preventDefault(); voiceStart(v); };
      const end = (e) => { e.preventDefault(); voiceEnd(v); };
      v.addEventListener('pointerdown', start);
      v.addEventListener('pointerup', end);
      v.addEventListener('pointerleave', end);
      v.addEventListener('pointercancel', end);
    }
    v.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!v.classList.contains('listening')) voiceStart(v); } });
    v.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); voiceEnd(v); } });
  }

  el.querySelectorAll('[data-act="near"]').forEach((b) => b.addEventListener('click', () => {
    const c = SEED_CLUSTERS.find((x) => x.id === b.dataset.id);
    startDraft(`${clusterTitle(c)} at ${bldgById(c.building).name}`, 'text', { type: c.type, building: c.building, detail: c.detail, autoBuilding: true, confident: true, severity: typeById(c.type).severity });
  }));

  const more = $('#more-detail');
  if (more) more.addEventListener('change', () => {
    const extra = more.value.trim(); if (!extra) return;
    const d = state.draft; const text = (d.text ? d.text + '. ' : '') + extra;
    const c = classify(text);
    Object.assign(d, { text, type: c.type, severity: c.severity, confident: c.confident, category: c.category, trust: c.trust, reasons: c.reasons, emergency: c.emergency, building: d.building || c.building, autoBuilding: d.building ? d.autoBuilding : !!c.building, detail: d.detail || c.detail });
    render(); speak(c.confident ? `Got it. ${typeById(c.type).label}, ${CATEGORY[c.category].label}.` : 'Still not sure. Add where it is and what is wrong.');
  });
  const bldg = $('#bldg');
  if (bldg) bldg.addEventListener('change', () => { state.draft.building = bldg.value || null; state.draft.autoBuilding = false; render(); });
  const det = $('#detail');
  if (det) det.addEventListener('input', () => { state.draft.detail = det.value; });
  el.querySelectorAll('[data-act="retake"]').forEach((b) => b.addEventListener('click', () => openPhotoChooser(true)));
  const sub = $('#submit-report');
  if (sub) sub.addEventListener('click', submitReport);

  el.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { state.sort = b.dataset.sort; render(); }));
  el.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; render(); }));
  el.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => vote(b.dataset.id, b.dataset.vote)));
  el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { state.openPost = b.dataset.open; go('post'); }));
  el.querySelectorAll('[data-act="verify"]').forEach((b) => b.addEventListener('click', () => openVerify()));
  el.querySelectorAll('[data-act="newpost"]').forEach((b) => b.addEventListener('click', openNewPost));
  el.querySelectorAll('[data-act="notif"]').forEach((b) => b.addEventListener('click', () => toast(state.reports.length ? `${state.reports.length} work order${state.reports.length > 1 ? 's' : ''} being tracked` : 'No updates yet')));
  el.querySelectorAll('[data-act="assist"]').forEach((b) => b.addEventListener('click', () => {
    speech.assist = !speech.assist; speech.on = speech.assist; document.body.classList.toggle('assist', speech.assist);
    try { localStorage.setItem('eaiser-assist', speech.assist ? '1' : '0'); } catch (e) { /* ignore */ }
    buzz([60, 40, 60]); render();
    if (speech.assist) speak('Assist mode on. Hold the big button and say what is wrong. You can also say: report this problem, alert students about this, suggest an improvement, or what am I seeing.');
    else toast('Assist mode off');
  }));
  el.querySelectorAll('[data-act="read-alerts"]').forEach((b) => b.addEventListener('click', () => runCommand({ cmd: 'alerts' })));
  el.querySelectorAll('[data-act="read-near"]').forEach((b) => b.addEventListener('click', () => runCommand({ cmd: 'near' })));
  el.querySelectorAll('[data-act="see"]').forEach((b) => b.addEventListener('click', () => { state.pendingSee = true; $('#photo-input').click(); }));
  el.querySelectorAll('[data-act="emergency"]').forEach((b) => b.addEventListener('click', openEmergency));
  el.querySelectorAll('[data-staff]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.staff, id = b.dataset.id;
    if (a === 'verify') staffVerifyAlert(id); else if (a === 'dismiss-alert') staffDismissAlert(id);
    else if (a === 'advance') staffAdvance(id); else if (a === 'release') staffReleaseReview(id, true); else if (a === 'dismiss-review') staffReleaseReview(id, false);
  }));
  el.querySelectorAll('[data-act="readback"]').forEach((b) => b.addEventListener('click', () => {
    const was = speech.on; speech.on = true; speak(describeDraft()); speech.on = was;
    if (!('speechSynthesis' in window)) toast('Speech is not available in this browser');
  }));
  el.querySelectorAll('[data-bld]').forEach((b) => b.addEventListener('click', () => {
    state.draft.building = b.dataset.bld; state.draft.autoBuilding = false; render();
    speak(bldgById(b.dataset.bld).name + ' selected');
  }));

  const of = $('#official-form');
  if (of) of.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = state.posts.find((x) => x.id === state.openPost);
    const text = $('#official-text').value.trim();
    if (!text) return;
    p.updates.push({ by: deptById(p.dept).name, at: new Date().toISOString(), text });
    if (p.status === 'collecting' || p.status === 'review') p.status = 'response';
    save(); render(); toast('Update posted');
  });

  el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const r = state.reports.find((x) => x.id === b.dataset.toggle);
    r.open = !r.open; render();
  }));
}

function openPhotoChooser(preserveDraft = false) {
  sheet(`<div class="stack" style="gap:6px"><h2 style="font-size:20px">Add a photo</h2><span class="muted small">A photo helps Mpulse identify the issue and route it to the right department.</span></div>
    <div class="stack" style="gap:10px;margin-top:16px">
      <button class="btn primary big" data-photo-choice="camera">📷 Take a photo</button>
      <button class="btn ghost big" data-photo-choice="upload">▣ Upload from device</button>
    </div>`);
  $('#sheet').querySelectorAll('[data-photo-choice]').forEach((b) => b.addEventListener('click', () => {
    const choice = b.dataset.photoChoice;
    closeSheet();
    if (!preserveDraft || !state.draft) {
      state.draft = { text: '', source: 'photo', type: 'other', building: null, autoBuilding: false, detail: '', severity: 'low', confident: false, photo: null };
    } else {
      state.draft.source = 'photo';
      state.draft.photo = null;
    }
    go('review');
    const input = $('#photo-input');
    if (choice === 'camera') input.setAttribute('capture', 'environment'); else input.removeAttribute('capture');
    input.click();
  }));
}

document.querySelectorAll('.tabbar .tab').forEach((t) => t.addEventListener('click', () => {
  const v = t.dataset.go;
  if (v === 'snap') { openPhotoChooser(); return; }
  go(v);
}));

$('#photo-input').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    if (state.pendingSee) {
      state.pendingSee = false;
      // Demo stand-in for a vision model: a fixed description, clearly labelled.
      const desc = 'Demo description: a concrete ramp with a wide crack across it and a scooter lying on its side at the top. Possible hazard for wheelchair users.';
      startDraft('Blocked ramp with a crack at the Student Union east entrance', 'photo', { photo: r.result, seeDesc: desc, hint: state.pendingHint || undefined });
      state.pendingHint = null;
      const was = speech.on; speech.on = true; speak(desc + ' I filed this as ' + CATEGORY[state.draft.category].label + '. Review it and say submit, or tap the button at the bottom.'); speech.on = was;
      if (state.draft.severity === 'high' || state.draft.severity === 'critical') { buzz([200, 100, 200]); }
      return;
    }
    if (!state.draft) state.draft = { text: '', source: 'photo', type: 'other', building: null, detail: '', severity: 'low', confident: false, category: 'fix', trust: 'ok', reasons: [], hint: state.pendingHint || undefined };
    state.pendingHint = null;
    state.draft.photo = r.result; state.draft.source = 'photo'; render();
  };
  r.readAsDataURL(f);
  e.target.value = '';
});

load();
try { if (localStorage.getItem('eaiser-assist') === '1') { speech.assist = true; speech.on = true; document.body.classList.add('assist'); } } catch (e) { /* ignore */ }
// Hardware launch: a phone shortcut (Back Tap, Action Button, Quick Tap) opens the app at #assist and lands in voice-first mode.
const launchAssist = (/[#&?]assist/.test(location.hash) || /[?&]assist=1/.test(location.search));
if (launchAssist) { speech.assist = true; speech.on = true; document.body.classList.add('assist'); try { localStorage.setItem('eaiser-assist', '1'); } catch (e) { /* ignore */ } }
render();
if (launchAssist) { buzz([80, 40, 80]); setTimeout(() => { speak('Assist mode. Hold the big button and say what is wrong.'); $('#voice-btn')?.focus(); }, 300); }
// Hardware keyboard / Bluetooth clicker: Space or Enter with nothing focused = hold to talk; pressing Escape three times quickly toggles Assist mode.
let escTimes = [];
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const now = Date.now(); escTimes = escTimes.filter((t) => now - t < 1200); escTimes.push(now); if (escTimes.length >= 3) { escTimes = []; $('[data-act="assist"]')?.click(); } return; }
  const tag = document.activeElement?.tagName;
  if ((e.key === ' ' || e.key === 'Enter') && (!tag || tag === 'BODY') && $('#voice-btn')) { e.preventDefault(); $('#voice-btn').focus(); voiceStart($('#voice-btn')); }
});
document.addEventListener('keyup', (e) => { const tag = document.activeElement?.tagName; if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === $('#voice-btn')) voiceEnd($('#voice-btn')); });
