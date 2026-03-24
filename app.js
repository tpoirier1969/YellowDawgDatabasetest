const APP_VERSION='v10.8';
const FISHING_STORAGE_KEY='fishingLogbook.entries';
const FISHING_LEGACY_STORAGE_KEYS=['fishMapTestV10.entries'];
const OVERPASS_URL='https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_METERS=1200;
const NOMINATIM_REVERSE_URL='https://nominatim.openstreetmap.org/reverse';
const DEFAULT_CENTER=[46.62,-87.67];
const DEFAULT_ZOOM=9;
const DEFAULT_LOG_ZOOM=14;
const CURRENT_ANGLER=localStorage.getItem('fishingLogbook.currentAngler')||localStorage.getItem('fishMap.currentAngler')||'Tod';
const DEFAULT_FISHING_SUPABASE_CONFIG={url:'',anonKey:'',table:'fishing_catch_logs',appId:'fishing_logbook_shared',autoSyncOnLoad:true,autoSyncOnSave:true};
const FLY_TYPES=['Dry','Nymph','Streamer','Emerger','Wet Fly','Terrestrial','Other'];
const LURE_TYPES=['Spoon','Plug / Crankbait','Spinner','Jerkbait','Soft Plastic','Jig','Swimbait','Topwater','Other'];
const LIVE_BAIT_TYPES=['Minnow','Crawler','Worm','Cut Bait','Spawn','Waxworm / Wiggler','Leech','Grasshopper','Other'];
const MIDWEST_FISH_SPECIES=[
  'Atlantic Salmon','Black Crappie','Bluegill','Bowfin','Brook Trout','Brown Trout','Bullhead','Burbot','Channel Catfish',
  'Chinook Salmon','Cisco','Coho Salmon','Common Carp','Flathead Catfish','Freshwater Drum','Gar','Hybrid Striped Bass',
  'Lake Sturgeon','Lake Trout','Lake Whitefish','Largemouth Bass','Muskellunge','Northern Pike','Pumpkinseed',
  'Rainbow Trout / Steelhead','Rock Bass','Sauger','Smallmouth Bass','Splake','Sunfish','Walleye','White Bass','White Crappie','Yellow Perch'
];

const GREAT_LAKE_FALLBACKS=[
  {name:'Lake Superior', minLat:46.20, maxLat:48.45, minLng:-92.35, maxLng:-84.20},
  {name:'Lake Michigan', minLat:41.55, maxLat:46.20, minLng:-88.40, maxLng:-85.00},
  {name:'Lake Huron', minLat:43.00, maxLat:46.60, minLng:-84.95, maxLng:-79.55},
  {name:'Lake Erie', minLat:41.20, maxLat:42.95, minLng:-83.65, maxLng:-78.75},
  {name:'Lake Ontario', minLat:43.10, maxLat:44.55, minLng:-79.95, maxLng:-76.05}
];

const state={
  entries:loadEntries(),
  markerCluster:null,
  currentDraftMarker:null,
  currentDraftMeta:{source:'',accuracy:null},
  addMode:false,
  pendingLocationRequestId:0,
  filters:{dateFrom:'',dateTo:'',species:'',color:'',sky:'',retrieveSpeed:''},
  cloud:{configured:false,ready:false,syncing:false,status:'Local only',lastSyncAt:'',lastError:'',client:null,table:DEFAULT_FISHING_SUPABASE_CONFIG.table,appId:DEFAULT_FISHING_SUPABASE_CONFIG.appId,autoSyncOnSave:true}
};

const $=id=>document.getElementById(id);
const map=L.map('map',{zoomControl:true,preferCanvas:true}).setView(DEFAULT_CENTER,DEFAULT_ZOOM);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
state.markerCluster=L.markerClusterGroup();
map.addLayer(state.markerCluster);

