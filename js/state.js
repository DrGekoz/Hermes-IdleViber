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

function bnNormalize(bn) {
    let [m, e] = bn;
    if (m === 0 || !isFinite(m)) return BN_ZERO;
    if (!isFinite(e)) return BN(1, Number.MAX_SAFE_INTEGER);
    while (m >= 10) { m /= 10; e++; }
    while (m < 1 && m > 0) { m *= 10; e--; }
    return BN(m, e);
}

function bnFromNumber(n) {
    if (n === 0 || !isFinite(n)) return BN_ZERO;
    const abs = Math.abs(n);
    const e = Math.floor(Math.log10(abs));
    const m = abs / Math.pow(10, e);
    return BN(n < 0 ? -m : m, e);
}

function bnToNumber(bn) {
    if (bn[0] === 0) return 0;
    const [m, e] = bn;
    if (e > 308) return Infinity;
    if (e < -308) return 0;
    return m * Math.pow(10, e);
}

function bnAdd(a, b) {
    if (a[0] === 0) return b;
    if (b[0] === 0) return a;
    let [m1, e1] = a;
    let [m2, e2] = b;
    const diff = Math.abs(e1 - e2);
    if (diff > 15) return e1 > e2 ? a : b;
    const minE = Math.min(e1, e2);
    const sum = m1 * Math.pow(10, e1 - minE) + m2 * Math.pow(10, e2 - minE);
    return bnNormalize(BN(sum, minE));
}

function bnSub(a, b) {
    if (b[0] === 0) return a;
    let [m1, e1] = a;
    let [m2, e2] = b;
    const diff = Math.abs(e1 - e2);
    if (diff > 15) return e1 > e2 ? a : BN_ZERO;
    const minE = Math.min(e1, e2);
    const diff2 = m1 * Math.pow(10, e1 - minE) - m2 * Math.pow(10, e2 - minE);
    if (diff2 <= 0) return BN_ZERO;
    return bnNormalize(BN(diff2, minE));
}

function bnMul(a, b) {
    if (a[0] === 0 || b[0] === 0) return BN_ZERO;
    return bnNormalize(BN(a[0] * b[0], a[1] + b[1]));
}

function bnDiv(a, b) {
    if (b[0] === 0) return BN(1, Number.MAX_SAFE_INTEGER);
    if (a[0] === 0) return BN_ZERO;
    return bnNormalize(BN(a[0] / b[0], a[1] - b[1]));
}

function bnCompare(a, b) {
    // Accept both BN arrays and regular numbers
    if (typeof a === 'number') a = bnFromNumber(a);
    if (typeof b === 'number') b = bnFromNumber(b);
    if (a[0] === 0 && b[0] === 0) return 0;
    if (a[0] === 0) return -1;
    if (b[0] === 0) return 1;
    if (a[1] > b[1]) return 1;
    if (a[1] < b[1]) return -1;
    return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0;
}

function bnFloor(bn) {
    if (bn[0] === 0) return BN_ZERO;
    let [m, e] = bn;
    if (e < 0) return BN_ZERO;
    if (e > 15) return bn;
    const val = Math.floor(m * Math.pow(10, e));
    return bnFromNumber(val);
}

