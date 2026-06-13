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

// ---------- ROOMS & THEMES ----------
const ROOMS = {
    campfire_grove: {
        id: 'campfire_grove',
        name: 'Campfire Grove',
        bgImage: 'sprites/images/bg/bg_campfire.png',
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
        bgImage: 'sprites/images/bg/bg_cyber.png',
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
        bgImage: 'sprites/images/bg/bg_zen_garden.png',
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
        bgImage: 'sprites/images/bg/bg_star_deck.png',
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
        bgImage: 'sprites/images/bg/bg_study_lounge.png',
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
        bgImage: 'sprites/images/bg/bg_beach_cove.png',
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
];

// ---------- DEFAULT GAME STATE ----------
function getDefaultState() {
    return {
        version: 1,
        vibes: 0,
        lifetime_vibes: 0,
        prestige_points: 0,
        total_pp_earned: 0,
        total_prestiges: 0,
        prestige_unlocked: false,    // Prestige must be re-unlocked each time
        transcend_points: 0,
        transcend_upgrades: {},
        autoclickers: {},
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
    for (const [id, count] of Object.entries(state.autoclickers)) {
        const tier = AUTOCLICKERS.find(t => t.id === id);
        if (tier) {
            let tierVps = tier.vps * count;
            // Apply synergy bonuses
            const synBonus = getSynergyBonus(id, state);
            tierVps *= (1 + synBonus);
            vps += tierVps;
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
    // Decor VPS multiplier (from active decor items)
    const roomMult = getActiveDecorVpsMult(state);
    // Permanent multiplier from prestige chips (count-based)
    let permaMult = 1;
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'perma_mult' && count) permaMult *= Math.pow(upg.value, count);
    }
    // VPS boost from golden cookie
    const vpsBoost = getVpsBoostMult();
    // Wrinkler penalty
    const wrinkleMult = getEffectiveVpsMultiplier(state);
    return vps * gwMult * roomMult * permaMult * vpsBoost * wrinkleMult;
}

function getClickValue(state = G) {
    let base = 1;
    let clickMult = 1;
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'click_mult' && count) clickMult *= Math.pow(upg.value, count);
    }
    // Permanent multiplier from prestige chips (count-based)
    let permaMult = 1;
    for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
        const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'perma_mult' && count) permaMult *= Math.pow(upg.value, count);
    }
    // Golden cookie click boost
    const gcBoost = getClickBoostMult();
    return Math.floor(base * clickMult * permaMult * gcBoost);
}

// Prestige threshold scales with prestige count: n*(n+9) trillion where n = next prestige #
// 1st: 10T, 2nd: 22T, 3rd: 36T, 4th: 52T, 5th: 70T, 6th: 90T, 7th: 112T, ...
function getPrestigeThreshold(state = G) {
    const n = (state.total_prestiges || 0) + 1;
    return n * (n + 9) * 1_000_000_000_000;
}

function getPrestigeGain(state = G) {
    // Must be unlocked first
    if (!state.prestige_unlocked) return 0;
    const threshold = getPrestigeThreshold(state);
    if (state.lifetime_vibes < threshold) return 0;
    // Base 50 chips + 1 per 1T lifetime vibes
    return 50 + Math.floor(state.lifetime_vibes / 1_000_000_000_000);
}

