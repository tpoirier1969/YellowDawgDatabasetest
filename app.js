
const STORAGE_KEY = 'fishMapTestV3.entries';
const DEFAULT_CENTER = [46.62, -87.67];
const DEFAULT_ZOOM = 9;

const state = {
  entries: loadEntries(),
  mapMarkers: new Map(),
  currentDraftMarker: null,
  addMode: false,
  filters: { species: '', color: '', sky: '', retrieveSpeed: '' }
};

const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

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
const latInput = document.getElementById('lat');
const lngInput = document.getElementById('lng');
const flyPatternSelect = document.getElementById('flyPatternSelect');
const customPatternWrap = document.getElementById('customPatternWrap');
const customFlyPattern = document.getElementById('customFlyPattern');
const flyCategory = document.getElementById('flyCategory');
const flyColorPrimary = document.getElementById('flyColorPrimary');
const flyColorSecondary = document.getElementById('flyColorSecondary');
const flyHelper = document.getElementById('flyHelper');

const filterSpecies = document.getElementById('filterSpecies');
const filterColor = document.getElementById('filterColor');
const filterSky = document.getElementById('filterSky');
const filterRetrieveSpeed = document.getElementById('filterRetrieveSpeed');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

dateInput.value = new Date().toISOString().slice(0, 10);

seedFlyPatterns();
wireEvents();
render();

function wireEvents() {
  flyPatternSelect.addEventListener('change', onFlyChange);
  addLogBtn.addEventListener('click', () => {
    state.addMode = true;
    openSheet(logSheet); closeSheet(reviewSheet); closeSheet(filterSheet);
    setStatus('Tap the map to set the fishing spot.');
  });
  reviewBtn.addEventListener('click', () => { openSheet(reviewSheet); closeSheet(logSheet); closeSheet(filterSheet); });
  filterBtn.addEventListener('click', () => { openSheet(filterSheet); closeSheet(logSheet); closeSheet(reviewSheet); });

  closeLogSheetBtn.addEventListener('click', () => closeSheet(logSheet));
  closeReviewSheetBtn.addEventListener('click', () => closeSheet(reviewSheet));
  closeFilterSheetBtn.addEventListener('click', () => closeSheet(filterSheet));
  clearSpotBtn.addEventListener('click', clearDraftMarker);

  [filterSpecies, filterColor, filterSky, filterRetrieveSpeed].forEach(el => {
    el.addEventListener('change', () => {
      state.filters.species = filterSpecies.value;
      state.filters.color = filterColor.value;
      state.filters.sky = filterSky.value;
      state.filters.retrieveSpeed = filterRetrieveSpeed.value;
      render();
    });
  });

  resetFiltersBtn.addEventListener('click', () => {
    filterSpecies.value = ''; filterColor.value = ''; filterSky.value = ''; filterRetrieveSpeed.value = '';
    state.filters = { species:'', color:'', sky:'', retrieveSpeed:'' };
    render();
    setStatus('Filters reset.');
  });

  map.on('click', event => {
    if (!state.addMode) return;
    setDraftMarker(event.latlng.lat, event.latlng.lng);
    openSheet(logSheet);
    setStatus('Spot set. Fill in the log and save it.');
  });

  logForm.addEventListener('submit', onSubmit);
}

function seedFlyPatterns() {
  window.FLY_REFERENCE.forEach(fly => {
    const opt = document.createElement('option');
    opt.value = fly.name;
    opt.textContent = fly.name;
    flyPatternSelect.appendChild(opt);
  });
}

function onFlyChange() {
  const value = flyPatternSelect.value;
  if (value === '_custom') {
    customPatternWrap.classList.remove('hidden');
    flyHelper.textContent = 'Type your custom fly pattern and choose the colors yourself.';
    return;
  }
  customPatternWrap.classList.add('hidden');
  customFlyPattern.value = '';
  const fly = window.FLY_REFERENCE.find(item => item.name === value);
  if (!fly) {
    flyHelper.textContent = 'Pick a starter fly and I’ll suggest likely colors instead of making you type every damn thing from scratch.';
    return;
  }
  flyCategory.value = fly.category || '';
  if (fly.primary?.length) flyColorPrimary.value = fly.primary[0];
  if (fly.secondary?.length) flyColorSecondary.value = fly.secondary[0];
  flyHelper.textContent = `${fly.notes}. Suggested colors: ${[...fly.primary, ...fly.secondary].join(', ')}.`;
}

