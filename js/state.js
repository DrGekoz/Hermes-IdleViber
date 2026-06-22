// ============================================================
// Hermes IdleViber — Game State Engine
// ============================================================

const CONFIG = {
    SAVE_KEY: 'hermes_idleviber_save',
    GATEWAY_PORTS: [8000, 8080, 3000, 7777, 5000, 9090],
    GATEWAY_TIMEOUT: 3000,
    TICK_INTERVAL: 100,        // 10 ticks/sec
    SAVE_INTERVAL: 30000,      // Auto-save every 30s
    GATEWAY_POLL_INTERVAL: 5000, // Check gateway every 5s
    MAX_GATEWAY_LATENCY_HISTORY: 10,
    PRESTIGE_THRESHOLD: 10_000_000_000_000, // 10T (legacy, use getPrestigeThreshold instead)
};

// ---------- BIG NUMBER SYSTEM ----------
// Numbers stored as [mantissa, exponent] = mantissa * 10^exponent
// mantissa in [1, 10) or 0 for zero. Supports effectively unlimited growth.
const BN = (m, e) => [m, e];
const BN_ZERO = BN(0, 0);
const BN_ONE = BN(1, 0);
const BN_MAX = BN(1, Number.MAX_SAFE_INTEGER); // Hard cap sentinel

// Guard: ensure a value is a valid BN array, recovering gracefully
function _bnGuard(v) {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return v;
    if (v === null || v === undefined) return BN_ZERO;
    if (typeof v === 'number') return bnFromNumber(v);
    if (Array.isArray(v)) {
        // Malformed BN — try to recover
        const m = typeof v[0] === 'number' && isFinite(v[0]) ? v[0] : 0;
        const e = typeof v[1] === 'number' && isFinite(v[1]) ? v[1] : 0;
        return BN(m, e);
    }
    return BN_ZERO;
}

function bnNormalize(bn) {
    bn = _bnGuard(bn);
    let [m, e] = bn;
    if (m === 0 || !isFinite(m)) return BN_ZERO;
    if (!isFinite(e) || e > Number.MAX_SAFE_INTEGER) return BN_MAX;
    if (e < -Number.MAX_SAFE_INTEGER) return BN_ZERO;
    while (m >= 10) { m /= 10; e++; }
    while (m < 1 && m > 0) { m *= 10; e--; }
    if (!isFinite(e) || e > Number.MAX_SAFE_INTEGER) return BN_MAX;
    return BN(m, e);
}

function bnFromNumber(n) {
    if (n === 0 || n === null || n === undefined) return BN_ZERO;
    if (typeof n !== 'number') n = Number(n);
    if (!isFinite(n)) return BN_MAX;
    const abs = Math.abs(n);
    if (abs === 0) return BN_ZERO;
    const e = Math.floor(Math.log10(abs));
    const m = abs / Math.pow(10, e);
    if (!isFinite(m) || !isFinite(e)) return BN_MAX;
    return BN(n < 0 ? -m : m, e);
}

function bnToNumber(bn) {
    bn = _bnGuard(bn);
    if (bn[0] === 0) return 0;
    const [m, e] = bn;
    if (!isFinite(m) || !isFinite(e)) return e > 0 ? Infinity : 0;
    if (e > 308) return Infinity;
    if (e < -308) return 0;
    const result = m * Math.pow(10, e);
    return isFinite(result) ? result : (e > 0 ? Infinity : 0);
}

function bnAdd(a, b) {
    a = _bnGuard(a); b = _bnGuard(b);
    if (a[0] === 0) return b;
    if (b[0] === 0) return a;
    let [m1, e1] = a;
    let [m2, e2] = b;
    const diff = Math.abs(e1 - e2);
    if (diff > 15) return e1 > e2 ? a : b;
    const minE = Math.min(e1, e2);
    const sum = m1 * Math.pow(10, e1 - minE) + m2 * Math.pow(10, e2 - minE);
    if (!isFinite(sum)) return e1 > e2 ? a : b;
    return bnNormalize(BN(sum, minE));
}

function bnSub(a, b) {
    a = _bnGuard(a); b = _bnGuard(b);
    if (b[0] === 0) return a;
    let [m1, e1] = a;
    let [m2, e2] = b;
    const diff = Math.abs(e1 - e2);
    if (diff > 15) return e1 > e2 ? a : BN_ZERO;
    const minE = Math.min(e1, e2);
    const diff2 = m1 * Math.pow(10, e1 - minE) - m2 * Math.pow(10, e2 - minE);
    if (!isFinite(diff2) || diff2 <= 0) return BN_ZERO;
    return bnNormalize(BN(diff2, minE));
}

function bnMul(a, b) {
    a = _bnGuard(a); b = _bnGuard(b);
    if (a[0] === 0 || b[0] === 0) return BN_ZERO;
    const m = a[0] * b[0];
    const e = a[1] + b[1];
    if (!isFinite(m) || !isFinite(e)) return BN_MAX;
    return bnNormalize(BN(m, e));
}

function bnDiv(a, b) {
    a = _bnGuard(a); b = _bnGuard(b);
    if (b[0] === 0) return BN_MAX;
    if (a[0] === 0) return BN_ZERO;
    const m = a[0] / b[0];
    const e = a[1] - b[1];
    if (!isFinite(m) || !isFinite(e)) return BN_MAX;
    return bnNormalize(BN(m, e));
}

function bnCompare(a, b) {
    a = _bnGuard(a); b = _bnGuard(b);
    if (a[0] === 0 && b[0] === 0) return 0;
    if (a[0] === 0) return b[0] === 0 ? 0 : -1;
    if (b[0] === 0) return 1;
    if (a[1] > b[1]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[0] < b[0]) return -1;
    return 0;
}

function bnFloor(bn) {
    bn = _bnGuard(bn);
    if (bn[0] === 0) return BN_ZERO;
    let [m, e] = bn;
    if (e < 0) return BN_ZERO;
    if (e > 15) return bn;
    const val = Math.floor(m * Math.pow(10, e));
    if (!isFinite(val)) return bn;
    return bnFromNumber(Math.max(0, val));
}

function bnLt(a, b) { return bnCompare(a, b) < 0; }
function bnLe(a, b) { return bnCompare(a, b) <= 0; }
function bnGt(a, b) { return bnCompare(a, b) > 0; }
function bnGe(a, b) { return bnCompare(a, b) >= 0; }
function bnEq(a, b) { return bnCompare(a, b) === 0; }

// BN exponentiation: base^exp for non-negative integer exp (binary exponentiation)
function bnPow(base, exp) {
    if (exp === 0) return BN_ONE;
    let result = BN_ONE;
    let b = base;
    let e = exp;
    while (e > 0) {
        if (e & 1) result = bnMul(result, b);
        b = bnMul(b, b);
        e >>= 1;
        if (b[0] === BN_MAX[0] && b[1] === BN_MAX[1]) break; // overflow sentinel
    }
    return result;
}

// Prestige upgrade cost as BN: baseCost * costMult^count
function getPrestigeUpgradeCost(id, state = G) {
    const upg = PRESTIGE_UPGRADES.find(u => u.id === id);
    if (!upg) return BN_MAX;
    const count = (state.prestige_upgrades && state.prestige_upgrades[id]) || 0;
    if (count === 0) return bnFromNumber(upg.baseCost);
    const mult = bnPow(bnFromNumber(upg.costMult), count);
    return bnMul(bnFromNumber(upg.baseCost), mult);
}

// ---------- ROOMS & THEMES ----------
const ROOMS = {
    campfire_grove: {
        id: 'campfire_grove',
        name: 'Campfire Grove',
        bgImage: 'sprites/images/bg/bg_campfire.webp',
        desc: 'A warm crackling fire under starry skies',
        cost: 0,
        unlocked: true,
        bg: ['#1a0e0a', '#2b1a10', '#0f0806'],
        fg: ['#ff6b35', '#ffaa44', '#ffdd88'],
        sprites: ['campfire', 'trees', 'stars', 'smoke'],
        theme: {
            sidebar: '#1a0e0a',
            panel: '#120a08',
            tab_active: '#2b1a10',
            tab_inactive: '#0f0806',
            tab_text_active: '#ffdd88',
            tab_text_inactive: '#886644',
            btn_bg: '#2b1a10',
            btn_text: '#ffaa44',
            btn_border: '#ff6b35',
            title_color: '#ffdd88',
            accent: '#ff6b35',
            secondary: '#ffaa44',
            text_primary: '#f0d0b0',
            text_secondary: '#887060',
            border: '#3a2a1a',
            highlight: '#ffdd88',
            vibe_color: '#ff6b35',
            resource_bg: '#1a0e0a',
        },
    },
    cyber_den: {
        id: 'cyber_den',
        name: 'Cyber Den',
        bgImage: 'sprites/images/bg/bg_cyber.webp',
        desc: 'Neon-lit digital hideout',
        cost: 100_000_000,         // 100M
        unlocked: false,
        bg: ['#0a001a', '#1a0033', '#000011'],
        fg: ['#ff00ff', '#00ffff', '#ff0066'],
        sprites: ['server_rack', 'neon_sign', 'matrix_rain', 'hologram'],
        theme: {
            sidebar: '#0a001a',
            panel: '#060011',
            tab_active: '#1a0033',
            tab_inactive: '#000011',
            tab_text_active: '#00ffff',
            tab_text_inactive: '#662288',
            btn_bg: '#1a0033',
            btn_text: '#ff00ff',
            btn_border: '#00ffff',
            title_color: '#00ffff',
            accent: '#ff00ff',
            secondary: '#00ffff',
            text_primary: '#d0b0ff',
            text_secondary: '#664488',
            border: '#330055',
            highlight: '#ff00ff',
            vibe_color: '#ff0066',
            resource_bg: '#0a001a',
        },
    },
    zen_garden: {
        id: 'zen_garden',
        name: 'Zen Garden',
        bgImage: 'sprites/images/bg/bg_zen_garden.webp',
        desc: 'Peaceful bamboo grove with flowing water',
        cost: 1_000_000_000,       // 1B
        unlocked: false,
        bg: ['#0a1a0a', '#1a2a1a', '#050f05'],
        fg: ['#66bb6a', '#a5d6a7', '#4db6ac'],
        sprites: ['bamboo', 'water_rock', 'cherry_blossom', 'lantern'],
        theme: {
            sidebar: '#0a1a0a',
            panel: '#061206',
            tab_active: '#1a2a1a',
            tab_inactive: '#050f05',
            tab_text_active: '#a5d6a7',
            tab_text_inactive: '#335533',
            btn_bg: '#1a2a1a',
            btn_text: '#a5d6a7',
            btn_border: '#66bb6a',
            title_color: '#a5d6a7',
            accent: '#66bb6a',
            secondary: '#4db6ac',
            text_primary: '#b0d0b0',
            text_secondary: '#446644',
            border: '#2a4a2a',
            highlight: '#a5d6a7',
            vibe_color: '#4db6ac',
            resource_bg: '#0a1a0a',
        },
    },
    star_deck: {
        id: 'star_deck',
        name: 'Star Deck',
        bgImage: 'sprites/images/bg/bg_star_deck.webp',
        desc: 'Cosmic observatory floating among galaxies',
        cost: 25_000_000_000,      // 25B
        unlocked: false,
        bg: ['#000022', '#000044', '#001122'],
        fg: ['#ffffff', '#8888ff', '#ff88ff'],
        sprites: ['telescope', 'aurora', 'planets', 'constellations'],
        theme: {
            sidebar: '#000022',
            panel: '#000018',
            tab_active: '#000044',
            tab_inactive: '#001122',
            tab_text_active: '#ffffff',
            tab_text_inactive: '#444488',
            btn_bg: '#000044',
            btn_text: '#8888ff',
            btn_border: '#ffffff',
            title_color: '#ffffff',
            accent: '#8888ff',
            secondary: '#ff88ff',
            text_primary: '#c0c0e0',
            text_secondary: '#444466',
            border: '#222255',
            highlight: '#ffffff',
            vibe_color: '#ff88ff',
            resource_bg: '#000022',
        },
    },
    study_lounge: {
        id: 'study_lounge',
        name: 'Study Lounge',
        bgImage: 'sprites/images/bg/bg_study_lounge.webp',
        desc: 'Cozy den with bookshelves and warm lamplight',
        cost: 1_000_000_000_000,   // 1T
        unlocked: false,
        bg: ['#1a1410', '#2a2018', '#0f0a08'],
        fg: ['#d4a574', '#c4956a', '#e8c8a8'],
        sprites: ['bookshelf', 'desk', 'lamp', 'armchair'],
        theme: {
            sidebar: '#1a1410',
            panel: '#120e0a',
            tab_active: '#2a2018',
            tab_inactive: '#0f0a08',
            tab_text_active: '#e8c8a8',
            tab_text_inactive: '#665544',
            btn_bg: '#2a2018',
            btn_text: '#d4a574',
            btn_border: '#c4956a',
            title_color: '#e8c8a8',
            accent: '#d4a574',
            secondary: '#c4956a',
            text_primary: '#d0c0a8',
            text_secondary: '#665544',
            border: '#3a2a1a',
            highlight: '#e8c8a8',
            vibe_color: '#d4a574',
            resource_bg: '#1a1410',
        },
    },
    beach_cove: {
        id: 'beach_cove',
        name: 'Beach Cove',
        bgImage: 'sprites/images/bg/bg_beach_cove.webp',
        desc: 'Sunset waves lapping on pixel sand',
        cost: 10_000_000_000_000,  // 10T
        unlocked: false,
        bg: ['#1a2233', '#2a3344', '#0a1520'],
        fg: ['#ffaa44', '#ff8833', '#66ccff'],
        sprites: ['palm_tree', 'waves', 'seashell', 'sunset'],
        theme: {
            sidebar: '#1a2233',
            panel: '#121a28',
            tab_active: '#2a3344',
            tab_inactive: '#0a1520',
            tab_text_active: '#ffdd88',
            tab_text_inactive: '#445566',
            btn_bg: '#2a3344',
            btn_text: '#ffaa44',
            btn_border: '#66ccff',
            title_color: '#ffdd88',
            accent: '#ffaa44',
            secondary: '#66ccff',
            text_primary: '#c0d0e0',
            text_secondary: '#556677',
            border: '#335577',
            highlight: '#ffdd88',
            vibe_color: '#ff8833',
            resource_bg: '#1a2233',
        },
    },
};

