// public/js/mars.js - Developed by Abdulwahab Almusailem

// -------------------- Map init (EQ 0–360) --------------------
const map = L.map('map', { center: [0, 180], zoom: 2, worldCopyJump: true });

// -------------------- Data sources --------------------
// CTX (ArcGIS REST XYZ)
const CTX_XYZ =
  'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer/tile/{z}/{y}/{x}?blankTile=false';

// Optional CTX WMTS fallback (unused by default)
const CTX_WMTS =
  'https://trek.nasa.gov/tiles/Mars/EQ/Mars_CTX_Mosaic_Global_25mpp/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg';
const USE_CTX_WMTS = false; 

// MOLA (WMTS, NASA Trek)
const MOLA_WMTS =
  'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg';

// -------------------- WMTS adapter --------------------
function wmtsLayer(urlTemplate, opts = {}) {
  const layer = L.tileLayer('', Object.assign({ tileSize: 256, noWrap: true, crossOrigin: true }, opts));
  layer.getTileUrl = function (coords) {
    return urlTemplate
      .replace('{TileMatrix}', coords.z)
      .replace('{TileRow}', coords.y)
      .replace('{TileCol}', coords.x);
  };
  return layer;
}

// -------------------- Layer factories --------------------
function createCTXLayer() {
  if (USE_CTX_WMTS) {
    return wmtsLayer(CTX_WMTS, {
      attribution: 'CTX Global Mosaic © NASA/JPL/USGS (Trek)',
      maxZoom: 12,
      maxNativeZoom: 12
    });
  }
  return L.tileLayer(CTX_XYZ, {
    tileSize: 256,
    noWrap: true,
    crossOrigin: true,
    attribution: 'CTX © Esri/USGS/NASA',
    maxZoom: 12,
    maxNativeZoom: 12
  });
}
function createMOLALayer() {
  return wmtsLayer(MOLA_WMTS, {
    attribution: 'MOLA Shaded Relief © NASA/JPL/USGS (Trek)',
    maxZoom: 7,
    maxNativeZoom: 7
  });
}

// -------------------- UI elements --------------------
const baseSelect = document.getElementById('base-select'); // "CTX" | "MOLA"
const labelBtn   = document.getElementById('add-pin');
const gotoInput  = document.getElementById('goto');
const gotoBtn    = document.getElementById('goto-btn');
const dlBtn      = document.getElementById('dl-labels');
const compareBtn = document.getElementById('compare-toggle');
const shareBtn   = document.getElementById('share-view');
const toolbar    = document.querySelector('.toolbar');

// Opacity slider (only shown in compare mode)
let opacityHolder = null;
let opacityInput  = null;

// -------------------- State --------------------
let currentLayer = null;      // single-base mode
let compareActive = false;    // compare toggle
let bottomLayer = null;       // compare base
let topLayer = null;          // compare overlay

// -------------------- Helpers --------------------
function otherBase(name) { return name === 'CTX' ? 'MOLA' : 'CTX'; }
function isCTXBase() { return (baseSelect ? baseSelect.value : 'CTX') === 'CTX'; }

// Enforce map maxZoom by mode:
// - Compare: hard cap 7 (regardless of CTX presence)
// - Single: CTX => 12, MOLA => 7
function refreshMapMaxZoom() {
  if (compareActive) {
    map.setMaxZoom(7);
    return;
  }
  map.setMaxZoom(isCTXBase() ? 12 : 7);
}

// Guardrail: if user tries to zoom beyond compare cap, pull back to 7
map.on('zoomend', () => {
  if (compareActive && map.getZoom() > 7) {
    map.setZoom(7, { animate: false });
  }
});

// URL state
function getState() {
  const ctr = map.getCenter();
  const z   = map.getZoom();
  return {
    lat: ctr.lat.toFixed(5),
    lon: ctr.lng.toFixed(5),
    z,
    base: baseSelect ? baseSelect.value : 'CTX',
    compare: compareActive ? 1 : 0,
    alpha: (opacityInput && compareActive) ? opacityInput.value : '100'
  };
}
function setURLFromState() {
  const s = getState();
  const params = new URLSearchParams();
  if (!Number.isNaN(+s.lat)) params.set('lat', s.lat);
  if (!Number.isNaN(+s.lon)) params.set('lon', s.lon);
  if (s.z !== undefined && s.z !== null) params.set('z', s.z);
  if (s.base)   params.set('base', s.base);
  params.set('compare', s.compare);
  if (s.compare) params.set('alpha', s.alpha);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}
