// 4chan-style token launch form handler

document.getElementById('launchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await handleLaunch();
});

async function handleLaunch() {
  const btn = document.getElementById('launchBtn');
  const originalValue = btn.value;
  btn.disabled = true;

  try {
    // Connect wallet
    showStatus('statusMsg', 'Connecting to Phantom wallet...', 'info');
    const wallet = await connectWallet();
    showStatus('statusMsg', `Connected: ${wallet.slice(0, 4)}...${wallet.slice(-4)}`, 'success');
    await sleep(800);

    // Collect form data
    const name = document.getElementById('name').value.trim();
    const symbol = document.getElementById('symbol').value.trim().toUpperCase();
    const description = document.getElementById('description').value.trim();
    const twitter = document.getElementById('twitter').value.trim();
    const devBuy = parseFloat(document.getElementById('devBuy').value) || 0;
    const creatorUsername = document.getElementById('creatorUsername').value.trim();
    const board = document.getElementById('board').value;
    const imageFile = document.getElementById('image').files[0];

    if (!name || !symbol || !creatorUsername || !imageFile) {
      throw new Error('Please fill in all required fields');
    }

    // Convert image to base64
    showStatus('statusMsg', 'Uploading image to IPFS...', 'info');
    const imageBase64 = await fileToBase64(imageFile);

    // Step 1: Prepare (upload to IPFS, generate keypairs)
    showStatus('statusMsg', 'Preparing token metadata...', 'info');
    const prepareRes = await fetch('/api/launch/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, name, symbol, description, image: imageBase64, creatorUsername, twitter, devBuy, board })
    });
    const prepareData = await prepareRes.json();
    if (!prepareData.success) throw new Error(prepareData.error);

    // Step 2: Create funding transaction
    const totalCost = prepareData.totalCost || 0.05;
    showStatus('statusMsg', 'Building transaction...', 'info');
    const createRes = await fetch('/api/launch/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, tokenMint: prepareData.tokenMint })
    });
    const createData = await createRes.json();
    if (!createData.success) throw new Error(createData.error);

    // Step 3: Sign with Phantom
    showStatus('statusMsg', `Approve ${totalCost} SOL transaction in Phantom...`, 'info');
    btn.value = 'Waiting for wallet...';
    const signature = await signTransaction(createData.transactionData);
    showStatus('statusMsg', 'Transaction confirmed!', 'success');
    await sleep(800);

    // Step 4: Confirm and deploy
    showStatus('statusMsg', 'Deploying token on pump.fun... (~15 seconds)', 'info');
    btn.value = 'Deploying...';
    const confirmRes = await fetch('/api/launch/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenMint: prepareData.tokenMint, signature })
    });
    const confirmData = await confirmRes.json();
    if (!confirmData.success) throw new Error(confirmData.error);

    // Success
    showStatus('statusMsg',
      `<strong>Token launched!</strong> &gt;&gt; <a href="${confirmData.threadUrl}" style="color:#0000EE; font-weight:bold;">View Thread &rarr;</a>`,
      'success'
    );
    document.getElementById('launchForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    setTimeout(() => { window.location.href = confirmData.threadUrl; }, 2500);

  } catch (err) {
    console.error('Launch error:', err);
    showStatus('statusMsg', `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.value = originalValue;
  }
}

// Helpers
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== POPULAR THREADS + BOARD COUNTS =====
(async function loadPopularThreads() {
  const grid = document.getElementById('popularGrid');
  if (!grid) return;
  try {
    const res = await fetch('/api/threads');
    const data = await res.json();

    // Board counts + sort by most recent launch
    if (data.success && data.threads) {
      const counts = {};
      const latest = {};
      data.threads.forEach(t => {
        const b = t.board || 'random';
        counts[b] = (counts[b] || 0) + 1;
        const ts = t.createdAt?._seconds || t.createdAt || 0;
        if (!latest[b] || ts > latest[b]) latest[b] = ts;
      });

      const ALL_BOARDS = ['sol','meme','degen','moon','ai','pol','tek','animal','trump','elon','random'];
      ALL_BOARDS.sort((a, b) => (latest[b] || 0) - (latest[a] || 0));

      const boardsGrid = document.getElementById('boardsGrid');
      if (boardsGrid) {
        boardsGrid.innerHTML = ALL_BOARDS.map(board =>
          `<a href="/threads?board=${board}">/${board}/ <span>(${counts[board] || 0})</span></a>`
        ).join('');
      }
    }
    if (!data.success || !data.threads || data.threads.length === 0) {
      grid.innerHTML = '<span style="color:#888; font-size:11px;">&gt; No tokens launched yet.</span>';
      return;
    }

    const BOARDS = {
      sol: '/sol/', meme: '/meme/', degen: '/degen/', moon: '/moon/',
      ai: '/ai/', pol: '/pol/', tek: '/tek/', animal: '/animal/',
      trump: '/trump/', elon: '/elon/', random: '/random/'
    };

    const threads = data.threads.slice(0, 6);

    // Fetch market data for top 6 in parallel
    const marketResults = await Promise.allSettled(
      threads.map(t => fetch(`/api/coin/${t.mint}`).then(r => r.json()))
    );
    const marketData = marketResults.map(r => r.status === 'fulfilled' && r.value.success ? r.value : null);

    grid.innerHTML = threads.map((t, i) => {
      let imageUrl = t.image || '';
      const hasImage = imageUrl && !imageUrl.startsWith('mock://');
      const boardLabel = t.board && BOARDS[t.board] ? BOARDS[t.board] : '/random/';
      const name = escapeHtmlInline(t.name || '');
      const symbol = escapeHtmlInline(t.symbol || '');
      const replies = t.commentCount || 0;
      const md = marketData[i];
      const mcStr = md && md.marketCap ? 'MC: ' + formatCompact(md.marketCap) : '';
      const volStr = md && md.volume24h ? 'Vol: ' + formatCompact(md.volume24h) : '';
      const statsStr = [mcStr, volStr].filter(Boolean).join(' &nbsp;|&nbsp; ');

      return `
        <a class="popular-card" href="/thread/${t.mint}">
          <span class="popular-card-board">${boardLabel}</span>
          ${hasImage
            ? `<img src="${escapeHtmlInline(imageUrl)}" alt="${name}" onerror="this.parentElement.querySelector('.popular-card-board').insertAdjacentHTML('afterend','<div class=\\'popular-card-no-img\\'>${symbol}</div>'); this.remove();">`
            : `<div class="popular-card-no-img">${symbol}</div>`
          }
          <span class="popular-card-title">${name} (${symbol})</span>
          ${statsStr ? `<span class="popular-card-stats">${statsStr}</span>` : ''}
          <span class="popular-card-sub">${replies} ${replies === 1 ? 'reply' : 'replies'}</span>
        </a>`;
    }).join('');
  } catch (e) {
    console.error('Error loading popular threads:', e);
  }
})();

function formatCompact(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function escapeHtmlInline(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// Update button cost when dev buy changes
document.getElementById('devBuy').addEventListener('input', function () {
  const devBuy = parseFloat(this.value) || 0;
  const total = (0.05 + devBuy).toFixed(2);
  document.getElementById('launchBtn').value = `Launch Token (${total} SOL)`;
});

// Image preview
document.getElementById('image').addEventListener('change', function () {
  const file = this.files[0];
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('imagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('imagePreview').style.display = 'none';
  }
});