// ---------- PER-ROOM DECOR ITEMS (15 per room, sorted cheapest to most expensive) ----------
// Price curve (per slot, same across all rooms):
//   1:1K   2:5K   3:25K   4:100K   5:500K
//   6:2M   7:10M  8:50M   9:200M   10:1B
//   11:5B  12:25B 13:100B 14:500B  15:2T
const ROOM_DECOR = {
    campfire_grove: [
        { id: 'cg_log_stool',        name: 'Log Stool',        cost: 1_000,           vpsMult: 1.002, icon: 'cg_log_stool' },
        { id: 'cg_compass',          name: 'Compass',           cost: 5_000,           vpsMult: 1.005, icon: 'cg_compass' },
        { id: 'cg_canteen',          name: 'Canteen',           cost: 25_000,          vpsMult: 1.01,  icon: 'cg_canteen' },
        { id: 'cg_whittle_figure',   name: 'Whittle Figure',    cost: 100_000,         vpsMult: 1.015, icon: 'cg_whittle_figure' },
        { id: 'cg_star_chart',       name: 'Star Chart',        cost: 500_000,         vpsMult: 1.02,  icon: 'cg_star_chart' },
        { id: 'cg_map_stand',        name: 'Map Stand',         cost: 2_000_000,       vpsMult: 1.025, icon: 'cg_map_stand' },
        { id: 'cg_wildflower',       name: 'Wildflower Patch',  cost: 10_000_000,      vpsMult: 1.03,  icon: 'cg_wildflower' },
        { id: 'cg_berry_bush',       name: 'Berry Bush',        cost: 50_000_000,      vpsMult: 1.04,  icon: 'cg_berry_bush' },
        { id: 'cg_birdhouse',        name: 'Birdhouse',         cost: 200_000_000,     vpsMult: 1.05,  icon: 'cg_birdhouse' },
        { id: 'cg_fishing_rod',      name: 'Fishing Rod',       cost: 1_000_000_000,   vpsMult: 1.06,  icon: 'cg_fishing_rod' },
        { id: 'cg_axe_block',        name: 'Axe Block',         cost: 5_000_000_000,   vpsMult: 1.07,  icon: 'cg_axe_block' },
        { id: 'cg_wood_pile',        name: 'Wood Pile',         cost: 25_000_000_000,  vpsMult: 1.08,  icon: 'cg_wood_pile' },
        { id: 'cg_bedroll',          name: 'Bedroll',           cost: 100_000_000_000, vpsMult: 1.10,  icon: 'cg_bedroll' },
        { id: 'cg_lantern_post',     name: 'Lantern Post',      cost: 500_000_000_000, vpsMult: 1.12,  icon: 'cg_lantern_post' },
        { id: 'cg_fire_ring',        name: 'Fire Ring',         cost: 2_000_000_000_000, vpsMult: 1.15, icon: 'cg_fire_ring' },
    ],
    cyber_den: [
        { id: 'cd_digital_clock',    name: 'Digital Clock',     cost: 1_000,           vpsMult: 1.002, icon: 'cd_digital_clock' },
        { id: 'cd_glitch_art',       name: 'Glitch Art',        cost: 5_000,           vpsMult: 1.005, icon: 'cd_glitch_art' },
        { id: 'cd_circuit_board',    name: 'Circuit Board',     cost: 25_000,          vpsMult: 1.01,  icon: 'cd_circuit_board' },
        { id: 'cd_cooling_fan',      name: 'Cooling Fan',       cost: 100_000,         vpsMult: 1.015, icon: 'cd_cooling_fan' },
        { id: 'cd_data_crystal',     name: 'Data Crystal',      cost: 500_000,         vpsMult: 1.02,  icon: 'cd_data_crystal' },
        { id: 'cd_rgb_panel',        name: 'RGB Panel',         cost: 2_000_000,       vpsMult: 1.025, icon: 'cd_rgb_panel' },
        { id: 'cd_vr_headset',       name: 'VR Headset',        cost: 10_000_000,      vpsMult: 1.03,  icon: 'cd_vr_headset' },
        { id: 'cd_keyboard_rig',     name: 'Keyboard Rig',      cost: 50_000_000,      vpsMult: 1.04,  icon: 'cd_keyboard_rig' },
        { id: 'cd_cable_spaghetti',  name: 'Cable Spaghetti',   cost: 200_000_000,     vpsMult: 1.05,  icon: 'cd_cable_spaghetti' },
        { id: 'cd_server_tower',     name: 'Server Tower',      cost: 1_000_000_000,   vpsMult: 1.06,  icon: 'cd_server_tower' },
        { id: 'cd_power_core',       name: 'Power Core',        cost: 5_000_000_000,   vpsMult: 1.07,  icon: 'cd_power_core' },
        { id: 'cd_access_terminal',  name: 'Access Terminal',   cost: 25_000_000_000,  vpsMult: 1.08,  icon: 'cd_access_terminal' },
        { id: 'cd_projector_screen', name: 'Projector Screen',  cost: 100_000_000_000, vpsMult: 1.10,  icon: 'cd_projector_screen' },
        { id: 'cd_robot_arm',        name: 'Robot Arm',         cost: 500_000_000_000, vpsMult: 1.12,  icon: 'cd_robot_arm' },
        { id: 'cd_holographic_display', name: 'Hologram Display', cost: 2_000_000_000_000, vpsMult: 1.15, icon: 'cd_holographic_display' },
    ],
    zen_garden: [
        { id: 'zg_tea_set',          name: 'Tea Set',           cost: 1_000,           vpsMult: 1.002, icon: 'zg_tea_set' },
        { id: 'zg_water_dipper',     name: 'Water Dipper',      cost: 5_000,           vpsMult: 1.005, icon: 'zg_water_dipper' },
        { id: 'zg_incense_burner',   name: 'Incense Burner',    cost: 25_000,          vpsMult: 1.01,  icon: 'zg_incense_burner' },
        { id: 'zg_lotus_flower',     name: 'Lotus Flower',      cost: 100_000,         vpsMult: 1.015, icon: 'zg_lotus_flower' },
        { id: 'zg_wind_chime',       name: 'Wind Chime',        cost: 500_000,         vpsMult: 1.02,  icon: 'zg_wind_chime' },
        { id: 'zg_meditation_cush',  name: 'Meditation Cushion',cost: 2_000_000,       vpsMult: 1.025, icon: 'zg_meditation_cush' },
        { id: 'zg_moss_rock',        name: 'Moss Rock',         cost: 10_000_000,      vpsMult: 1.03,  icon: 'zg_moss_rock' },
        { id: 'zg_cherry_bonsai',    name: 'Cherry Bonsai',     cost: 50_000_000,      vpsMult: 1.04,  icon: 'zg_cherry_bonsai' },
        { id: 'zg_bamboo_fence',     name: 'Bamboo Fence',      cost: 200_000_000,     vpsMult: 1.05,  icon: 'zg_bamboo_fence' },
        { id: 'zg_stone_path',       name: 'Stone Path',        cost: 1_000_000_000,   vpsMult: 1.06,  icon: 'zg_stone_path' },
        { id: 'zg_koi_pond',         name: 'Koi Pond',          cost: 5_000_000_000,   vpsMult: 1.07,  icon: 'zg_koi_pond' },
        { id: 'zg_sand_garden',      name: 'Sand Garden',       cost: 25_000_000_000,  vpsMult: 1.08,  icon: 'zg_sand_garden' },
        { id: 'zg_rain_chain',       name: 'Rain Chain',        cost: 100_000_000_000, vpsMult: 1.10,  icon: 'zg_rain_chain' },
        { id: 'zg_bamboo_fountain',  name: 'Bamboo Fountain',   cost: 500_000_000_000, vpsMult: 1.12,  icon: 'zg_bamboo_fountain' },
        { id: 'zg_stone_lantern',    name: 'Stone Lantern',     cost: 2_000_000_000_000, vpsMult: 1.15, icon: 'zg_stone_lantern' },
    ],
    star_deck: [
        { id: 'sd_moon_globe',       name: 'Moon Globe',        cost: 1_000,           vpsMult: 1.002, icon: 'sd_moon_globe' },
        { id: 'sd_constellation_map',name: 'Constellation Map', cost: 5_000,           vpsMult: 1.005, icon: 'sd_constellation_map' },
        { id: 'sd_meteor_stone',     name: 'Meteor Stone',      cost: 25_000,          vpsMult: 1.01,  icon: 'sd_meteor_stone' },
        { id: 'sd_orbit_diagram',    name: 'Orbit Diagram',     cost: 100_000,         vpsMult: 1.015, icon: 'sd_orbit_diagram' },
        { id: 'sd_astrolabe',        name: 'Astrolabe',         cost: 500_000,         vpsMult: 1.02,  icon: 'sd_astrolabe' },
        { id: 'sd_galaxy_painting',  name: 'Galaxy Painting',   cost: 2_000_000,       vpsMult: 1.025, icon: 'sd_galaxy_painting' },
        { id: 'sd_observatory_chair',name: 'Observatory Chair', cost: 10_000_000,      vpsMult: 1.03,  icon: 'sd_observatory_chair' },
        { id: 'sd_star_projector',   name: 'Star Projector',    cost: 50_000_000,      vpsMult: 1.04,  icon: 'sd_star_projector' },
        { id: 'sd_lunar_lamp',       name: 'Lunar Lamp',        cost: 200_000_000,     vpsMult: 1.05,  icon: 'sd_lunar_lamp' },
        { id: 'sd_cosmic_map',       name: 'Cosmic Map',        cost: 1_000_000_000,   vpsMult: 1.06,  icon: 'sd_cosmic_map' },
        { id: 'sd_nebula_art',       name: 'Nebula Art',        cost: 5_000_000_000,   vpsMult: 1.07,  icon: 'sd_nebula_art' },
        { id: 'sd_planet_model',     name: 'Planet Model',      cost: 25_000_000_000,  vpsMult: 1.08,  icon: 'sd_planet_model' },
        { id: 'sd_rocket_model',     name: 'Rocket Model',      cost: 100_000_000_000, vpsMult: 1.10,  icon: 'sd_rocket_model' },
        { id: 'sd_satellite_dish',   name: 'Satellite Dish',    cost: 500_000_000_000, vpsMult: 1.12,  icon: 'sd_satellite_dish' },
        { id: 'sd_telescope',        name: 'Telescope',         cost: 2_000_000_000_000, vpsMult: 1.15, icon: 'sd_telescope' },
    ],
    study_lounge: [
        { id: 'sl_coffee_mug',       name: 'Coffee Mug',        cost: 1_000,           vpsMult: 1.002, icon: 'sl_coffee_mug' },
        { id: 'sl_candle_holder',    name: 'Candle Holder',     cost: 5_000,           vpsMult: 1.005, icon: 'sl_candle_holder' },
        { id: 'sl_plant_pot',        name: 'Plant Pot',         cost: 25_000,          vpsMult: 1.01,  icon: 'sl_plant_pot' },
        { id: 'sl_wall_clock',       name: 'Wall Clock',        cost: 100_000,         vpsMult: 1.015, icon: 'sl_wall_clock' },
        { id: 'sl_typewriter',       name: 'Typewriter',        cost: 500_000,         vpsMult: 1.02,  icon: 'sl_typewriter' },
        { id: 'sl_globe',            name: 'Globe',             cost: 2_000_000,       vpsMult: 1.025, icon: 'sl_globe' },
        { id: 'sl_throw_pillow',     name: 'Throw Pillow',      cost: 10_000_000,      vpsMult: 1.03,  icon: 'sl_throw_pillow' },
        { id: 'sl_magazine_rack',    name: 'Magazine Rack',     cost: 50_000_000,      vpsMult: 1.04,  icon: 'sl_magazine_rack' },
        { id: 'sl_picture_frame',    name: 'Picture Frame',     cost: 200_000_000,     vpsMult: 1.05,  icon: 'sl_picture_frame' },
        { id: 'sl_reading_lamp',     name: 'Reading Lamp',      cost: 1_000_000_000,   vpsMult: 1.06,  icon: 'sl_reading_lamp' },
        { id: 'sl_floor_lamp',       name: 'Floor Lamp',        cost: 5_000_000_000,   vpsMult: 1.07,  icon: 'sl_floor_lamp' },
        { id: 'sl_record_player',    name: 'Record Player',     cost: 25_000_000_000,  vpsMult: 1.08,  icon: 'sl_record_player' },
        { id: 'sl_writing_desk',     name: 'Writing Desk',      cost: 100_000_000_000, vpsMult: 1.10,  icon: 'sl_writing_desk' },
        { id: 'sl_armchair',         name: 'Armchair',          cost: 500_000_000_000, vpsMult: 1.12,  icon: 'sl_armchair' },
        { id: 'sl_bookshelf',        name: 'Bookshelf',         cost: 2_000_000_000_000, vpsMult: 1.15, icon: 'sl_bookshelf' },
    ],
    beach_cove: [
        { id: 'bc_seashell',         name: 'Seashell',          cost: 1_000,           vpsMult: 1.002, icon: 'bc_seashell' },
        { id: 'bc_starfish',         name: 'Starfish',          cost: 5_000,           vpsMult: 1.005, icon: 'bc_starfish' },
        { id: 'bc_sand_bucket',      name: 'Sand Bucket',       cost: 25_000,          vpsMult: 1.01,  icon: 'bc_sand_bucket' },
        { id: 'bc_flip_flops',       name: 'Flip Flops',        cost: 100_000,         vpsMult: 1.015, icon: 'bc_flip_flops' },
        { id: 'bc_beach_ball',       name: 'Beach Ball',        cost: 500_000,         vpsMult: 1.02,  icon: 'bc_beach_ball' },
        { id: 'bc_driftwood',        name: 'Driftwood',         cost: 2_000_000,       vpsMult: 1.025, icon: 'bc_driftwood' },
        { id: 'bc_sandcastle',       name: 'Sandcastle',        cost: 10_000_000,      vpsMult: 1.03,  icon: 'bc_sandcastle' },
        { id: 'bc_coral_piece',      name: 'Coral Piece',       cost: 50_000_000,      vpsMult: 1.04,  icon: 'bc_coral_piece' },
        { id: 'bc_tiki_torch',       name: 'Tiki Torch',        cost: 200_000_000,     vpsMult: 1.05,  icon: 'bc_tiki_torch' },
        { id: 'bc_cooler',           name: 'Cooler',            cost: 1_000_000_000,   vpsMult: 1.06,  icon: 'bc_cooler' },
        { id: 'bc_beach_towel',      name: 'Beach Towel',       cost: 5_000_000_000,   vpsMult: 1.07,  icon: 'bc_beach_towel' },
        { id: 'bc_surfboard',        name: 'Surfboard',         cost: 25_000_000_000,  vpsMult: 1.08,  icon: 'bc_surfboard' },
        { id: 'bc_beach_umbrella',   name: 'Beach Umbrella',    cost: 100_000_000_000, vpsMult: 1.10,  icon: 'bc_beach_umbrella' },
        { id: 'bc_hammock',          name: 'Hammock',           cost: 500_000_000_000, vpsMult: 1.12,  icon: 'bc_hammock' },
        { id: 'bc_palm_tree',        name: 'Palm Tree',         cost: 2_000_000_000_000, vpsMult: 1.15, icon: 'bc_palm_tree' },
    ],
};

function getDecorForRoom(roomId) {
    return ROOM_DECOR[roomId] || ROOM_DECOR.campfire_grove;
}

// ---------- AUTOCLICKER TIERS ----------
const AUTOCLICKERS = [
    { id: 'win95', name: 'Win95 PC', baseCost: 15, vps: 0.1, desc: 'The beige classic.' },
    { id: 'win98', name: 'Win98 PC', baseCost: 100, vps: 1, desc: 'Crystal clear.' },
    { id: 'imac_g3', name: 'iMac G3', baseCost: 500, vps: 5, desc: 'Bondi blue vibes.' },
    { id: 'xp_pc', name: 'XP Machine', baseCost: 2500, vps: 25, desc: 'Bliss wallpaper.' },
    { id: 'mac_mini', name: 'Mac Mini', baseCost: 12000, vps: 100, desc: 'Small but mighty.' },
    { id: 'gaming_rig', name: 'Gaming Rig', baseCost: 60000, vps: 400, desc: 'RGB = more vibes.' },
    { id: 'rtx_setup', name: 'RTX 5090', baseCost: 300000, vps: 2000, desc: 'Path traced vibes.' },
    { id: 'mac_studio', name: 'Mac Studio', baseCost: 1500000, vps: 10000, desc: 'M4 Ultra dream.' },
    { id: 'server_rack', name: 'Server Rack', baseCost: 8000000, vps: 50000, desc: 'Enterprise grade.' },
    { id: 'dgx_pod', name: 'DGX Pod', baseCost: 40000000, vps: 250000, desc: 'AI supremacy.' },
    { id: 'quantum', name: 'Quantum Core', baseCost: 200000000, vps: 1000000, desc: 'Qubit vibes.' },
    { id: 'satellite', name: 'Satellite Cluster', baseCost: 10000000000, vps: 2500000, desc: 'Orbital compute grid.' },
    { id: 'dyson', name: 'Dyson Sphere', baseCost: 1e12, vps: 5000000, desc: 'Stellar compute.' },
];

