// Seed data and routing tables. Everything here is sample data for the demo.

const DEPARTMENTS = {
  fdo:     { id: 'fdo',     name: 'Facilities Development & Operations', short: 'Facilities' },
  it:      { id: 'it',      name: 'IT Services',                          short: 'IT Services' },
  library: { id: 'library', name: 'University Library',                   short: 'Library' },
  upd:     { id: 'upd',     name: 'University Police & Parking',          short: 'UPD & Parking' },
  housing: { id: 'housing', name: 'University Housing',                   short: 'Housing' },
};

// issue type -> department, severity, label, keywords
const ISSUE_TYPES = [
  { id: 'elevator', label: 'Elevator',   dept: 'fdo',     severity: 'high',   kw: ['elevator', 'lift'] },
  { id: 'door',     label: 'Door',       dept: 'fdo',     severity: 'medium', kw: ['door', 'automatic door', 'handle', 'lock'] },
  { id: 'outlet',   label: 'Outlet',     dept: 'fdo',     severity: 'medium', kw: ['outlet', 'socket', 'plug', 'charger', 'power'] },
  { id: 'hvac',     label: 'AC / Heat',  dept: 'fdo',     severity: 'medium', kw: ['ac ', 'a/c', 'air conditioning', 'heat', 'cold', 'hot', 'hvac', 'thermostat'] },
  { id: 'lighting', label: 'Lighting',   dept: 'fdo',     severity: 'high',   kw: ['light', 'lamp', 'dark', 'bulb'] },
  { id: 'plumbing', label: 'Plumbing',   dept: 'fdo',     severity: 'medium', kw: ['faucet', 'sink', 'leak', 'flood', 'toilet', 'water', 'shower', 'fountain'] },
  { id: 'trash',    label: 'Trash',      dept: 'fdo',     severity: 'low',    kw: ['trash', 'garbage', 'overflow', 'bin', 'recycling'] },
  { id: 'wifi',     label: 'Wi‑Fi',      dept: 'it',      severity: 'medium', kw: ['wifi', 'wi-fi', 'wi‑fi', 'internet', 'eduroam', 'network', 'connection'] },
  { id: 'printer',  label: 'Printer',    dept: 'it',      severity: 'medium', kw: ['printer', 'print', 'toner', 'ink'] },
  { id: 'website',  label: 'Website',    dept: 'it',      severity: 'medium', kw: ['website', 'site', 'canvas', 'portal', 'login', 'page', 'booking'] },
  { id: 'safety',   label: 'Safety',     dept: 'upd',     severity: 'high',   kw: ['scooter', 'bike', 'unsafe', 'safety', 'hit', 'accident', 'harass', 'suspicious', 'emergency phone'] },
  { id: 'dorm',     label: 'Dorm',       dept: 'housing', severity: 'medium', kw: ['dorm', 'cvb', 'campus village', 'roommate', 'laundry', 'hot water'] },
  { id: 'other',    label: 'Other',      dept: 'fdo',     severity: 'low',    kw: [] },
];

const BUILDINGS = [
  { id: 'cb2',  name: 'Clark Hall (CB2)',          kw: ['clark', 'cb2', 'cb 2'] },
  { id: 'mlk',  name: 'MLK Library',               kw: ['mlk', 'library', 'king library'] },
  { id: 'eng',  name: 'Engineering Building',      kw: ['engineering', 'eng building', 'eng '] },
  { id: 'art',  name: 'Art Building',              kw: ['art building', 'art '] },
  { id: 'wsq',  name: 'Washburn Hall',             kw: ['washburn'] },
  { id: 'su',   name: 'Student Union',             kw: ['student union', 'union'] },
  { id: 'dh',   name: 'Duncan Hall',               kw: ['duncan'] },
  { id: 'dmh',  name: 'Dudley Moorhead Hall',      kw: ['dudley', 'dmh', 'moorhead'] },
  { id: 'sh',   name: 'Sweeney Hall',              kw: ['sweeney'] },
  { id: 'spx',  name: 'Spartan Complex (SPX)',     kw: ['spx', 'spartan complex'] },
  { id: 'cv',   name: 'Campus Village',            kw: ['campus village', 'cvb', 'cva', 'cvc'] },
  { id: 'paseo',name: 'Paseo de San Carlos',       kw: ['paseo', 'san carlos'] },
  { id: 'sci',  name: 'Science Building',          kw: ['science building', 'science '] },
];

