/* ============================================
   ARCADE PORTAL — app.js
   ============================================ */

// ── State ──────────────────────────────────────
const state = {
  games: [],
  activeCategory: 'All',
  searchQuery: '',
};

// ── DOM refs (populated after DOMContentLoaded) ─
const els = {};

// ── Utility: debounce ───────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Load games from JSON ────────────────────────
async function loadGames() {
  try {
    const res = await fetch('games.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.games = await res.json();
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

// ── Build category filter buttons ───────────────
function buildCategoryFilters() {
  const categories = ['All', ...new Set(state.games.map(g => g.category))];

  els.filterBar.innerHTML = `
    <span class="filter-label">Genre</span>
    ${categories.map(cat => `
      <button
        class="filter-btn${cat === state.activeCategory ? ' active' : ''}"
        data-category="${cat}"
      >${cat}</button>
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
    const matchesCat  = state.activeCategory === 'All' || game.category === state.activeCategory;
    const matchesSearch = !q || [game.title, game.description, game.category, ...(game.tags || [])]
      .some(s => s.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });
}

// ── Render ──────────────────────────────────────
function renderAll() {
  const filtered = getFiltered();

  const featured = filtered.filter(g => g.featured);
  const rest     = filtered.filter(g => !g.featured);

  // Featured section
  const showFeatured = featured.length > 0 && !state.searchQuery;
  els.featuredSection.style.display = showFeatured ? '' : 'none';

  if (showFeatured) {
    els.featuredGrid.innerHTML = featured.map((g, i) => cardHTML(g, i)).join('');
    attachCardEvents(els.featuredGrid);
  }

  // All games
  els.allGamesGrid.innerHTML = rest.map((g, i) => cardHTML(g, i + featured.length)).join('');
  attachCardEvents(els.allGamesGrid);

  // Show/hide no-results
  const empty = filtered.length === 0;
  els.noResults.classList.toggle('visible', empty);

  // Update counter
  updateGameCount(filtered.length);
}

function cardHTML(game, index) {
  const delay = Math.min(index * 0.04, 0.5);
  return `
    <div
      class="game-card"
      data-id="${game.id}"
      style="--card-accent:${game.color};animation-delay:${delay}s"
    >
      <div class="card-thumb">
        ${game.featured ? '<span class="badge-featured">⭐ HOT</span>' : ''}
        <span class="emoji">${game.emoji}</span>
      </div>
      <div class="card-body">
        <div class="card-category">${game.category}</div>
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
  container.querySelectorAll('.game-card, .play-btn').forEach(el => {
    el.addEventListener('click', e => {
      const id = parseInt(el.dataset.id || el.closest('.game-card').dataset.id);
      const game = state.games.find(g => g.id === id);
      if (game) openModal(game);
      e.stopPropagation();
    });
  });
}

// ── Game Count ──────────────────────────────────
function updateGameCount(count) {
  const total = count !== undefined ? count : state.games.length;
  els.gameCountBadge.innerHTML = `<span>${total}</span> game${total !== 1 ? 's' : ''} ready`;
}

// ── Modal ───────────────────────────────────────
function openModal(game) {
  const { overlay, window: win, iframe, loadingOverlay, blockedOverlay, modalEmoji,
          modalName, modalCat, openExternal } = els.modal;

  // Reset
  iframe.src = 'about:blank';
  loadingOverlay.classList.remove('hidden');
  blockedOverlay.classList.remove('visible');

  // Set accent color
  win.style.setProperty('--modal-accent', game.color);

  // Populate header
  modalEmoji.textContent = game.emoji;
  modalName.textContent  = game.title;
  modalCat.textContent   = game.category;
  openExternal.href      = game.url;
  openExternal.onclick   = () => window.open(game.url, '_blank');

  // Open overlay
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Load iframe with a timeout to detect blocks
  let loaded = false;

  iframe.onload = () => {
    loaded = true;
    loadingOverlay.classList.add('hidden');

    // Try to detect empty / blocked iframe
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || doc.body?.innerHTML === '') showBlocked(game.url);
    } catch (_) {
      // Cross-origin: if we can't read it, it at least loaded something
      loadingOverlay.classList.add('hidden');
    }
  };

  iframe.onerror = () => { showBlocked(game.url); };

  // Start loading
  iframe.src = game.url;

  // Fallback timeout — if no load event after 12s, show blocked notice
  setTimeout(() => {
    if (!loaded) showBlocked(game.url);
  }, 12000);
}

function showBlocked(url) {
  els.modal.loadingOverlay.classList.add('hidden');
  els.modal.blockedOverlay.classList.add('visible');
  els.modal.blockedExternal.href = url;
  els.modal.blockedExternal.onclick = () => window.open(url, '_blank');
}

function closeModal() {
  els.modal.overlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    els.modal.iframe.src = 'about:blank';
  }, 320);
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

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ── Bootstrap ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Cache DOM refs
  els.filterBar       = document.getElementById('filter-bar');
  els.featuredSection = document.getElementById('featured-section');
  els.featuredGrid    = document.getElementById('featured-grid');
  els.allGamesGrid    = document.getElementById('all-games-grid');
  els.noResults       = document.getElementById('no-results');
  els.searchInput     = document.getElementById('search-input');
  els.gameCountBadge  = document.getElementById('game-count');

  els.modal = {
    overlay:        document.getElementById('modal-overlay'),
    window:         document.getElementById('modal-window'),
    iframe:         document.getElementById('game-iframe'),
    loadingOverlay: document.getElementById('iframe-loading'),
    blockedOverlay: document.getElementById('iframe-blocked'),
    modalEmoji:     document.getElementById('modal-emoji'),
    modalName:      document.getElementById('modal-game-name'),
    modalCat:       document.getElementById('modal-game-category'),
    openExternal:   document.getElementById('modal-open-external'),
    blockedExternal:document.getElementById('blocked-open-external'),
    closeBtn:       document.getElementById('modal-close'),
  };

  loadGames();
});
