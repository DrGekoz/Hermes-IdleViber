# 🔥 Hermes IdleViber

> **The Ambient Gateway Idle Game — Hard-Locked to Hermes Agent**

---

## ⚡ Overview

Hermes IdleViber is a browser-based ambient idle/incremental game where your **Hermes Agent gateway literally powers your progression**. No gateway running? No vibes. The faster your gateway responds, the more you generate.

---

## 🏆 Feature List (Formidable)

### 🏡 Ambient Spaces (6 Unlockable Rooms)

| Room | Cost | Genre | Vibe |
|------|------|-------|------|
| **Campfire Grove** | Free (default) | Chill 🎵 | Warm crackling fire under stars |
| **Cyber Den** | 1M ✦ | Cyber 🎵 | Neon-lit digital hideout |
| **Zen Garden** | 5M ✦ | Nature 🎵 | Peaceful bamboo grove |
| **Star Deck** | 25M ✦ | Jazz 🎵 | Cosmic observatory |
| **Study Lounge** | 100M ✦ | Jazz 🎵 | Cozy bookshelves & lamplight |
| **Beach Cove** | 500M ✦ | Nature 🎵 | Sunset waves on pixel sand |

Each room has:
- Unique procedurally-generated 8-bit background
- Ambient particle effects (fireflies, matrix rain, cherry blossoms, aurora)
- Godrays & atmospheric lighting
- Matching music genre

### 🛠 Idle Game Mechanics

**12 Autoclicker Tiers:**
- Win95 PC → Quantum Core → Dyson Sphere
- Exponential cost scaling (1.15^count)
- VPS compounds with prestige & gateway multipliers

**Prestige System:**
- Reset for permanent Prestige Points (PP)
- Each PP = +1% to ALL generation
- Rooms and gateway upgrades survive prestige

**Gateway-Upgrades (10 unique):**
- Gateway Amp → Neural Bridge → Singularity Link
- Offline Cache → Standby Power (offline generation)
- Click Amplifier → Godlike Click (click multipliers)
- All survive prestige

### 🔌 Hermes Gateway Integration (Hard Lock)

| Feature | Detail |
|---------|--------|
| Auto-discovery | Scans localhost:8000, 8080, 3000, 7777, 5000, 9090 |
| Proof-of-progress | Game pings `/health` every 5 seconds |
| Latency tiers | Quantum (&lt;5ms) → Blazing → Fast → Stable → Slow |
| VPS lock | Without gateway: only 10% generation (or 50-100% with offline upgrades) |
| Visual feedback | Canvas border glows green when connected, red when offline |

**The game literally cannot idle without Hermes running on your machine.**

### ✨ Cosmetics & Decor (16 Items)

| Category | Items |
|----------|-------|
| **Lighting** | Pixel Lamp, Neon Strip, Candle Set |
| **Plants** | Potted Fern, Bonsai Tree, Cactus Buddy |
| **Furniture** | Wooden Desk, Bookshelf, Armchair, Side Table, Coffee Table |
| **Wall** | Retro Poster, World Map, Pixel Art Frame |
| **Floor** | Cozy Rug, Neon Mat |

All rendered as 8-bit pixel art sprites in the room viewport.

### 🎵 8-Bit Chiptune Music Engine

**4 Genres × Multiple Tracks (Web Audio API):**

| Genre | Tracks | Feel |
|-------|--------|------|
| **Chill** | Campfire Dreams, Starlight Nocturne | Lo-fi ambient |
| **Cyber** | Neon Pulse | Synthwave electronic |
| **Jazz** | Moonlit Swing | Smooth upbeat |
| **Nature** | Forest Breath | Peaceful organic |

- All generated via Web Audio API oscillators — zero audio files
- Genre auto-switches when you change rooms
- Volume control, next track button
- Square/triangle/sawtooth waveforms for authentic 8-bit sound

### 🎨 Pixel Art Engine (100% Programmatic)

Every visual in the game is generated at runtime via Canvas 2D API:

- **32+ sprite definitions** as character arrays
- **6 room backgrounds** procedurally drawn
- **Ambient effects**: godrays, fireflies, matrix rain, cherry blossoms, aurora, waves
- **8-bit color palette** with 40+ colors
- **Pixel-perfect rendering** with `image-rendering: pixelated`
- **Zero external image assets**