// ---- PER-ROOM UNIQUE AUTOCLICKERS ----
// Each room has its own 13 themed upgrades matching the global VPS/cost curve
const ROOM_AUTOCLICKERS = {
  campfire_grove: [
    { id: 'cg_spark', name: 'Spark Tinder', baseCost: 15, vps: 0.1, desc: 'Tiny sparks catch.' },
    { id: 'cg_kindling', name: 'Kindling Pile', baseCost: 100, vps: 1, desc: 'Crackling warmth.' },
    { id: 'cg_campfire', name: 'Campfire', baseCost: 500, vps: 5, desc: 'Dancing flames.' },
    { id: 'cg_bonfire', name: 'Bonfire', baseCost: 2500, vps: 25, desc: 'Roaring blaze.' },
    { id: 'cg_fire_pit', name: 'Fire Pit', baseCost: 12000, vps: 100, desc: 'Ring of stones.' },
    { id: 'cg_watchtower', name: 'Watchtower', baseCost: 60000, vps: 400, desc: 'Wooden sentinel.' },
    { id: 'cg_hunting', name: 'Hunting Lodge', baseCost: 300000, vps: 2000, desc: 'Rugged outpost.' },
    { id: 'cg_forge', name: 'Forge', baseCost: 1500000, vps: 10000, desc: 'Hammer & anvil.' },
    { id: 'cg_log_cabin', name: 'Log Cabin', baseCost: 8000000, vps: 50000, desc: 'Sturdy shelter.' },
    { id: 'cg_sawmill', name: 'Sawmill', baseCost: 40000000, vps: 250000, desc: 'Whirring blade.' },
    { id: 'cg_lumberyard', name: 'Lumber Yard', baseCost: 200000000, vps: 1000000, desc: 'Piles of timber.' },
    { id: 'cg_tree_farm', name: 'Tree Farm', baseCost: 10000000000, vps: 2500000, desc: 'Endless grove.' },
    { id: 'cg_forest_spirit', name: 'Forest Spirit', baseCost: 1e12, vps: 5000000, desc: 'Ancient guardian.' },
  ],
  cyber_den: [
    { id: 'cd_led', name: 'LED Strip', baseCost: 15, vps: 0.1, desc: 'Neon glow.' },
    { id: 'cd_pi', name: 'Raspberry Pi', baseCost: 100, vps: 1, desc: 'Tiny computer.' },
    { id: 'cd_switch', name: 'Network Switch', baseCost: 500, vps: 5, desc: 'Packet routing.' },
    { id: 'cd_gaming_pc', name: 'Gaming PC', baseCost: 2500, vps: 25, desc: 'RGB overload.' },
    { id: 'cd_render', name: 'Render Farm', baseCost: 12000, vps: 100, desc: 'Frame by frame.' },
    { id: 'cd_server', name: 'Server Rack', baseCost: 60000, vps: 400, desc: 'Blinking lights.' },
    { id: 'cd_datacenter', name: 'Data Center', baseCost: 300000, vps: 2000, desc: 'Cooled aisles.' },
    { id: 'cd_super', name: 'Supercomputer', baseCost: 1500000, vps: 10000, desc: 'Petaflops.' },
    { id: 'cd_neural', name: 'Neural Net', baseCost: 8000000, vps: 50000, desc: 'Deep learning.' },
    { id: 'cd_ai_core', name: 'AI Core', baseCost: 40000000, vps: 250000, desc: 'Singularity engine.' },
    { id: 'cd_digital', name: 'Digital Realm', baseCost: 200000000, vps: 1000000, desc: 'Virtual world.' },
    { id: 'cd_cyberspace', name: 'Cyberspace', baseCost: 10000000000, vps: 2500000, desc: 'Net horizon.' },
    { id: 'cd_techno', name: 'Techno God', baseCost: 1e12, vps: 5000000, desc: 'Digital deity.' },
  ],
  zen_garden: [
    { id: 'zg_mat', name: 'Meditation Mat', baseCost: 15, vps: 0.1, desc: 'Find your center.' },
    { id: 'zg_chime', name: 'Wind Chime', baseCost: 100, vps: 1, desc: 'Gentle tones.' },
    { id: 'zg_bamboo', name: 'Bamboo Grove', baseCost: 500, vps: 5, desc: 'Swaying stalks.' },
    { id: 'zg_koi', name: 'Koi Pond', baseCost: 2500, vps: 25, desc: 'Gliding carp.' },
    { id: 'zg_rock', name: 'Rock Garden', baseCost: 12000, vps: 100, desc: 'Raked pebbles.' },
    { id: 'zg_tea', name: 'Tea House', baseCost: 60000, vps: 400, desc: 'Matcha ceremony.' },
    { id: 'zg_temple', name: 'Zen Temple', baseCost: 300000, vps: 2000, desc: 'Wooden pagoda.' },
    { id: 'zg_waterfall', name: 'Waterfall', baseCost: 1500000, vps: 10000, desc: 'Cascading water.' },
    { id: 'zg_cherry', name: 'Cherry Grove', baseCost: 8000000, vps: 50000, desc: 'Blossom showers.' },
    { id: 'zg_hall', name: 'Meditation Hall', baseCost: 40000000, vps: 250000, desc: 'Silent retreat.' },
    { id: 'zg_mind', name: 'Enlightened Mind', baseCost: 200000000, vps: 1000000, desc: 'Inner peace.' },
    { id: 'zg_cosmic', name: 'Cosmic Awareness', baseCost: 10000000000, vps: 2500000, desc: 'Universal oneness.' },
    { id: 'zg_nirvana', name: 'Nirvana', baseCost: 1e12, vps: 5000000, desc: 'Transcendence.' },
  ],
  star_deck: [
    { id: 'sd_chart', name: 'Star Chart', baseCost: 15, vps: 0.1, desc: 'Celestial map.' },
    { id: 'sd_telescope', name: 'Telescope', baseCost: 100, vps: 1, desc: 'Lens focused.' },
    { id: 'sd_observatory', name: 'Observatory', baseCost: 500, vps: 5, desc: 'Dome opening.' },
    { id: 'sd_satellite', name: 'Satellite', baseCost: 2500, vps: 25, desc: 'Orbital relay.' },
    { id: 'sd_station', name: 'Space Station', baseCost: 12000, vps: 100, desc: 'Zero gravity.' },
    { id: 'sd_lunar', name: 'Lunar Base', baseCost: 60000, vps: 400, desc: 'Moon colony.' },
    { id: 'sd_mars', name: 'Mars Colony', baseCost: 300000, vps: 2000, desc: 'Red dust.' },
    { id: 'sd_asteroid', name: 'Asteroid Mine', baseCost: 1500000, vps: 10000, desc: 'Deep core.' },
    { id: 'sd_starforge', name: 'Star Forge', baseCost: 8000000, vps: 50000, desc: 'Stellar furnace.' },
    { id: 'sd_nebula', name: 'Nebula Harvester', baseCost: 40000000, vps: 250000, desc: 'Cosmic dust.' },
    { id: 'sd_blackhole', name: 'Black Hole Core', baseCost: 200000000, vps: 1000000, desc: 'Event horizon.' },
    { id: 'sd_galaxy', name: 'Galaxy Cluster', baseCost: 10000000000, vps: 2500000, desc: 'Supercluster.' },
    { id: 'sd_cosmic_string', name: 'Cosmic String', baseCost: 1e12, vps: 5000000, desc: 'Spacetime thread.' },
  ],
  study_lounge: [
    { id: 'sl_bookmark', name: 'Bookmark', baseCost: 15, vps: 0.1, desc: 'Save your page.' },
    { id: 'sl_lamp', name: 'Reading Lamp', baseCost: 100, vps: 1, desc: 'Warm glow.' },
    { id: 'sl_bookshelf', name: 'Bookshelf', baseCost: 500, vps: 5, desc: 'Tomes lined up.' },
    { id: 'sl_desk', name: 'Study Desk', baseCost: 2500, vps: 25, desc: 'Oak surface.' },
    { id: 'sl_typewriter', name: 'Typewriter', baseCost: 12000, vps: 100, desc: 'Click clack.' },
    { id: 'sl_cart', name: 'Library Cart', baseCost: 60000, vps: 400, desc: 'Rolling shelves.' },
    { id: 'sl_reading', name: 'Reading Room', baseCost: 300000, vps: 2000, desc: 'Quiet haven.' },
    { id: 'sl_archive', name: 'Archive', baseCost: 1500000, vps: 10000, desc: 'Preserved history.' },
    { id: 'sl_grand', name: 'Grand Library', baseCost: 8000000, vps: 50000, desc: 'Endless aisles.' },
    { id: 'sl_vault', name: 'Knowledge Vault', baseCost: 40000000, vps: 250000, desc: 'Secret wisdom.' },
    { id: 'sl_tome', name: 'Ancient Tome', baseCost: 200000000, vps: 1000000, desc: 'Forgotten lore.' },
    { id: 'sl_well', name: 'Wisdom Well', baseCost: 10000000000, vps: 2500000, desc: 'Deep knowledge.' },
    { id: 'sl_omni', name: 'Omniscience', baseCost: 1e12, vps: 5000000, desc: 'All knowing.' },
  ],
  beach_cove: [
    { id: 'bc_castle', name: 'Sand Castle', baseCost: 15, vps: 0.1, desc: 'Moat & towers.' },
    { id: 'bc_shell', name: 'Seashell', baseCost: 100, vps: 1, desc: 'Ocean echo.' },
    { id: 'bc_towel', name: 'Beach Towel', baseCost: 500, vps: 5, desc: 'Striped fabric.' },
    { id: 'bc_surfboard', name: 'Surfboard', baseCost: 2500, vps: 25, desc: 'Catching waves.' },
    { id: 'bc_tiki', name: 'Tiki Torch', baseCost: 12000, vps: 100, desc: 'Flaming bamboo.' },
    { id: 'bc_sailboat', name: 'Sailboat', baseCost: 60000, vps: 400, desc: 'White sails.' },
    { id: 'bc_lighthouse', name: 'Lighthouse', baseCost: 300000, vps: 2000, desc: 'Guiding beam.' },
    { id: 'bc_pier', name: 'Pier', baseCost: 1500000, vps: 10000, desc: 'Extending dock.' },
    { id: 'bc_resort', name: 'Resort', baseCost: 8000000, vps: 50000, desc: 'Poolside cabana.' },
    { id: 'bc_cruise', name: 'Cruise Ship', baseCost: 40000000, vps: 250000, desc: 'Luxury liner.' },
    { id: 'bc_underwater', name: 'Underwater City', baseCost: 200000000, vps: 1000000, desc: 'Dome habitats.' },
    { id: 'bc_reef', name: 'Coral Reef', baseCost: 10000000000, vps: 2500000, desc: 'Vibrant ecosystem.' },
    { id: 'bc_ocean_spirit', name: 'Ocean Spirit', baseCost: 1e12, vps: 5000000, desc: 'Tidal force.' },
  ],
};

// ---------- PRESTIGE UPGRADES (permanent, bought with prestige chips) ----------
const PRESTIGE_UPGRADES = [
    // Gateway buff stack — progressive (each purchase adds value to gw multiplier)
    { id: 'gw_boost_1', name: '⚡ Latency Amp',     baseCost: 20,  costMult: 2, desc: 'Gateway buff +0.5×',   type: 'gw_add',   value: 0.5 },
    { id: 'gw_boost_2', name: '⚡ Pipeline Opt',     baseCost: 50,  costMult: 2, desc: 'Gateway buff +1.0×',   type: 'gw_add',   value: 1.0 },
    { id: 'gw_boost_3', name: '⚡ Quantum Pipe',     baseCost: 125, costMult: 2, desc: 'Gateway buff +2.0×',   type: 'gw_add',   value: 2.0 },
    { id: 'gw_boost_4', name: '⚡ Neural Bridge',    baseCost: 250, costMult: 2, desc: 'Gateway buff +3.0×',   type: 'gw_add',   value: 3.0 },
    { id: 'gw_boost_5', name: '⚡ Singularity Link', baseCost: 500, costMult: 2, desc: 'Gateway buff +5.0×',   type: 'gw_add',   value: 5.0 },
    // Click multipliers — progressive (each purchase multiplies click by value)
    { id: 'click_1',    name: '👆 Click Amplifier',  baseCost: 3,  costMult: 2, desc: 'Click power ×2',       type: 'click_mult', value: 2 },
    { id: 'click_2',    name: '👆 Turbo Click',      baseCost: 10, costMult: 2, desc: 'Click power ×4',       type: 'click_mult', value: 4 },
    { id: 'click_3',    name: '👆 Godlike Click',    baseCost: 25, costMult: 2, desc: 'Click power ×10',      type: 'click_mult', value: 10 },
    // Base VPS — progressive (each purchase adds flat VPS, multiplied by all multipliers)
    { id: 'autobuy_1',  name: '🏭 Auto Clicker',     baseCost: 5,  costMult: 2, desc: '+100 base VPS',        type: 'base_vps',  value: 100 },
    { id: 'autobuy_2',  name: '🏭 Micro Miner',      baseCost: 15, costMult: 2, desc: '+1K base VPS',         type: 'base_vps',  value: 1000 },
    { id: 'autobuy_3',  name: '🏭 Turbo Node',       baseCost: 40, costMult: 2, desc: '+10K base VPS',        type: 'base_vps',  value: 10000 },
    // Permanent VPS multiplier — progressive, expensive (each purchase doubles VPS)
    { id: 'perma_mult', name: '💠 Perma Core',       baseCost: 200, costMult: 3, desc: 'Permanent ×2 VPS',    type: 'perma_mult', value: 2 },
    // Offline earnings — each purchase adds +1% offline rate
    { id: 'offline_amp', name: '💤 Offline Amp',       baseCost: 50,  costMult: 2, desc: 'Offline earn +1%',    type: 'offline_pct', value: 1 },
];

// ---------- TRANSCEND UPGRADES (deeper prestige layer) ----------
const TRANSCEND_THRESHOLD = 3; // Need 3+ total prestiges
const TRANSCEND_UPGRADES = [
    { id: 'trans_click',   name: 'Transcended Click', cost: 1,  desc: '×10 click power permanently',     type: 'trans_click',    value: 10 },
    { id: 'trans_vps',     name: 'Transcended VPS',   cost: 2,  desc: '×5 VPS permanently',               type: 'trans_vps',      value: 5 },
    { id: 'trans_autoclick',name: 'Eternal Workers',  cost: 3,  desc: 'Start with +50 of each autoclicker', type: 'trans_autobuy',  value: 50 },
    { id: 'trans_rooms',   name: 'Instant Access',    cost: 5,  desc: 'All rooms unlocked from start',    type: 'trans_rooms',    value: 1 },
    { id: 'trans_master',  name: 'Master Key',        cost: 10, desc: 'Free prestige unlock each run',     type: 'trans_master',   value: 1 },
];

