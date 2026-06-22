# 🔥 Hermes IdleViber

<p align="center">
  <i>~ The Ambient Gateway Idle Game ~</i><br>
  <b>Your Hermes gateway boosts your progression as an upgradeable multiplier.</b>
</p>

---

## ✦ What Is This?

Hermes IdleViber is an **ambient idle/incremental game** that lives in your browser — a cozy pixel-art universe where you click, earn, upgrade, and unlock themed rooms while chiptune music plays and particle effects drift across the screen.

**The twist?** The game pings your local Hermes Agent gateway and turns its latency into a VPS multiplier. The faster your gateway responds, the bigger the bonus. It turns your dev tools into a game mechanic — an upgradeable boost you can invest prestige chips into.

**Sign in** with Google, GitHub, or email/password — your progress follows you across devices via Firestore cloud saves with smart merge (keeps your highest stats). Auto-registers on login when an account doesn't exist. Display name availability checked via Firebase + P2P before accepting.

**Or just jump in** as a guest — no sign-up needed. Guest progress merges automatically when you create an account later. Firebase anonymous sign-in for leaderboard visibility.

---

## ✦ Screenshots

<p align="center">
  <img src="screenshots/New%20Login%20Page%20Design.png" alt="Login Screen" width="45%">
  <img src="screenshots/Leaderboard%20can%20be%20'minimized'.png" alt="Leaderboard" width="45%">
</p>

<p align="center">
  <img src="screenshots/Campfire%20Grove.png" alt="Campfire Grove" width="30%">
  <img src="screenshots/Cyber%20Den.png" alt="Cyber Den" width="30%">
  <img src="screenshots/Zen%20Garden.png" alt="Zen Garden" width="30%">
</p>

<p align="center">
  <img src="screenshots/Star%20Deck.png" alt="Star Deck" width="30%">
  <img src="screenshots/Study%20Lounge.png" alt="Study Lounge" width="30%">
  <img src="screenshots/Beach%20Cove.png" alt="Beach Cove" width="30%">
</p>

---

## ✦ How It Works

