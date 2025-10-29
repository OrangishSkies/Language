/* script.js
 - Loads data/words.json
 - Renders cards with optional SVG icons from /icons/<icon>.svg
 - Filters: rarity checkboxes, showEty, onlyFavorites
 - Search and alphabet index
 - Favorites persisted in localStorage (by word)
*/

const DATA_URL = 'data/words.json';
const ICON_FOLDER = 'icons/';
let allWords = [];
let visibleWords = [];
let favorites = new Set(JSON.parse(localStorage.getItem('favWords') || '[]'));

/* elements */
const wordContainer = document.getElementById('wordContainer');
const searchInput = document.getElementById('search');
const rarityChecks = Array.from(document.querySelectorAll('.rarity'));
const showEty = document.getElementById('showEty');
const onlyFav = document.getElementById('onlyFav');
const alphaIndex = document.getElementById('alphaIndex');
const copyPermalink = document.getElementById('copyPermalink');
const resetFilters = document.getElementById('resetFilters');

/* template */
const template = document.getElementById('word-template');

/* load JSON */
async function loadData(){
  try{
    const res = await fetch(DATA_URL + '?_=' + Date.now());
    if(!res.ok) throw new Error('Data not found');
    allWords = await res.json();
    // normalize rarity default
    allWords.forEach(w => { if(!w.rarity) w.rarity = 'core'; if(!w.word) w.word = ''; });
    buildAlphaIndex();
    applyFilters();
  } catch(e){
    wordContainer.innerHTML = `<p style="text-align:center;color:#f66">Could not load dictionary data: ${e.message}</p>`;
    console.error(e);
  }
}

/* render utilities */
function sanitizeText(s){
  return s == null ? '' : s;
}

async function renderWord(w){
  const clone = template.content.cloneNode(true);
  const root = clone.querySelector('.word-card');
  const iconEl = clone.querySelector('[data-icon]');
  const wordEl = clone.querySelector('[data-word]');
  const posEl = clone.querySelector('[data-pos]');
  const defEl = clone.querySelector('[data-definition]');
  const usageEl = clone.querySelector('[data-usage]');
  const etyEl = clone.querySelector('[data-etymology]');
  const relatedEl = clone.querySelector('[data-related]');
  const favBtn = clone.querySelector('.fav');
  const audioBtn = clone.querySelector('.audio');

  wordEl.textContent = sanitizeText(w.word);
  posEl.textContent = sanitizeText(w.pos || '');
  defEl.textContent = sanitizeText(w.definition || '');
  usageEl.textContent = w.usage ? `Usage: ${w.usage}` : '';
  etyEl.textContent = w.etymology ? `Etymology: ${w.etymology}` : '';
  relatedEl.textContent = w.related ? `Related: ${w.related.join(', ')}` : '';

  // show/hide etymology immediately based on toggle
  if(!showEty.checked) etyEl.style.display = 'none';

  // favorite button state
  if(favorites.has(w.word)) favBtn.classList.add('active');
  favBtn.addEventListener('click', () => {
    if(favorites.has(w.word)) { favorites.delete(w.word); favBtn.classList.remove('active'); }
    else { favorites.add(w.word); favBtn.classList.add('active'); }
    localStorage.setItem('favWords', JSON.stringify(Array.from(favorites)));
    // if onlyFav filter enabled, reapply filter
    if(onlyFav.checked) applyFilters();
  });

  // audio placeholder (you can integrate TTS or audio files)
  audioBtn.addEventListener('click', () => {
    // simple speak using Web Speech API if available
    if('speechSynthesis' in window){
      const ut = new SpeechSynthesisUtterance(w.word);
      speechSynthesis.speak(ut);
    } else alert('Audio not supported in this browser.');
  });

  // icon handling:
  if(w.icon){
    // two forms supported:
    // 1) icon: "file.svg" — loads icons/file.svg from icons folder
    // 2) icon: "svg:<svg...>" — inline raw SVG string (not recommended for git but supported)
    // 3) icon: "char:α" — display a character glyph
    if(w.icon.startsWith('svg:')){
      iconEl.innerHTML = w.icon.slice(4);
    } else if(w.icon.startsWith('char:')){
      const ch = w.icon.slice(5);
      iconEl.innerHTML = `<div class="glyph">${ch}</div>`;
    } else {
      // try fetch the svg file
      const path = ICON_FOLDER + w.icon;
      try {
        const resp = await fetch(path);
        if(resp.ok){
          const svgText = await resp.text();
          iconEl.innerHTML = svgText;
        } else {
          iconEl.textContent = '?';
        }
      } catch(e){
        iconEl.textContent = '?';
      }
    }
  } else {
    iconEl.textContent = w.word[0] || '?';
  }

  wordContainer.appendChild(clone);
}