function bnLt(a, b) { return bnCompare(a, b) < 0; }
function bnLe(a, b) { return bnCompare(a, b) <= 0; }
function bnGt(a, b) { return bnCompare(a, b) > 0; }
function bnGe(a, b) { return bnCompare(a, b) >= 0; }
function bnEq(a, b) { return bnCompare(a, b) === 0; }

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
// ---------- TIERS (prestige-based permanent upgrades) ----------
// Generated programmatically: 250 tiers scaling from 1 to 10Q prestiges
const TIERS = (function() {
    const tiers = [];
    const types = ['click', 'vps', 'offline', 'all', 'click', 'vps', 'rooms'];
    const prefixes = ['Bronze','Silver','Gold','Platinum','Diamond','Master','Grand','Royal','Noble','Solar',
        'Lunar','Stellar','Cosmic','Void','Eternal','Infinite','Omega','Alpha','Prime','Ultra',
        'Hyper','Mega','Giga','Tera','Peta','Exa','Zetta','Yotta','Nova','Quasar',
        'Pulsar','Nebula','Galaxy','Meteor','Comet','Astral','Celestial','Orbital','Solaris','Lumina',
        'Crystal','Obsidian','Onyx','Ruby','Emerald','Sapphire','Amethyst','Topaz','Jade','Opal',
        'Titan','Atlas','Hero','Legend','Mythic','Fabled','Ancient','Elder','Primal','Origin',
        'Zenith','Apex','Pinnacle','Summit','Acme','Peak','Crown','Glory','Victor','Champion',
        'Sage','Wise','Knight','Paladin','Guardian','Sentinel','Warden','Ranger','Seeker','Hunter',
        'Phoenix','Dragon','Griffin','Seraph','Angel','Titan','Colossus','Giant','Behemoth','Leviathan',
        'Storm','Thunder','Lightning','Blaze','Inferno','Ember','Flame','Spark','Volt','Surge',
        'Frost','Glacier','Arctic','Tundra','Permafrost','Crystal','Shard','Rime','Hail','Blizzard',
        'Shadow','Shade','Dusk','Twilight','Night','Dark','Eclipse','Void','Abyss','Depth',
        'Spirit','Ghost','Wraith','Phantom','Specter','Haunt','Mystic','Arcane','Ethereal','Astral',
        'Iron','Steel','Copper','Tin','Zinc','Brass','Alloy','Metal','Forge','Anvil',
        'Silk','Satin','Velvet','Linen','Cotton','Fiber','Thread','Weave','Spun','Twine',
        'Coral','Reef','Tide','Wave','Swell','Current','Drift','Flow','Stream','River',
        'Moss','Fern','Leaf','Petal','Bloom','Grove','Forest','Jungle','Thicket','Wild',
        'Dune','Rock','Stone','Pebble','Boulder','Cliff','Crag','Summit','Peak','Ridge',
        'Haze','Mist','Fog','Cloud','Sky','Aether','Wind','Gale','Breeze','Zephyr'];
    for (let i = 0; i < 250; i++) {
        const tierNum = i + 1;
        const base = Math.pow(1.15, i);
        const requires = Math.max(1, Math.round(base));
        const type = types[i % types.length];
        const p1 = prefixes[i % prefixes.length];
        const p2 = prefixes[(i * 3 + 7) % prefixes.length];
        const name = p1 + ' ' + p2;
        const multFactor = Math.max(1, Math.floor(tierNum / 5) + 1);
        let bonus, value;
        switch (type) {
            case 'click': value = multFactor; bonus = '×' + value + ' click power'; break;
            case 'vps': value = multFactor; bonus = '×' + value + ' VPS'; break;
            case 'offline': value = Math.min(multFactor, 1000); bonus = '+' + value + '% offline'; break;
            case 'all': value = multFactor; bonus = '×' + value + ' all'; break;
            case 'rooms': value = 1; bonus = 'Unlock rooms faster'; break;
            default: value = 1; bonus = '×' + value; break;
        }
        tiers.push({ id: 'tier_' + tierNum, name, requires, bonus, type, value });
    }
    return tiers;
})();
function getCurrentTier(state = G) {
    let tier = 0;
    for (const t of TIERS) {
        if (state.total_prestiges >= t.requires) tier = t.requires;
    }
    return tier;
}

function getCurrentTierName(state = G) {
    const level = getCurrentTier(state);
    if (level <= 0) return '—';
    const tier = TIERS.find(t => t.requires === level);
    return tier ? tier.name : 'T' + level;
}

function getTierFromPrestige(count) {
    let tier = 0;
    for (const t of TIERS) {
        if (count >= t.requires) tier = t.requires;
    }
    return tier;
}