function isPrestigeUnlockable(state = G) {
    const threshold = getPrestigeThreshold(state);
    // Check if lifetime vibes >= threshold
    if (state.lifetime_vibes < threshold) return false;
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

function formatNumber(n) {
    if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k';
    if (n >= 1) return Math.floor(n).toString();
    // Fractional — for VPS display, this is critical
    if (n >= 0.01) return n.toFixed(2);
    if (n >= 0.0001) return n.toFixed(4);
    if (n > 0) return n.toExponential(1);
    return '0';
}

// ---------- STATE ACTIONS ----------
function addVibes(amount) {
    G.vibes += amount;
    G.lifetime_vibes += amount;
    notifyStateChange('vibes');
}

function buyAutoclicker(id, quantity = 1) {
    const tier = AUTOCLICKERS.find(t => t.id === id);
    if (!tier) return false;
    const count = G.autoclickers[id] || 0;
    
    if (quantity === 'max') {
        quantity = getMaxBuyable(tier.baseCost, count, G.vibes);
        if (quantity === 0) return false;
    }
    
    const totalCost = getBulkCost(tier.baseCost, count, quantity);
    if (G.vibes >= totalCost) {
        G.vibes -= totalCost;
        G.autoclickers[id] = count + quantity;
        notifyStateChange('autoclickers');
        return quantity;
    }
    return false;
}

function buyPrestigeUpgrade(id) {
    const upg = PRESTIGE_UPGRADES.find(u => u.id === id);
    if (!upg) return false;
    const count = G.prestige_upgrades[id] || 0;
    const cost = Math.floor(upg.baseCost * Math.pow(upg.costMult, count));
    if (G.prestige_points >= cost) {
        G.prestige_points -= cost;
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
    if (G.vibes >= item.cost) {
        G.vibes -= item.cost;
        G.owned_decor.push(id);
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
    if (G.vibes >= room.cost) {
        G.vibes -= room.cost;
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
    if (gain <= 0) return false;
    G.total_pp_earned += gain;
    G.prestige_points += gain;
    G.total_prestiges += 1;
    G.vibes = 0;
    G.lifetime_vibes = 0;        // Reset lifetime — must earn 10T again
    G.prestige_unlocked = false; // Must re-unlock prestige next run
    G.autoclickers = {};
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

function calculateOfflineProgress(state = G) {
    const now = Date.now();
    const lastSave = state.last_save || now;
    const elapsedMs = Math.min(now - lastSave, MAX_OFFLINE_SECONDS * 1000);
    if (elapsedMs < 5000) return 0; // Less than 5s — not worth showing
    
    const elapsedSec = elapsedMs / 1000;
    const vps = getVPS(state);
    const earned = vps * elapsedSec;
    return { seconds: elapsedSec, vps, earned };
}

function applyOfflineProgress() {
    const progress = calculateOfflineProgress(G);
    if (progress.earned > 0) {
        G.vibes += progress.earned;
        G.lifetime_vibes += progress.earned;
        console.log(`⏰ Offline progress: +${formatNumber(progress.earned)} vibes (${Math.round(progress.seconds)}s at ${formatNumber(progress.vps)} VPS)`);
        return progress;
    }
    return null;
}

function saveGame() {
    // Sanity check: don't save bugged prestige values
    if (G.total_pp_earned > 50000 || G.prestige_points > 50000) {
        console.warn('Blocked save of bugged prestige values');
        return false;
    }
    G.last_save = Date.now();
    try {
        const data = JSON.stringify(G);
        localStorage.setItem(CONFIG.SAVE_KEY, data);
        return true;
    } catch (e) {
        console.warn('Save failed:', e);
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
        // Sanity check: detect impossibly high prestige from old bugged formula
        if (data.total_pp_earned > 50000 || data.prestige_points > 50000) {
            console.warn('Save has bugged prestige values (' + data.total_pp_earned + ' PP) — resetting');
            localStorage.removeItem(CONFIG.SAVE_KEY);
            resetGame();
            return false;
        }
        // Merge carefully to handle new fields
        const defaults = getDefaultState();
        for (const key of Object.keys(defaults)) {
            if (data[key] !== undefined) G[key] = data[key];
            else G[key] = defaults[key];
        }
        // Legacy support: ensure all expected keys exist
        if (!G.unlocked_rooms) G.unlocked_rooms = ['campfire_grove'];
        if (!G.owned_decor) G.owned_decor = [];
        if (!G.active_decor || typeof G.active_decor === 'object' && (G.active_decor.lighting !== undefined || Object.keys(G.active_decor).length === 5)) {
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
    PRESTIGE_UPGRADES,
    ACHIEVEMENTS,
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
