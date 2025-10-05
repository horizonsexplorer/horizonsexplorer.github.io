// public/js/earth.js - Developed by Abdulwahab Almusailem
// Requires labels-service.js loaded before this file.

// ---------------- Map (EPSG:4326) ----------------
const map = L.map('map', {
  center: [0, 0],
  zoom: 2,
  crs: L.CRS.EPSG4326,
  worldCopyJump: false,
  minZoom: 1,
  maxZoom: 8,
  zoomSnap: 1,
  zoomDelta: 1,
  wheelDebounceTime: 0,
  wheelPxPerZoomLevel: 120,
  preferCanvas: false
});

// ---------------- Layer catalog ------------------
const LAYERS = {
  'Blue Marble (500m)': {
    id: 'BlueMarble_NextGeneration',
    tms: '500m',
    time: '2004-01-01',
    timeAware: false,
    maxZoom: 7
  },
  'VIIRS SNPP True Color (NRT)': {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    tms: '250m',
    timeAware: true,
    maxZoom: 8
  },
  'MODIS Terra True Color (Daily)': {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    tms: '250m',
    timeAware: true,
    maxZoom: 8
  }
};

// --------------- WMTS helpers --------------------
function gibsUrl(layerId, tms, dateStr) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layerId}/default/${dateStr}/${tms}/{TileMatrix}/{TileRow}/{TileCol}.jpg`;
}
function wmtsLayer(urlTemplate, opts = {}) {
  const layer = L.tileLayer('', Object.assign({
    tileSize: 410,
    detectRetina: false,
    noWrap: true,
    crossOrigin: true,
    bounds: [[-90, -180], [90, 180]]
  }, opts));
  layer.getTileUrl = function (coords) {
    return urlTemplate
      .replace('{TileMatrix}', coords.z)
      .replace('{TileRow}', coords.y)
      .replace('{TileCol}', coords.x);
  };
  return layer;
}

// --------------- URL helpers (declared EARLY) ----
let compareActive = false;
let currentLayer = null;
let bottomLayer = null;
let topLayer = null;

// Init gating to prevent early URL overwrites
let INIT = true;
function setURLFromStateSafe() {
  if (!INIT) setURLFromState();
}

function getState() {
  const ctr = map.getCenter();
  const z   = map.getZoom();
  return {
    lat: ctr.lat.toFixed(5),
    lon: ctr.lng.toFixed(5),
    z,
    left:  (typeof layerSelect  !== 'undefined' && layerSelect)  ? layerSelect.value  : '',
    right: (typeof compareSelect!== 'undefined' && compareSelect)? compareSelect.value: '',
    date:  (typeof dateInput    !== 'undefined' && dateInput)    ? dateInput.value    : '',
    compare: compareActive ? 1 : 0,
    alpha: (typeof opacityInput !== 'undefined' && opacityInput && compareActive)
      ? opacityInput.value : '100'
  };
}
function setURLFromState() {
  const s = getState();
  const params = new URLSearchParams();
  if (!Number.isNaN(+s.lat)) params.set('lat', s.lat);
  if (!Number.isNaN(+s.lon)) params.set('lon', s.lon);
  if (s.z !== undefined && s.z !== null) params.set('z', s.z);
  if (s.left)   params.set('left', s.left);
  if (s.right)  params.set('right', s.right);
  if (s.date)   params.set('date', s.date);
  params.set('compare', s.compare);
  if (s.compare) params.set('alpha', s.alpha);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}
function applyStateFromURL() {
  const params = new URLSearchParams(location.search);
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const z   = parseInt(params.get('z'), 10);
  const left  = params.get('left');
  const right = params.get('right');
  const d     = params.get('date');
  const wantCompare = params.get('compare') === '1';
  const alpha = params.get('alpha');

  // 1) Apply UI values from URL first
  if (left  && LAYERS[left]  && layerSelect)   layerSelect.value   = left;
  if (right && LAYERS[right] && compareSelect) compareSelect.value = right;
  if (d && dateInput) dateInput.value = d;

  // 2) Build layers for requested mode
  if (wantCompare) {
    enableCompare(true /*fromURL*/);
    if (alpha && opacityInput) {
      opacityInput.value = alpha;
      if (topLayer) topLayer.setOpacity(parseInt(alpha, 10) / 100);
    }
  } else {
    disableCompare(true);
    applyLayer();
  }

  // 3) Set the view after layers exist
  if (!Number.isNaN(lat) && !Number.isNaN(lon) && !Number.isNaN(z)) {
    map.setView([lat, lon], z);
  }
}

// --------------- UI elements ---------------------
const toolbar   = document.querySelector('.toolbar');
const dateInput = document.getElementById('date');
const todayStr  = new Date().toISOString().slice(0, 10);

// Respect URL date if present
const _urlDate = new URLSearchParams(location.search).get('date');
if (dateInput && !_urlDate) dateInput.value = todayStr;

// Base select
const layerSelect = document.createElement('select');
Object.keys(LAYERS).forEach(k => {
  const opt = document.createElement('option');
  opt.value = k; opt.textContent = k;
  layerSelect.appendChild(opt);
});
toolbar?.appendChild(layerSelect);

// Compare select + toggle + opacity slider
const compareWrap = document.createElement('span');
compareWrap.style.marginLeft = '8px';
compareWrap.innerHTML = `
  <br><br><label>Compare with
    <select id="compare-select"></select>
  </label>
  <button id="compare-toggle" style="margin-left:8px">Toggle Compare</button>
