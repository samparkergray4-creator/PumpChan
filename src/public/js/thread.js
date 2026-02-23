// 4chan-style thread view

const mint = window.location.pathname.split('/').pop();

// ===== CHART =====
var priceChart = null;
var areaSeries = null;
var candleSeries = null;
var chartPoints = [];
var candlePoints = [];
var currentMode = 'line';

var chartPriceFormat = {
  type: 'custom',
  formatter: function (price) { return '$' + formatNum(price); }
};

function initChart() {
  var container = document.getElementById('priceChart');
  if (!container || priceChart) return;

  priceChart = LightweightCharts.createChart(container, {
    layout: {
      background: { color: '#FFFFFF' },
      textColor: '#800000',
      fontFamily: 'sans-serif',
      fontSize: 9
    },
    grid: {
      vertLines: { color: '#F0E0D6' },
      horzLines: { color: '#F0E0D6' }
    },
    crosshair: {
      vertLine: { color: '#800000', labelBackgroundColor: '#800000' },
      horzLine: { color: '#800000', labelBackgroundColor: '#800000' }
    },
    rightPriceScale: { borderColor: '#D9BFB7' },
    timeScale: { borderColor: '#D9BFB7', timeVisible: true, secondsVisible: false },
    handleScale: false,
    handleScroll: false
  });
}

function showAreaSeries() {
  if (!priceChart) initChart();
  if (candleSeries) { priceChart.removeSeries(candleSeries); candleSeries = null; }
  if (!areaSeries) {
    areaSeries = priceChart.addAreaSeries({
      lineColor: '#800000',
      lineWidth: 2,
      topColor: 'rgba(128,0,0,0.15)',
      bottomColor: 'rgba(128,0,0,0.02)',
      priceFormat: chartPriceFormat
    });
  }
  var seriesData = chartPoints.map(function (p) {
    return { time: Math.floor(p.t / 1000), value: p.mc };
  });
  areaSeries.setData(seriesData);
  priceChart.timeScale().fitContent();
}

function showCandleSeries() {
  if (!priceChart) initChart();
  if (areaSeries) { priceChart.removeSeries(areaSeries); areaSeries = null; }
  if (!candleSeries) {
    candleSeries = priceChart.addCandlestickSeries({
      upColor: '#789922',
      borderUpColor: '#117743',
      wickUpColor: '#117743',
      downColor: '#DD0000',
      borderDownColor: '#880000',
      wickDownColor: '#880000',
      priceFormat: chartPriceFormat
    });
  }
}

function renderCandles() {
  if (!candleSeries) return;
  var data = candlePoints.map(function (c) {
    return { time: Math.floor(c.t / 1000), open: c.o, high: c.h, low: c.l, close: c.c };
  });
  candleSeries.setData(data);
  priceChart.timeScale().fitContent();
}

function buildCandlesFromPoints(points, tf) {
  var intervals = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000 };
  var interval = intervals[tf];
  if (!interval || !points.length) return [];
  var candles = [];
  var cur = null;
  for (var i = 0; i < points.length; i++) {
    var p = points[i];
    var ct = Math.floor(p.t / interval) * interval;
    if (!cur || cur.t !== ct) {
      if (cur) candles.push(cur);
      var openPrice = cur ? cur.c : p.mc;
      cur = { t: ct, o: openPrice, h: Math.max(openPrice, p.mc), l: Math.min(openPrice, p.mc), c: p.mc };
    } else {
      if (p.mc > cur.h) cur.h = p.mc;
      if (p.mc < cur.l) cur.l = p.mc;
      cur.c = p.mc;
    }
  }
  if (cur) candles.push(cur);
  return candles;
}

async function loadCandles(tf) {
  try {
    var res = await fetch('/api/coin/' + mint + '/chart?tf=' + tf);
    var data = await res.json();
    if (data.success && data.candles && data.candles.length > 0) {
      candlePoints = data.candles;
    } else {
      candlePoints = buildCandlesFromPoints(chartPoints, tf);
    }
    showCandleSeries();
    renderCandles();
    var ph = document.getElementById('chartPlaceholder');
    if (ph) ph.style.display = candlePoints.length > 0 ? 'none' : '';
  } catch (e) { console.error('Error loading candles:', e); }
}