function setOptions(select, values, placeholder='Choose one'){

function getFishingSupabaseConfig(){
  const cfg=(window.FISHING_SUPABASE_CONFIG && typeof window.FISHING_SUPABASE_CONFIG==='object') ? window.FISHING_SUPABASE_CONFIG : {};
  return {
    url:String(cfg.url || '').trim(),
    anonKey:String(cfg.anonKey || cfg.publishableKey || '').trim(),
    table:String(cfg.table || DEFAULT_FISHING_SUPABASE_CONFIG.table).trim() || DEFAULT_FISHING_SUPABASE_CONFIG.table,
    appId:String(cfg.appId || DEFAULT_FISHING_SUPABASE_CONFIG.appId).trim() || DEFAULT_FISHING_SUPABASE_CONFIG.appId,
    autoSyncOnLoad:cfg.autoSyncOnLoad!==false,
    autoSyncOnSave:cfg.autoSyncOnSave!==false
  };
}

function cloudIsConfigured(){
  const cfg=getFishingSupabaseConfig();
  return !!(cfg.url && cfg.anonKey && window.supabase && typeof window.supabase.createClient==='function');
}

function formatCloudSyncTime(value=''){
  if(!value) return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function updateCloudUi(){
  const cloudBtn=$('cloudBtn');
  const cloudBadge=$('cloudBadge');
  const cloudSummary=$('cloudSummary');
  let badgeText='Local only';
  let buttonText='Cloud Setup';
  let summary='Local-only mode. Add Supabase details in supabase-config.js to share logs across devices.';

  if(state.cloud.syncing){
    badgeText='Cloud syncing…';
    buttonText='Syncing…';
    summary='Syncing local and shared logs now.';
  }else if(state.cloud.ready){
    badgeText='Cloud connected';
    buttonText='Sync Cloud';
    summary=`Shared database connected. ${state.cloud.lastSyncAt ? 'Last sync: ' + formatCloudSyncTime(state.cloud.lastSyncAt) + '.' : 'Ready to sync.'}`;
  }else if(state.cloud.configured){
    badgeText='Cloud error';
    buttonText='Retry Cloud';
    summary=`Cloud is configured but not connected${state.cloud.lastError ? ': ' + state.cloud.lastError : '.'}`;
  }

  if(cloudBtn){
    cloudBtn.textContent=buttonText;
    cloudBtn.disabled=state.cloud.syncing;
  }
  if(cloudBadge) cloudBadge.textContent=badgeText;
  if(cloudSummary) cloudSummary.textContent=summary;
  const reviewSubcopy=$('reviewSubcopy');
  if(reviewSubcopy){
    reviewSubcopy.textContent=state.cloud.ready ? 'Shared logs are available across devices when cloud sync is on.' : 'Saved logs stay tucked away until you want them. Cloud sync is optional.';
  }
}

function normalizeEntry(entry={}){
  const marker=entry.marker && typeof entry.marker==='object' ? entry.marker : {};
  return {
    ...entry,
    id:String(entry.id || getSafeRandomId()),
    owner:String(entry.owner || CURRENT_ANGLER),
    createdAt:entry.createdAt || new Date().toISOString(),
    waypointName:entry.waypointName || '',
    baitSubtype:entry.baitSubtype || '',
    additionalColor:entry.additionalColor || '',
    baitSize:entry.baitSize || '',
    weight:entry.weight || '',
    quantity:Number(entry.quantity || 1),
    airTemp:entry.airTemp==='' || entry.airTemp==null ? null : Number(entry.airTemp),
    waterTemp:entry.waterTemp==='' || entry.waterTemp==null ? null : Number(entry.waterTemp),
    hatches:entry.hatches || '',
    notes:entry.notes || '',
    locationSource:entry.locationSource || '',
    markerAccuracy:entry.markerAccuracy==='' || entry.markerAccuracy==null ? null : Number(entry.markerAccuracy),
    marker:{lat:Number(marker.lat || 0), lng:Number(marker.lng || 0)}
  };
}

function normalizeEntryArray(entries=[]){
  if(!Array.isArray(entries)) return [];
  return entries.map(normalizeEntry).filter(entry=>Number.isFinite(entry.marker.lat) && Number.isFinite(entry.marker.lng)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

function mergeEntries(localEntries=[], remoteEntries=[]){
  const mapById=new Map();
  [...localEntries, ...remoteEntries].forEach(raw=>{
    const entry=normalizeEntry(raw);
    const prior=mapById.get(entry.id);
    if(!prior){
      mapById.set(entry.id, entry);
      return;
    }
    const priorStamp=Date.parse(prior.createdAt || 0) || 0;
    const entryStamp=Date.parse(entry.createdAt || 0) || 0;
    if(entryStamp>=priorStamp) mapById.set(entry.id, entry);
  });
  return [...mapById.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

function entryToCloudRow(entry){
  return {
    id:entry.id,
    app_id:state.cloud.appId,
    owner_name:entry.owner || CURRENT_ANGLER,
    created_at:entry.createdAt,
    log_date:entry.date,
    time_of_day:entry.timeOfDay,
    water_name:entry.waterName,
    waypoint_name:entry.waypointName || null,
    bait_type:entry.baitType,
    bait_subtype:entry.baitSubtype || null,
    bait_name:entry.baitName,
    main_color:entry.mainColor || null,
    additional_color:entry.additionalColor || null,
    bait_size:entry.baitSize || null,
    species:entry.species,
    size_inches:entry.sizeInches,
    weight:entry.weight || null,
    quantity:entry.quantity || 1,
    air_temp:entry.airTemp,
    water_temp:entry.waterTemp,
    sky_condition:entry.skyCondition || null,
    water_condition:entry.waterCondition || null,
    water_clarity:entry.waterClarity || null,
    depth_zone:entry.depthZone || null,
    retrieve_speed:entry.retrieveSpeed || null,
    presentation_style:entry.presentationStyle || null,
    structure_type:entry.structureType || null,
    hatches:entry.hatches || null,
    notes:entry.notes || null,
    location_source:entry.locationSource || null,
    marker_accuracy:entry.markerAccuracy,
    marker_lat:entry.marker.lat,
    marker_lng:entry.marker.lng,
    updated_at:new Date().toISOString()
  };
}

function cloudRowToEntry(row){
  return normalizeEntry({
    id:row.id,
    owner:row.owner_name || CURRENT_ANGLER,
    createdAt:row.created_at,
    date:row.log_date,
    timeOfDay:row.time_of_day,
    waterName:row.water_name,
    waypointName:row.waypoint_name || '',
    baitType:row.bait_type,
    baitSubtype:row.bait_subtype || '',
    baitName:row.bait_name,
    mainColor:row.main_color || '',
    additionalColor:row.additional_color || '',
    baitSize:row.bait_size || '',
    species:row.species,
    sizeInches:Number(row.size_inches || 0),
    weight:row.weight || '',
    quantity:Number(row.quantity || 1),
    airTemp:row.air_temp,
    waterTemp:row.water_temp,
    skyCondition:row.sky_condition || '',
    waterCondition:row.water_condition || '',
    waterClarity:row.water_clarity || '',
    depthZone:row.depth_zone || '',
    retrieveSpeed:row.retrieve_speed || '',
    presentationStyle:row.presentation_style || '',
    structureType:row.structure_type || '',
    hatches:row.hatches || '',
    notes:row.notes || '',
    locationSource:row.location_source || '',
    markerAccuracy:row.marker_accuracy,
    marker:{lat:Number(row.marker_lat || 0), lng:Number(row.marker_lng || 0)}
  });
}

async function initCloud({syncOnLoad=true}={}){
  const cfg=getFishingSupabaseConfig();
  state.cloud.configured=cloudIsConfigured();
  state.cloud.table=cfg.table;
  state.cloud.appId=cfg.appId;
  state.cloud.autoSyncOnSave=cfg.autoSyncOnSave;
  state.cloud.lastError='';
  if(!state.cloud.configured){
    state.cloud.ready=false;
    state.cloud.client=null;
    updateCloudUi();
    return false;
  }
  try{
    state.cloud.client=window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}
    });
    state.cloud.ready=true;
    updateCloudUi();
    if(syncOnLoad && cfg.autoSyncOnLoad) await syncCloud({quiet:true});
    return true;
  }catch(error){
    state.cloud.ready=false;
    state.cloud.client=null;
    state.cloud.lastError=error?.message || 'unknown error';
    updateCloudUi();
    return false;
  }
}

async function syncCloud({quiet=false}={}){
  if(!state.cloud.ready){
    const ok=await initCloud({syncOnLoad:false});
    if(!ok){
      if(!quiet) alert('Cloud sync is not configured yet. Add your Supabase URL and anon/publishable key in supabase-config.js.');
      return false;
    }
  }
  if(state.cloud.syncing) return false;
  state.cloud.syncing=true;
  updateCloudUi();
  if(!quiet) setStatus('Syncing shared logs…', 2600);
  try{
    const rows=normalizeEntryArray(state.entries).map(entryToCloudRow);
    if(rows.length){
      const {error:pushError}=await state.cloud.client.from(state.cloud.table).upsert(rows, {onConflict:'id'});
      if(pushError) throw pushError;
    }
    const {data,error}=await state.cloud.client.from(state.cloud.table).select('*').eq('app_id', state.cloud.appId).order('created_at', {ascending:false});
    if(error) throw error;
    state.entries=mergeEntries(state.entries, (data||[]).map(cloudRowToEntry));
    persistEntries();
    render();
    state.cloud.lastSyncAt=new Date().toISOString();
    state.cloud.lastError='';
    updateCloudUi();
    if(!quiet) setStatus(`Cloud synced: ${state.entries.length} logs available.`, 3600);
    return true;
  }catch(error){
    state.cloud.lastError=error?.message || 'unknown error';
    state.cloud.ready=false;
    updateCloudUi();
    if(!quiet){
      alert(`Cloud sync failed: ${state.cloud.lastError}`);
      setStatus(`Cloud sync failed: ${state.cloud.lastError}`, 4200);
    }
    return false;
  }finally{
    state.cloud.syncing=false;
    updateCloudUi();
  }
}

async function deleteCloudEntry(entryId){
  if(!state.cloud.ready || !entryId) return false;
  try{
    const {error}=await state.cloud.client.from(state.cloud.table).delete().eq('id', entryId).eq('app_id', state.cloud.appId);
    if(error) throw error;
    state.cloud.lastSyncAt=new Date().toISOString();
    state.cloud.lastError='';
    updateCloudUi();
    return true;
  }catch(error){
    state.cloud.lastError=error?.message || 'unknown error';
    updateCloudUi();
    return false;
  }
}

function validateLogForm(){
  const requiredChecks=[
    ['date',$('date').value],
    ['Time of Day',$('timeOfDay').value],
    ['Body of Water',$('waterName').value.trim()],
    ['Sky',$('skyCondition').value],
    ['Water Conditions',$('waterCondition').value],
    ['Water Clarity',$('waterClarity').value],
    ['Depth Zone',$('depthZone').value],
    ['Presentation Style',$('presentationStyle').value],
    ['Structure Type',$('structureType').value],
    ['Bait Type',$('baitType').value],
    ['Main Color',$('mainColor').value],
    ['Retrieve Speed',$('retrieveSpeed').value],
    ['Species',$('species').value],
    ['Size (inches)',$('sizeInches').value],
    ['Quantity',$('quantity').value]
  ];
  for(const [label, value] of requiredChecks){
    if(!String(value || '').trim()) return label;
  }
  if($('baitType').value==='Fly'){
    if(!$('baitSubtype').value) return 'Fly Type';
    if(!$('baitName').value.trim()) return 'Fly Pattern';
    if(!$('baitSize').value) return 'Fly Size';
  }
  if($('baitType').value==='Lure'){
    if(!$('baitSubtype').value) return 'Lure Type';
    if(!$('baitName').value.trim()) return 'Lure Name';
  }
  if($('baitType').value==='Live Bait' && !$('baitSubtype').value) return 'Bait Type';
  if(!state.currentDraftMarker) return 'Fishing Spot';
  return '';
}

  if(!select) return;
  select.innerHTML=`<option value="">${placeholder}</option>`;
  values.forEach(v=>{
    const o=document.createElement('option');
    o.value=v;
    o.textContent=v;
    select.appendChild(o);
  });
}

function populateSpeciesOptions(){
  const formValue=$('species').value;
  const filterValue=$('filterSpecies').value;
  setOptions($('species'), MIDWEST_FISH_SPECIES, 'Choose one');
  setOptions($('filterSpecies'), MIDWEST_FISH_SPECIES, 'All');
  if(formValue && MIDWEST_FISH_SPECIES.includes(formValue)) $('species').value=formValue;
  if(filterValue && MIDWEST_FISH_SPECIES.includes(filterValue)) $('filterSpecies').value=filterValue;
}

function setLabelText(labelEl, text){
  if(!labelEl) return;
  const firstText=[...labelEl.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
  if(firstText){
    firstText.textContent=text;
  }else{
    labelEl.insertBefore(document.createTextNode(text), labelEl.firstChild);
  }
}

function syncAddLogButton(){
  const btn=$('addLogBtn');
  if(!btn) return;
  btn.textContent=state.addMode ? 'Tap Map to Set Spot' : 'Add Log';
  btn.classList.toggle('primary', !state.addMode);
}

function cancelAddMode(message=''){
  state.addMode=false;
  syncAddLogButton();
  if(message) setStatus(message, 3200);
}

function beginAddLog(){
  cancelAddMode();
  closeSheet($('reviewSheet'));
  closeSheet($('filterSheet'));
  if(state.currentDraftMarker){
    openSheet($('logSheet'));
    const ll=state.currentDraftMarker.getLatLng();
    updateLocationSummary(ll.lat, ll.lng, state.currentDraftMeta.accuracy, state.currentDraftMeta.source);
    $('waterLookupStatus').textContent='Spot already set. You can use your location again, drag the marker, or pick a new spot on the map.';
    setStatus('Log opened with your current spot.', 2600);
    return;
  }
  closeSheet($('logSheet'));
  if(supportsGeolocation()){
    $('waterLookupStatus').textContent='Getting your device location before opening the log...';
    setStatus('Getting your location...', 2600);
    useCurrentLocation({auto:true, confirmBeforeOpen:true});
  }else{
    openSheet($('logSheet'));
    $('waterLookupStatus').textContent='This browser does not support device location here. Use Pick on Map.';
    setStatus('Use Pick on Map to set the spot.', 3200);
  }
}

function beginPickOnMap(){
  state.pendingLocationRequestId+=1;
  state.addMode=true;
  syncAddLogButton();
  closeSheet($('logSheet'));
  closeSheet($('reviewSheet'));
  closeSheet($('filterSheet'));
  $('waterLookupStatus').textContent=state.currentDraftMarker ? 'Tap the map once to move the spot.' : 'Tap the map to set a fishing spot.';
  setStatus(state.currentDraftMarker ? 'Tap the map once to move the spot.' : 'Tap the map to set a fishing spot.', 5200);
}

function supportsGeolocation(){
  return typeof navigator!=='undefined' && !!navigator.geolocation;
}

function setLocationControlsDisabled(isDisabled){
  ['useDeviceLocationBtn'].forEach(id=>{
    const el=$(id);
    if(el) el.disabled=isDisabled;
  });
}

function getGeoErrorMessage(error){
  if(!error) return 'unknown error';
  if(error.code===1) return 'permission denied';
  if(error.code===2) return 'position unavailable';
  if(error.code===3) return 'timed out';
  return error.message || 'unknown error';
}

function locationSourceLabel(source=''){
  if(source==='device') return 'Device GPS';
  if(source==='map') return 'Map-picked';
  if(source==='adjusted') return 'Adjusted marker';
  return 'Spot';
}

function formatCoord(value){
  return Number(value).toFixed(5);
}

function updateLocationSummary(lat,lng,accuracy=null,source=''){
  const summary=$('locationSummary');
  if(typeof lat!=='number' || typeof lng!=='number'){
    summary.textContent='';
    summary.classList.add('hidden');
    return;
  }
  const bits=[locationSourceLabel(source), `${formatCoord(lat)}, ${formatCoord(lng)}`];
  if(Number.isFinite(accuracy)) bits.push(`±${Math.round(accuracy)} m`);
  summary.textContent=bits.join(' · ');
  summary.classList.remove('hidden');
}

function updateDraftMarkerPopup(){
  if(!state.currentDraftMarker) return;
  const ll=state.currentDraftMarker.getLatLng();
  const bits=[locationSourceLabel(state.currentDraftMeta.source), `${formatCoord(ll.lat)}, ${formatCoord(ll.lng)}`];
  if(Number.isFinite(state.currentDraftMeta.accuracy)) bits.push(`±${Math.round(state.currentDraftMeta.accuracy)} m`);
  state.currentDraftMarker.bindPopup(bits.join(' · '));
}

async function useCurrentLocation({auto=false, confirmBeforeOpen=false}={}){
  if(!supportsGeolocation()){
    $('waterLookupStatus').textContent='This browser does not support device location here. Use Pick on Map.';
    if(auto && confirmBeforeOpen) openSheet($('logSheet'));
    if(!auto) setStatus('No device location available in this browser.', 3200);
    return;
  }
  cancelAddMode();
  const requestId=++state.pendingLocationRequestId;
  setLocationControlsDisabled(true);
  $('waterLookupStatus').textContent='Requesting your device location...';
  navigator.geolocation.getCurrentPosition(async position=>{
    if(requestId!==state.pendingLocationRequestId){
      setLocationControlsDisabled(false);
      return;
    }
    const {latitude, longitude, accuracy}=position.coords;
    setDraftMarker(latitude, longitude, {source:'device', accuracy, recenter:true});
    map.setView([latitude, longitude], Math.max(map.getZoom(), DEFAULT_LOG_ZOOM));
    setLocationControlsDisabled(false);

    if(confirmBeforeOpen){
      const accuracyText=Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)} m)` : '';
      const useSpot=window.confirm(`Use your current location${accuracyText}?`);
      if(!useSpot){
        clearDraftMarker();
        beginPickOnMap();
        $('waterLookupStatus').textContent='Location not confirmed. Tap the map to choose the spot instead.';
        setStatus('Tap the map to choose your spot.', 3600);
        return;
      }
      openSheet($('logSheet'));
      closeSheet($('reviewSheet'));
      closeSheet($('filterSheet'));
      $('waterLookupStatus').textContent=`Using your device location${accuracyText}. Checking nearby water...`;
      await detectNearbyWater(latitude, longitude);
      setStatus('Location confirmed. Fill out the log and save it.', 3600);
      return;
    }

    $('waterLookupStatus').textContent=`Using your device location${Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)} m)` : ''}. Drag the marker or use Pick on Map if you need to tweak it.`;
    await detectNearbyWater(latitude, longitude);
    setStatus('Device location set.', 3200);
  }, error=>{
    if(requestId!==state.pendingLocationRequestId){
      setLocationControlsDisabled(false);
      return;
    }
    const message=getGeoErrorMessage(error);
    $('waterLookupStatus').textContent=`Could not get device location (${message}). Use Pick on Map instead.`;
    setLocationControlsDisabled(false);
    if(auto && confirmBeforeOpen){
      openSheet($('logSheet'));
      setStatus(`Location failed: ${message}. Pick a spot on the map.`, 4200);
      return;
    }
    if(!auto) setStatus(`Location failed: ${message}.`, 3600);
  }, {
    enableHighAccuracy:true,
    timeout:12000,
    maximumAge:30000
  });
}

