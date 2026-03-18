const STORAGE_KEY = 'fishLogEntriesV2';

const state = {
  entries: loadEntries(),
  markers: new Map(),
  editingId: null
};

const form = document.getElementById('logForm');
const entriesEl = document.getElementById('entries');
const entryCountEl = document.getElementById('entryCount');
const statsEl = document.getElementById('stats');
const template = document.getElementById('entryTemplate');

const filterSpecies = document.getElementById('filterSpecies');
const filterFlyColor = document.getElementById('filterFlyColor');
const filterSky = document.getElementById('filterSky');
const filterWaterType = document.getElementById('filterWaterType');

const dateInput = document.getElementById('date');
const latInput = document.getElementById('lat');
const lngInput = document.getElementById('lng');

dateInput.value = new Date().toISOString().slice(0, 10);

const map = L.map('map').setView([46.6, -87.6], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let pendingMarker = null;

map.on('click', (event) => {
  const { lat, lng } = event.latlng;
  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);

  if (pendingMarker) {
    pendingMarker.setLatLng(event.latlng);
  } else {
    pendingMarker = L.marker(event.latlng, { draggable: true }).addTo(map);
    pendingMarker.on('dragend', () => {
      const pos = pendingMarker.getLatLng();
      latInput.value = pos.lat.toFixed(6);
      lngInput.value = pos.lng.toFixed(6);
    });
  }
});

document.getElementById('centerMichiganBtn').addEventListener('click', () => {
  map.setView([46.6, -87.6], 7);
});

document.getElementById('clearCoordsBtn').addEventListener('click', clearPendingCoords);
document.getElementById('resetBtn').addEventListener('click', resetForm);
document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
document.getElementById('clearBtn').addEventListener('click', clearAllEntries);
document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importInput').addEventListener('change', importData);

[filterSpecies, filterFlyColor, filterSky, filterWaterType].forEach(el => {
  el.addEventListener('change', render);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const entry = collectFormData();
  if (!entry) return;

  if (state.editingId) {
    const index = state.entries.findIndex(item => item.id === state.editingId);
    if (index >= 0) {
      entry.id = state.editingId;
      state.entries[index] = entry;
    }
  } else {
    state.entries.unshift(entry);
  }

  persist();
  resetForm();
  render();
});

function collectFormData() {
  const formData = new FormData(form);
  const entry = Object.fromEntries(formData.entries());

  entry.id = state.editingId || crypto.randomUUID();
  entry.date = entry.date || new Date().toISOString().slice(0, 10);
  entry.quantity = Number(entry.quantity || 1);
  entry.fishSize = Number(entry.fishSize || 0);
  entry.airTemp = entry.airTemp ? Number(entry.airTemp) : null;
  entry.waterTemp = entry.waterTemp ? Number(entry.waterTemp) : null;
  entry.lat = entry.lat ? Number(entry.lat) : null;
  entry.lng = entry.lng ? Number(entry.lng) : null;
  entry.createdAt = new Date().toISOString();

  if (!entry.flyPattern || !entry.flyColorPrimary || !entry.species || !entry.date) {
    alert('You are missing one of the main fields. The trout are mocking us.');
    return null;
  }

  return entry;
}

function render() {
  const filtered = getFilteredEntries();
  renderStats(filtered);
  renderEntries(filtered);
  renderMap(filtered);
}

function getFilteredEntries() {
  return state.entries.filter(entry => {
    if (filterSpecies.value && entry.species !== filterSpecies.value) return false;
    if (filterFlyColor.value && entry.flyColorPrimary !== filterFlyColor.value) return false;
    if (filterSky.value && entry.skyCondition !== filterSky.value) return false;
    if (filterWaterType.value && entry.waterType !== filterWaterType.value) return false;
    return true;
  });
}

