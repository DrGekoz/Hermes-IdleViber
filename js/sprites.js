// ============================================================
// Hermes IdleViber — Enhanced Pixel Art Engine
// + Decor Grid Placement & Drag System
// ============================================================

// --- GRID CONSTANTS ---
const GRID_CELL = 48;       // Grid cell size in pixels
const PLACEMENT_SNAP = 48;  // Snap distance

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
            '..OOSSSSSSSSSSSS OO......',
            '....OOO HH OOO...........',
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

// Get sprite dimensions (in grid cells)
function getSpriteGridSize(spriteId) {
    const def = SPRITES[spriteId];
    if (!def) return { w: 1, h: 1 };
    return {
        w: Math.ceil(def.w * 2 / GRID_CELL),
        h: Math.ceil(def.h * 2 / GRID_CELL),
    };
}

function getSpritePixelSize(spriteId) {
    const def = SPRITES[spriteId];
    if (!def) return { w: 32, h: 32 };
    return { w: def.w * 2, h: def.h * 2 };
}

// --- GRID SNAPPING ---
function snapToGrid(x, y) {
    return {
        x: Math.round(x / GRID_CELL) * GRID_CELL,
        y: Math.round(y / GRID_CELL) * GRID_CELL,
    };
}

function worldToGrid(x, y) {
    return {
        gx: Math.round(x / GRID_CELL),
        gy: Math.round(y / GRID_CELL),
    };
}

function gridToWorld(gx, gy) {
    return {
        x: gx * GRID_CELL,
        y: gy * GRID_CELL,
    };
}

// --- ROOM BACKGROUND DRAWING ---
const rnd = (seed) => {
    let s = seed || 1;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
};

function drawStars(ctx, w, h, rand, count = 40) {
    ctx.fillStyle = PAL.white;
    for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.6;
        const sz = rand() > 0.85 ? 2 : 1;
        ctx.fillRect(Math.floor(x), Math.floor(y), sz, sz);
    }
}

function drawCampfireBg(ctx, w, h, scale) {
    ctx.fillStyle = PAL.dk_blu;
    ctx.fillRect(0, 0, w, h);

    drawStars(ctx, w, h, rnd(42), 35);

    // Ground
    ctx.fillStyle = PAL.dk_brown;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = PAL.dk_grn;
    ctx.fillRect(0, h * 0.73, w, h * 0.03);

    // Trees
    ctx.fillStyle = PAL.black;
    for (let i = 0; i < 3; i++) {
        const tx = 20 + i * (w / 3) + (i * 7);
        const th = 50 + (i * 13) % 30;
        ctx.fillRect(tx, h * 0.73 - th, 6, th);
        ctx.fillRect(tx - 6, h * 0.73 - th - 12, 10, 6);
        ctx.fillRect(tx - 4, h * 0.73 - th - 18, 8, 6);
    }

    // Fire glow
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.7, 10, w * 0.5, h * 0.7, w * 0.35);
    grad.addColorStop(0, 'rgba(255, 107, 53, 0.25)');
    grad.addColorStop(0.5, 'rgba(255, 170, 68, 0.1)');
    grad.addColorStop(1, 'rgba(255, 170, 68, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}

function drawCyberBg(ctx, w, h, scale) {
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, w, h);

    const rand = rnd(99);
    // Grid
    ctx.strokeStyle = PAL.neGrn;
    ctx.globalAlpha = 0.3;
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

    // Neon lines
    ctx.strokeStyle = PAL.neonPink;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const x = 15 + i * 25;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.25);
        ctx.lineTo(x + 8, h * 0.65);
        ctx.stroke();
    }

    // Matrix rain
    ctx.fillStyle = PAL.neGrn;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 20; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.55;
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 4);
    }
    ctx.globalAlpha = 1;
}

function drawZenBg(ctx, w, h, scale) {
    ctx.fillStyle = PAL.dk_grn;
    ctx.fillRect(0, 0, w, h);

    // Mist
    ctx.fillStyle = 'rgba(129, 199, 132, 0.15)';
    ctx.fillRect(0, h * 0.15, w, h * 0.35);

    // Ground
    ctx.fillStyle = PAL.md_brown;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);

    // Pond
    ctx.fillStyle = PAL.dk_blu;
    ctx.fillRect(w * 0.3, h * 0.82, w * 0.4, h * 0.12);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(w * 0.35, h * 0.84, w * 0.05, 3);
    ctx.fillRect(w * 0.55, h * 0.87, 3, 2);
}

function drawStarBg(ctx, w, h, scale) {
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, w, h);

    drawStars(ctx, w, h, rnd(7), 60);

    // Nebula
    const grad = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.3);
    grad.addColorStop(0, 'rgba(136, 136, 255, 0.15)');
    grad.addColorStop(0.5, 'rgba(136, 136, 255, 0.05)');
    grad.addColorStop(1, 'rgba(136, 136, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Planet
    ctx.fillStyle = PAL.purp;
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.4, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.neonPink;
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.4, 5, 0, Math.PI * 2);
    ctx.fill();
}