function onSubmit(event) {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(logForm).entries());
  const flyPattern = raw.flyPatternSelect === '_custom' ? raw.customFlyPattern.trim() : raw.flyPatternSelect.trim();

  if (!flyPattern) return alert('Pick a fly pattern or type a custom one.');
  if (!raw.lat || !raw.lng) return alert('Tap the map first so the log is tied to a real spot.');

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    date: raw.date,
    timeOfDay: raw.timeOfDay,
    waterName: raw.waterName.trim(),
    flyPattern,
    flyCategory: raw.flyCategory,
    flyColorPrimary: raw.flyColorPrimary,
    flyColorSecondary: raw.flyColorSecondary,
    flyColorNotes: raw.flyColorNotes.trim(),
    species: raw.species,
    fishSize: Number(raw.fishSize || 0),
    quantity: Number(raw.quantity || 1),
    skyCondition: raw.skyCondition,
    airTemp: raw.airTemp ? Number(raw.airTemp) : null,
    waterTemp: raw.waterTemp ? Number(raw.waterTemp) : null,
    waterType: raw.waterType,
    depthZone: raw.depthZone,
    riverPosition: raw.riverPosition,
    retrieveSpeed: raw.retrieveSpeed,
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    notes: raw.notes.trim()
  };

  state.entries.unshift(entry);
  persistEntries();
  clearFormAfterSave();
  render();
  openSheet(reviewSheet);
  closeSheet(logSheet);
  setStatus('Fishing log saved.');
}

function render() {
  const visibleEntries = getFilteredEntries();
  renderMarkers(visibleEntries);
  renderStats(visibleEntries);
  renderList(visibleEntries);
}

function getFilteredEntries() {
  return state.entries.filter(entry => {
    if (state.filters.species && entry.species !== state.filters.species) return false;
    if (state.filters.color && entry.flyColorPrimary !== state.filters.color) return false;
    if (state.filters.sky && entry.skyCondition !== state.filters.sky) return false;
    if (state.filters.retrieveSpeed && entry.retrieveSpeed !== state.filters.retrieveSpeed) return false;
    return true;
  });
}

function renderMarkers(entries) {
  for (const marker of state.mapMarkers.values()) map.removeLayer(marker);
  state.mapMarkers.clear();

  entries.forEach(entry => {
    const marker = L.marker([entry.lat, entry.lng]).addTo(map);
    marker.bindPopup(buildPopup(entry));
    marker.on('click', () => { reviewSubcopy.textContent = `${entry.waterName} · ${entry.flyPattern} · ${entry.retrieveSpeed} retrieve`; });
    state.mapMarkers.set(entry.id, marker);
  });
}

function buildPopup(entry) {
  return `
    <div>
      <strong>${escapeHtml(entry.waterName)}</strong><br>
      ${escapeHtml(entry.species)} · ${escapeHtml(String(entry.fishSize))}" · Qty ${escapeHtml(String(entry.quantity))}<br>
      ${escapeHtml(entry.flyPattern)} (${escapeHtml(entry.flyColorPrimary)}${entry.flyColorSecondary ? '/' + escapeHtml(entry.flyColorSecondary) : ''})<br>
      ${escapeHtml(entry.skyCondition)} · ${escapeHtml(entry.waterType)} · ${escapeHtml(entry.retrieveSpeed)}
    </div>
  `;
}

