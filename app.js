const APP_VERSION = '2026.03.18c';
const STORAGE_KEY = 'yellowdog-fishing-log-v1';

const state = {
  map: null,
  markerLayer: null,
  logs: [],
  markersById: new Map(),
  isPlacing: false,
  pendingLatLng: null,
  pendingMarker: null,
  wasRepicking: false,
  waterLookupRequestId: 0,
};

const els = {
  addLogBtn: document.getElementById('addLogBtn'),
  addLogBtnHud: document.getElementById('addLogBtnHud'),
  fitLogsBtn: document.getElementById('fitLogsBtn'),
  fitLogsBtnHud: document.getElementById('fitLogsBtnHud'),
  versionBadgeTop: document.getElementById('versionBadgeTop'),
  versionBadgeMap: document.getElementById('versionBadgeMap'),
  placementPrompt: document.getElementById('placementPrompt'),
  placementPromptText: document.getElementById('placementPromptText'),
  cancelPlacementBtn: document.getElementById('cancelPlacementBtn'),
  toast: document.getElementById('toast'),
  formModal: document.getElementById('formModal'),
  closeFormBtn: document.getElementById('closeFormBtn'),
  cancelFormBtn: document.getElementById('cancelFormBtn'),
  repickLocationBtn: document.getElementById('repickLocationBtn'),
  logForm: document.getElementById('logForm'),
  locationText: document.getElementById('locationText'),
  emptyState: document.getElementById('emptyState'),
  logList: document.getElementById('logList'),
  logCountBadge: document.getElementById('logCountBadge'),
  logFormIntro: document.getElementById('logFormIntro'),
  waterbodyInput: document.getElementById('waterbodyInput'),
  waterbodyStatus: document.getElementById('waterbodyStatus'),
};

function init() {
  setVersionBadges();
  initMap();
  loadLogs();
  renderLogs();
  wireEvents();
  setDefaultFormValues();
}

function setVersionBadges() {
  if (els.versionBadgeTop) {
    els.versionBadgeTop.textContent = `v${APP_VERSION}`;
  }
  if (els.versionBadgeMap) {
    els.versionBadgeMap.textContent = `v${APP_VERSION}`;
  }
}

function initMap() {
  state.map = L.map('map', {
    zoomControl: true,
    preferCanvas: true,
  }).setView([46.6548, -87.5167], 10);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(state.map);

  state.markerLayer = L.layerGroup().addTo(state.map);
  state.map.on('click', onMapClick);
}

function wireEvents() {
  [els.addLogBtn, els.addLogBtnHud].forEach((button) => {
    if (button) {
      button.addEventListener('click', startPlacementMode);
    }
  });

  [els.fitLogsBtn, els.fitLogsBtnHud].forEach((button) => {
    if (button) {
      button.addEventListener('click', fitAllLogs);
    }
  });

  els.cancelPlacementBtn.addEventListener('click', cancelPlacementMode);
  els.closeFormBtn.addEventListener('click', cancelForm);
  els.cancelFormBtn.addEventListener('click', cancelForm);
  els.repickLocationBtn.addEventListener('click', repickLocation);
  els.logForm.addEventListener('submit', onSubmitLogForm);

  els.formModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeModal === 'true') {
      cancelForm();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (!els.formModal.classList.contains('hidden')) {
      cancelForm();
      return;
    }

    if (state.isPlacing) {
      cancelPlacementMode();
    }
  });
}

function startPlacementMode() {
  state.isPlacing = true;
  state.wasRepicking = false;
  document.body.classList.add('is-placing');
  els.placementPromptText.textContent = getPickInstructionText();
  els.placementPrompt.classList.remove('hidden');
  showToast('Placement mode on. Pick a spot on the map.');
}

function cancelPlacementMode() {
  state.isPlacing = false;
  state.wasRepicking = false;
  document.body.classList.remove('is-placing');
  els.placementPrompt.classList.add('hidden');
  hideToast();
}

function onMapClick(event) {
  if (!state.isPlacing) {
    return;
  }

  state.pendingLatLng = { lat: event.latlng.lat, lng: event.latlng.lng };
  placePendingMarker(event.latlng);
  cancelPlacementMode();
  openForm();
  startWaterbodyLookup(state.pendingLatLng);
}

function placePendingMarker(latlng) {
  removePendingMarker();
  state.pendingMarker = L.marker(latlng, { draggable: false, opacity: 0.95 }).addTo(state.map);
  state.pendingMarker.bindPopup(
    '<div class="popup-title">New log spot</div><div class="popup-line">Fill out the form to save it.</div>'
  );
}

