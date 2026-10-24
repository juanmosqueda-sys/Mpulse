// Seed data and routing tables. Everything here is sample data for the demo.

const DEPARTMENTS = {
  fdo:     { id: 'fdo',     name: 'Facilities Development & Operations', short: 'Facilities' },
  it:      { id: 'it',      name: 'IT Services',                          short: 'IT' },
  library: { id: 'library', name: 'University Library',                   short: 'Library' },
  upd:     { id: 'upd',     name: 'University Police (Safety)',           short: 'Safety' },
  access:  { id: 'access',  name: 'Accessible Education Center',          short: 'Accessibility' },
  housing: { id: 'housing', name: 'University Housing',                   short: 'Housing' },
};

// issue type -> department, severity, label, keywords. coDept = also notified (accessibility-blocking issues).
const ISSUE_TYPES = [
  { id: 'elevator', label: 'Elevator',   dept: 'fdo',     coDept: 'access', severity: 'high',   kw: ['elevator', 'lift'] },
  { id: 'door',     label: 'Door',       dept: 'fdo',     coDept: 'access', severity: 'medium', kw: ['door', 'automatic door', 'handle', 'lock'] },
  { id: 'ramp',     label: 'Ramp / Path', dept: 'fdo',    coDept: 'access', severity: 'high',   kw: ['ramp', 'wheelchair', 'curb', 'sidewalk', 'crack', 'trip', 'stairs', 'handrail', 'accessible'] },
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

// lat/lng from the Google Geocoding API (Oct 23, 2026). dmh, spx and cv were not resolvable and are placed by hand from the campus map; confirm those three.
// x,y,w,h: position on the schematic fallback map (0–100).
const CAMPUS_CENTER = { lat: 37.3352, lng: -121.8811 };
const BUILDINGS = [
  { id: 'mlk',  name: 'MLK Library',               abbr: 'MLK', lat: 37.335431, lng: -121.884701, x: 10, y: 12, w: 16, h: 14, kw: ['mlk', 'library', 'king library'] },
  { id: 'dmh',  name: 'Dudley Moorhead Hall (DMH/IRC)', abbr: 'DMH', lat: 37.336355, lng: -121.883938, x: 10, y: 32, w: 14, h: 10, kw: ['dudley', 'dmh', 'moorhead', 'irc', 'instructional resource'] },
  { id: 'cb2',  name: 'Clark Hall (CB2)',          abbr: 'CL',  lat: 37.335915, lng: -121.882547, x: 12, y: 50, w: 13, h: 12, kw: ['clark', 'cb2', 'cb 2'] },
  { id: 'dh',   name: 'Duncan Hall',               abbr: 'DH',  lat: 37.332572, lng: -121.882062, x: 12, y: 74, w: 16, h: 12, kw: ['duncan'] },
  { id: 'sci',  name: 'Science Building (Old)',    abbr: 'SCI', lat: 37.334956, lng: -121.884954, x: 30, y: 36, w: 12, h: 10, kw: ['science building', 'science '] },
  { id: 'sh',   name: 'Sweeney Hall',              abbr: 'SH',  lat: 37.333766, lng: -121.881048, x: 32, y: 58, w: 12, h: 10, kw: ['sweeney'] },
  { id: 'su',   name: 'Student Union',             abbr: 'SU',  lat: 37.336128, lng: -121.881477, x: 48, y: 28, w: 16, h: 14, kw: ['student union', 'union'] },
  { id: 'eng',  name: 'Engineering Building',      abbr: 'ENG', lat: 37.336825, lng: -121.881132, x: 68, y: 10, w: 18, h: 16, kw: ['engineering', 'eng building', 'eng '] },
  { id: 'art',  name: 'Art Building',              abbr: 'ART', lat: 37.335949, lng: -121.879799, x: 52, y: 66, w: 14, h: 12, kw: ['art building', 'art '] },
  { id: 'spx',  name: 'Spartan Complex (SPX)',     abbr: 'SPX', lat: 37.334253, lng: -121.882179, x: 30, y: 84, w: 22, h: 10, kw: ['spx', 'spartan complex'] },
  { id: 'wsq',  name: 'Washington Square Hall',    abbr: 'WSQ', lat: 37.334277, lng: -121.884026, x: 14, y: 58, w: 12, h: 10, kw: ['washington square', 'wsq'] },
  { id: 'wsh',  name: 'Washburn Hall',             abbr: 'WSH', lat: 37.333733, lng: -121.879434, x: 80, y: 52, w: 12, h: 10, kw: ['washburn', 'wsh'] },
  { id: 'cva',  name: 'Campus Village A',          abbr: 'CVA', lat: 37.335462, lng: -121.878263, x: 72, y: 72, w: 20, h: 18, kw: ['campus village a', 'cva', 'campus village'] },
  { id: 'hgh',  name: 'Hugh Gillis Hall',           abbr: 'HGH', lat: 37.336064, lng: -121.884561, x: 22, y: 20, w: 10, h: 8, kw: ['hugh gillis', 'hgh'] },
  { id: 'yuh',  name: 'Yoshihiro Uchida Hall',      abbr: 'YUH', lat: 37.333807, lng: -121.883971, x: 10, y: 62, w: 12, h: 8, kw: ['uchida', 'yuh'] },
  { id: 'bbc',  name: 'Boccardo Business Complex',  abbr: 'BBC', lat: 37.336442, lng: -121.878869, x: 76, y: 30, w: 14, h: 10, kw: ['boccardo', 'bbc', 'business'] },
  { id: 'its',  name: 'Interdisciplinary Sciences', abbr: 'ISB', lat: 37.333093, lng: -121.882841, x: 24, y: 64, w: 10, h: 8, kw: ['interdisciplinary', 'isb'] },
  { id: 'swc',  name: 'Student Wellness Center',    abbr: 'SWC', lat: 37.334711, lng: -121.881280, x: 60, y: 44, w: 10, h: 8, kw: ['wellness', 'health center', 'swc', 'counseling'] },
  { id: 'ec',   name: 'Event Center',               abbr: 'EC',  lat: 37.335219, lng: -121.880100, x: 60, y: 50, w: 12, h: 8, kw: ['event center'] },
  { id: 'tower',name: 'Tower Hall',                 abbr: 'TH',  lat: 37.335294, lng: -121.883469, x: 20, y: 40, w: 8, h: 8, kw: ['tower hall', 'tower'] },
  { id: 'admin',name: 'Administration Building',   abbr: 'ADM', lat: 37.336665, lng: -121.882837, x: 26, y: 28, w: 10, h: 8, kw: ['admin', 'administration', 'registrar', 'bursar', 'financial aid'] },
  { id: 'wpg',  name: 'West Parking Garage',       abbr: 'WPG', lat: 37.332521, lng: -121.883024, x: 6, y: 84, w: 12, h: 10, kw: ['west garage', 'west parking', 'wpg', 'parking garage'] },
  { id: 'mh',   name: 'MacQuarrie Hall',           abbr: 'MH',  lat: 37.333546, lng: -121.881835, x: 40, y: 62, w: 10, h: 8, kw: ['macquarrie', 'mh ', 'cs department'] },
  { id: 'spg',  name: 'South Parking Garage',      abbr: 'SPG', lat: 37.332822, lng: -121.881015, x: 44, y: 76, w: 16, h: 10, kw: ['south garage', 'south parking', 'spg'] },
  { id: 'srac', name: 'Spartan Recreation & Aquatic Center', abbr: 'SRAC', lat: 37.334390, lng: -121.880120, x: 62, y: 60, w: 14, h: 10, kw: ['srac', 'rec center', 'recreation', 'aquatic', 'gym', 'pool'] },
  { id: 'dc',   name: 'Dining Commons',            abbr: 'DC',  lat: 37.334067, lng: -121.878512, x: 74, y: 60, w: 10, h: 8, kw: ['dining commons', 'dining hall', 'cafeteria', ' dc '] },
  { id: 'jwh',  name: 'Joe West Hall',             abbr: 'JWH', lat: 37.334443, lng: -121.878152, x: 84, y: 60, w: 8, h: 10, kw: ['joe west', 'jwh'] },
  { id: 'cvb',  name: 'Campus Village B',          abbr: 'CVB', lat: 37.335089, lng: -121.877642, x: 86, y: 70, w: 8, h: 8, kw: ['campus village b', 'cvb'] },
  { id: 'paseo',name: 'Paseo de San Carlos',       abbr: 'Paseo', lat: 37.334435, lng: -121.880655, x: 36, y: 48, w: 40, h: 5, path: true, kw: ['paseo', 'san carlos'] },
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