window.switchChartMode = function switchChartMode(mode) {
  currentMode = mode;
  document.querySelectorAll('#tfBar .tf-btn').forEach(function (btn) {
    if (btn.getAttribute('data-tf') === mode) btn.classList.add('tf-btn-active');
    else btn.classList.remove('tf-btn-active');
  });
  if (mode === 'line') {
    if (!priceChart) initChart();
    showAreaSeries();
    var ph = document.getElementById('chartPlaceholder');
    if (ph) ph.style.display = chartPoints.length > 0 ? 'none' : '';
  } else {
    loadCandles(mode);
  }
};

async function loadChart() {
  try {
    var res = await fetch('/api/coin/' + mint + '/chart');
    var data = await res.json();
    if (data.success && data.points.length > 0) {
      chartPoints = data.points;
      renderChart();
    }
  } catch (e) { console.error('Error loading chart:', e); }
}

function renderChart() {
  var ph = document.getElementById('chartPlaceholder');
  if (chartPoints.length === 0) { if (ph) ph.style.display = ''; return; }
  if (ph) ph.style.display = 'none';
  if (!priceChart) initChart();
  if (currentMode === 'line') showAreaSeries();
}

function addChartPoint(marketCap, wsCandles) {
  if (!marketCap || marketCap <= 0) return;
  chartPoints.push({ t: Date.now(), mc: marketCap });
  if (chartPoints.length > 500) chartPoints.shift();
  var ph = document.getElementById('chartPlaceholder');
  if (ph) ph.style.display = 'none';
  if (!priceChart) initChart();
  if (currentMode === 'line') {
    if (!areaSeries) showAreaSeries();
    areaSeries.update({ time: Math.floor(Date.now() / 1000), value: marketCap });
  } else if (wsCandles && wsCandles[currentMode] && candleSeries) {
    var c = wsCandles[currentMode];
    candleSeries.update({ time: Math.floor(c.t / 1000), open: c.o, high: c.h, low: c.l, close: c.c });
  }
}

// ===== LOAD THREAD DATA =====

async function loadThread() {
  try {
    const res = await fetch(`/api/coin/${mint}`);
    if (!res.ok) throw new Error('Coin not found');
    const coin = await res.json();

    // Page title + breadcrumb
    document.title = `${coin.name} (${coin.symbol}) - /biz/`;
    const bc = document.getElementById('breadcrumbText');
    if (bc) bc.textContent = `${coin.name} (${coin.symbol})`;

    // OP subject line
    document.getElementById('opSubject').textContent = `${coin.name} (${coin.symbol})`;
    document.getElementById('opCreator').textContent = coin.creatorUsername || 'Anonymous';

    // Date in 4chan format
    const opDate = new Date(coin.createdAt * 1000);
    document.getElementById('opDateTime').textContent = formatChanDate(opDate);

    // Post number (shortened mint)
    const shortMint = coin.mint.slice(0, 6) + '...' + coin.mint.slice(-4);
    document.getElementById('opPostNo').textContent = shortMint;
    document.getElementById('opPostNo').title = coin.mint;

    // Image
    const opFile = document.getElementById('opFile');
    let imageUrl = coin.image || '';
    if (imageUrl.startsWith('ipfs://')) {
      imageUrl = `/api/image/${imageUrl.replace('ipfs://', '')}`;
    }
    if (imageUrl && !imageUrl.startsWith('mock://')) {
      document.getElementById('opImage').src = imageUrl;
      document.getElementById('opFileLink').href = imageUrl;
      document.getElementById('opFileInfo').textContent = `${coin.name}.png`;
      opFile.style.display = '';
    }

    // Post body (description)
    document.getElementById('opBody').textContent = coin.description || '(no description provided)';

    // Stats
    document.getElementById('statMC').textContent = coin.marketCap
      ? `$${formatNum(coin.marketCap)}` : '—';
    document.getElementById('statVolume').textContent = coin.volume24h
      ? `$${formatNum(coin.volume24h)}` : '—';
    document.getElementById('statHolders').textContent = coin.holders || '0';

    // Contract / links
    document.getElementById('coinMint').textContent = coin.mint;
    document.getElementById('pumpLink').href = `https://pump.fun/${coin.mint}`;

    if (coin.twitter) {
      const twitterEl = document.getElementById('twitterLink');
      let twitterUrl = coin.twitter;
      if (!twitterUrl.startsWith('http')) {
        twitterUrl = `https://twitter.com/${twitterUrl.replace('@', '')}`;
      }
      twitterEl.href = twitterUrl;
      twitterEl.style.display = '';
    }

    // Load comments and chart
    await loadComments();
    await loadChart();
    if (chartPoints.length === 0 && coin.marketCap) addChartPoint(coin.marketCap);

  } catch (err) {
    console.error('Error loading thread:', err);
    document.getElementById('opSubject').textContent = 'Thread not found';
    document.getElementById('opBody').textContent = 'This thread does not exist.';
  }
}

