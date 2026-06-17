const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4444;
const PUBLIC_DIR = path.join(__dirname, '..');
const DATA_FILE = path.join(__dirname, 'data.json');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
};

// ---- DATA STORE (JSON file DB) ----
function initData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initial = {
            users: {},
            saves: {},
            leaderboard: [],
            tokens: {},
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    }
}

function readData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        const initial = { users: {}, saves: {}, leaderboard: [], tokens: {} };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
}

function writeData(data) {
    // Atomic write
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
}

// ---- AUTH UTILITIES ----
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
    return salt + ':' + hash;
}

function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const check = crypto.createHash('sha256').update(salt + password).digest('hex');
    return hash === check;
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function getTokenTTL() {
    return 7 * 24 * 60 * 60 * 1000; // 7 days
}

function cleanExpiredTokens(data) {
    const now = Date.now();
    for (const [token, info] of Object.entries(data.tokens)) {
        if (now > info.expires) {
            delete data.tokens[token];
        }
    }
}

function verifyToken(data, token) {
    if (!token || !data.tokens[token]) return null;
    const info = data.tokens[token];
    if (Date.now() > info.expires) {
        delete data.tokens[token];
        writeData(data);
        return null;
    }
    return info.username;
}

// ---- BODY PARSER ----
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve(null);
            }
        });
        req.on('error', reject);
    });
}

// ---- JSON RESPONSE HELPERS ----
function jsonResponse(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data));
}

function serveStatic(req, res, url) {
    if (url === '/') url = '/index.html';
    const filePath = path.join(PUBLIC_DIR, url);

    // Security: only serve files within PUBLIC_DIR
    if (!filePath.startsWith(PUBLIC_DIR)) {
        jsonResponse(res, 403, { error: 'Forbidden' });
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Set stronger cache control for JS modules to prevent stale code
    const cacheControl = ext === '.js'
        ? 'no-store, must-revalidate'
        : 'no-cache';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                jsonResponse(res, 404, { error: 'Not Found' });
            } else {
                jsonResponse(res, 500, { error: 'Server Error' });
            }
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': cacheControl,
        });
        res.end(data);
    });
}

