// EAiSER Campus — app logic. Vanilla JS, no build step.

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
  sort: 'trending',
  filter: 'all',
};

function load() {
  try {
    const raw = localStorage.getItem('eaiser-campus');
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.reports = saved.reports || [];
    state.votes = saved.votes || {};
    state.user = saved.user || null;
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
    localStorage.setItem('eaiser-campus', JSON.stringify({
      reports: state.reports, votes: state.votes, user: state.user,
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
  const floor = t.match(/(\d+)(?:st|nd|rd|th)\s*floor/);
  if (floor) detail = `${floor[1]}${['st','nd','rd'][floor[1]-1] || 'th'} floor`;
  const room = t.match(/\broom\s*(\w+)/);
  if (room) detail = (detail ? detail + ', ' : '') + 'room ' + room[1].toUpperCase();
  return { type: type?.id || 'other', building: building?.id || null, detail, severity: type?.severity || 'low', confident: !!type };
}

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
const speech = { on: false };
function speak(text) {
  if (!speech.on || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
}
function describeDraft() {
  const d = state.draft; if (!d) return '';
  const t = typeById(d.type), b = d.building ? bldgById(d.building) : null, dept = deptById(t.dept);
  const cluster = d.building ? findCluster(d.type, d.building) : null;
  return `Review. Issue: ${t.label}. Location: ${b ? b.name : 'not set yet'}${d.detail ? ', ' + d.detail : ''}. Severity ${d.severity}. ${cluster ? cluster.count + ' other students reported this. ' : ''}Routes to ${dept.name}${t.coDept ? ', and ' + deptById(t.coDept).name : ''}. Submit button is at the bottom.`;
}
const toneFor = (status) => ({ submitted: 'blue', routed: 'blue', acknowledged: 'gold', in_progress: 'gold', resolved: 'green' }[status] || 'neutral');

// ---------- views ----------
function render() {
  const el = $('#view');
  el.scrollTop = 0;
  window.scrollTo(0, 0);
  const v = state.view;
  el.innerHTML = v === 'home' ? Home() : v === 'review' ? Review() : v === 'community' ? Community() : v === 'post' ? PostDetail() : Mine();
  document.querySelectorAll('.tab').forEach((t) => {
    const cur = t.dataset.go === v || (v === 'post' && t.dataset.go === 'community') || (v === 'review' && t.dataset.go === 'snap' && state.draft?.source === 'photo');
    if (cur) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  bind();
}

function header(title, sub) {
  return `
  <div class="topbar">
    <div class="brand">
      <div class="seal"><img src="assets/sjsu-seal.png" alt="San José State University seal"></div>
      <div><div class="brand-name">EAiSER <span>Campus</span></div><div class="brand-sub">San José State University</div></div>
    </div>
    <div class="row" style="gap:8px">
      <button class="icon-btn" aria-label="${speech.on ? 'Turn off spoken mode' : 'Turn on spoken mode'}" aria-pressed="${speech.on}" data-act="speak" ${speech.on ? 'style="background:var(--blue);color:#fff;border-color:var(--blue)"' : ''}>${ICONS.speaker}</button>
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
  return `
  ${header()}
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
    <span class="grow"><div class="t">Hold to talk</div><div class="s">Say what's wrong and where. We transcribe and route it.</div></span>
    <span class="wave" aria-hidden="true"><span style="height:10px"></span><span style="height:20px"></span><span style="height:14px"></span><span style="height:26px"></span><span style="height:16px"></span><span style="height:8px"></span></span>
  </button>
  <div class="row between" style="margin-top:6px">
    <h2>Open on campus</h2>
    <span class="muted small row" style="gap:4px">${ICONS.map} Live map</span>
  </div>
  ${campusMap({ pins: clusterPins(), height: 200 })}
  <div class="stack">${near}</div>`;
}

function clusterTitle(c) {
  return ({ elevator: 'Elevator out of service', outlet: 'Outlets not working', printer: 'Printers out of toner', wifi: 'Wi‑Fi dropping' })[c.type] || typeById(c.type).label + ' issue';
}

function Review() {
  const d = state.draft;
  const t = typeById(d.type), b = d.building ? bldgById(d.building) : null, dept = deptById(t.dept);
  const cluster = d.building ? findCluster(d.type, d.building) : null;
  const sev = d.severity;
  const chips = ISSUE_TYPES.filter((x) => ['elevator','door','outlet','hvac','lighting','plumbing','wifi','printer','safety','other'].includes(x.id))
    .map((x) => `<button type="button" class="chip" data-type="${x.id}" aria-pressed="${x.id === d.type}">${esc(x.label)}</button>`).join('');
  const bOpts = `<option value="">Choose a building…</option>` + BUILDINGS.map((x) => `<option value="${x.id}" ${x.id === d.building ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const photo = d.photo
    ? `<div class="photo"><img src="${d.photo}" alt="Your photo of the issue"><span class="cap">Photo attached</span><button type="button" class="retake" data-act="retake">Retake</button></div>`
    : d.source === 'photo'
      ? `<div class="photo" style="flex-direction:column;gap:8px"><span style="opacity:.9;font-size:12px;font-weight:600">No photo yet</span><button type="button" class="retake" data-act="retake" style="position:static">Open camera</button></div>`
      : '';
  const srcLabel = { text: 'Typed', voice: 'Voice transcript', photo: 'Photo' }[d.source];
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
  ${d.text ? `<div class="card pad stack" style="gap:4px"><span class="eyebrow">${esc(srcLabel)}</span><p style="font-size:14px">${esc(d.text)}</p></div>` : ''}
  <div class="row" style="gap:8px"><span style="color:var(--blue)">${ICONS.spark}</span><span style="font-size:13px;font-weight:600;color:var(--blue)">${d.confident ? 'AI filled the details. Tap anything to change it.' : 'Tell us the type and building so we can route it.'}</span></div>
  <div class="card pad stack">
    <div class="stack" style="gap:8px"><span class="eyebrow">Issue type</span><div class="chips">${chips}</div></div>
    <div class="hr"></div>
    <div class="stack" style="gap:8px">
      <div class="row between"><span class="eyebrow">Location</span>${d.building && d.autoBuilding ? `<span class="pill green">${d.source === 'photo' ? 'From photo GPS' : 'Matched from text'}</span>` : d.building ? '' : '<span class="pill gold">Tap a building</span>'}</div>
      ${campusMap({ selected: d.building, interactive: true, height: 210 })}
      <label class="eyebrow" for="bldg" style="margin-top:2px">Building</label>
      <select class="field" id="bldg">${bOpts}</select>
      <label class="eyebrow" for="detail">Where in the building</label>
      <input class="field" id="detail" placeholder="Floor, room, or landmark (optional)" value="${esc(d.detail)}">
    </div>
    <div class="hr"></div>
    <div class="row between">
      <div><div class="eyebrow">Severity</div><div style="font-size:14px;font-weight:600">${sev === 'high' ? 'Blocks access or safety' : sev === 'medium' ? 'Disrupts work' : 'Cosmetic'}</div></div>
      <span class="pill ${sev === 'high' ? 'red' : sev === 'medium' ? 'gold' : 'neutral'}">${sev[0].toUpperCase() + sev.slice(1)}</span>
    </div>
  </div>
  ${cluster ? `<div class="match">
      <div class="avatars"><span style="background:var(--blue)"></span><span style="background:#1C88CA"></span><span class="n">+${Math.max(0, cluster.count - 2)}</span></div>
      <div class="stack" style="gap:2px"><b style="font-size:14px">${cluster.count} other students reported this</b><span class="muted small">First report ${fmtDate(cluster.first)} · most recent ${ago(cluster.last)} ago. You're not the only one.</span></div>
    </div>` : ''}
  <div class="row" style="padding:4px 2px;align-items:flex-start"><span style="color:var(--ink-2);margin-top:2px">${ICONS.send}</span><div><div class="muted small">Creates a work order with</div><div style="font-size:13px;font-weight:600">${esc(dept.name)}</div>${t.coDept ? `<div class="row" style="gap:4px;font-size:12px;color:var(--blue);font-weight:600;margin-top:2px">${ICONS.shield} Also notifies ${esc(deptById(t.coDept).name)}</div>` : ''}</div></div>
  <div class="footer-cta">
    <div class="row" style="gap:8px">
      <button class="btn ghost" style="height:54px;border-radius:16px;padding:0 14px" data-act="readback" aria-label="Read this report back to me">${ICONS.speaker}</button>
      <button class="btn primary big" id="submit-report" ${d.building ? '' : 'disabled'}>Submit work order ${ICONS.arrow}</button>
    </div>
    <span class="muted" style="text-align:center;font-size:11px">Your name is shared only with the department, never with other students.</span>
  </div>`;
}

function sortedPosts() {
  let ps = [...state.posts];
  if (state.filter === 'safety') ps = ps.filter((p) => p.category === 'Safety');
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
      <div class="post-meta" style="gap:4px;color:var(--ink-2)"><span class="pill ${p.category === 'Safety' ? 'red' : 'blue'}">${esc(p.category)}</span><span style="display:inline-flex;align-items:center;gap:3px">${ICONS.pin} ${esc(b ? b.name : 'Campus')}</span></div>
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
  const filters = [['all','All'],['safety','Safety'],['resolved','Resolved']];
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
  const counts = { all: rs.length, prog: rs.filter((r) => ['routed','acknowledged','in_progress'].includes(r.status)).length, fixed: rs.filter((r) => r.status === 'resolved').length };
  const cards = rs.map((r, i) => ReportCard(r, i === 0)).join('');
  return `
  <div class="stack" style="gap:3px"><h1>My work orders</h1><span class="muted">Every report becomes a work order with a status. You'll know what happened.</span></div>
  ${rs.length ? campusMap({ pins: rs.filter((r) => r.building).map((r) => ({ building: r.building, tone: toneFor(r.status), label: `${r.title}, ${REPORT_STATUS[r.status]}` })), height: 170 }) : ''}
  <div class="stats">
    <div class="stat"><b class="num">${counts.all}</b><span>Submitted</span></div>
    <div class="stat"><b class="num" style="color:var(--gold-text)">${counts.prog}</b><span>In progress</span></div>
    <div class="stat"><b class="num" style="color:var(--green)">${counts.fixed}</b><span>Fixed</span></div>
  </div>
  ${rs.length ? `<div class="stack">${cards}</div>` : `<div class="card pad stack" style="align-items:center;text-align:center;padding:28px 16px"><b>Nothing reported yet</b><span class="muted">Type, say, or snap something on the Home tab. It shows up here with a live status.</span><button class="btn primary" data-go="home">Report something</button></div>`}`;
}

function ReportCard(r, open) {
  const t = typeById(r.type), b = bldgById(r.building), dept = deptById(r.dept);
  const tone = toneFor(r.status);
  const order = ['submitted','routed','acknowledged','resolved'];
  const have = r.events.map((e) => e.status === 'in_progress' ? 'acknowledged' : e.status);
  const idx = Math.max(...order.map((s, i) => have.includes(s) ? i : -1));
  const tl = order.map((s, i) => {
    const ev = r.events.find((e) => (e.status === 'in_progress' ? 'acknowledged' : e.status) === s);
    const cls = i < idx ? 'done' : i === idx ? (s === 'resolved' ? 'done' : 'now') : 'todo';
    const label = s === 'routed' ? `Routed to ${esc(dept.name)}` : s === 'acknowledged' ? (ev && /assigned|ordered|scheduled/i.test(ev.note) ? 'Technician assigned' : 'Acknowledged') : REPORT_STATUS[s];
    const sub = ev ? `${fmtTime(ev.at)}${ev.note ? ' · ' + esc(ev.note) : ''}` : (s === 'resolved' ? "We'll notify you" : 'Pending');
    return `<div class="tl ${cls}"><div class="rail"><span class="node ${cls}">${cls === 'done' ? ICONS.check : ''}</span>${i < order.length - 1 ? `<span class="line ${i < idx ? 'done' : ''}"></span>` : ''}</div><div class="body"><b>${label}</b><span>${sub}</span></div></div>`;
  }).join('');
  return `
  <article class="card pad stack" style="gap:14px">
    <button class="row" data-toggle="${r.id}" style="all:unset;cursor:pointer;display:flex;align-items:flex-start;gap:12px;width:100%">
      <span class="ico ${tone}">${iconFor(r.type)}</span>
      <span class="grow"><div style="font-size:15px;font-weight:700">${esc(r.title)}</div><div class="muted small">${esc(b ? b.name : 'Campus')}${r.detail ? ' · ' + esc(r.detail) : ''} · ${r.id}${r.coDept ? ' · ' + esc(deptById(r.coDept).short) + ' notified' : ''}</div></span>
      <span class="pill ${tone}">${esc(REPORT_STATUS[r.status])}</span>
    </button>
    <div class="timeline" ${open || r.open ? '' : 'hidden'}>${tl}</div>
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
  const c = classify(text);
  state.draft = { text, source, type: c.type, building: c.building, autoBuilding: !!c.building, detail: c.detail, severity: c.severity, confident: c.confident, photo: null, ...extra };
  go('review');
}

function submitReport() {
  const d = state.draft;
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
  const msg = `Work order ${id} opened with ${dept.short}${co ? ' and ' + co.short : ''}`;
  toast(msg); speak(msg + '. It is now in My reports.');
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
      <div class="row" style="gap:8px">
        <select class="field" id="np-cat"><option>Safety</option><option>Tech</option><option>Policy</option><option>Facilities</option><option>Other</option></select>
        <select class="field" id="np-bldg"><option value="">Location</option>${BUILDINGS.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>
      </div>
      <button class="btn primary big" type="submit">Post</button>
    </form>`);
  $('#post-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const cat = $('#np-cat').value;
    const dept = cat === 'Safety' ? 'upd' : cat === 'Tech' ? 'it' : cat === 'Policy' ? 'library' : 'fdo';
    const id = 'p' + Date.now();
    state.posts.unshift({ id, title: $('#np-title').value.trim(), body: $('#np-body').value.trim(), category: cat, building: $('#np-bldg').value || null, up: 1, down: 0, comments: 0, at: new Date().toISOString(), dept, status: 'collecting', updates: [] });
    state.votes[id] = 'up';
    save(); closeSheet(); state.sort = 'recent'; render(); toast('Posted. Collecting support.');
  });
}

// voice: this runs inside a sandbox that refuses the microphone, so the demo transcribes a sample.
let holdTimer = null;
function voiceStart(btn) {
  btn.classList.add('listening');
  $('.t', btn).textContent = 'Listening…';
  $('.s', btn).textContent = 'Release to send';
  holdTimer = Date.now();
}
function voiceEnd(btn) {
  if (!btn.classList.contains('listening')) return;
  btn.classList.remove('listening');
  const held = (Date.now() - holdTimer) / 1000;
  $('.t', btn).textContent = 'Hold to talk';
  $('.s', btn).textContent = "Say what's wrong and where. We transcribe and route it.";
  if (held < 0.4) { toast('Hold the button while you talk'); return; }
  const samples = [
    'The elevator in Clark Hall is out again, second floor',
    'None of the outlets on the 6th floor of the library work',
    'Printer on the first floor of Engineering has no toner',
  ];
  const text = samples[Math.floor(Math.random() * samples.length)];
  startDraft(text, 'voice', { seconds: Math.max(3, Math.round(held)) });
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
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!ta.value.trim()) return; startDraft(ta.value.trim(), 'text', { seconds: started.t ? Math.round((Date.now() - started.t) / 1000) : 10 }); });
  }

  const v = $('#voice-btn');
  if (v) {
    const start = (e) => { e.preventDefault(); voiceStart(v); };
    const end = (e) => { e.preventDefault(); voiceEnd(v); };
    v.addEventListener('pointerdown', start);
    v.addEventListener('pointerup', end);
    v.addEventListener('pointerleave', end);
    v.addEventListener('pointercancel', end);
    v.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!v.classList.contains('listening')) voiceStart(v); } });
    v.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); voiceEnd(v); } });
  }

  el.querySelectorAll('[data-act="near"]').forEach((b) => b.addEventListener('click', () => {
    const c = SEED_CLUSTERS.find((x) => x.id === b.dataset.id);
    startDraft(`${clusterTitle(c)} at ${bldgById(c.building).name}`, 'text', { type: c.type, building: c.building, detail: c.detail, autoBuilding: true, confident: true, severity: typeById(c.type).severity });
  }));

  el.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { state.draft.type = b.dataset.type; state.draft.severity = typeById(b.dataset.type).severity; render(); }));
  const bldg = $('#bldg');
  if (bldg) bldg.addEventListener('change', () => { state.draft.building = bldg.value || null; state.draft.autoBuilding = false; render(); });
  const det = $('#detail');
  if (det) det.addEventListener('input', () => { state.draft.detail = det.value; });
  el.querySelectorAll('[data-act="retake"]').forEach((b) => b.addEventListener('click', () => $('#photo-input').click()));
  const sub = $('#submit-report');
  if (sub) sub.addEventListener('click', submitReport);

  el.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { state.sort = b.dataset.sort; render(); }));
  el.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; render(); }));
  el.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => vote(b.dataset.id, b.dataset.vote)));
  el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { state.openPost = b.dataset.open; go('post'); }));
  el.querySelectorAll('[data-act="verify"]').forEach((b) => b.addEventListener('click', () => openVerify()));
  el.querySelectorAll('[data-act="newpost"]').forEach((b) => b.addEventListener('click', openNewPost));
  el.querySelectorAll('[data-act="notif"]').forEach((b) => b.addEventListener('click', () => toast(state.reports.length ? `${state.reports.length} work order${state.reports.length > 1 ? 's' : ''} being tracked` : 'No updates yet')));
  el.querySelectorAll('[data-act="speak"]').forEach((b) => b.addEventListener('click', () => {
    speech.on = !speech.on; render();
    if (speech.on) speak('Spoken mode on. Home. Describe the issue in the text box, hold the talk button, or tap Snap at the bottom to take a photo.');
    else toast('Spoken mode off');
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

document.querySelectorAll('.tabbar .tab').forEach((t) => t.addEventListener('click', () => {
  const v = t.dataset.go;
  if (v === 'snap') { state.draft = { text: '', source: 'photo', type: 'other', building: null, autoBuilding: false, detail: '', severity: 'low', confident: false, photo: null }; $('#photo-input').click(); go('review'); return; }
  go(v);
}));

$('#photo-input').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { if (!state.draft) state.draft = { text: '', source: 'photo', type: 'other', building: null, detail: '', severity: 'low', confident: false }; state.draft.photo = r.result; state.draft.source = 'photo'; render(); };
  r.readAsDataURL(f);
  e.target.value = '';
});

load();
render();