function removePendingMarker() {
  if (!state.pendingMarker) {
    return;
  }
  state.map.removeLayer(state.pendingMarker);
  state.pendingMarker = null;
}

function openForm() {
  if (!state.pendingLatLng) {
    showToast('Pick a spot on the map first.');
    return;
  }

  els.locationText.textContent = formatLatLng(state.pendingLatLng.lat, state.pendingLatLng.lng);
  els.logFormIntro.textContent = state.wasRepicking
    ? 'Spot updated. Finish the rest here.'
    : 'Spot locked. Now add the details.';
  els.formModal.classList.remove('hidden');
  els.formModal.setAttribute('aria-hidden', 'false');
  setWaterbodyStatus('Trying to identify the nearby named water feature…', 'info');

  requestAnimationFrame(() => {
    const firstInput = els.logForm.querySelector('input[name="date"]');
    firstInput?.focus();
  });
}

function closeForm() {
  els.formModal.classList.add('hidden');
  els.formModal.setAttribute('aria-hidden', 'true');
}

function cancelForm() {
  closeForm();
  state.waterLookupRequestId += 1;
  resetForm();
  removePendingMarker();
  state.pendingLatLng = null;
  state.wasRepicking = false;
  hideToast();
}

function repickLocation() {
  closeForm();
  state.wasRepicking = true;
  startPlacementMode();
  showToast('Pick a new spot on the map.');
}

function onSubmitLogForm(event) {
  event.preventDefault();

  if (!state.pendingLatLng) {
    showToast('No map location selected.');
    return;
  }

  const formData = new FormData(els.logForm);
  const log = {
    id: buildId(),
    createdAt: new Date().toISOString(),
    lat: state.pendingLatLng.lat,
    lng: state.pendingLatLng.lng,
    date: formData.get('date') || '',
    time: formData.get('time') || '',
    species: trim(formData.get('species')),
    waterbody: trim(formData.get('waterbody')),
    flyLure: trim(formData.get('flyLure')),
    color: trim(formData.get('color')),
    retrieveSpeed: trim(formData.get('retrieveSpeed')),
    result: trim(formData.get('result')),
    airTemp: trim(formData.get('airTemp')),
    waterTemp: trim(formData.get('waterTemp')),
    notes: trim(formData.get('notes')),
  };

  state.logs.unshift(log);
  saveLogs();
  addSavedMarker(log);
  renderLogs();
  closeForm();
  resetForm();
  removePendingMarker();
  state.pendingLatLng = null;
  state.wasRepicking = false;
  flyToLog(log.id);
  showToast('Log saved.');
}

function buildId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function addSavedMarker(log) {
  const marker = L.marker([log.lat, log.lng]).addTo(state.markerLayer);
  marker.bindPopup(buildPopupHtml(log));
  state.markersById.set(log.id, marker);
}

function buildPopupHtml(log) {
  const lines = [
    `<div class="popup-title">${escapeHtml(log.species || 'Fishing log')}</div>`,
    log.waterbody ? `<div class="popup-line"><strong>Water:</strong> ${escapeHtml(log.waterbody)}</div>` : '',
    log.date ? `<div class="popup-line"><strong>Date:</strong> ${escapeHtml(formatDisplayDate(log.date, log.time))}</div>` : '',
    log.flyLure ? `<div class="popup-line"><strong>Fly / Lure:</strong> ${escapeHtml(log.flyLure)}${log.color ? ` (${escapeHtml(log.color)})` : ''}</div>` : '',
    log.retrieveSpeed ? `<div class="popup-line"><strong>Retrieve:</strong> ${escapeHtml(log.retrieveSpeed)}</div>` : '',
    log.result ? `<div class="popup-line"><strong>Result:</strong> ${escapeHtml(log.result)}</div>` : '',
    log.notes ? `<div class="popup-line">${escapeHtml(log.notes)}</div>` : '',
  ];
  return lines.filter(Boolean).join('');
}

