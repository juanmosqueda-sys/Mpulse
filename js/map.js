// Campus map: Google Maps photorealistic 3D (needs CONFIG.GOOGLE_MAPS_KEY), else OpenStreetMap 2D via Leaflet, else the schematic.
// Alerts are drawn as waypoint markers colored by status. Tapping the map on the review screen picks the nearest building.

const MapKit = (() => {
  const TONE_COLORS = { gold: '#E5A823', blue: '#0055A2', green: '#1B7F4C', red: '#9A2E0D', neutral: '#8A94A6', sel: '#E5A823' };
  let provider = null;        // 'google' | 'osm' | 'schematic'
  let loading = null;

  function pick() {
    let want = (typeof CONFIG !== 'undefined' && CONFIG.MAP_PROVIDER) || 'auto';
    try { const o = localStorage.getItem('eaiser-map'); if (o === 'osm' || o === 'google') want = o; } catch (e) { /* ignore */ }
    if (want !== 'auto') return want;
    return (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_MAPS_KEY) ? 'google' : 'osm';
  }

  function loadScript(src, attrs = {}) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; Object.assign(s, attrs);
      s.onload = res; s.onerror = () => rej(new Error('failed ' + src));
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }

  async function ensure() {
    if (provider) return provider;
    if (loading) return loading;
    loading = (async () => {
      const want = pick();
      if (want === 'google') {
        try {
          await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.GOOGLE_MAPS_KEY)}&v=beta&libraries=maps3d,marker&loading=async`);
          for (let i = 0; i < 100 && !(window.google && google.maps && google.maps.importLibrary); i++) await new Promise((r) => setTimeout(r, 50));
          if (!(window.google && google.maps && google.maps.importLibrary)) throw new Error('google.maps did not initialize');
          await google.maps.importLibrary('maps3d');
          provider = 'google'; return provider;
        } catch (e) { console.warn('Google Maps unavailable, falling back to OpenStreetMap', e); }
      }
      if (want === 'google' || want === 'osm') {
        try {
          loadCss('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js');
          provider = 'osm'; return provider;
        } catch (e) { console.warn('Leaflet unavailable, using schematic', e); }
      }
      provider = 'schematic'; return provider;
    })();
    return loading;
  }

  function nearestBuilding(lat, lng) {
    let best = null, bd = Infinity;
    for (const b of BUILDINGS) {
      const d = Math.hypot((b.lat - lat) * 111320, (b.lng - lng) * 111320 * Math.cos(lat * Math.PI / 180));
      if (d < bd) { bd = d; best = b; }
    }
    return bd < 140 ? best : null;
  }

  // ----- Google photorealistic 3D -----
  async function mountGoogle(host, { selected, pins, interactive, onPick, height }) {
    const { Map3DElement, Marker3DInteractiveElement, Marker3DElement } = await google.maps.importLibrary('maps3d');
    const { PinElement } = await google.maps.importLibrary('marker');
    const sel = selected ? BUILDINGS.find((b) => b.id === selected) : null;
    const center = sel ? { lat: sel.lat, lng: sel.lng, altitude: 0 } : { ...CAMPUS_CENTER, altitude: 0 };
    const map = new Map3DElement({ center, range: sel ? 420 : 760, tilt: 67, heading: 25, mode: 'HYBRID', defaultUIHidden: true });
    map.style.width = '100%'; map.style.height = height + 'px';
    host.replaceChildren(map);
    // Fall back to 2D only if the 3D map shows no life at all for 30 s (no steady/center events and no tiles drawn).
    let alive = false;
    ['gmp-steadychange', 'gmp-centerchange', 'gmp-rangechange', 'gmp-headingchange'].forEach((ev) => map.addEventListener(ev, () => { alive = true; }));
    setTimeout(async () => {
      if (!host.isConnected) return;
      const canvas = map.shadowRoot && map.shadowRoot.querySelector('canvas');
      if (alive || (canvas && canvas.width > 0)) return;
      console.warn('3D map showed no activity in 30 s; falling back to OpenStreetMap');
      try {
        loadCss('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
        if (!window.L) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js');
        mountOsm(host, { selected, pins, interactive, onPick, height }); host.dataset.provider = 'osm';
      } catch (err) { host.outerHTML = campusMap({ selected, pins, interactive, height }); }
    }, 30000);

    const addMarker = (b, color, label, big) => {
      const m = new (interactive ? Marker3DInteractiveElement : Marker3DElement)({
        position: { lat: b.lat, lng: b.lng, altitude: big ? 18 : 10 }, altitudeMode: 'RELATIVE_TO_MESH', extruded: true, label,
      });
      try { m.append(new PinElement({ background: color, borderColor: '#14213D', glyphColor: '#14213D', scale: big ? 1.4 : 1.05 })); } catch (e) { /* older API */ }
      if (interactive) m.addEventListener('gmp-click', () => onPick && onPick(b.id));
      map.append(m);
    };
    for (const p of pins) {
      const b = BUILDINGS.find((x) => x.id === p.building); if (!b) continue;
      addMarker(b, TONE_COLORS[p.tone] || TONE_COLORS.neutral, p.label, false);
    }
    if (sel) addMarker(sel, TONE_COLORS.sel, sel.name, true);
    if (interactive) {
      map.addEventListener('gmp-click', (e) => {
        const pos = e.position; if (!pos) return;
        const b = nearestBuilding(pos.lat, pos.lng);
        if (b && onPick) onPick(b.id);
      });
    }
  }

  // ----- OpenStreetMap 2D (Leaflet) -----
  function mountOsm(host, { selected, pins, interactive, onPick, height }) {
    host.style.height = height + 'px';
    host.replaceChildren();
    const sel = selected ? BUILDINGS.find((b) => b.id === selected) : null;
    const map = L.map(host, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, tap: true })
      .setView(sel ? [sel.lat, sel.lng] : [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], sel ? 18 : 17);
    host._leaflet_map = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    const dot = (b, color, label, big) => {
      const m = L.circleMarker([b.lat, b.lng], { radius: big ? 11 : 8, color: '#14213D', weight: 2, fillColor: color, fillOpacity: 0.95 }).addTo(map);
      m.bindTooltip(label, { direction: 'top', offset: [0, -8] });
      if (interactive) m.on('click', () => onPick && onPick(b.id));
    };
    for (const p of pins) { const b = BUILDINGS.find((x) => x.id === p.building); if (b) dot(b, TONE_COLORS[p.tone] || TONE_COLORS.neutral, p.label, false); }
    if (sel) dot(sel, TONE_COLORS.sel, sel.name, true);
    if (interactive) map.on('click', (e) => { const b = nearestBuilding(e.latlng.lat, e.latlng.lng); if (b && onPick) onPick(b.id); });
    setTimeout(() => map.invalidateSize(), 50);
  }

  // Live map hosts are detached before a redraw and re-attached if the new view asks for the same map,
  // so a re-render (e.g. the AI answer arriving) doesn't rebuild the 3D map and re-download its tiles.
  const kept = new Map();
  const sig = (host) => host.dataset.map || '';
  function preserve(root) {
    root.querySelectorAll('.map-host[data-provider]').forEach((h) => { kept.set(sig(h), h); h.remove(); });
  }

  // Mount every .map-host in the current view. Called after render().
  async function mountAll(onPick) {
    const hosts = document.querySelectorAll('.map-host');
    if (!hosts.length) { kept.clear(); return; }
    const p = await ensure();
    for (const host of hosts) {
      const k = kept.get(sig(host));
      if (k && k.dataset.provider === p && host.isConnected) {
        host.replaceWith(k); kept.delete(sig(host));
        if (p === 'osm' && k._leaflet_map) setTimeout(() => k._leaflet_map.invalidateSize(), 50);
        continue;
      }
      const opts = JSON.parse(host.dataset.map || '{}');
      opts.onPick = onPick; opts.height = opts.height || 220;
      if (p === 'schematic') { host.outerHTML = campusMap(opts); continue; }
      try {
        if (p === 'google') await mountGoogle(host, opts); else mountOsm(host, opts);
        host.dataset.provider = p;
        if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_MAPS_KEY) {
          const t = document.createElement('button');
          t.className = 'map-toggle'; t.type = 'button'; t.textContent = p === 'google' ? '2D' : '3D'; t.setAttribute('aria-label', p === 'google' ? 'Switch to 2D map' : 'Switch to 3D map');
          t.addEventListener('click', () => { setProvider(p === 'google' ? 'osm' : 'google'); if (typeof render === 'function') render(); });
          host.appendChild(t);
        }
      } catch (e) { console.warn('map mount failed', e); host.outerHTML = campusMap(opts); }
    }
    kept.clear();
  }

  const providerLabel = () => ({ google: 'Google Maps 3D', osm: 'OpenStreetMap', schematic: 'Schematic' }[provider] || '');
  function setProvider(p) { try { localStorage.setItem('eaiser-map', p); } catch (e) { /* ignore */ } provider = null; loading = null; }
  const current = () => provider;
  return { mountAll, preserve, providerLabel, ensure, setProvider, current };
})();

// Placeholder the view renders; MapKit.mountAll() replaces it with the live map.
function mapHost(opts) {
  const json = JSON.stringify(opts).replace(/'/g, '&#39;');
  return `<div class="map-host" data-map='${json}' style="height:${opts.height || 220}px" role="region" aria-label="SJSU campus map"><span class="map-loading">Loading map…</span></div>`;
}
