// 4chan-style catalog view — token grid

const BOARDS = {
  sol:    { name: '/sol/',    full: 'Solana' },
  meme:   { name: '/meme/',   full: 'Memes & Culture' },
  degen:  { name: '/degen/',  full: 'Degen Trading' },
  moon:   { name: '/moon/',   full: 'Moon Shots' },
  ai:     { name: '/ai/',     full: 'AI & Bots' },
  pol:    { name: '/pol/',    full: 'Politics' },
  tek:    { name: '/tek/',    full: 'Technology' },
  animal: { name: '/animal/', full: 'Animals & Nature' },
  trump:  { name: '/trump/',  full: 'Trump' },
  elon:   { name: '/elon/',   full: 'Elon & Space' },
  random: { name: '/random/', full: 'Random' }
};

const activeBoard = new URLSearchParams(window.location.search).get('board') || null;

let allThreads = [];
let filteredThreads = [];
let searchQuery = '';

async function loadCatalog() {
  const grid = document.getElementById('catalogGrid');

  if (activeBoard && BOARDS[activeBoard]) {
    const b = BOARDS[activeBoard];
    const titleEl = document.getElementById('boardTitle');
    const subtitleEl = document.getElementById('boardSubtitle');
    if (titleEl) titleEl.textContent = b.name + ' - ' + b.full;
    if (subtitleEl) subtitleEl.textContent = 'Tokens on ' + b.name;
  }

  try {
    const url = activeBoard ? `/api/threads?board=${activeBoard}` : '/api/threads';
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.threads || data.threads.length === 0) {
      grid.innerHTML = `
        <div style="padding:20px; text-align:center; color:#800000;">
          <span class="quote">&gt; No tokens yet. <a href="/">Launch the first coin!</a></span>
        </div>`;
      return;
    }

    allThreads = data.threads;
    applySearch();
    renderCatalog();

  } catch (err) {
    console.error('Error loading catalog:', err);
    grid.innerHTML = `
      <div style="padding:20px; text-align:center; color:#800000;">
        <span class="quote">&gt; Error loading catalog. Please refresh.</span>
      </div>`;
  }
}

function applySearch() {
  if (!searchQuery) {
    filteredThreads = [...allThreads];
    return;
  }
  const q = searchQuery.toLowerCase();
  filteredThreads = allThreads.filter(t =>
    t.name?.toLowerCase().includes(q) ||
    t.symbol?.toLowerCase().includes(q) ||
    t.mint?.toLowerCase().includes(q) ||
    t.creatorUsername?.toLowerCase().includes(q)
  );
}

function renderCatalog() {
  const grid = document.getElementById('catalogGrid');

  if (filteredThreads.length === 0) {
    grid.innerHTML = `
      <div style="padding:20px; text-align:center; color:#800000;">
        <span class="quote">&gt; No results for &quot;${escapeHtml(searchQuery)}&quot;</span>
      </div>`;
    return;
  }

  grid.innerHTML = `<div class="catalog-grid">${filteredThreads.map(thread => {
    let imageUrl = thread.image || '';
    if (imageUrl.startsWith('ipfs://')) imageUrl = `/api/image/${imageUrl.replace('ipfs://', '')}`;
    const hasImage = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/api/') || imageUrl.startsWith('data:'));

    const replies = thread.commentCount || 0;
    const name = escapeHtml(thread.name || '');
    const symbol = escapeHtml(thread.symbol || '');
    const pinnedHtml = thread.pinned ? '<div class="catalog-sticky">[STICKY]</div>' : '';

    return `
      <a class="catalog-card" href="/thread/${thread.mint}" title="${name} (${symbol})">
        ${pinnedHtml}
        <div class="catalog-img-wrap">
          ${hasImage
            ? `<img src="${escapeHtml(imageUrl)}" alt="${name}"
                    onerror="this.closest('.catalog-card').querySelector('.catalog-img-wrap').innerHTML='<div class=\\'catalog-no-img\\'>${symbol}</div>'">`
            : `<div class="catalog-no-img">${symbol}</div>`
          }
        </div>
        <div class="catalog-info">
          <div class="catalog-title">${name} <span class="catalog-symbol">(${symbol})</span></div>
          <div class="catalog-replies" id="cat-replies-${thread.mint}">${replies} ${replies === 1 ? 'reply' : 'replies'}${thread.board && BOARDS[thread.board] ? ` &nbsp;<a href="/catalog?board=${thread.board}" class="board-tag">${BOARDS[thread.board].name}</a>` : ''}</div>
          <div class="catalog-mc" id="cat-mc-${thread.mint}"></div>
        </div>
      </a>
    `;
  }).join('')}</div>`;

  // Fetch live market caps
  filteredThreads.forEach(t => updateCatalogStats(t.mint));

  // Subscribe to websocket updates
  if (typeof WsClient !== 'undefined') {
    WsClient.subscribe(filteredThreads.map(t => t.mint));
  }
}

async function updateCatalogStats(mint) {
  try {
    const res = await fetch(`/api/coin/${mint}`);
    if (!res.ok) return;
    const coin = await res.json();
    const mcEl = document.getElementById(`cat-mc-${mint}`);
    if (mcEl && coin.marketCap) mcEl.textContent = `MC: $${formatNum(coin.marketCap)}`;
  } catch (e) { /* ignore */ }
}

// ===== HELPERS =====

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// ===== GLOBAL FUNCTIONS =====

window.searchCatalog = function () {
  searchQuery = document.getElementById('searchInput').value.trim();
  applySearch();
  renderCatalog();
};

(function () {
  const si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('keypress', e => { if (e.key === 'Enter') window.searchCatalog(); });
    si.addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      applySearch();
      renderCatalog();
    });
  }
})();

// ===== WEBSOCKET REAL-TIME =====
if (typeof WsClient !== 'undefined') {
  WsClient.init(function (data) {
    const mcEl = document.getElementById(`cat-mc-${data.mint}`);
    if (mcEl && data.marketCap) mcEl.textContent = `MC: $${formatNum(data.marketCap)}`;
  });
}

// Initial load + refresh every 2 minutes
loadCatalog();
setInterval(loadCatalog, 120000);