function renderLogs() {
  els.logList.innerHTML = '';
  els.logCountBadge.textContent = String(state.logs.length);
  els.emptyState.classList.toggle('hidden', state.logs.length > 0);

  state.logs.forEach((log) => {
    const card = document.createElement('article');
    card.className = 'log-card';
    card.innerHTML = `
      <h3>${escapeHtml(log.species || 'Fishing log')}</h3>
      <div class="log-meta">${escapeHtml(formatDisplayDate(log.date, log.time))}${log.waterbody ? ` · ${escapeHtml(log.waterbody)}` : ''}</div>
      <div class="log-meta">${log.flyLure ? escapeHtml(log.flyLure) : 'No lure/fly entered'}${log.color ? ` · ${escapeHtml(log.color)}` : ''}${log.retrieveSpeed ? ` · ${escapeHtml(log.retrieveSpeed)}` : ''}</div>
      ${log.notes ? `<div class="log-notes">${escapeHtml(log.notes)}</div>` : ''}
      <div class="log-actions">
        <button class="button" type="button" data-action="fly-to" data-log-id="${log.id}">Go to Spot</button>
        <button class="button" type="button" data-action="delete" data-log-id="${log.id}">Delete</button>
      </div>
    `;
    els.logList.appendChild(card);
  });

  els.logList.querySelectorAll('[data-action="fly-to"]').forEach((button) => {
    button.addEventListener('click', () => flyToLog(button.dataset.logId));
  });

  els.logList.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => deleteLog(button.dataset.logId));
  });
}

function flyToLog(logId) {
  const log = state.logs.find((item) => item.id === logId);
  const marker = state.markersById.get(logId);
  if (!log) {
    return;
  }

  state.map.flyTo([log.lat, log.lng], Math.max(state.map.getZoom(), 13), { duration: 0.65 });
  if (marker) {
    setTimeout(() => marker.openPopup(), 250);
  }
}

function deleteLog(logId) {
  state.logs = state.logs.filter((log) => log.id !== logId);
  saveLogs();

  const marker = state.markersById.get(logId);
  if (marker) {
    state.markerLayer.removeLayer(marker);
    state.markersById.delete(logId);
  }

  renderLogs();
  showToast('Log deleted.');
}

function fitAllLogs() {
  if (!state.logs.length) {
    showToast('No saved logs to show yet.');
    return;
  }

  const bounds = L.latLngBounds(state.logs.map((log) => [log.lat, log.lng]));
  state.map.fitBounds(bounds.pad(0.2));
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.logs = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Could not load saved logs:', error);
    state.logs = [];
  }

  state.logs.forEach(addSavedMarker);
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.logs));
}

function resetForm() {
  els.logForm.reset();
  setDefaultFormValues();
  els.locationText.textContent = 'Not set';
  setWaterbodyStatus('No nearby water selected yet.', 'muted');
}

function setDefaultFormValues() {
  const now = new Date();
  const dateInput = els.logForm.querySelector('input[name="date"]');
  const timeInput = els.logForm.querySelector('input[name="time"]');
  if (dateInput) {
    dateInput.value = now.toISOString().slice(0, 10);
  }
  if (timeInput) {
    timeInput.value = now.toTimeString().slice(0, 5);
  }
}


function setWaterbodyStatus(message, tone = 'muted') {
  if (!els.waterbodyStatus) {
    return;
  }
  els.waterbodyStatus.textContent = message;
  els.waterbodyStatus.dataset.tone = tone;
}

async function startWaterbodyLookup(latlng) {
  const requestId = ++state.waterLookupRequestId;
  const initialFieldValue = trim(els.waterbodyInput?.value);
  setWaterbodyStatus('Trying to identify the nearby named water feature…', 'info');

  try {
    const feature = await lookupNearbyWaterFeature(latlng.lat, latlng.lng);

    if (requestId !== state.waterLookupRequestId) {
      return;
    }

    const currentFieldValue = trim(els.waterbodyInput?.value);
    const fieldStillAutoFillSafe = !currentFieldValue || currentFieldValue === initialFieldValue;

    if (!feature) {
      setWaterbodyStatus('No confident nearby named water feature found. Enter it manually if needed.', 'muted');
      return;
    }

    if (fieldStillAutoFillSafe && els.waterbodyInput) {
      els.waterbodyInput.value = feature.name;
      setWaterbodyStatus(`Auto-filled from nearby map data: ${feature.name}.`, 'success');
      return;
    }

    setWaterbodyStatus(`Nearby match found: ${feature.name}. Leaving your typed value alone.`, 'info');
  } catch (error) {
    console.warn('Waterbody lookup failed:', error);
    if (requestId !== state.waterLookupRequestId) {
      return;
    }
    setWaterbodyStatus('Could not reach map data for auto-fill. You can still type the water name manually.', 'warning');
  }
}