// ---------- ACHIEVEMENTS ----------
const ACHIEVEMENTS = [
    // Vibe milestones
    { id: 'vibe_1k',      name: 'Getting Started',    desc: 'Earn 1K total vibes',         icon: '⭐', threshold: { type: 'lifetime', value: 1_000 } },
    { id: 'vibe_10k',     name: 'Five Figures',       desc: 'Earn 10K total vibes',        icon: '🔸', threshold: { type: 'lifetime', value: 10_000 } },
    { id: 'vibe_100k',    name: 'Six Figures',        desc: 'Earn 100K total vibes',       icon: '🔶', threshold: { type: 'lifetime', value: 100_000 } },
    { id: 'vibe_1m',      name: 'Vibe Millionaire',   desc: 'Earn 1M total vibes',         icon: '🌟', threshold: { type: 'lifetime', value: 1_000_000 } },
    { id: 'vibe_10m',     name: 'Deca-Million',       desc: 'Earn 10M total vibes',        icon: '💫', threshold: { type: 'lifetime', value: 10_000_000 } },
    { id: 'vibe_100m',    name: 'Hecto-Million',      desc: 'Earn 100M total vibes',       icon: '✨', threshold: { type: 'lifetime', value: 100_000_000 } },
    { id: 'vibe_1b',      name: 'Billion Vibes',      desc: 'Earn 1B total vibes',         icon: '💎', threshold: { type: 'lifetime', value: 1_000_000_000 } },
    { id: 'vibe_10b',     name: 'Ten Billion Club',   desc: 'Earn 10B total vibes',        icon: '🔮', threshold: { type: 'lifetime', value: 10_000_000_000 } },
    { id: 'vibe_100b',    name: 'Hundred Billion',    desc: 'Earn 100B total vibes',       icon: '🌠', threshold: { type: 'lifetime', value: 100_000_000_000 } },
    { id: 'vibe_1t',      name: 'Trillionaire',       desc: 'Earn 1T total vibes',         icon: '👑', threshold: { type: 'lifetime', value: 1_000_000_000_000 } },
    { id: 'vibe_10t',     name: 'Ten Trillion',       desc: 'Earn 10T total vibes',        icon: '🎯', threshold: { type: 'lifetime', value: 10_000_000_000_000 } },
    { id: 'vibe_100t',    name: 'Quad Vibes',         desc: 'Earn 100T total vibes',       icon: '🪐', threshold: { type: 'lifetime', value: 100_000_000_000_000 } },
    // Click milestones
    { id: 'click_50',     name: 'First Clicks',       desc: 'Click 50 times',              icon: '☝️', threshold: { type: 'clicks', value: 50 } },
    { id: 'click_100',    name: 'Finger Exercise',    desc: 'Click 100 times',             icon: '👆', threshold: { type: 'clicks', value: 100 } },
    { id: 'click_500',    name: 'Getting Rhythm',     desc: 'Click 500 times',             icon: '🎵', threshold: { type: 'clicks', value: 500 } },
    { id: 'click_1k',     name: 'Clickathon',         desc: 'Click 1,000 times',           icon: '🎪', threshold: { type: 'clicks', value: 1_000 } },
    { id: 'click_10k',    name: 'Carpal Tunnel',      desc: 'Click 10,000 times',          icon: '🖱️', threshold: { type: 'clicks', value: 10_000 } },
    { id: 'click_100k',   name: 'Click Obsession',    desc: 'Click 100,000 times',         icon: '🌀', threshold: { type: 'clicks', value: 100_000 } },
    { id: 'click_1m',     name: 'Click Addict',       desc: 'Click 1,000,000 times',       icon: '⚡', threshold: { type: 'clicks', value: 1_000_000 } },
    { id: 'click_10m',    name: 'Legendary Clicker',  desc: 'Click 10,000,000 times',      icon: '🔥', threshold: { type: 'clicks', value: 10_000_000 } },
    // Prestige milestones
    { id: 'prestige_1',   name: 'First Reset',        desc: 'Prestige once',               icon: '💎', threshold: { type: 'prestiges', value: 1 } },
    { id: 'prestige_3',   name: 'Triple Threat',      desc: 'Prestige 3 times',            icon: '♻️', threshold: { type: 'prestiges', value: 3 } },
    { id: 'prestige_5',   name: 'Veteran',            desc: 'Prestige 5 times',            icon: '🔷', threshold: { type: 'prestiges', value: 5 } },
    { id: 'prestige_10',  name: 'Prestige Master',    desc: 'Prestige 10 times',           icon: '💠', threshold: { type: 'prestiges', value: 10 } },
    { id: 'prestige_25',  name: 'Prestige Lord',      desc: 'Prestige 25 times',           icon: '👾', threshold: { type: 'prestiges', value: 25 } },
    { id: 'prestige_50',  name: 'Ascended Being',     desc: 'Prestige 50 times',           icon: '🌌', threshold: { type: 'prestiges', value: 50 } },
    // Room milestones
    { id: 'room_cyber',   name: 'Digital Denizen',    desc: 'Unlock the Cyber Den',        icon: '🖥️', threshold: { type: 'room', value: 'cyber_den' } },
    { id: 'room_zen',     name: 'Zen Master',         desc: 'Unlock the Zen Garden',       icon: '🧘', threshold: { type: 'room', value: 'zen_garden' } },
    { id: 'room_star',    name: 'Stargazer',          desc: 'Unlock the Star Deck',        icon: '🔭', threshold: { type: 'room', value: 'star_deck' } },
    { id: 'room_study',   name: 'Scholar',            desc: 'Unlock the Study Lounge',     icon: '📚', threshold: { type: 'room', value: 'study_lounge' } },
    { id: 'room_beach',   name: 'Beachcomber',        desc: 'Unlock the Beach Cove',       icon: '🏖️', threshold: { type: 'room', value: 'beach_cove' } },
    { id: 'room_all',     name: 'Everywhere At Once', desc: 'Unlock all 6 rooms',          icon: '🌐', threshold: { type: 'all_rooms', value: 1 } },
    // VPS milestones
    { id: 'vps_10',       name: 'Ten Per Second',     desc: 'Reach 10 VPS',                icon: '🐢', threshold: { type: 'vps', value: 10 } },
    { id: 'vps_100',      name: 'Triple Digits',      desc: 'Reach 100 VPS',               icon: '🚀', threshold: { type: 'vps', value: 100 } },
    { id: 'vps_1k',       name: 'Kilovibe',           desc: 'Reach 1K VPS',                icon: '💨', threshold: { type: 'vps', value: 1_000 } },
    { id: 'vps_10k',      name: 'Vibe Engine',        desc: 'Reach 10K VPS',               icon: '⚙️', threshold: { type: 'vps', value: 10_000 } },
    { id: 'vps_100k',     name: 'Vibe Turbine',       desc: 'Reach 100K VPS',              icon: '🏎️', threshold: { type: 'vps', value: 100_000 } },
    { id: 'vps_1m',       name: 'Vibe Factory',       desc: 'Reach 1M VPS',                icon: '🏭', threshold: { type: 'vps', value: 1_000_000 } },
    { id: 'vps_10m',      name: 'Vibe Metropolis',    desc: 'Reach 10M VPS',               icon: '🏙️', threshold: { type: 'vps', value: 10_000_000 } },
    { id: 'vps_100m',     name: 'Vibe Planet',        desc: 'Reach 100M VPS',              icon: '🌍', threshold: { type: 'vps', value: 100_000_000 } },
    { id: 'vps_1b',       name: 'Industrial Scale',   desc: 'Reach 1B VPS',                icon: '🌌', threshold: { type: 'vps', value: 1_000_000_000 } },
    // Gateway milestones
    { id: 'gw_first',     name: 'Gateway Connected',  desc: 'Connect to Hermes Gateway',   icon: '🔌', threshold: { type: 'gateway', value: 1 } },
    { id: 'gw_quality',   name: 'Low Latency',        desc: 'Achieve <10ms gateway ping',  icon: '⚡', threshold: { type: 'gateway_low', value: 10 } },
    { id: 'gw_ultra',     name: 'Ultra Low Latency',  desc: 'Achieve <3ms gateway ping',   icon: '💥', threshold: { type: 'gateway_low', value: 3 } },
    { id: 'gw_ping_100',  name: 'Ping Pro',           desc: 'Ping gateway 100 times',      icon: '📡', threshold: { type: 'pings', value: 100 } },
    { id: 'gw_ping_1k',   name: 'Ping Master',        desc: 'Ping gateway 1,000 times',    icon: '🛰️', threshold: { type: 'pings', value: 1_000 } },
    // Decor milestones
    { id: 'decor_1',      name: 'First Decoration',   desc: 'Buy your first decor item',   icon: '🎀', threshold: { type: 'decor', value: 1 } },
    { id: 'decor_5',      name: 'Decorator',          desc: 'Buy 5 decor items',           icon: '🎨', threshold: { type: 'decor', value: 5 } },
    { id: 'decor_10',     name: 'Home Stager',        desc: 'Buy 10 decor items',          icon: '🪑', threshold: { type: 'decor', value: 10 } },
    { id: 'decor_25',     name: 'Interior Designer',  desc: 'Buy 25 decor items',          icon: '🏠', threshold: { type: 'decor', value: 25 } },
    { id: 'decor_50',     name: 'Collector',          desc: 'Buy 50 decor items',          icon: '🏛️', threshold: { type: 'decor', value: 50 } },
    { id: 'decor_90',     name: 'Hoarder Supreme',    desc: 'Buy all 90 decor items',      icon: '🏰', threshold: { type: 'decor', value: 90 } },
    // Autoclicker milestones
    { id: 'auto_10',      name: 'Automation Begins',  desc: 'Buy 10 total autoclickers',   icon: '🤖', threshold: { type: 'autoclickers', value: 10 } },
    { id: 'auto_50',      name: 'Robot Army',         desc: 'Buy 50 total autoclickers',   icon: '🦾', threshold: { type: 'autoclickers', value: 50 } },
    { id: 'auto_100',     name: 'Fully Automated',    desc: 'Buy 100 total autoclickers',  icon: '🤖', threshold: { type: 'autoclickers', value: 100 } },
    // Tier milestones — 250 achievements, one per tier
    ...(() => {
        const names = [];
        const prefixes = ['Bronze','Silver','Gold','Platinum','Diamond','Master','Grand','Royal','Noble','Solar',
            'Lunar','Stellar','Cosmic','Void','Eternal','Infinite','Omega','Alpha','Prime','Ultra',
            'Hyper','Mega','Giga','Tera','Peta','Exa','Zetta','Yotta','Nova','Quasar',
            'Pulsar','Nebula','Galaxy','Meteor','Comet','Astral','Celestial','Orbital','Solaris','Lumina',
            'Crystal','Obsidian','Onyx','Ruby','Emerald','Sapphire','Amethyst','Topaz','Jade','Opal',
            'Titan','Atlas','Hero','Legend','Mythic','Fabled','Ancient','Elder','Primal','Origin',
            'Zenith','Apex','Pinnacle','Summit','Acme','Peak','Crown','Glory','Victor','Champion',
            'Sage','Wise','Knight','Paladin','Guardian','Sentinel','Warden','Ranger','Seeker','Hunter',
            'Phoenix','Dragon','Griffin','Seraph','Angel','Titan','Colossus','Giant','Behemoth','Leviathan',
            'Storm','Thunder','Lightning','Blaze','Inferno','Ember','Flame','Spark','Volt','Surge',
            'Frost','Glacier','Arctic','Tundra','Permafrost','Crystal','Shard','Rime','Hail','Blizzard',
            'Shadow','Shade','Dusk','Twilight','Night','Dark','Eclipse','Void','Abyss','Depth',
            'Spirit','Ghost','Wraith','Phantom','Specter','Haunt','Mystic','Arcane','Ethereal','Astral',
            'Iron','Steel','Copper','Tin','Zinc','Brass','Alloy','Metal','Forge','Anvil',
            'Silk','Satin','Velvet','Linen','Cotton','Fiber','Thread','Weave','Spun','Twine',
            'Coral','Reef','Tide','Wave','Swell','Current','Drift','Flow','Stream','River',
            'Moss','Fern','Leaf','Petal','Bloom','Grove','Forest','Jungle','Thicket','Wild',
            'Dune','Rock','Stone','Pebble','Boulder','Cliff','Crag','Summit','Peak','Ridge',
            'Haze','Mist','Fog','Cloud','Sky','Aether','Wind','Gale','Breeze','Zephyr'];
        const icons = ['🥉','🥈','🥇','💎','💠','🎖️','👑','🌟','🔮','⚡','🕳️','🌀','∞','🚀','💥','🌍','💰','🏛️','🪐','🌌','⭐','✨','🔥','💫','🌈','🦄','🐉','🦅','🦊','🐺','🦁','🐯','🦈','🐋','🦀','🐙','🦑','🐍','🦎','🐢'];
        for (let i = 0; i < 250; i++) {
            const tierNum = i + 1;
            const t = TIERS[i];
            if (!t) break;
            const p1 = prefixes[i % prefixes.length];
            const p2 = prefixes[(i * 3 + 7) % prefixes.length];
            const name = p1 + ' ' + p2;
            names.push({ id: 'tier_ach_' + tierNum, name, desc: 'Reach tier ' + tierNum + ' (' + t.name + ')', icon: icons[i % icons.length], threshold: { type: 'prestiges', value: t.requires } });
        }
        return names;
    })(),
];