`;
toolbar?.appendChild(compareWrap);

const compareSelect = compareWrap.querySelector('#compare-select');
Object.keys(LAYERS).forEach(k => {
  const opt = document.createElement('option');
  opt.value = k; opt.textContent = k;
  compareSelect.appendChild(opt);
});
const _urlRight = new URLSearchParams(location.search).get('right');
if (compareSelect && !_urlRight && !compareSelect.value) {
  compareSelect.value = 'MODIS Terra True Color (Daily)';
}

const compareBtn = document.getElementById('compare-toggle');
const shareBtn   = document.getElementById('share-view');

shareBtn?.addEventListener('click', async () => {
  setURLFromStateSafe();
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

// Opacity slider holder (added only when compare is active)
let opacityHolder = null;
let opacityInput  = null;

// --------------- Utilities -----------------------
function clampToToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d > now ? todayStr : dateStr;
}
function layerFromKey(key, dateStr) {
  const meta = LAYERS[key];
  const finalDate = meta.timeAware ? clampToToday(dateStr) : (meta.time || todayStr);
  const layer = wmtsLayer(gibsUrl(meta.id, meta.tms, finalDate), {
    attribution: 'Imagery © NASA GIBS',
    maxZoom: meta.maxZoom ?? 8
  });
  return layer;
}
function refreshMapMaxZoom() {
  const zooms = [];
  if (currentLayer && currentLayer.options.maxZoom) zooms.push(currentLayer.options.maxZoom);
  if (bottomLayer && bottomLayer.options.maxZoom)   zooms.push(bottomLayer.options.maxZoom);
  if (topLayer && topLayer.options.maxZoom)         zooms.push(topLayer.options.maxZoom);
  const mz = zooms.length ? Math.max(...zooms) : 8;
  map.setMaxZoom(mz);
}

// --------------- Single-layer mode ---------------
function applyLayer() {
  if (compareActive) { rebuildCompare(); return; }
  if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
  currentLayer = layerFromKey(layerSelect.value, dateInput?.value || todayStr).addTo(map);
  refreshMapMaxZoom();
}

// --------------- Compare mode (opacity slider) ---
function buildOpacityUI() {
  if (opacityHolder) return;
  opacityHolder = document.createElement('span');
  opacityHolder.style.marginLeft = '8px';
  opacityHolder.innerHTML = `
    <br><br><label>Opacity
      <input id="compare-opacity" type="range" min="0" max="100" value="60" style="vertical-align:middle;width:140px">
    </label>
  `;
  toolbar?.appendChild(opacityHolder);
  opacityInput = opacityHolder.querySelector('#compare-opacity');
  opacityInput.addEventListener('input', () => {
    if (topLayer) topLayer.setOpacity(parseInt(opacityInput.value, 10) / 100);
    setURLFromStateSafe();
  });
}
function removeOpacityUI() {
  if (!opacityHolder) return;
  opacityInput?.removeEventListener('input', () => {});
  opacityHolder.remove();
  opacityHolder = null;
  opacityInput = null;
}

function enableCompare(fromURL = false) {
  compareActive = true;
  if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
  bottomLayer = layerFromKey(layerSelect.value,   dateInput?.value || todayStr).addTo(map);
  topLayer    = layerFromKey(compareSelect.value, dateInput?.value || todayStr).addTo(map);
  topLayer.setOpacity(0.6);
  buildOpacityUI();
  refreshMapMaxZoom();
  if (!fromURL) setURLFromStateSafe();
}
function rebuildCompare() {
  if (!compareActive) return;
  if (bottomLayer && map.hasLayer(bottomLayer)) map.removeLayer(bottomLayer);
  if (topLayer && map.hasLayer(topLayer))       map.removeLayer(topLayer);
  bottomLayer = layerFromKey(layerSelect.value,   dateInput?.value || todayStr).addTo(map);
  topLayer    = layerFromKey(compareSelect.value, dateInput?.value || todayStr).addTo(map);
  const alpha = opacityInput ? (parseInt(opacityInput.value, 10) / 100) : 0.6;
  topLayer.setOpacity(alpha);
  refreshMapMaxZoom();
}
function disableCompare(skipApplySingle = false) {
  compareActive = false;
  if (bottomLayer && map.hasLayer(bottomLayer)) map.removeLayer(bottomLayer);
  if (topLayer && map.hasLayer(topLayer))       map.removeLayer(topLayer);
  bottomLayer = topLayer = null;
  removeOpacityUI();
  if (!skipApplySingle) applyLayer();
  setURLFromStateSafe();
}

// --------------- Labels --------------------------
const markers = L.layerGroup().addTo(map);
const labelBtn = document.getElementById('add-pin');

async function loadLabels() {
  try {
    const items = await window.Labels.getAll('earth');
    markers.clearLayers();
    items.forEach(pt => {
      L.marker([pt.lat, pt.lng]).addTo(markers)
        .bindPopup(`<b>${pt.title || 'Label'}</b><br>${pt.desc || ''}`);
    });
  } catch (e) { console.warn('labels_get failed', e); }
}
loadLabels();

// ---- Download labels (merged base + local) ----
const dlBtn = document.getElementById('dl-labels');
dlBtn?.addEventListener('click', () => window.Labels.download('earth'));

labelBtn?.addEventListener('click', () => {
  const once = (e) => {
    const title = prompt('Label title?') || 'Label';
    const desc  = prompt('Description (optional)') || '';
    window.Labels.add('earth', { lat: e.latlng.lat, lng: e.latlng.lng, title, desc });
    loadLabels();
    map.off('click', once);
  };
  alert('Click on the map to place a label');
  map.on('click', once);
});

// --------------- Go To ---------------------------
const gotoInput = document.getElementById('goto');
const gotoBtn   = document.getElementById('goto-btn');

function parseLatLon(txt){
  if(!txt) return null;
  const parts = txt.split(/[ ,]+/).map(Number);
  if (parts.length !== 2 || parts.some(n=>Number.isNaN(n))) return null;
  const [lat, lon] = parts;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lat, lon];
}
gotoBtn?.addEventListener('click', ()=>{
  const ll = parseLatLon(gotoInput.value);
  if(!ll){ alert('Enter as "lat,lon" within valid ranges'); return; }
  map.flyTo(ll, 5);
});

// ---------------- Time controls ------------------
const timeUI = document.createElement('span');
timeUI.style.marginLeft = '8px';
timeUI.innerHTML = `
  <br><br>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    <button id="vid-play">▶</button>
    <button id="vid-pause" disabled>⏸</button>
    <label>From <input id="vid-from" type="date" style="width:140px"></label>
    <label>To <input id="vid-to" type="date" style="width:140px"></label>
    <label>Step
      <select id="vid-step">
        <option value="1">1 day</option>
        <option value="7">7 days</option>
        <option value="30">30 days</option>
      </select>
    </label>
    <label><input id="vid-loop" type="checkbox" checked> Loop</label>
  </div>
  <input id="vid-scrub" type="range" min="0" max="0" value="0" style="width:520px;margin-top:6px">
