// ============================================================
// Hermes IdleViber — Hermes Gateway Integration v4
// Optimized: cached ports, faster scanning, instant reconnect
// ============================================================

import { G, CONFIG, notifyStateChange } from './state.js';

const CACHE_KEY = 'hermes_idleviber_gateway_port';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

let gatewayStatus = {
    connected: false,
    latency: 0,
    host: null,
    port: null,
    url: null,
    lastPing: 0,
    history: [],
    checkCount: 0,
    lastError: null,
    scanning: false,
    scanProgress: 0,
    scanTotal: 0,
    isHermes: false,
};

const listeners = [];
let scanCancelled = false;
let activeScanPromise = null;
let rediscoverTimer = null;

function onGatewayChange(handler) { listeners.push(handler); }
function notifyListeners() { for (const h of listeners) h(gatewayStatus); }

// --- PORT CACHE (localStorage) ---
function getCachedPort() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { port, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp > CACHE_TTL) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return port;
    } catch { return null; }
}

function setCachedPort(port) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ port, timestamp: Date.now() }));
    } catch {}
}

function clearCachedPort() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
}

// --- HOT PORTS (most common dev / Hermes / game server ports) ---
// Ordered by likelihood — checked in this order
const HOT_PORTS = [
    4444, 4445,           // Hermes IdleViber game server
    7777, 8000, 8001,     // Common dev servers
    8080, 8081, 8082, 8083,
    3000, 3001, 4000, 5000, 5001,
    5173, 5174, 5555, 6000, 7000,
    7070, 7071, 8443, 8644, 8888, 9000, 9090,
    8765, 8766, 8767,     // TTS / voice servers
    11434, 11435, 11436,  // LLM inference
    11111, 1234, 1337, 18080,
    1880, 1881, 2020, 2021,
    30000, 31000, 4200, 4201, 4300,
    50001, 50002, 50003, 50004, 50005,
];

// --- PORT PING via no-cors (fast check) ---
async function portIsAlive(port, timeout = 200) {
    try {
        const start = performance.now();
        const res = await fetch(`http://localhost:${port}/`, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: AbortSignal.timeout(timeout),
        });
        const latency = performance.now() - start;
        return { alive: true, latency, response: res };
    } catch (e) {
        return { alive: false };
    }
}

// After finding an open port, try to identify it
async function identifyPort(port) {
    const urls = [
        `http://localhost:${port}/health`,
        `http://localhost:${port}/api/health`,
        `http://localhost:${port}/`,
    ];
    for (const url of urls) {
        try {
            const start = performance.now();
            const res = await fetch(url, {
                method: 'GET',
                cache: 'no-cache',
                signal: AbortSignal.timeout(800),
            });
            const latency = performance.now() - start;
            if (res.ok || (res.status >= 200 && res.status < 300)) {
                let isHermes = false;
                let label = 'Server';
                try {
                    const text = await res.clone().text();
                    if (/hermes|gateway/i.test(text)) {
                        isHermes = true;
                        label = 'Hermes Gateway';
                    } else if (/html/i.test(text) && res.headers.get('content-type')?.includes('text/html')) {
                        label = 'Web Server';
                    }
                } catch (_) {}
                return { alive: true, latency, url, isHermes, label };
            }
            return { alive: true, latency, url, isHermes: false, label: `HTTP ${res.status}` };
        } catch (_) { continue; }
    }
    return { alive: true, latency: 1, url: `http://localhost:${port}`, isHermes: false, label: 'Unknown Server' };
}

