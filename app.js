
const STORAGE_KEY = 'fishMapTestV7.entries';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_METERS = 1200;
const DEFAULT_CENTER = [46.62, -87.67];
const DEFAULT_ZOOM = 9;
const CURRENT_ANGLER = localStorage.getItem('fishMap.currentAngler') || 'Tod';

const state = {
  entries: loadEntries(),
  markerCluster: null,
  currentDraftMarker: null,
  addMode: false,
  filters: { dateFrom:'', dateTo:'', species:'', color:'', sky:'', retrieveSpeed:'' }
};

const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
state.markerCluster = L.markerClusterGroup();
map.addLayer(state.markerCluster);

const addLogBtn = document.getElementById('addLogBtn');
const reviewBtn = document.getElementById('reviewBtn');
const filterBtn = document.getElementById('filterBtn');
const logSheet = document.getElementById('logSheet');
const reviewSheet = document.getElementById('reviewSheet');
const filterSheet = document.getElementById('filterSheet');
const closeLogSheetBtn = document.getElementById('closeLogSheetBtn');
const closeReviewSheetBtn = document.getElementById('closeReviewSheetBtn');
const closeFilterSheetBtn = document.getElementById('closeFilterSheetBtn');
const clearSpotBtn = document.getElementById('clearSpotBtn');
const statusBadge = document.getElementById('statusBadge');
const logForm = document.getElementById('logForm');
const reviewSubcopy = document.getElementById('reviewSubcopy');
const entryList = document.getElementById('entryList');
const entryCount = document.getElementById('entryCount');
const statsGrid = document.getElementById('statsGrid');
const dateInput = document.getElementById('date');
const waterNameInput = document.getElementById('waterName');
const nearbyWaterWrap = document.getElementById('nearbyWaterWrap');
const nearbyWaterSelect = document.getElementById('nearbyWaterSelect');
const waterLookupStatus = document.getElementById('waterLookupStatus');
const patternInput = document.getElementById('patternInput');
const patternSuggestions = document.getElementById('patternSuggestions');
const flyCategory = document.getElementById('flyCategory');
const mainColor = document.getElementById('mainColor');
const additionalColor = document.getElementById('additionalColor');
const flySize = document.getElementById('flySize');
const patternHelper = document.getElementById('patternHelper');
const baitType = document.getElementById('baitType');
const filterDateFrom = document.getElementById('filterDateFrom');
const filterDateTo = document.getElementById('filterDateTo');
const filterSpecies = document.getElementById('filterSpecies');
const filterColor = document.getElementById('filterColor');
const filterSky = document.getElementById('filterSky');
const filterRetrieveSpeed = document.getElementById('filterRetrieveSpeed');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

dateInput.value = new Date().toISOString().slice(0, 10);
wireEvents();
render();

