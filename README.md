# 🔥 Hermes IdleViber

<p align="center">
  <i>~ The Ambient Gateway Idle Game ~</i><br>
  <b>Your Hermes gateway boosts your progression as an upgradeable multiplier.</b>
</p>

---

## ✦ What Is This?

Hermes IdleViber is an **ambient idle/incremental game** that lives in your browser — a cozy pixel-art universe where you click, earn, upgrade, and unlock themed rooms while chiptune music plays and particle effects drift across the screen.

**The twist?** The game pings your local Hermes Agent gateway and turns its latency into a VPS multiplier. The faster your gateway responds, the bigger the bonus. It turns your dev tools into a game mechanic — an upgradeable boost you can invest prestige chips into.

---

## ✦ Genre & Vibe

| | |
|---|---|
|| **Genre** | Ambient idle / incremental ("cozy incremental") |
|| **Platform** | Browser (Chrome, Firefox, Edge) |
|| **Art** | 16-bit pixel art — 92 custom upgrade icons + procedural room rendering |
|| **Music** | 8-bit chiptune via Web Audio API — 12 tracks across 4 genres |
|| **Progression** | Exponential cost scaling + prestige layer + per-room upgrades + 250 tiers |
|| **Number System** | k → Z → **InfinityZ ×N** → InfinityZ × InfinityZ (N) — never caps |
|| **Lock** | 🔒 Hermes gateway bonus — upgradeable multiplier boost |

---

## ✦ How It Works