/* render list */
async function renderList(words){
  wordContainer.innerHTML = '';
  if(words.length === 0){
    wordContainer.innerHTML = `<p style="text-align:center;color:var(--muted)">No words found.</p>`;
    return;
  }
  // render in sequence (preserves order)
  for(const w of words){
    await renderWord(w);
  }
}

/* filters */
function getRarityFilter(){
  return rarityChecks.filter(c=>c.checked).map(c=>c.value);
}

function applyFilters(){
  const q = (searchInput.value || '').trim().toLowerCase();
  const allowedRarity = getRarityFilter();
  visibleWords = allWords.filter(w=>{
    if(onlyFav.checked && !favorites.has(w.word)) return false;
    if(!allowedRarity.includes(w.rarity || 'core')) return false;
    if(!q) return true;
    const inWord = (w.word || '').toLowerCase().includes(q);
    const inDef = (w.definition || '').toLowerCase().includes(q);
    const inUsage = (w.usage || '').toLowerCase().includes(q);
    return inWord || inDef || inUsage;
  });
  // alphabetical sorting by word
  visibleWords.sort((a,b)=> (a.word||'').localeCompare(b.word||''));
  renderList(visibleWords);
}

/* alpha index */
function buildAlphaIndex(){
  const letters = new Set();
  allWords.forEach(w => {
    const ch = (w.word || '').slice(0,1).toUpperCase();
    if(ch) letters.add(ch);
  });
  const arr = Array.from(letters).sort();
  alphaIndex.innerHTML = '';
  const allBtn = document.createElement('button'); allBtn.textContent='All'; alphaIndex.appendChild(allBtn);
  allBtn.addEventListener('click', ()=> { Array.from(alphaIndex.children).forEach(b=>b.classList.remove('active')); allBtn.classList.add('active'); searchInput.value = ''; applyFilters(); });

  arr.forEach(l=>{
    const b = document.createElement('button');
    b.textContent = l;
    b.addEventListener('click', ()=>{
      Array.from(alphaIndex.children).forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      searchInput.value = l;
      applyFilters();
    });
    alphaIndex.appendChild(b);
  });
}

/* events */
searchInput.addEventListener('input', () => applyFilters());
rarityChecks.forEach(c=> c.addEventListener('change', applyFilters));
showEty.addEventListener('change', ()=> {
  // toggle all etymology nodes
  document.querySelectorAll('[data-etymology]').forEach(el => el.style.display = showEty.checked ? '' : 'none');
});
onlyFav.addEventListener('change', applyFilters);
copyPermalink.addEventListener('click', ()=>{
  navigator.clipboard?.writeText(location.href).then(()=> alert('Permalink copied to clipboard'));
});
resetFilters.addEventListener('click', ()=>{
  // reset checks
  rarityChecks.forEach(c=> c.checked = ['core','common'].includes(c.value));
  showEty.checked = true;
  onlyFav.checked = false;
  searchInput.value = '';
  applyFilters();
});

/* init */
loadData();
