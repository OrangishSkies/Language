/* script.js
   - Loads words.json
   - Provides search, filter, add entry, local caching/export
   - Accessibility: keyboard handling, focus management
   - Debounce for input, friendly errors
*/

/* CONFIG */
const WORDS_DATA_PATH = 'Data/words.json'; // relative path to JSON data file
const RESULTS_PAGE_SIZE = 30;               // how many results to show per "page"

/* App state */
const state = {
  words: [],              // full dataset (original + local additions)
  originalWords: [],      // original dataset (for reset)
  results: [],            // current search results
  query: '',
  filterPos: '',
  page: 0,                // for pagination
  selectedId: null
};

/* DOM references */
const $ = sel => document.querySelector(sel);
const resultsList = $('#results-list');
const resultCount = $('#result-count');
const searchInput = $('#search-input');
const filterSelect = $('#filter-pos');
const clearBtn = $('#clear-btn');
const addEntryBtn = $('#add-entry-btn');
const addEntryModal = $('#add-entry-modal');
const addEntryForm = $('#add-entry-form');
const cancelAddBtn = $('#cancel-add');
const exportBtn = $('#export-btn');
const loadMoreBtn = $('#load-more-btn');
const loadMoreWrap = $('#load-more-wrap');
const resetBtn = $('#reset-btn');
const detailPane = $('#word-detail');
const errorToast = $('#error-toast');

/* Utilities */
function showToast(msg, ms = 3500) {
  errorToast.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.add('hidden'), ms);
}

function debounce(fn, wait=300){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

function uniqueId(){
  return 'w_' + Math.random().toString(36).slice(2,9);
}

/* Data loading and persistence */
async function fetchWords() {
  try {
    const res = await fetch(WORDS_DATA_PATH, {cache: "no-store"});
    if (!res.ok) throw new Error('Failed to load words.json');
    const json = await res.json();
    return json;
  } catch (err) {
    console.error('fetchWords error', err);
    showToast('Unable to load dictionary file. Using local data if available.');
    return [];
  }
}

function loadLocalChanges() {
  const saved = localStorage.getItem('nl_words_local');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch(e){
    console.warn('local storage parse error', e);
    return [];
  }
}

function saveLocalChanges(localWords) {
  localStorage.setItem('nl_words_local', JSON.stringify(localWords));
}

/* Initialize app */
async function init(){
  resultCount.textContent = 'Loading dictionary…';
  const remoteWords = await fetchWords();
  const localWords = loadLocalChanges();
  state.originalWords = Array.isArray(remoteWords) ? remoteWords : [];
  state.words = [...state.originalWords, ...localWords];
  updateResultCount();
  setupEventListeners();
  applySearch(); // initial render (empty search => show first page)
}

/* Search logic */
function normalize(s){
  return (String(s) || '').toLowerCase();
}

function matchesEntry(entry, q, posFilter) {
  if (!q && !posFilter) return true;
  const qn = normalize(q);
  if (posFilter && entry.pos && entry.pos !== posFilter) return false;

  // fields to search
  if (qn === '') return true;

  const fields = [
    entry.word,
    entry.orthography,
    entry.definition,
    ...(entry.examples || [])
  ].filter(Boolean).map(normalize);

  return fields.some(f => f.includes(qn));
}

function applySearch() {
  state.page = 0;
  const q = state.query;
  const posFilter = state.filterPos;
  state.results = state.words.filter(e => matchesEntry(e, q, posFilter));
  renderResultsPage(); // first page
  updateResultCount();
}

function renderResultsPage() {
  resultsList.innerHTML = '';
  const start = state.page * RESULTS_PAGE_SIZE;
  const slice = state.results.slice(start, start + RESULTS_PAGE_SIZE);

  if (slice.length === 0) {
    resultsList.innerHTML = '<li class="muted">No results found.</li>';
    loadMoreWrap.style.display = 'none';
    return;
  }

  slice.forEach(entry => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.dataset.id = entry.id;
    li.innerHTML = `
      <div class="result-word">${escapeHtml(entry.word)}</div>
      <div class="muted small">${escapeHtml(entry.definition || '')}</div>
    `;
    li.addEventListener('click', () => selectEntry(entry.id));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectEntry(entry.id); });
    resultsList.appendChild(li);
  });

  // show load more if we have more results
  const moreAvailable = (state.page + 1) * RESULTS_PAGE_SIZE < state.results.length;
  loadMoreWrap.style.display = moreAvailable ? 'block' : 'none';
}

/* Render helpers */
function updateResultCount() {
  const n = state.results.length || state.words.length;
  if (state.query || state.filterPos) {
    resultCount.textContent = `${n} result${n !== 1 ? 's' : ''}`;
  } else {
    resultCount.textContent = `${state.words.length} total entries`;
  }
}

function selectEntry(id) {
  const entry = state.words.find(w => w.id === id);
  if (!entry) return;
  state.selectedId = id;
  // highlight selected in list
  [...resultsList.children].forEach(li => li.classList.toggle('selected', li.dataset.id === id));
  renderDetail(entry);
}