function renderStats(entries) {
  const totalEntries = entries.length;
  const totalFish = entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  const avgSize = totalEntries
    ? (entries.reduce((sum, entry) => sum + (entry.fishSize || 0), 0) / totalEntries).toFixed(1)
    : '0.0';

  const topFly = mostCommon(entries, 'flyPattern');
  const topColor = mostCommon(entries, 'flyColorPrimary');

  statsEl.innerHTML = '';
  const stats = [
    ['Entries', totalEntries],
    ['Fish Logged', totalFish],
    ['Avg Size', `${avgSize}"`],
    ['Top Fly', topFly || '—'],
    ['Top Color', topColor || '—']
  ];

  stats.forEach(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(String(value))}</div>`;
    statsEl.appendChild(card);
  });
}

function renderEntries(entries) {
  entriesEl.innerHTML = '';
  entryCountEl.textContent = `${entries.length} shown / ${state.entries.length} total`;

  if (!entries.length) {
    entriesEl.innerHTML = '<div class="empty-state">No matching entries yet. Either the filter is too picky or the trout are being rude.</div>';
    return;
  }

  entries.forEach(entry => {
    const node = template.content.firstElementChild.cloneNode(true);

    const title = `${entry.species} · ${entry.fishSize}" · ${entry.quantity} fish`;
    const meta = [
      formatDate(entry.date),
      entry.timeOfDay,
      entry.flyPattern,
      entry.flyColorSecondary ? `${entry.flyColorPrimary}/${entry.flyColorSecondary}` : entry.flyColorPrimary
    ].filter(Boolean).join(' • ');

    node.querySelector('.entry-title').textContent = title;
    node.querySelector('.entry-meta').textContent = meta;
    node.querySelector('.entry-notes').textContent = entry.notes ? entry.notes : '';

    const chips = buildChips(entry);
    const chipsEl = node.querySelector('.chips');
    chips.forEach(text => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = text;
      chipsEl.appendChild(chip);
    });

    node.querySelector('.locate-btn').addEventListener('click', () => locateEntry(entry));
    node.querySelector('.delete-btn').addEventListener('click', () => deleteEntry(entry.id));
    entriesEl.appendChild(node);
  });
}

function renderMap(entries) {
  for (const marker of state.markers.values()) {
    map.removeLayer(marker);
  }
  state.markers.clear();

  entries.forEach(entry => {
    if (typeof entry.lat !== 'number' || typeof entry.lng !== 'number') return;

    const marker = L.marker([entry.lat, entry.lng]).addTo(map);
    marker.bindPopup(`
      <strong>${escapeHtml(entry.species)}</strong><br>
      ${escapeHtml(entry.flyPattern)} (${escapeHtml(entry.flyColorPrimary)})<br>
      ${escapeHtml(entry.waterType)} · ${escapeHtml(entry.skyCondition)}<br>
      ${escapeHtml(String(entry.fishSize))}" · Qty ${escapeHtml(String(entry.quantity))}
    `);
    state.markers.set(entry.id, marker);
  });
}

function buildChips(entry) {
  const chips = [];
  const add = (value) => value ? chips.push(value) : null;

  add(entry.flyCategory);
  add(entry.skyCondition);
  add(entry.waterType);
  add(entry.depthZone);
  add(entry.riverPosition);
  if (entry.waterTemp != null) add(`Water ${entry.waterTemp}°`);
  if (entry.airTemp != null) add(`Air ${entry.airTemp}°`);
  if (entry.flyColorNotes) add(entry.flyColorNotes);
  if (entry.lat != null && entry.lng != null) add('Mapped');
  return chips;
}

function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  state.entries = state.entries.filter(entry => entry.id !== id);
  persist();
  render();
}

function locateEntry(entry) {
  if (typeof entry.lat !== 'number' || typeof entry.lng !== 'number') {
    alert('This entry has no coordinates yet.');
    return;
  }
  map.setView([entry.lat, entry.lng], 13);
  const marker = state.markers.get(entry.id);
  if (marker) marker.openPopup();
}

function resetForm() {
  form.reset();
  state.editingId = null;
  dateInput.value = new Date().toISOString().slice(0, 10);
  clearPendingCoords();
}

function clearPendingCoords() {
  latInput.value = '';
  lngInput.value = '';
  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
}

function resetFilters() {
  filterSpecies.value = '';
  filterFlyColor.value = '';
  filterSky.value = '';
  filterWaterType.value = '';
  render();
}

function clearAllEntries() {
  if (!confirm('Clear every saved entry from local storage?')) return;
  state.entries = [];
  persist();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fish-log-export.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('That file is not a fish log array.');
    state.entries = parsed;
    persist();
    render();
    event.target.value = '';
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function mostCommon(entries, key) {
  const counts = new Map();
  for (const entry of entries) {
    if (!entry[key]) continue;
    counts.set(entry[key], (counts.get(entry[key]) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
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

render();