function drawStudyBg(ctx, w, h, scale) {
    ctx.fillStyle = PAL.dk_brown;
    ctx.fillRect(0, 0, w, h);

    // Wall
    ctx.fillStyle = PAL.md_brown;
    ctx.fillRect(0, 0, w, h * 0.72);

    // Floor
    ctx.fillStyle = PAL.br_brown;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // Window
    ctx.fillStyle = PAL.dk_blu;
    ctx.fillRect(w * 0.35, h * 0.12, w * 0.3, h * 0.35);
    ctx.fillStyle = PAL.lt_blu;
    ctx.fillRect(w * 0.36, h * 0.13, w * 0.12, h * 0.14);
    ctx.strokeStyle = PAL.tan;
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.35, h * 0.12, w * 0.3, h * 0.35);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.12);
    ctx.lineTo(w * 0.5, h * 0.47);
    ctx.moveTo(w * 0.35, h * 0.295);
    ctx.lineTo(w * 0.65, h * 0.295);
    ctx.stroke();

    // Warm light
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.4);
    grad.addColorStop(0, 'rgba(212, 165, 116, 0.12)');
    grad.addColorStop(1, 'rgba(212, 165, 116, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}

function drawBeachBg(ctx, w, h, scale) {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    skyGrad.addColorStop(0, PAL.lt_blu);
    skyGrad.addColorStop(0.4, PAL.lt_orange);
    skyGrad.addColorStop(1, PAL.md_orange);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.55);

    // Ocean
    ctx.fillStyle = PAL.blu;
    ctx.fillRect(0, h * 0.48, w, h * 0.25);

    // Waves
    ctx.fillStyle = PAL.lt_blu;
    ctx.fillRect(0, h * 0.48, w, 3);
    ctx.fillRect(w * 0.2, h * 0.5, w * 0.3, 2);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(w * 0.6, h * 0.53, w * 0.25, 2);

    // Sand
    ctx.fillStyle = PAL.tan;
    ctx.fillRect(0, h * 0.73, w, h * 0.27);

    // Sun
    ctx.fillStyle = PAL.md_gold;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.33, 15, 0, Math.PI * 2);
    ctx.fill();
    // Sun rays
    ctx.fillStyle = PAL.fire_ylw;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(w * 0.5 - 1, 0, 2, h * 0.25);
    ctx.fillRect(w * 0.4, h * 0.2, w * 0.2, 2);
    ctx.globalAlpha = 1;
}

// --- EXTERNAL SPRITE LOADER ---
// Loads pre-generated PNG sprites from sprites/images/
const externalSprites = {};
let externalSpriteRoot = '';

function setSpriteRoot(root) {
    externalSpriteRoot = root;
}

function loadExternalSprite(path) {
    if (externalSprites[path]) return Promise.resolve(externalSprites[path]);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            externalSprites[path] = img;
            resolve(img);
        };
        img.onerror = () => {
            resolve(null);
        };
        img.src = path;
    });
}

async function drawBackground(roomId, ctx, w, h) {
    const bgMap = {
        'campfire_grove': 'bg_campfire',
        'cyber_den': 'bg_cyber',
        'zen_garden': 'bg_zen',
        'star_deck': 'bg_star',
        'study_lounge': 'bg_study',
        'beach_cove': 'bg_beach',
    };
    const bgName = bgMap[roomId];
    if (bgName) {
        const img = await loadExternalSprite(`sprites/images/bg/${bgName}.png`);
        if (img) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, w, h);
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
function playPlacementSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.05);
        osc.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.1);

        const env = audioCtx.createGain();
        env.gain.setValueAtTime(0.08, audioCtx.currentTime);
        env.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        osc.connect(env);
        env.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}

// --- GRID OVERLAY ---
function drawGridOverlay(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += GRID_CELL) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += GRID_CELL) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    ctx.restore();
}

// --- PLACEMENT GHOST ---
function drawPlacementGhost(ctx, state) {
    if (!placementState.active || !placementState.decorId) return;
    const sprite = generateSprite(placementState.decorId, 2);
    if (!sprite) return;

    const snapped = snapToGrid(placementState.ghostX, placementState.ghostY);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(sprite, snapped.x, snapped.y);
    ctx.restore();

    // Draw ghost border
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(snapped.x, snapped.y, sprite.width, sprite.height);
    ctx.restore();
}

