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

  container.innerHTML = list.map((thread, idx) => {
    // Image URL
    let imageUrl = thread.image || '';
    if (imageUrl.startsWith('ipfs://')) imageUrl = `/api/image/${imageUrl.replace('ipfs://', '')}`;
    const hasImage = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/api/') || imageUrl.startsWith('data:'));

    // Date in 4chan format
    const date = thread.createdAt?._seconds ? new Date(thread.createdAt._seconds * 1000) : new Date();
    const dateStr = formatChanDate(date);

    // Shortened mint address as "post number"
    const shortMint = thread.mint.slice(0, 6) + '...' + thread.mint.slice(-4);

    // Description excerpt
    const desc = thread.description || '';
    const excerpt = desc.length > 250 ? desc.slice(0, 250) + '...' : desc;

    // Reply count
    const replies = thread.commentCount || 0;

    // Pinned badge
    const pinnedHtml = thread.pinned
      ? '<span style="color:#c00; font-size:10px; margin-right:4px;">[STICKY]</span>'
      : '';

    // Board tag
    const boardInfo = thread.board && BOARDS[thread.board] ? BOARDS[thread.board] : null;
    const boardHtml = boardInfo
      ? `&nbsp;<a href="/threads?board=${thread.board}" class="board-tag">${boardInfo.name}</a>`
      : '';

    // Twitter link
    const twitterHtml = thread.twitter
      ? `&nbsp;<a href="${escapeHtml(normalizeTwitterUrl(thread.twitter))}" target="_blank"
            style="font-size:10px; color:#0000EE;" rel="noopener">[Twitter]</a>`
      : '';

    // Left margin when image present
    const bodyMargin = hasImage ? 'margin-left:145px;' : '';

    return `
      <div class="thread" id="thread_${idx}">
        <div class="post op">

          <!-- Post info line -->
          <div class="postInfo">
            ${pinnedHtml}
            <span class="subject">
              <a href="/thread/${thread.mint}" style="color:#DD0000; text-decoration:none;">
                ${escapeHtml(thread.name)} (${escapeHtml(thread.symbol)})
              </a>
            </span>
            <span class="name">${escapeHtml(thread.creatorUsername || 'Anonymous')}</span>
            <span class="dateTime">${dateStr}</span>
            <span class="postNum">
              <a title="${thread.mint}">No.</a><a title="${thread.mint}">${shortMint}</a>
            </span>
            <a class="replylink" href="/thread/${thread.mint}">[Reply]</a>
            ${boardHtml}
            ${twitterHtml}
          </div>

          ${hasImage ? `
          <div class="file">
            <p class="fileinfo">
              <a href="/thread/${thread.mint}" style="color:#666; text-decoration:none;">${escapeHtml(thread.name)}.png</a>
              <span class="unimportant" id="mc-${thread.mint}"></span>
            </p>
            <a class="fileThumb" href="/thread/${thread.mint}">
              <img class="post-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(thread.name)}"
                   style="max-width:125px; max-height:125px;"
                   onerror="this.closest('.file').style.display='none'">
            </a>
          </div>` : ''}

          <!-- Post body (description excerpt) -->
          <blockquote class="postMessage" style="${bodyMargin}">
            ${excerpt
              ? escapeHtml(excerpt)
              : '<span class="quote">&gt; no description provided</span>'
            }
          </blockquote>

          <!-- Omitted replies text -->
          <span class="omitted">
            <span id="vol-${thread.mint}"></span>
            ${replies > 0
              ? `${replies} ${replies === 1 ? 'reply' : 'replies'} omitted.
                 <a href="/thread/${thread.mint}">Click here to view.</a>`
              : `<a href="/thread/${thread.mint}">Be the first to reply.</a>`
            }
          </span>

        </div>
        <br class="clear">
      </div>
      <hr>
    `;
  }).join('');

  // Fetch live stats for visible coins
  list.forEach(thread => updateCoinStats(thread.mint));
}

async function updateCoinStats(mint) {
  try {
    const res = await fetch(`/api/coin/${mint}`);
    if (!res.ok) return;
    const coin = await res.json();

    const mcEl = document.getElementById(`mc-${mint}`);
    if (mcEl && coin.marketCap) {
      mcEl.textContent = ` (MC: $${formatNum(coin.marketCap)})`;
    }

    const volEl = document.getElementById(`vol-${mint}`);
    if (volEl && coin.volume24h) {
      volEl.textContent = `Vol: $${formatNum(coin.volume24h)} | `;
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
    if (mcEl && data.marketCap) mcEl.textContent = ` (MC: $${formatNum(data.marketCap)})`;

    const volEl = document.getElementById(`vol-${data.mint}`);
    if (volEl && data.volume24h) volEl.textContent = `Vol: $${formatNum(data.volume24h)} | `;
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