function setBaitHelper(message=''){
  const helper=$('baitHelper');
  const clean=(message||'').trim();
  helper.textContent=clean;
  helper.classList.toggle('hidden', !clean);
}

const BAIT_COLOR_DEFAULTS={
  'Lure':{
    'Spoon':{main:'Silver',additional:''},
    'Plug / Crankbait':{main:'Silver',additional:''},
    'Spinner':{main:'Silver',additional:''},
    'Jerkbait':{main:'Silver',additional:''},
    'Soft Plastic':{main:'Green',additional:''},
    'Jig':{main:'White',additional:''},
    'Swimbait':{main:'Silver',additional:''},
    'Topwater':{main:'White',additional:''},
    'Other':{main:'Silver',additional:''}
  },
  'Live Bait':{
    'Minnow':{main:'Brown',additional:'Silver'},
    'Crawler':{main:'Brown',additional:''},
    'Worm':{main:'Brown',additional:''},
    'Cut Bait':{main:'White',additional:'Silver'},
    'Spawn':{main:'Pink',additional:'Orange'},
    'Waxworm / Wiggler':{main:'Cream',additional:'Brown'},
    'Leech':{main:'Black',additional:''},
    'Grasshopper':{main:'Green',additional:'Yellow'},
    'Other':{main:'Brown',additional:''}
  }
};

