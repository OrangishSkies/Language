/* script.js - LangX client logic
   - loads Data/words.json
   - search, filter, pagination
   - favorites stored to localStorage
   - pronunciation via SpeechSynthesis (if available)
   - defensive programming and helpful console errors
*/

const DATA_PATH = 'Data/words.json';
const PAGE_SIZE = 10;

const state = {
  allWords: [],
  filtered: [],
  page: 1,
  pageSize: PAGE_SIZE,
  showFavoritesOnly: false,
  favorites: new Set(),
  lastQuery: ''
};

// DOM references
const $search = document.getElementById('search');
const $clearSearch = document.getElementById('clear-search');
const $posFilter = document.getElementById('pos-filter');
const $tagFilter = document.getElementById('tag-filter');
const $btnFavs = document.getElementById('btn-show-favs');
const $btnExport = document.getElementById('btn-export');
const $wordList = document.getElementById('word-list');
const $template = document.getElementById('word-item-template');
const $resultCount = document.getElementById('result-count');
const $pagination = document.getElementById('pagination');
const $yearFooter = document.getElementById('year-footer');

if ($yearFooter) $yearFooter.textContent = new Date().getFullYear();

// debounce helper
function debounce(fn, wait=250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// load favorites from localStorage
function loadFavorites(){
  try {
    const raw = localStorage.getItem('langx.favorites');
    if (!raw) return;
    const arr = JSON.parse(raw);
    arr.forEach(w => state.favorites.add(w));
  } catch(e) {
    console.warn('Could not load favorites', e);
  }
}

function saveFavorites(){
  try {
    localStorage.setItem('langx.favorites', JSON.stringify(Array.from(state.favorites)));
  } catch(e) {
    console.warn('Could not save favorites', e);
  }
}

// fetch data
async function fetchData(){
  try {
    const res = await fetch(DATA_PATH, {cache: 'no-cache'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error('Data format invalid — expected array');
    state.allWords = data.slice().sort((a,b) => a.word.localeCompare(b.word, undefined, {sensitivity:'base'}));
    state.filtered = state.allWords;
    render();
  } catch(err){
    console.error('Failed to load dictionary:', err);
    $wordList.innerHTML = `<li class="word-item">Failed to load dictionary: ${err.message}</li>`;
  }
}

// search and filtering
function matchesQuery(item, query){
  const q = query.trim().toLowerCase();
  if(!q) return true;
  if(item.word.toLowerCase().includes(q)) return true;
  if(item.definition && item.definition.toLowerCase().includes(q)) return true;
  if(item.usage && item.usage.toLowerCase().includes(q)) return true;
  if(Array.isArray(item.tags) && item.tags.join(' ').toLowerCase().includes(q)) return true;
  return false;
}

function applyFilters(){
  const pos = $posFilter.value;
  const tag = $tagFilter.value.trim().toLowerCase();
  const query = $search.value.trim();
  state.lastQuery = query;
  state.filtered = state.allWords.filter(item => {
    if(state.showFavoritesOnly && !state.favorites.has(item.word)) return false;
    if(pos && String(item.pos).toLowerCase() !== pos) return false;
    if(tag){
      if(!item.tags || !item.tags.some(t => String(t).toLowerCase().includes(tag))) return false;
    }
    return matchesQuery(item, query);
  });
  state.page = 1;
  render();
}

const debouncedFilter = debounce(applyFilters, 220);

// render helpers
function clearChildren(node){
  while(node.firstChild) node.removeChild(node.firstChild);
}

function render(){
  const total = state.filtered.length;
  $resultCount.textContent = `Showing ${Math.min(total, (state.page-1)*state.pageSize + 1)} — ${Math.min(total, state.page*state.pageSize)} of ${total} entries`;
  $resultCount.setAttribute('aria-hidden', total === 0 ? 'true' : 'false');

  // pagination calculation
  const start = (state.page - 1) * state.pageSize;
  const end = Math.min(total, start + state.pageSize);
  const pageItems = state.filtered.slice(start, end);

  clearChildren($wordList);
  if(pageItems.length === 0){
    const li = document.createElement('li');
    li.className = 'word-item';
    li.textContent = 'No results. Try a different query or clear filters.';
    $wordList.appendChild(li);
  } else {
    pageItems.forEach(item => {
      const node = buildWordItem(item);
      $wordList.appendChild(node);
    });
  }

  renderPagination(total);
}

function renderPagination(total){
  clearChildren($pagination);
  const pages = Math.ceil(total / state.pageSize) || 1;
  // simple prev/next + page numbers
  const addPageButton = (label, idx, cls='page') => {
    const b = document.createElement('button');
    b.className = cls + (idx === state.page ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      state.page = idx;
      render();
      // focus first item for keyboard users
