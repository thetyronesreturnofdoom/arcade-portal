/* ============================================
   ARCADE PORTAL — app.js
   ============================================ */

// ── Constants ───────────────────────────────────
const STORAGE_KEYS = {
  RECENTLY_PLAYED: 'arcade_recently_played',
  FAVORITES:       'arcade_favorites',
};
const MAX_RECENT = 6;

// ── State ───────────────────────────────────────
const state = {
  games:          [],
  activeCategory: 'All',
  searchQuery:    '',
  recentlyPlayed: [],
  favorites:      new Set(),
};

// ── DOM refs ────────────────────────────────────
const els = {};

// ── Utility ─────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── LocalStorage helpers ────────────────────────
function saveRecent() {
  localStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, JSON.stringify(state.recentlyPlayed));
}

function saveFavorites() {
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([...state.favorites]));
}

function loadStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEYS.RECENTLY_PLAYED);
    state.recentlyPlayed = r ? JSON.parse(r) : [];
  } catch { state.recentlyPlayed = []; }

  try {
    const f = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    state.favorites = f ? new Set(JSON.parse(f)) : new Set();
  } catch { state.favorites = new Set(); }
}

function addToRecent(gameId) {
  state.recentlyPlayed = [gameId, ...state.recentlyPlayed.filter(id => id !== gameId)].slice(0, MAX_RECENT);
  saveRecent();
}

function toggleFavorite(gameId, e) {
  e && e.stopPropagation();
  if (state.favorites.has(gameId)) {
    state.favorites.delete(gameId);
  } else {
    state.favorites.add(gameId);
  }
  saveFavorites();
  renderAll();
}

