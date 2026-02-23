# 4chan Launchpad - Project Guide

## Overview

A 4chan (Yotsuba theme) replica memecoin launchpad for Solana. Users launch real tokens on pump.fun, which creates a 4chan-style "thread" for discussion. The visual design exactly replicates boards.4chan.org using the classic Yotsuba color scheme.

## Tech Stack

- **Backend**: Node.js + Express (identical to bitcointalk project)
- **Frontend**: Vanilla HTML/CSS/JS — no frameworks
- **Blockchain**: Solana Web3.js + pump.fun API
- **Database**: Firebase Firestore
- **Wallet**: Phantom

## Project Structure

```
4chan-launchpad/
├── src/
│   ├── server.js          # Express backend (adapted from bitcointalk)
│   ├── firebase.js        # Firebase integration (identical to bitcointalk)
│   ├── websocket.js       # WebSocket real-time updates (identical)
│   ├── fee-claimer.js     # Platform fee collection (identical)
│   └── public/
│       ├── index.html     # Launch form (4chan new thread style)
│       ├── threads.html   # Board index (all launched coins as threads)
│       ├── thread.html    # Individual thread (coin + replies)
│       ├── favicon.png
│       ├── css/
│       │   └── yotsuba.css  # Exact 4chan Yotsuba color scheme
│       └── js/
│           ├── launch.js    # Token launch form handler
│           ├── threads.js   # Board index with sorting/search
│           ├── thread.js    # Thread view + chart + comments
│           ├── wallet.js    # Phantom wallet connection
│           └── ws-client.js # WebSocket client
├── .env.example
├── package.json
└── CLAUDE.md
```

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | index.html | Token launch form (4chan "new thread" style) |
| `/threads` | threads.html | Board index — all launched tokens as thread blocks |
| `/thread/:mint` | thread.html | Full 4chan thread — OP = coin info, replies = comments |

## 4chan Visual Design (Yotsuba Theme)

| Element | Color |
|---|---|
| Body background | `#FFFFEE` |
| Body text | `#800000` (maroon) |
| Links | `#0000EE` |
| Link hover | `#DD0000` |
| Reply post background | `#F0E0D6` |
| Reply post border | `#D9BFB7` |
| Form header (th) | `#EEAA88` |
| Subject text | `#DD0000` |
| Username (name) | `#117743` (green) |
| Greentext | `#789922` |
| Boardlist text | `#BB8866` |
| Boardlist links | `#880000` |

## Token Launch Flow

Identical to bitcointalk project:
1. `POST /api/launch/prepare` — Upload image to IPFS, generate keypairs
2. `POST /api/launch/create` — Build SOL transfer transaction
3. User signs with Phantom
4. `POST /api/launch/confirm` — Verify payment, deploy on pump.fun, create Firebase thread

## Customization

- **Board name**: Change `/biz/ - Business & Finance` in all 3 HTML files
- **Board subtitle**: Change `Not your keys, not your coins` in all 3 HTML files
- **Domain**: Update `YOUR_DOMAIN.com` in `src/server.js` (ALLOWED_ORIGINS + website URL)
- **Platform wallet**: Update `PLATFORM_WALLET` in `src/server.js` or set env var
- **Fee**: Update `TOTAL_LAUNCH_COST` in `src/server.js`

## Environment Variables

```env
RPC_URL=https://api.mainnet-beta.solana.com
PORT=3000
PLATFORM_WALLET=your-wallet-address
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
ADMIN_SECRET=your-admin-secret
MOCK_MODE=false
```

## Running

```bash
npm install
npm run dev    # development (auto-reload)
npm start      # production
```

Server runs on `http://localhost:3000`

## Key Differences from Bitcointalk Version

| Feature | Bitcointalk | 4chan Launchpad |
|---|---|---|
| CSS theme | SMF forum (blue/gray) | 4chan Yotsuba (beige/maroon) |
| Homepage | Launch form + coin listing | Launch form ONLY |
| Coin listing | Same page as form | Separate `/threads` page |
| Post dates | locale string | 4chan format `MM/DD/YY(Day)HH:MM:SS` |
| Reply structure | SMF post tables | 4chan `div.post.reply` blocks |
| Post numbers | Sequential # | Shortened mint address |
| Chart colors | Blue (#476C8E) | Maroon (#800000) |
| Candle colors | Blue/red | Green (#789922) / Red (#DD0000) |
