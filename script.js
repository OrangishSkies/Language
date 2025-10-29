/* script.js - improved: DOM-ready init, robust data fetch, mobile-friendly tweaks */

const DATA_CANDIDATES = ['data/words.json', 'Data/words.json', './data/words.json', './Data/words.json'];

async function fetchDataWithFallback() {
  for (const path of DATA_CANDIDATES) {
    try {
      const res = await fetch(path + '?_=' + Date.now());
      if (res.ok) {
        return await res.json();
      }
    } catch(e){
      // ignore and try next
    }
  }
  throw new Error('Could not fetch any words.json (checked: ' + DATA_CANDIDATES.join(',') + ')');
}

function safeGet(id) { return document.getElementById(id) || null; }

document.addEventListener('DOMContentLoaded', ()=>{
  const wordContainer = safeGet('wordContainer');
  const searchInput = safeGet('search');
  const showEty = safeGet('showEty');
  const onlyFav = safeGet('onlyFav');
  const alphaIndex = safeGet('alphaIndex');
  const copyPermalink = safeGet('copyPermalink');
  const resetFilters = safeGet('resetFilters');
  const template = safeGet('word-template');
  const favKey = 'favWords';

  // If this isn't the dictionary page, show a small data-source label if present and stop.
  if (!template || !wordContainer) {
    const ds = document.querySelector('[data-source]');
    if (ds) {
      ds.textContent = 'Data source: data/words.json';
    }
    return;
  }

  let allWords = [];
  let visibleWords = [];
  let favorites = new Set(JSON.parse(localStorage.getItem(favKey) || '[]'));

  function saveFavs(){ localStorage.setItem(favKey, JSON.stringify([...favorites])); }

  async function loadData(){
    try {
      allWords = await fetchDataWithFallback();
      if (!Array.isArray(allWords)) allWords = [];
      applyFilters();
    } catch(e){
      wordContainer.innerHTML = `<p style="text-align:center;color:#f66">Could not load dictionary data: ${e.message}</p>`;
      console.error(e);
    }
  }

  function sanitizeText(s){ return s == null ? '' : s; }

  async function renderWord(w){
    const clone = template.content.cloneNode(true);
    const root = clone.querySelector('.word-card');
    const iconEl = clone.querySelector('[data-icon]');
    const wordEl = clone.querySelector('[data-word]');
    const defEl = clone.querySelector('[data-definition]');
    const posEl = clone.querySelector('[data-pos]');
    const usageEl = clone.querySelector('[data-usage]');
    const etyEl = clone.querySelector('[data-etymology]');
    const relatedEl = clone.querySelector('[data-related]');
    const favBtn = clone.querySelector('.fav');

    if(wordEl) wordEl.textContent = sanitizeText(w.word);
    if(defEl) defEl.textContent = sanitizeText(w.definition || w.meaning || '');
    if(posEl) posEl.textContent = sanitizeText(w.pos || '');
    if(usageEl) usageEl.textContent = sanitizeText(w.usage || '');
    if(etyEl) {
      if (w.etymology) { etyEl.textContent = w.etymology; etyEl.style.display='block'; }
      else { etyEl.style.display='none'; }
    }
    if(relatedEl) {
      if(Array.isArray(w.related) && w.related.length) {
        relatedEl.innerHTML = w.related.map(r=>`<a href="#" class="related-link" data-rel="${r}">${r}</a>`).join(', ');
      } else relatedEl.style.display='none';
    }

    // icon handling: 'svg:<svg...>', 'char:α', or filename under icons/
    if(iconEl) {
      iconEl.innerHTML = '';
      if (w.icon) {
        if (typeof w.icon === 'string' && w.icon.startsWith('svg:')) {
          iconEl.innerHTML = w.icon.slice(4);
        } else if (typeof w.icon === 'string' && w.icon.startsWith('char:')) {
          iconEl.innerHTML = `<div class="glyph">${w.icon.slice(5)}</div>`;
        } else if (typeof w.icon === 'string') {
          const p = 'icons/' + w.icon;
          fetch(p).then(r=> r.ok ? r.text() : '').then(t=>{
            if(t) iconEl.innerHTML = t;
            else iconEl.textContent = (w.word && w.word[0]) || '?';
          }).catch(()=> iconEl.textContent = (w.word && w.word[0]) || '?');
        } else {
          iconEl.textContent = (w.word && w.word[0]) || '?';
        }
      } else {
        iconEl.textContent = (w.word && w.word[0]) || '?';
      }
    }

    if(favBtn) {
      favBtn.textContent = favorites.has(w.word) ? '♥' : '♡';
      favBtn.addEventListener('click', ()=>{
        if(favorites.has(w.word)) favorites.delete(w.word); else favorites.add(w.word);
        saveFavs();
        favBtn.textContent = favorites.has(w.word) ? '♥' : '♡';
      });
    }

    return clone;
  }

  function clearList(){ wordContainer.innerHTML = ''; }

  async function applyFilters(){
    clearList();
    let q = searchInput ? (searchInput.value||'').toLowerCase() : '';
    const rarityChecks = Array.from(document.querySelectorAll('.rarity:checked')).map(n=>n.value);
    const showOnlyFav = onlyFav && onlyFav.checked;
    visibleWords = allWords.filter(w => {
      if (showOnlyFav && !favorites.has(w.word)) return false;
      if (rarityChecks.length && w.tags && Array.isArray(w.tags)) {
        if (!w.tags.some(t=> rarityChecks.includes(t))) return false;
      }
      if (q) {
        const hay = ((w.word||'') + ' ' + (w.definition||w.meaning||'') + ' ' + (w.usage||'') ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    for (const w of visibleWords) {
      const frag = await renderWord(w);
      wordContainer.appendChild(frag);
    }
    document.querySelectorAll('.related-link').forEach(a=>{
      a.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const target = ev.currentTarget.getAttribute('data-rel');
        const card = Array.from(document.querySelectorAll('[data-word]')).find(n=> n.textContent === target);
        if (card) card.scrollIntoView({behavior:'smooth', block:'center'});
      });
    });
  }

  if (searchInput) searchInput.addEventListener('input', ()=> applyFilters());
  if (showEty) showEty.addEventListener('change', ()=> applyFilters());
  if (onlyFav) onlyFav.addEventListener('change', ()=> applyFilters());
  if (copyPermalink) copyPermalink.addEventListener('click', ()=> navigator.clipboard?.writeText(location.href).then(()=> alert('Permalink copied')));
  if (resetFilters) resetFilters.addEventListener('click', ()=> {
    document.querySelectorAll('.rarity').forEach(c=> c.checked = ['core','common'].includes(c.value));
    if (searchInput) searchInput.value = '';
    if (showEty) showEty.checked = true;
    if (onlyFav) onlyFav.checked = false;
    applyFilters();
  });

  loadData();
}); // DOMContentLoaded end