function applyStateFromURL() {
  const params = new URLSearchParams(location.search);
  const lat   = parseFloat(params.get('lat'));
  const lon   = parseFloat(params.get('lon'));
  const z     = parseInt(params.get('z'), 10);
  const base  = params.get('base');
  const alpha = params.get('alpha');
  const wantCompare = params.get('compare') === '1';

  if (base && baseSelect && (base === 'CTX' || base === 'MOLA')) baseSelect.value = base;
  else if (baseSelect && !baseSelect.value) baseSelect.value = 'CTX';

  // Build layers according to requested mode
  if (wantCompare) {
    enableCompare(/*fromURL*/true);
    if (alpha && opacityInput) {
      opacityInput.value = alpha;
      if (topLayer) topLayer.setOpacity(parseInt(alpha, 10) / 100);
    }
  } else {
    disableCompare(true); 
    applyBase(baseSelect ? baseSelect.value : 'CTX');
  }

  // Set view AFTER layers exist (so maxZoom clamp is already in place)
  if (!Number.isNaN(lat) && !Number.isNaN(lon) && !Number.isNaN(z)) {
    // If compare is active, clamp incoming z to 7
    const targetZ = wantCompare ? Math.min(z, 7) : z;
    map.setView([lat, lon], targetZ);
  }
}

// -------------------- Single-base mode --------------------
function applyBase(name) {
  // In compare mode, rebuild both layers instead
  if (compareActive) { rebuildCompare(); return; }

  if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
  currentLayer = (name === 'CTX' ? createCTXLayer() : createMOLALayer()).addTo(map);

  refreshMapMaxZoom();
  setURLFromState();
}

// -------------------- Compare mode (opacity overlay) --------------------
function buildOpacityUI() {
  if (opacityHolder) return;
  opacityHolder = document.createElement('span');
  opacityHolder.style.marginLeft = '8px';
  opacityHolder.innerHTML = `
    <label>Opacity
      <input id="compare-opacity" type="range" min="0" max="100" value="60" style="vertical-align:middle;width:140px">
    </label>
  `;
  toolbar?.appendChild(opacityHolder);
  opacityInput = opacityHolder.querySelector('#compare-opacity');
  opacityInput.addEventListener('input', () => {
    if (topLayer) topLayer.setOpacity(parseInt(opacityInput.value, 10) / 100);
    setURLFromState();
  });
}
function removeOpacityUI() {
  if (!opacityHolder) return;
  opacityHolder.remove();
  opacityHolder = null;
  opacityInput = null;
}

function enableCompare(fromURL = false) {
  compareActive = true;

  // Remove single layer if present
  if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }

  // bottom = selected base; top = the other layer
  const base = baseSelect ? baseSelect.value : 'CTX';
  const top  = otherBase(base);

  bottomLayer = (base === 'CTX' ? createCTXLayer()  : createMOLALayer()).addTo(map);
  topLayer    = (top  === 'CTX' ? createCTXLayer()  : createMOLALayer()).addTo(map);

  // default opacity 0.6
  topLayer.setOpacity(0.6);

  // Hard cap zoom to 7 in compare mode
  refreshMapMaxZoom();
  const z = map.getZoom();
  if (z > 7) {
    map.setZoom(7, { animate: false });
    // hard refresh params with 7 max zoom
    setURLFromState();
  } else if (!fromURL) {
    // still reflect the mode change
    setURLFromState();
  }

  buildOpacityUI();
}

