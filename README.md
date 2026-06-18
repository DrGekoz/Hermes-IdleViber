# 🔥 Hermes IdleViber

<p align="center">
  <i>~ The Ambient Gateway Idle Game ~</i><br>
  <b>Your Hermes gateway boosts your progression as an upgradeable multiplier.</b>
</p>

---

## ✦ What Is This?

Hermes IdleViber is an **ambient idle/incremental game** that lives in your browser — a cozy pixel-art universe where you click, earn, upgrade, and unlock themed rooms while chiptune music plays and particle effects drift across the screen.

**The twist?** The game pings your local Hermes Agent gateway and turns its latency into a VPS multiplier. The faster your gateway responds, the bigger the bonus. It turns your dev tools into a game mechanic — an upgradeable boost you can invest prestige chips into.

**Sign in** with Google, GitHub, or email/password — your progress follows you across devices via Firestore cloud saves with smart merge (keeps your highest stats).

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

**⚡ Max Prestige** button runs non-blocking batches (500 prestige cycles via requestAnimationFrame) — no UI freeze. Uses BigNumber math throughout for overflow safety.

Every prestige grants a **Tier** (Bronze I → Silver I → ... → Formless Expanse), unlocking a corresponding achievement. **500 uniquely-scaling tiers** with requirements going from 1 prestige up to `InfZ^∞`. Tier progression accelerates through normal suffixes into InfZ ×N notation, with the final tiers reaching InfZ^∞ territory. Tiers grant progressively stronger permanent bonuses (×click, ×VPS, ×all, +offline%, room unlock speed) at 65% more conservative scaling than before.

### 6. Gateway Bonus
The game pings your Hermes gateway every 5 seconds. Your latency determines your VPS multiplier — lower latency = higher bonus. No gateway running? You still earn at base rates. Gateway buffs can also be upgraded with prestige chips for an even bigger boost.

The Gateway tab shows a **2-line HUD**: VPS multiplier on line 1, latency + prestige breakdown on line 2. Manual port override available. Auto-scans common ports instantly, plus the web server range (1024-10000) in ~20s.

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

Each layer cycles through base + all 47 (or 56 for plain-number) suffixes per count. When a count wraps, the next layer takes over. The game literally never runs out of notation.

Under the hood, all numbers use a **BigNumber (BN) system** — stored as `[mantissa, exponent]` arrays in scientific notation, supporting unlimited growth with automatic normalization and overflow guards.

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
- **BigNumber (BN) engine** — all game values stored as [mantissa, exponent] arrays, resilient to overflow, with guard recovery for corrupted saves
- Bulk buy with calculated max-buyable
- Affordability updates every tick — no tab-hopping required
- Offline earnings with 10x format above 1000%

### 🎨 Visual
- 78 custom autoclicker pixel art icons + 49 prestige/decor icons + 102 decor placement sprites — all generated via Codex CLI (16-bit retro style)
- 6 unique room backgrounds with atmospheric effects
- Particle systems: fireflies, matrix rain, cherry blossoms, aurora, smoke, dust, waves
- Godrays & dynamic lighting
- **180Hz render loop** with delta-time frame interpolation — particle speed consistent at any framerate
- Pixel-perfect rendering with `image-rendering: pixelated`
- Custom chroma-key removal pipeline for transparent icon assets
- **3-line InfZ display** on prestige chip box and Total This Round stat box
- Background room animations (.mp4 video files)

### 🎵 Audio
- 45 chiptune cover MP3s — game classics (Zelda, Mario, Pokemon, Megaman, Chrono, Castlevania), pop covers (Blinding Lights, Take On Me, Eye of the Tiger), anime hits (Otonoke, Naruto), and memes
- Shuffle play across the full playlist
- Adjustable SFX & music volume

### 🔌 Integration
- **Login with Google, GitHub, or email/password** — Firestore-backed authentication
- User display name management (change freely, no cooldown)
- Auto-discovers Hermes gateway by scanning 41 common ports
- Real-time latency display with quality tiers
- Gateway VPS multiplier updates live
- Task-in-progress detection (doubles multiplier when gateway is busy)
- Manual gateway port override in both Gateway tab and Settings
- Settings overlay with Name, Audio, and Credits tabs
- Sidebar position toggle (left/right)

### 💾 Persistence
- Auto-save every 30s to localStorage
- **Firebase Firestore cloud saves** with smart merge — merges local and cloud saves keeping the highest prestiges, PP, and lifetime vibes (never overwrites progress)
- **P2P WebRTC mesh leaderboard** — real-time score sharing via peer-to-peer data channels with Firestore signaling
- Hourly Firestore leaderboard sync for persistence
- Local API server mode for self-hosted accounts
- Offline earnings calculated on return (10x format above 1000%)

