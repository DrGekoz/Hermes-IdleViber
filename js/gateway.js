// ============================================================
// Hermes IdleViber — Hermes Gateway Integration
// Full port scanning: ALL 65535 ports, progressive scan
// ============================================================

import { G, CONFIG, notifyStateChange } from './state.js';

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
    foundViaFullScan: false,
};

const listeners = [];
let scanCancelled = false;
let fullScanTimer = null;

function onGatewayChange(handler) {
    listeners.push(handler);
}

function notifyListeners() {
    for (const h of listeners) h(gatewayStatus);
}

// --- PORT ORDERING ---
// Most likely ports first for fastest discovery
const HOT_PORTS = [
    7777, 8000, 8001, 8080, 8081, 3000, 3001, 5000, 5001,
    4000, 4444, 5173, 5174, 5555, 6000, 7000, 7070, 7071,
    9000, 9090, 8443, 8888, 11111, 18080,
    30000, 31000, 4200, 4201, 4300,
    50001, 50002, 50003, 50004, 50005,
    8765, 8766, 8767, 11434, 11435, 11436,
    1234, 1337, 1880, 1881, 2020, 2021,
    2323, 2324, 25565, 27015, 27016,
];

function buildFullPortList() {
    const skip = new Set(HOT_PORTS);
    const selfPort = parseInt(window.location.port);
    if (selfPort) skip.add(selfPort);
    const ports = [];
    // First: hot ports
    for (const p of HOT_PORTS) {
        if (p !== selfPort) ports.push(p);
    }
    // Then: priority ranges (most likely for dev servers)
    for (let p = 1024; p <= 10000; p++) {
        if (!skip.has(p) && p !== selfPort) ports.push(p);
    }
    // System ports
    for (let p = 1; p <= 1023; p++) {
        if (!skip.has(p) && p !== selfPort) ports.push(p);
    }
    // Rest
    for (let p = 10001; p <= 65535; p++) {
        if (!skip.has(p) && p !== selfPort) ports.push(p);
    }
    return ports;
}

// --- PORT PING (aggressive timeout) ---
async function pingPort(port, timeout = 300) {
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
                signal: AbortSignal.timeout(timeout),
            });
            const latency = performance.now() - start;
            if (res.ok || (res.status >= 200 && res.status < 300)) {
                let isHermes = false;
                let label = 'Server';
                try {
                    const text = await res.clone().text();
                    if (text.includes('hermes') || text.includes('Hermes') || text.includes('gateway') || text.includes('Gateway')) {
                        isHermes = true;
                        label = 'Hermes Gateway';
                    }
                } catch (_) {}
                return { alive: true, latency, url, isHermes, label };
            }
            const latency2 = performance.now() - start;
            return { alive: true, latency: latency2, url, isHermes: false, label: `HTTP ${res.status}` };
        } catch (e) {
            continue;
        }
    }
    return { alive: false };
}

// --- BATCH SCAN (single batch of ports) ---
async function scanBatch(ports) {
    if (scanCancelled) return null;
    const results = await Promise.all(
        ports.map(async (port) => {
            if (scanCancelled) return null;
            const result = await pingPort(port);
            if (result.alive) {
                return { port, ...result };
            }
            return null;
        })
    );
    const found = results.filter(r => r !== null);
    if (found.length > 0) {
        const hermes = found.filter(r => r.isHermes);
        if (hermes.length > 0) {
            hermes.sort((a, b) => a.latency - b.latency);
            return hermes[0];
        }
        found.sort((a, b) => a.latency - b.latency);
        return found[0];
    }
    return null;
}

// --- FULL SCAN ALL PORTS ---
// Returns when gateway is found OR all ports scanned
async function fullScanAllPorts(progressCallback) {
    scanCancelled = false;
    gatewayStatus.scanning = true;
    gatewayStatus.scanProgress = 0;

    const allPorts = buildFullPortList();
    const total = allPorts.length;
    gatewayStatus.scanTotal = total;
    notifyListeners();

    const BATCH_SIZE = 30;
    let found = null;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        if (scanCancelled) break;

        const batch = allPorts.slice(i, i + BATCH_SIZE);
        gatewayStatus.scanProgress = i + batch.length;

        const result = await scanBatch(batch);
        if (result) {
            found = result;
            break;
        }

        // Progress notification throttled
        if (progressCallback && (i % 300 === 0 || i + BATCH_SIZE >= total)) {
            progressCallback(gatewayStatus.scanProgress, total);
        }
    }

    gatewayStatus.scanning = false;
    gatewayStatus.scanProgress = gatewayStatus.scanTotal;
    notifyListeners();
    return found;
}