// --- SCAN A BATCH OF PORTS (parallel, fast) ---
async function scanBatch(ports) {
    if (scanCancelled) return null;
    const results = await Promise.allSettled(
        ports.map(async (port) => {
            if (scanCancelled) return null;
            const check = await portIsAlive(port);
            if (check.alive) {
                return { port, ...check };
            }
            return null;
        })
    );
    const found = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    if (found.length === 0) return null;
    // Re-identify the best candidate (fast parallel)
    const identified = await Promise.allSettled(
        found.map(async (f) => {
            const id = await identifyPort(f.port);
            return { port: f.port, latency: f.latency, ...id };
        })
    );
    const candidates = identified
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    if (candidates.length === 0) return null;
    // Prefer Hermes gateways, then lowest latency
    const hermes = candidates.filter(r => r.isHermes);
    if (hermes.length > 0) {
        hermes.sort((a, b) => a.latency - b.latency);
        return hermes[0];
    }
    candidates.sort((a, b) => a.latency - b.latency);
    return candidates[0];
}

// --- MAIN DISCOVERY (locked, with cached port shortcut) ---
async function discoverGateway() {
    if (activeScanPromise) {
        return await activeScanPromise;
    }

    // Skip gateway discovery when running on a remote server (Netlify, etc.)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        gatewayStatus.connected = false;
        gatewayStatus.lastError = 'Not localhost';
        G.gateway_bonus_active = false;
        G._gwMult = 1.0;
        G._gwLabel = 'Disconnected';
        notifyStateChange('gateway');
        notifyListeners();
        return { success: false, reason: 'not_localhost' };
    }

    activeScanPromise = (async () => {
        if (rediscoverTimer) { clearTimeout(rediscoverTimer); rediscoverTimer = null; }

        scanCancelled = false;
        const selfPort = parseInt(window.location.port);

        gatewayStatus.scanning = true;
        gatewayStatus.scanProgress = 0;
        notifyListeners();

        // --- Phase 0: Check cached port (INSTANT if previously connected) ---
        const cachedPort = getCachedPort();
        if (cachedPort && cachedPort !== selfPort) {
            // console.log(`🔌 Checking cached port: ${cachedPort}`);
            const check = await portIsAlive(cachedPort, 300);
            if (check.alive) {
                const id = await identifyPort(cachedPort);
                if (id.alive) {
                    // console.log(`🔌 Reconnected via cache: localhost:${cachedPort}`);
                    gatewayStatus.scanning = false;
                    activeScanPromise = null;
                    await connectToGateway(cachedPort, id.latency, id.label);
                    return { success: true, port: cachedPort, latency: id.latency, label: id.label, cached: true };
                }
            }
        }

        // --- Phase 1: Hot ports (50 ports, ~1-2 seconds) ---
        // console.log('🔌 Scanning hot ports...');
        const hotTargets = [...new Set(HOT_PORTS.filter(p => p !== selfPort))];
        const hotResult = await scanBatch(hotTargets);
        if (hotResult && hotResult.port && !scanCancelled) {
            // console.log(`🔌 Found: localhost:${hotResult.port} (${hotResult.label})`);
            gatewayStatus.scanning = false;
            activeScanPromise = null;
            setCachedPort(hotResult.port);
            await connectToGateway(hotResult.port, hotResult.latency, hotResult.label);
            return { success: true, port: hotResult.port, latency: hotResult.latency, label: hotResult.label };
        }

        // --- Phase 2: Web server range 1024-5000 (common dev range, faster) ---
        // console.log('🔌 Scanning web server range 1024-5000...');
        const rangePorts = [];
        for (let p = 1024; p <= 5000; p++) {
            if (p !== selfPort && !HOT_PORTS.includes(p)) rangePorts.push(p);
        }
        gatewayStatus.scanTotal = hotTargets.length + rangePorts.length;
        gatewayStatus.scanProgress = hotTargets.length;

        const BATCH = 50; // Increased from 20 → 50 for faster wide scan
        let found = null;
        for (let i = 0; i < rangePorts.length && !scanCancelled; i += BATCH) {
            const batch = rangePorts.slice(i, i + BATCH);
            gatewayStatus.scanProgress = hotTargets.length + i + batch.length;
            // Throttle UI updates to every few hundred ports
            if (i % 200 === 0) notifyListeners();

            const result = await scanBatch(batch);
            if (result) { found = result; break; }
        }

        gatewayStatus.scanning = false;
        activeScanPromise = null;

        if (found && found.port && !scanCancelled) {
            // console.log(`🔌 Found: localhost:${found.port} (${found.label})`);
            setCachedPort(found.port);
            await connectToGateway(found.port, found.latency, found.label);
            return { success: true, port: found.port, latency: found.latency, label: found.label };
        }

        // Not found
        // console.log('🔌 No gateway found on scanned ports (hot + 1024-5000)');
        gatewayStatus.connected = false;
        gatewayStatus.lastError = 'No gateway found on scanned ports';
        G.gateway_bonus_active = false;
        G._gwMult = 1.0;
        G._gwLabel = 'Disconnected';
        G._gwLatency = 0;
        notifyStateChange('gateway');
        notifyListeners();
        return { success: false };
    })();

    return await activeScanPromise;
}

