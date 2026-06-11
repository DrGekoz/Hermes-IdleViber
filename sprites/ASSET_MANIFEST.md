# Hermes IdleViber — Sprite Asset Manifest
## All sprites generated via Codex CLI /imagegen + remove_chroma_key.py

---

## 1. ROOM BACKGROUNDS (panoramic, 16:9, 1600×900)

| ID | Description | Status |
|----|-------------|--------|
| `bg_campfire` | Night forest clearing with glowing campfire, stars, silhouetted trees | ✅ Generated |
| `bg_cyber` | Neon-lit digital hideout, server racks, matrix rain, grid floor | ✅ Generated |
| `bg_zen_garden` | Peaceful bamboo grove, stone pond, cherry blossom petals, mist | ✅ Generated |
| `bg_star_deck` | Cosmic observatory, nebula, planets, aurora borealis | ✅ Generated |
| `bg_study_lounge` | Cozy library with bookshelves, warm lamp glow, window to night | ✅ Generated |
| `bg_beach_cove` | Sunset beach scene, pixel waves, palm tree silhouette, ocean | ✅ Generated |
| `bg_login` | Dark atmospheric login screen, campfire, gateway arch, starry night | ✅ Generated |

## 2. DECOR ITEMS (sprite sheets, 256×256 per item, chroma-key removed)

| Sheet | Items | Status |
|-------|-------|--------|
| `decor_sheet_1_nobg` | Desk lamp, Neon strip, Potted fern, Cactus | ✅ Generated + chroma removed |
| `decor_sheet_2_nobg` | Bonsai, Candle set, Bookshelf, Wooden desk, Armchair, Retro poster, World map, Picture frame, Oval rug, Neon floor mat, Side table, Coffee table | ✅ Generated + chroma removed |

## 3. AUTOCLICKER ICONS (sprite sheet, 128×128 per icon)

| Sheet | Items | Status |
|-------|-------|--------|
| `ac_sheet_nobg` | Win95, Win98, iMac G3, XP tower, Mac Mini, Gaming Rig, RTX 5090, Mac Studio, Server Rack, DGX Pod, Quantum Core, Dyson Sphere | ✅ Generated + chroma removed |

## 4. TROPHIES (sprite sheet, 128×128 each)

| Sheet | Items | Status |
|-------|-------|--------|
| `trophies_sheet_nobg` | Bronze cup, Silver cup, Gold cup with glow | ✅ Generated + chroma removed |

## 5. UI ELEMENTS + ATMOSPHERIC EFFECTS (sprite sheet)

| Sheet | Items | Status |
|-------|-------|--------|
| `ui_effects_sheet_nobg` | VIBE button, Music note, Click icon, Gateway dot, Fire ember, Star, Firefly, Cherry blossom, Snowflake, Matrix character | ✅ Generated + chroma removed |

---

## File Locations

All sprites stored under `sprites/images/`:
- `bg/*.png` — Room backgrounds (directly loaded by drawBackground)
- `decor/*_nobg.png` — Decor items with transparency
- `icons/*_nobg.png` — Icons, trophies, UI, and effects with transparency

**Total: 17 files, ~24MB**
**Fallback: game engine renders all sprites programmatically via `sprites.js` SPRITES array**