function getFlyReference(){
  return Array.isArray(window.FLY_REFERENCE) ? window.FLY_REFERENCE : [];
}

function findExactFly(name, subtype=''){
  const normalized=(name||'').trim().toLowerCase();
  if(!normalized) return null;
  return getFlyReference().find(item=>item.name.toLowerCase()===normalized && (!subtype || item.category===subtype)) || null;
}

function getFlyMatches(query='', subtype=''){
  const normalized=(query||'').trim().toLowerCase();
  return getFlyReference().filter(item=>{
    const subtypeOk=!subtype || item.category===subtype;
    const queryOk=!normalized || item.name.toLowerCase().includes(normalized);
    return subtypeOk && queryOk;
  });
}

function refreshFlySizeOptions(){
  if($('baitType').value!=='Fly'){
    $('baitSize').innerHTML='<option value="">Choose one</option>';
    return;
  }
  const subtype=$('baitSubtype').value;
  const exact=findExactFly($('baitName').value, subtype);
  let sizes=[];
  if(exact){
    sizes=exact.sizes||[];
  }else{
    const pool=subtype ? getFlyReference().filter(item=>item.category===subtype) : getFlyReference();
    sizes=[...new Set(pool.flatMap(item=>item.sizes||[]))].sort((a,b)=>Number(a)-Number(b));
  }
  setOptions($('baitSize'), sizes, sizes.length ? 'Choose fly size' : 'No sizes loaded');
}

