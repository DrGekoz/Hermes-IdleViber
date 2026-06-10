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
    PRESTIGE_THRESHOLD: 1_000_000,
};

// ---------- ROOMS & THEMES ----------
const ROOMS = {
    campfire_grove: {
        id: 'campfire_grove',
        name: 'Campfire Grove',
        desc: 'A warm crackling fire under starry skies',
        cost: 0,
        unlocked: true,
        vpsMult: 1.0,
        bg: ['#1a0e0a', '#2b1a10', '#0f0806'],
        fg: ['#ff6b35', '#ffaa44', '#ffdd88'],
        musicGenre: 'chill',
        sprites: ['campfire', 'trees', 'stars', 'smoke'],
    },
    cyber_den: {
        id: 'cyber_den',
        name: 'Cyber Den',
        desc: 'Neon-lit digital hideout',
        cost: 1_000_000,
        unlocked: false,
        vpsMult: 1.5,
        bg: ['#0a001a', '#1a0033', '#000011'],
        fg: ['#ff00ff', '#00ffff', '#ff0066'],
        musicGenre: 'cyber',
        sprites: ['server_rack', 'neon_sign', 'matrix_rain', 'hologram'],
    },
    zen_garden: {
        id: 'zen_garden',
        name: 'Zen Garden',
        desc: 'Peaceful bamboo grove with flowing water',
        cost: 5_000_000,
        unlocked: false,
        vpsMult: 2.0,
        bg: ['#0a1a0a', '#1a2a1a', '#050f05'],
        fg: ['#66bb6a', '#a5d6a7', '#4db6ac'],
        musicGenre: 'nature',
        sprites: ['bamboo', 'water_rock', 'cherry_blossom', 'lantern'],
    },
    star_deck: {
        id: 'star_deck',
        name: 'Star Deck',
        desc: 'Cosmic observatory floating among galaxies',
        cost: 25_000_000,
        unlocked: false,
        vpsMult: 2.5,
        bg: ['#000022', '#000044', '#001122'],
        fg: ['#ffffff', '#8888ff', '#ff88ff'],
        musicGenre: 'jazz',
        sprites: ['telescope', 'aurora', 'planets', 'constellations'],
    },
    study_lounge: {
        id: 'study_lounge',
        name: 'Study Lounge',
        desc: 'Cozy den with bookshelves and warm lamplight',
        cost: 100_000_000,
        unlocked: false,
        vpsMult: 3.0,
        bg: ['#1a1410', '#2a2018', '#0f0a08'],
        fg: ['#d4a574', '#c4956a', '#e8c8a8'],
        musicGenre: 'jazz',
        sprites: ['bookshelf', 'desk', 'lamp', 'armchair'],
    },
    beach_cove: {
        id: 'beach_cove',
        name: 'Beach Cove',
        desc: 'Sunset waves lapping on pixel sand',
        cost: 500_000_000,
        unlocked: false,
        vpsMult: 5.0,
        bg: ['#1a2233', '#2a3344', '#0a1520'],
        fg: ['#ffaa44', '#ff8833', '#66ccff'],
        musicGenre: 'nature',
        sprites: ['palm_tree', 'waves', 'seashell', 'sunset'],
    },
};

// ---------- DECOR ITEMS (Cosmetics) ----------
const DECOR_ITEMS = [
    { id: 'lamp_1', name: 'Pixel Lamp', type: 'lighting', cost: 5000, icon: 'lamp' },
    { id: 'lamp_2', name: 'Neon Strip', type: 'lighting', cost: 25000, icon: 'neon' },
    { id: 'lamp_3', name: 'Candle Set', type: 'lighting', cost: 100000, icon: 'candle' },
    { id: 'plant_1', name: 'Potted Fern', type: 'plant', cost: 10000, icon: 'fern' },
    { id: 'plant_2', name: 'Bonsai Tree', type: 'plant', cost: 50000, icon: 'bonsai' },
    { id: 'plant_3', name: 'Cactus Buddy', type: 'plant', cost: 200000, icon: 'cactus' },
    { id: 'furniture_1', name: 'Wooden Desk', type: 'furniture', cost: 15000, icon: 'desk' },
    { id: 'furniture_2', name: 'Bookshelf', type: 'furniture', cost: 75000, icon: 'bookshelf' },
    { id: 'furniture_3', name: 'Armchair', type: 'furniture', cost: 300000, icon: 'armchair' },
    { id: 'poster_1', name: 'Retro Poster', type: 'wall', cost: 20000, icon: 'poster' },
    { id: 'poster_2', name: 'World Map', type: 'wall', cost: 100000, icon: 'map' },
    { id: 'poster_3', name: 'Pixel Art Frame', type: 'wall', cost: 400000, icon: 'frame' },
    { id: 'rug_1', name: 'Cozy Rug', type: 'floor', cost: 30000, icon: 'rug' },
    { id: 'rug_2', name: 'Neon Mat', type: 'floor', cost: 150000, icon: 'neon_mat' },
    { id: 'table_1', name: 'Side Table', type: 'furniture', cost: 60000, icon: 'table' },
    { id: 'table_2', name: 'Coffee Table', type: 'furniture', cost: 250000, icon: 'coffee_table' },
];

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
    { id: 'dyson', name: 'Dyson Sphere', baseCost: 1e12, vps: 5000000, desc: 'Stellar compute.' },
];