function wireEvents() {
  addLogBtn.addEventListener('click', () => {
    state.addMode = true;
    closeSheet(logSheet);
    closeSheet(reviewSheet);
    closeSheet(filterSheet);
    setStatus('Tap the map to set a fishing spot.');
  });
  reviewBtn.addEventListener('click', () => { openSheet(reviewSheet); closeSheet(logSheet); closeSheet(filterSheet); });
  filterBtn.addEventListener('click', () => { openSheet(filterSheet); closeSheet(logSheet); closeSheet(reviewSheet); });

  closeLogSheetBtn.addEventListener('click', () => closeSheet(logSheet));
  closeReviewSheetBtn.addEventListener('click', () => closeSheet(reviewSheet));
  closeFilterSheetBtn.addEventListener('click', () => closeSheet(filterSheet));
  clearSpotBtn.addEventListener('click', clearDraftMarker);

  nearbyWaterSelect.addEventListener('change', () => {
    if (nearbyWaterSelect.value) {
      waterNameInput.value = nearbyWaterSelect.value;
      waterLookupStatus.textContent = 'Nearby water selected from Overpass results.';
    }
  });

  flyCategory.addEventListener('change', () => {
    updatePatternSuggestions(patternInput.value.trim());
  });

  patternInput.addEventListener('input', () => {
    updatePatternSuggestions(patternInput.value.trim());
    autoFillPatternIfExactMatch(patternInput.value.trim());
  });

  patternInput.addEventListener('focus', () => {
    updatePatternSuggestions(patternInput.value.trim());
  });

  document.addEventListener('click', (event) => {
    if (!patternSuggestions.contains(event.target) && event.target !== patternInput) {
      patternSuggestions.classList.add('hidden');
    }
  });

  [filterDateFrom, filterDateTo, filterSpecies, filterColor, filterSky, filterRetrieveSpeed].forEach(el => {
    el.addEventListener('change', () => {
      state.filters.dateFrom = filterDateFrom.value;
      state.filters.dateTo = filterDateTo.value;
      state.filters.species = filterSpecies.value;
      state.filters.color = filterColor.value;
      state.filters.sky = filterSky.value;
      state.filters.retrieveSpeed = filterRetrieveSpeed.value;
      render();
    });
  });

  resetFiltersBtn.addEventListener('click', () => {
    filterDateFrom.value = ''; filterDateTo.value = ''; filterSpecies.value = ''; filterColor.value = ''; filterSky.value = ''; filterRetrieveSpeed.value = '';
    state.filters = { dateFrom:'', dateTo:'', species:'', color:'', sky:'', retrieveSpeed:'' };
    render();
    setStatus('Filters reset.');
  });

  map.on('click', async (event) => {
    if (!state.addMode) return;
    setDraftMarker(event.latlng.lat, event.latlng.lng);
    openSheet(logSheet);
    closeSheet(reviewSheet);
    closeSheet(filterSheet);
    await detectNearbyWater(event.latlng.lat, event.latlng.lng);
    setStatus('Spot set. Fill out the log and save it.');
  });

  logForm.addEventListener('submit', onSubmit);
}

function updatePatternSuggestions(query) {
  const normalized = query.toLowerCase();
  const category = flyCategory.value;
  const matches = window.FLY_REFERENCE.filter(item => {
    const categoryOk = !category || item.category === category;
    const queryOk = !normalized || item.name.toLowerCase().includes(normalized);
    return categoryOk && queryOk;
  }).slice(0, 8);

  patternSuggestions.innerHTML = '';
  if (!matches.length || !query) {
    patternSuggestions.classList.add('hidden');
    return;
  }

  matches.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `<span class="suggestion-name">${escapeHtml(item.name)}</span><span class="suggestion-meta">${escapeHtml(item.category)} · sizes ${item.sizes.join(', ')}</span>`;
    div.addEventListener('click', () => {
      applyPattern(item);
      patternSuggestions.classList.add('hidden');
    });
    patternSuggestions.appendChild(div);
  });
  patternSuggestions.classList.remove('hidden');
}

function autoFillPatternIfExactMatch(name) {
  const exact = window.FLY_REFERENCE.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (exact) applyPattern(exact, false);
}

function applyPattern(item, updateInput=true) {
  if (updateInput) patternInput.value = item.name;
  flyCategory.value = item.category || flyCategory.value;
  baitType.value = 'Fly';
  if (item.primary?.length) mainColor.value = item.primary[0];
  if (item.secondary?.length) additionalColor.value = item.secondary[0];
  populateSizeOptions(item.sizes || []);
  patternHelper.textContent = `${item.notes}. Suggested colors: ${[...(item.primary||[]), ...(item.secondary||[])].join(', ')}.`;
}

function populateSizeOptions(sizes) {
  flySize.innerHTML = '<option value="">Choose one</option>';
  sizes.forEach(size => {
    const opt = document.createElement('option');
    opt.value = String(size);
    opt.textContent = String(size);
    flySize.appendChild(opt);
  });
}