function applySubtypeColorDefaults(){
  const type=$('baitType').value;
  const subtype=$('baitSubtype').value;
  if(type==='Fly' || !subtype) return;
  const defaults=BAIT_COLOR_DEFAULTS[type]?.[subtype];
  if(!defaults) return;
  $('mainColor').value=defaults.main || '';
  $('additionalColor').value=defaults.additional || '';
}

function applyBaitTypeUI(){
  const type=$('baitType').value;
  const baitSubtype=$('baitSubtype');
  const baitSize=$('baitSize');
  const baitName=$('baitName');
  $('nameSuggestions').classList.add('hidden');
  baitName.value='';
  baitSize.innerHTML='<option value="">Choose one</option>';
  setBaitHelper('');

  baitSubtype.disabled=false;
  baitSubtype.required=false;
  baitSize.disabled=true;
  baitSize.required=false;
  baitName.disabled=false;
  baitName.required=false;

  if(type==='Fly'){
    $('subtypeWrap').classList.remove('hidden');
    $('sizeWrap').classList.remove('hidden');
    $('nameWrap').classList.remove('hidden');
    setOptions(baitSubtype, FLY_TYPES, 'Choose fly type');
    setLabelText($('subtypeWrap'), 'Fly Type');
    setLabelText($('nameLabel'), 'Fly Pattern');
    baitSubtype.required=true;
    baitSize.disabled=false;
    baitSize.required=true;
    baitName.required=true;
    baitName.placeholder='Start typing fly name...';
    refreshFlySizeOptions();
  } else if(type==='Lure'){
    $('subtypeWrap').classList.remove('hidden');
    $('sizeWrap').classList.add('hidden');
    $('nameWrap').classList.remove('hidden');
    setOptions(baitSubtype, LURE_TYPES, 'Choose lure type');
    setLabelText($('subtypeWrap'), 'Lure Type');
    setLabelText($('nameLabel'), 'Lure Name');
    baitSubtype.required=true;
    baitName.required=true;
    baitName.placeholder='Type lure name...';
  } else if(type==='Live Bait'){
    $('subtypeWrap').classList.remove('hidden');
    $('sizeWrap').classList.add('hidden');
    $('nameWrap').classList.add('hidden');
    setOptions(baitSubtype, LIVE_BAIT_TYPES, 'Choose bait type');
    setLabelText($('subtypeWrap'), 'Bait Type');
    baitSubtype.required=true;
    baitName.disabled=true;
  } else {
    $('subtypeWrap').classList.remove('hidden');
    $('sizeWrap').classList.add('hidden');
    $('nameWrap').classList.remove('hidden');
    setOptions(baitSubtype, [], 'Choose one');
    setLabelText($('subtypeWrap'), 'Subtype');
    setLabelText($('nameLabel'), 'Name');
    baitName.placeholder='Choose bait type first...';
    baitName.disabled=true;
  }
}

function updateFlySuggestions(query){
  if($('baitType').value!=='Fly') return;
  const subtype=$('baitSubtype').value;
  const matches=getFlyMatches(query, subtype).slice(0,12);
  $('nameSuggestions').innerHTML='';
  if(!matches.length){
    $('nameSuggestions').classList.add('hidden');
    return;
  }
  matches.forEach(item=>{
    const div=document.createElement('div');
    div.className='suggestion-item';
    div.innerHTML=`<span class="suggestion-name">${escapeHtml(item.name)}</span><span class="suggestion-meta">${escapeHtml(item.category)} · sizes ${(item.sizes||[]).join(', ')}</span>`;
    div.addEventListener('click',()=>{
      applyFly(item);
      $('nameSuggestions').classList.add('hidden');
    });
    $('nameSuggestions').appendChild(div);
  });
  $('nameSuggestions').classList.remove('hidden');
}

function applyFly(item){
  $('baitName').value=item.name;
  $('baitSubtype').value=item.category || $('baitSubtype').value;
  if(item.primary?.length) $('mainColor').value=item.primary[0];
  if(item.secondary?.length) $('additionalColor').value=item.secondary[0];
  refreshFlySizeOptions();
  setBaitHelper(`${item.notes}. Suggested colors: ${[...(item.primary||[]), ...(item.secondary||[])].join(', ')}.`);
}

async function detectNearbyWater(lat,lng){
  $('waterLookupStatus').textContent='Checking Overpass for nearby rivers and lakes...';
  $('nearbyWaterWrap').classList.add('hidden');
  $('nearbyWaterSelect').innerHTML='<option value="">Choose one</option>';
  const query=`[out:json][timeout:25];(way["waterway"~"river|stream|canal|ditch"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});relation["waterway"~"river|stream|canal|ditch"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});way["natural"="water"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});relation["natural"="water"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});way["water"~"lake|pond|reservoir"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});relation["water"~"lake|pond|reservoir"](around:${OVERPASS_RADIUS_METERS},${lat},${lng});relation["place"="sea"](around:${OVERPASS_RADIUS_METERS},${lat},${lng}););out tags center;`;
  try{
    const response=await fetch(OVERPASS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:query});
    if(!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const data=await response.json();
    const candidates=normalizeWaterCandidates(data.elements||[],lat,lng);
    if(!candidates.length){
      const fallbackName=await fallbackNearbyWaterName(lat,lng);
      if(fallbackName){
        $('waterName').value=fallbackName;
        $('waterLookupStatus').textContent=`Fallback matched: ${fallbackName}.`;
        return;
      }
      $('waterLookupStatus').textContent='No named nearby water found. Type it manually if needed.';
      return;
    }
    if(candidates.length===1){
      $('waterName').value=candidates[0].name;
      $('waterLookupStatus').textContent=`Overpass matched: ${candidates[0].name}.`;
      return;
    }
    $('nearbyWaterWrap').classList.remove('hidden');
    candidates.forEach(c=>{
      const o=document.createElement('option');
      o.value=c.name;
      o.textContent=`${c.name} · ${c.featureLabel} · ${Math.round(c.distance)}m`;
      $('nearbyWaterSelect').appendChild(o);
    });
    $('nearbyWaterSelect').value=candidates[0].name;
    $('waterName').value=candidates[0].name;
    $('waterLookupStatus').textContent=`Overpass found ${candidates.length} nearby water features. Choose the right one if needed.`;
  }catch(error){
    const fallbackName=await fallbackNearbyWaterName(lat,lng);
    if(fallbackName){
      $('waterName').value=fallbackName;
      $('waterLookupStatus').textContent=`Overpass lookup failed, but fallback matched: ${fallbackName}.`;
      return;
    }
    $('waterLookupStatus').textContent=`Overpass lookup failed: ${error.message}. Type the body of water manually.`;
  }
}