function renderStats(entries) {
  statsGrid.innerHTML = '';
  const totalEntries = entries.length;
  const totalFish = entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  const avgSize = totalEntries ? (entries.reduce((sum, e) => sum + (e.fishSize || 0), 0) / totalEntries).toFixed(1) : '0.0';
  const topFly = mostCommon(entries, 'flyPattern') || '—';
  const topRetrieve = mostCommon(entries, 'retrieveSpeed') || '—';
  [['Entries', totalEntries], ['Fish Logged', totalFish], ['Avg Size', `${avgSize}"`], ['Top Fly', topFly], ['Top Retrieve', topRetrieve]]
    .forEach(([label, value]) => {
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
    entryList.innerHTML = '<div class="entryCard"><p class="entryMeta">No logs match the current filters yet.</p></div>';
    return;
  }
  entries.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'entryCard';
    card.innerHTML = `
      <div class="entryTitleRow">
        <div>
          <h3 class="entryTitle">${escapeHtml(entry.waterName)} · ${escapeHtml(entry.species)}</h3>
          <p class="entryMeta">${escapeHtml(formatDate(entry.date))} · ${escapeHtml(entry.timeOfDay)} · ${escapeHtml(entry.flyPattern)} · ${escapeHtml(String(entry.fishSize))}" · Qty ${escapeHtml(String(entry.quantity))}</p>
        </div>
        <div class="entryButtons">
          <button type="button" class="entryBtn locateBtn">Locate</button>
          <button type="button" class="entryBtn danger deleteBtn">Delete</button>
        </div>
      </div>
      <div class="chips"></div>
      ${entry.notes ? `<p class="entryNotes">${escapeHtml(entry.notes)}</p>` : ''}
    `;
    const chips = card.querySelector('.chips');
    [
      entry.flyColorPrimary && `${entry.flyColorPrimary}${entry.flyColorSecondary ? '/' + entry.flyColorSecondary : ''}`,
      entry.flyColorNotes, entry.skyCondition, entry.waterType, entry.depthZone, entry.riverPosition,
      entry.retrieveSpeed && `${entry.retrieveSpeed} retrieve`,
      entry.waterTemp != null ? `Water ${entry.waterTemp}°` : '',
      entry.airTemp != null ? `Air ${entry.airTemp}°` : ''
    ].filter(Boolean).forEach(text => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = text;
      chips.appendChild(chip);
    });

    card.querySelector('.locateBtn').addEventListener('click', () => {
      map.setView([entry.lat, entry.lng], 13);
      const marker = state.mapMarkers.get(entry.id);
      if (marker) marker.openPopup();
      closeSheet(reviewSheet);
    });
    card.querySelector('.deleteBtn').addEventListener('click', () => {
      if (!confirm('Delete this fishing log?')) return;
      state.entries = state.entries.filter(item => item.id !== entry.id);
      persistEntries();
      render();
      setStatus('Fishing log deleted.');
    });
    entryList.appendChild(card);
  });
}

function setDraftMarker(lat, lng) {
  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);
  if (state.currentDraftMarker) {
    state.currentDraftMarker.setLatLng([lat, lng]);
    return;
  }
  state.currentDraftMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  state.currentDraftMarker.bindPopup('Draft fishing spot').openPopup();
  state.currentDraftMarker.on('dragend', () => {
    const pos = state.currentDraftMarker.getLatLng();
    latInput.value = pos.lat.toFixed(6);
    lngInput.value = pos.lng.toFixed(6);
  });
}

function clearDraftMarker() {
  latInput.value = '';
  lngInput.value = '';
  if (state.currentDraftMarker) {
    map.removeLayer(state.currentDraftMarker);
    state.currentDraftMarker = null;
  }
  setStatus('Draft spot cleared.');
}

function clearFormAfterSave() {
  logForm.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  customPatternWrap.classList.add('hidden');
  flyHelper.textContent = 'Pick a starter fly and I’ll suggest likely colors instead of making you type every damn thing from scratch.';
  clearDraftMarker();
  state.addMode = false;
}

function openSheet(element) { element.classList.add('visible'); element.setAttribute('aria-hidden', 'false'); }
function closeSheet(element) { element.classList.remove('visible'); element.setAttribute('aria-hidden', 'true'); }

function setStatus(message) {
  statusBadge.textContent = message;
  statusBadge.classList.remove('hidden');
  clearTimeout(setStatus._timer);
  setStatus._timer = setTimeout(() => statusBadge.classList.add('hidden'), 2400);
}

function persistEntries() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries)); }
function loadEntries() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }

function mostCommon(entries, key) {
  const counts = new Map();
  for (const entry of entries) {
    if (!entry[key]) continue;
    counts.set(entry[key], (counts.get(entry[key]) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : '';
}

function formatDate(value) {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${m}/${d}/${y}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