// ---------- TIERS (prestige-based permanent upgrades) ----------
// 500 hard-coded tiers: 1 → InfZ^∞, each with a unique prestige requirement
const TIER_REQS = [1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20,22,23,24,25,26,28,29,30,31,33,34,35,37,38,39,41,42,44,45,47,48,50,51,53,55,56,58,60,62,64,66,68,70,72,74,77,79,82,84,87,90,92,95,99,102,105,109,112,116,120,124,129,133,138,143,148,154,159,165,172,178,185,193,200,209,217,226,236,246,256,267,279,291,304,318,333,348,364,381,399,419,439,460,483,507,532,559,587,617,648,682,717,755,794,836,881,928,977,1030,1086,1145,1208,1274,1344,1419,1497,1581,1669,1763,1862,1967,2078,2196,2321,2454,2594,2742,2900,3067,3244,3431,3629,3840,4063,4299,4550,4815,5096,5394,5710,6045,6399,6775,7174,7596,8044,8518,9021,9554,10119,10718,11352,12025,12738,13493,14294,15143,16043,16996,18007,19078,20214,21418,22694,24046,25479,26999,28609,30316,32126,34043,36076,38231,40515,42936,45502,48223,51106,54162,57402,60835,64475,68333,72423,76758,81353,86223,91386,96858,102659,108808,115325,122234,129557,137319,145547,154269,163514,173313,183701,194711,206382,218754,231867,245768,260502,276120,292676,310224,328826,348543,369444,391598,415082,439975,466361,494330,523977,555403,588715,624025,661454,701129,743183,787762,835014,885102,938195,994474,1054129,1117364,1184392,1255442,1330755,1410587,1495209,1584908,1679989,1780774,1887607,2000849,[2.1275,8],[2.1275,9],[2.1275,10],[2.1275,11],[2.1275,12],[2.1275,13],[2.1275,14],[2.1275,15],[2.1275,16],[2.1275,17],[2.1275,18],[2.1275,19],[2.1275,20],[2.1275,21],[2.1275,22],[2.1275,23],[2.1275,24],[2.1275,25],[2.1275,26],[2.1275,27],[2.1275,28],[2.1275,29],[2.1275,30],[2.1275,31],[2.1275,32],[2.1275,33],[2.1275,34],[2.1275,35],[2.1275,36],[2.1275,37],[2.1275,38],[2.1275,39],[2.1275,40],[2.1275,41],[2.1275,42],[2.1275,43],[2.1275,44],[2.1275,45],[2.1275,46],[2.1275,47],[2.1275,48],[2.1275,49],[2.1275,50],[2.1275,51],[2.1275,52],[2.1275,53],[2.1275,54],[2.1275,55],[2.1275,56],[2.1275,57],[2.1275,58],[2.1275,59],[2.1275,60],[2.1275,61],[2.1275,62],[2.1275,63],[2.1275,64],[2.1275,65],[2.1275,66],[2.1275,67],[2.1275,68],[2.1275,69],[2.1275,70],[2.1275,71],[2.1275,72],[2.1275,73],[2.1275,74],[2.1275,75],[2.1275,76],[2.1275,77],[2.1275,78],[2.1275,79],[2.1275,80],[2.1275,81],[2.1275,82],[2.1275,83],[2.1275,84],[2.1275,85],[2.1275,86],[2.1275,87],[2.1275,88],[2.1275,89],[2.1275,90],[2.1275,91],[2.1275,92],[2.1275,93],[2.1275,94],[2.1275,95],[2.1275,96],[2.1275,97],[2.1275,98],[2.1275,99],[2.1275,100],[2.1275,101],[2.1275,102],[2.1275,103],[2.1275,104],[2.1275,105],[2.1275,106],[2.1275,107],[2.1275,109],[2.1275,111],[2.1275,113],[2.1275,115],[2.1275,117],[2.1275,119],[2.1275,121],[2.1275,123],[2.1275,125],[2.1275,127],[2.1275,129],[2.1275,131],[2.1275,133],[2.1275,135],[2.1275,137],[2.1275,139],[2.1275,141],[2.1275,143],[2.1275,145],[2.1275,147],[2.1275,149],[2.1275,151],[2.1275,153],[2.1275,155],[2.1275,157],[2.1275,159],[2.1275,161],[2.1275,163],[2.1275,165],[2.1275,167],[2.1275,169],[2.1275,171],[2.1275,173],[2.1275,175],[2.1275,177],[2.1275,179],[2.1275,181],[2.1275,183],[2.1275,185],[2.1275,187],[2.1275,189],[2.1275,191],[2.1275,193],[2.1275,195],[2.1275,197],[2.1275,199],[2.1275,201],[2.1275,203],[2.1275,205],[2.1275,207],[2.1275,210],[2.1275,213],[2.1275,216],[2.1275,219],[2.1275,222],[2.1275,225],[2.1275,228],[2.1275,231],[2.1275,234],[2.1275,237],[2.1275,241],[2.1275,245],[2.1275,249],[2.1275,253],[2.1275,257],[2.1275,261],[2.1275,265],[2.1275,269],[2.1275,273],[2.1275,277],[2.1275,282],[2.1275,287],[2.1275,292],[2.1275,297],[2.1275,302],[2.1275,307],[2.1275,312],[2.1275,317],[2.1275,322],[2.1275,327],[2.1275,333],[2.1275,339],[2.1275,345],[2.1275,351],[2.1275,357],[2.1275,363],[2.1275,369],[2.1275,375],[2.1275,381],[2.1275,387],[2.1275,394],[2.1275,401],[2.1275,408],[2.1275,415],[2.1275,422],[2.1275,429],[2.1275,436],[2.1275,443],[2.1275,450],[2.1275,457],[2.1275,477],[2.1275,497],[2.1275,517],[2.1275,542],[2.1275,567],[2.1275,592],[2.1275,622],[2.1275,652],[2.1275,682],[2.1275,717],[2.1275,752],[2.1275,787],[2.1275,827],[2.1275,867],[2.1275,907],[2.1275,952],[2.1275,997],[2.1275,1042],[2.1275,1092],[2.1275,1142],[2.1275,1192],[2.1275,1247],[2.1275,1302],[2.1275,1357],[2.1275,1417],[2.1275,1477],[2.1275,1537],[2.1275,1602],[2.1275,1667],[2.1275,1732],[2.1275,2237],[2.1275,2762],[2.1275,3387],[2.1275,4512],[2.1275,8137],[2.1275,24262],[2.1275,102887],[2.1275,494012],[2.1275,2447637],[2.1275,12213762],[2.1275,61042387],[2.1275,305183512],[2.1275,1525887137],[2.1275,7629403262],[2.1275,38146981887],[2.1275,190734873012],[2.1275,953674326637],[2.1275,4768371592762],[2.1275,23841857921387],[2.1275,119209289562512]];
const TIERS = (function() {
    const tiers = [];
    const types = ['click', 'vps', 'offline', 'all', 'click', 'vps', 'rooms'];
    // Shape words to strip from icon filenames
    const SHAPE_WORDS = new Set(['Shield','Circle','Banner','Freeform','Diamond','Crystal','Wreath','Winged','Hexagon','Star','Nature']);
    // Manual name overrides for all tiers (replacing auto-generated names)
    const TIER_NAME_OVERRIDES = {
    1: 'Crossed Axes',
    2: "Pioneer's Standard",
    3: 'Oakwood Sentinel',
    4: "Woodcutter's Mark",
    5: 'Earthspire',
    6: "Titan's Shield",
    7: 'Mossy Medallion',
    8: 'Mossy Globe',
    9: 'Petrified Leaf',
    10: 'Stone Well',
    11: 'Stone Eden',
    12: 'Bound Earth',
    13: 'Twilight Stone',
    14: 'Void Stone',
    15: 'Lunar Summit',
    16: 'Nebula Stone',
    17: 'Ancient Target',
    18: "Titan's Burden",
    19: 'Ancient Seal',
    20: 'Stone Titan',
    21: 'Stone Golem',
    22: 'Elder Golem',
    23: 'Shadow Spire',
    24: 'Rustborn Sigil',
    25: "Anchor's Mark",
    26: 'Bronze Medal',
    27: 'Winged Boots',
    28: 'Spear Crest',
    29: 'Seedling Shield',
    30: 'Lantern Keeper',
    31: 'Earthborn Shield',
    32: "Ironwright's Seal",
    33: 'Forge Circle',
    34: 'Mountain Chronos',
    35: 'Bronze Peak',
    36: 'Cosmic Ember',
    37: 'Bronze Dawn',
    38: "Scholar's Wreath",
    39: 'Bronze Bull',
    40: 'Ember Beast',
    41: 'Meteor Tracker',
    42: 'Bell of Dawn',
    43: 'Bronze Clockwork',
    44: 'Chalice of Embers',
    45: 'Clockwork Seal',
    46: 'Clockwork Golem',
    47: 'Ragebeast',
    48: 'Ember Nugget',
    49: 'Antler Gem',
    50: 'Iron Bulwark',
    51: 'Cragspire',
    52: 'Stallion Shield',
    53: 'Blade Cross',
    54: 'War Banner',
    55: 'Iron Inferno',
    56: 'Stormwall',
    57: 'Stormbreaker',
    58: 'Thunderstrike',
    59: 'Thundermark',
    60: "Forgemaster's Mark",
    61: 'Granite Fang',
    62: 'Zephyr Guard',
    63: 'Galewall',
    64: 'Iron Vortex',
    65: 'Thundercloud',
    66: 'Ironstorm',
    67: 'Iron Zephyr',
    68: 'Iron Meteor',
    69: 'Iron Cosmos',
    70: 'Starfall Guard',
    71: 'Iron Crescent',
    72: 'Moon Marble',
    73: 'Iron Comet',
    74: 'Iron Cosmos Hex',
    75: 'Worldbearer',
    76: 'Runic Ward',
    77: 'Fractured Bell',
    78: 'Iron Serpent',
    79: 'Bell Tower',
    80: 'Boundless Storm',
    81: 'Iron Compass',
    82: 'Iron Wolf',
    83: 'Iron Nucleus',
    84: 'Targeting Reticle',
    85: 'Iron Bastion',
    86: 'Steel Epoch',
    87: 'Iron Skull',
    88: 'Darkstone Guard',
    89: "Duelist's Pact",
    90: 'Silverwind Crest',
    91: 'Silver Knight',
    92: 'Silver Herald',
    93: 'Clockwright',
    94: 'Mistral Hex',
    95: 'Void Maelstrom',
    96: 'Silver Compass',
    97: 'Silver Mask',
    98: 'Frost Drake',
    99: 'Silver Specter',
    100: 'Ashfeather',
    101: 'Iron Sentinel',
    102: 'Key of Secrets',
    103: 'Silver Crown',
    104: 'Silver Scale',
    105: 'Mirror Scale',
    106: 'Silver Shard',
    107: 'Gilded Shield',
    108: 'Gilded Star',
    109: 'Star of Honor',
    110: 'Gilded Target',
    111: 'Gilded Crest',
    112: 'Eagle Standard',
    113: 'Gold Standard',
    114: 'Gilded Sakura',
    115: 'Verdant Glory',
    116: 'Lotus of Gold',
    117: 'Aureate Canopy',
    118: 'Bolt of Zeus',
    119: 'Aureate Cog',
    120: 'Goldenspire',
    121: 'Celestial Harbor',
    122: 'Solar Tempest',
    123: "Lion's Sun",
    124: 'Sundisc',
    125: 'Solar Spiral',
    126: 'Radiant Aureole',
    127: 'Solaris Crown',
    128: 'Solar Flare',
    129: 'Golden Flare',
    130: 'Solstice Star',
    131: 'Starfire',
    132: 'Golden Epoch',
    133: 'Apex Star',
    134: 'Gilded Galaxy',
    135: 'Solar Wreath',
    136: 'Auric Wing',
    137: 'Solar Vanguard',
    138: "Heaven's Gate",
    139: "Heaven's Vanguard",
    140: 'Gilded Ascension',
    141: 'Eagle of Gold',
    142: 'Gilded Compass',
    143: 'Celestial Navigator',
    144: 'Dharma Wheel',
    145: 'Eternity Knot',
    146: 'All-Seeing Eye',
    147: 'Infinity Forge',
    148: "Wayfarer's Star",
    149: 'Labyrinth Star',
    150: 'Solar Mandala',
    151: 'Eternal Gold',
    152: 'Aureate Infinity',
    153: 'Aureate Griffin',
    154: 'Lionheart',
    155: 'Mane of Gold',
    156: 'Golden Griffin',
    157: 'Gilded Eagle',
    158: 'Scarab Ascendant',
    159: 'Golden Core',
    160: 'Gilded Cog',
    161: 'Gilded Throne',
    162: 'Harp of Gold',
    163: 'Scale of Justice',
    164: 'Sunburst Crown',
    165: 'Regal Throne',
    166: 'Jeweled Crown',
    167: 'Blood Crown',
    168: 'Royal Decree',
    169: 'Chalice of Blood',
    170: 'Amethyst Crown',
    171: 'Royal Scarab',
    172: 'Clockwork Eternity',
    173: 'Time Flow',
    174: 'Coiled Epoch',
    175: 'Infinite Hour',
    176: 'Gilded Hour',
    177: 'Timeless Wing',
    178: "Guardian's Hour",
    179: 'Topaz Circle',
    180: 'Gilded Knot',
    181: 'Topaz Wreath',
    182: 'Gilded Topaz',
    183: 'Ivory Crusade',
    184: 'Ivory Shell',
    185: 'Ashen Whisper',
    186: 'Pearl Wave',
    187: 'Opal Wave',
    188: 'Opal Tide',
    189: 'Silver Thunderstar',
    190: 'Silver Peak',
    191: 'Ivory Vortex',
    192: 'Ivory Cloud',
    193: 'Eternal Eclipse',
    194: 'The Corona',
    195: 'Moonfield',
    196: 'Platinum Eclipse',
    197: 'Supernova',
    198: 'Platinum Meridian',
    199: 'Lunar Wreath',
    200: 'Silver Galaxy',
    201: 'Platinum Veil',
    202: 'Eclipse Duality',
    203: 'Holy Radiance',
    204: 'Luminous Vanguard',
    205: 'Compass of Stars',
    206: 'Ascension',
    207: 'Unicorn Shield',
    208: 'Platinum Angel',
    209: 'Platinum Mind',
    210: 'Ivory Gate',
    211: 'Temple Pillars',
    212: 'Opal Wing',
    213: 'Frostbloom',
    214: 'Crystalline Guard',
    215: 'Glacial Bloom',
    216: 'Prismatic Jewel',
    217: 'Diamond Splinter',
    218: 'Prismatic Diamond',
    219: 'Starwing Crest',
    220: 'Sapphire Crusader',
    221: 'Silver Current',
    222: 'Stormwave',
    223: 'Fountain Gem',
    224: 'Tidal Diamond',
    225: 'Azure Whirlpool',
    226: 'Tidal Duality',
    227: 'Tide Oracle',
    228: 'Tidal Wing',
    229: 'Tideleaf',
    230: 'Cloudveil',
    231: 'Stormcrystal',
    232: 'Stormfang',
    233: 'Frozen Tundra',
    234: 'Ice Mountain',
    235: 'Tundra Fortress',
    236: 'Wind Raptor',
    237: 'Starshield',
    238: 'Azure Firmament',
    239: 'Frost Nova',
    240: 'Astral Compass',
    241: 'Starfield Compass',
    242: 'Sapphire Comet',
    243: 'Starbloom Wreath',
    244: 'Azure Galaxy',
    245: 'Sapphire Ascension',
    246: 'Tidal Mandala',
    247: 'Twin Tide',
    248: 'Azure Specter',
    249: 'Sapphire Tome',
    250: 'Azure Eagle',
    251: 'Azure Leviathan',
    252: 'Tempest Drake',
    253: 'Sea Serpent',
    254: 'Spectrum Atom',
    255: 'Orbit Station',
    256: 'Sapphire Circuit',
    257: 'Orbital Lens',
    258: 'Castle Sigil',
    259: 'Sapphire Kite',
    260: 'Pearl Tide',
    261: 'Sapphire Edge',
    262: 'Azure Gem',
    263: 'Amethyst Fang',
    264: 'Azure Splinter',
    265: 'Starfall Shard',
    266: 'Sapphire Fang',
    267: 'Azure Prism',
    268: 'Deep Sapphire',
    269: 'Deep Sapphire Shard',
    270: 'Azure Relic',
    271: 'Sapphire Wing',
    272: 'Cloud Diamond',
    273: 'Teardrop Gem',
    274: 'Frosthelm',
    275: 'Frost Feather',
    276: 'Glacial Bastion',
    277: 'Glacial Guard',
    278: 'Tundra Ward',
    279: 'Tidal Shield',
    280: 'Arctic Star',
    281: 'Frozen Tide',
    282: 'Frozen Crest',
    283: "Tidecaller's Drop",
    284: 'Glacial Stream',
    285: 'Arctic Flow',
    286: 'Cryo Current',
    287: 'Frostbolt Shield',
    288: 'Frostbolt',
    289: "Glacier's Edge",
    290: 'Glacier Shield',
    291: 'Frozen Summit',
    292: 'Glacial Peak',
    293: 'Frozen Feather',
    294: 'Tempest Wing',
    295: 'Arctic Nova',
    296: 'Stardrift Shard',
    297: 'Frozen Comet',
    298: 'Polar Compass',
    299: 'Rime Wraith',
    300: 'Frost Bloom',
    301: 'Frozen Compass',
    302: 'Polar Diamond',
    303: 'Frozen Eye',
    304: 'Arcane Frost',
    305: 'Frost Wraith',
    306: 'Frozen Pulse',
    307: 'Echo Chamber',
    308: 'Frost Atom',
    309: 'Neural Circuit',
    310: 'Teal Matrix',
    311: 'Crystal Mind',
    312: 'Glacial Ward',
    313: 'Crystal Shard',
    314: 'Ice Matrix',
    315: 'Glacial Hex',
    316: 'Frozen Prism',
    317: 'Aether Cube',
    318: 'Azure Shard',
    319: 'Glacial Prism',
    320: 'Rime Crystal',
    321: 'Cryo Crystal',
    322: 'Snowfield Shard',
    323: 'Verdant Smithy',
    324: 'World Tree',
    325: 'Pine Sentinel',
    326: 'Green Sentinel',
    327: 'Clover Burst',
    328: 'Grove Mandala',
    329: 'Spirit Tree',
    330: 'Living Circuit',
    331: 'Emerald Mandala',
    332: 'Evergreen Wave',
    333: 'Thornweave',
    334: 'Heartwood Knot',
    335: 'Pineleaf Shard',
    336: 'Jade Swirl',
    337: 'Jade Wreath',
    338: 'Verdant Sprout',
    339: 'Deep Kelp',
    340: 'Timeless Grove',
    341: 'Jungle Spray',
    342: 'Fern Spiral',
    343: 'Root Network',
    344: 'Coral Branch',
    345: 'Verdant Flame',
    346: 'Forest Quill',
    347: 'Four-Leaf Clover',
    348: 'Seaweed Guard',
    349: 'Jade Maelstrom',
    350: 'Frozen Grove',
    351: 'Jade Duality',
    352: 'Jade Current',
    353: 'Emerald Forge',
    354: 'Evergreen Spire',
    355: 'Verdant Gale',
    356: 'Zen Garden',
    357: 'Serpent Glyph',
    358: "Serpent's Ring",
    359: 'Jade Dragon',
    360: 'Ouroboros',
    361: 'Dragon Eye',
    362: 'Cipher Code',
    363: 'Emerald Code',
    364: 'Helix Strand',
    365: 'Emerald Cut',
    366: 'Verdant Crest',
    367: 'Emerald Clasp',
    368: 'Emerald Wing',
    369: 'Jade Stone',
    370: 'Crimson Rose',
    371: 'Crimson Banner',
    372: 'Rose Medallion',
    373: 'Crimson Petal',
    374: 'Eternal Blaze',
    375: 'Blazeheart',
    376: 'Hellfire Core',
    377: 'Volcanic Shard',
    378: 'Inferno Burst',
    379: 'Crimson Oracle',
    380: 'Crimson Abyss',
    381: 'Eternal Ember',
    382: 'Phoenix Rising',
    383: 'Inferno Phoenix',
    384: 'Vermillion Phoenix',
    385: 'Atomic Core',
    386: 'Laser Eye',
    387: 'Crimson Target',
    388: "Spider's Web",
    389: 'Ruby Orbit',
    390: 'Ember Shard',
    391: 'Carnelian Fang',
    392: 'Ruby Heart',
    393: 'Enchanted Vine',
    394: 'Violet Wreath',
    395: 'Dark Flame Wing',
    396: 'Stormhex',
    397: 'Phantom Core',
    398: 'Starlit Aegis',
    399: 'Void Orbit',
    400: 'Cosmic Orb',
    401: 'Midnight Sigil',
    402: 'Void Portal',
    403: 'Purple Nebula',
    404: 'Dark Star',
    405: 'Northern Light',
    406: 'Moonfall Crest',
    407: 'Void Wing',
    408: 'Moonrise Wing',
    409: 'Eclipse Wing',
    410: 'Void Crest',
    411: 'Moonveil',
    412: 'Starfall Wing',
    413: 'Twilight Duality',
    414: 'Arcane Weave',
    415: 'Sacred Mandala',
    416: 'Null Sphere',
    417: 'Arcane Void',
    418: 'Arcane Eternity',
    419: 'Arcane Wing',
    420: 'Omega Void',
    421: 'Wraith Bloom',
    422: 'Void Drake',
    423: 'Void Serpent',
    424: 'Mystic Colossus',
    425: 'Echo Shield',
    426: 'Resonance Field',
    427: 'Dark Matter',
    428: 'Void Frequency',
    429: 'Voidvision',
    430: 'Arcane Crown',
    431: 'Timewarp',
    432: 'Twilight Hourglass',
    433: 'Violet Bastion',
    434: 'Amethyst Guard',
    435: 'Violet Geode',
    436: 'Amethyst Kite',
    437: 'Arcane Gem',
    438: 'Void Splinter',
    439: 'Violet Prism',
    440: 'Void Star',
    441: 'Violet Bloom',
    442: 'Violet Crown',
    443: 'Violet Gem Wing',
    444: 'Crystal Coven',
    445: 'Violet Wisp',
    446: 'Blossom Mandala',
    447: 'Spiral Shell',
    448: 'Petal Mandala',
    449: 'Coral Summit',
    450: 'Rosedawn Bloom',
    451: 'Coral Shell',
    452: 'Blush Shell',
    453: 'Pink Reef',
    454: 'Petal Crest',
    455: 'Pink Lotus',
    456: 'Blushing Phoenix',
    457: 'Coral Tide',
    458: 'Eternal Return',
    459: 'Mindfire',
    460: 'Rose Quartz',
    461: 'Obsidian Blade',
    462: 'Infernal Ward',
    463: 'Magmarift',
    464: 'Dark Phoenix',
    465: 'Shadow Peak',
    466: 'Event Horizon',
    467: 'All-Seeing Triangle',
    468: 'Phantom Shroud',
    469: 'Death Mask',
    470: 'Horned Skull',
    471: 'Stone Face',
    472: 'Skull Seal',
    473: "Death's Crest",
    474: 'Void Crypt',
    475: 'Shadow Veil',
    476: 'Dark Thorn',
    477: 'Obsidian Fang',
    478: 'Honeycomb',
    479: 'Ashborn Bastion',
    480: 'Flameguard',
    481: 'Pyre Circle',
    482: 'Forge Wing',
    483: 'Thunder Shield',
    484: 'Solar Eclipse',
    485: 'Amber Starburst',
    486: 'Ember Star',
    487: 'Amber Comet',
    488: 'Sunray Star',
    489: 'Citrine Star',
    490: 'Citrine Burst',
    491: 'Blazing Ascent',
    492: 'Amber Resonance',
    493: 'Scorched Crown',
    494: 'Ember Cube',
    495: "Eden's Arc",
    496: 'Prismatic Compass',
    497: 'Prism Dunes',
    498: 'Prism Moon',
    499: 'Prism Nexus',
    500: 'Chromatic Vault',
    };
    // Cool name suffixes cycled for variety
    const SUFFIXES = ['', ' Sigil', ' Crest', ' Mark', ' Glyph', ' Seal', ' Brand', ' Ward', ' Mantle', ' Aura'];
    // Derived name templates — pick one per (material, style) pair via hash
    const TYPES = ['', ' of the ', "'s ", ' ', ' Crest of ', ' Mark of '];
    function makeTierName(iconFile, idx) {
        const tn = idx + 1;
        if (TIER_NAME_OVERRIDES[tn]) return TIER_NAME_OVERRIDES[tn];
        const parts = iconFile.split('_');
        // parts[0] = number, parts[-1] = origXXX, middle = material, style, shape
        const filtered = parts.slice(1, -1).filter(p => !SHAPE_WORDS.has(p));
        if (filtered.length === 0) return 'Tier ' + (idx + 1);
        if (filtered.length === 1) return filtered[0] + (SUFFIXES[idx % SUFFIXES.length] || '');
        const material = filtered[0];
        const style = filtered[1];
        // Pick a deterministic template based on the pair's combined char codes
        const hash = (material.charCodeAt(0) * 31 + style.charCodeAt(0) * 7 + idx) % 8;
        // Build cool-sounding names
        switch (hash) {
            case 0: return style + ' ' + material;                    // "Celestial Stone"
            case 1: return material + "'s " + style;                  // "Stone's Celestial"
            case 2: return style + ' of the ' + material;             // "Herald of the Wood"
            case 3: return style + material + SUFFIXES[idx % SUFFIXES.length];  // "CelestialStone Glyph"
            case 4: return material + ' ' + style + ' Sigil';         // "Stone Celestial Sigil"
            case 5: return 'The ' + style + ' ' + material;           // "The Celestial Stone"
            case 6: return style + 'bound ' + material;               // "Celestialbound Stone"
            case 7: return material + 'ward ' + style;                // "Stonward Celestial"
            default: return style + ' ' + material;
        }
    }
    for (let i = 0; i < 500; i++) {
        const tierNum = i + 1;
        const raw = TIER_REQS[i];
        const requiresBN = Array.isArray(raw) ? BN(raw[0], raw[1]) : bnFromNumber(raw);
        const type = types[i % types.length];
        const iconFile = typeof TIER_ICON_FILES !== 'undefined' && TIER_ICON_FILES[i] ? TIER_ICON_FILES[i] : '';
        const name = iconFile ? makeTierName(iconFile, i) : ('Tier ' + tierNum);
        const multFactor = Math.round(Math.max(1, Math.floor(tierNum / 5) + 1) * 0.35);
        let bonus, value;
        switch (type) {
            case 'click': value = Math.max(1, multFactor); bonus = '×' + value + ' click power'; break;
            case 'vps': value = Math.max(1, multFactor); bonus = '×' + value + ' VPS'; break;
            case 'offline': value = Math.min(Math.max(1, multFactor), 1000); bonus = '+' + value + '% offline'; break;
            case 'all': value = Math.max(1, multFactor); bonus = '×' + value + ' all'; break;
            case 'rooms': value = 1; bonus = 'Unlock rooms faster'; break;
            default: value = 1; bonus = '×' + value; break;
        }
        tiers.push({ id: 'tier_' + tierNum, name, requires: requiresBN, bonus, type, value });
    }
    return tiers;
})();
function getCurrentTier(state = G) {
    let tierIdx = -1;
    for (let i = 0; i < TIERS.length; i++) {
        if (bnGe(state.total_prestiges, TIERS[i].requires)) tierIdx = i;
    }
    return tierIdx;
}