// Open clusters: existing reports other students already filed.
const SEED_CLUSTERS = [
  { id: 'c1', type: 'elevator', building: 'cb2', detail: 'east elevator', count: 11, first: '2026-09-30', last: hoursAgo(2),
    status: 'in_progress', dept: 'fdo',
    events: [
      { status: 'routed',       at: hoursAgo(2),  note: 'Merged with 11 matching reports' },
      { status: 'acknowledged', at: hoursAgo(1),  note: 'FD&O: "Parts ordered, est. 2–3 days"' },
    ] },
  { id: 'c2', type: 'outlet', building: 'mlk', detail: '6th floor study tables', count: 8, first: '2026-10-12', last: hoursAgo(26),
    status: 'routed', dept: 'fdo',
    events: [ { status: 'routed', at: hoursAgo(26), note: 'Merged with 8 matching reports' } ] },
  { id: 'c3', type: 'printer', building: 'eng', detail: 'first-floor print station', count: 7, first: '2026-09-02', last: daysAgo(3),
    status: 'resolved', dept: 'it',
    events: [
      { status: 'routed',       at: daysAgo(4), note: 'Merged with 7 matching reports' },
      { status: 'acknowledged', at: daysAgo(4), note: 'IT: "Toner delivery scheduled"' },
      { status: 'resolved',     at: daysAgo(3), note: 'IT: "All three printers restocked"' },
    ] },
  { id: 'c4', type: 'wifi', building: 'art', detail: 'studios, 2nd floor', count: 4, first: '2026-10-08', last: daysAgo(1),
    status: 'routed', dept: 'it',
    events: [ { status: 'routed', at: daysAgo(1), note: 'Merged with 4 matching reports' } ] },
];

const VOTE_THRESHOLD = 100;

const SEED_POSTS = [
  { id: 'p1', title: 'Scooters on the Paseo are causing near-misses',
    body: 'Almost got hit twice this week between the library and Student Union. Nobody slows down for the crosswalk.',
    category: 'Safety', building: 'paseo', up: 142, down: 6, comments: 38, at: hoursAgo(2), dept: 'upd',
    status: 'response', // collecting | review | response | resolved
    updates: [
      { by: 'University Police & Parking', at: hoursAgo(1), text: 'We’ve received this. Parking Services is reviewing a 5 mph zone for the Paseo between 7th and 9th. Update by Friday.' },
    ] },
  { id: 'p2', title: 'Wi‑Fi drops every few minutes in the Art Building',
    body: 'Can’t upload anything from the studios. It’s been like this all semester.',
    category: 'Tech', building: 'art', up: 58, down: 2, comments: 12, at: daysAgo(1), dept: 'it',
    status: 'collecting', updates: [] },
  { id: 'p3', title: 'No quiet study space open after 10 PM during midterms',
    body: 'MLK closes the upper floors at 10. Everyone ends up on the ground floor and it’s loud.',
    category: 'Policy', building: 'mlk', up: 31, down: 9, comments: 6, at: daysAgo(2), dept: 'library',
    status: 'collecting', updates: [] },
  { id: 'p4', title: 'MLK Library website down for room bookings',
    body: 'Booking page 500s every time. Had to walk up and ask at the desk.',
    category: 'Tech', building: 'mlk', up: 104, down: 1, comments: 6, at: daysAgo(5), dept: 'library',
    status: 'resolved',
    updates: [
      { by: 'University Library', at: daysAgo(3), text: 'Booking service restored. Root cause was an expired certificate on the reservations server.' },
    ] },
];

const POST_STATUS = {
  collecting: { label: 'Collecting support', tone: 'neutral' },
  review:     { label: 'Under campus review', tone: 'blue' },
  response:   { label: 'Response received',  tone: 'gold' },
  resolved:   { label: 'Resolved',           tone: 'green' },
};

const REPORT_STATUS = {
  submitted:    'Submitted',
  routed:       'Routed',
  acknowledged: 'Acknowledged',
  in_progress:  'In progress',
  resolved:     'Fixed',
};

function hoursAgo(h) { return new Date(Date.now() - h * 3600e3).toISOString(); }
function daysAgo(d)  { return hoursAgo(d * 24); }
