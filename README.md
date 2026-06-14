# 🔥 Hermes IdleViber

<p align="center">
  <i>~ The Ambient Gateway Idle Game ~</i><br>
  <b>Your Hermes gateway doesn't boost your progression — it IS your progression.</b>
</p>

---

## ✦ What Is This?

Hermes IdleViber is an **ambient idle/incremental game** that lives in your browser — a cozy pixel-art universe where you click, earn, upgrade, and unlock themed rooms while chiptune music plays and particle effects drift across the screen.

**The twist?** The game is hard-locked to your local Hermes Agent gateway. No gateway running? You generate at a crawl. Low latency? You're farming at full power. The faster your gateway responds, the faster you progress. It turns your dev tools into a game mechanic.

---

## ✦ Genre & Vibe

| | |
|---|---|
| **Genre** | Ambient idle / incremental ("cozy incremental") |
| **Platform** | Browser (Chrome, Firefox, Edge) |
| **Art** | 16-bit pixel art — all code-generated, zero external assets |
| **Music** | 8-bit chiptune via Web Audio API — 12 tracks across 4 genres |
| **Progression** | Exponential cost scaling + prestige layer + per-room upgrades |
| **Lock** | 🔒 Hermes gateway-dependent — the core mechanic, not a bonus |

Think **Cookie Clicker meets a chill lo-fi直播间** — except your gateway latency is the meta-currency.

---

## ✦ How It Works

### 1. Click ✦ VIBE ✦
Hit the big glowing button. Each click earns vibes (the game's currency). Click power scales with upgrades.

### 2. Buy Autoclickers
Each room has **13 unique upgrade tiers**, from a simple Spark Tinder to the transcendent Forest Spirit. Every upgrade adds passive VPS (Vibes Per Second). Costs scale exponentially (1.15× per purchase).

### 3. Unlock Rooms
6 themed rooms, each with its own music, background, particle effects, and independent upgrade progression:

| Room | Cost | Vibe |
|------|------|------|
| 🏕 **Campfire Grove** | Free | Warm fire under starry skies |
| 💻 **Cyber Den** | 100M ✦ | Neon-lit digital hideout |
| 🧘 **Zen Garden** | 1B ✦ | Bamboo, koi, and flowing water |
| 🔭 **Star Deck** | 25B ✦ | Floating among galaxies |
| 📚 **Study Lounge** | 1T ✦ | Cozy bookshelves & lamplight |
| 🏖 **Beach Cove** | 10T ✦ | Sunset waves on pixel sand |

Each room's autoclickers are **completely independent** — buying upgrades in one room doesn't affect costs in another AND all room VPS stacks together. More rooms = exponentially more income.

### 4. Decor Every Room
15 decor items per room (90 total). Each adds a permanent VPS multiplier to that room. Place them visually on the canvas — drag, drop, rearrange.

### 5. Prestige & Transcend
Reset your run for **Prestige Chips (PP)** — permanent currency that buys escalating upgrades:
- Gateway buffs (+× to gateway multiplier)
- Click multipliers (×2 → ×4 → ×10)
- Base VPS bonuses (+100 → +1K → +10K)
- Permanent ×2 VPS (stacks)
- Offline earnings rate boosts

After 3+ prestiges, unlock the **Transcend** layer for even deeper scaling.

### 6. The Gateway Lock
The game pings your Hermes gateway every 5 seconds. Your latency determines your generation rate — lower latency = higher multiplier. If the gateway is down, you're stuck at 10% output (or higher if you've bought offline upgrades).

---

## ✦ Features

### 🎮 Gameplay
- 6 rooms × 13 unique autoclickers = **78 distinct upgrades**
- Per-room cost progression (buy cheap in new rooms!)
- Hold-to-spam purchase on upgrades & prestige
- Bulk buy with calculated max-buyable
- 91 pixel art icons — each upgrade has a custom sprite
- Real-time sidebar tab indicators (gold dots = affordable!)
- 90 decor items with visual placement system
- Click-and-drag decor on canvas

### 🎨 Visual
- Full procedural pixel art engine (Canvas 2D)
- 6 unique room backgrounds with atmospheric effects
- Particle systems: fireflies, matrix rain, cherry blossoms, aurora, smoke, dust, waves
- Godrays & dynamic lighting
- pixel-perfect rendering with `image-rendering: pixelated`

### 🎵 Audio
- Chiptune engine via Web Audio API — zero audio files
- 4 genres: Chill, Cyber, Jazz, Nature — 12 tracks total
- Room-based music auto-switching
- Adjustable SFX & music volume

### 🔌 Integration
- Auto-discovers Hermes gateway on 6 port ranges
- Real-time latency display with quality tiers
- Gateway VPS multiplier updates live
- Task-in-progress detection (doubles multiplier when gateway is busy)

### 💾 Persistence
- Auto-save every 30s to localStorage
- Firebase cloud save & leaderboard (optional)
- Local API server mode for self-hosted accounts
- Offline earnings calculated on return

### 🏆 Achievements
- 45 achievements across vibe, click, prestige, room, VPS, gateway, decor, and autoclicker milestones
- Real-time achievement notifications
- Permanent unlock tracking

---

## ✦ Quick Start

```bash
# Option 1: Direct (no server needed)
cd F:\aaaaaVIBECODING\Hermes-IdleViber\
start index.html

# Option 2: With HTTP server (recommended)
cd F:\aaaaaVIBECODING\Hermes-IdleViber\
node server/index.js
# Open http://localhost:4444

# Option 3: Netlify (always live)
# https://hermes-idleviber.netlify.app
```

**Requirement:** Hermes Agent running locally (or the game works at reduced rates).

---

## ✦ Architecture

```
Hermes-IdleViber/
├── index.html            # Entry point — single-page game UI
├── css/styles.css        # Dark retro pixel styling
├── js/
│   ├── state.js          # Game state engine, formulas, definitions, save/load
│   ├── gateway.js        # Hermes gateway discovery & health polling
│   ├── sprites.js        # Pixel art sprite definitions & room renderer
│   ├── music.js          # Web Audio API chiptune engine
│   └── app.js            # Main loop, UI binding, event wiring
├── server/               # Optional self-hosted backend
│   ├── index.js          # HTTP server with CORS
│   └── package.json
└── sprites/images/       # Pixel art icon assets (92 upgrade icons)
```

---

## ✦ Design Principles

- **Ambient First** — The primary experience is hanging out in a beautiful pixel space, not optimizing spreadsheets
- **Gateway as Mechanic** — The gateway isn't a bonus, it's the core loop. Your dev environment drives your game
- **Per-Room Identity** — Every room is a distinct gameplay silo with its own progression, music, and art
- **Zero External Assets** — Every sprite, every sound, every particle is generated at runtime
- **Progressive Complexity** — Easy to start (click the button), deep to master (prestige × transcend × 6 rooms × 90 decor)

---

## ✦ Credits

Built for the **Hermes Agent** ecosystem by DrGekoz.

> *"Your gateway. Your vibe. Your dimension."*
