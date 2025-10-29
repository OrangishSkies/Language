async function loadWords() {
  const res = await fetch('data/words.json');
  const words = await res.json();
  displayWords(words);
}

function displayWords(words) {
  const container = document.getElementById('word-container');
  const search = document.getElementById('search');
  function render(filter = '') {
    container.innerHTML = '';
    words.filter(w => w.word.toLowerCase().includes(filter.toLowerCase()))
      .forEach(w => {
        const div = document.createElement('div');
        div.className = 'word-card';
        div.innerHTML = `
          <h3>${w.word}</h3>
          <p>${w.meaning}</p>
          <small>${w.pos || ''}</small>
        `;
        container.appendChild(div);
      });
  }
  search.addEventListener('input', e => render(e.target.value));
  render();
}

loadWords();
