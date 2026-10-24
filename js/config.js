// Map settings. The Google Maps key below is restricted to https://juanmosqueda-sys.github.io/* in Google Cloud,
// so it only works on the live site. For local development, put an unrestricted dev key in js/config.local.js (gitignored).
const CONFIG = {
  GOOGLE_MAPS_KEY: (typeof CONFIG_LOCAL !== 'undefined' && CONFIG_LOCAL.GOOGLE_MAPS_KEY) || 'AIzaSyDQZ0VcKSeLPiEuI-Mmyhkc50CB0wCXlvg',
  MAP_PROVIDER: 'auto',   // 'auto' | 'google' | 'osm' | 'schematic'
  AI: true,               // Gemini triage. The key is NOT stored here: enter it on the device via hold-the-seal → Demo options.
  GEMINI_KEY: '',         // leave empty in the repo; a local dev key can go in js/config.local.js (gitignored)
};
