// 4chan-style board index — all launched tokens as threads

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

let currentThreads = [];
let filteredThreads = [];
let sortColumn = 'date';
let sortDirection = 'desc';
let searchQuery = '';

async function loadThreads() {
  const container = document.getElementById('threadsList');

  // Update board header if filtering
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
      container.innerHTML = `
        <div style="padding:20px; text-align:center; color:#800000;">
          <span class="quote">&gt; No threads yet. <a href="/">Launch the first coin!</a></span>
        </div>`;
      return;
    }

    currentThreads = data.threads;
    applySearch();
    sortThreadsData();
    renderThreads();

  } catch (err) {
    console.error('Error loading threads:', err);
    container.innerHTML = `
      <div style="padding:20px; text-align:center; color:#800000;">
        <span class="quote">&gt; Error loading threads. Please refresh.</span>
      </div>`;
  }
}

function applySearch() {
  if (!searchQuery) {
    filteredThreads = [...currentThreads];
    return;
  }
  const q = searchQuery.toLowerCase();
  filteredThreads = currentThreads.filter(t =>
    t.name?.toLowerCase().includes(q) ||
    t.symbol?.toLowerCase().includes(q) ||
    t.mint?.toLowerCase().includes(q) ||
    t.creatorUsername?.toLowerCase().includes(q)
  );
}

function sortThreadsData() {
  const list = filteredThreads.length > 0 || searchQuery ? filteredThreads : currentThreads;

  list.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    let aVal, bVal;
    switch (sortColumn) {
      case 'mc':      aVal = a.marketCap || 0;       bVal = b.marketCap || 0;       break;
      case 'replies': aVal = a.commentCount || 0;    bVal = b.commentCount || 0;    break;
      case 'date':    aVal = a.createdAt?._seconds || 0; bVal = b.createdAt?._seconds || 0; break;
      default: return 0;
    }
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Update sort link styling
  ['date', 'mc', 'replies'].forEach(col => {
    const el = document.getElementById(`sort-${col}`);
    if (!el) return;
    if (col === sortColumn) {
      el.style.fontWeight = 'bold';
      el.style.color = '#800000';
      el.textContent = el.textContent.replace(/[▲▼]/g, '') + (sortDirection === 'desc' ? '▼' : '▲');
    } else {
      el.style.fontWeight = 'normal';
      el.style.color = '#0000EE';
      el.textContent = el.textContent.replace(/[▲▼]/g, '');
    }
  });
}

function renderThreads() {
  const container = document.getElementById('threadsList');
  const list = filteredThreads.length > 0 || searchQuery ? filteredThreads : currentThreads;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="padding:20px; text-align:center; color:#800000;">
        <span class="quote">&gt; No results for &quot;${escapeHtml(searchQuery)}&quot;</span>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="catalog-grid">' + list.map(thread => {
    let imageUrl = thread.image || '';
    if (imageUrl.startsWith('ipfs://')) imageUrl = `/api/image/${imageUrl.replace('ipfs://', '')}`;
    const hasImage = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/api/') || imageUrl.startsWith('data:'));

    const replies = thread.commentCount || 0;
    const name = escapeHtml(thread.name || '');
    const symbol = escapeHtml(thread.symbol || '');
    const pinnedHtml = thread.pinned ? '<div class="catalog-sticky">[STICKY]</div>' : '';
    const boardInfo = thread.board && BOARDS[thread.board] ? BOARDS[thread.board] : null;
    const boardHtml = boardInfo
      ? ` &nbsp;<a href="/threads?board=${thread.board}" class="board-tag">${boardInfo.name}</a>`
      : '';

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
          <div class="catalog-replies">${replies} ${replies === 1 ? 'reply' : 'replies'}${boardHtml}</div>
          <div class="catalog-mc" id="mc-${thread.mint}"></div>
        </div>
      </a>`;
  }).join('') + '</div>';

  // Fetch live stats for visible coins
  list.forEach(thread => updateCoinStats(thread.mint));
}

async function updateCoinStats(mint) {
  try {
    const res = await fetch(`/api/coin/${mint}`);
    if (!res.ok) return;
    const coin = await res.json();
    const mcEl = document.getElementById(`mc-${mint}`);
    if (mcEl) {
      const parts = [];
      if (coin.marketCap) parts.push(`MC: $${formatNum(coin.marketCap)}`);
      if (coin.volume24h) parts.push(`Vol: $${formatNum(coin.volume24h)}`);
      if (parts.length) mcEl.textContent = parts.join(' | ');
    }
  } catch (e) { /* ignore */ }
}

// ===== HELPERS =====

function formatChanDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = n => String(n).padStart(2, '0');
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const yr = String(date.getFullYear()).slice(-2);
  const day = days[date.getDay()];
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${mo}/${d}/${yr}(${day})${h}:${m}:${s}`;
}

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

function normalizeTwitterUrl(t) {
  if (!t) return '';
  if (t.startsWith('http')) return t;
  return `https://twitter.com/${t.replace('@', '')}`;
}

// ===== GLOBAL FUNCTIONS (onclick handlers) =====

window.sortBy = function (col) {
  if (sortColumn === col) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = col;
    sortDirection = 'desc';
  }
  sortThreadsData();
  renderThreads();
};

window.searchThreads = function () {
  searchQuery = document.getElementById('searchInput').value.trim();
  applySearch();
  sortThreadsData();
  renderThreads();
};

// Search on Enter / real-time (script loads after DOM, so no DOMContentLoaded needed)
(function () {
  const si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('keypress', e => { if (e.key === 'Enter') window.searchThreads(); });
    si.addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      applySearch();
      sortThreadsData();
      renderThreads();
    });
  }
})();

// ===== WEBSOCKET REAL-TIME UPDATES =====
if (typeof WsClient !== 'undefined') {
  WsClient.init(function (data) {
    const mcEl = document.getElementById(`mc-${data.mint}`);
    if (mcEl) {
      const parts = [];
      if (data.marketCap) parts.push(`MC: $${formatNum(data.marketCap)}`);
      if (data.volume24h) parts.push(`Vol: $${formatNum(data.volume24h)}`);
      if (parts.length) mcEl.textContent = parts.join(' | ');
    }
  });
}

// Subscribe mints after render
const _origRender = renderThreads;
renderThreads = function () {
  _origRender();
  if (typeof WsClient !== 'undefined') {
    const list = filteredThreads.length > 0 || searchQuery ? filteredThreads : currentThreads;
    const mints = list.map(t => t.mint);
    if (mints.length > 0) WsClient.subscribe(mints);
  }
};

// Initial load + refresh every 2 minutes
loadThreads();
setInterval(loadThreads, 120000);