### 1. Click ✦ VIBE ✦
Hit the big glowing button. Each click earns vibes (the game's currency). Click power scales with upgrades.

### 2. Buy Autoclickers
Each room has **13 unique upgrade tiers**, from a simple Spark Tinder to the transcendent Forest Spirit. Every upgrade adds passive VPS (Vibes Per Second). Costs scale exponentially (1.15× per purchase).

**⚡ Buy All** button on every upgrade tab — sorts by most expensive first and spends every last vibe.

**🖱 Hold-to-spam** — hold down on any upgrade to rapid-buy (works on autoclickers AND prestige upgrades).

### 3. Unlock Rooms
6 themed rooms, each with its own music, background, particle effects, and **completely independent upgrade progression**:

| Room | Cost | Vibe |
|------|------|------|
| 🏕 **Campfire Grove** | Free | Warm fire under starry skies |
| 💻 **Cyber Den** | 100M ✦ | Neon-lit digital hideout |
| 🧘 **Zen Garden** | 1B ✦ | Bamboo, koi, and flowing water |
| 🔭 **Star Deck** | 25B ✦ | Floating among galaxies |
| 📚 **Study Lounge** | 1T ✦ | Cozy bookshelves & lamplight |
| 🏖 **Beach Cove** | 10T ✦ | Sunset waves on pixel sand |

Each room's autoclickers track their own purchase count — buying cheap upgrades in a new room doesn't reset your expensive ones from other rooms. All room VPS stacks together globally.

### 4. Decor Every Room
15 decor items per room (90 total across all rooms). Each adds a permanent VPS multiplier to that room. Decor items are placed visually on the canvas — drag, drop, rearrange. **Buy All** is also available on the decor tab.

### 5. Prestige & Tiers
Reset your run for **Prestige Chips (PP)** — permanent currency that buys escalating upgrades:
- Gateway buffs (+× to gateway multiplier)
- Click multipliers (×2 → ×4 → ×10)
- Base VPS bonuses (+100 → +1K → +10K)
- Permanent ×2 VPS (stacks multiplicatively)
- Offline earnings rate boosts

All prestige upgrades are **re-buyable** with progressive cost scaling. Use the **Buy All** button or hold-to-spam to burn through chips fast.

Every prestige grants a **Tier** (Bronze I → Silver I → ... up to Ten Quad 10Q), unlocking a corresponding achievement. 250 tiers total, with tiers scaling in cost via a dynamic prestige threshold that adapts to your VPS.

### 6. Gateway Bonus
The game pings your Hermes gateway every 5 seconds. Your latency determines your VPS multiplier — lower latency = higher bonus. No gateway running? You still earn at base rates. Gateway buffs can also be upgraded with prestige chips for an even bigger boost.

### 7. InfinityZ Number System
When your vibes exceed Z (the 47th suffix tier), the number system cycles through infinite layers:

| Layer | Format | Example |
|-------|--------|---------|
| Normal | `{value}{suffix}` | `1.23k`, `4.56M` ... `7.89Z` |
| InfinityZ ×N | `×{count}[{suffix}]` | `×1`, `×1k`, `×1M` ... `×1Z`, `×2` ... |
| InfinityZ² | `× InfinityZ ({count}[suffix])` | `(1)`, `(1k)`, ... `(1Z)`, `(2)` ... |

Each count cycles 57 times (base + all suffixes). When a count wraps, the next layer takes over. The game literally never runs out of notation.

---

## ✦ Features

### 🎮 Gameplay
- 6 rooms × 13 unique autoclickers = **78 distinct upgrades**, each with its own pixel art icon
- Per-room cost progression (buy cheap in new rooms!)
- **⚡ Buy All** buttons on upgrades, decor, and prestige tabs (most expensive first)
- **🖱 Hold-to-spam** rapid-purchase on all shop items (autoclickers + prestige)
- **🔔 Real-time sidebar tab indicators** — gold dots pulse on tabs with affordable items, green dot when prestige is ready, cyan dot for new achievements
- 90 decor items with visual canvas placement (click-and-drag)
- **InfinityZ number system** — numbers never cap, display scales infinitely
- Bulk buy with calculated max-buyable
- Affordability updates every tick — no tab-hopping required

### 🎨 Visual
- 92 custom pixel art upgrade icons generated via Codex CLI (16-bit retro style)
- 6 unique room backgrounds with atmospheric effects
- Particle systems: fireflies, matrix rain, cherry blossoms, aurora, smoke, dust, waves
- Godrays & dynamic lighting
- Pixel-perfect rendering with `image-rendering: pixelated`
- Custom chroma-key removal pipeline for transparent icon assets

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
- **Firebase Firestore realtime leaderboard** — tier names, InfZ values, full BN array accuracy
- Local API server mode for self-hosted accounts
- Offline earnings calculated on return (10x format above 1000%)

### 🏆 Achievements
- 55 base achievements across vibe, click, prestige, room, VPS, gateway, decor, and autoclicker milestones
- **250 tier achievements** — programmatically generated from Bronze I to Ten Quad (10Q) — one per prestige tier
- Real-time achievement notifications with toast popups
- Permanent unlock tracking

### 🏅 Leaderboard
- Firestore-backed realtime leaderboard with live tier column (Bronze, Silver, Gold, etc.)
- Dev badge tooltip on hover for contributors
- Stores full BN (BigNumber) arrays for accurate InfinityZ layer display
- Clear polling on subscription — no double reads, respects Firestore quota

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

**Bonus:** Hermes Agent running locally gives you a latency-based VPS multiplier. No gateway? The game still works fine at base rates.

---

## ✦ Recent Updates

- **Realtime Firestore Leaderboard** — live tier column (Bronze→Silver→Gold→...), BN-accurate InfZ values, dev badge tooltips, auto-stream with polling cleanup to stay under quota
- **Prestige Overhaul** — Max Prestige uses a math formula, runs instantly with zero UI freeze; prestige threshold now scales dynamically with VPS (log₂ factor), stops at 1hr cap; gentler sqrt-log formula for early-game pacing
- **Tier Achievements** — 250 programmatic tier achievements, one per prestige tier (Bronze I → Ten Quad 10Q), generated on the fly
- **Gateway HUD Redesign** — VPS multiplier on line 1, latency + prestige breakdown on line 2
- **Offline Stats Enhancement** — offline rate switches to 10x format above 1000%
- **InfinityZ number system** — numbers beyond Z display as `InfinityZ ×1`, `×1k`, `×1M` ... cycling through all suffixes infinitely
- **Buy All buttons** — ⚡ Buy All on upgrades, decor, and prestige tabs (buys most expensive first, spends everything)
- **Hold-to-spam** — works for both autoclicker upgrades AND prestige upgrades
- **Real-time tab indicators** — sidebar tabs show gold/green/cyan dots when items are affordable or ready
- **78 pixel art upgrade icons** — each room's 13 upgrades have custom Codex CLI-generated pixel art
- **Per-room cost progression** — costs track the current room's purchase count, not global
- **Prestige cost fixes** — progressive cost scaling for all re-buyable prestige upgrades

---

## ✦ Architecture

```
Hermes-IdleViber/
├── index.html                  # Entry point — single-page game UI
├── css/styles.css              # Dark retro pixel styling
├── js/
│   ├── state.js                # Game state engine, formulas, definitions, save/load
│   ├── gateway.js              # Hermes gateway discovery & health polling
│   ├── sprites.js              # Pixel art sprite definitions & room renderer
│   ├── music.js                # Web Audio API chiptune engine
│   └── app.js                  # Main loop, UI binding, event wiring
├── server/                     # Optional self-hosted backend
│   ├── index.js                # HTTP server with CORS
│   └── package.json
└── sprites/images/
    └── icons/individual/       # 92 pixel art upgrade icons (64×64 webp)
```

---

## ✦ Design Principles

- **Ambient First** — The primary experience is hanging out in a beautiful pixel space, not optimizing spreadsheets
- **Gateway as Bonus** — Your Hermes gateway isn't the core loop, it's a tasty VPS multiplier on top. Play without it just fine, but if you've got a snappy gateway you'll climb faster. Prestige chips let you crank that multiplier even higher.
- **Per-Room Identity** — Every room is a distinct gameplay silo with its own progression, music, and art
- **Zero External Assets** — Every sprite, every sound, every particle is generated at runtime
- **Progressive Complexity** — Easy to start (click the button), deep to master (prestige × tiers × 6 rooms × 90 decor × InfinityZ numbers)

---

## ✦ Credits

Built for the **Hermes Agent** ecosystem by DrGekoz.

> *"Your gateway. Your vibe. Your dimension."*

---

## Star History

<a href="https://www.star-history.com/?repos=DrGekoz%2FHermes-IdleViber&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DrGekoz/Hermes-IdleViber&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DrGekoz/Hermes-IdleViber&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DrGekoz/Hermes-IdleViber&type=date&legend=top-left" />
 </picture>
</a>
