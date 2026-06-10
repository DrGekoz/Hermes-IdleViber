# Hermes IdleViber — Sprite Asset Manifest
## Generated via Codex CLI /imagegen + remove-background

---

## 1. ROOM BACKGROUNDS (panoramic, 16:9)

| ID | Description | Aspect | Gen Status |
|----|-------------|--------|------------|
| `bg_campfire` | Night forest clearing with glowing campfire, stars, silhouetted trees | 1600×900 | ✅ Codex CLI |
| `bg_cyber` | Neon-lit digital hideout, server racks, matrix rain, grid floor | 1600×900 | ❌ |
| `bg_zen` | Peaceful bamboo grove, stone pond, cherry blossom petals, mist | 1600×900 | ❌ |
| `bg_star` | Cosmic observatory, nebula, planets, aurora borealis | 1600×900 | ❌ |
| `bg_study` | Cozy library with bookshelves, warm lamp glow, window to night | 1600×900 | ❌ |
| `bg_beach` | Sunset beach scene, pixel waves, palm tree silhouette, ocean | 1600×900 | ❌ |

---

## 2. DECOR ITEMS (square, 256×256, transparent bg)

| ID | Description | Aspect | Gen Status |
|----|-------------|--------|------------|
| `decor_lamp` | Pixel-style desk lamp, warm yellow glow | 256×256 | ❌ |
| `decor_neon` | Neon strip light, pink/cyan glow | 256×256 | ❌ |
| `decor_candle` | Three candles on small plate, warm flame | 256×256 | ❌ |
| `decor_fern` | Potted fern plant, green leaves, terracotta pot | 256×256 | ❌ |
| `decor_bonsai` | Bonsai tree in ceramic pot, sculpted branches | 256×256 | ❌ |
| `decor_cactus` | Cartoon cactus in small pot, pink flower on top | 256×256 | ❌ |
| `decor_desk` | Wooden desk, top-down or isometric view | 256×256 | ❌ |
| `decor_bookshelf` | Bookshelf filled with colorful books | 256×256 | ❌ |
| `decor_armchair` | Comfortable armchair, red or brown fabric | 256×256 | ❌ |
| `decor_poster` | Retro sci-fi movie poster on wall | 256×256 | ❌ |
| `decor_map` | Antique world map on parchment | 256×256 | ❌ |
| `decor_frame` | Empty picture frame, gold border | 256×256 | ❌ |
| `decor_rug` | Patterned oval rug, warm colors | 256×256 | ❌ |
| `decor_neon_mat` | Glowing neon floor mat, futuristic | 256×256 | ❌ |
| `decor_side_table` | Small round side table, wooden | 256×256 | ❌ |
| `decor_coffee_table` | Rectangular coffee table with items on top | 256×256 | ❌ |

---

## 3. AUTOCLICKER ICONS (square, 128×128, transparent bg)

| ID | Description | Aspect | Gen Status |
|----|-------------|--------|------------|
| `ac_win95` | Vintage beige Windows 95 PC tower | 128×128 | ❌ |
| `ac_win98` | Windows 98 PC with CRT monitor | 128×128 | ❌ |
| `ac_imac_g3` | Bondi blue iMac G3 all-in-one | 128×128 | ❌ |
| `ac_xp` | Windows XP-era tower PC | 128×128 | ❌ |
| `ac_macmini` | Small silver Mac Mini | 128×128 | ❌ |
| `ac_gaming_rig` | RGB-lit gaming PC with glass panel | 128×128 | ❌ |
| `ac_rtx` | High-end RTX 5090 graphics card | 128×128 | ❌ |
| `ac_macstudio` | Mac Studio desktop computer | 128×128 | ❌ |
| `ac_server_rack` | Server rack with blinking LEDs | 128×128 | ❌ |
| `ac_dgx` | NVIDIA DGX supercomputer | 128×128 | ❌ |
| `ac_quantum` | Futuristic quantum computer | 128×128 | ❌ |
| `ac_dyson` | Dyson Sphere megastructure in space | 128×128 | ❌ |

---

## 4. TROPHIES (square, 128×128, transparent bg)

| ID | Description | Aspect | Gen Status |
|----|-------------|--------|------------|
| `trophy_bronze` | Bronze medal / cup, 3rd place | 128×128 | ❌ |
| `trophy_silver` | Silver medal / cup, 2nd place | 128×128 | ❌ |
| `trophy_gold` | Gold medal / cup, 1st place, glowing | 128×128 | ❌ |

---

## 5. ATMOSPHERIC EFFECTS

| ID | Description | Format | Gen Status |
|----|-------------|--------|------------|
| `fx_fire_particle` | Small glowing ember particle | 16×16 | ❌ |
| `fx_star` | Twinkling star | 16×16 | ❌ |
| `fx_firefly` | Glowing firefly bug | 16×16 | ❌ |
| `fx_cherry` | Cherry blossom petal | 16×16 | ❌ |
| `fx_snow` | Snowflake | 16×16 | ❌ |
| `fx_matrix` | Matrix-style falling code character | 16×16 | ❌ |

---

## 6. UI ELEMENTS (various)

| ID | Description | Aspect | Gen Status |
|----|-------------|--------|------------|
| `ui_vibe_button` | Large pulsing "VIBE" button texture | 256×128 | ❌ |
| `ui_gateway_dot` | Gateway status indicator dot (green/red) | 32×32 | ❌ |
| `ui_click_icon` | Hand cursor clicking animation icon | 64×64 | ❌ |
| `ui_music_note` | Music note icon for controls | 32×32 | ❌ |

---

## 7. LOGIN SCREEN (16:9)

| ID | Description | Aspect | Gen Status |
|----|-------------|--------|------------|
| `login_bg` | Ambient login screen background, dark and atmospheric | 1600×900 | ❌ |

---

## Aspect Ratio Guide for sprites.js

```javascript
const SPRITE_ASPECTS = {
    // Backgrounds: fill canvas (use object-fit: cover or stretching)
    bg: { w: 1600, h: 900, fit: 'cover' },
    // Decor: square sprites displayed at grid cell size
    decor: { w: 256, h: 256, fit: 'contain' },
    // Autoclicker icons: square icons in upgrade list
    icon: { w: 128, h: 128, fit: 'contain' },
    // Trophies: square with visual padding
    trophy: { w: 128, h: 128, fit: 'contain' },
    // UI elements: flexible
    ui: { w: 64, h: 64, fit: 'contain' },
};
```

---

**Total: 42 sprite assets needed**

Priority order: Room Backgrounds (6) → Decor Items (16) → Autoclickers (12) → UI (5) → Effects (6) → Login (1)