function getCurrentTierName(state = G) {
    const idx = getCurrentTier(state);
    if (idx < 0) return '—';
    return TIERS[idx].name;
}

function getTierFromPrestige(count) {
    let tierIdx = -1;
    for (let i = 0; i < TIERS.length; i++) {
        if (bnGe(count, TIERS[i].requires)) tierIdx = i;
    }
    return tierIdx;
}

// ---------- ACHIEVEMENTS ----------
const ACHIEVEMENTS = [
    // Vibe milestones
    { id: 'vibe_1k',      name: 'Getting Started',    desc: 'Earn 1K total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_1k.webp',         icon: '⭐', threshold: { type: 'lifetime', value: 1_000 } },
    { id: 'vibe_10k',     name: 'Five Figures',       desc: 'Earn 10K total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_10k.webp',        icon: '🔸', threshold: { type: 'lifetime', value: 10_000 } },
    { id: 'vibe_100k',    name: 'Six Figures',        desc: 'Earn 100K total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_100k.webp',       icon: '🔶', threshold: { type: 'lifetime', value: 100_000 } },
    { id: 'vibe_1m',      name: 'Vibe Millionaire',   desc: 'Earn 1M total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_1m.webp',         icon: '🌟', threshold: { type: 'lifetime', value: 1_000_000 } },
    { id: 'vibe_10m',     name: 'Deca-Million',       desc: 'Earn 10M total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_10m.webp',        icon: '💫', threshold: { type: 'lifetime', value: 10_000_000 } },
    { id: 'vibe_100m',    name: 'Hecto-Million',      desc: 'Earn 100M total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_100m.webp',       icon: '✨', threshold: { type: 'lifetime', value: 100_000_000 } },
    { id: 'vibe_1b',      name: 'Billion Vibes',      desc: 'Earn 1B total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_1b.webp',         icon: '💎', threshold: { type: 'lifetime', value: 1_000_000_000 } },
    { id: 'vibe_10b',     name: 'Ten Billion Club',   desc: 'Earn 10B total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_10b.webp',        icon: '🔮', threshold: { type: 'lifetime', value: 10_000_000_000 } },
    { id: 'vibe_100b',    name: 'Hundred Billion',    desc: 'Earn 100B total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_100b.webp',       icon: '🌠', threshold: { type: 'lifetime', value: 100_000_000_000 } },
    { id: 'vibe_1t',      name: 'Trillionaire',       desc: 'Earn 1T total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_1t.webp',         icon: '👑', threshold: { type: 'lifetime', value: 1_000_000_000_000 } },
    { id: 'vibe_10t',     name: 'Ten Trillion',       desc: 'Earn 10T total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_10t.webp',        icon: '🎯', threshold: { type: 'lifetime', value: 10_000_000_000_000 } },
    { id: 'vibe_100t',    name: 'Quad Vibes',         desc: 'Earn 100T total vibes', icon_img: 'sprites/images/icons/32/ach_vibe_100t.webp',       icon: '🪐', threshold: { type: 'lifetime', value: 100_000_000_000_000 } },
    // Click milestones
    { id: 'click_50',     name: 'First Clicks',       desc: 'Click 50 times', icon_img: 'sprites/images/icons/32/ach_click_50.webp',              icon: '☝️', threshold: { type: 'clicks', value: 50 } },
    { id: 'click_100',    name: 'Finger Exercise',    desc: 'Click 100 times', icon_img: 'sprites/images/icons/32/ach_click_100.webp',             icon: '👆', threshold: { type: 'clicks', value: 100 } },
    { id: 'click_500',    name: 'Getting Rhythm',     desc: 'Click 500 times', icon_img: 'sprites/images/icons/32/ach_click_500.webp',             icon: '🎵', threshold: { type: 'clicks', value: 500 } },
    { id: 'click_1k',     name: 'Clickathon',         desc: 'Click 1,000 times', icon_img: 'sprites/images/icons/32/ach_click_1k.webp',           icon: '🎪', threshold: { type: 'clicks', value: 1_000 } },
    { id: 'click_10k',    name: 'Carpal Tunnel',      desc: 'Click 10,000 times', icon_img: 'sprites/images/icons/32/ach_click_10k.webp',          icon: '🖱️', threshold: { type: 'clicks', value: 10_000 } },
    { id: 'click_100k',   name: 'Click Obsession',    desc: 'Click 100,000 times', icon_img: 'sprites/images/icons/32/ach_click_100k.webp',         icon: '🌀', threshold: { type: 'clicks', value: 100_000 } },
    { id: 'click_1m',     name: 'Click Addict',       desc: 'Click 1,000,000 times', icon_img: 'sprites/images/icons/32/ach_click_1m.webp',       icon: '⚡', threshold: { type: 'clicks', value: 1_000_000 } },
    { id: 'click_10m',    name: 'Legendary Clicker',  desc: 'Click 10,000,000 times', icon_img: 'sprites/images/icons/32/ach_click_10m.webp',      icon: '🔥', threshold: { type: 'clicks', value: 10_000_000 } },
    // Prestige milestones
    { id: 'prestige_1',   name: 'First Reset',        desc: 'Prestige once', icon_img: 'sprites/images/icons/32/ach_prestige_1.webp',               icon: '💎', threshold: { type: 'prestiges', value: 1 } },
    { id: 'prestige_3',   name: 'Triple Threat',      desc: 'Prestige 3 times', icon_img: 'sprites/images/icons/32/ach_prestige_3.webp',            icon: '♻️', threshold: { type: 'prestiges', value: 3 } },
    { id: 'prestige_5',   name: 'Veteran',            desc: 'Prestige 5 times', icon_img: 'sprites/images/icons/32/ach_prestige_5.webp',            icon: '🔷', threshold: { type: 'prestiges', value: 5 } },
    { id: 'prestige_10',  name: 'Prestige Master',    desc: 'Prestige 10 times', icon_img: 'sprites/images/icons/32/ach_prestige_10.webp',           icon: '💠', threshold: { type: 'prestiges', value: 10 } },
    { id: 'prestige_25',  name: 'Prestige Lord',      desc: 'Prestige 25 times', icon_img: 'sprites/images/icons/32/ach_prestige_25.webp',           icon: '👾', threshold: { type: 'prestiges', value: 25 } },
    { id: 'prestige_50',  name: 'Ascended Being',     desc: 'Prestige 50 times', icon_img: 'sprites/images/icons/32/ach_prestige_50.webp',           icon: '🌌', threshold: { type: 'prestiges', value: 50 } },
    // Room milestones
    { id: 'room_cyber',   name: 'Digital Denizen',    desc: 'Unlock the Cyber Den', icon_img: 'sprites/images/icons/32/ach_room_cyber.webp',        icon: '🖥️', threshold: { type: 'room', value: 'cyber_den' } },
    { id: 'room_zen',     name: 'Zen Master',         desc: 'Unlock the Zen Garden', icon_img: 'sprites/images/icons/32/ach_room_zen.webp',       icon: '🧘', threshold: { type: 'room', value: 'zen_garden' } },
    { id: 'room_star',    name: 'Stargazer',          desc: 'Unlock the Star Deck', icon_img: 'sprites/images/icons/32/ach_room_star.webp',        icon: '🔭', threshold: { type: 'room', value: 'star_deck' } },
    { id: 'room_study',   name: 'Scholar',            desc: 'Unlock the Study Lounge', icon_img: 'sprites/images/icons/32/ach_room_study.webp',     icon: '📚', threshold: { type: 'room', value: 'study_lounge' } },
    { id: 'room_beach',   name: 'Beachcomber',        desc: 'Unlock the Beach Cove', icon_img: 'sprites/images/icons/32/ach_room_beach.webp',       icon: '🏖️', threshold: { type: 'room', value: 'beach_cove' } },
    { id: 'room_all',     name: 'Everywhere At Once', desc: 'Unlock all 6 rooms', icon_img: 'sprites/images/icons/32/ach_room_all.webp',          icon: '🌐', threshold: { type: 'all_rooms', value: 1 } },
    // VPS milestones
    { id: 'vps_10',       name: 'Ten Per Second',     desc: 'Reach 10 VPS', icon_img: 'sprites/images/icons/32/ach_vps_10.webp',                icon: '🐢', threshold: { type: 'vps', value: 10 } },
    { id: 'vps_100',      name: 'Triple Digits',      desc: 'Reach 100 VPS', icon_img: 'sprites/images/icons/32/ach_vps_100.webp',               icon: '🚀', threshold: { type: 'vps', value: 100 } },
    { id: 'vps_1k',       name: 'Kilovibe',           desc: 'Reach 1K VPS', icon_img: 'sprites/images/icons/32/ach_vps_1k.webp',                icon: '💨', threshold: { type: 'vps', value: 1_000 } },
    { id: 'vps_10k',      name: 'Vibe Engine',        desc: 'Reach 10K VPS', icon_img: 'sprites/images/icons/32/ach_vps_10k.webp',               icon: '⚙️', threshold: { type: 'vps', value: 10_000 } },
    { id: 'vps_100k',     name: 'Vibe Turbine',       desc: 'Reach 100K VPS', icon_img: 'sprites/images/icons/32/ach_vps_100k.webp',              icon: '🏎️', threshold: { type: 'vps', value: 100_000 } },
    { id: 'vps_1m',       name: 'Vibe Factory',       desc: 'Reach 1M VPS', icon_img: 'sprites/images/icons/32/ach_vps_1m.webp',                icon: '🏭', threshold: { type: 'vps', value: 1_000_000 } },
    { id: 'vps_10m',      name: 'Vibe Metropolis',    desc: 'Reach 10M VPS', icon_img: 'sprites/images/icons/32/ach_vps_10m.webp',               icon: '🏙️', threshold: { type: 'vps', value: 10_000_000 } },
    { id: 'vps_100m',     name: 'Vibe Planet',        desc: 'Reach 100M VPS', icon_img: 'sprites/images/icons/32/ach_vps_100m.webp',              icon: '🌍', threshold: { type: 'vps', value: 100_000_000 } },
    { id: 'vps_1b',       name: 'Industrial Scale',   desc: 'Reach 1B VPS', icon_img: 'sprites/images/icons/32/ach_vps_1b.webp',                icon: '🌌', threshold: { type: 'vps', value: 1_000_000_000 } },
    // Gateway milestones
    { id: 'gw_first',     name: 'Gateway Connected',  desc: 'Connect to Hermes Gateway', icon_img: 'sprites/images/icons/32/ach_gw_first.webp',   icon: '🔌', threshold: { type: 'gateway', value: 1 } },
    { id: 'gw_quality',   name: 'Low Latency',        desc: 'Achieve <10ms gateway ping', icon_img: 'sprites/images/icons/32/ach_gw_quality.webp',  icon: '⚡', threshold: { type: 'gateway_low', value: 10 } },
    { id: 'gw_ultra',     name: 'Ultra Low Latency',  desc: 'Achieve <3ms gateway ping', icon_img: 'sprites/images/icons/32/ach_gw_ultra.webp',   icon: '💥', threshold: { type: 'gateway_low', value: 3 } },
    { id: 'gw_ping_100',  name: 'Ping Pro',           desc: 'Ping gateway 100 times', icon_img: 'sprites/images/icons/32/ach_gw_ping_100.webp',      icon: '📡', threshold: { type: 'pings', value: 100 } },
    { id: 'gw_ping_1k',   name: 'Ping Master',        desc: 'Ping gateway 1,000 times', icon_img: 'sprites/images/icons/32/ach_gw_ping_1k.webp',    icon: '🛰️', threshold: { type: 'pings', value: 1_000 } },
    // Decor milestones
    { id: 'decor_1',      name: 'First Decoration',   desc: 'Buy your first decor item', icon_img: 'sprites/images/icons/32/ach_decor_1.webp',   icon: '🎀', threshold: { type: 'decor', value: 1 } },
    { id: 'decor_5',      name: 'Decorator',          desc: 'Buy 5 decor items', icon_img: 'sprites/images/icons/32/ach_decor_5.webp',           icon: '🎨', threshold: { type: 'decor', value: 5 } },
    { id: 'decor_10',     name: 'Home Stager',        desc: 'Buy 10 decor items', icon_img: 'sprites/images/icons/32/ach_decor_10.webp',          icon: '🪑', threshold: { type: 'decor', value: 10 } },
    { id: 'decor_25',     name: 'Interior Designer',  desc: 'Buy 25 decor items', icon_img: 'sprites/images/icons/32/ach_decor_25.webp',          icon: '🏠', threshold: { type: 'decor', value: 25 } },
    { id: 'decor_50',     name: 'Collector',          desc: 'Buy 50 decor items', icon_img: 'sprites/images/icons/32/ach_decor_50.webp',          icon: '🏛️', threshold: { type: 'decor', value: 50 } },
    { id: 'decor_90',     name: 'Hoarder Supreme',    desc: 'Buy all 90 decor items', icon_img: 'sprites/images/icons/32/ach_decor_90.webp',      icon: '🏰', threshold: { type: 'decor', value: 90 } },
    // Autoclicker milestones
    { id: 'auto_10',      name: 'Automation Begins',  desc: 'Buy 10 total autoclickers', icon_img: 'sprites/images/icons/32/ach_auto_10.webp',   icon: '🤖', threshold: { type: 'autoclickers', value: 10 } },
    { id: 'auto_50',      name: 'Robot Army',         desc: 'Buy 50 total autoclickers', icon_img: 'sprites/images/icons/32/ach_auto_50.webp',   icon: '🦾', threshold: { type: 'autoclickers', value: 50 } },
    { id: 'auto_100',     name: 'Fully Automated',    desc: 'Buy 100 total autoclickers', icon_img: 'sprites/images/icons/32/ach_auto_100.webp',  icon: '🤖', threshold: { type: 'autoclickers', value: 100 } },
];