async function detectNearbyWater(lat, lng) {
  waterLookupStatus.textContent = 'Checking Overpass for nearby rivers and lakes...';
  nearbyWaterWrap.classList.add('hidden');
  nearbyWaterSelect.innerHTML = '<option value="">Choose one</option>';
  const query = `
    [out:json][timeout:25];
    (
      way["waterway"~"river|stream|canal|ditch"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      relation["waterway"~"river|stream|canal|ditch"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      way["natural"="water"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      relation["natural"="water"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      way["water"~"lake|pond|reservoir"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      relation["water"~"lake|pond|reservoir"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      relation["place"="sea"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
      way["place"="sea"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});
    );
    out tags center;
  `;
  try {
    const response = await fetch(OVERPASS_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8'}, body:query });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const data = await response.json();
    let candidates = normalizeWaterCandidates(data.elements || [], lat, lng);

    if (!candidates.length) {
      const fallback = await detectBigLakeFallback(lat, lng);
      if (fallback) candidates = [fallback];
    }

    if (!candidates.length) {
      waterLookupStatus.textContent = 'No named nearby water found. Type it manually if needed.';
      return;
    }

    if (candidates.length === 1) {
      waterNameInput.value = candidates[0].name;
      waterLookupStatus.textContent = `Overpass matched: ${candidates[0].name}.`;
      return;
    }

    nearbyWaterWrap.classList.remove('hidden');
    candidates.forEach(candidate => {
      const opt = document.createElement('option');
      opt.value = candidate.name;
      opt.textContent = `${candidate.name} · ${candidate.featureLabel} · ${Math.round(candidate.distance)}m`;
      nearbyWaterSelect.appendChild(opt);
    });
    nearbyWaterSelect.value = candidates[0].name;
    waterNameInput.value = candidates[0].name;
    waterLookupStatus.textContent = `Overpass found ${candidates.length} nearby water features. Choose the right one if needed.`;
  } catch (error) {
    const fallback = await detectBigLakeFallback(lat, lng);
    if (fallback) {
      waterNameInput.value = fallback.name;
      waterLookupStatus.textContent = `Fallback matched: ${fallback.name}.`;
    } else {
      waterLookupStatus.textContent = `Overpass lookup failed: ${error.message}. Type the body of water manually.`;
    }
  }
}

async function detectBigLakeFallback(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
    if (!response.ok) return null;
    const data = await response.json();
    const lakeName = data.address?.water || data.address?.sea || data.address?.lake || '';
    if (lakeName) return { name: lakeName, featureLabel: 'Water', distance: 0 };
    const display = data.display_name || '';
    if (/Lake Superior/i.test(display)) return { name: 'Lake Superior', featureLabel: 'Lake', distance: 0 };
    return null;
  } catch {
    return null;
  }
}

function normalizeWaterCandidates(elements, lat, lng) {
  const dedupe = new Map();
  for (const el of elements) {
    const tags = el.tags || {};
    const name = (tags.name || '').trim();
    if (!name) continue;
    const centerLat = el.center?.lat ?? el.lat;
    const centerLng = el.center?.lon ?? el.lon;
    if (typeof centerLat !== 'number' || typeof centerLng !== 'number') continue;
    const featureLabel = classifyFeature(tags);
    const distance = haversineMeters(lat, lng, centerLat, centerLng);
    const key = `${name.toLowerCase()}|${featureLabel.toLowerCase()}`;
    if (!dedupe.has(key) || dedupe.get(key).distance > distance) dedupe.set(key, { name, featureLabel, distance });
  }
  return [...dedupe.values()].sort((a,b) => a.distance - b.distance).slice(0, 8);
}

function classifyFeature(tags) {
  if (tags.waterway) return capitalize(tags.waterway);
  if (tags.water) return capitalize(tags.water);
  if (tags.place === 'sea') return 'Lake';
  if (tags.natural === 'water') return 'Water';
  return 'Water';
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function onSubmit(event) {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(logForm).entries());
  const patternName = raw.patternInput.trim();
  if (!patternName) return alert('Type a fly pattern.');
  if (!state.currentDraftMarker) return alert('Tap the map first so the log gets a marker.');
  const ll = state.currentDraftMarker.getLatLng();
  const entry = {
    id: crypto.randomUUID(),
    owner: CURRENT_ANGLER,
    createdAt: new Date().toISOString(),
    date: raw.date,
    timeOfDay: raw.timeOfDay,
    waterName: raw.waterName.trim(),
    patternName,
    baitType: raw.baitType,
    flyCategory: raw.flyCategory,
    mainColor: raw.mainColor,
    additionalColor: raw.additionalColor,
    flySize: raw.flySize,
    species: raw.species,
    sizeInches: Number(raw.sizeInches || 0),
    weight: raw.weight.trim(),
    quantity: Number(raw.quantity || 1),
    airTemp: raw.airTemp ? Number(raw.airTemp) : null,
    waterTemp: raw.waterTemp ? Number(raw.waterTemp) : null,
    skyCondition: raw.skyCondition,
    waterCondition: raw.waterCondition,
    waterClarity: raw.waterClarity,
    depthZone: raw.depthZone,
    retrieveSpeed: raw.retrieveSpeed,
    presentationStyle: raw.presentationStyle,
    structureType: raw.structureType,
    hatches: raw.hatches.trim(),
    notes: raw.notes.trim(),
    marker: { lat: ll.lat, lng: ll.lng }
  };
  state.entries.unshift(entry);
  persistEntries();
  clearFormAfterSave();
  render();
  openSheet(reviewSheet);
  closeSheet(logSheet);
  setStatus('Fishing log saved.');
}