### 🏆 Achievements
- 55 base achievements across vibe, click, prestige, room, VPS, gateway, decor, and autoclicker milestones
- **500 tier achievements** — programmatically generated from Bronze I to Formless Expanse — one per prestige tier
- Real-time achievement notifications with toast popups
- Permanent unlock tracking
- Dev badge with tooltip on hover for contributors

### 🏅 Leaderboard
- **P2P ECDSA Crypto Mesh** — players connect via direct peer-to-peer data channels (WebRTC) using Firestore as a signaling server. Every broadcast is signed with ECDSA P-256 and verified by the receiving peer. 100-byte binary packets carry all columns.
- **Live All-Column Sync** — VIBES, VPS, PP, PRESTIGE, and TIER columns update in real-time across the mesh.
- **Firestore fallback** — when P2P fails (NAT restrictions, no peers), automatically switches to Firestore onSnapshot or polling (30s interval)
- **Deterministic Offerer Tiebreaker** — keyId → random nonce → username always picks one peer as the offerer, no stalemates
- **Bulletproof formatting** — every cell wrapped in try/catch with type guards and safe fallbacks
- Stores full BN arrays for accurate InfinityZ layer display
- VPS column alongside vibes, prestige, and PP columns
- Adaptive grid columns that scale with viewport
- **Sort chain**: highest tier → prestige → PP → VPS → Vibes (all descending)
- Clear polling when Firestore subscription starts — no double reads, respects quota

### ⚙️ Settings
- **Display name** — set freely, syncs to cloud, no cooldown
- **Audio** — independent SFX and music volume sliders
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

## ✦ Recent Updates