// ---------- DEFAULT GAME STATE ----------
function getDefaultState() {
    return {
        version: 1,
        vibes: BN_ZERO,
        lifetime_vibes: BN_ZERO,
        prestige_points: BN_ZERO,
        total_pp_earned: BN_ZERO,
        total_prestiges: BN_ZERO,
        prestige_unlocked: false,    // Prestige must be re-unlocked each time
        transcend_points: 0,
        transcend_upgrades: {},
        autoclickers: {},
        room_autoclickers: {}, // { roomId: { tierId: count } } — per-room
        prestige_upgrades: {},
        decor: {},
        current_room: 'campfire_grove',
        unlocked_rooms: ['campfire_grove'],
        owned_decor: [],
        active_decor: {}, // flat: { decorId: true } — all equipped items, no type limit
        gateway_history: [],
        placed_decor: {}, // { decorId: [{ x: gridPos, y: gridPos }, ...] }
        saved_decor_placements: {}, // persists across prestige: { decorId: [{ x: gridPos, y: gridPos }, ...] }
        gateway_bonus_active: false,
        _gwMult: 1.0,
        _gwLabel: 'Disconnected',
        _gwLatency: 0,
        last_save: Date.now(),
        total_clicks: 0,
        total_gateway_pings: 0,
        auth_token: null,
        auth_mode: 'local',       // 'firebase' | 'local_api' | 'local'
        displayName: null,         // User-chosen display name (overrides username)
        display_name_last_changed: 0, // Timestamp of last name change
        server_online: false,
        achievements: [],
        settings: {
            sfx_volume: 0.5,
            music_volume: 0.5,
            music_playing: true,
            music_track_index: 0,
            music_shuffle: true,
            particle_effects: true,
            show_float_text: true,
            sidebar_position: 'left',
            bio: '',
        }
    };
}

// ---------- GAME STATE ----------
let G = getDefaultState();
let saveLoadHandlers = [];

// ---------- FORMULAS ----------
function getCost(baseCost, count) {
    return Math.floor(baseCost * Math.pow(1.15, count));
}

// Calculate total cost for buying N items starting from current count
// Uses geometric series formula: b * r^k * (r^n - 1) / (r - 1)
function getBulkCost(baseCost, currentCount, quantity) {
    if (quantity <= 0) return 0;
    const r = 1.15;
    const rK = Math.pow(r, currentCount);
    const rN = Math.pow(r, quantity);
    return Math.floor(baseCost * rK * (rN - 1) / (r - 1));
}

// Calculate how many can be bought with available vibes (MAX)
// Uses log formula: floor(log(c*(r-1)/(b*r^k)+1) / log(r))
function getMaxBuyable(baseCost, currentCount, availableVibes) {
    if (availableVibes <= 0 || baseCost <= 0) return 0;
    const r = 1.15;
    const rK = Math.pow(r, currentCount);
    const ratio = (availableVibes * (r - 1)) / (baseCost * rK) + 1;
    if (ratio <= 1) return 0;
    return Math.floor(Math.log(ratio) / Math.log(r));
}

// Calculate the combined VPS multiplier from all active decor items (finds item by ID across all rooms)
function getActiveDecorVpsMult(state = G) {
    let mult = 1.0;
    const activeDecor = state.active_decor || {};
    const decorIds = Object.keys(activeDecor);
    if (decorIds.length === 0) return mult;
    // Build a quick lookup: id -> vpsMult across all rooms
    const lookup = {};
    for (const roomId of Object.keys(ROOM_DECOR)) {
        for (const item of ROOM_DECOR[roomId]) {
            lookup[item.id] = item.vpsMult || 1.0;
        }
    }
    for (const id of decorIds) {
        if (lookup[id]) mult *= lookup[id];
    }
    return mult;
}

// ---------- GOLDEN COOKIES (random clickable bonuses) ----------
const GOLDEN_COOKIE_INTERVAL_MIN = 60000; // 60s
const GOLDEN_COOKIE_INTERVAL_MAX = 180000; // 3min
const GOLDEN_COOKIE_DURATION = 12000; // 12s to click before it vanishes
const GOLDEN_COOKIE_TYPES = [
    { id: 'vibe_burst', name: 'Vibe Burst',    desc: '+15s of VPS instantly',  color: '#ffd700', icon: '✦' },
    { id: 'click_boost', name: 'Click Frenzy',  desc: '×10 click power for 15s', color: '#ff6b35', icon: '👆' },
    { id: 'vps_boost',   name: 'VPS Boost',     desc: '×2 VPS for 30s',         color: '#00e5ff', icon: '⚡' },
    { id: 'chip_drop',   name: 'Prestige Drop', desc: '+1-3 Prestige Chips',    color: '#ff0066', icon: '💎' },
    { id: 'free_decor',  name: 'Free Decor',    desc: 'Random free decor item', color: '#66bb6a', icon: '🎨' },
];

let goldenCookieSystem = {
    active: false,
    type: null,
    x: 0, y: 0,
    spawnedAt: 0,
    collected: false,
    boostEndTime: 0,
    boostType: null,
    clickBoostEnd: 0,
    vpsBoostEnd: 0,
    _nextSpawnTimer: null,
};

function spawnGoldenCookie(state = G) {
    if (goldenCookieSystem.active) return;
    const type = GOLDEN_COOKIE_TYPES[Math.floor(Math.random() * GOLDEN_COOKIE_TYPES.length)];
    goldenCookieSystem.active = true;
    goldenCookieSystem.type = type;
    goldenCookieSystem.spawnedAt = Date.now();
    goldenCookieSystem.collected = false;
    return type;
}

function collectGoldenCookie(state = G) {
    if (!goldenCookieSystem.active || goldenCookieSystem.collected) return null;
    goldenCookieSystem.collected = true;
    goldenCookieSystem.active = false;
    const type = goldenCookieSystem.type;
    if (!type) return null;

    switch (type.id) {
        case 'vibe_burst': {
            const vps = getVPS(state);
            const burst = Math.floor(vps * 15);
            addVibes(burst);
            return { type: 'vibes', amount: burst, msg: `+${formatNumber(burst)} ✦ Vibe Burst!` };
        }
        case 'click_boost':
            goldenCookieSystem.clickBoostEnd = Date.now() + 15000;
            return { type: 'boost', msg: '👆 Click Frenzy! ×10 for 15s!' };
        case 'vps_boost':
            goldenCookieSystem.vpsBoostEnd = Date.now() + 30000;
            return { type: 'boost', msg: '⚡ VPS Boost! ×2 for 30s!' };
        case 'chip_drop': {
            const chips = 1 + Math.floor(Math.random() * 3);
            state.prestige_points += chips;
            return { type: 'chips', amount: chips, msg: `💎 +${chips} Prestige Chips!` };
        }
        case 'free_decor': {
            // Find a random decor item the player doesn't own
            const allDecor = Object.values(ROOM_DECOR).flat();
            const owned = state.owned_decor || [];
            const available = allDecor.filter(d => !owned.includes(d.id));
            if (available.length > 0) {
                const gift = available[Math.floor(Math.random() * available.length)];
                state.owned_decor.push(gift.id);
                return { type: 'decor', id: gift.id, msg: `🎨 Free decor: ${gift.name}!` };
            }
            // Fallback: give vibes if all decor owned
            const vps = getVPS(state);
            addVibes(vps * 30);
            return { type: 'vibes', amount: vps * 30, msg: `+${formatNumber(vps * 30)} ✦ (all decor owned!)` };
        }
    }
    return null;
}

function getClickBoostMult() {
    return goldenCookieSystem.clickBoostEnd > Date.now() ? 10 : 1;
}

function getVpsBoostMult() {
    return goldenCookieSystem.vpsBoostEnd > Date.now() ? 2 : 1;
}

// ---------- WRINKLERS (passive debuff that stores VPS) ----------
const WRINKLER_COUNT_MAX = 10;
const WRINKLER_VPS_PENALTY = 0.05; // Each wrinkler reduces VPS by 5%
let wrinklerSystem = {
    wrinklers: [], // [{ spawnedAt, storedVibes, id }]
    lastWrinklerSpawn: 0,
};

function getWrinklerPenalty(state = G) {
    const count = wrinklerSystem.wrinklers.length;
    return Math.min(0.9, count * WRINKLER_VPS_PENALTY); // Max 90% penalty
}

function getEffectiveVpsMultiplier(state = G) {
    const wrinklePenalty = getWrinklerPenalty(state);
    return 1 - wrinklePenalty;
}

function updateWrinklers(state = G) {
    const now = Date.now();
    // Tick: each wrinkler stores VPS * tick interval
    if (wrinklerSystem.wrinklers.length > 0) {
        const vps = getVPS(state);
        const storePerWrinkler = vps * 0.1 * (0.1); // Each stores ~10% cap per tick
        for (const w of wrinklerSystem.wrinklers) {
            w.storedVibes += storePerWrinkler;
        }
    }

    // Auto-spawn new wrinklers periodically
    const maxWrinklers = Math.max(1, Math.min(WRINKLER_COUNT_MAX, Math.floor(bnToNumber(state.total_prestiges || BN_ZERO)) + 1));
    if (wrinklerSystem.wrinklers.length < maxWrinklers) {
        const spawnInterval = 60000; // 1 minute per new wrinkler
        if (now - wrinklerSystem.lastWrinklerSpawn > spawnInterval) {
            wrinklerSystem.wrinklers.push({
                id: Date.now() + Math.random(),
                spawnedAt: now,
                storedVibes: 0,
            });
            wrinklerSystem.lastWrinklerSpawn = now;
        }
    }
}

function popWrinkler(index, state = G) {
    if (index < 0 || index >= wrinklerSystem.wrinklers.length) return null;
    const w = wrinklerSystem.wrinklers[index];
    const payout = Math.floor(w.storedVibes * 1.1); // 1.1x bonus on pop
    addVibes(payout);
    wrinklerSystem.wrinklers.splice(index, 1);
    return { amount: payout, msg: `🕷️ Popped! +${formatNumber(payout)} ✦` };
}

function popAllWrinklers(state = G) {
    let total = 0;
    while (wrinklerSystem.wrinklers.length > 0) {
        const result = popWrinkler(0, state);
        if (result) total += result.amount;
    }
    return total;
}

// ---------- BUILDING SYNERGIES ----------
// Autoclickers that boost others when owned
const SYNERGIES = [
    // ---- GLOBAL ----
    { id: 'win95_syn',     name: 'Retro Boost',    desc: 'Win95 PC boosts first 3 PCs by 50%',       prereq: 'win95',    reqCount: 1,    targetTiers: ['win95','win98','imac_g3'], mult: 0.5 },
    { id: 'mac_g3_syn',    name: 'Legacy Bridge',  desc: 'iMac G3 boosts Mac Mini & Mac Studio by 75%', prereq: 'imac_g3', reqCount: 3,    targetTiers: ['mac_mini','mac_studio'], mult: 0.75 },
    { id: 'gaming_syn',    name: 'RGB Overdrive',  desc: 'Gaming Rig boosts RTX & DGX by 100%',      prereq: 'gaming_rig', reqCount: 2, targetTiers: ['rtx_setup','dgx_pod'], mult: 1.0 },
    { id: 'server_syn',    name: 'Cluster Link',   desc: 'Server Rack boosts Satellite by 150%',     prereq: 'server_rack', reqCount: 3, targetTiers: ['satellite'], mult: 1.5 },
    { id: 'quantum_syn',   name: 'Quantum Link',   desc: 'Quantum Core boosts Dyson Sphere by 200%', prereq: 'quantum', reqCount: 2, targetTiers: ['dyson'], mult: 2.0 },
    // ---- CAMPFIRE GROVE ----
    { id: 'cg_spark_syn',     name: 'Ignition',        desc: 'Spark Tinder boosts Kindling & Campfire by 50%',  prereq: 'cg_spark',    reqCount: 5,  targetTiers: ['cg_kindling','cg_campfire'], mult: 0.5 },
    { id: 'cg_campfire_syn',  name: 'Blaze',           desc: 'Campfire boosts Bonfire & Fire Pit by 75%',        prereq: 'cg_campfire', reqCount: 5,  targetTiers: ['cg_bonfire','cg_fire_pit'], mult: 0.75 },
    { id: 'cg_forge_syn',     name: 'Iron Age',        desc: 'Forge boosts Sawmill & Lumberyard by 75%',         prereq: 'cg_forge',    reqCount: 3,  targetTiers: ['cg_sawmill','cg_lumberyard'], mult: 0.75 },
    { id: 'cg_log_cabin_syn', name: 'Timber',          desc: 'Log Cabin boosts Tree Farm by 100%',               prereq: 'cg_log_cabin', reqCount: 3,  targetTiers: ['cg_tree_farm'], mult: 1.0 },
    { id: 'cg_tree_farm_syn', name: 'Wild Growth',     desc: 'Tree Farm boosts Forest Spirit by 150%',           prereq: 'cg_tree_farm', reqCount: 3,  targetTiers: ['cg_forest_spirit'], mult: 1.5 },
    // ---- CYBER DEN ----
    { id: 'cd_led_syn',       name: 'Circuit Path',    desc: 'LED Array boosts Pi & Switch by 50%',             prereq: 'cd_led',      reqCount: 5,  targetTiers: ['cd_pi','cd_switch'], mult: 0.5 },
    { id: 'cd_gaming_syn',    name: 'Overclock',       desc: 'Gaming PC boosts Render Farm by 75%',              prereq: 'cd_gaming_pc', reqCount: 3,  targetTiers: ['cd_render'], mult: 0.75 },
    { id: 'cd_server_syn',    name: 'Server Farm',     desc: 'Server Rack boosts Datacenter by 100%',            prereq: 'cd_server',  reqCount: 3,  targetTiers: ['cd_datacenter'], mult: 1.0 },
    { id: 'cd_datacenter_syn', name: 'Supercluster',   desc: 'Datacenter boosts Supercomputer & Neural Net by 100%', prereq: 'cd_datacenter', reqCount: 3, targetTiers: ['cd_super','cd_neural'], mult: 1.0 },
    { id: 'cd_ai_core_syn',   name: 'Singularity',     desc: 'AI Core boosts Digital & Cyberspace by 150%',     prereq: 'cd_ai_core', reqCount: 3,  targetTiers: ['cd_digital','cd_cyberspace'], mult: 1.5 },
    // ---- ZEN GARDEN ----
    { id: 'zg_mat_syn',       name: 'Foundation',      desc: 'Sitting Mat boosts Bamboo & Wind Chime by 50%',  prereq: 'zg_mat',      reqCount: 5,  targetTiers: ['zg_bamboo','zg_chime'], mult: 0.5 },
    { id: 'zg_bamboo_syn',    name: 'Growth',          desc: 'Bamboo boosts Koi Pond & Rock Garden by 50%',    prereq: 'zg_bamboo',   reqCount: 5,  targetTiers: ['zg_koi','zg_rock'], mult: 0.5 },
    { id: 'zg_tea_syn',       name: 'Ceremony',        desc: 'Tea House boosts Temple & Waterfall by 75%',     prereq: 'zg_tea',      reqCount: 3,  targetTiers: ['zg_temple','zg_waterfall'], mult: 0.75 },
    { id: 'zg_waterfall_syn', name: 'Flow',            desc: 'Waterfall boosts Cherry Tree & Meditation Hall by 100%', prereq: 'zg_waterfall', reqCount: 3, targetTiers: ['zg_cherry','zg_hall'], mult: 1.0 },
    { id: 'zg_hall_syn',      name: 'Enlightenment',   desc: 'Meditation Hall boosts Cosmic Mind & Nirvana by 150%', prereq: 'zg_hall', reqCount: 3, targetTiers: ['zg_cosmic','zg_nirvana'], mult: 1.5 },
    // ---- STAR DECK ----
    { id: 'sd_chart_syn',     name: 'Navigation',      desc: 'Star Chart boosts Telescope & Observatory by 50%', prereq: 'sd_chart', reqCount: 5, targetTiers: ['sd_telescope','sd_observatory'], mult: 0.5 },
    { id: 'sd_telescope_syn', name: 'Discovery',       desc: 'Telescope boosts Satellite & Space Station by 75%', prereq: 'sd_telescope', reqCount: 3, targetTiers: ['sd_satellite','sd_station'], mult: 0.75 },
    { id: 'sd_lunar_syn',     name: 'Colonization',    desc: 'Lunar Base boosts Mars Colony & Asteroid Mine by 100%', prereq: 'sd_lunar', reqCount: 3, targetTiers: ['sd_mars','sd_asteroid'], mult: 1.0 },
    { id: 'sd_starforge_syn', name: 'Starforge',       desc: 'Star Forge boosts Nebula & Black Hole by 150%', prereq: 'sd_starforge', reqCount: 3, targetTiers: ['sd_nebula','sd_blackhole'], mult: 1.5 },
    { id: 'sd_nebula_syn',    name: 'Cosmic Scale',    desc: 'Nebula boosts Galaxy & Cosmic String by 200%',   prereq: 'sd_nebula', reqCount: 3, targetTiers: ['sd_galaxy','sd_cosmic_string'], mult: 2.0 },
    // ---- STUDY LOUNGE ----
    { id: 'sl_bookmark_syn',  name: 'Curated',         desc: 'Bookmark boosts Lamp & Bookshelf by 50%',        prereq: 'sl_bookmark', reqCount: 5, targetTiers: ['sl_lamp','sl_bookshelf'], mult: 0.5 },
    { id: 'sl_bookshelf_syn', name: 'Study Session',   desc: 'Bookshelf boosts Desk & Typewriter by 50%',     prereq: 'sl_bookshelf', reqCount: 5, targetTiers: ['sl_desk','sl_typewriter'], mult: 0.5 },
    { id: 'sl_desk_syn',      name: 'Research',        desc: 'Desk boosts Book Cart & Reading Nook by 75%',   prereq: 'sl_desk', reqCount: 3, targetTiers: ['sl_cart','sl_reading'], mult: 0.75 },
    { id: 'sl_reading_syn',   name: 'Archive',         desc: 'Reading Nook boosts Archive & Grand Library by 100%', prereq: 'sl_reading', reqCount: 3, targetTiers: ['sl_archive','sl_grand'], mult: 1.0 },
    { id: 'sl_archive_syn',   name: 'Vault',           desc: 'Archive boosts Vault & Ancient Tome by 150%',   prereq: 'sl_archive', reqCount: 3, targetTiers: ['sl_vault','sl_tome'], mult: 1.5 },
    { id: 'sl_tome_syn',      name: 'Omniscience',     desc: 'Ancient Tome boosts Well of Knowledge & Omni by 200%', prereq: 'sl_tome', reqCount: 3, targetTiers: ['sl_well','sl_omni'], mult: 2.0 },
    // ---- BEACH COVE ----
    { id: 'bc_castle_syn',    name: 'Shoreline',       desc: 'Sand Castle boosts Sea Shell & Beach Towel by 50%', prereq: 'bc_castle', reqCount: 5, targetTiers: ['bc_shell','bc_towel'], mult: 0.5 },
    { id: 'bc_towel_syn',     name: 'Watersports',     desc: 'Beach Towel boosts Surfboard & Tiki Torch by 50%', prereq: 'bc_towel', reqCount: 5, targetTiers: ['bc_surfboard','bc_tiki'], mult: 0.5 },
    { id: 'bc_surfboard_syn', name: 'Voyage',          desc: 'Surfboard boosts Sailboat & Lighthouse by 75%',  prereq: 'bc_surfboard', reqCount: 3, targetTiers: ['bc_sailboat','bc_lighthouse'], mult: 0.75 },
    { id: 'bc_sailboat_syn',  name: 'Harbor',          desc: 'Sailboat boosts Fishing Pier & Resort by 100%',  prereq: 'bc_sailboat', reqCount: 3, targetTiers: ['bc_pier','bc_resort'], mult: 1.0 },
    { id: 'bc_resort_syn',    name: 'Deep Sea',        desc: 'Resort boosts Cruise Ship & Underwater City by 150%', prereq: 'bc_resort', reqCount: 3, targetTiers: ['bc_cruise','bc_underwater'], mult: 1.5 },
    { id: 'bc_cruise_syn',    name: 'Oceanic',         desc: 'Cruise Ship boosts Coral Reef & Ocean Spirit by 200%', prereq: 'bc_cruise', reqCount: 3, targetTiers: ['bc_reef','bc_ocean_spirit'], mult: 2.0 },
];