// ---- API ROUTES ----
async function handleAPI(req, res, url) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        jsonResponse(res, 200, { ok: true });
        return;
    }

    const data = readData();

    // ---- GET /api/health ----
    if (url === '/api/health' && req.method === 'GET') {
        cleanExpiredTokens(data);
        jsonResponse(res, 200, {
            status: 'ok',
            players: Object.keys(data.users).length,
            leaderboard_entries: data.leaderboard.length,
            server: 'Hermes IdleViber API',
        });
        return;
    }

    // ---- POST /api/register ----
    if (url === '/api/register' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || !body.username || !body.password) {
            jsonResponse(res, 400, { error: 'Username and password required' });
            return;
        }
        const username = body.username.trim().toLowerCase();
        if (!username || username.length < 2) {
            jsonResponse(res, 400, { error: 'Username must be at least 2 characters' });
            return;
        }
        if (/^drgekoz$/i.test(username)) {
            jsonResponse(res, 403, { error: 'That username is reserved' });
            return;
        }
        if (body.password.length < 4) {
            jsonResponse(res, 400, { error: 'Password must be at least 4 characters' });
            return;
        }
        if (data.users[username]) {
            jsonResponse(res, 409, { error: 'Username already taken' });
            return;
        }

        data.users[username] = {
            password: hashPassword(body.password),
            created_at: new Date().toISOString(),
        };
        writeData(data);
        jsonResponse(res, 201, { success: true, message: 'Account created' });
        return;
    }

    // ---- POST /api/login ----
    if (url === '/api/login' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || !body.username || !body.password) {
            jsonResponse(res, 400, { error: 'Username and password required' });
            return;
        }
        const username = body.username.trim().toLowerCase();
        const user = data.users[username];
        if (!user || !verifyPassword(body.password, user.password)) {
            jsonResponse(res, 401, { error: 'Invalid username or password' });
            return;
        }

        cleanExpiredTokens(data);

        // Generate new token
        const token = generateToken();
        data.tokens[token] = {
            username,
            created: Date.now(),
            expires: Date.now() + getTokenTTL(),
        };
        writeData(data);

        jsonResponse(res, 200, {
            success: true,
            token,
            username,
            message: 'Login successful',
        });
        return;
    }

    // ---- POST /api/save ----
    if (url === '/api/save' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || !body.token || !body.state) {
            jsonResponse(res, 400, { error: 'Token and state required' });
            return;
        }
        const username = verifyToken(readData(), body.token);
        if (!username) {
            jsonResponse(res, 401, { error: 'Invalid or expired token' });
            return;
        }

        const d = readData();
        d.saves[username] = {
            state: body.state,
            updated_at: new Date().toISOString(),
        };
        writeData(d);

        jsonResponse(res, 200, { success: true, message: 'Save uploaded' });
        return;
    }

    // ---- GET /api/load ----
    if (url.startsWith('/api/load') && req.method === 'GET') {
        const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
        const token = params.get('token');
        if (!token) {
            jsonResponse(res, 400, { error: 'Token required' });
            return;
        }

        // Re-read fresh data for token check
        const d = readData();
        const username = verifyToken(d, token);
        if (!username) {
            jsonResponse(res, 401, { error: 'Invalid or expired token' });
            return;
        }

        const save = d.saves[username];
        jsonResponse(res, 200, {
            success: true,
            state: save ? save.state : null,
            updated_at: save ? save.updated_at : null,
        });
        return;
    }

    // ---- POST /api/leaderboard/submit ----
    if (url === '/api/leaderboard/submit' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || !body.token) {
            jsonResponse(res, 400, { error: 'Token required' });
            return;
        }

        const d = readData();
        const username = verifyToken(d, body.token);
        if (!username) {
            jsonResponse(res, 401, { error: 'Invalid or expired token' });
            return;
        }

        const score = Math.floor(body.score || 0);
        const prestigeLevel = body.prestige_level || 0;
        const vps = body.vps || 0;

        // Upsert leaderboard entry
        const existing = d.leaderboard.findIndex(e => e.username === username);
        const entry = {
            username,
            score,
            prestige_level: prestigeLevel,
            vps,
            updated_at: new Date().toISOString(),
        };

        if (existing >= 0) {
            if (score > d.leaderboard[existing].score) {
                d.leaderboard[existing] = entry;
            }
        } else {
            d.leaderboard.push(entry);
        }

        // Sort by score descending
        d.leaderboard.sort((a, b) => b.score - a.score);
        writeData(d);

        jsonResponse(res, 200, { success: true, rank: d.leaderboard.findIndex(e => e.username === username) + 1 });
        return;
    }

    // ---- GET /api/leaderboard ----
    if (url.startsWith('/api/leaderboard') && req.method === 'GET') {
        const d = readData();
        const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
        const limit = Math.min(parseInt(params.get('limit')) || 50, 200);

        const entries = d.leaderboard.slice(0, limit).map((e, i) => ({
            rank: i + 1,
            username: e.username,
            score: e.score,
            prestige_level: e.prestige_level,
            vps: e.vps || 0,
        }));

        jsonResponse(res, 200, { entries, total: d.leaderboard.length });
        return;
    }

    // ---- POST /api/events (batched client events) ----
    if (url === '/api/events' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body) { jsonResponse(res, 400, { error: 'Invalid body' }); return; }
        console.log(`[Events] ${body.session}: ${body.clicks || 0} clicks, ${(body.events || []).length} events, VPS=${body.vps || 0}`);
        // In production, validate HMAC, store to DB, process game logic
        jsonResponse(res, 200, { ok: true, received: body.clicks || 0 });
        return;
    }

    // ---- 404 for unknown API routes ----
    jsonResponse(res, 404, { error: 'API route not found' });
}

// ---- MAIN SERVER ----
initData();

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (req.method === 'OPTIONS') {
        // CORS preflight for ALL routes
        jsonResponse(res, 200, { ok: true });
        return;
    }

    if (url.startsWith('/api/')) {
        handleAPI(req, res, url);
    } else {
        serveStatic(req, res, url);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
🔥 Hermes IdleViber Server 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Running on: http://localhost:${PORT}
  CORS:       Enabled
  API:        /api/* (auth, saves, leaderboard)
  PID:        ${process.pid}
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open your browser and start vibing!
`);
});