### 💾 Built-in Server API (No External Dependencies)

The game comes with a **self-hosted backend** running on the same port:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status + player count |
| `/api/register` | POST | Create account (username + password) |
| `/api/login` | POST | Login, returns auth token |
| `/api/save` | POST | Upload cloud save (requires token) |
| `/api/load` | GET | Download cloud save (requires token) |
| `/api/leaderboard` | GET | Global leaderboard (top 50) |
| `/api/leaderboard/submit` | POST | Submit score to leaderboard (requires token) |

**Auth**: Token-based (7-day expiry). Tokens are stored in your browser's localStorage.
**Storage**: `server/data.json` — all player data in a single JSON file.
**Zero setup**: Just start the server and play. Accounts + leaderboard work immediately.

No Supabase, no Firebase, no external signups. True offline-first with optional cloud sync.

### 🎮 Game Loop

1. **Manual Clicking** — Click "✦ VIBE ✦" for instant vibes (scales with upgrades)
2. **Gateway Verification** — Every 5s, game pings your local Hermes gateway
3. **Passive Generation** — Autoclickers produce VPS (gateway-connected = full rate)
4. **Upgrade Cycle** — Buy autoclickers → earn more → buy gateway upgrades → prestige
5. **Prestige** — Reset for permanent bonuses, unlock new rooms, deeper progression
6. **Ambient Loop** — Rooms, music, particle effects create the "hang out" experience

### 📊 Leaderboard

Local leaderboard with mock data (DrGekoz, Zoops, CipherZero, PixelWarden).
Auto-pipes to the server leaderboard when connected with an account.

---

## 🚀 Quick Start

### Option 1: Direct File (easiest)
```bash
cd F:\aaaaaVIBECODING\Hermes-IdleViber\
start index.html
```

### Option 2: Via HTTP Server (recommended — full gateway support)
```bash
cd F:\aaaaaVIBECODING\Hermes-IdleViber\
node server/index.js
# Open http://localhost:4444
```

### Option 3: Python
```bash
cd F:\aaaaaVIBECODING\Hermes-IdleViber\
python -m http.server 4444
# Open http://localhost:4444
```

### Requirements
- **Hermes Agent** running locally (for full game mechanics)
- **Modern browser** (Chrome/Firefox/Edge — ES module support)
- The game auto-detects your gateway on startup

---

## 🧠 Architecture

```
Hermes-IdleViber/
├── index.html              # Entry point — full game UI
├── css/
│   └── styles.css          # Pixel-perfect retro styling
├── js/
│   ├── state.js            # Game state, formulas, upgrade defs, save/load
│   ├── gateway.js          # Hermes gateway discovery & health polling
│   ├── sprites.js          # 32+ pixel art sprite definitions & room renderer
│   ├── music.js            # Web Audio API chiptune engine (12 tracks)
│   └── app.js              # Main loop, UI binding, event wiring
├── server/
│   ├── index.js            # Simple HTTP server with CORS
│   └── package.json
└── README.md
```

### Data Flow
```
Browser ←→ localStorage (save/load)
     ↕
Gateway Ping → localhost:PORT/health → Latency → VPS Multiplier
     ↕
Game Loop (10Hz) → State Engine → UI Update → Canvas Render → Audio
```

---

## 🔜 Roadmap

- [ ] Real-time leaderboard updates via WebSocket
- [ ] Password reset via email
- [ ] Rank badges and achievements sync
- [ ] Global chat in rooms
- [ ] Direct player profile pages

---

## 💡 Design Philosophy

- **Hermes-Locked Idle**: The gateway isn't a bonus — it's the core mechanic
- **Ambient First**: The primary experience is hanging out in a beautiful pixel space
- **Deep Progression**: 12 autoclicker tiers × 10 gateway upgrades × endless prestige × 6 rooms × 16 decor items
- **Zero External Assets**: Everything is code-generated — sprites, music, effects
- **Retro Authentic**: Press Start 2P font, 8-bit pixel art, chiptune audio, CRT-era color palette

---

> Built with 🔥 for the Hermes Agent ecosystem
> *"Your gateway. Your vibe. Your dimension."*
