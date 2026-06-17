// ============================================================
// Hermes IdleViber — Enhanced Pixel Art Engine
// + Decor Grid Placement & Drag System
// ============================================================

import { PRESTIGE_UPGRADES } from './state.js';

// --- FREE PLACEMENT (no grid snap) ---
const PLACEMENT_SNAP = 1;  // Pixel-perfect placement

// --- PLACEMENT STATE ---
const placementState = {
    active: false,
    decorId: null,
    ghostX: 0,
    ghostY: 0,
};

// --- DRAG STATE ---
const dragState = {
    active: false,
    decorId: null,
    index: -1,
    decorKey: null,
    mouseX: 0,
    mouseY: 0,
    currentX: 0,
    currentY: 0,
    velocityX: 0,
    velocityY: 0,
    rotation: 0,        // current rotation angle in radians
    targetRotation: 0,  // target rotation based on velocity
    wobblePhase: 0,
};

// --- PALETTE ---
const PAL = {
    black:       '#000000',
    white:       '#ffffff',
    dk_gray:     '#222222',
    md_gray:     '#555555',
    lt_gray:     '#999999',
    cream:       '#f5e6d3',
    // Browns
    dk_brown:    '#3e2723',
    md_brown:    '#5d4037',
    br_brown:    '#795548',
    lt_brown:    '#8d6e63',
    tan:         '#d7ccc8',
    skin:        '#f5cba7',
    // Warm
    dk_orange:   '#bf360c',
    md_orange:   '#ff6b35',
    lt_orange:   '#ffaa44',
    dk_gold:     '#c8961e',
    md_gold:     '#ffd700',
    lt_gold:     '#ffe44d',
    ylw:         '#ffff44',
    // Fire
    fire_red:    '#e53935',
    fire_orange: '#ff9800',
    fire_ylw:    '#ffeb3b',
    // Green
    dk_grn:      '#1b5e20',
    md_grn:      '#388e3c',
    grn:         '#4caf50',
    lt_grn:      '#66bb6a',
    lime:        '#81c784',
    // Blue
    dk_blu:      '#0d1b2a',
    navy:        '#1b2838',
    blu:         '#1565c0',
    lt_blu:      '#42a5f5',
    cyan:        '#00bcd4',
    neCyan:      '#00e5ff',
    // Purple/Pink
    purp:        '#7b1fa2',
    lt_purp:     '#ab47bc',
    neonPink:    '#ff0066',
    // Metal
    copper:      '#b87333',
    bronze:      '#cd7f32',
    silver:      '#c0c0c0',
    gold:        '#ffd700',
    // Neon
    neGrn:       '#00ff88',
    neBlu:       '#00bfff',
};

// --- ENHANCED SPRITE DEFINITIONS ---
// Each sprite is a 24x24 pixel array. Characters:
// . = transparent
// O = outline/shadow
// B = base color
// H = highlight
// S = shadow
// D = dark detail
// L = light detail