// ── Load games ──────────────────────────────────
async function loadGames() {
  try {
    const res = await fetch('games.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.games = await res.json();
    loadStorage();
    init();
  } catch (err) {
    console.error('Failed to load games.json:', err);
    showLoadError();
  }
}

function showLoadError() {
  if (els.allGamesGrid) {
    els.allGamesGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
        <p style="font-family:var(--font-pixel);font-size:.6rem;color:var(--neon-pink);line-height:1.8;">
          Failed to load games.json<br>Make sure all files are in the same directory.
        </p>
      </div>`;
  }
}

// ── Init ────────────────────────────────────────
function init() {
  buildCategoryFilters();
  updateGameCount();
  renderAll();
  attachEvents();
}

// ── Category filters ────────────────────────────
function buildCategoryFilters() {
  const categories = ['All', 'Favorites', ...new Set(state.games.map(g => g.category))];

  els.filterBar.innerHTML = `
    <span class="filter-label">Genre</span>
    ${categories.map(cat => `
      <button class="filter-btn${cat === state.activeCategory ? ' active' : ''}" data-category="${cat}">
        ${cat === 'Favorites' ? '⭐ ' : ''}${cat}
      </button>
    `).join('')}
  `;

  els.filterBar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.category));
  });
}

function setCategory(cat) {
  state.activeCategory = cat;
  els.filterBar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === cat);
  });
  renderAll();
}

// ── Filter logic ────────────────────────────────
function getFiltered() {
  const q = state.searchQuery.toLowerCase().trim();
  return state.games.filter(game => {
    if (state.activeCategory === 'Favorites') return state.favorites.has(game.id);
    const matchesCat    = state.activeCategory === 'All' || game.category === state.activeCategory;
    const matchesSearch = !q || [game.title, game.description, game.category, ...(game.tags || [])]
      .some(s => s.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });
}

// ── Render ──────────────────────────────────────
function renderAll() {
  const filtered  = getFiltered();
  const featured  = filtered.filter(g => g.featured);
  const rest      = filtered.filter(g => !g.featured);
  const isSearch  = !!state.searchQuery;
  const isFavCat  = state.activeCategory === 'Favorites';

  // Recently played section
  renderRecent();

  // Featured section
  const showFeatured = featured.length > 0 && !isSearch && !isFavCat;
  els.featuredSection.style.display = showFeatured ? '' : 'none';
  if (showFeatured) {
    els.featuredGrid.innerHTML = featured.map((g, i) => cardHTML(g, i)).join('');
    attachCardEvents(els.featuredGrid);
  }

  // All games grid
  const gridGames = (isSearch || isFavCat) ? filtered : rest;
  els.allGamesGrid.innerHTML = gridGames.map((g, i) => cardHTML(g, i + (showFeatured ? featured.length : 0))).join('');
  attachCardEvents(els.allGamesGrid);

  // Section title
  els.allSectionTitle.textContent = isFavCat ? '⭐ Your Favorites' : isSearch ? '🔍 Results' : '🎮 All Games';

  // No results
  els.noResults.classList.toggle('visible', filtered.length === 0);
  updateGameCount(filtered.length);
}

function renderRecent() {
  const recentGames = state.recentlyPlayed
    .map(id => state.games.find(g => g.id === id))
    .filter(Boolean);

  const show = recentGames.length > 0 && !state.searchQuery && state.activeCategory !== 'Favorites';
  els.recentSection.style.display = show ? '' : 'none';

  if (show) {
    els.recentGrid.innerHTML = recentGames.map((g, i) => cardHTML(g, i, true)).join('');
    attachCardEvents(els.recentGrid);
  }
}

// ── Card HTML ────────────────────────────────────
function cardHTML(game, index, isRecent = false) {
  const delay     = Math.min(index * 0.04, 0.5);
  const isFav     = state.favorites.has(game.id);
  const isLocal   = !!game.file;

  const thumbContent = game.image
    ? `<img src="${game.image}" alt="${game.title}" class="card-thumb-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';

  return `
    <div class="game-card${isRecent ? ' card-recent' : ''}" data-id="${game.id}"
      style="--card-accent:${game.color};animation-delay:${delay}s">
      <div class="card-thumb">
        ${game.featured && !isRecent ? '<span class="badge-featured">⭐ HOT</span>' : ''}
        ${isLocal ? '<span class="badge-local">📁 LOCAL</span>' : ''}
        ${thumbContent}
        <span class="emoji" style="${game.image ? 'display:none' : ''}">${game.emoji}</span>
      </div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-category">${game.category}</div>
          <button class="fav-btn${isFav ? ' active' : ''}" data-id="${game.id}" title="${isFav ? 'Unfavorite' : 'Favorite'}">
            ${isFav ? '⭐' : '☆'}
          </button>
        </div>
        <div class="card-title">${game.title}</div>
        <div class="card-desc">${game.description}</div>
        <div class="card-footer">
          <div class="card-tags">
            ${(game.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          <button class="play-btn" data-id="${game.id}">▶ PLAY</button>
        </div>
      </div>
    </div>
  `;
}

function attachCardEvents(container) {
  // Play button
  container.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const game = state.games.find(g => g.id === parseInt(btn.dataset.id));
      if (game) openModal(game);
    });
  });

  // Card click
  container.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.fav-btn')) return;
      const game = state.games.find(g => g.id === parseInt(card.dataset.id));
      if (game) openModal(game);
    });
  });

  // Favorite button
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', e => toggleFavorite(parseInt(btn.dataset.id), e));
  });
}

// ── Game Count ──────────────────────────────────
function updateGameCount(count) {
  const total = count !== undefined ? count : state.games.length;
  els.gameCountBadge.innerHTML = `<span>${total}</span> game${total !== 1 ? 's' : ''} ready`;
}

// ── Fullscreen helpers ──────────────────────────
function requestFullscreen(el) {
  if (el.requestFullscreen)            return el.requestFullscreen();
  if (el.webkitRequestFullscreen)      return el.webkitRequestFullscreen();
  if (el.mozRequestFullScreen)         return el.mozRequestFullScreen();
  if (el.msRequestFullscreen)          return el.msRequestFullscreen();
}

function exitFullscreen() {
  if (document.exitFullscreen)         return document.exitFullscreen();
  if (document.webkitExitFullscreen)   return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen)    return document.mozCancelFullScreen();
  if (document.msExitFullscreen)       return document.msExitFullscreen();
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);
}

function updateFullscreenBtn() {
  if (els.modal.fullscreenBtn) {
    els.modal.fullscreenBtn.textContent = isFullscreen() ? '⛶ EXIT' : '⛶ FULL';
    els.modal.fullscreenBtn.title = isFullscreen() ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
  }
}