function cancelScan() {
    scanCancelled = true;
    gatewayStatus.scanning = false;
    activeScanPromise = null;
}

async function connectToGateway(port, latency, label) {
    cancelScan();
    gatewayStatus.connected = true;
    gatewayStatus.latency = latency || 1;
    gatewayStatus.host = 'localhost';
    gatewayStatus.port = port;
    gatewayStatus.url = `http://localhost:${port}`;
    gatewayStatus.lastPing = Date.now();
    gatewayStatus.lastError = null;
    gatewayStatus.history.push(latency || 1);
    if (gatewayStatus.history.length > CONFIG.MAX_GATEWAY_LATENCY_HISTORY) {
        gatewayStatus.history.shift();
    }
    gatewayStatus.isHermes = /hermes/i.test(label || '');
    G.gateway_bonus_active = true;
    G._gwMult = getLatencyMultiplier();
    G._gwLabel = getConnectionQuality().label;
    G._gwLatency = Math.round(latency);
    notifyStateChange('gateway');
    notifyListeners();
}

// --- MANUAL PORT CONNECTION ---
async function connectToPort(port) {
    cancelScan();
    const id = await identifyPort(port);
    if (id.alive) {
        setCachedPort(port);
        await connectToGateway(port, id.latency, id.label);
        return { success: true, port, latency: id.latency, label: id.label };
    }
    const check = await portIsAlive(port, 2000);
    if (check.alive) {
        setCachedPort(port);
        await connectToGateway(port, check.latency, 'Unknown Server (CORS blocked)');
        return { success: true, port, latency: check.latency, label: 'Connected (CORS blocked)' };
    }
    return { success: false };
}

// --- PING (keep-alive check) ---
async function pingGateway() {
    if (!gatewayStatus.url || !gatewayStatus.connected) {
        return { success: false, reason: 'not_connected' };
    }
    try {
        const start = performance.now();
        const res = await fetch(`${gatewayStatus.url}/health`, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: AbortSignal.timeout(CONFIG.GATEWAY_TIMEOUT),
        });
        const latency = performance.now() - start;
        if (res.ok || (res.status >= 200 && res.status < 300)) {
            gatewayStatus.connected = true;
            gatewayStatus.latency = latency;
            gatewayStatus.lastPing = Date.now();
            gatewayStatus.history.push(latency);
            if (gatewayStatus.history.length > CONFIG.MAX_GATEWAY_LATENCY_HISTORY) {
                gatewayStatus.history.shift();
            }
            if (!G.gateway_bonus_active) {
                G.gateway_bonus_active = true;
                notifyStateChange('gateway');
            }
            G._gwMult = getLatencyMultiplier();
            G._gwLabel = getConnectionQuality().label;
            G._gwLatency = Math.round(latency);
            notifyListeners();
            return { success: true, latency };
        } else {
            gatewayStatus.latency = latency;
            gatewayStatus.lastPing = Date.now();
            G._gwMult = getLatencyMultiplier();
            notifyListeners();
            return { success: true, latency };
        }
    } catch (e) {
        // Connection lost — mark disconnected, try cached port fast rediscover
        gatewayStatus.connected = false;
        gatewayStatus.lastError = 'Connection lost';
        G.gateway_bonus_active = false;
        G._gwMult = 1.0;
        G._gwLabel = 'Disconnected';
        G._gwLatency = 0;
        notifyStateChange('gateway');
        notifyListeners();
        // Fast rediscover (immediately check cached port, then hot ports)
        if (!rediscoverTimer) {
            rediscoverTimer = setTimeout(() => {
                rediscoverTimer = null;
                discoverGateway();
            }, 5000); // Reduced from 30s → 5s for faster recovery
        }
        return { success: false };
    }
}