const SPRITES = {
    campfire: {
        w: 24, h: 24,
        pixels: [
            '........................',
            '........................',
            '........OOO............',
            '.......OOOOO...........',
            '......OOHHOOO..........',
            '.....OHHHHOHOO.........',
            '....OHHHHHHHHOO........',
            '...OOHHHHHHHHHO........',
            '...OBBOHHHHOBBO........',
            '..OBBBOOHHOOBBBO.......',
            '..OBBBOOOOBBBBBO.......',
            '..OSSSBBBBBBBBBO.......',
            '..OSSSBBBBBBBBOO.......',
            '..OSSSBBBBBBBOO........',
            '..OSSSOBBBBOOO.........',
            '...OOSSSBBOOO..........',
            '....OSSSBOO............',
            '....OOSSOO.............',
            '....OOSSOO.............',
            '....OOOOO..............',
            '....OOOOO..............',
            '........................',
            '........................',
            '........................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.md_orange, H: PAL.lt_orange, S: PAL.dk_orange }
    },

    trees: {
        w: 24, h: 24,
        pixels: [
            '..........OOOOOO.............',
            '.........OOOOOOOO..........',
            '........OOOOOOOOOOOO........',
            '.......OOOHHHHHHOOOO.......',
            '......OOOHHHHHHHHOOO......',
            '.....OOOHHHHHHHHHHOOO.....',
            '....OOOBBHHHHHHHBBOOO.....',
            '...OOOBBBBHHHBBBBBOOO.....',
            '...OOBBBBBBBBBBBBBBOO......',
            '..OOBBBBBBBBBBBBBBBOO......',
            '..ODDBBBBBBBBBBBBDDOO......',
            '..ODDOBBBBBBBBBBOOO........',
            '..OOOODDOOOOODDOO..........',
            '....OODDOOOOODDOO..........',
            '....OODDOOOOODDOO..........',
            '....OOOOO..OOOOO...........',
            '........................',
            '........................',
        ],
        pal: { O: PAL.dk_grn, B: PAL.grn, H: PAL.lt_grn, D: PAL.md_brown }
    },

    stars: {
        w: 24, h: 24,
        pixels: [
            '........................',
            '........H...............',
            '........................',
            '........................',
            '.......H....H..........',
            '........................',
            '........................',
            '.............H..........',
            '........................',
            '........................',
            '....H...............H...',
            '........................',
            '........................',
            '...........H............',
            '........................',
            '........................',
            '......H...........H.....',
            '........................',
            '........................',
            '.........H..............',
            '........................',
            '........................',
            '........................',
            '........................',
        ],
        pal: { H: PAL.white }
    },

    server_rack: {
        w: 24, h: 24,
        pixels: [
            '.....OOOOOOOOOO..........',
            '...OOOOOOOOOOOOOO........',
            '..OOSSSSSSSSSSSSOO.......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBDDBBBDDBBSOO.......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBDDBBBDDBBSOO.......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBDDBBBDDBBSOO.......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBDDBBBDDBBSOO.......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OSBBBBBBBBBBBBSOO......',
            '..OOSSSSSSSSSSSSOO.......',
            '....OOOHHOOO............',
            '.....OHHHHHO............',
            '.....OHHHHHO............',
            '.....OHHHHHO............',
            '......OOOOO.............',
            '........................',
        ],
        pal: { O: PAL.dk_gray, S: PAL.md_gray, B: PAL.navy, D: PAL.neGrn, H: PAL.lt_blu }
    },

    desk: {
        w: 24, h: 16,
        pixels: [
            'OOOOOOOOOOOOOOOOOOOOOO..',
            'OBBBBBBBBBBBBBBBBBBBO..',
            'OBBBBBBBBBBBBBBBBBBBO..',
            'OBBBBBBBBBBBBBBBBBBBO..',
            'OBBBBBBBBBBBBBBBBBBBO..',
            'OSSSSSSSSSSSSSSSSSSSO..',
            '........................',
            '..ODDO...ODDO...ODDO...',
            '..ODDO...ODDO...ODDO...',
            '..ODDO...ODDO...ODDO...',
            '..ODDO...ODDO...ODDO...',
            '.OOOOO..OOOOO..OOOOO..',
            '........................',
            '........................',
            '........................',
            '........................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.tan, S: PAL.md_brown, D: PAL.silver }
    },

    bookshelf: {
        w: 20, h: 24,
        pixels: [
            '..OOOOOOOOOOOOOOO.....',
            '.OOBBSBBBBBOBBBO.....',
            '.OBROYBBBBROYOOO.....',
            '.OBBBBBBBBRSBBO......',
            '.OGGOBBBBBGOBBO......',
            '.OBOPBBBBBPBBBO......',
            '.OBBBBBBBBBBBBO......',
            '.OOOBLBOOOBLBOO......',
            '..OOCCOOOOCCO........',
            '.OOBBSBBBBOBBBO......',
            '.OBROCBBBRORROO......',
            '.OBBBBBBBBBBBBB......',
            '.OGGOBBBBBGOBBO......',
            '.OBBPBBBBBPBBO.......',
            '.OBBBBBBBBBBBOO......',
            '.OOOBLBOOOBLBOO......',
            '..OOCCOOOOCCO........',
            '..OOOOOOOOOO..........',
            '........................',
            '........................',
        ],
        pal: {
            O: PAL.dk_brown, B: PAL.md_brown, S: PAL.lt_brown, R: PAL.fire_red,
            Y: PAL.ylw, G: PAL.grn, P: PAL.purp, C: PAL.cyan, L: PAL.lt_blu,
        }
    },

    armchair: {
        w: 20, h: 18,
        pixels: [
            '.OOOOOOOOOOOOOOOOOO..',
            'OBBBBBBBBBBBBBBBBBO..',
            'OBHHHHHHHHHHHHHHHBO..',
            'OBHHHHHHHHHHHHHHHBO..',
            'OBHHHHHHHHHHHHHHHBO..',
            'OBHHHHHHHHHHHHHHHBO..',
            'OBHHHHHHHHHHHHHHHBO..',
            'OOOOSSSSSSSSSSSOOOO..',
            '...OSSSSSSSSSSSOO....',
            '...OOOSSSSSSSOOO.....',
            '..ODDO...ODDO........',
            '..ODDO...ODDO........',
            '..ODDO...ODDO........',
            '.OOOOO..OOOOO........',
            '........................',
            '........................',
            '........................',
            '........................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.fire_red, H: PAL.lt_orange, S: PAL.cream, D: PAL.silver }
    },

    lamp: {
        w: 16, h: 24,
        pixels: [
            '.....HHHH........',
            '....OOHHO.......',
            '...OOOOOOO......',
            '...BBSBBBO......',
            '...OOSOOO.......',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '....OSOO........',
            '..OOOSSO........',
            '..ODDOOO........',
            '..ODDO..........',
            '..ODDO..........',
            '..ODDO..........',
            '..OOOO..........',
        ],
        pal: { H: PAL.ylw, O: PAL.md_brown, B: PAL.lt_orange, S: PAL.md_orange, D: PAL.copper }
    },

    fern: {
        w: 18, h: 20,
        pixels: [
            '......OO.........',
            '.....OBO.........',
            '....OBBOO........',
            '...OOBHBOO.......',
            '...OBBBBO........',
            '..OBBHBBO........',
            '..OBBBBOO........',
            '.OBHBHBOO........',
            '.OBBBBBO.........',
            '..OOSSHBO........',
            '..ODDOBHO........',
            '.OODDOBBOO.......',
            '.ODDDOBBO........',
            '..ODDHBBO........',
            '..ODDOO..........',
            '..ODDO...........',
            '..ODDO...........',
            '..ODDO...........',
            '..OOOO...........',
            '................',
        ],
        pal: { O: PAL.dk_grn, B: PAL.grn, H: PAL.lt_grn, S: PAL.dk_grn, D: PAL.md_brown }
    },

    bonsai: {
        w: 22, h: 22,
        pixels: [
            '.....OOOOOOOO..........',
            '....OBBHHHHBO.........',
            '...OBBHHHHHBO.........',
            '..OBBHHHHHHBO.........',
            '.OBBHHHHHHHBO..........',
            '.OBBHHBHHHBO...........',
            '.OBBBBBBBHO............',
            '..OOOOBBO..............',
            '....ODDO...............',
            '....ODDO...............',
            '....ODDO...............',
            '...OODDOO..............',
            '..ODDDOODO.............',
            '.ODDDDDDDDO............',
            '.ODDSSSDDDO............',
            '.OOOSSSOOOO............',
            '........................',
            '........................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.grn, H: PAL.lt_grn, D: PAL.md_brown, S: PAL.lt_brown }
    },

    cactus: {
        w: 16, h: 20,
        pixels: [
            '.....OBBO.........',
            '...OOHHHHO........',
            '...OBBBBBO........',
            '...OBBBBBO........',
            '..OOBBBBBO........',
            '..ODDBBBOOO........',
            '..ODOOBBDO........',
            '.OODODDBDO........',
            '.OBOOBBDO.........',
            '.OBBBBBBO..........',
            '.OBBBHBBO..........',
            '..OOBBBO...........',
            '..ODDBBO...........',
            '..ODDOO............',
            '.OODOO.............',
            '.OODO..............',
            '..ODDO.............',
            '..ODDO.............',
            '..OOOO.............',
            '................',
        ],
        pal: { O: PAL.dk_grn, B: PAL.lime, H: PAL.lt_grn, D: PAL.md_grn }
    },

    neon_sign: {
        w: 24, h: 12,
        pixels: [
            'OOOOOOOOOOOOOOOOOOOOOO..',
            'OHHBBBBBBBBBBBBBBHHO...',
            'OHBBBBBBBBBBBBBBBHO....',
            'OHBBBBBBBBBBBBBBBHO....',
            'OHBBBBBBBBBBBBBBBHO....',
            'OHHBBBBBBBBBBBBBHHO....',
            'OOOOSSSSSSSSSSSSOOO....',
            '.....OHHHOOHHHO........',
            '.....OHOOHOHOOH........',
            '.....OOHHOOOHHO........',
            '.....OOOOOOOOOO........',
            '........................',
        ],
        pal: { O: PAL.dk_gray, B: PAL.neCyan, H: PAL.lt_blu, S: PAL.md_gray }
    },

    // --- DECORATIVE SPRITES FOR ROOMS ---
    rug: {
        w: 24, h: 12,
        pixels: [
            'OOOOOOOOOOOOOOOOOOOOOOOO',
            'OHHHHHHHHHHHHHHHHHHHHHO',
            'OBBHBBHBBHBBHBBHBBHBBO',
            'OBBHBBHBBHBBHBBHBBHBBO',
            'OBBHBBHBBHBBHBBHBBHBBO',
            'OBHHBHHBHHBHHBHHBHHBO',
            'OSSSSSSSSSSSSSSSSSSSSO',
            'OOOOOOOOOOOOOOOOOOOOOOOO',
            '........................',
            '........................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.fire_red, H: PAL.md_gold, S: PAL.md_brown }
    },

    table: {
        w: 20, h: 14,
        pixels: [
            'OOOOOOOOOOOOOOOOOO..',
            'OBBBBBBBBBBBBBBBO..',
            'OBBBBBBBBBBBBBBBO..',
            'OSSSSSSSSSSSSSSSO..',
            '........................',
            '..ODDO...ODDO.........',
            '..ODDO...ODDO.........',
            '..ODDO...ODDO.........',
            '.OOOOO..OOOOO.........',
            '........................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.tan, S: PAL.md_brown, D: PAL.silver }
    },

    poster: {
        w: 16, h: 20,
        pixels: [
            'OOOOOOOOOOOOOOOO',
            'OHBHHHHHHHHHBHO',
            'OBBBBBBBBBBBBBO',
            'OBBBBBBBBBBBBBO',
            'OBBOBBBBBBOBBBO',
            'OBBOBBBBBBOBBBO',
            'OBBBOBOBOBOBBBO',
            'OBBBOBOBOBOBBBO',
            'OBBBBBOBOBBBBBO',
            'OBBBBBHHHBBBBBO',
            'OBBBBHHHHHBBBBO',
            'OBBBHHHHHHHBBBO',
            'OBBHHHHHHHHHBBO',
            'OBBHHHHHHHHHBBO',
            'OBBHHHHHHHHHBBO',
            'OBBHHHHHHHHHBBO',
            'OBBBOOOOOOBBBHO',
            'OHOOOOOOOOOOHOO',
            'OOOOOOOOOOOOOOOO',
            '................',
        ],
        pal: {
            O: PAL.md_gray, B: PAL.white, H: PAL.neCyan,
        }
    },

    frame: {
        w: 16, h: 20,
        pixels: [
            'OOOOOOOOOOOOOOOO',
            'ODDHHHHHHHHHHDDO',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'DHHHHHHHHHHHHHHD',
            'ODDHHHHHHHHHHDDO',
            'OOOOOOOOOOOOOOOO',
            '................',
            '................',
        ],
        pal: { O: PAL.dk_brown, D: PAL.md_gold, H: PAL.cream }
    },

    // --- TROPHIES ---
    trophy_bronze: {
        w: 16, h: 18,
        pixels: [
            '....OOOOOO........',
            '...OOBHBOO........',
            '..OBBBHBBO........',
            '.OBBBNBBBO........',
            '.OBBBNBBBO........',
            '.OBBBBBBBO........',
            '.OBBBBBBBO........',
            '..OBBBBBO..........',
            '..OBBBBBO..........',
            '...OBBBO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '....OOOO...........',
            '................',
        ],
        pal: { O: PAL.dk_brown, B: PAL.copper, H: PAL.lt_orange, N: PAL.tan, S: PAL.bronze }
    },

    trophy_silver: {
        w: 16, h: 18,
        pixels: [
            '....OOOOOO........',
            '...OOBHBOO........',
            '..OBBBHBBO........',
            '.OBBBNBBBO........',
            '.OBBBNBBBO........',
            '.OBBBBBBBO........',
            '.OBBBBBBBO........',
            '..OBBBBBO..........',
            '..OBBBBBO..........',
            '...OBBBO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '....OOOO...........',
            '................',
        ],
        pal: { O: PAL.dk_gray, B: PAL.silver, H: PAL.white, N: PAL.lt_gray, S: PAL.md_gray }
    },

    trophy_gold: {
        w: 16, h: 18,
        pixels: [
            '....OOOOOO........',
            '...OOBHBOO........',
            '..OBBBHBBO........',
            '.OBBBNBBBO........',
            '.OBBBNBBBO........',
            '.OBBBBBBBO........',
            '.OBBBBBBBO........',
            '..OBBBBBO..........',
            '..OBBBBBO..........',
            '...OBBBO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '...OOSSO...........',
            '....OOOO...........',
            '................',
        ],
        pal: { O: PAL.dk_gold, B: PAL.gold, H: PAL.lt_gold, N: PAL.cream, S: PAL.dk_gold }
    },
};

// Add the click, vibe_pulse, gateway_icon from the original file...
SPRITES.click_icon = {
    w: 16, h: 16,
    pixels: [
        '................',
        '.....OOOOOO.....',
        '....OBBBHBO....',
        '....OBBBBBO....',
        '....OBBBBBO....',
        '....OBBBBBO....',
        '....OBBBBBO....',
        '....OSSSSO....',
        '.....OOOOO.....',
        '................',
        '................',
    ],
    pal: { O: PAL.dk_gold, B: PAL.md_gold, H: PAL.lt_gold, S: PAL.dk_orange }
};

SPRITES.vibe_pulse = {
    w: 16, h: 16,
    pixels: [
        '......OOO.......',
        '....OBBBBO.....',
        '...OBBBBBBO....',
        '..OBBBBBBBBO...',
        '..OBBBBBBBBO...',
        '..OBBBBBBBBO...',
        '..OBBBBBBBBO...',
        '...OBBBBBBO....',
        '....OBBBBO.....',
        '......OOO.......',
        '................',
    ],
    pal: { O: PAL.dk_blu, B: PAL.neCyan }
};

SPRITES.gateway_icon = {
    w: 16, h: 16,
    pixels: [
        '................',
        '....OOO.........',
        '...OBBBO........',
        '..OBBBBBO.......',
        '.OBBBBBBBO......',
        '.OBBBBBBBO......',
        '..OBBBBBO.......',
        '...OBBBO........',
        '....OOO.........',
        '................',
        '................',
    ],
    pal: { O: PAL.dk_grn, B: PAL.neGrn }
};

// --- SPRITE CACHE ---
const spriteCache = {};

// --- RENDER SPRITE TO CANVAS ---
function generateSprite(spriteId, scale = 2) {
    const cacheKey = `${spriteId}_${scale}`;
    if (spriteCache[cacheKey]) return spriteCache[cacheKey];

    const def = SPRITES[spriteId];
    if (!def) {
        console.warn(`Sprite "${spriteId}" not found`);
        const c = document.createElement('canvas');
        c.width = 16 * scale;
        c.height = 16 * scale;
        const ctx = c.getContext('2d');
        ctx.fillStyle = PAL.neonPink;
        ctx.fillRect(0, 0, c.width, c.height);
        spriteCache[cacheKey] = c;
        return c;
    }

    const w = def.w;
    const h = def.h;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (!def.pixels || def.pixels.length === 0) {
        ctx.fillStyle = PAL.neonPink;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        spriteCache[cacheKey] = canvas;
        return canvas;
    }

    // Draw each pixel
    for (let y = 0; y < h && y < def.pixels.length; y++) {
        const row = def.pixels[y] || '';
        for (let x = 0; x < w && x < row.length; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            const color = def.pal[ch];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }

    spriteCache[cacheKey] = canvas;
    return canvas;
}

// Get sprite dimensions (free placement)
function getSpriteGridSize(spriteId) {
    const def = SPRITES[spriteId];
    if (!def) return { w: 2, h: 2 };
    return {
        w: Math.ceil(def.w * 2 / 1),
        h: Math.ceil(def.h * 2 / 1),
    };
}

function getSpritePixelSize(spriteId) {
    const def = SPRITES[spriteId];
    if (def) return { w: def.w * 2, h: def.h * 2 };
    // Room decor items (IDs with underscores) use 64x64 PNG icons
    if (spriteId && spriteId.includes('_')) return { w: 64, h: 64 };
    return { w: 32, h: 32 };
}

// --- FREE PLACEMENT (no grid snap) ---
function snapToGrid(x, y) {
    return { x: Math.round(x), y: Math.round(y) };
}

function worldToGrid(x, y) {
    return { gx: x, gy: y };
}

function gridToWorld(gx, gy) {
    return { x: gx, y: gy };
}

// --- ROOM BACKGROUND DRAWING ---
const rnd = (seed) => {
    let s = seed || 1;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
};

function drawStars(ctx, w, h, rand, count = 40) {
    const t = Date.now() / 1000;
    ctx.fillStyle = PAL.white;
    for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.6;
        const sz = rand() > 0.85 ? 2 : 1;
        // Twinkle: each star oscillates at a unique frequency
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.7);
        ctx.globalAlpha = 0.4 + twinkle * 0.6;
        ctx.fillRect(Math.floor(x), Math.floor(y), sz, sz);
    }
    ctx.globalAlpha = 1;
}

function drawCampfireBg(ctx, w, h, scale) {
    const t = Date.now() / 1000;

    // Night sky — subtle colour shift
    const skyPulse = 0.05 * Math.sin(t * 0.08);
    ctx.fillStyle = `rgb(${13+Math.floor(skyPulse*20)}, ${11+Math.floor(skyPulse*10)}, ${10+Math.floor(skyPulse*5)})`;
    ctx.fillRect(0, 0, w, h);

    drawStars(ctx, w, h, rnd(42), 35);

    // Ground
    ctx.fillStyle = PAL.dk_brown;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = PAL.dk_grn;
    ctx.fillRect(0, h * 0.73, w, h * 0.03);

    // Trees — subtle sway
    ctx.fillStyle = PAL.black;
    for (let i = 0; i < 3; i++) {
        const tx = 20 + i * (w / 3) + (i * 7);
        const th = 50 + (i * 13) % 30;
        const sway = Math.sin(t * 0.4 + i * 1.7) * 1.5;
        ctx.fillRect(tx + sway, h * 0.73 - th, 6, th);
        ctx.fillRect(tx - 6 + sway, h * 0.73 - th - 12, 10, 6);
        ctx.fillRect(tx - 4 + sway, h * 0.73 - th - 18, 8, 6);
    }

    // Fire glow — pulsing
    const firePulse = 0.7 + 0.3 * Math.sin(t * 2.5);
    const glowRadius = w * (0.3 + 0.08 * Math.sin(t * 1.8));
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.7, 5, w * 0.5, h * 0.7, glowRadius);
    grad.addColorStop(0, `rgba(255, ${Math.floor(150 + 50 * Math.sin(t*3))}, 53, ${0.3 * firePulse})`);
    grad.addColorStop(0.4, `rgba(255, 170, 68, ${0.12 * firePulse})`);
    grad.addColorStop(1, 'rgba(255, 170, 68, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Embers — rising from fire
    for (let i = 0; i < 12; i++) {
        const emberX = w * 0.5 + Math.sin(t * 0.7 + i * 5.1) * 25;
        const emberY = h * 0.68 - ((t * 30 + i * 43) % 70);
        const emberLife = 1 - ((t * 30 + i * 43) % 70) / 70;
        if (emberLife > 0) {
            ctx.globalAlpha = emberLife * 0.8;
            ctx.fillStyle = `hsl(${25 + Math.floor(emberLife * 20)}, 100%, ${60 + Math.floor(emberLife * 30)}%)`;
            const esz = 1 + emberLife * 2;
            ctx.fillRect(Math.floor(emberX), Math.floor(emberY), Math.ceil(esz), Math.ceil(esz));
        }
    }
    ctx.globalAlpha = 1;

    // Smoke wisps
    for (let i = 0; i < 5; i++) {
        const sx = w * 0.5 + Math.sin(t * 0.3 + i * 1.3) * 40;
        const sy = h * 0.65 - ((t * 15 + i * 97) % 50);
        const life = 1 - ((t * 15 + i * 97) % 50) / 50;
        if (life > 0) {
            ctx.globalAlpha = life * 0.08;
            ctx.fillStyle = '#aaa';
            const sw = 8 + life * 20;
            ctx.beginPath();
            ctx.arc(sx, sy, sw, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function drawCyberBg(ctx, w, h, scale) {
    const t = Date.now() / 1000;

    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, w, h);

    // Grid — pulsing scanlines
    ctx.strokeStyle = PAL.neGrn;
    ctx.globalAlpha = 0.2 + 0.15 * Math.sin(t * 0.5);
    for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.65);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = h * 0.65; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Neon lines — pulsing intensity
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const x = 15 + i * 25;
        const neonPulse = 0.4 + 0.6 * Math.sin(t * 1.2 + i * 1.1);
        ctx.strokeStyle = `rgba(255, 0, ${Math.floor(80 + 100 * neonPulse)}, ${0.6 * neonPulse})`;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.25);
        ctx.lineTo(x + 8, h * 0.65);
        ctx.stroke();
    }

    // Matrix rain — falling
    ctx.fillStyle = PAL.neGrn;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 25; i++) {
        const mx = (i * 37 + Math.floor(t * 10)) % Math.floor(w / 6) * 6 + 3;
        const fallY = ((t * 60 + i * 71) % (h * 0.6));
        ctx.fillRect(Math.floor(mx), Math.floor(fallY), 2, 5 + (i % 3) * 3);
        // Trail
        ctx.globalAlpha = 0.15;
        ctx.fillRect(Math.floor(mx), Math.floor(fallY - 8), 2, 6);
        ctx.globalAlpha = 0.5;
    }
    ctx.globalAlpha = 1;

    // Glitch flicker (random)
    if (Math.sin(t * 7.3) > 0.92) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(Math.random() * w * 0.3, 0, Math.random() * 30 + 10, h);
    }
}

function drawZenBg(ctx, w, h, scale) {
    const t = Date.now() / 1000;

    ctx.fillStyle = PAL.dk_grn;
    ctx.fillRect(0, 0, w, h);

    // Mist — drifting
    ctx.globalAlpha = 0.1 + 0.06 * Math.sin(t * 0.15);
    ctx.fillStyle = PAL.lime;
    const mistX = Math.sin(t * 0.05) * 20;
    ctx.fillRect(mistX, h * 0.15, w, h * 0.35);
    ctx.globalAlpha = 1;

    // Ground
    ctx.fillStyle = PAL.md_brown;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);

    // Bamboo — swaying
    for (let i = 0; i < 5; i++) {
        const bx = w * 0.15 + i * w * 0.18;
        const bh = 40 + (i * 17) % 30;
        const sway = Math.sin(t * 0.35 + i * 0.9) * 2;
        ctx.fillStyle = PAL.md_grn;
        ctx.fillRect(bx + sway, h * 0.8 - bh, 4, bh);
        // Leaves
        ctx.fillStyle = PAL.grn;
        const leafAngle = Math.sin(t * 0.4 + i * 1.3) * 0.3;
        ctx.save();
        ctx.translate(bx + sway, h * 0.8 - bh);
        ctx.rotate(leafAngle);
        ctx.fillRect(-2, -5, 8, 3);
        ctx.restore();
    }

    // Pond — ripples
    ctx.fillStyle = PAL.dk_blu;
    ctx.fillRect(w * 0.3, h * 0.82, w * 0.4, h * 0.12);
    // Ripple rings
    for (let i = 0; i < 3; i++) {
        const ripplePhase = (t * 0.8 + i * 1.2) % 1;
        const rw = 6 + ripplePhase * 35;
        const ry = h * 0.86 + Math.sin(t * 0.3 + i * 2.1) * 3;
        const rx = w * 0.5 + Math.sin(t * 0.2 + i * 3.7) * 30;
        ctx.strokeStyle = `rgba(0, 188, 212, ${0.3 * (1 - ripplePhase)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, rw, 0, Math.PI * 2);
        ctx.stroke();
    }
    // Water shimmer
    ctx.fillStyle = PAL.cyan;
    ctx.globalAlpha = 0.2 + 0.15 * Math.sin(t * 0.6);
    ctx.fillRect(w * 0.35, h * 0.84, w * 0.05, 3);
    ctx.fillRect(w * 0.55, h * 0.87, 3, 2);
    ctx.globalAlpha = 1;

    // Cherry blossoms — drifting
    for (let i = 0; i < 8; i++) {
        const cx = ((t * 12 + i * 47) % (w + 30)) - 15;
        const cy = ((t * 8 + i * 71) % (h * 0.7)) + h * 0.05;
        const drift = Math.sin(t * 0.5 + i * 3.1) * 15;
        ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
        ctx.fillRect(Math.floor(cx + drift), Math.floor(cy), 3, 3);
    }
}

function drawStarBg(ctx, w, h, scale) {
    const t = Date.now() / 1000;

    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, w, h);

    drawStars(ctx, w, h, rnd(7), 60);

    // Aurora — undulating waves
    for (let a = 0; a < 3; a++) {
        ctx.globalAlpha = 0.06 + 0.03 * Math.sin(t * 0.2 + a * 2.1);
        ctx.fillStyle = a === 0 ? '#88ff88' : a === 1 ? '#8888ff' : '#ff88ff';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.15 + a * 10);
        for (let x = 0; x <= w; x += 8) {
            const ay = Math.sin(x * 0.02 + t * 0.3 + a * 1.7) * 20
                    + Math.sin(x * 0.01 + t * 0.15 + a * 3.2) * 15;
            ctx.lineTo(x, h * 0.15 + a * 10 + ay);
        }
        ctx.lineTo(w, h * 0.15 + a * 10 - 5);
        ctx.lineTo(0, h * 0.15 + a * 10 - 5);
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Nebula — pulsing
    const nebulaPulse = 0.8 + 0.2 * Math.sin(t * 0.1);
    const grad = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.35);
    grad.addColorStop(0, `rgba(136, 136, 255, ${0.15 * nebulaPulse})`);
    grad.addColorStop(0.5, `rgba(136, 136, 255, ${0.05 * nebulaPulse})`);
    grad.addColorStop(1, 'rgba(136, 136, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Planet — rotating glow ring
    const planetX = w * 0.8;
    const planetY = h * 0.4;
    const planetAngle = t * 0.15;
    ctx.fillStyle = PAL.purp;
    ctx.beginPath();
    ctx.arc(planetX, planetY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.neonPink;
    ctx.beginPath();
    ctx.arc(planetX, planetY, 6, 0, Math.PI * 2);
    ctx.fill();
    // Ring
    ctx.strokeStyle = `rgba(255, 0, 102, ${0.3 + 0.15 * Math.sin(t * 0.5)})`;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(planetX, planetY);
    ctx.rotate(planetAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Shooting stars
    for (let i = 0; i < 2; i++) {
        const phase = (t * 0.07 + i * 0.5) % 1;
        if (phase > 0.7) continue;
        const sx = phase * w * 0.9 + 10;
        const sy = phase * h * 0.3 + 10;
        const len = 20 + 10 * Math.sin(i * 2.3);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - phase)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - len, sy + len * 0.3);
        ctx.stroke();
    }
}

function drawStudyBg(ctx, w, h, scale) {
    const t = Date.now() / 1000;

    ctx.fillStyle = PAL.dk_brown;
    ctx.fillRect(0, 0, w, h);

    // Wall
    ctx.fillStyle = PAL.md_brown;
    ctx.fillRect(0, 0, w, h * 0.72);

    // Floor
    ctx.fillStyle = PAL.br_brown;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // Window — night sky with moon drift
    ctx.fillStyle = PAL.dk_blu;
    ctx.fillRect(w * 0.35, h * 0.12, w * 0.3, h * 0.35);
    // Interior warm window glow
    const windowGlow = 0 + 0.05 * Math.sin(t * 0.3);
    ctx.fillStyle = `rgba(212, 165, 116, ${windowGlow})`;
    ctx.fillRect(w * 0.36, h * 0.13, w * 0.12, h * 0.14);
    ctx.fillStyle = PAL.lt_blu;
    // Moon drifting across window
    const moonX = w * 0.4 + Math.sin(t * 0.03) * w * 0.12;
    const moonY = h * 0.22 + Math.sin(t * 0.02) * h * 0.05;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 4, 0, Math.PI * 2);
    ctx.fill();
    // Tiny stars in window
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.2);
    ctx.fillRect(w * 0.4, h * 0.16, 1, 1);
    ctx.fillRect(w * 0.55, h * 0.18, 1, 1);
    ctx.fillRect(w * 0.5, h * 0.22, 1, 1);
    ctx.fillRect(w * 0.45, h * 0.28, 1, 1);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.tan;
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.35, h * 0.12, w * 0.3, h * 0.35);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.12);
    ctx.lineTo(w * 0.5, h * 0.47);
    ctx.moveTo(w * 0.35, h * 0.295);
    ctx.lineTo(w * 0.65, h * 0.295);
    ctx.stroke();

    // Warm light — pulsing lamp
    const lampPulse = 0.85 + 0.15 * Math.sin(t * 2.0) + 0.05 * Math.sin(t * 5.3);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.4);
    grad.addColorStop(0, `rgba(212, 165, 116, ${0.12 * lampPulse})`);
    grad.addColorStop(1, `rgba(212, 165, 116, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Dust motes — floating in lamplight
    for (let i = 0; i < 8; i++) {
        const dx = ((t * 5 + i * 31) % (w * 0.6)) + w * 0.2;
        const dy = ((t * 3 + i * 53) % (h * 0.5)) + h * 0.15;
        const dz = Math.sin(t * 0.4 + i * 2.3) * 15;
        ctx.fillStyle = `rgba(255, 255, 200, ${0.15 + 0.1 * Math.sin(t + i)})`;
        ctx.fillRect(Math.floor(dx + dz), Math.floor(dy), 2, 2);
    }
}

function drawBeachBg(ctx, w, h, scale) {
    const t = Date.now() / 1000;

    // Sky — sunset gradient with time shift
    const skyShift = 0.05 * Math.sin(t * 0.05);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    skyGrad.addColorStop(0, `rgb(${66+Math.floor(skyShift*20)}, ${165+Math.floor(skyShift*15)}, ${245})`);
    skyGrad.addColorStop(0.4, `rgb(${255}, ${136+Math.floor(skyShift*10)}, ${51+Math.floor(skyShift*10)})`);
    skyGrad.addColorStop(1, `rgb(${255}, ${107+Math.floor(skyShift*15)}, ${53})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.55);

    // Clouds — drifting
    for (let i = 0; i < 3; i++) {
        const cx = ((t * 4 + i * 113) % (w + 50)) - 25;
        const cy = h * 0.08 + i * 12 + Math.sin(t * 0.1 + i * 1.7) * 5;
        ctx.fillStyle = `rgba(255, 200, 150, ${0.2 + 0.1 * Math.sin(t * 0.3 + i * 2.1)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 12 + i * 3, 0, Math.PI * 2);
        ctx.arc(cx + 15, cy - 3, 10 + i * 2, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy, 8 + i * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ocean — animated waves
    ctx.fillStyle = PAL.blu;
    ctx.fillRect(0, h * 0.48, w, h * 0.25);
    // Wave lines — moving
    for (let i = 0; i < 5; i++) {
        const waveY = h * 0.48 + i * 6 + Math.sin(t * 0.8 + i * 1.3) * 2;
        const waveAlpha = 0.4 + 0.3 * (1 - i / 5);
        ctx.fillStyle = `rgba(102, 204, 255, ${waveAlpha})`;
        ctx.beginPath();
        ctx.moveTo(0, waveY);
        for (let x = 0; x <= w; x += 10) {
            const wy = waveY + Math.sin(x * 0.04 + t * 1.5 + i * 2.1) * 3;
            ctx.lineTo(x, wy);
        }
        ctx.lineTo(w, waveY + 3);
        ctx.lineTo(0, waveY + 3);
        ctx.closePath();
        ctx.fill();
    }

    // Sand
    ctx.fillStyle = PAL.tan;
    ctx.fillRect(0, h * 0.73, w, h * 0.27);

    // Sun — pulsing glow
    const sunPulse = 0.8 + 0.2 * Math.sin(t * 0.4);
    ctx.fillStyle = PAL.md_gold;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.33, 15, 0, Math.PI * 2);
    ctx.fill();
    // Sun glow
    ctx.fillStyle = `rgba(255, 235, 59, ${0.15 * sunPulse})`;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.33, 22 + 3 * Math.sin(t * 0.5), 0, Math.PI * 2);
    ctx.fill();
    // Sun rays — rotating
    ctx.globalAlpha = 0.35 * sunPulse;
    for (let r = 0; r < 6; r++) {
        const angle = t * 0.06 + r * (Math.PI / 3);
        ctx.fillStyle = PAL.fire_ylw;
        ctx.fillRect(
            w * 0.5 + Math.cos(angle) * 18 - 1,
            h * 0.33 + Math.sin(angle) * 18 - 1,
            2, 8
        );
    }
    ctx.globalAlpha = 1;

    // Foam line at shore — moving
    const foamX = Math.sin(t * 0.4) * 15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(w * 0.3 + foamX, h * 0.73, w * 0.15, 2);
    ctx.fillRect(w * 0.55 - foamX, h * 0.73, w * 0.12, 2);
}

// --- EXTERNAL SPRITE LOADER ---
// Loads pre-generated PNG sprites from sprites/images/
const externalSprites = {};
let externalSpriteRoot = '';

function setSpriteRoot(root) {
    externalSpriteRoot = root;
}

function loadExternalSprite(path) {
    // Return cached or in-flight promise to prevent duplicate loads
    if (externalSprites[path] === true) return Promise.resolve(null); // failed previously
    if (externalSprites[path] instanceof HTMLImageElement) return Promise.resolve(externalSprites[path]);
    if (externalSprites[path] instanceof Promise) return externalSprites[path];
    
    const promise = new Promise((resolve) => {
        const img = new Image();
        // Try webp first, fall back to png
        const webpPath = path.replace(/\.png$/, '.webp');
        img.onload = () => {
            externalSprites[path] = img;
            // Cache webp variant too for future lookups by path
            if (webpPath !== path) externalSprites[webpPath] = img;
            resolve(img);
        };
        img.onerror = () => {
            if (webpPath !== path) {
                // webp failed, try original png
                img.onerror = () => {
                    externalSprites[path] = true; // mark failed
                    resolve(null);
                };
                img.src = path;
            } else {
                externalSprites[path] = true; // mark failed so we don't retry
                resolve(null);
            }
        };
        img.src = webpPath;
    });
    externalSprites[path] = promise;
    return promise;
}

async function drawBackground(roomId, ctx, w, h) {
    const bgMap = {
        'campfire_grove': 'bg_campfire',
        'cyber_den': 'bg_cyber',
        'zen_garden': 'bg_zen_garden',
        'star_deck': 'bg_star_deck',
        'study_lounge': 'bg_study_lounge',
        'beach_cove': 'bg_beach_cove',
    };
    const bgName = bgMap[roomId];
    if (bgName) {
        const img = await loadExternalSprite(`sprites/images/bg/${bgName}.png`);
        if (img) {
            ctx.imageSmoothingEnabled = false;
            // Center-weighted cover: crop image to match canvas aspect ratio
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const canvasAspect = w / h;
            const imgAspect = iw / ih;
            let sx, sy, sw, sh;
            if (canvasAspect > imgAspect) {
                // Canvas is wider relative to image → crop top/bottom
                sh = ih;
                sw = ih * canvasAspect;
                sx = (iw - sw) / 2;
                sy = 0;
            } else {
                // Canvas is taller relative to image → crop left/right
                sw = iw;
                sh = iw / canvasAspect;
                sx = 0;
                sy = (ih - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
            return true;
        }
    }
    return false; // Fall back to programmatic
}
function drawGodrays(ctx, w, h) {
    const t = Date.now() / 1000;
    const angle = Math.sin(t * 0.1) * 0.15 + 0.4;

    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 3; i++) {
        const xOff = w * (0.2 + i * 0.15) + Math.sin(t * 0.05 + i) * 20;
        const grad = ctx.createLinearGradient(xOff, 0, xOff + Math.tan(angle) * h, h);
        grad.addColorStop(0, 'rgba(255, 255, 200, 0.15)');
        grad.addColorStop(0.3, 'rgba(255, 255, 200, 0.05)');
        grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(xOff - 15, 0);
        ctx.lineTo(xOff + 15, 0);
        ctx.lineTo(xOff + Math.tan(angle) * h + 30, h);
        ctx.lineTo(xOff + Math.tan(angle) * h - 30, h);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// --- PLACEMENT SOUND ---
// (Replaced by sfx.js module -- playPlace in sfx.js)

// --- PLACEMENT GHOST ---
function drawPlacementGhost(ctx, state) {
    if (!placementState.active || !placementState.decorId) return;
    const decorId = placementState.decorId;
    const ghostX = placementState.ghostX;
    const ghostY = placementState.ghostY;

    // For room decor, try loading the external PNG sprite (cached)
    if (decorId && decorId.includes('_')) {
        loadExternalSprite(`sprites/images/room_decor/icons/${decorId}.png`).then(img => {
            if (!img) return;
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.drawImage(img, ghostX, ghostY);
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(ghostX, ghostY, img.width, img.height);
            ctx.restore();
        });
        return;
    }

    // Fallback: generated sprite
    const sprite = generateSprite(decorId, 2);
    if (!sprite) return;

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(sprite, ghostX, ghostY);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(ghostX, ghostY, sprite.width, sprite.height);
    ctx.restore();
}

// --- GATEWAY HUD (top-right canvas) ---
function drawGatewayHUD(ctx, w, h, state) {
    ctx.save();
    const connected = state.gateway_bonus_active;
    const baseMult = state._gwMult || 1.0;
    const label = state._gwLabel || (connected ? 'Connected' : 'Disconnected');
    const icon = connected ? '🔗' : '⛔';
    const color = connected ? '#00ff88' : '#ff4444';

    // Calculate combined multiplier: latency + prestige gw_add upgrades
    let totalGwMult = connected ? baseMult : 1.0;
    let prestigeBonus = 0;
    if (state.prestige_upgrades) {
        for (const [upgId, count] of Object.entries(state.prestige_upgrades)) {
            const upg = PRESTIGE_UPGRADES.find(u => u.id === upgId);
            if (!upg || !count || upg.type !== 'gw_add') continue;
            prestigeBonus += upg.value * count;
        }
    }
    if (connected) totalGwMult += prestigeBonus;

    // Background panel
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const panelW = 195;
    const panelH = 62;
    const padX = 10;
    const padY = 8;
    ctx.fillRect(w - panelW - padX, padY, panelW, panelH);

    // Connection dot
    ctx.fillStyle = color;
    ctx.fillRect(w - panelW - padX + 8, padY + 7, 7, 7);

    // Status line
    ctx.fillStyle = PAL.white;
    ctx.font = '11px monospace';
    ctx.fillText(`${icon} ${label}`, w - panelW - padX + 22, padY + 15);

    // Latency
    ctx.fillStyle = PAL.lt_gray;
    ctx.font = '10px monospace';
    const latency = state._gwLatency || 0;
    ctx.fillText(`Latency: ${latency}ms`, w - panelW - padX + 8, padY + 30);

    // Combined VPS multiplier
    ctx.fillStyle = connected ? PAL.neGrn : PAL.lt_gray;
    ctx.font = '11px monospace';
    const detail = prestigeBonus > 0 ? ` (lat ${baseMult.toFixed(1)} + pr${prestigeBonus.toFixed(1)})` : '';
    ctx.fillText(`VPS ×${totalGwMult.toFixed(1)}${detail}`, w - panelW - padX + 8, padY + 46);

    // Prestige boost bar
    if (prestigeBonus > 0) {
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(w - panelW - padX + 8, padY + 50, panelW - 16, 3);
        ctx.fillStyle = 'rgba(255,215,0,0.6)';
        const boostRatio = Math.min(prestigeBonus / 10, 1);
        ctx.fillRect(w - panelW - padX + 8, padY + 50, (panelW - 16) * boostRatio, 3);
    }

    ctx.restore();
}

// --- MAIN ROOM RENDERER ---
function renderRoom(roomId, canvas, state) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.imageSmoothingEnabled = false;

    // Try external background image first, fall back to programmatic
    drawBackground(roomId, ctx, w, h).then((usedExternal) => {
        if (!usedExternal) {
            switch (roomId) {
                case 'campfire_grove': drawCampfireBg(ctx, w, h, 1); break;
                case 'cyber_den': drawCyberBg(ctx, w, h, 1); break;
                case 'zen_garden': drawZenBg(ctx, w, h, 1); break;
                case 'star_deck': drawStarBg(ctx, w, h, 1); break;
                case 'study_lounge': drawStudyBg(ctx, w, h, 1); break;
                case 'beach_cove': drawBeachBg(ctx, w, h, 1); break;
                default: drawCampfireBg(ctx, w, h, 1);
            }
        }
        // Draw placed decor items (after background)
        const decorPromises = [];
        if (state.placed_decor) {
            const currentRoomId = state.current_room || 'campfire_grove';
            for (const [decorKey, placements] of Object.entries(state.placed_decor)) {
                if (!placements || !Array.isArray(placements)) continue;
                // Skip decor not belonging to current room
                if (!decorBelongsToRoom(decorKey, currentRoomId)) continue;
                for (let i = 0; i < placements.length; i++) {
                    const p = placements[i];
                    const spriteId = decorToSprite(decorKey);
                    // Try external PNG for room decor
                    let sprite = null;
                    if (spriteId.length > 2 && spriteId.includes('_')) {
                        decorPromises.push(
                            loadExternalSprite(`sprites/images/room_decor/icons/${spriteId}.png`).then(img => {
                                if (img) return { decorKey, index: i, sprite: img, p };
                                // Fall back to generated sprite
                                return { decorKey, index: i, sprite: generateSprite(spriteId, 2), p };
                            })
                        );
                    } else {
                        sprite = generateSprite(spriteId, 2);
                        if (!sprite) continue;
                        const snapped = snapToGrid(p.x, p.y);
                        if (dragState.active && dragState.decorKey === decorKey && dragState.index === i) {
                            ctx.save();
                            ctx.translate(dragState.currentX + sprite.width/2, dragState.currentY + sprite.height/2);
                            ctx.rotate(dragState.rotation || 0);
                            ctx.drawImage(sprite, -sprite.width/2, -sprite.height/2);
                            ctx.restore();
                        } else {
                            ctx.drawImage(sprite, snapped.x, snapped.y);
                        }
                    }
                }
            }
        }
        // Draw async loaded decor images
        Promise.all(decorPromises).then(results => {
            for (const r of results) {
                if (!r || !r.sprite || !r.sprite.width) continue;
                const snapped = snapToGrid(r.p.x, r.p.y);
                if (dragState.active && dragState.decorKey === r.decorKey && dragState.index === r.index) {
                    ctx.save();
                    ctx.translate(dragState.currentX + r.sprite.width/2, dragState.currentY + r.sprite.height/2);
                    ctx.rotate(dragState.rotation || 0);
                    ctx.drawImage(r.sprite, -r.sprite.width/2, -r.sprite.height/2);
                    ctx.restore();
                } else {
                    ctx.drawImage(r.sprite, snapped.x, snapped.y);
                }
            }
            drawGodrays(ctx, w, h);
            if (placementState.active) {
                drawPlacementGhost(ctx, state);
            }
            drawGatewayHUD(ctx, w, h, state);
        });
    });
}

// Map decor IDs to sprite names (fallback for when external images fail)
function decorToSprite(decorId) {
    const ROOM_DECOR_MAP = {
        'campfire_grove': ['cg_log_stool','cg_compass','cg_canteen','cg_whittle_figure','cg_star_chart','cg_map_stand','cg_wildflower','cg_berry_bush','cg_birdhouse','cg_fishing_rod','cg_axe_block','cg_wood_pile','cg_bedroll','cg_lantern_post','cg_fire_ring'],
        'cyber_den': ['cd_digital_clock','cd_glitch_art','cd_circuit_board','cd_cooling_fan','cd_data_crystal','cd_rgb_panel','cd_vr_headset','cd_keyboard_rig','cd_cable_spaghetti','cd_server_tower','cd_power_core','cd_access_terminal','cd_projector_screen','cd_robot_arm','cd_holographic_display'],
        'zen_garden': ['zg_tea_set','zg_water_dipper','zg_incense_burner','zg_lotus_flower','zg_wind_chime','zg_meditation_cush','zg_moss_rock','zg_cherry_bonsai','zg_bamboo_fence','zg_stone_path','zg_koi_pond','zg_sand_garden','zg_rain_chain','zg_bamboo_fountain','zg_stone_lantern'],
        'star_deck': ['sd_moon_globe','sd_constellation_map','sd_meteor_stone','sd_orbit_diagram','sd_astrolabe','sd_galaxy_painting','sd_observatory_chair','sd_star_projector','sd_lunar_lamp','sd_cosmic_map','sd_nebula_art','sd_planet_model','sd_rocket_model','sd_satellite_dish','sd_telescope'],
        'study_lounge': ['sl_coffee_mug','sl_candle_holder','sl_plant_pot','sl_wall_clock','sl_typewriter','sl_globe','sl_throw_pillow','sl_magazine_rack','sl_picture_frame','sl_reading_lamp','sl_floor_lamp','sl_record_player','sl_writing_desk','sl_armchair','sl_bookshelf'],
        'beach_cove': ['bc_seashell','bc_starfish','bc_sand_bucket','bc_flip_flops','bc_beach_ball','bc_driftwood','bc_sandcastle','bc_coral_piece','bc_tiki_torch','bc_cooler','bc_beach_towel','bc_surfboard','bc_beach_umbrella','bc_hammock','bc_palm_tree'],
    };
    // Check all rooms for this decor ID
    for (const roomId of Object.keys(ROOM_DECOR_MAP)) {
        if (ROOM_DECOR_MAP[roomId].includes(decorId)) {
            return decorId; // Use the ID directly for external sprite loading
        }
    }
    // Legacy decor fallback
    const map = {
        'lamp_1': 'lamp', 'lamp_2': 'neon_sign', 'lamp_3': 'campfire',
        'plant_1': 'fern', 'plant_2': 'bonsai', 'plant_3': 'cactus',
        'furniture_1': 'desk', 'furniture_2': 'bookshelf', 'furniture_3': 'armchair',
        'table_1': 'table', 'table_2': 'desk',
        'rug_1': 'rug', 'rug_2': 'rug',
        'poster_1': 'poster', 'poster_2': 'poster', 'poster_3': 'frame',
    };
    return map[decorId] || 'lamp';
}

function getDecorSpriteId(decorId) {
    return decorToSprite(decorId);
}

// --- DECOR ROOM MAPPING ---
const DECOR_PREFIX_TO_ROOM = {
    cg: 'campfire_grove',
    cd: 'cyber_den',
    zg: 'zen_garden',
    sd: 'star_deck',
    sl: 'study_lounge',
    bc: 'beach_cove',
};

function decorBelongsToRoom(decorId, roomId) {
    const prefix = decorId.substring(0, 2);
    return DECOR_PREFIX_TO_ROOM[prefix] === roomId;
}

// --- PLACEMENT MODE ---
function startPlacement(decorId) {
    placementState.active = true;
    placementState.decorId = decorId;
}

function cancelPlacement() {
    placementState.active = false;
    placementState.decorId = null;
}

function updatePlacementGhost(mx, my) {
    placementState.ghostX = mx;
    placementState.ghostY = my;
}

function isPlacing() {
    return placementState.active;
}

// --- DRAG SYSTEM ---
function startDrag(decorKey, index, mx, my) {
    dragState.active = true;
    dragState.decorKey = decorKey;
    dragState.index = index;
    dragState.mouseX = mx;
    dragState.mouseY = my;
    dragState.currentX = mx;
    dragState.currentY = my;
    dragState.velocityX = 0;
    dragState.velocityY = 0;
    dragState.rotation = 0;
    dragState.targetRotation = 0;
    dragState.wobblePhase = Math.random() * Math.PI * 2;
}

function updateDrag(mx, my) {
    if (!dragState.active) return;

    // Calculate velocity (for inertia + rotation wobble)
    const rawVx = (mx - dragState.mouseX);
    const rawVy = (my - dragState.mouseY);
    dragState.velocityX = rawVx * 0.3;
    dragState.velocityY = rawVy * 0.3;
    dragState.mouseX = mx;
    dragState.mouseY = my;

    // Calculate rotation from velocity: fast movement = more rotation
    const speed = Math.sqrt(rawVx * rawVx + rawVy * rawVy);
    // Target rotation: small angles proportional to speed, max ±0.15 rad (~8.5°)
    dragState.targetRotation = Math.max(-0.15, Math.min(0.15, speed * 0.008));
    // Smoothly lerp current rotation toward target (acceleration/deceleration feel)
    dragState.rotation += (dragState.targetRotation - dragState.rotation) * 0.15;

    // Apply with lerp for smooth follow (0.5 = snappy but smooth)
    dragState.currentX += (mx - dragState.currentX) * 0.5;
    dragState.currentY += (my - dragState.currentY) * 0.5;
}

function endDrag(state, finalX, finalY) {
    if (!dragState.active) return false;

    // Smooth rotation decay
    dragState.targetRotation = 0;
    dragState.rotation *= 0.8;

    // If final mouse position provided, snap to it (no lerp lag)
    if (finalX !== undefined && finalY !== undefined) {
        dragState.currentX = finalX;
        dragState.currentY = finalY;
    } else {
        // Apply inertia
        dragState.currentX += dragState.velocityX * 3;
        dragState.currentY += dragState.velocityY * 3;
    }

    // Update state (no grid snap — free placement)
    const decorKey = dragState.decorKey;
    const index = dragState.index;
    if (state.placed_decor && state.placed_decor[decorKey] && state.placed_decor[decorKey][index]) {
        state.placed_decor[decorKey][index].x = Math.round(dragState.currentX);
        state.placed_decor[decorKey][index].y = Math.round(dragState.currentY);
    }

    dragState.active = false;
    dragState.decorKey = null;
    dragState.index = -1;

    return true;
}

function isDragging() {
    return dragState.active;
}

function hitTestDecor(state, mx, my) {
    if (!state.placed_decor) return null;
    // Only check decor for the current room
    const currentRoomId = state.current_room || 'campfire_grove';
    // Check from last placed to first (top-most first)
    const decorKeys = Object.keys(state.placed_decor);
    for (let d = decorKeys.length - 1; d >= 0; d--) {
        const key = decorKeys[d];
        // Skip decor that doesn't belong to current room
        if (!decorBelongsToRoom(key, currentRoomId)) continue;
        const placements = state.placed_decor[key];
        if (!placements) continue;
        for (let i = placements.length - 1; i >= 0; i--) {
            const p = placements[i];
            const spriteId = decorToSprite(key);
            const size = getSpritePixelSize(spriteId);
            if (mx >= p.x && mx <= p.x + size.w &&
                my >= p.y && my <= p.y + size.h) {
                return { decorKey: key, index: i };
            }
        }
    }
    return null;
}

// --- PARTICLES ---
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.running = false;
    }

    add(type, x, y, count = 1) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type,
                x: x || Math.random() * this.canvas.width,
                y: y || this.canvas.height * 0.7,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -(0.5 + Math.random() * 1.5),
                life: 0.6 + Math.random() * 0.4,
                decay: 0.003 + Math.random() * 0.005,
                size: 1 + Math.random() * 2,
            });
        }
    }

    render(dt = 1/60) {
        if (!this.running) return;
        const ctx = this.ctx;
        const scale = dt * 60; // Normalize to 60fps
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * scale;
            p.y += p.vy * scale;
            p.life -= p.decay * scale;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.type === 'firefly' ? '#ffee88' : '#aaddff';
            ctx.fillRect(p.x, p.y, p.size, p.size);
            // Glow
            ctx.shadowBlur = 4;
            ctx.shadowColor = p.type === 'firefly' ? '#ffaa44' : '#88ccff';
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.restore();
        }
    }

    // Alias: render() is the drawing method, update() is what the game loop calls
    update(dt) { this.render(dt); }

    start() { this.running = true; }
    stop() { this.running = false; this.particles = []; }
}

// --- EXPORTS ---
export {
    generateSprite,
    renderRoom,
    ParticleSystem,
    PAL,
    PLACEMENT_SNAP,
    snapToGrid,
    worldToGrid,
    gridToWorld,
    startPlacement,
    cancelPlacement,
    updatePlacementGhost,
    isPlacing,
    getDecorSpriteId,
    startDrag,
    updateDrag,
    endDrag,
    isDragging,
    hitTestDecor,
    drawBackground,
    setSpriteRoot,
};