// --- GATEWAY HUD (top-right canvas) ---
function drawGatewayHUD(ctx, w, h, state) {
    ctx.save();
    const connected = state.gateway_bonus_active;
    const mult = state._gwMult || 1.0;
    const label = state._gwLabel || (connected ? 'Connected' : 'Disconnected');
    const icon = connected ? '🔗' : '⛔';
    const color = connected ? '#00ff88' : '#ff4444';

    // Background panel
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const panelW = 160;
    const panelH = 42;
    const padX = 10;
    const padY = 8;
    ctx.fillRect(w - panelW - padX, padY, panelW, panelH);

    // Connection dot
    ctx.fillStyle = color;
    ctx.fillRect(w - panelW - padX + 8, padY + 6, 6, 6);

    // Status line
    ctx.fillStyle = PAL.white;
    ctx.font = '8px monospace';
    ctx.fillText(`${icon} ${label}`, w - panelW - padX + 20, padY + 12);

    // Latency and multiplier
    ctx.fillStyle = PAL.lt_gray;
    ctx.font = '7px monospace';
    const latency = state._gwLatency || 0;
    ctx.fillText(`Latency: ${latency}ms`, w - panelW - padX + 8, padY + 25);

    ctx.fillStyle = connected ? PAL.neGrn : PAL.lt_gray;
    ctx.fillText(`VPS ×${mult.toFixed(1)}`, w - panelW - padX + 8, padY + 37);

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
        if (state.placed_decor) {
            for (const [decorKey, placements] of Object.entries(state.placed_decor)) {
                if (!placements || !Array.isArray(placements)) continue;
                for (let i = 0; i < placements.length; i++) {
                    const p = placements[i];
                    const spriteId = decorToSprite(decorKey);
                    const sprite = generateSprite(spriteId, 2);
                    if (!sprite) continue;
                    const snapped = snapToGrid(p.x, p.y);
                    ctx.save();
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(snapped.x + 2, snapped.y + 2, sprite.width, sprite.height);
                    ctx.restore();
                    if (dragState.active && dragState.decorKey === decorKey && dragState.index === i) {
                        const wobbleX = Math.sin(Date.now() * 0.015 + dragState.wobblePhase) * 2;
                        const wobbleY = Math.sin(Date.now() * 0.012 + dragState.wobblePhase + 1) * 2;
                        ctx.drawImage(sprite, dragState.currentX + wobbleX, dragState.currentY + wobbleY);
                    } else {
                        ctx.drawImage(sprite, snapped.x, snapped.y);
                    }
                }
            }
        }
        drawGodrays(ctx, w, h);
        if (placementState.active) {
            drawGridOverlay(ctx, w, h);
            drawPlacementGhost(ctx, state);
        }
        drawGatewayHUD(ctx, w, h, state);
    });
}

// Map decor IDs to sprite names
function decorToSprite(decorId) {
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
    dragState.wobblePhase = Math.random() * Math.PI * 2;
}

function updateDrag(mx, my) {
    if (!dragState.active) return;

    // Calculate velocity (for inertia)
    dragState.velocityX = (mx - dragState.mouseX) * 0.3;
    dragState.velocityY = (my - dragState.mouseY) * 0.3;
    dragState.mouseX = mx;
    dragState.mouseY = my;

    // Apply with lerp for smooth follow
    dragState.currentX += (mx - dragState.currentX) * 0.2;
    dragState.currentY += (my - dragState.currentY) * 0.2;
}

function endDrag(state) {
    if (!dragState.active) return false;

    // Apply inertia
    dragState.currentX += dragState.velocityX * 3;
    dragState.currentY += dragState.velocityY * 3;

    // Snap to grid
    const snapped = snapToGrid(dragState.currentX, dragState.currentY);

    // Update state
    const decorKey = dragState.decorKey;
    const index = dragState.index;
    if (state.placed_decor && state.placed_decor[decorKey] && state.placed_decor[decorKey][index]) {
        state.placed_decor[decorKey][index].x = snapped.x;
        state.placed_decor[decorKey][index].y = snapped.y;
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
    // Check from last placed to first (top-most first)
    const decorKeys = Object.keys(state.placed_decor);
    for (let d = decorKeys.length - 1; d >= 0; d--) {
        const key = decorKeys[d];
        const placements = state.placed_decor[key];
        if (!placements) continue;
        for (let i = placements.length - 1; i >= 0; i--) {
            const p = placements[i];
            const spriteId = decorToSprite(key);
            const size = getSpritePixelSize(spriteId);
            const snapped = snapToGrid(p.x, p.y);
            if (mx >= snapped.x && mx <= snapped.x + size.w &&
                my >= snapped.y && my <= snapped.y + size.h) {
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

    render() {
        if (!this.running) return;
        const ctx = this.ctx;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
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

    start() { this.running = true; }
    stop() { this.running = false; this.particles = []; }
}

// --- EXPORTS ---
export {
    generateSprite,
    renderRoom,
    ParticleSystem,
    PAL,
    GRID_CELL,
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
    playPlacementSound,
    drawBackground,
    setSpriteRoot,
};