function getAverageLatency() {
    if (gatewayStatus.history.length === 0) return 0;
    return gatewayStatus.history.reduce((a, b) => a + b, 0) / gatewayStatus.history.length;
}

function getLatencyMultiplier() {
    if (!gatewayStatus.connected) return 1.0;
    const l = gatewayStatus.latency;
    if (l >= 500) return 10.0;
    if (l >= 200) return 8.0;
    if (l >= 100) return 5.0;
    if (l >= 50)  return 3.5;
    if (l >= 20)  return 2.5;
    return 2.0;
}

function getConnectionQuality() {
    if (!gatewayStatus.connected) return { label: 'Disconnected', color: '#ff4444', icon: '⛔' };
    const l = gatewayStatus.latency;
    if (l >= 500) return { label: 'Churning', color: '#ff00ff', icon: '⚡' };
    if (l >= 200) return { label: 'Cooking',  color: '#ff6600', icon: '🔥' };
    if (l >= 100) return { label: 'Active',   color: '#ffaa00', icon: '🔄' };
    if (l >= 50)  return { label: 'Warming',  color: '#88ff00', icon: '🌡️' };
    return { label: 'Connected', color: '#00ff88', icon: '🔗' };
}

function getGatewayStatus() { return gatewayStatus; }

// --- CHECK IF HERMES IS CURRENTLY WORKING ON A TASK ---
let gatewayTaskBusy = false;
let gatewayTaskLabel = '';

async function checkGatewayBusy() {
    if (!gatewayStatus.connected || !gatewayStatus.url) return false;
    // Only check busy status on actual Hermes gateways, not random servers
    if (!gatewayStatus.isHermes) { gatewayTaskBusy = false; gatewayTaskLabel = ''; return false; }
    try {
        const start = performance.now();
        const res = await fetch(`${gatewayStatus.url}/api/status`, {
            method: 'GET',
            cache: 'no-cache',
            signal: AbortSignal.timeout(1500),
        });
        const latency = performance.now() - start;
        if (res.ok) {
            try {
                const data = await res.json();
                // Hermes gateway reports active sessions, task count, etc.
                const activeSessions = data.active_sessions || data.sessions || 0;
                const taskRunning = data.task_running || data.busy || false;
                const taskCount = data.task_count || data.queue_size || 0;
                if (taskRunning || activeSessions > 0) {
                    gatewayTaskBusy = true;
                    gatewayTaskLabel = taskCount > 1 ? `${taskCount} tasks` : (taskRunning ? 'Processing' : `${activeSessions} sessions`);
                    return true;
                }
            } catch (_) {}
            // Fallback: check if response body contains busy/active indicators
            try {
                const text = await res.clone().text();
                if (/\b(busy|active|processing|running)\b/i.test(text)) {
                    gatewayTaskBusy = true;
                    gatewayTaskLabel = 'Active';
                    return true;
                }
            } catch (_) {}
        }
    } catch (_) {}
    gatewayTaskBusy = false;
    gatewayTaskLabel = '';
    return false;
}

function isGatewayBusy() { return gatewayTaskBusy; }
function getGatewayTaskLabel() { return gatewayTaskLabel; }

export {
    discoverGateway,
    pingGateway,
    connectToPort,
    cancelScan,
    getAverageLatency,
    getLatencyMultiplier,
    getConnectionQuality,
    getGatewayStatus,
    checkGatewayBusy,
    isGatewayBusy,
    getGatewayTaskLabel,
    onGatewayChange,
};