// --- DISCOVERY (two-stage) ---
async function discoverGateway() {
    scanCancelled = false;
    gatewayStatus.scanning = false;
    gatewayStatus.scanProgress = 0;

    // Stage 1: Quick scan hot ports
    console.log('🔌 Stage 1: Scanning hot ports...');
    const selfPort = parseInt(window.location.port);
    const hotTargets = HOT_PORTS.filter(p => p !== selfPort);
    const quickResult = await scanBatch(hotTargets);
    if (quickResult && quickResult.port) {
        console.log(`🔌 Hot port found: localhost:${quickResult.port} (${quickResult.label})`);
        await connectToGateway(quickResult.port, quickResult.latency, quickResult.label);
        return { success: true, port: quickResult.port, latency: quickResult.latency, label: quickResult.label };
    }

    console.log('🔌 Hot ports empty — starting full scan of all 65535 ports...');
    gatewayStatus.lastError = 'Full scan in progress — will auto-connect when found';
    notifyListeners();

    // Stage 2: Full progressive scan (runs while player plays)
    fullScanAllPorts((progress, total) => {
        // UI updates via notifyListeners
        notifyListeners();
    }).then(async (found) => {
        if (found && found.port && !scanCancelled) {
            console.log(`🔌 Found via full scan: localhost:${found.port} (${found.label})`);
            await connectToGateway(found.port, found.latency, found.label);
        } else if (!scanCancelled) {
            console.log('🔌 Full scan complete — no gateway found');
            gatewayStatus.connected = false;
            gatewayStatus.lastError = 'Full scan complete: no gateway found';
            G.gateway_bonus_active = false;
            G._gwMult = 1.0;
            G._gwLabel = 'Disconnected';
            notifyStateChange('gateway');
            notifyListeners();
        }
    });

    // Return immediately — scan continues in background
    return { success: false, scanning: true };
}

async function connectToGateway(port, latency, label) {
    scanCancelled = true;
    gatewayStatus.scanning = false;
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
    G.gateway_bonus_active = true;
    G._gwMult = getLatencyMultiplier();
    G._gwLabel = getConnectionQuality().label;
    G._gwLatency = Math.round(latency);
    notifyStateChange('gateway');
    notifyListeners();
}

// --- MANUAL PORT CONNECTION ---
async function connectToPort(port) {
    scanCancelled = true;
    gatewayStatus.scanning = false;
    const result = await pingPort(port, 2000);
    if (result.alive) {
        await connectToGateway(port, result.latency, result.label);
        return { success: true, port, latency: result.latency, label: result.label };
    }
    return { success: false };
}

// --- PING (keep-alive check) ---
async function pingGateway() {
    if (!gatewayStatus.url || !gatewayStatus.connected) {
        return await discoverGateway();
    }
    try {
        const start = performance.now();
        const res = await fetch(`${gatewayStatus.url}/health`, {
            method: 'GET',
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
        gatewayStatus.connected = false;
        gatewayStatus.lastError = 'Connection lost';
        G.gateway_bonus_active = false;
        G._gwMult = 1.0;
        G._gwLabel = 'Disconnected';
        G._gwLatency = 0;
        notifyStateChange('gateway');
        notifyListeners();
        setTimeout(() => discoverGateway(), 15000);
        return { success: false };
    }
}

function getAverageLatency() {
    if (gatewayStatus.history.length === 0) return 0;
    const sum = gatewayStatus.history.reduce((a, b) => a + b, 0);
    return sum / gatewayStatus.history.length;
}

function getLatencyMultiplier() {
    if (!gatewayStatus.connected) return 1.0;
    const lastLatency = gatewayStatus.latency;
    if (lastLatency >= 500) return 10.0;
    if (lastLatency >= 200) return 8.0;
    if (lastLatency >= 100) return 5.0;
    if (lastLatency >= 50)  return 3.5;
    if (lastLatency >= 20)  return 2.5;
    return 2.0;
}

function getConnectionQuality() {
    if (!gatewayStatus.connected) return { label: 'Disconnected', color: '#ff4444', icon: '⛔' };
    const lastLatency = gatewayStatus.latency;
    if (lastLatency >= 500) return { label: 'Churning', color: '#ff00ff', icon: '⚡' };
    if (lastLatency >= 200) return { label: 'Cooking',  color: '#ff6600', icon: '🔥' };
    if (lastLatency >= 100) return { label: 'Active',   color: '#ffaa00', icon: '🔄' };
    if (lastLatency >= 50)  return { label: 'Warming',  color: '#88ff00', icon: '🌡️' };
    return { label: 'Connected', color: '#00ff88', icon: '🔗' };
}

function getGatewayStatus() {
    return gatewayStatus;
}

export {
    discoverGateway,
    pingGateway,
    connectToPort,
    getAverageLatency,
    getLatencyMultiplier,
    getConnectionQuality,
    getGatewayStatus,
    onGatewayChange,
};