function getSynergyBonus(autoclickerId, state = G) {
    let bonus = 0;
    let stacks = 0;
    for (const syn of SYNERGIES) {
        // Sum owned count across ALL rooms
        let ownedCount = 0;
        if (state.autoclickers && state.autoclickers[syn.prereq]) {
            ownedCount += state.autoclickers[syn.prereq];
        }
        if (state.room_autoclickers) {
            for (const roomId of Object.keys(state.room_autoclickers)) {
                const roomClickers = state.room_autoclickers[roomId];
                if (roomClickers && roomClickers[syn.prereq]) {
                    ownedCount += roomClickers[syn.prereq];
                }
            }
        }
        if (ownedCount >= syn.reqCount && syn.targetTiers.includes(autoclickerId)) {
            const s = Math.floor(ownedCount / syn.reqCount);
            bonus += syn.mult * s;
            stacks += s;
        }
    }
    return bonus;
}

// Get total boost multiplier and stack count for an upgrade
function getSynergyBoostInfo(upgradeId, state = G) {
    let totalMult = 0;
    let stacks = 0;
    for (const syn of SYNERGIES) {
        // Sum owned count across ALL rooms
        let ownedCount = 0;
        if (state.autoclickers && state.autoclickers[syn.prereq]) {
            ownedCount += state.autoclickers[syn.prereq];
        }
        if (state.room_autoclickers) {
            for (const roomId of Object.keys(state.room_autoclickers)) {
                const roomClickers = state.room_autoclickers[roomId];
                if (roomClickers && roomClickers[syn.prereq]) {
                    ownedCount += roomClickers[syn.prereq];
                }
            }
        }
        if (ownedCount >= syn.reqCount && syn.targetTiers.includes(upgradeId)) {
            const s = Math.floor(ownedCount / syn.reqCount);
            totalMult += syn.mult * s;
            stacks += s;
        }
    }
    return { totalMult, stacks };
}

// Look up display name for an upgrade ID
function getUpgradeName(id) {
    // Check room autoclickers first
    for (const roomId of Object.keys(ROOM_AUTOCLICKERS)) {
        const def = ROOM_AUTOCLICKERS[roomId].find(d => d.id === id);
        if (def) return def.name;
    }
    // Check global autoclickers
    const globalDef = AUTOCLICKERS.find(d => d.id === id);
    if (globalDef) return globalDef.name;
    return id; // fallback to raw ID
}

// Get all synergy defs where this upgrade is the prereq (what it boosts)
function getSynergiesFrom(upgradeId) {
    return SYNERGIES.filter(s => s.prereq === upgradeId);
}

// Get all synergy defs where this upgrade is a target (what boosts it)
function getSynergiesTo(upgradeId) {
    return SYNERGIES.filter(s => s.targetTiers.includes(upgradeId));
}

// Sum of unlocked tier bonuses for a given type (click, vps, offline, all, rooms)
function getTierAccumulated(type, state = G) {
    let total = 0;
    for (const tier of TIERS) {
        if (!bnGe(state.total_prestiges, tier.requires)) break;
        if (tier.type === type) total += tier.value;
    }
    return total;
}

function getVPS(state = G) {
    let vps = 0;
    // Sum autoclickers from ALL unlocked rooms
    const roomsToCheck = state.unlocked_rooms || [state.current_room || 'campfire_grove'];
    for (const roomId of roomsToCheck) {
        const defs = ROOM_AUTOCLICKERS[roomId] || [];
        const clickers = (state.room_autoclickers || {})[roomId] || {};
        for (const def of defs) {
            const count = clickers[def.id] || 0;
            if (count > 0) {
                let tierVps = def.vps * count;
                const globalTier = AUTOCLICKERS.find(t => t.id === def.id);
                if (globalTier) {
                    const synBonus = getSynergyBonus(def.id, state);
                    tierVps *= (1 + synBonus);
                }
                vps += tierVps;
            }
        }
        const globalClickers = state.autoclickers || {};
        for (const [id, count] of Object.entries(globalClickers)) {
            const tier = AUTOCLICKERS.find(t => t.id === id);
            if (tier && !clickers[id]) {
                let tierVps = tier.vps * count;
                const synBonus = getSynergyBonus(id, state);
                tierVps *= (1 + synBonus);
                vps += tierVps;
            }
        }
    }
    // Gateway latency buff
    let gwMult = state.gateway_bonus_active ? (state._gwMult || 2.0) : 1.0;
    // Apply prestige upgrades (count-based)
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (!upg || !count) continue;
        if (upg.type === 'gw_add') gwMult += upg.value * count;
        if (upg.type === 'base_vps') vps += upg.value * count;
    }
    // Decor VPS multiplier
    const roomMult = getActiveDecorVpsMult(state);
    // Permanent multiplier from prestige chips (BN)
    let permaMult = BN_ONE;
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'perma_mult' && count) {
            const val = Math.pow(upg.value, count);
            if (isFinite(val)) permaMult = bnMul(permaMult, bnFromNumber(val));
        }
    }
    const vpsBoost = getVpsBoostMult();
    const wrinkleMult = getEffectiveVpsMultiplier(state);
    // Tier bonuses
    const tierVps = getTierAccumulated('vps', state);
    const tierAll = getTierAccumulated('all', state);
    // Combine as BN: vps * gwMult * roomMult * permaMult * vpsBoost * wrinkleMult * tierBonuses
    let result = bnFromNumber(vps);
    result = bnMul(result, bnFromNumber(gwMult));
    result = bnMul(result, bnFromNumber(roomMult));
    result = bnMul(result, permaMult);
    result = bnMul(result, bnFromNumber(vpsBoost));
    result = bnMul(result, bnFromNumber(wrinkleMult));
    if (tierVps > 0) result = bnMul(result, bnFromNumber(1 + tierVps));
    if (tierAll > 0) result = bnMul(result, bnFromNumber(1 + tierAll));
    return result;
}

function getClickValue(state = G) {
    let base = 1;
    let clickMult = BN_ONE;
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'click_mult' && count) {
            const val = Math.pow(upg.value, count);
            if (isFinite(val)) clickMult = bnMul(clickMult, bnFromNumber(val));
        }
    }
    // Permanent multiplier from prestige chips (BN)
    let permaMult = BN_ONE;
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'perma_mult' && count) {
            const val = Math.pow(upg.value, count);
            if (isFinite(val)) permaMult = bnMul(permaMult, bnFromNumber(val));
        }
    }
    // Golden cookie click boost
    const gcBoost = getClickBoostMult();
    // Tier bonuses
    const tierClick = getTierAccumulated('click', state);
    const tierAll = getTierAccumulated('all', state);
    let result = bnMul(bnFromNumber(base), clickMult);
    result = bnMul(result, permaMult);
    result = bnMul(result, bnFromNumber(gcBoost));
    if (tierClick > 0) result = bnMul(result, bnFromNumber(1 + tierClick));
    if (tierAll > 0) result = bnMul(result, bnFromNumber(1 + tierAll));
    return result;
}

// Prestige threshold: exponential growth 1T × 2.5^(n) where n = prestige count + 1
// 1st: 2.5T, 2nd: 6.25T, 3rd: 15.6T, 4th: 39T, 5th: 97.7T, ...
function getPrestigeThreshold(state = G) {
    const presCount = bnToNumber(state.total_prestiges || BN_ZERO);
    // First prestige: 10T
    if (presCount === 0) return 10_000_000_000_000; // 10T

    // Subsequent: bump suffix based on current tier level
    // Tiers 0-9 = 10T, tiers 10-19 = 10Q, tiers 20-29 = 10a, etc.
    // 10T → 10Q → 10a → 10c → 10d → 10e → ...
    const suffixes = ['k','M','B','T','Q','a','c','d','e','f','g','h','i','j','l','n','o','p','r','s','u','v','w','x','y','z',
        'A','C','D','E','F','G','H','I','J','L','N','O','P','R','S','U','V','W','X','Y','Z'];
    const tierIdx = getCurrentTier(state);
    const level = Math.floor(Math.max(0, tierIdx) / 10);
    const suffixIdx = Math.min(4 + level, suffixes.length - 1);
    return 10 * Math.pow(1000, suffixIdx);
}

function getPrestigeGain(state = G) {
    // Must be unlocked first
    if (!state.prestige_unlocked) return BN_ZERO;
    const threshold = getPrestigeThreshold(state);
    if (bnLt(state.lifetime_vibes, threshold)) return BN_ZERO;
    // Base 50 chips + 1 per 1T lifetime vibes
    const bonus = bnFloor(bnDiv(state.lifetime_vibes, bnFromNumber(1e12)));
    return bnAdd(bnFromNumber(50), bonus);
}

function isPrestigeUnlockable(state = G) {
    const threshold = getPrestigeThreshold(state);
    // Check if lifetime vibes >= threshold
    if (bnLt(state.lifetime_vibes, threshold)) return false;
    // Only require all rooms for the FIRST prestige
    const presCount = bnToNumber(state.total_prestiges || BN_ZERO);
    if (presCount === 0) {
        const totalRoomCost = Object.values(ROOMS).reduce((sum, r) => sum + r.cost, 0);
        if (totalRoomCost > threshold) {
            const allRoomIds = Object.keys(ROOMS);
            return allRoomIds.every(id => state.unlocked_rooms.includes(id));
        }
    }
    return true;
}

function unlockPrestige() {
    if (isPrestigeUnlockable()) {
        G.prestige_unlocked = true;
        notifyStateChange('prestige');
        return true;
    }
    return false;
}

// ---------- BIG NUMBER FORMATTING ----------
function formatBN(bn) {
    if (bn[0] === 0 || !isFinite(bn[0]) || !isFinite(bn[1])) return '0';
    let [m, e] = bn;
    // m is in [1, 10)
    // Small numbers
    if (e < 0) return (m * Math.pow(10, e)).toFixed(Math.max(2, -e + 2));
    // Get suffix group index (each group = 10^3)
    const groupIdx = Math.floor(e / 3);
    const rem = e % 3;
    let scaled = m * Math.pow(10, rem); // Now in [1, 1000)
    const suffixesList = ['k','M','B','T','Q',
        'a','c','d','e','f','g','h','i','j','l','n','o','p','r','s','u','v','w','x','y','z',
        'A','C','D','E','F','G','H','I','J','L','N','O','P','R','S','U','V','W','X','Y','Z'];
    const S = suffixesList.length; // 47
    if (groupIdx === 0) {
        if (scaled >= 1) return Math.floor(scaled).toString();
        return scaled.toFixed(2);
    }
    if (groupIdx <= S) {
        return scaled.toFixed(2) + suffixesList[groupIdx - 1];
    }
    // InfZ system: InfZ^n with recursive bracket layers
    const C = S + 1; // 48 states per layer
    let beyond = groupIdx - S;
    return formatInfZ(beyond, suffixesList, S, C);

}

// Recursive InfZ^n formatter: InfZ × N → InfZ² (N) → InfZ³ [N] → ... → InfZ^∞
function formatInfZ(beyond, suffixes, S, C) {
    const powers = [
        { label: '',   open: ' ×', close: '' },    // InfZ^1
        { label: '²',  open: ' (', close: ')' },    // InfZ²
        { label: '³',  open: ' [', close: ']' },    // InfZ³
        { label: '⁴',  open: ' {', close: '}' },    // InfZ⁴
        { label: '⁵',  open: ' <', close: '>' },    // InfZ⁵
        { label: '⁶',  open: ' |', close: '|' },    // InfZ⁶
        { label: '⁷',  open: ' ⌈', close: '⌉' },    // InfZ⁷
        { label: '⁸',  open: ' ⌊', close: '⌋' },    // InfZ⁸
        { label: '⁹',  open: ' ⟨', close: '⟩' },    // InfZ⁹
        { label: '^10', open: ' ⟪', close: '⟫' },   // InfZ^10
    ];
    function fmt(b, depth) {
        if (depth >= powers.length) return 'InfZ^∞';
        if (b > 500000) return 'InfZ^∞'; // Beyond practical display — show the capstone
        const pos = (b - 1) % C;
        const cnt = Math.floor((b - 1) / C) + 1;
        const p = powers[depth];
        let cntStr;
        if (cnt < 1000) {
            cntStr = String(Math.floor(cnt));
        } else {
            let idx = 0, tmp = cnt;
            while (tmp >= 1000) { tmp /= 1000; idx++; }
            if (idx <= S) {
                cntStr = (cnt / Math.pow(1000, idx)).toFixed(2) + suffixes[idx - 1];
            } else {
                // Count itself needs deeper InfZ — recurse, outer absorbs into inner
                return fmt(idx - S, depth + 1);
            }
        }
        let result = 'InfZ' + p.label + p.open + cntStr;
        if (pos > 0) result += suffixes[pos - 1];
        result += p.close;
        return result;
    }
    return fmt(beyond, 0);
}

function formatNumber(n) {
    // Guard against undefined/null (would trigger !isFinite and return 'InfZ')
    if (n === undefined || n === null) return '0';
    // Handle BigNum arrays — format via the BN system
    if (Array.isArray(n)) return formatBN(n);
    // Guard against Infinity/NaN from overflow
    if (!isFinite(n)) return 'InfZ';
    if (isNaN(n)) return '0';
    // Suffix system: K M B T Q then a-z skipping k,m,b,t,q then A-Z skipping K,M,B,T,Q
    const suffixes = ['k','M','B','T','Q',
        'a','c','d','e','f','g','h','i','j','l','n','o','p','r','s','u','v','w','x','y','z',
        'A','C','D','E','F','G','H','I','J','L','N','O','P','R','S','U','V','W','X','Y','Z'];
    const S = suffixes.length; // 56

    if (n < 1000) {
        if (n >= 1) return Math.floor(n).toString();
        if (n >= 0.01) return n.toFixed(2);
        if (n >= 0.0001) return n.toFixed(4);
        if (n > 0) return n.toExponential(1);
        return '0';
    }

    let idx = 0;
    let scaled = n;
    while (scaled >= 1000) {
        scaled /= 1000;
        idx++;
    }
    // scaled in [1, 1000), idx >= 1

    if (idx <= S) {
        return scaled.toFixed(2) + suffixes[idx - 1];
    }

    // ---- INFINITYZ SYSTEM ----
    // Beyond Z, display cycles through InfinityZ ×N layers.
    // Each layer: a count N (1, 2, 3...) with 57 display states per count:
    //   N (base) + Nk, NM, NB, NT, NQ, Na, Nc, ... Nz, NA, NC, ... NZ
    // When a count value itself needs InfinityZ notation, wrap in:
    //   InfZ x InfZ (inner_count)  where inner_count cycles the same way
    return formatInfinitySimple(idx, scaled, suffixes, S);
}