// ---------- GATEWAY UPGRADES ----------
const GATEWAY_UPGRADES = [
    { id: 'gw_boost_1', name: 'Latency Amp', cost: 1000, desc: 'Gateway buff +0.5x', type: 'gw_add', value: 0.5 },
    { id: 'gw_boost_2', name: 'Pipeline Opt', cost: 10000, desc: 'Gateway buff +1.0x', type: 'gw_add', value: 1.0 },
    { id: 'gw_boost_3', name: 'Quantum Pipe', cost: 100000, desc: 'Gateway buff +2.0x', type: 'gw_add', value: 2.0 },
    { id: 'gw_boost_4', name: 'Neural Bridge', cost: 1000000, desc: 'Gateway buff +3.0x', type: 'gw_add', value: 3.0 },
    { id: 'gw_boost_5', name: 'Singularity Link', cost: 10000000, desc: 'Gateway buff +5.0x', type: 'gw_add', value: 5.0 },
    { id: 'click_1', name: 'Click Amplifier', cost: 500, desc: 'Click power ×2', type: 'click_mult', value: 2 },
    { id: 'click_2', name: 'Turbo Click', cost: 5000, desc: 'Click power ×4', type: 'click_mult', value: 4 },
    { id: 'click_3', name: 'Godlike Click', cost: 50000, desc: 'Click power ×10', type: 'click_mult', value: 10 },
    { id: 'autobuy_1', name: 'Auto Clicker', cost: 5000, desc: '+0.1 base VPS', type: 'base_vps', value: 0.1 },
    { id: 'autobuy_2', name: 'Micro Miner', cost: 50000, desc: '+1 base VPS', type: 'base_vps', value: 1 },
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
        autoclickers: {},
        gateway_upgrades: {},
        decor: {},
        current_room: 'campfire_grove',
        unlocked_rooms: ['campfire_grove'],
        owned_decor: [],
        active_decor: { lighting: null, plant: null, furniture: null, wall: null, floor: null },
        music_enabled: true,
        music_genre: 'chill',
        music_track: 0,
        gateway_history: [],
        placed_decor: {}, // { decorId: [{ x: gridPos, y: gridPos }, ...] }
        gateway_bonus_active: false,
        _gwMult: 1.0,
        _gwLabel: 'Disconnected',
        _gwLatency: 0,
        last_save: Date.now(),
        total_clicks: 0,
        total_gateway_pings: 0,
        achievements: [],
        settings: {
            music_volume: 0.5,
            sfx_volume: 0.5,
            particle_effects: true,
            show_float_text: true,
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

// Calculate the combined VPS multiplier from all unlocked rooms
function getRoomVpsMult(state = G) {
    let mult = 1.0;
    for (const roomId of state.unlocked_rooms) {
        const room = ROOMS[roomId];
        if (room && room.vpsMult) mult *= room.vpsMult;
    }
    return mult;
}

function getVPS(state = G) {
    let vps = 0;
    for (const [id, count] of Object.entries(state.autoclickers)) {
        const tier = AUTOCLICKERS.find(t => t.id === id);
        if (tier) vps += tier.vps * count;
    }
    // Gateway latency buff: higher latency = higher multiplier
    // When disconnected: 1.0x (full realtime VPS, no penalty)
    let gwMult = state.gateway_bonus_active ? (state._gwMult || 2.0) : 1.0;
    // Apply gw_add upgrades (stack on top of latency multiplier)
    for (const [upgId, owned] of Object.entries(state.gateway_upgrades)) {
        const upg = GATEWAY_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'gw_add' && owned) gwMult += upg.value;
    }
    // Apply base_vps upgrades (flat VPS)
    for (const [upgId, owned] of Object.entries(state.gateway_upgrades)) {
        const upg = GATEWAY_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'base_vps' && owned) vps += upg.value;
    }
    // Room VPS multiplier (resets on prestige)
    const roomMult = getRoomVpsMult(state);
    // Prestige multiplier
    const ppMult = 1 + (state.total_pp_earned * 0.01);
    return vps * gwMult * roomMult * ppMult;
}