// ---------- DEFAULT GAME STATE ----------
function getDefaultState() {
    return {
        version: 1,
        vibes: BN_ZERO,
        lifetime_vibes: BN_ZERO,
        prestige_points: BN_ZERO,
        total_pp_earned: BN_ZERO,
        total_prestiges: 0,
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
            sidebar_position: 'left', // 'left' | 'right'
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
    const maxWrinklers = Math.max(1, Math.min(WRINKLER_COUNT_MAX, Math.floor(state.total_prestiges + 1)));
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
    { id: 'win95_syn',     name: 'Retro Boost',    desc: 'Win95 PC boosts first 3 PCs by 50%',       prereq: 'win95',    reqCount: 1,    targetTiers: ['win95','win98','imac_g3'], mult: 0.5 },
    { id: 'mac_g3_syn',    name: 'Legacy Bridge',  desc: 'iMac G3 boosts Mac Mini & Mac Studio by 75%', prereq: 'imac_g3', reqCount: 3,    targetTiers: ['mac_mini','mac_studio'], mult: 0.75 },
    { id: 'gaming_syn',    name: 'RGB Overdrive',  desc: 'Gaming Rig boosts RTX & DGX by 100%',      prereq: 'gaming_rig', reqCount: 2, targetTiers: ['rtx_setup','dgx_pod'], mult: 1.0 },
    { id: 'server_syn',    name: 'Cluster Link',   desc: 'Server Rack boosts Satellite by 150%',     prereq: 'server_rack', reqCount: 3, targetTiers: ['satellite'], mult: 1.5 },
    { id: 'quantum_syn',   name: 'Quantum Link',   desc: 'Quantum Core boosts all by 25%',            prereq: 'quantum', reqCount: 2,    targetTiers: ['dyson'], mult: 2.0 },
];

function getSynergyBonus(autoclickerId, state = G) {
    let bonus = 0;
    for (const syn of SYNERGIES) {
        const ownedCount = state.autoclickers[syn.prereq] || 0;
        if (ownedCount >= syn.reqCount && syn.targetTiers.includes(autoclickerId)) {
            bonus += syn.mult;
        }
    }
    return bonus;
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
    // Combine as BN: vps * gwMult * roomMult * permaMult * vpsBoost * wrinkleMult
    let result = bnFromNumber(vps);
    result = bnMul(result, bnFromNumber(gwMult));
    result = bnMul(result, bnFromNumber(roomMult));
    result = bnMul(result, permaMult);
    result = bnMul(result, bnFromNumber(vpsBoost));
    result = bnMul(result, bnFromNumber(wrinkleMult));
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
    let result = bnMul(bnFromNumber(base), clickMult);
    result = bnMul(result, permaMult);
    result = bnMul(result, bnFromNumber(gcBoost));
    return result;
}

// Prestige threshold scales with prestige count: n*(n+9) trillion where n = next prestige #
// 1st: 10T, 2nd: 22T, 3rd: 36T, 4th: 52T, 5th: 70T, 6th: 90T, 7th: 112T, ...
function getPrestigeThreshold(state = G) {
    const n = (state.total_prestiges || 0) + 1;
    return n * (n + 9) * 1_000_000_000_000;
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
    // If total room cost > threshold, require all 6 rooms
    const totalRoomCost = Object.values(ROOMS).reduce((sum, r) => sum + r.cost, 0);
    if (totalRoomCost > threshold) {
        const allRoomIds = Object.keys(ROOMS);
        return allRoomIds.every(id => state.unlocked_rooms.includes(id));
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
    if (bn[0] === 0) return '0';
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
    // InfZ system: compute from exponent directly
    const C = S + 1; // 48 states per layer
    let beyond = groupIdx - S;
    let pos = (beyond - 1) % C;
    let count = Math.floor((beyond - 1) / C) + 1;
    // Format the layer count
    let countIdx = 0;
    let tmp = count;
    while (tmp >= 1000) { tmp /= 1000; countIdx++; }
    let prefix;
    if (countIdx <= S) {
        let cntStr = String(Math.floor(count));
        if (countIdx > 0) cntStr = (count / Math.pow(1000, countIdx)).toFixed(2) + suffixesList[countIdx - 1];
        prefix = 'InfZ x (' + cntStr;
    } else {
        // Multi-layer — rare but handled
        let innerBeyond = countIdx - S;
        let innerPos = (innerBeyond - 1) % C;
        let innerCount = Math.floor((innerBeyond - 1) / C) + 1;
        let innerStr = 'InfZ x InfZ (' + (innerCount > 0 ? innerCount : '1');
        if (innerPos > 0) innerStr += suffixesList[innerPos - 1];
        innerStr += ')';
        return innerStr;
    }
    if (pos > 0) prefix += suffixesList[pos - 1];
    prefix += ')';
    return prefix;
}

function formatNumber(n) {
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
    let pos = (beyond - 1) % C;
    let count = Math.floor((beyond - 1) / C) + 1;

    // If the count itself is in InfinityZ range (its idx > S),
    // then we need a multi-layer display.
    let countIdx = 0;
    let tmp = count;
    while (tmp >= 1000) { tmp /= 1000; countIdx++; }

    let prefix;
    if (countIdx <= S) {
        // Count is in normal range — just format it
        prefix = 'InfZ x (' + formatNumberSuffix(count, suffixes, S);
    } else {
        // Count itself needs InfinityZ — wrap recursively
        // Show: InfZ x InfZ (inner_count + suffix)
        let innerBeyond = countIdx - S;
        let innerPos = (innerBeyond - 1) % C;
        let innerCount = Math.floor((innerBeyond - 1) / C) + 1;
        
        let innerStr = 'InfZ x InfZ (' + formatNumberSuffix(innerCount, suffixes, S);
        if (innerPos > 0) innerStr += suffixes[innerPos - 1];
        innerStr += ')';
        return innerStr;
    }

    if (pos > 0) {
        prefix += suffixes[pos - 1];
    }
    prefix += ')';
    return prefix;
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
    const count = G.prestige_upgrades[id] || 0;
    const rawCost = upg.baseCost * Math.pow(upg.costMult, count);
    const cost = !isFinite(rawCost) ? Infinity : Math.floor(rawCost);
    if (bnGe(G.prestige_points, cost)) {
        G.prestige_points = bnSub(G.prestige_points, bnFromNumber(cost));
        G.prestige_upgrades[id] = count + 1;
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
    G.total_prestiges += 1;
    G.vibes = BN_ZERO;
    G.lifetime_vibes = BN_ZERO;        // Reset lifetime — must earn 10T again
    G.prestige_unlocked = false; // Must re-unlock prestige next run
    G.autoclickers = {};
    G.room_autoclickers = {};
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
                earned = state.lifetime_vibes >= ach.threshold.value;
                break;
            case 'clicks':
                earned = state.total_clicks >= ach.threshold.value;
                break;
            case 'prestiges':
                earned = state.total_prestiges >= ach.threshold.value;
                break;
            case 'room':
                earned = state.unlocked_rooms.includes(ach.threshold.value);
                break;
            case 'all_rooms':
                earned = Object.keys(ROOMS).every(id => state.unlocked_rooms.includes(id));
                break;
            case 'vps':
                earned = vps >= ach.threshold.value;
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
                earned = Object.values(state.autoclickers).reduce((a, b) => a + b, 0) >= ach.threshold.value;
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
    // Offline rate: base 1% + upgrades
    let rate = BASE_OFFLINE_RATE;
    if (state.prestige_upgrades) {
        const ampCount = state.prestige_upgrades.offline_amp || 0;
        rate += 0.01 * ampCount;
    }
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
    getSynergyBonus,
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
    formatNumber,
    BN_ZERO, BN_ONE, bnFromNumber, bnCompare, bnAdd, bnSub, bnMul, bnDiv, bnFloor, bnLt, bnLe, bnGt, bnGe, bnEq, bnToNumber,
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