function formatNumberSuffix(val, suffixes, S) {
    // Format a value with the basic suffix system (k through Z)
    let idx = 0;
    let v = val;
    while (v >= 1000) { v /= 1000; idx++; }
    if (idx === 0) return String(Math.floor(v));
    return v.toFixed(2) + suffixes[idx - 1];
}

function formatInfinitySimple(totalIdx, scaled, suffixes, S) {
    const C = S + 1; // 57 states per count
    let beyond = totalIdx - S;
    return formatInfZ(beyond, suffixes, S, C);
}

// ---------- STATE ACTIONS ----------
function addVibes(amount) {
    // Convert regular numbers to BN
    if (typeof amount === 'number') amount = bnFromNumber(amount);
    G.vibes = bnAdd(G.vibes, amount);
    G.lifetime_vibes = bnAdd(G.lifetime_vibes, amount);
    notifyStateChange('vibes');
}

function buyAutoclicker(id, quantity = 1) {
    const room = G.current_room || 'campfire_grove';
    const roomDefs = ROOM_AUTOCLICKERS[room] || [];
    const tier = roomDefs.find(t => t.id === id) || AUTOCLICKERS.find(t => t.id === id);
    if (!tier) return false;
    if (!G.room_autoclickers[room]) G.room_autoclickers[room] = {};
    const count = G.room_autoclickers[room][id] || 0;
    
    if (quantity === 'max') {
        quantity = getMaxBuyable(tier.baseCost, count, G.vibes);
        if (quantity === 0) return false;
    }
    
    const totalCost = getBulkCost(tier.baseCost, count, quantity);
    if (bnGe(G.vibes, totalCost)) {
        G.vibes = bnSub(G.vibes, bnFromNumber(totalCost));
        G.room_autoclickers[room][id] = count + quantity;
        notifyStateChange('autoclickers');
        return quantity;
    }
    return false;
}

function buyPrestigeUpgrade(id) {
    const upg = PRESTIGE_UPGRADES.find(u => u.id === id);
    if (!upg) return false;
    const cost = getPrestigeUpgradeCost(id);
    if (bnGe(G.prestige_points, cost)) {
        G.prestige_points = bnSub(G.prestige_points, cost);
        G.prestige_upgrades[id] = (G.prestige_upgrades[id] || 0) + 1;
        notifyStateChange('gateway_upgrades');
        return true;
    }
    return false;
}

function buyDecor(id) {
    // Find item across all rooms
    let item = null;
    for (const roomId of Object.keys(ROOM_DECOR)) {
        item = ROOM_DECOR[roomId].find(d => d.id === id);
        if (item) break;
    }
    if (!item) return false;
    if (G.owned_decor.includes(id)) return false;
    if (bnGe(G.vibes, item.cost)) {
        G.vibes = bnSub(G.vibes, bnFromNumber(item.cost));
        G.owned_decor.push(id);
        G.active_decor[id] = true; // Auto-activate on purchase
        // Restore saved placement positions from previous runs (max 1 per decor),
        // or create a default placement so the item is always visible on canvas
        if (G.saved_decor_placements && G.saved_decor_placements[id]) {
            const saved = G.saved_decor_placements[id];
            G.placed_decor[id] = [saved[0]]; // Only keep first placement
        } else {
            G.placed_decor[id] = [{ x: 50, y: 50 }]; // Default position
        }
        notifyStateChange('decor');
        return true;
    }
    return false;
}

function activateDecor(id) {
    // Find item across all rooms
    let item = null;
    for (const roomId of Object.keys(ROOM_DECOR)) {
        item = ROOM_DECOR[roomId].find(d => d.id === id);
        if (item) break;
    }
    if (!item) return false;
    if (!G.owned_decor.includes(id)) return false;
    // Toggle: if already active, deactivate it (and remove from canvas); otherwise activate
    if (G.active_decor[id]) {
        delete G.active_decor[id];
        // Clear all placed instances from canvas to prevent duplicates
        if (G.placed_decor[id]) {
            delete G.placed_decor[id];
        }
    } else {
        G.active_decor[id] = true;
        // Restore saved placement positions when re-activating after prestige (max 1 per decor),
        // or create a default placement so the item is always visible on canvas
        if (G.saved_decor_placements && G.saved_decor_placements[id]) {
            const saved = G.saved_decor_placements[id];
            G.placed_decor[id] = [saved[0]]; // Only keep first placement
        } else if (!G.placed_decor[id] || G.placed_decor[id].length === 0) {
            G.placed_decor[id] = [{ x: 50, y: 50 }]; // Default position
        }
    }
    notifyStateChange('decor_active');
    return true;
}

function unlockRoom(id) {
    const room = ROOMS[id];
    if (!room) return false;
    if (G.unlocked_rooms.includes(id)) return false;
    if (bnGe(G.vibes, room.cost)) {
        G.vibes = bnSub(G.vibes, bnFromNumber(room.cost));
        G.unlocked_rooms.push(id);
        notifyStateChange('rooms');
        return true;
    }
    return false;
}

function switchRoom(id) {
    if (!G.unlocked_rooms.includes(id)) return false;
    G.current_room = id;
    notifyStateChange('room_switch');
    return true;
}

function doPrestige() {
    const gain = getPrestigeGain(G);
    if (bnLe(gain, BN_ZERO)) return false;
    G.total_pp_earned = bnAdd(G.total_pp_earned, gain);
    G.prestige_points = bnAdd(G.prestige_points, gain);
    G.total_prestiges = bnAdd(G.total_prestiges, BN_ONE);
    G.vibes = BN_ZERO;
    G.lifetime_vibes = BN_ZERO;        // Reset lifetime — must earn 10T again
    G.prestige_unlocked = false; // Must re-unlock prestige next run
    G.autoclickers = {};
    G.room_autoclickers = {};
    // Save decor placements before wiping so they can be restored on next run
    if (Object.keys(G.placed_decor || {}).length > 0) {
        G.saved_decor_placements = JSON.parse(JSON.stringify(G.placed_decor));
    }
    G.owned_decor = [];
    G.active_decor = {};
    G.placed_decor = {};
    // Reset rooms — non-persistent after prestige
    G.unlocked_rooms = ['campfire_grove'];
    G.current_room = 'campfire_grove';
    // NOTE: prestige_upgrades are KEPT — they're permanent
    notifyStateChange('prestige');
    return true;
}

// ---------- ACHIEVEMENT CHECKS ----------
function checkAchievements(state = G, vps = 0) {
    const newUnlocks = [];
    for (const ach of ACHIEVEMENTS) {
        if (state.achievements.includes(ach.id)) continue;
        let earned = false;
        switch (ach.threshold.type) {
            case 'lifetime':
                earned = bnGe(state.lifetime_vibes, bnFromNumber(ach.threshold.value));
                break;
            case 'clicks':
                earned = state.total_clicks >= ach.threshold.value;
                break;
            case 'prestiges':
                earned = bnGe(state.total_prestiges, ach.threshold.value);
                break;
            case 'room':
                earned = state.unlocked_rooms.includes(ach.threshold.value);
                break;
            case 'all_rooms':
                earned = Object.keys(ROOMS).every(id => state.unlocked_rooms.includes(id));
                break;
            case 'vps':
                earned = bnGe(vps, bnFromNumber(ach.threshold.value));
                break;
            case 'gateway':
                earned = state.gateway_bonus_active;
                break;
            case 'gateway_low':
                earned = state.gateway_bonus_active && state._gwLatency > 0 && state._gwLatency <= ach.threshold.value;
                break;
            case 'decor':
                earned = state.owned_decor.length >= ach.threshold.value;
                break;
            case 'pings':
                earned = state.total_gateway_pings >= ach.threshold.value;
                break;
            case 'autoclickers':
                // Sum from both legacy and room-based autoclickers
                let autoTotal = 0;
                for (const c of Object.values(state.autoclickers || {})) autoTotal += c || 0;
                for (const roomId of Object.keys(state.room_autoclickers || {})) {
                    for (const c of Object.values(state.room_autoclickers[roomId])) autoTotal += c || 0;
                }
                earned = autoTotal >= ach.threshold.value;
                break;
        }
        if (earned) {
            state.achievements.push(ach.id);
            newUnlocks.push(ach);
        }
    }
    return newUnlocks;
}

// ---------- STATE OBSERVERS ----------
function onStateChange(handler) {
    saveLoadHandlers.push(handler);
}

function notifyStateChange(type) {
    for (const h of saveLoadHandlers) h(type, G);
}

// ---------- SAVE / LOAD ----------
const MAX_OFFLINE_SECONDS = 86400; // Max 24h of offline progress
const BASE_OFFLINE_RATE = 0.01; // 1% base offline earnings

function calculateOfflineProgress(state = G) {
    const now = Date.now();
    const lastSave = state.last_save || now;
    const elapsedMs = Math.min(now - lastSave, MAX_OFFLINE_SECONDS * 1000);
    if (elapsedMs < 5000) return { seconds: 0, vps: 0, earned: 0, rate: 0 };
    
    const elapsedSec = elapsedMs / 1000;
    const vps = getVPS(state);
    // Offline rate: base 1% + prestige upgrades + tier bonuses
    let rate = BASE_OFFLINE_RATE;
    if (state.prestige_upgrades) {
        const ampCount = state.prestige_upgrades.offline_amp || 0;
        rate += 0.01 * ampCount;
    }
    rate += 0.01 * getTierAccumulated('offline', state);
    const earned = vps * elapsedSec * rate;
    return { seconds: elapsedSec, vps, earned: isFinite(earned) ? earned : Number.MAX_VALUE, rate };
}

function applyOfflineProgress() {
    const progress = calculateOfflineProgress(G);
    if (progress.earned > 0) {
        addVibes(progress.earned);
        console.log(`⏰ Offline progress: +${formatNumber(progress.earned)} vibes (${Math.round(progress.seconds)}s at ${formatNumber(progress.vps)} VPS)`);
        return progress;
    }
    return null;
}

function saveGame() {
    G.last_save = Date.now();
    try {
        const data = JSON.stringify(G);
        localStorage.setItem(CONFIG.SAVE_KEY, data);
        return true;
    } catch (e) {
        console.warn('Save failed:', e.message, 'data length:', JSON.stringify(G).length);
        return false;
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(CONFIG.SAVE_KEY);
        if (!raw) {
            resetGame();
            return false;
        }
        const data = JSON.parse(raw);
        // Merge carefully to handle new fields
        const defaults = getDefaultState();
        for (const key of Object.keys(defaults)) {
            if (data[key] !== undefined) G[key] = data[key];
            else G[key] = defaults[key];
        }
        // Legacy support: migrate old number format to BigNum
        if (typeof G.vibes === 'number') G.vibes = bnFromNumber(G.vibes);
        if (typeof G.lifetime_vibes === 'number') G.lifetime_vibes = bnFromNumber(G.lifetime_vibes);
        if (typeof G.prestige_points === 'number') G.prestige_points = bnFromNumber(G.prestige_points);
        if (typeof G.total_pp_earned === 'number') G.total_pp_earned = bnFromNumber(G.total_pp_earned);
        // Legacy support: ensure all expected keys exist
        if (!G.unlocked_rooms) G.unlocked_rooms = ['campfire_grove'];
        if (!G.owned_decor) G.owned_decor = [];
        if (!G.active_decor || typeof G.active_decor === 'object' && (
            G.active_decor.lighting !== undefined ||
            G.active_decor.plant !== undefined ||
            G.active_decor.furniture !== undefined
        )) {
            // Migrate from old type-map format to flat set
            const old = G.active_decor || {};
            G.active_decor = {};
            // Old DECOR_ITEMS lookup
            const OLD_DECOR = [
                { id: 'lamp_1', type: 'lighting' }, { id: 'plant_1', type: 'plant' },
                { id: 'furniture_1', type: 'furniture' }, { id: 'poster_1', type: 'wall' },
                { id: 'lamp_2', type: 'lighting' }, { id: 'rug_1', type: 'floor' },
                { id: 'lamp_3', type: 'lighting' }, { id: 'plant_2', type: 'plant' },
                { id: 'furniture_2', type: 'furniture' }, { id: 'poster_2', type: 'wall' },
                { id: 'rug_2', type: 'floor' }, { id: 'plant_3', type: 'plant' },
                { id: 'furniture_3', type: 'furniture' }, { id: 'poster_3', type: 'wall' },
                { id: 'table_1', type: 'furniture' }, { id: 'table_2', type: 'furniture' },
            ];
            for (const item of OLD_DECOR) {
                if (old[item.type] === item.id) G.active_decor[item.id] = true;
            }
        }
        if (!G.prestige_upgrades) G.prestige_upgrades = {};
        // Legacy: migrate old gateway_upgrades
        if (G.gateway_upgrades) {
            Object.assign(G.prestige_upgrades, G.gateway_upgrades);
            delete G.gateway_upgrades;
        }
        // Legacy: migrate boolean prestige_upgrades to count-based
        for (const [key, val] of Object.entries(G.prestige_upgrades)) {
            if (val === true) G.prestige_upgrades[key] = 1;
        }
        if (!G.achievements) G.achievements = [];
        if (!G.placed_decor) G.placed_decor = {};
        // Migration: truncate any decor with multiple placements to max 1
        if (G.placed_decor) {
            for (const key of Object.keys(G.placed_decor)) {
                if (Array.isArray(G.placed_decor[key]) && G.placed_decor[key].length > 1) {
                    G.placed_decor[key] = [G.placed_decor[key][0]];
                }
            }
        }
        if (G.saved_decor_placements) {
            for (const key of Object.keys(G.saved_decor_placements)) {
                if (Array.isArray(G.saved_decor_placements[key]) && G.saved_decor_placements[key].length > 1) {
                    G.saved_decor_placements[key] = [G.saved_decor_placements[key][0]];
                }
            }
        }
        // Per-room autoclickers migration
        if (!G.room_autoclickers) {
            G.room_autoclickers = {};
        }
        // Migrate old global autoclickers into current room if room is empty but global has data
        if (G.autoclickers && Object.keys(G.autoclickers).length > 0) {
            const room = G.current_room || 'campfire_grove';
            if (!G.room_autoclickers[room] || Object.keys(G.room_autoclickers[room]).length === 0) {
                G.room_autoclickers[room] = { ...G.autoclickers };
            }
        }
        if (G._gwMult === undefined) G._gwMult = 1.0;
        if (G._gwLabel === undefined) G._gwLabel = 'Disconnected';
        if (!G.settings) G.settings = defaults.settings;
        if (G.settings && G.settings.sidebar_position === undefined) G.settings.sidebar_position = 'left';
        if (G.settings && G.settings.music_shuffle === undefined) G.settings.music_shuffle = true;
        if (G.settings && G.settings.music_playing === undefined) G.settings.music_playing = true;
        if (G.settings && G.settings.music_track_index === undefined) G.settings.music_track_index = 0;
        if (G.prestige_unlocked === undefined) G.prestige_unlocked = false;
        notifyStateChange('load');
        return true;
    } catch (e) {
        console.warn('Load failed, resetting:', e);
        resetGame();
        return false;
    }
}

function resetGame() {
    G = getDefaultState();
    notifyStateChange('reset');
}

function hardReset() {
    localStorage.removeItem(CONFIG.SAVE_KEY);
    resetGame();
}

// ---------- EXPORTS ----------
export {
    G,
    CONFIG,
    ROOMS,
    ROOM_DECOR,
    getDecorForRoom,
    AUTOCLICKERS,
    ROOM_AUTOCLICKERS,
    PRESTIGE_UPGRADES,
    ACHIEVEMENTS,
    TIERS, getCurrentTier, getCurrentTierName, getTierFromPrestige,
    GOLDEN_COOKIE_TYPES,
    GOLDEN_COOKIE_INTERVAL_MIN,
    GOLDEN_COOKIE_INTERVAL_MAX,
    GOLDEN_COOKIE_DURATION,
    goldenCookieSystem,
    spawnGoldenCookie,
    collectGoldenCookie,
    getClickBoostMult,
    getVpsBoostMult,
    wrinklerSystem,
    SYNERGIES,
    getSynergyBonus, getSynergiesFrom, getSynergiesTo, getSynergyBoostInfo, getUpgradeName,
    getWrinklerPenalty,
    getEffectiveVpsMultiplier,
    updateWrinklers,
    popWrinkler,
    popAllWrinklers,
    getDefaultState,
    getCost,
    getBulkCost,
    getMaxBuyable,
    getVPS,
    getActiveDecorVpsMult,
    getClickValue,
    getPrestigeGain,
    getPrestigeThreshold,
    isPrestigeUnlockable,
    unlockPrestige,
    checkAchievements,
    formatNumber, formatBN,
    BN_ZERO, BN_ONE, bnFromNumber, bnCompare, bnAdd, bnSub, bnMul, bnDiv, bnFloor, bnLt, bnLe, bnGt, bnGe, bnEq, bnToNumber, bnPow,
    getPrestigeUpgradeCost,
    calculateOfflineProgress,
    applyOfflineProgress,
    addVibes,
    buyAutoclicker,
    buyPrestigeUpgrade,
    buyDecor,
    activateDecor,
    unlockRoom,
    switchRoom,
    doPrestige,
    onStateChange,
    saveGame,
    loadGame,
    hardReset,
    notifyStateChange,
};
