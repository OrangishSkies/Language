async function loadWords() {
  try {
    const res = await fetch('data/words.json');
    const words = await res.json();
    initDictionary(words);
  } catch (err) {
    console.error("Error loading words:", err);
    document.getElementById('word-container').innerHTML =
      '<p style="text-align:center;">⚠️ Could not load dictionary data.</p>';
  }
}

function initDictionary(words) {
  const container = document.getElementById('word-container');
  const searchInput = document.getElementById('search');

  function render(filter = '') {
    container.innerHTML = '';
    const filtered = words.filter(w => 
      w.word.toLowerCase().includes(filter.toLowerCase()) ||
      w.definition.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      container.innerHTML = '<p style="text-align:center; opacity:0.7;">No words found.</p>';
      return;
    }

    filtered.forEach(w => {
      const div = document.createElement('div');
      div.className = 'word-card';
      div.innerHTML = `
        <h3>${w.word}</h3>
        <p><strong>${w.pos || ''}</strong> — ${w.definition}</p>
        ${w.usage ? `<p><em>Usage:</em> ${w.usage}</p>` : ''}
        ${w.etymology ? `<p><em>Etymology:</em> ${w.etymology}</p>` : ''}
        ${w.related?.length ? `<p><em>Related:</em> ${w.related.join(', ')}</p>` : ''}
      `;
      container.appendChild(div);
    });
  }

  render();
  searchInput.addEventListener('input', e => render(e.target.value));
}

loadWords();