// ── Modal ───────────────────────────────────────
function openModal(game) {
  const { overlay, window: win, iframe, loadingOverlay, blockedOverlay,
          modalEmoji, modalName, modalCat, openExternal } = els.modal;

  // Track recently played
  addToRecent(game.id);

  // Reset state
  iframe.src = 'about:blank';
  loadingOverlay.classList.remove('hidden');
  blockedOverlay.classList.remove('visible');

  // Set accent
  win.style.setProperty('--modal-accent', game.color);

  // Populate header
  modalEmoji.textContent = game.emoji;
  modalName.textContent  = game.title;
  modalCat.textContent   = game.category;

  const gameURL = game.file ? game.file : game.url;
  openExternal.href    = gameURL;
  openExternal.onclick = (e) => { e.preventDefault(); window.open(gameURL, '_blank'); };

  // Open modal
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Load iframe
  let loaded = false;

  iframe.onload = () => {
    loaded = true;
    loadingOverlay.classList.add('hidden');

    // For local files we trust them; for external check for block
    if (!game.file) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || doc.body?.innerHTML === '') showBlocked(gameURL);
      } catch (_) {
        loadingOverlay.classList.add('hidden');
      }
    }
  };

  iframe.onerror = () => showBlocked(gameURL);

  iframe.src = gameURL;

  // Timeout fallback for external games
  if (!game.file) {
    setTimeout(() => { if (!loaded) showBlocked(gameURL); }, 12000);
  }

  // Auto-fullscreen
  setTimeout(() => {
    requestFullscreen(win).catch(() => {});
  }, 300);

  // Re-render to update recently played
  renderRecent();
}

function showBlocked(url) {
  els.modal.loadingOverlay.classList.add('hidden');
  els.modal.blockedOverlay.classList.add('visible');
  els.modal.blockedExternal.href    = url;
  els.modal.blockedExternal.onclick = (e) => { e.preventDefault(); window.open(url, '_blank'); };
}

function closeModal() {
  if (isFullscreen()) exitFullscreen();
  els.modal.overlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { els.modal.iframe.src = 'about:blank'; }, 320);
}

// ── Events ──────────────────────────────────────
function attachEvents() {
  // Search
  els.searchInput.addEventListener('input', debounce(e => {
    state.searchQuery = e.target.value;
    renderAll();
  }, 220));

  // Close modal
  els.modal.closeBtn.addEventListener('click', closeModal);
  els.modal.overlay.addEventListener('click', e => {
    if (e.target === els.modal.overlay) closeModal();
  });

  // Fullscreen toggle button
  els.modal.fullscreenBtn.addEventListener('click', () => {
    if (isFullscreen()) exitFullscreen();
    else requestFullscreen(els.modal.window).catch(() => {});
  });

  // Fullscreen change event
  document.addEventListener('fullscreenchange',       updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
  document.addEventListener('mozfullscreenchange',    updateFullscreenBtn);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !isFullscreen()) closeModal();
    if (e.key === 'f' || e.key === 'F') {
      if (els.modal.overlay.classList.contains('open')) {
        if (isFullscreen()) exitFullscreen();
        else requestFullscreen(els.modal.window).catch(() => {});
      }
    }
  });
}

// ── Bootstrap ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  els.filterBar        = document.getElementById('filter-bar');
  els.recentSection    = document.getElementById('recent-section');
  els.recentGrid       = document.getElementById('recent-grid');
  els.featuredSection  = document.getElementById('featured-section');
  els.featuredGrid     = document.getElementById('featured-grid');
  els.allGamesGrid     = document.getElementById('all-games-grid');
  els.allSectionTitle  = document.getElementById('all-section-title');
  els.noResults        = document.getElementById('no-results');
  els.searchInput      = document.getElementById('search-input');
  els.gameCountBadge   = document.getElementById('game-count');

  els.modal = {
    overlay:         document.getElementById('modal-overlay'),
    window:          document.getElementById('modal-window'),
    iframe:          document.getElementById('game-iframe'),
    loadingOverlay:  document.getElementById('iframe-loading'),
    blockedOverlay:  document.getElementById('iframe-blocked'),
    modalEmoji:      document.getElementById('modal-emoji'),
    modalName:       document.getElementById('modal-game-name'),
    modalCat:        document.getElementById('modal-game-category'),
    openExternal:    document.getElementById('modal-open-external'),
    blockedExternal: document.getElementById('blocked-open-external'),
    closeBtn:        document.getElementById('modal-close'),
    fullscreenBtn:   document.getElementById('modal-fullscreen'),
  };

  loadGames();
});