function getFilteredEntries() {
  return state.entries.filter(entry => {
    if (state.filters.dateFrom && entry.date < state.filters.dateFrom) return false;
    if (state.filters.dateTo && entry.date > state.filters.dateTo) return false;
    if (state.filters.species && entry.species !== state.filters.species) return false;
    if (state.filters.color && entry.mainColor !== state.filters.color) return false;
    if (state.filters.sky && entry.skyCondition !== state.filters.sky) return false;
    if (state.filters.retrieveSpeed && entry.retrieveSpeed !== state.filters.retrieveSpeed) return false;
    return true;
  });
}

function render() {
  const visible = getFilteredEntries();
  renderMarkers(visible);
  renderStats(visible);
  renderList(visible);
}

function renderMarkers(entries) {
  state.markerCluster.clearLayers();
  entries.forEach(entry => {
    const marker = L.marker([entry.marker.lat, entry.marker.lng]);
    marker.bindPopup(buildPopup(entry));
    marker.on('click', () => { reviewSubcopy.textContent = `${entry.waterName} · ${entry.patternName} · ${entry.retrieveSpeed} retrieve`; });
    state.markerCluster.addLayer(marker);
  });
}

function buildPopup(entry) {
  return `<div><strong>${escapeHtml(entry.waterName)}</strong><br>${escapeHtml(entry.species)} · ${escapeHtml(String(entry.sizeInches))}"${entry.weight ? ' · ' + escapeHtml(entry.weight) : ''} · Qty ${escapeHtml(String(entry.quantity))}<br>${escapeHtml(entry.patternName)}${entry.flySize ? ' · #' + escapeHtml(entry.flySize) : ''} · ${escapeHtml(entry.baitType)}<br>${escapeHtml(entry.mainColor)}${entry.additionalColor ? '/' + escapeHtml(entry.additionalColor) : ''} · ${escapeHtml(entry.retrieveSpeed)} · ${escapeHtml(entry.owner)}</div>`;
}

function renderStats(entries) {
  statsGrid.innerHTML = '';
  const totalEntries = entries.length;
  const totalFish = entries.reduce((sum, e) => sum + (e.quantity || 0), 0);
  const avgSize = totalEntries ? (entries.reduce((sum, e) => sum + (e.sizeInches || 0), 0) / totalEntries).toFixed(1) : '0.0';
  const topPattern = mostCommon(entries, 'patternName') || '—';
  const topRetrieve = mostCommon(entries, 'retrieveSpeed') || '—';
  [['Entries', totalEntries], ['Fish Logged', totalFish], ['Avg Size', `${avgSize}"`], ['Top Pattern', topPattern], ['Top Retrieve', topRetrieve]].forEach(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'statCard';
    card.innerHTML = `<div class="statLabel">${escapeHtml(label)}</div><div class="statValue">${escapeHtml(String(value))}</div>`;
    statsGrid.appendChild(card);
  });
}