function getClickValue(state = G) {
    let base = 1;
    let clickMult = 1;
    for (const [upgId, owned] of Object.entries(state.gateway_upgrades)) {
        const upg = GATEWAY_UPGRADES.find(u => u.id === upgId);
        if (upg && upg.type === 'click_mult' && owned) clickMult *= upg.value;
    }
    const ppMult = 1 + (state.total_pp_earned * 0.01);
    return Math.floor(base * clickMult * ppMult);
}

function getPrestigeGain(state = G) {
    if (state.lifetime_vibes < CONFIG.PRESTIGE_THRESHOLD) return 0;
    return Math.floor(Math.sqrt(state.lifetime_vibes) / 100);
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

function buyAutoclicker(id) {
    const tier = AUTOCLICKERS.find(t => t.id === id);
    if (!tier) return false;
    const count = G.autoclickers[id] || 0;
    const cost = getCost(tier.baseCost, count);
    if (G.vibes >= cost) {
        G.vibes -= cost;
        G.autoclickers[id] = count + 1;
        notifyStateChange('autoclickers');
        return true;
    }
    return false;
}

function buyGatewayUpgrade(id) {
    const upg = GATEWAY_UPGRADES.find(u => u.id === id);
    if (!upg) return false;
    if (G.gateway_upgrades[id]) return false; // Already owned
    if (G.vibes >= upg.cost) {
        G.vibes -= upg.cost;
        G.gateway_upgrades[id] = true;
        notifyStateChange('gateway_upgrades');
        return true;
    }
    return false;
}

function buyDecor(id) {
    const item = DECOR_ITEMS.find(d => d.id === id);
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
    const item = DECOR_ITEMS.find(d => d.id === id);
    if (!item) return false;
    if (!G.owned_decor.includes(id)) return false;
    G.active_decor[item.type] = id;
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
    G.music_genre = ROOMS[id].musicGenre;
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
    G.autoclickers = {};
    G.gateway_upgrades = {};
    G.owned_decor = [];
    G.active_decor = { lighting: null, plant: null, furniture: null, wall: null, floor: null };
    G.placed_decor = {};
    // Reset rooms — non-persistent after prestige
    G.unlocked_rooms = ['campfire_grove'];
    G.current_room = 'campfire_grove';
    notifyStateChange('prestige');
    return true;
}

// ---------- STATE OBSERVERS ----------
function onStateChange(handler) {
    saveLoadHandlers.push(handler);
}

function notifyStateChange(type) {
    for (const h of saveLoadHandlers) h(type, G);
}

// ---------- SAVE / LOAD ----------
function saveGame() {
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
        // Merge carefully to handle new fields
        const defaults = getDefaultState();
        for (const key of Object.keys(defaults)) {
            if (data[key] !== undefined) G[key] = data[key];
            else G[key] = defaults[key];
        }
        // Legacy support: ensure all expected keys exist
        if (!G.unlocked_rooms) G.unlocked_rooms = ['campfire_grove'];
        if (!G.owned_decor) G.owned_decor = [];
        if (!G.active_decor) G.active_decor = { lighting: null, plant: null, furniture: null, wall: null, floor: null };
        if (!G.gateway_upgrades) G.gateway_upgrades = {};
        if (!G.achievements) G.achievements = [];
        if (!G.placed_decor) G.placed_decor = {};
        if (G._gwMult === undefined) G._gwMult = 1.0;
        if (G._gwLabel === undefined) G._gwLabel = 'Disconnected';
        if (!G.settings) G.settings = defaults.settings;
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
    DECOR_ITEMS,
    AUTOCLICKERS,
    GATEWAY_UPGRADES,
    getDefaultState,
    getCost,
    getVPS,
    getRoomVpsMult,
    getClickValue,
    getPrestigeGain,
    formatNumber,
    addVibes,
    buyAutoclicker,
    buyGatewayUpgrade,
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