// ===== LOAD COMMENTS AS 4CHAN REPLIES =====

async function loadComments() {
  try {
    const res = await fetch(`/api/thread/${mint}/comments`);
    const data = await res.json();
    const repliesList = document.getElementById('repliesList');

    if (!data.success || !data.comments || data.comments.length === 0) {
      repliesList.innerHTML = `
        <div style="padding:8px 10px; color:#888; font-size:11px;">
          <span class="quote">&gt; No replies yet. Be the first!</span>
        </div>`;
      document.getElementById('statComments').textContent = '0';
      return;
    }

    repliesList.innerHTML = data.comments.map((comment, idx) => {
      const date = getDate(comment.createdAt);
      const dateStr = formatChanDate(date);
      return `
        <div class="post reply" id="reply_${idx + 1}">
          <div class="postInfo">
            <span class="name">${escapeHtml(comment.username || 'Anonymous')}</span>
            <span class="dateTime">${dateStr}</span>
            <span class="postNum">
              <a>No.</a><a>${idx + 1}</a>
            </span>
          </div>
          <blockquote class="postMessage">${escapeHtml(comment.text)}</blockquote>
        </div>
      `;
    }).join('');

    document.getElementById('statComments').textContent = data.comments.length;

  } catch (err) {
    console.error('Error loading comments:', err);
  }
}

// ===== REPLY FORM =====

document.getElementById('commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitReply();
});

async function submitReply() {
  const btn = document.getElementById('postBtn');
  const username = document.getElementById('username').value.trim() || 'Anonymous';
  const comment = document.getElementById('comment').value.trim();

  if (!comment) {
    showStatus('replyStatus', 'Please write a comment.', 'error');
    return;
  }

  btn.disabled = true;
  btn.value = 'Posting...';

  try {
    showStatus('replyStatus', 'Posting reply...', 'info');

    const res = await fetch(`/api/thread/${mint}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, text: comment })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Failed to post');

    clearStatus('replyStatus');
    document.getElementById('commentForm').reset();
    await loadComments();

  } catch (err) {
    console.error('Reply error:', err);
    showStatus('replyStatus', `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.value = 'Post';
  }
}

// ===== COPY MINT =====
window.copyMint = function () {
  const mint = document.getElementById('coinMint').textContent;
  navigator.clipboard.writeText(mint).then(() => {
    const el = document.getElementById('copyStatus');
    el.textContent = '✓ Copied!';
    setTimeout(() => { el.textContent = ''; }, 2000);
  });
};

// ===== REFRESH STATS =====
async function refreshStats() {
  try {
    const res = await fetch(`/api/coin/${mint}`);
    if (!res.ok) return;
    const coin = await res.json();
    document.getElementById('statMC').textContent = coin.marketCap ? `$${formatNum(coin.marketCap)}` : '—';
    document.getElementById('statVolume').textContent = coin.volume24h ? `$${formatNum(coin.volume24h)}` : '—';
    document.getElementById('statHolders').textContent = coin.holders || '0';
  } catch (e) { /* ignore */ }
}

// ===== WEBSOCKET REAL-TIME =====
if (typeof WsClient !== 'undefined') {
  WsClient.init(function (data) {
    if (data.mint !== mint) return;
    document.getElementById('statMC').textContent = data.marketCap ? '$' + formatNum(data.marketCap) : '—';
    document.getElementById('statVolume').textContent = data.volume24h ? '$' + formatNum(data.volume24h) : '—';
    document.getElementById('statHolders').textContent = data.holders || '0';
    addChartPoint(data.marketCap, data.candles);
  });
  WsClient.subscribe([mint]);
}

// Fallback polling
setInterval(refreshStats, 60000);
refreshStats();

// ===== HELPERS =====

function formatChanDate(date) {
  if (!date || isNaN(date.getTime())) return 'Just now';
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

function getDate(timestamp) {
  if (!timestamp) return new Date();
  if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  if (typeof timestamp === 'number') return new Date(timestamp * 1000);
  return new Date(timestamp);
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

function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  const div = document.createElement('div');
  div.className = `status-msg ${type}`;
  if (msg.includes('<a ') || msg.includes('<strong>')) div.innerHTML = msg;
  else div.textContent = msg;
  el.innerHTML = '';
  el.appendChild(div);
}

function clearStatus(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
}

// ===== INIT =====
loadThread();