function renderList(entries) {
  entryList.innerHTML = '';
  entryCount.textContent = `${entries.length} shown / ${state.entries.length} total`;
  if (!entries.length) {
    entryList.innerHTML = '<div class="entryCard"><p class="entryMeta">No logs match the current filters.</p></div>';
    return;
  }
  entries.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'entryCard';
    card.innerHTML = `<div class="entryTitleRow"><div><h3 class="entryTitle">${escapeHtml(entry.waterName)} · ${escapeHtml(entry.species)}</h3><p class="entryMeta">${escapeHtml(formatDate(entry.date))} · ${escapeHtml(entry.timeOfDay)} · ${escapeHtml(entry.patternName)}${entry.flySize ? ' · #' + escapeHtml(entry.flySize) : ''} · ${escapeHtml(String(entry.sizeInches))}"${entry.weight ? ' · ' + escapeHtml(entry.weight) : ''} · ${escapeHtml(entry.owner)}</p></div><div class="entryButtons"><button type="button" class="entryBtn locateBtn">Locate</button><button type="button" class="entryBtn danger deleteBtn">Delete</button></div></div><div class="chips"></div>${entry.notes ? `<p class="entryNotes">${escapeHtml(entry.notes)}</p>` : ''}`;
    const chips = card.querySelector('.chips');
    [entry.baitType, entry.mainColor && `${entry.mainColor}${entry.additionalColor ? '/' + entry.additionalColor : ''}`, entry.skyCondition, entry.waterCondition, entry.waterClarity, entry.depthZone, entry.retrieveSpeed && `${entry.retrieveSpeed} retrieve`, entry.presentationStyle, entry.structureType, entry.hatches].filter(Boolean).forEach(text => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = text;
      chips.appendChild(chip);
    });
    card.querySelector('.locateBtn').addEventListener('click', () => { map.setView([entry.marker.lat, entry.marker.lng], 14); closeSheet(reviewSheet); });
    card.querySelector('.deleteBtn').addEventListener('click', () => {
      if (!confirm('Delete this fishing log?')) return;
      state.entries = state.entries.filter(e => e.id !== entry.id);
      persistEntries();
      render();
      setStatus('Fishing log deleted.');
    });
    entryList.appendChild(card);
  });
}

function setDraftMarker(lat, lng) {
  if (state.currentDraftMarker) { state.currentDraftMarker.setLatLng([lat, lng]); return; }
  state.currentDraftMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  state.currentDraftMarker.bindPopup('Draft fishing spot').openPopup();
}

function clearDraftMarker() {
  waterNameInput.value = '';
  nearbyWaterSelect.innerHTML = '<option value="">Choose one</option>';
  nearbyWaterWrap.classList.add('hidden');
  waterLookupStatus.textContent = 'Click Add Log, then tap/click the map to set a spot.';
  if (state.currentDraftMarker) { map.removeLayer(state.currentDraftMarker); state.currentDraftMarker = null; }
  setStatus('Draft spot cleared.');
}

function clearFormAfterSave() {
  logForm.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  populateSizeOptions([]);
  patternHelper.textContent = 'Start typing a fly name. Matching names will pop up below.';
  clearDraftMarker();
  state.addMode = false;
}

function openSheet(el) { el.classList.add('visible'); el.setAttribute('aria-hidden', 'false'); }
function closeSheet(el) { el.classList.remove('visible'); el.setAttribute('aria-hidden', 'true'); }
function setStatus(message) {
  statusBadge.textContent = message;
  statusBadge.classList.remove('hidden');
  clearTimeout(setStatus._timer);
  setStatus._timer = setTimeout(() => statusBadge.classList.add('hidden'), 2600);
}
function persistEntries() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries)); }
function loadEntries() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function populateSizeOptions(sizes) {
  flySize.innerHTML = '<option value="">Choose one</option>';
  sizes.forEach(size => {
    const opt = document.createElement('option');
    opt.value = String(size);
    opt.textContent = String(size);
    flySize.appendChild(opt);
  });
}
function mostCommon(entries, key) {
  const counts = new Map();
  for (const entry of entries) { if (!entry[key]) continue; counts.set(entry[key], (counts.get(entry[key]) || 0) + 1); }
  const sorted = [...counts.entries()].sort((a,b) => b[1]-a[1]);
  return sorted.length ? sorted[0][0] : '';
}
function capitalize(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''; }
function formatDate(value) { if (!value) return ''; const [y,m,d] = value.split('-'); return `${m}/${d}/${y}`; }
function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