function rebuildCompare() {
  if (!compareActive) return;

  // Remove existing
  if (bottomLayer && map.hasLayer(bottomLayer)) map.removeLayer(bottomLayer);
  if (topLayer && map.hasLayer(topLayer))       map.removeLayer(topLayer);

  const base = baseSelect ? baseSelect.value : 'CTX';
  const top  = otherBase(base);

  bottomLayer = (base === 'CTX' ? createCTXLayer() : createMOLALayer()).addTo(map);
  topLayer    = (top  === 'CTX' ? createCTXLayer() : createMOLALayer()).addTo(map);

  // keep current slider
  const alpha = opacityInput ? (parseInt(opacityInput.value, 10) / 100) : 0.6;
  topLayer.setOpacity(alpha);

  // Ensure the cap stays at 7 while comparing
  refreshMapMaxZoom();
  if (map.getZoom() > 7) map.setZoom(7, { animate: false });

  setURLFromState();
}

function disableCompare(skipApplySingle = false) {
  compareActive = false;

  if (bottomLayer && map.hasLayer(bottomLayer)) map.removeLayer(bottomLayer);
  if (topLayer && map.hasLayer(topLayer))       map.removeLayer(topLayer);
  bottomLayer = topLayer = null;

  removeOpacityUI();

  // Restore single-mode cap immediately (CTX:12, MOLA:7)
  refreshMapMaxZoom(); 

  if (!skipApplySingle) {
    applyBase(baseSelect ? baseSelect.value : 'CTX');
  } else {
    // Keep URL z as-is per requirement; just reflect compare=0 and base, etc.
    setURLFromState();
  }
}

// -------------------- Labels --------------------
const markers = L.layerGroup().addTo(map);

async function loadLabels() {
  try {
    const res = await fetch('../api/labels_get.php?world=mars');
    const items = await res.json();
    markers.clearLayers();
    items.forEach((pt) => {
      L.marker([pt.lat, pt.lng]).addTo(markers)
        .bindPopup(`<b>${pt.title || 'Label'}</b><br>${pt.desc || ''}`);
    });
  } catch (e) { console.warn('labels_get failed', e); }
}

// -------------------- Go To --------------------
function parseLatLon(txt) {
  if (!txt) return null;
  const parts = txt.split(/[ ,]+/).map(Number);
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [lat, lon] = parts;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lat, lon];
}

// -------------------- Wire UI --------------------
let INIT = true;

if (baseSelect && !baseSelect.value) baseSelect.value = 'CTX';
applyStateFromURL();
INIT = false;

baseSelect?.addEventListener('change', () => {
  if (compareActive) rebuildCompare(); else applyBase(baseSelect.value);
});

labelBtn?.addEventListener('click', () => {
  const once = (e) => {
    const title = prompt('Label title?') || 'Label';
    const desc  = prompt('Description (optional)') || '';
    fetch('../api/labels_put.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ world: 'mars', lat: e.latlng.lat, lng: e.latlng.lng, title, desc }),
    }).then(loadLabels);
    map.off('click', once);
  };
  alert('Click on the map to place a label');
  map.on('click', once);
});

gotoBtn?.addEventListener('click', () => {
  const ll = parseLatLon(gotoInput.value);
  if (!ll) { alert('Enter as "lat,lon" within valid ranges'); return; }
  map.flyTo(ll, 6);
});

dlBtn?.addEventListener('click', async () => {
  try {
    const res = await fetch('../api/labels_get.php?world=mars');
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mars-labels-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { console.warn('download labels failed', e); }
});

compareBtn?.addEventListener('click', () => {
  if (!compareActive) enableCompare(); else disableCompare();
});

shareBtn?.addEventListener('click', async () => {
  setURLFromState();
  try {
    await navigator.clipboard.writeText(location.href);
    alert('Link copied to clipboard!');
  } catch {
    const tmp = document.createElement('input');
    tmp.value = location.href;
    document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy'); document.body.removeChild(tmp);
    alert('Link copied to clipboard!');
  }
});

// Sync URL after interactions
map.on('moveend', () => { if (!INIT) setURLFromState(); });

// Initial single-base if URL didn’t request compare
if (!compareActive && !currentLayer) applyBase(baseSelect ? baseSelect.value : 'CTX');

// Load labels
loadLabels();
