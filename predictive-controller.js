
window.FishingPredictiveController=(function(){
  const platformSuggestions={
    'Great Lake':{
      'Boat':['Start with mobility and depth control. July lake trout predictions should assume you can reach deep structure or suspended fish.','Prioritize basin edges, reefs, offshore structure, and long depth transitions.'],
      'Shore':['Focus on low-light access points, current breaks, harbors, river mouths, and wind-driven shoreline zones.'],
      'Kayak / Canoe':['Start nearshore first and work structure edges, depth breaks, and current corridors you can reach safely.'],
      'Ice':['Use depth transitions, basin edges, and structure-adjacent areas where legal and safe ice access exists.']
    },
    'Lake':{
      'Boat':['Use boat access to check multiple depth bands, weed edges, points, drop-offs, humps, and reefs quickly.'],
      'Shore':['Start with access points, inlets/outlets, points, docks, and shoreline structure during better feeding windows.'],
      'Kayak / Canoe':['Quietly work edges, flats, weed lines, and drop-offs that are hard to reach from shore.'],
      'Dock / Pier':['Start with shade, current/wind lanes, and man-made structure.'],
      'Ice':['Target structure, basin edges, and feeding shelves rather than random flats.']
    },
    'River':{
      'Wading':['Start with seams, pockets, tailouts, current breaks, and undercut banks.'],
      'Shore':['Bridge water, bends, pools, cut banks, and accessible seams are your first search areas.'],
      'Boat':['Drifts and current control open up deeper runs, larger seams, and more structure transitions.'],
      'Kayak / Canoe':['Controlled drifts through likely holding stretches are the first move.']
    },
    'Stream':{
      'Wading':['Pocket water, seams, undercut banks, and shade/cover changes should lead the prediction.'],
      'Shore':['Accessible pools, bends, and bridge/road access water are the first practical targets.']
    },
    'Pond':{
      'Shore':['Start around weed edges, shade, inflow, and low-light shoreline feeding windows.'],
      'Boat':['Use mobility to check the full perimeter and any depth change quickly.'],
      'Kayak / Canoe':['A quiet approach to shallow fish is one of your biggest advantages.']
    }
  };

  function esc(v){
    return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
  }
  function val(id){
    const el=document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }
  function numVal(id){
    const raw=val(id);
    if(!raw) return null;
    const n=Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  function setDefaults(){
    const dateEl=document.getElementById('predictDate');
    const todEl=document.getElementById('predictTimeOfDay');
    if(dateEl && !dateEl.value) dateEl.value=new Date().toISOString().slice(0,10);
    if(todEl && !todEl.value){
      const h=new Date().getHours();
      todEl.value = h>=4 && h<7 ? 'Dawn' : h>=7 && h<11 ? 'Morning' : h>=11 && h<15 ? 'Midday' : h>=15 && h<18 ? 'Afternoon' : h>=18 && h<21 ? 'Evening' : 'Night';
    }
  }
  function build(){
    const waterType=val('predictWaterType');
    const platform=val('predictPlatform');
    const fishingType=val('predictFishingType');
    const waterName=val('predictWaterName');
    const tod=val('predictTimeOfDay');
    const sky=val('predictSky');
    const wind=val('predictWind');
    const windDir=val('predictWindDirection');
    const clarity=val('predictWaterClarity');
    const level=val('predictWaterCondition');
    const motion=val('predictWaterMotion');
    const structure=val('predictStructureType');
    const bottom=val('predictBottomType');
    const airTemp=numVal('predictAirTemp');
    const waterTemp=numVal('predictWaterTemp');
    const depth=numVal('predictWaterDepthFt');
    const notes=val('predictNotes');

    const sections=[];
    const scenario=[waterName || waterType || 'water', platform || 'platform not chosen', tod || 'time not chosen'].filter(Boolean).join(' · ');
    sections.push(`<h3>Scenario</h3><p>${esc(scenario)}</p>`);

    const tips=(platformSuggestions[waterType] && platformSuggestions[waterType][platform]) || [];
    if(tips.length){
      sections.push('<h3>Likely starting approach</h3><ul>' + tips.map(t=>`<li>${esc(t)}</li>`).join('') + '</ul>');
    }

    const factors=[];
    if(!waterType) factors.push('Pick the water type first. That is one of the strongest predictive inputs.');
    if(!platform) factors.push('Pick the fishing platform. Boat versus shore versus wading can completely change what should be recommended.');
    if(['Dawn','Evening','Night'].includes(tod)) factors.push('Low-light periods often improve shoreline feeding windows and aggressive fish positioning.');
    if(tod==='Midday') factors.push('Midday often pushes fish toward depth, shade, current relief, or tighter structure.');
    if(clarity==='Clear') factors.push('Clear water often favors quieter approaches and more natural-looking starting directions.');
    if(['Slight Stain','Stained','Muddy'].includes(clarity)) factors.push('Reduced visibility often favors stronger contrast, vibration, flash, sound, or larger profiles.');
    if(level==='High') factors.push('High water can spread fish out and create fresh shoreline/current opportunities.');
    if(level==='Low') factors.push('Low water often tightens fish into deeper lanes, cover, and defined structure.');
    if(motion) factors.push(`Surface/current condition: ${motion}.`);
    if(structure) factors.push(`Start by looking around ${structure.toLowerCase()} instead of fishing random water.`);
    if(bottom) factors.push(`${bottom} bottom can matter when choosing how snaggy, subtle, noisy, or bottom-oriented the first recommendation should be.`);
    if(Number.isFinite(depth)) factors.push(`Approximate water depth entered: ${depth} ft.`);
    if(Number.isFinite(waterTemp)) factors.push(`Water temperature around ${waterTemp}°F should strongly influence fish location and pace.`);
    if(Number.isFinite(airTemp)) factors.push(`Air temperature around ${airTemp}°F is useful context, though water temperature usually matters more.`);
    if(sky) factors.push(`Sky condition: ${sky}.`);
    if(wind) factors.push(`Wind: ${wind}${windDir ? ' from the ' + windDir : ''}.`);
    if(fishingType) factors.push(`Broad style selected: ${fishingType}. That can bias the prediction without locking in exact lure or bait choices.`);
    if(notes) factors.push(`Scenario note: ${notes}`);

    if(factors.length){
      sections.push('<h3>What should matter most</h3><ul>' + factors.map(t=>`<li>${esc(t)}</li>`).join('') + '</ul>');
    }

    sections.push('<h3>What this version should predict next</h3><ul>' +
      '<li>Likely fish location zones under these conditions</li>' +
      '<li>Broad method direction first: fly, lure, bait, trolling, jigging, drifting, etc.</li>' +
      '<li>Only after that: more specific lure, fly, bait, and presentation suggestions</li>' +
      '</ul>');

    return sections.join('');
  }
  function wire(){
    setDefaults();
    const btn=document.getElementById('generatePredictionBtn');
    if(btn && !btn.dataset.predictiveWired){
      btn.dataset.predictiveWired='true';
      btn.addEventListener('click', ()=>{
        const out=document.getElementById('predictiveResults');
        const summary=document.getElementById('predictiveSummary');
        if(out){
          out.innerHTML=build();
          out.classList.remove('hidden');
        }
        if(summary) summary.textContent='Basic predictive output generated from scenario inputs. This version is meant to narrow the search space before it starts suggesting exact tackle choices.';
      });
    }
  }
  return {wire, setDefaults};
})();