`;
toolbar?.appendChild(timeUI);

const playBtn = document.getElementById('vid-play');
const pauseBtn = document.getElementById('vid-pause');
const fromEl = document.getElementById('vid-from');
const toEl = document.getElementById('vid-to');
const stepEl = document.getElementById('vid-step');
const loopEl = document.getElementById('vid-loop');
const scrub = document.getElementById('vid-scrub');

const todayISO = new Date().toISOString().slice(0,10);
const weekAgoISO = new Date(Date.now() - 6*864e5).toISOString().slice(0,10);
fromEl.value = weekAgoISO;
toEl.value = todayISO;

function makeFrames() {
  const start = new Date(fromEl.value);
  const end   = new Date(toEl.value);
  const stepDays = Math.max(1, parseInt(stepEl.value, 10) || 1);
  const out = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + stepDays*864e5)) {
    const iso = d.toISOString().slice(0,10);
    out.push(iso);
  }
  if (!out.length) out.push(todayISO);
  return out;
}

let frames = makeFrames();
function rebuildFramesAndScrub() {
  frames = makeFrames();
  scrub.max = String(frames.length - 1);
  if (!frames.includes(dateInput.value)) dateInput.value = frames[0];
  scrub.value = String(frames.indexOf(dateInput.value));
  setURLFromStateSafe();
}
[fromEl, toEl, stepEl].forEach(el => el.addEventListener('change', rebuildFramesAndScrub));

function setFrame(idx) {
  idx = Math.max(0, Math.min(frames.length - 1, idx));
  const iso = frames[idx];
  if (!iso) return;
  dateInput.value = iso;
  if (compareActive) { rebuildCompare(); } else { applyLayer(); }
  scrub.value = String(idx);
}
scrub.addEventListener('input', () => setFrame(parseInt(scrub.value, 10)));

let playing = false;
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

function waitForTiles(timeoutMs = 7000) {
  const layers = [];
  if (compareActive) {
    if (bottomLayer) layers.push(bottomLayer);
    if (topLayer)    layers.push(topLayer);
  } else if (currentLayer) {
    layers.push(currentLayer);
  }
  if (layers.length === 0) return Promise.resolve();

  return Promise.all(layers.map(layer => new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
    const onLoad = () => finish();
    const tick = setTimeout(() => { if (layer._tilesToLoad === 0) finish(); }, 0);
    const to = setTimeout(finish, timeoutMs);
    const cleanup = () => { clearTimeout(tick); clearTimeout(to); layer.off('load', onLoad); };
    layer.on('load', onLoad);
  })));
}

async function play() {
  if (playing || frames.length === 0) return;
  playing = true;
  playBtn.disabled = true; pauseBtn.disabled = false;
  let idx = Math.max(0, frames.indexOf(dateInput.value));
  while (playing) {
    idx++;
    if (idx >= frames.length) {
      if (loopEl.checked) idx = 0;
      else { pause(); break; }
    }
    setFrame(idx);
    await delay(0);
    await waitForTiles();
    await delay(500);
  }
}
function pause() {
  playing = false;
  playBtn.disabled = false; pauseBtn.disabled = true;
}
playBtn.addEventListener('click', play);
pauseBtn.addEventListener('click', pause);

dateInput?.addEventListener('change', () => {
  if (!frames.includes(dateInput.value)) rebuildFramesAndScrub();
  scrub.value = String(frames.indexOf(dateInput.value));
});

// ---------- Simple prefetch (one frame ahead) ----------
map.on('moveend', () => {
  const idx = frames.indexOf(dateInput.value);
  const next = frames[idx + 1];
  if (!next) return;
  const metaBase = LAYERS[layerSelect.value];
  const metaTop  = LAYERS[compareSelect?.value];
  [metaBase, metaTop].forEach(meta => {
    if (!meta) return;
    const u = gibsUrl(meta.id, meta.tms, next)
      .replace('{TileMatrix}', String(map.getZoom()))
      .replace('{TileRow}', '0')
      .replace('{TileCol}', '0');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = u;
  });
});

rebuildFramesAndScrub();

// --------------- URL wiring & init ---------------
map.on('moveend', setURLFromStateSafe);

function onAnyChange() {
  if (compareActive) { rebuildCompare(); } else { applyLayer(); }
  setURLFromStateSafe();
}
dateInput?.addEventListener('change', onAnyChange);
layerSelect?.addEventListener('change', onAnyChange);
compareSelect?.addEventListener('change', onAnyChange);
const compareBtnEl = document.getElementById('compare-toggle');
compareBtnEl?.addEventListener('click', () => {
  if (!compareActive) enableCompare(); else disableCompare();
  setURLFromStateSafe();
});

applyStateFromURL();
INIT = false;
setURLFromState();