### 1. Click ✦ VIBE ✦
Hit the big glowing button. Each click earns vibes (the game's currency). Click power scales with upgrades.

### 2. Buy Autoclickers
Each room has **15 unique upgrade tiers**, themed to that room. Every upgrade adds passive VPS (Vibes Per Second). Costs scale exponentially (1.15× per purchase).

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

Each room's autoclickers track their own purchase count. Room affordability updates every tick — cards unlock visually in real-time without tab-hopping.

**Building Synergies** — autoclickers boost other autoclickers when owned (Retro Boost, Legacy Bridge, RGB Overdrive, Cluster Link, Quantum Link).

### 4. Decor Every Room
15 decor items per room (90 total). Each adds a permanent VPS multiplier. Items render at 40% size (102×102) on the canvas. **Single instance per decor** — clicking an active decor removes all instances; clicking EQUIP restores them at saved positions. **Click-to-front** brings any decor above others. **Drag** uses instant cursor follow (no lerp lag). **Positions survive prestige** via saved_decor_placements. **Buy All places decor at saved positions.**

### 5. Prestige & Tiers
Reset your run for **Prestige Chips (PP)** — permanent currency that buys escalating upgrades:
- Gateway buffs, click multipliers, base VPS bonuses
- Permanent ×2 VPS (stacks multiplicatively)
- Offline earnings rate boosts

**Prestige threshold grows exponentially** — `1T × 2.5ⁿ` where n = prestige count + 1. Each prestige is materially harder than the last.

**⚡ Max Prestige** runs non-blocking batches via requestAnimationFrame. VPS-gated: only allows prestige cycles where `VPS × 5s ≥ next threshold`, preventing infinite chain-prestiging.

Every prestige grants a **Tier** (Bronze I → Silver I → ... → Formless Expanse), unlocking a corresponding achievement. **500 uniquely-scaling tiers** with requirements going from 1 prestige up to InfZ^∞. Tiers grant progressively stronger permanent bonuses.

**Tier Grid in Settings** — the tier icon picker rebuilds every time you open settings, reading live game state. Unlocked tiers show gold + checkmark + full-color icon. Locked tiers show gray + grayscale. Tooltip shows 'UNLOCKED' (green) or 'REQUIRES N prestiges' (gray).

**Tier names match displayed icons** — the leaderboard checks if a custom tier icon is set and shows the matching tier name, falling back to prestige-based tier.

### 6. Gateway Bonus
The game pings your Hermes gateway every 5 seconds. Your latency determines your VPS multiplier — lower latency = higher bonus. Gateway buffs can be upgraded with prestige chips. Manual port override in both Gateway tab and Settings. Task-in-progress detection doubles the multiplier when gateway is busy.

### 7. InfinityZ Number System
When your vibes exceed Z (the last suffix tier), the number system cycles through infinite layers of InfZ^n notation:

| Layer | Format | Example |
|-------|--------|---------|
| Normal | `{value}{suffix}` | `1.23k`, `4.56M` ... `7.89Z` |
| InfZ^1 | `InfZ ×N[suffix]` | `InfZ ×1`, `InfZ ×1k` ... `InfZ ×1Z`, `InfZ ×2` |
| InfZ² | `InfZ² (N[suffix])` | `InfZ² (1)`, `InfZ² (1k)` ... `InfZ² (1Z)`, `InfZ² (2)` |
| InfZ³ | `InfZ³ [N[suffix]]` | `InfZ³ [1]`, `InfZ³ [1k]` ... `InfZ³ [2]` |
| InfZ⁴ | `InfZ⁴ {N[suffix]}` | `InfZ⁴ {1}`, `InfZ⁴ {1k}` ... |
| ⋮ | ⋮ | ⋮ |
| InfZ^∞ | `InfZ^∞` | Final sentinel for numbers beyond comprehension |

Each layer cycles through base + all suffixes per count. When a count wraps, the next layer takes over. The game literally never runs out of notation.

Under the hood, all numbers use a **BigNumber (BN) system** — stored as `[mantissa, exponent]` arrays in scientific notation, supporting unlimited growth with automatic normalization and overflow guards. Arithmetic functions return gracefully on overflow instead of crashing. Cloud migration handles malformed BN arrays.

---

## ✦ Features

### 🎮 Gameplay
- 6 rooms × 15 unique autoclickers = **90 distinct upgrades**, each with its own pixel art icon
- Per-room cost progression (buy cheap in new rooms!)
- **⚡ Buy All** buttons on upgrades, decor, and prestige tabs (most expensive first)
- **🖱 Hold-to-spam** rapid-purchase on all shop items (autoclickers + prestige)
- **🔔 Real-time sidebar tab indicators** — gold dots pulse on tabs with affordable items, green dot when prestige is ready, cyan dot for new achievements
- **90 decor items** with visual canvas placement — single instance per decor, click-and-drag, click-to-front, decor positions survive prestige
- **Building Synergies** — autoclicker synergies that boost other autoclickers when owned
- **InfinityZ number system** — numbers never cap, display scales infinitely
- **BigNumber (BN) engine** — all game values stored as [mantissa, exponent] arrays, resilient to overflow, with guard recovery for corrupted saves
- Bulk buy with calculated max-buyable
- Rooms affordability updates every tick
- Offline earnings with 10x format above 1000%
- **Prestige threshold:** exponential `1T × 2.5ⁿ` — each prestige materially harder
- **Max Prestige:** VPS-gated batch processing via requestAnimationFrame — no UI freeze
- **Tier Grid:** live rebuild on settings open, unlocked/locked visual states
- **Tier Names:** match displayed custom icon, fall back to prestige-based

### 🎨 Visual
- **550+ pixel art icons** — 90 room upgrade icons + 90 decor icons + 500 tier icons + 55 achievement badges + 18 prestige upgrades + 6 dividers + 24 button frames, all generated via Codex CLI (16-bit retro style) chroma-key processed to 256×256 lossless WebP
- **24 room-themed pixel art button frames** — 6 materials × 4 sizes, applied to all buttons via CSS custom properties with `image-rendering: pixelated`
- **Unified white text + black stroke** — all UI text globally uses white fill with 8-direction black `text-shadow` outer stroke. Colored functional text (gold prestige, cyan values) retains its fill color.
- **No borders on buttons** — the button image IS the button. Active tab uses room-colored glow instead of a border.
- **VIBE button** — room-themed XL button image with 3D box-shadow depth, no white border or gradient overlay
- 6 unique room backgrounds with atmospheric effects (dual-video handoff for seamless looping)
- **Login screen video wallpaper** — looping MP4 with seamless 1.5s crossfade
- Particle systems: fireflies, matrix rain, cherry blossoms, aurora, smoke, dust, waves
- Godrays & dynamic lighting
- **180Hz render loop** with delta-time frame interpolation — particle speed consistent at any framerate
- Pixel-perfect rendering with `image-rendering: pixelated`
- Custom chroma-key removal pipeline for transparent icon assets
- **3-line InfZ display** on prestige chip box and stat boxes
- **Room-themed pixel art buttons** for all 6 rooms with auto-detected text contrast
- **Room divider images** — PNG banners at top of sidebar and canvas overlay
- **Canvas dividers** — pixel-art horizontal dividers for each room theme

### 🎵 Audio
- 45 chiptune cover MP3s — game classics, pop covers, anime hits, and memes
- Shuffle play across the full playlist
- Adjustable SFX & music volume

### 🔌 Integration
- **Login with Google, GitHub, or email/password** — Firestore-backed authentication. **5-second timeout** on Firebase auth — falls through to local mode if CDN stalls.
- **Guest Login** — jump in instantly, progress saved and merged when you create an account
- **Auto-register** on login when account doesn't exist in Firestore
- User display name management (change freely, no cooldown)
- **P2P Chat** — real-time chat over WebRTC with send/receive/typing sounds
- Auto-discovers Hermes gateway by scanning 41 common ports
- Real-time latency display with quality tiers
- Gateway VPS multiplier updates live
- Task-in-progress detection (doubles multiplier when gateway is busy)
- Manual gateway port override in both Gateway tab and Settings
- Settings overlay with Name, Audio, Profile, and Credits tabs
- Sidebar position toggle (left/right)
- Server MIME types fixed for `.webp` and `.mp4` delivery
- Cache-busting version parameter (`?v=N`) on all assets

### 💾 Persistence
- Auto-save every 30s to localStorage
- **Firebase Firestore cloud saves** with smart merge — keeps the highest prestiges, PP, and lifetime vibes across devices
- **Save on tab close** — `beforeunload` handler saves locally + to cloud
- **Corrupted save guard** — BN fields at BN_MAX level are clamped back to BN_ZERO, preventing Infinity/NaN display
- Local API server mode for self-hosted accounts
- Offline earnings calculated on return (10x format above 1000%)

### 🏆 Achievements
- 55 base achievements across vibe, click, prestige, room, VPS, gateway, decor, and autoclicker milestones
- **500 tier achievements** — programmatically generated from Bronze I to Formless Expanse
- **Progress bars** — each locked achievement shows a progress bar and percentage, calculated per threshold type
- Achievement icons from `icon_img` field (custom pixel art), falling back to emoji on load failure
- Real-time notifications with toast popups
- Permanent unlock tracking
- Dev badge with tooltip on hover for contributors

### 🏅 Leaderboard
- **P2P Star Topology** — DrGekoz is the permanent host when online. All peers connect to the host only via WebRTC data channels using Firestore signaling. Host receives scores and broadcasts the sorted leaderboard. Chat relayed through the host. Host migration is automatic when DrGekoz comes online.
- **ECDSA P-256 signed messages** — every broadcast signed and verified; JSON text carries full BN arrays for precision
- **Live All-Column Sync** — VIBES, VPS, PP, PRESTIGE, TIER update in real-time
- **Local sort** — sort chain: tier → prestige → PP → VPS → Vibes (all descending), computed locally
- **P2P + Firestore merge** — P2P entries take priority, Firestore cached entries fill gaps
- **Score reconciliation** — guest compares self scores against host's view and keeps the higher
- **30s stale buffer** — ledger entries aren't removed immediately on disconnect; 30s grace period prevents flicker
- **Player Profile Popups** — click a player name on the leaderboard to see game stats (P2P data first, Firestore fallback)
- **P2P Failsafes** — three-layer safety: per-tick retry, 15s repair timer, 30s full directory scan when isolated
- **Firestore fallback** — when P2P fails, switches to Firestore onSnapshot or polling
- **Deterministic Offerer Tiebreaker** — keyId → nonce → username picks the offerer
- **Bulletproof formatting** — every cell wrapped in try/catch with type guards and safe fallbacks
- Full BN arrays for accurate InfZ layer display
- Adaptive grid columns that scale with viewport

### ⚙️ Settings
- **Display name** — set freely, syncs to cloud, no cooldown
- **Audio** — independent SFX and music volume sliders
- **Profile** — view account stats and login status
- **Tier Icon Picker** — 500-tier scrollable grid, live rebuild on settings open, unlocked/locked visual states
- **Font & Size** — choose title/body fonts, scale all text and icons proportionally
- **Gateway** — manual port input with sync button, status display
- **Sidebar** — toggle between left and right positions
- **Account** — view login status, logout
- **Support** — Buy Me a Coffee link
- **Credits** — pixel art, tools, special thanks

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

## ✦ Architecture

```text
Hermes-IdleViber/
├── index.html                  # Entry point — single-page game UI (login + game + settings)
├── css/styles.css              # Dark retro pixel styling
├── js/
│   ├── state.js                # Game state engine, BN math, formulas, definitions, save/load
│   ├── gateway.js              # Hermes gateway discovery & health polling
│   ├── firebase.js             # Firebase auth, Firestore CRUD, leaderboard sync, P2P API export
│   ├── p2p.js                  # Legacy P2P leaderboard module (pre-crypto, kept for reference)
│   ├── p2p-crypto.js           # ECDSA P-256 crypto P2P mesh — binary packet encode/decode, chat relay
│   ├── sprites.js              # Pixel art sprite definitions & room renderer
│   ├── sfx.js                  # Sound effect engine
│   ├── music.js                # Music player — 45 chiptune cover MP3s
│   ├── api.js                  # Local server API client (auth, saves, leaderboard)
│   └── app.js                  # Main loop, UI binding, event wiring, P2P orchestration
├── server/                     # Optional self-hosted backend
│   ├── index.js                # HTTP server with CORS
│   └── package.json
├── audio/                      # 45 chiptune cover MP3s
├── sprites/images/
│   ├── bg/                     # 6 room background images + .mp4 animations
│   ├── icons/individual/       # 90 room upgrade + tier/prestige/synergy icons (256×256 webp)
│   ├── room_decor/icons/       # 90 room decor placement icons (256×256 webp)
│   └── ui/                     # 24 room-themed button frames + 6 room dividers
```

### Module Breakdown

| Module | Role |
|--------|------|
| `state.js` | Game state object, BigNumber arithmetic (BN), room/upgrade/decor definitions, save/load to localStorage, prestige/tier system, offline earnings |
| `gateway.js` | Hermes gateway port scanning, latency polling, connection quality assessment |
| `firebase.js` | Firebase App initialization, Auth (Google/GitHub/Email), Firestore CRUD for saves & leaderboard, `syncLeaderboardToFirestore()`, `getFirestoreApi()` for P2P |
| `p2p.js` | Legacy P2P leaderboard module — WebRTC peer connections (pre-crypto, kept for reference) |
| `p2p-crypto.js` | **ECDSA P-256 crypto P2P mesh** — binary packet encode/decode, WebRTC signaling via Firestore, deterministic offerer tiebreaker, 5-second ping discovery, auto-reconnect, chat relay, 15-min cloud backup election |
| `sprites.js` | Pixel art sprite rendering on canvas, room backgrounds, particle systems, decor placement |
| `sfx.js` | 8-bit sound effects for clicks, purchases, prestige, achievements, chat sounds |
| `music.js` | Chiptune MP3 player with shuffle, play queue, volume control |
| `api.js` | Local server REST API client — auth (register/login), cloud saves, leaderboard submit + fetch |
| `app.js` | Game loop (100ms tick, 180Hz render), UI binding, event handlers, P2P initialization + broadcast orchestration, chat system, leaderboard UI, settings overlay |

---

## ✦ Design Principles

- **Ambient First** — The primary experience is hanging out in a beautiful pixel space, not optimizing spreadsheets
- **Gateway as Bonus** — Your Hermes gateway isn't the core loop, it's a tasty VPS multiplier on top. Play without it just fine, but if you've got a snappy gateway you'll climb faster. Prestige chips let you crank that multiplier even higher.
- **Per-Room Identity** — Every room is a distinct gameplay silo with its own progression, music, and art
- **Zero External Assets** — Every sprite, every sound, every particle is generated at runtime (music files excluded)
- **Progressive Complexity** — Easy to start (click the button), deep to master (prestige × tiers × 6 rooms × 90 decor × InfinityZ numbers × P2P leaderboard)

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
