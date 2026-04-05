
window.FishingPredictionReadme=(function(){
  const html=`
    <h3>What this will do</h3>
    <p>This screen is the staging area for the prediction engine. The goal is not just a pretty summary. It is meant to look at your logged trips and identify both obvious patterns and harder-to-see relationships in the data.</p>
    <h3>What it will analyze</h3>
    <ul>
      <li>Day, season, and time-of-day windows</li>
      <li>Water type, depth, clarity, level, surface, and structure</li>
      <li>Wind, sky, temperature, and weather combinations</li>
      <li>Presentation style, retrieve speed, depth zone, bait or fly choice, and target species</li>
      <li>Success patterns that only show up when several variables line up together</li>
    </ul>
    <h3>Where the AI part comes in</h3>
    <p>Once the model layer is wired in, you will be able to enter the day, time, water type and conditions, wind and weather, plus the kind of fishing you plan to do. The system will work through your saved history and suggest the best options for catching fish based on the patterns it finds.</p>
    <p>That should push this past the usual fishing log or map-pin app and toward something that can actually help you decide how to fish before you make the first cast.</p>
  `;

  function apply(){
    const target=document.getElementById('predictReadmeCopy');
    if(target) target.innerHTML=html;
  }

  return {apply, html};
})();
