// Map settings. Put your Google Maps key in js/config.local.js (gitignored), never here.
// Enable "Maps JavaScript API" on the key. Without a key the app falls back to a 2D OpenStreetMap view.
const CONFIG = {
  GOOGLE_MAPS_KEY: (typeof CONFIG_LOCAL !== 'undefined' && CONFIG_LOCAL.GOOGLE_MAPS_KEY) || '',
  MAP_PROVIDER: 'auto',   // 'auto' | 'google' | 'osm' | 'schematic'
};