function normalizeWaterCandidates(elements,lat,lng){
  const dedupe=new Map();
  for(const el of elements){
    const tags=el.tags||{};
    const name=(tags.name||'').trim();
    if(!name) continue;
    const centerLat=el.center?.lat ?? el.lat;
    const centerLng=el.center?.lon ?? el.lon;
    if(typeof centerLat!=='number' || typeof centerLng!=='number') continue;
    const featureLabel=tags.waterway ? capitalize(tags.waterway) : tags.water ? capitalize(tags.water) : 'Water';
    const distance=haversineMeters(lat,lng,centerLat,centerLng);
    const key=`${name.toLowerCase()}|${featureLabel.toLowerCase()}`;
    if(!dedupe.has(key) || dedupe.get(key).distance > distance){
      dedupe.set(key,{name,featureLabel,distance});
    }
  }
  return [...dedupe.values()].sort((a,b)=>a.distance-b.distance).slice(0,8);
}

function haversineMeters(lat1,lon1,lat2,lon2){
  const R=6371000;
  const toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}


async function fallbackNearbyWaterName(lat,lng){
  const reverseName=await reverseLookupWaterName(lat,lng);
  if(reverseName) return reverseName;
  return guessGreatLake(lat,lng);
}

async function reverseLookupWaterName(lat,lng){
  const params=new URLSearchParams({
    format:'jsonv2',
    lat:String(lat),
    lon:String(lng),
    zoom:'10',
    addressdetails:'1'
  });
  try{
    const response=await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`,{
      headers:{'Accept':'application/json'}
    });
    if(!response.ok) throw new Error(`reverse lookup returned ${response.status}`);
    const data=await response.json();
    return extractReverseWaterName(data);
  }catch{
    return '';
  }
}

function extractReverseWaterName(data){
  const address=data?.address || {};
  const direct=[
    address.body_of_water,
    address.water,
    address.sea,
    address.bay,
    address.lake,
    address.river,
    address.stream,
    address.reservoir,
    address.canal
  ].find(value=>typeof value==='string' && value.trim());
  if(direct) return direct.trim();

  const candidates=[data?.name, data?.display_name]
    .filter(value=>typeof value==='string' && value.trim())
    .flatMap(value=>value.split(','))
    .map(value=>value.trim())
    .filter(Boolean);

  return candidates.find(value=>/\b(lake|river|creek|stream|bay|harbor|pond|reservoir|ocean|sea|gulf|canal)\b/i.test(value)) || '';
}

function guessGreatLake(lat,lng){
  const match=GREAT_LAKE_FALLBACKS.find(lake=>lat>=lake.minLat && lat<=lake.maxLat && lng>=lake.minLng && lng<=lake.maxLng);
  return match ? match.name : '';
}

function getSafeRandomId(){
  try{
    if(typeof crypto!=='undefined' && crypto?.randomUUID) return crypto.randomUUID();
  }catch{}
  return `fishinglog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

function getLabelTextForControl(control){
  if(!(control instanceof HTMLElement)) return 'that field';
  const label=control.closest('label');
  if(label){
    const clone=label.cloneNode(true);
    clone.querySelectorAll('input, select, textarea, div').forEach(node=>node.remove());
    const text=clone.textContent.replace(/\s+/g,' ').trim();
    if(text) return text;
  }
  return control.getAttribute('name') || control.id || 'that field';
}

function setDraftMarker(lat,lng,{source='map',accuracy=null,recenter=false}={}){
  state.currentDraftMeta={source,accuracy:Number.isFinite(accuracy) ? accuracy : null};
  if(state.currentDraftMarker){
    state.currentDraftMarker.setLatLng([lat,lng]);
  }else{
    state.currentDraftMarker=L.marker([lat,lng],{draggable:true}).addTo(map);
    state.currentDraftMarker.on('dragend', async ()=>{
      const ll=state.currentDraftMarker.getLatLng();
      state.currentDraftMeta={source:'adjusted',accuracy:null};
      updateDraftMarkerPopup();
      updateLocationSummary(ll.lat,ll.lng,null,'adjusted');
      $('waterLookupStatus').textContent='Marker adjusted. Checking nearby water again...';
      await detectNearbyWater(ll.lat,ll.lng);
      setStatus('Spot adjusted.', 2600);
    });
  }
  if(recenter) map.setView([lat,lng], Math.max(map.getZoom(), DEFAULT_LOG_ZOOM));
  updateDraftMarkerPopup();
  updateLocationSummary(lat,lng,state.currentDraftMeta.accuracy,state.currentDraftMeta.source);
}

function getFilteredEntries(){
  return state.entries.filter(entry=>{
    if(state.filters.dateFrom && entry.date<state.filters.dateFrom) return false;
    if(state.filters.dateTo && entry.date>state.filters.dateTo) return false;
    if(state.filters.species && entry.species!==state.filters.species) return false;
    if(state.filters.color && entry.mainColor!==state.filters.color) return false;
    if(state.filters.sky && entry.skyCondition!==state.filters.sky) return false;
    if(state.filters.retrieveSpeed && entry.retrieveSpeed!==state.filters.retrieveSpeed) return false;
    return true;
  });
}

function render(){
  const visible=getFilteredEntries();
  state.markerCluster.clearLayers();
  visible.forEach(entry=>{
    const marker=L.marker([entry.marker.lat,entry.marker.lng]);
    const waypointLine=entry.waypointName ? `<br>${escapeHtml(entry.waypointName)}` : '';
    const coordLine=`<br>${escapeHtml(formatCoord(entry.marker.lat))}, ${escapeHtml(formatCoord(entry.marker.lng))}`;
    marker.bindPopup(`<div><strong>${escapeHtml(entry.waterName)}</strong>${waypointLine}<br>${escapeHtml(entry.species)} · ${escapeHtml(String(entry.sizeInches))}" · Qty ${escapeHtml(String(entry.quantity))}<br>${escapeHtml(entry.baitName)}${entry.baitSize ? ' · #' + escapeHtml(entry.baitSize) : ''} · ${escapeHtml(entry.baitType)}${coordLine}</div>`);
    state.markerCluster.addLayer(marker);
  });

  $('statsGrid').innerHTML='';
  [
    ['Entries',visible.length],
    ['Fish Logged',visible.reduce((s,e)=>s+(e.quantity||0),0)],
    ['Avg Size',visible.length ? (visible.reduce((s,e)=>s+(e.sizeInches||0),0)/visible.length).toFixed(1)+'"' : '0.0"'],
    ['Top Bait',mostCommon(visible,'baitName')||'—'],
    ['Top Retrieve',mostCommon(visible,'retrieveSpeed')||'—']
  ].forEach(([label,val])=>{
    const card=document.createElement('div');
    card.className='statCard';
    card.innerHTML=`<div class="statLabel">${escapeHtml(label)}</div><div class="statValue">${escapeHtml(String(val))}</div>`;
    $('statsGrid').appendChild(card);
  });

  $('entryList').innerHTML='';
  $('entryCount').textContent=`${visible.length} shown / ${state.entries.length} total`;
  if(!visible.length){
    $('entryList').innerHTML='<div class="entryCard"><p class="entryMeta">No logs match the current filters.</p></div>';
    return;
  }

  visible.forEach(entry=>{
    const waypointLabel=entry.waypointName ? ` · ${escapeHtml(entry.waypointName)}` : '';
    const card=document.createElement('article');
    card.className='entryCard';
    card.innerHTML=`<div class="entryTitleRow"><div><h3 class="entryTitle">${escapeHtml(entry.waterName)}${waypointLabel} · ${escapeHtml(entry.species)}</h3><p class="entryMeta">${escapeHtml(formatDate(entry.date))} · ${escapeHtml(entry.timeOfDay)} · ${escapeHtml(entry.baitName)}${entry.baitSize ? ' · #' + escapeHtml(entry.baitSize) : ''} · ${escapeHtml(String(entry.sizeInches))}"</p></div><div class="entryButtons"><button type="button" class="entryBtn locateBtn">Locate</button><button type="button" class="entryBtn danger deleteBtn">Delete</button></div></div><div class="chips"></div>${entry.notes ? `<p class="entryNotes">${escapeHtml(entry.notes)}</p>` : ''}`;
    const chips=card.querySelector('.chips');
    [
      entry.baitType,
      entry.baitSubtype,
      entry.mainColor && `${entry.mainColor}${entry.additionalColor ? '/' + entry.additionalColor : ''}`,
      entry.skyCondition,
      entry.waterCondition,
      entry.waterClarity,
      entry.depthZone,
      entry.retrieveSpeed && `${entry.retrieveSpeed} retrieve`,
      entry.presentationStyle,
      entry.structureType,
      entry.hatches,
      entry.locationSource ? locationSourceLabel(entry.locationSource) : '',
      Number.isFinite(entry.markerAccuracy) ? `±${Math.round(entry.markerAccuracy)} m` : ''
    ].filter(Boolean).forEach(text=>{
      const chip=document.createElement('span');
      chip.className='chip';
      chip.textContent=text;
      chips.appendChild(chip);
    });
    card.querySelector('.locateBtn').addEventListener('click',()=>{
      map.setView([entry.marker.lat,entry.marker.lng],DEFAULT_LOG_ZOOM);
      closeSheet($('reviewSheet'));
    });
    card.querySelector('.deleteBtn').addEventListener('click',()=>{
      if(!confirm('Delete this fishing log?')) return;
      state.entries=state.entries.filter(e=>e.id!==entry.id);
      persistEntries();
      render();
      deleteCloudEntry(entry.id);
    });
    $('entryList').appendChild(card);
  });
}

async function onSubmit(event){
  event.preventDefault();
  const missingField=validateLogForm();
  if(missingField){
    setStatus(`Missing or incomplete: ${missingField}.`, 3800);
    alert(`Missing or incomplete: ${missingField}.`);
    return;
  }
  try{
    const raw=Object.fromEntries(new FormData($('logForm')).entries());
    let baitName='';
    if(raw.baitType==='Fly' || raw.baitType==='Lure') baitName=(raw.baitName||'').trim();
    if(raw.baitType==='Live Bait') baitName=raw.baitSubtype || '';
    if(!baitName) throw new Error('Bait details are incomplete.');
    if(!state.currentDraftMarker) throw new Error('Fishing spot is missing.');
    const ll=state.currentDraftMarker.getLatLng();
    const entry=normalizeEntry({
      id:getSafeRandomId(),
      owner:CURRENT_ANGLER,
      createdAt:new Date().toISOString(),
      date:raw.date,
      timeOfDay:raw.timeOfDay,
      waterName:(raw.waterName||'').trim(),
      waypointName:(raw.waypointName||'').trim(),
      baitType:raw.baitType,
      baitSubtype:raw.baitSubtype,
      baitName,
      mainColor:raw.mainColor,
      additionalColor:raw.additionalColor,
      baitSize:raw.baitType==='Fly' ? raw.baitSize : '',
      species:raw.species,
      sizeInches:Number(raw.sizeInches||0),
      weight:(raw.weight||'').trim(),
      quantity:Number(raw.quantity||1),
      airTemp:raw.airTemp ? Number(raw.airTemp) : null,
      waterTemp:raw.waterTemp ? Number(raw.waterTemp) : null,
      skyCondition:raw.skyCondition,
      waterCondition:raw.waterCondition,
      waterClarity:raw.waterClarity,
      depthZone:raw.depthZone,
      retrieveSpeed:raw.retrieveSpeed,
      presentationStyle:raw.presentationStyle,
      structureType:raw.structureType,
      hatches:(raw.hatches||'').trim(),
      notes:(raw.notes||'').trim(),
      locationSource:state.currentDraftMeta.source,
      markerAccuracy:state.currentDraftMeta.accuracy,
      marker:{lat:ll.lat,lng:ll.lng}
    });
    state.entries=mergeEntries([entry], state.entries);
    persistEntries();
    clearFormAfterSave();
    render();
    openSheet($('reviewSheet'));
    closeSheet($('logSheet'));
    setStatus('Fishing log saved locally.', 2600);
    if(cloudIsConfigured() && state.cloud.autoSyncOnSave){
      syncCloud({quiet:true}).then(ok=>{
        if(ok) setStatus('Fishing log saved and synced.', 3200);
      });
    }
  }catch(error){
    console.error('Save log failed', error);
    alert(`Save log failed: ${error?.message || 'unknown error'}`);
    setStatus(`Save failed: ${error?.message || 'unknown error'}`, 4200);
  }
}

function clearFormAfterSave(){
  $('logForm').reset();
  $('date').value=new Date().toISOString().slice(0,10);
  clearDraftMarker();
  applyBaitTypeUI();
}

function clearDraftMarker(){
  state.pendingLocationRequestId+=1;
  $('waterName').value='';
  $('waypointName').value='';
  $('nearbyWaterSelect').innerHTML='<option value="">Choose one</option>';
  $('nearbyWaterWrap').classList.add('hidden');
  $('waterLookupStatus').textContent='Tap Add Log to use your phone location, or pick a spot on the map.';
  updateLocationSummary();
  state.currentDraftMeta={source:'',accuracy:null};
  if(state.currentDraftMarker){
    map.removeLayer(state.currentDraftMarker);
    state.currentDraftMarker=null;
  }
  cancelAddMode();
}

function openSheet(el){
  el.classList.add('visible');
  el.setAttribute('aria-hidden','false');
}

function closeSheet(el){
  el.classList.remove('visible');
  el.setAttribute('aria-hidden','true');
}

function setStatus(message, duration=2600){
  $('statusBadge').textContent=message;
  $('statusBadge').classList.remove('hidden');
  clearTimeout(setStatus._timer);
  setStatus._timer=setTimeout(()=>$('statusBadge').classList.add('hidden'),duration);
}

function persistEntries(){
  localStorage.setItem(FISHING_STORAGE_KEY, JSON.stringify(normalizeEntryArray(state.entries)));
}

function loadEntries(){
  try{
    const direct=localStorage.getItem(FISHING_STORAGE_KEY);
    if(direct) return normalizeEntryArray(JSON.parse(direct));
    for(const legacyKey of FISHING_LEGACY_STORAGE_KEYS){
      const legacyValue=localStorage.getItem(legacyKey);
      if(!legacyValue) continue;
      const migratedEntries=normalizeEntryArray(JSON.parse(legacyValue));
      if(migratedEntries.length){
        localStorage.setItem(FISHING_STORAGE_KEY, JSON.stringify(migratedEntries));
      }
      return migratedEntries;
    }
    return [];
  }catch{
    return [];
  }
}

function mostCommon(entries,key){
  const counts=new Map();
  for(const entry of entries){
    if(!entry[key]) continue;
    counts.set(entry[key],(counts.get(entry[key])||0)+1);
  }
  const sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  return sorted.length ? sorted[0][0] : '';
}

function capitalize(v){
  return v ? v.charAt(0).toUpperCase()+v.slice(1) : '';
}

function formatDate(v){
  if(!v) return '';
  const [y,m,d]=v.split('-');
  return `${m}/${d}/${y}`;
}

function escapeHtml(v){
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

$('date').value=new Date().toISOString().slice(0,10);
populateSpeciesOptions();
$('addLogBtn').addEventListener('click',beginAddLog);
$('reviewBtn').addEventListener('click',()=>{
  cancelAddMode();
  openSheet($('reviewSheet'));
  closeSheet($('logSheet'));
  closeSheet($('filterSheet'));
});
$('filterBtn').addEventListener('click',()=>{
  cancelAddMode();
  openSheet($('filterSheet'));
  closeSheet($('logSheet'));
  closeSheet($('reviewSheet'));
});
$('cloudBtn').addEventListener('click', async ()=>{
  if(!cloudIsConfigured()) {
    alert('Cloud is not configured yet. Open supabase-config.js and add your Supabase URL plus anon or publishable key. Then run the SQL in supabase-setup.sql.');
    return;
  }
  await syncCloud({quiet:false});
});
$('closeLogSheetBtn').addEventListener('click',()=>{
  closeSheet($('logSheet'));
  cancelAddMode();
});
$('closeReviewSheetBtn').addEventListener('click',()=>closeSheet($('reviewSheet')));
$('closeFilterSheetBtn').addEventListener('click',()=>closeSheet($('filterSheet')));
$('clearSpotBtn').addEventListener('click',clearDraftMarker);
$('useDeviceLocationBtn').addEventListener('click',()=>useCurrentLocation());
$('pickOnMapBtn').addEventListener('click',beginPickOnMap);
$('resetFiltersBtn').addEventListener('click',()=>{
  $('filterDateFrom').value='';
  $('filterDateTo').value='';
  $('filterSpecies').value='';
  $('filterColor').value='';
  $('filterSky').value='';
  $('filterRetrieveSpeed').value='';
  state.filters={dateFrom:'',dateTo:'',species:'',color:'',sky:'',retrieveSpeed:''};
  render();
});
['filterDateFrom','filterDateTo','filterSpecies','filterColor','filterSky','filterRetrieveSpeed'].forEach(id=>$(id).addEventListener('change',()=>{
  state.filters.dateFrom=$('filterDateFrom').value;
  state.filters.dateTo=$('filterDateTo').value;
  state.filters.species=$('filterSpecies').value;
  state.filters.color=$('filterColor').value;
  state.filters.sky=$('filterSky').value;
  state.filters.retrieveSpeed=$('filterRetrieveSpeed').value;
  render();
}));
$('baitType').addEventListener('change',applyBaitTypeUI);
$('nearbyWaterSelect').addEventListener('change',()=>{
  if($('nearbyWaterSelect').value) $('waterName').value=$('nearbyWaterSelect').value;
});
$('baitSubtype').addEventListener('change',()=>{
  if($('baitType').value==='Fly'){
    const exact=findExactFly($('baitName').value);
    if(exact && exact.category!==$('baitSubtype').value) $('baitName').value='';
    setBaitHelper('');
    refreshFlySizeOptions();
    updateFlySuggestions($('baitName').value.trim());
    return;
  }
  applySubtypeColorDefaults();
});
$('baitName').addEventListener('input',()=>{
  if($('baitType').value==='Fly'){
    const query=$('baitName').value.trim();
    updateFlySuggestions(query);
    const exact=findExactFly(query, $('baitSubtype').value);
    if(exact) applyFly(exact);
    else {
      refreshFlySizeOptions();
      setBaitHelper('');
    }
  }
});
$('baitName').addEventListener('focus',()=>{
  if($('baitType').value==='Fly'){
    refreshFlySizeOptions();
    updateFlySuggestions($('baitName').value.trim());
  }
});
document.addEventListener('click',event=>{
  if(!$('nameSuggestions').contains(event.target) && event.target!==$('baitName')) $('nameSuggestions').classList.add('hidden');
});
map.on('click',async event=>{
  if(!state.addMode) return;
  cancelAddMode();
  setDraftMarker(event.latlng.lat,event.latlng.lng,{source:'map',accuracy:null,recenter:false});
  openSheet($('logSheet'));
  closeSheet($('reviewSheet'));
  closeSheet($('filterSheet'));
  $('waterLookupStatus').textContent='Map spot set. Checking nearby water...';
  await detectNearbyWater(event.latlng.lat,event.latlng.lng);
  setStatus('Spot set from map. Fill out the log and save it.', 3600);
});
$('saveBtn').addEventListener('click',()=>{
  const missingField=validateLogForm();
  if(missingField) setStatus(`Missing or incomplete: ${missingField}.`, 3600);
});
$('logForm').addEventListener('submit',onSubmit);
applyBaitTypeUI();
syncAddLogButton();
updateCloudUi();
setStatus(`Fish Map Test ${APP_VERSION} loaded.`, 2200);
render();
initCloud();