- **P2P WebRTC Mesh Leaderboard** — players connect via direct peer-to-peer data channels (WebRTC) using Firestore as a signaling server. Scores broadcast in real-time across the mesh. Automatically falls back to Firestore onSnapshot/polling when P2P is unavailable. Hourly Firestore sync for long-term persistence.
- **ECDSA P-256 Crypto Layer** — every broadcast packet is signed with ECDSA P-256 and verified by the receiving peer. 100-byte binary packets carry VIBES, VPS, PP, prestige, and a 64-byte signature. All values are `Math.floor`'d and `isFinite`-guarded before signing to eliminate float64 stringification ambiguity across peers.
- **Deterministic Offerer Tiebreaker** — when two peers discover each other, a guaranteed-decidable tournament (keyId → random nonce → username) picks one side to create the WebRTC offer. No more "both wait for the other" stalemates.
- **5-Second Ping Discovery** — every peer refreshes its Firestore signaling doc every 5 seconds. Peers appear and disappear in real-time, with automatic reconnection on failure.
- **Stale Signaling Cleanup** — old offer/answer docs from failed connection attempts are auto-deleted instead of looping on retry forever.
- **Double-Init Race Guard** — `p2pStarting` mutex prevents two concurrent P2P initialization attempts from creating conflicting managers.
- **Live All-Column Sync** — VIBES, VPS, PP, PRESTIGE, and TIER columns update in real-time across the mesh, not just score.
- **Bulletproof Leaderboard Formatting** — every cell is wrapped in `fmtAll()` with try/catch, `isFinite`/`isNaN`/`Array.isArray` type guards, string→number coercion, BN array handling, and a safe fallback — one bad value can never crash the render loop.
- **BigNumber System Hardening** — all game values now guarded with `_bnGuard()` for null/undefined/isFinite recovery. `BN_MAX` sentinel prevents infinite exponent overflow. Arithmetic functions return gracefully on overflow instead of crashing. Cloud migration handles malformed BN arrays.
- **Cloud Save Merge** — instead of blindly overwriting, cloud saves now merge with local saves keeping the highest prestiges, total PP, and lifetime vibes. Smart progress preservation across devices.
- **Max Prestige Batching** — runs in non-blocking 500-cycle batches via `requestAnimationFrame` — no UI freeze even at extreme VPS levels. BigNumber math throughout.
- **Prestige Overhaul** — Max Prestige uses math formula, runs instantly; prestige threshold scales dynamically with VPS (log₂ factor), stops at 1hr cap; gentler sqrt-log formula for early-game pacing; 1.06× tier scaling
- **180Hz Render Loop** — delta-time frame interpolation keeps particle effects and animations smooth and speed-consistent at any refresh rate
- **3-line InfZ Display** — prestige chip box, Total This Round stat box, and prestige chip gain text all show 3-line InfZ formatted values
- **Gateway HUD Redesign** — VPS multiplier on line 1, latency + prestige breakdown on line 2; manual port override
- **Tier Achievements** — 500 programmatic tier achievements, one per prestige tier (Bronze I → Formless Expanse), generated on the fly
- **Realtime Leaderboard** — live tier column (Bronze→Silver→Gold→...), BN-accurate InfZ values, VPS column, adaptive grid, dev badge tooltip on hover
- **Google & GitHub OAuth Login** — sign in with Google or GitHub accounts, or email/password. Settings overlay with name, audio, credits tabs, sidebar position toggle, gateway port sync, and Buy Me a Coffee support.
- **Offline Stats Enhancement** — offline rate switches to 10x format above 1000%
- **InfinityZ number system** — numbers beyond Z display as `InfZ ×N`, `InfZ ×1k`, ... `InfZ ×1Z`, `InfZ ×2` cycling through InfZ^n notation with distinct brackets per power layer
- **Buy All buttons** — ⚡ Buy All on upgrades, decor, and prestige tabs (buys most expensive first, spends everything)
- **Hold-to-spam** — works for both autoclicker upgrades AND prestige upgrades
- **Real-time tab indicators** — sidebar tabs show gold/green/cyan dots when items are affordable or ready
- **127+ pixel art icons** — 78 autoclicker, 49 prestige/decor, and 102 decor placement sprites — all Codex CLI-generated 16-bit pixel art
- **Per-room cost progression** — costs track the current room's purchase count, not global
- **Prestige cost fixes** — progressive cost scaling for all re-buyable prestige upgrades
- **Dev badge tooltip** — hover over your name on the leaderboard to see contributor status
- **Icon re-encoding** — all prestige/autoclicker icons re-encoded to smaller file sizes for faster loading
- **500 Tiers** — expanded from 250 to 500 uniquely-scaling tiers with cosmic InfZ-themed naming. Requirements use BN (BigNumber) from tier 1, accelerating from `1 → 2.1M → InfZ ×N → InfZ^∞`. 65% more conservative bonuses. `total_prestiges` is now a BN for infinite precision.
- **InfZ^n Number Display** — number system now shows proper InfZ^n notation with bracket styles: `InfZ ×N` (InfZ^1), `InfZ² (N)` (InfZ²), `InfZ³ [N]` (InfZ³), onward through `InfZ^∞` for numbers beyond all comprehension
- **Prestige Upgrade BN Pricing** — prestige upgrade costs now use BigNumber arithmetic (`bnPow` + `getPrestigeUpgradeCost`) instead of `Math.pow`, removing the Infinity cap that made high-count upgrades permanently unpurchasable
- **Max Prestige Silent Batching** — rewritten to suppress all `notifyStateChange` during the batch loop, eliminating the browser lockup that occurred with 1500+ UI rebuilds per click
- **Prestige UI BN Comparison Fixes** — all `gain > 0`, `gain <= 0`, `chips >= cost` comparisons now use proper BN comparison functions (`bnGt`, `bnLe`, `bnGe`) instead of native JS which silently failed on BN arrays

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
│   ├── p2p.js                  # P2P WebRTC mesh leaderboard (Firestore signaling, fallback polling)
│   ├── sprites.js              # Pixel art sprite definitions & room renderer
│   ├── sfx.js                  # Sound effect engine
│   ├── music.js                # Music player — 45 chiptune cover MP3s
│   └── app.js                  # Main loop, UI binding, event wiring, P2P orchestration
├── server/                     # Optional self-hosted backend
│   ├── index.js                # HTTP server with CORS
│   └── package.json
├── audio/                      # 45 chiptune cover MP3s
├── sprites/images/
│   ├── bg/                     # 6 room background images + .mp4 animations
│   ├── icons/individual/       # 127 autoclicker + prestige + decor icons (64×64 webp)
│   └── room_decor/             # 102 decor placement sprites
```

### Module Breakdown

| Module | Role |
|--------|------|
| `state.js` | Game state object, BigNumber arithmetic (BN), room/upgrade/decor definitions, save/load to localStorage, prestige/tier system, offline earnings |
| `gateway.js` | Hermes gateway port scanning, latency polling, connection quality assessment |
| `firebase.js` | Firebase App initialization, Auth (Google/GitHub/Email), Firestore CRUD for saves & leaderboard, `syncLeaderboardToFirestore()`, `getFirestoreApi()` for P2P |
| `p2p-crypto.js` | **ECDSA P-256 crypto P2P mesh** — binary packet encode/decode, WebRTC signaling via Firestore, deterministic offerer tiebreaker, 5-second ping discovery, auto-reconnect, 15-min cloud backup election |
| `p2p.js` | Legacy P2P leaderboard module — WebRTC peer connections (pre-crypto, kept for reference) |
| `sprites.js` | Pixel art sprite rendering on canvas, room backgrounds, particle systems, decor placement |
| `sfx.js` | 8-bit sound effects for clicks, purchases, prestige, achievements |
| `music.js` | Chiptune MP3 player with shuffle, play queue, volume control |
| `app.js` | Game loop (100ms tick, 180Hz render), UI binding, event handlers, P2P initialization + broadcast orchestration, leaderboard UI, settings overlay |

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
