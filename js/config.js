// Map settings. The Google Maps key below is restricted to https://juanmosqueda-sys.github.io/* in Google Cloud,
// so it only works on the live site. For local development, put an unrestricted dev key in js/config.local.js (gitignored).
const CONFIG = {
  GOOGLE_MAPS_KEY: (typeof CONFIG_LOCAL !== 'undefined' && CONFIG_LOCAL.GOOGLE_MAPS_KEY) || 'AIzaSyDQZ0VcKSeLPiEuI-Mmyhkc50CB0wCXlvg',
  MAP_PROVIDER: 'auto',   // 'auto' | 'google' | 'osm' | 'schematic'
};
