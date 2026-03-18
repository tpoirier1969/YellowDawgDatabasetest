
const catches = [];

function saveCatch() {
  const data = {
    fly: document.getElementById('flyPattern').value,
    color: document.getElementById('flyColor').value,
    species: document.getElementById('species').value,
    size: document.getElementById('size').value
  };

  catches.push(data);
  render();
}

function render() {
  const list = document.getElementById('results');
  list.innerHTML = '';

  catches.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.species} - ${c.size}" on ${c.fly} (${c.color})`;
    list.appendChild(li);
  });
}
