
window.MapPickController=(function(){
  let deps=null;
  let initialized=false;

  function requireDeps(){
    return deps || null;
  }

  function setVisuals(isActive){
    const ctx=requireDeps();
    const map=ctx?.map;
    const mapEl=map?.getContainer?.() || document.getElementById('map');
    if(!mapEl) return;
    mapEl.style.cursor=isActive ? 'crosshair' : '';
    mapEl.classList.toggle('map-pick-armed', !!isActive);
  }

  function pointFromClientEvent(event){
    const ctx=requireDeps();
    const map=ctx?.map; const L=ctx?.L;
    if(!map || !L) return null;
    const touch=event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : null;
    const clientX=touch ? touch.clientX : event.clientX;
    const clientY=touch ? touch.clientY : event.clientY;
    if(!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const rect=map.getContainer().getBoundingClientRect();
    const point=L.point(clientX-rect.left, clientY-rect.top);
    return map.containerPointToLatLng(point);
  }

  function ensureOverlay(){
    const ctx=requireDeps();
    const state=ctx?.state;
    if(!state) return document.getElementById('mapPickOverlay') || null;
    if(state.mapPickOverlay && document.body.contains(state.mapPickOverlay)) return state.mapPickOverlay;
    const overlay=document.createElement('div');
    overlay.id='mapPickOverlay';
    overlay.className='map-pick-overlay';
    overlay.setAttribute('aria-hidden','true');
    document.body.appendChild(overlay);
    state.mapPickOverlay=overlay;
    return overlay;
  }

  function hideOverlay(){
    const overlay=ensureOverlay();
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden','true');
    overlay.style.pointerEvents='none';
  }

  function showOverlay(){
    const {map}=requireDeps();
    const overlay=ensureOverlay();
    const rect=map.getContainer().getBoundingClientRect();
    overlay.style.left=rect.left+'px';
    overlay.style.top=rect.top+'px';
    overlay.style.width=rect.width+'px';
    overlay.style.height=rect.height+'px';
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden','false');
    overlay.style.pointerEvents='none';
  }

  function detach(){
    const ctx=requireDeps();
    const state=ctx?.state; const map=ctx?.map;
    if(!state) return;
    const overlay=state.mapPickOverlay;
    if(overlay && state._mapPickOverlayHandler){
      ['click','pointerup','touchend','mouseup'].forEach(type=>overlay.removeEventListener(type, state._mapPickOverlayHandler, true));
    }
    if(map && state._mapPickMapClickHandler){
      map.off('click', state._mapPickMapClickHandler);
    }
    state._mapPickOverlayHandler=null;
    state._mapPickMapClickHandler=null;
    hideOverlay();
  }

  function disarm(){
    const ctx=requireDeps();
    const state=ctx?.state;
    if(!state) return;
    state.pickOnMapArmed=false;
    detach();
    setVisuals(false);
  }

  async function finish(lat,lng){
    const ctx=requireDeps(); if(!ctx) return;
    const {state, setStatus, setDraftMarker, closeAllSheets, openSheet, $, map, updateFieldFillStates, setWaterLookupStatusText, detectNearbyWater}=ctx;
    if(!state.pickOnMapArmed || !state.addMode) return;
    if(!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))){
      setStatus('Map pick failed. Tap the map again.', 3200);
      return;
    }
    disarm();
    setDraftMarker(Number(lat), Number(lng), {source:'map', accuracy:null, recenter:false});
    closeAllSheets();
    openSheet($('logSheet'));
    requestAnimationFrame(()=>{ map.invalidateSize(); updateFieldFillStates(); });
    setWaterLookupStatusText('Map spot set. Checking nearby water...');
    await detectNearbyWater(Number(lat), Number(lng));
    setStatus('Spot set from map. Fill out the log and save it.', 3600);
  }

  function arm(){
    const ctx=requireDeps(); if(!ctx) return;
    const {state, setStatus, map}=ctx;
    detach();
    const overlay=ensureOverlay();
    state._mapPickOverlayHandler=async event=>{
      if(!state.pickOnMapArmed || !state.addMode) return;
      if(event.type==='pointerup' && event.pointerType==='mouse' && event.button!==0) return;
      if(event.type==='touchend'){
        event.preventDefault();
        event.stopPropagation();
        const ll=pointFromClientEvent(event);
        if(!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)){
          setStatus('Map pick failed. Tap the map again.', 3200);
          return;
        }
        await finish(ll.lat, ll.lng);
      }
    };
    state._mapPickMapClickHandler=async event=>{
      if(!state.pickOnMapArmed || !state.addMode) return;
      const ll=event?.latlng;
      if(!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)){
        setStatus('Map pick failed. Tap the map again.', 3200);
        return;
      }
      await finish(ll.lat, ll.lng);
    };
    overlay.addEventListener('touchend', state._mapPickOverlayHandler, true);
    map.on('click', state._mapPickMapClickHandler);
    showOverlay();
  }

  function begin(){
    const ctx=requireDeps(); if(!ctx) return;
    const {state, syncAddLogButton, closeSheet, $, setStatus, setWaterLookupStatusText, map}=ctx;
    state.pendingLocationRequestId+=1;
    state.addMode=true;
    state.pickOnMapArmed=true;
    state._lastMapPickAt=0;
    syncAddLogButton();
    closeSheet($('logSheet'));
    closeSheet($('reviewSheet'));
    closeSheet($('filterSheet'));
    closeSheet($('anglerSheet'));
    closeSheet($('predictSheet'));
    setVisuals(true);
    arm();
    setStatus(state.currentDraftMarker ? 'Pick on Map is active. Tap the map once to move the spot.' : 'Pick on Map is active. Tap the map once to set the spot.', 7000);
    setWaterLookupStatusText('Pick on Map is active. Tap the map once to set the spot.');
    try{ map.invalidateSize(); showOverlay(); }catch(_e){}
  }

  function initialize(){
    const ctx=requireDeps(); if(!ctx) return;
    const {state}=ctx;
    if(initialized) return;
    initialized=true;
    window.addEventListener('resize', ()=>{ if(state.pickOnMapArmed) showOverlay(); });
    window.addEventListener('scroll', ()=>{ if(state.pickOnMapArmed) showOverlay(); }, true);
  }

  function init(nextDeps){
    deps=nextDeps;
    return window.MapPickController;
  }

  return {init, initialize, begin, finish, disarm, setVisuals};
})();
