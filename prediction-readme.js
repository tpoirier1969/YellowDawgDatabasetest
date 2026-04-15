
window.FishingPredictionReadme=(function(){
  const html=`
    <h3>What this first predictive screen does</h3>
    <p>This version lets you describe the fishing situation without forcing you to choose lure, bait, or presentation details up front.</p>
    <h3>What you enter</h3>
    <ul>
      <li>Day and time</li>
      <li>Water type and optional body of water</li>
      <li>Weather and water conditions</li>
      <li>Fishing platform such as boat, shore, wading, kayak, dock/pier, or ice</li>
      <li>Optional broad fishing style such as fly, lure, live bait, or ice</li>
    </ul>
    <h3>What you leave out</h3>
    <p>You should not need to enter the exact lure, exact bait, or exact presentation when asking for a prediction. Those are things the predictive layer should help narrow down for you.</p>
    <h3>Why platform matters</h3>
    <p>Boat, shore, wading, kayak, and ice all change what is realistically possible. A useful prediction has to know whether you can reach deep structure, troll open water, drift a seam, or only work shoreline access.</p>
  `;
  function apply(){
    const target=document.getElementById('predictReadmeCopy');
    if(target) target.innerHTML=html;
  }
  return {apply, html};
})();