function renderDetail(entry) {
  detailPane.innerHTML = `
    <h2>${escapeHtml(entry.word)} ${entry.orthography ? '<span class="muted">('+escapeHtml(entry.orthography)+')</span>' : ''}</h2>
    <p class="muted">Part of speech: ${escapeHtml(entry.pos || '—')}</p>
    <div class="definition">
      <strong>Definition</strong>
      <p>${escapeHtml(entry.definition || '—')}</p>
    </div>
    ${entry.examples && entry.examples.length ? `<div class="examples"><strong>Examples</strong><ul>${entry.examples.map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ul></div>` : ''}
    <div class="detail-actions" style="margin-top:12px">
      <button class="btn" id="edit-entry-btn">Edit</button>
      <button class="btn" id="delete-entry-btn">Delete</button>
    </div>
  `;

  // wire up edit/delete
  $('#edit-entry-btn').addEventListener('click', () => openAddModalForEdit(entry));
  $('#delete-entry-btn').addEventListener('click', () => deleteEntry(entry.id));
}

/* Add / Edit / Delete entries (local only) */
function openAddModalForEdit(entry) {
  // prefill form and open modal
  addEntryModal.classList.remove('hidden');
  if (entry) {
    $('#entry-word').value = entry.word || '';
    $('#entry-orthography').value = entry.orthography || '';
    $('#entry-pos').value = entry.pos || 'other';
    $('#entry-english').value = entry.definition || '';
    $('#entry-examples').value = (entry.examples || []).join('\n');
    addEntryForm.dataset.editId = entry.id;
  } else {
    addEntryForm.reset();
    delete addEntryForm.dataset.editId;
  }
  $('#entry-word').focus();
}

function openAddModalBlank() {
  addEntryForm.reset();
  delete addEntryForm.dataset.editId;
  addEntryModal.classList.remove('hidden');
  $('#entry-word').focus();
}

function closeAddModal() {
  addEntryModal.classList.add('hidden');
  addEntryForm.reset();
  delete addEntryForm.dataset.editId;
}

function addOrUpdateEntry(formData) {
  const editId = addEntryForm.dataset.editId;
  const newEntry = {
    id: editId || uniqueId(),
    word: formData.word.trim(),
    orthography: formData.orthography.trim() || '',
    pos: formData.pos || 'other',
    definition: formData.definition.trim(),
    examples: (formData.examples || '').split('\n').map(s=>s.trim()).filter(Boolean)
  };

  if (editId) {
    // update existing (local override)
    const idxOriginal = state.words.findIndex(w => w.id === editId);
    if (idxOriginal !== -1) state.words[idxOriginal] = newEntry;
    // also update local storage list
    const local = loadLocalChanges().filter(w => w.id !== editId);
    local.push(newEntry);
    saveLocalChanges(local);
    showToast('Entry updated locally.');
  } else {
    // add new
    state.words.push(newEntry);
    const local = loadLocalChanges();
    local.push(newEntry);
    saveLocalChanges(local);
    showToast('New entry added locally.');
  }

  closeAddModal();
  applySearch(); // refresh
  selectEntry(newEntry.id);
}

function deleteEntry(id) {
  if (!confirm('Delete this entry from your local copy? This does not remove it from the original file.')) return;
  // remove from displayed list
  state.words = state.words.filter(w => w.id !== id);
  // remove from local storage saved additions/upserts
  const local = loadLocalChanges().filter(w => w.id !== id);
  saveLocalChanges(local);
  showToast('Entry removed from your local copy.');
  applySearch();
  detailPane.innerHTML = '<div class="placeholder"><p>Entry deleted. Select another entry or add a new one.</p></div>';
}

/* Export / Reset */
function exportJSON() {
  // export current local-changes merged set as a JSON file for download
  const data = JSON.stringify(state.words, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'new-language-dictionary-export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Export downloaded.');
}

function resetLocalChanges() {
  if (!confirm('Reset local changes? This will remove all entries you added/edited locally and reload original dictionary.')) return;
  localStorage.removeItem('nl_words_local');
  // re-fetch original and replace
  state.words = [...state.originalWords];
  saveLocalChanges([]); // ensure empty
  applySearch();
  showToast('Local changes cleared.');
}

/* Helpers & escape */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

/* Event wiring */
function setupEventListeners() {
  // search
  searchInput.addEventListener('input', debounce((e) => {
    state.query = e.target.value;
    applySearch();
  }, 220));

  // keyboard shortcut to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  filterSelect.addEventListener('change', (e) => {
    state.filterPos = e.target.value;
    applySearch();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterSelect.value = '';
    state.query = '';
    state.filterPos = '';
    applySearch();
  });

  addEntryBtn.addEventListener('click', openAddModalBlank);
  cancelAddBtn.addEventListener('click', closeAddModal);

  addEntryForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = new FormData(addEntryForm);
    const data = Object.fromEntries(form.entries());
    addOrUpdateEntry(data);
  });

  exportBtn.addEventListener('click', exportJSON);

  loadMoreBtn.addEventListener('click', () => {
    state.page++;
    renderResultsPage();
    // move focus to newly loaded results
    const firstNew = resultsList.children[(state.page*RESULTS_PAGE_SIZE) - 0];
    if (firstNew) firstNew.focus();
  });

  resetBtn.addEventListener('click', resetLocalChanges);

  // Improve accessibility: trap focus in modal while open
  document.addEventListener('focusin', (e) => {
    if (!addEntryModal.classList.contains('hidden')) {
      if (!addEntryModal.contains(e.target)) {
        // move focus to modal
        $('#entry-word').focus();
      }
    }
  });
}

/* Kick off the app */
init();