async function lookupNearbyWaterFeature(lat, lng) {
  const query = buildWaterQuery(lat, lng);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        body: query,
      }, 12000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      return pickBestWaterFeature(payload?.elements || [], lat, lng);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Water lookup failed.');
}

function buildWaterQuery(lat, lng) {
  const radiusMeters = 450;
  return `[out:json][timeout:12];
(
  node(around:${radiusMeters},${lat},${lng})["waterway"]["name"];
  way(around:${radiusMeters},${lat},${lng})["waterway"]["name"];
  node(around:${radiusMeters},${lat},${lng})["natural"="water"]["name"];
  way(around:${radiusMeters},${lat},${lng})["natural"="water"]["name"];
  node(around:${radiusMeters},${lat},${lng})["water"]["name"];
  way(around:${radiusMeters},${lat},${lng})["water"]["name"];
);
out geom tags;`;
}

function pickBestWaterFeature(elements, lat, lng) {
  const ranked = elements
    .map((element) => scoreWaterFeature(element, lat, lng))
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  if (!ranked.length) {
    return null;
  }

  const best = ranked[0];
  if (best.distanceMeters > 650) {
    return null;
  }

  return {
    name: best.name,
    distanceMeters: Math.round(best.distanceMeters),
    kind: best.kind,
  };
}

function scoreWaterFeature(element, lat, lng) {
  const tags = element?.tags || {};
  const name = trim(tags.name);
  if (!name) {
    return null;
  }

  const kind = classifyWaterFeature(tags);
  if (kind === 'ignore') {
    return null;
  }

  const distanceMeters = computeFeatureDistanceMeters(element, lat, lng);
  if (!Number.isFinite(distanceMeters)) {
    return null;
  }

  const typeWeight = {
    river: 0,
    stream: 25,
    lake: 50,
    pond: 70,
    bay: 60,
    wetland: 140,
    harbor: 100,
    generic: 120,
  }[kind] ?? 120;

  return {
    name,
    kind,
    distanceMeters,
    score: distanceMeters + typeWeight,
  };
}

function classifyWaterFeature(tags) {
  const waterway = trim(tags.waterway).toLowerCase();
  const natural = trim(tags.natural).toLowerCase();
  const water = trim(tags.water).toLowerCase();

  if (['drain', 'ditch', 'dock'].includes(waterway)) {
    return 'ignore';
  }
  if (['river', 'canal'].includes(waterway)) {
    return 'river';
  }
  if (['stream', 'brook'].includes(waterway)) {
    return 'stream';
  }
  if (['lake', 'reservoir'].includes(water) || (natural === 'water' && !waterway && ['lake', 'reservoir'].includes(water))) {
    return 'lake';
  }
  if (['pond', 'lagoon', 'basin'].includes(water)) {
    return 'pond';
  }
  if (['bay', 'strait', 'fjord'].includes(water)) {
    return 'bay';
  }
  if (['wetland', 'marsh', 'swamp'].includes(natural) || water === 'wetland') {
    return 'wetland';
  }
  if (water === 'harbor') {
    return 'harbor';
  }
  if (natural === 'water' || waterway || water) {
    return 'generic';
  }
  return 'ignore';
}

function computeFeatureDistanceMeters(element, lat, lng) {
  if (Array.isArray(element?.geometry) && element.geometry.length) {
    let min = Number.POSITIVE_INFINITY;
    for (const point of element.geometry) {
      const d = distanceMeters(lat, lng, point.lat, point.lon);
      if (d < min) {
        min = d;
      }
    }
    return min;
  }

  if (typeof element?.lat === 'number' && typeof element?.lon === 'number') {
    return distanceMeters(lat, lng, element.lat, element.lon);
  }

  if (typeof element?.center?.lat === 'number' && typeof element?.center?.lon === 'number') {
    return distanceMeters(lat, lng, element.center.lat, element.center.lon);
  }

  return Number.POSITIVE_INFINITY;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (value) => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => window.clearTimeout(timer));
}

function getPickInstructionText() {
  const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(hover: hover)').matches;
  return `${isTouchPrimary ? 'Tap' : 'Click'} the map where you want to place this log. Press Esc or Cancel to back out.`;
}

function formatLatLng(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function formatDisplayDate(date, time) {
  if (!date) {
    return 'Undated';
  }
  return time ? `${date} at ${time}` : date;
}

function trim(value) {
  return String(value || '').trim();
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(hideToast, 2600);
}

function hideToast() {
  els.toast.classList.add('hidden');
}

init();
