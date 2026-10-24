// Campus map: Google Maps photorealistic 3D (needs CONFIG.GOOGLE_MAPS_KEY), else OpenStreetMap 2D via Leaflet, else the schematic.
// Alerts are drawn as waypoint markers colored by status. Tapping the map on the review screen picks the nearest building.

const MapKit = (() => {
  const TONE_COLORS = { gold: '#E5A823', blue: '#0055A2', green: '#1B7F4C', red: '#9A2E0D', neutral: '#8A94A6', sel: '#E5A823' };
  let provider = null;        // 'google' | 'osm' | 'schematic'
  let loading = null;

  function pick() {
    const want = (typeof CONFIG !== 'undefined' && CONFIG.MAP_PROVIDER) || 'auto';
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
          await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.GOOGLE_MAPS_KEY)}&v=beta&libraries=maps3d,marker`);
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
    const map = new Map3DElement({ center, range: sel ? 420 : 760, tilt: 67, heading: 25, mode: 'HYBRID', defaultUIDisabled: true });
    map.style.width = '100%'; map.style.height = height + 'px';
    host.replaceChildren(map);

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

  // Mount every .map-host in the current view. Called after render().
  async function mountAll(onPick) {
    const hosts = document.querySelectorAll('.map-host');
    if (!hosts.length) return;
    const p = await ensure();
    for (const host of hosts) {
      const opts = JSON.parse(host.dataset.map || '{}');
      opts.onPick = onPick; opts.height = opts.height || 220;
      if (p === 'schematic') { host.outerHTML = campusMap(opts); continue; }
      try {
        if (p === 'google') await mountGoogle(host, opts); else mountOsm(host, opts);
        host.dataset.provider = p;
      } catch (e) { console.warn('map mount failed', e); host.outerHTML = campusMap(opts); }
    }
  }

  const providerLabel = () => ({ google: 'Google Maps 3D', osm: 'OpenStreetMap', schematic: 'Schematic' }[provider] || '');
  return { mountAll, providerLabel, ensure };
})();

// Placeholder the view renders; MapKit.mountAll() replaces it with the live map.
function mapHost(opts) {
  const json = JSON.stringify(opts).replace(/'/g, '&#39;');
  return `<div class="map-host" data-map='${json}' style="height:${opts.height || 220}px" role="region" aria-label="SJSU campus map"><span class="map-loading">Loading map…</span></div>`;
}
