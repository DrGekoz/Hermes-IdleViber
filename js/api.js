// ============================================================
// Hermes IdleViber — Private Server API Client
// Uses the built-in game server for auth, saves, and leaderboard
// ============================================================

const API_BASE = window.location.origin;

// ---- HEALTH ----
async function apiHealth() {
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) return { status: 'error' };
        return await res.json();
    } catch {
        return { status: 'error', error: 'Server unreachable' };
    }
}

// ---- AUTH ----
async function apiRegister(username, password) {
    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return await res.json();
    } catch (e) {
        return { error: 'Server unreachable' };
    }
}

async function apiLogin(username, password) {
    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return await res.json();
    } catch (e) {
        return { error: 'Server unreachable' };
    }
}

// ---- SAVES ----
async function apiSave(token, state) {
    try {
        const res = await fetch(`${API_BASE}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, state }),
        });
        return await res.json();
    } catch (e) {
        return { error: 'Server unreachable' };
    }
}

async function apiLoad(token) {
    try {
        const res = await fetch(`${API_BASE}/api/load?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
            if (res.status === 401) return { error: 'Session expired' };
            return { error: 'Load failed' };
        }
        return await res.json();
    } catch (e) {
        return { error: 'Server unreachable' };
    }
}

// ---- LEADERBOARD ----
async function apiSubmitScore(token, score, prestigeLevel, vps, totalPp) {
    try {
        // Convert BN arrays to numbers for JSON serialization
        const safeScore = Array.isArray(score) ? Number(score[0]) * Math.pow(10, Math.min(score[1], 308)) : score;
        const safePrestige = Array.isArray(prestigeLevel) ? Number(prestigeLevel[0]) * Math.pow(10, Math.min(prestigeLevel[1], 308)) : prestigeLevel;
        const safeVps = Array.isArray(vps) ? Number(vps[0]) * Math.pow(10, Math.min(vps[1], 308)) : vps;
        const safeTotalPp = Array.isArray(totalPp) ? Number(totalPp[0]) * Math.pow(10, Math.min(totalPp[1], 308)) : totalPp;
        const res = await fetch(`${API_BASE}/api/leaderboard/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, score: safeScore, prestige_level: safePrestige, vps: safeVps, total_pp: safeTotalPp }),
        });
        return await res.json();
    } catch (e) {
        return { error: 'Server unreachable' };
    }
}

async function apiGetLeaderboard(limit = 50) {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard?limit=${limit}`);
        if (!res.ok) return { entries: [], total: 0 };
        return await res.json();
    } catch (e) {
        return { entries: [], total: 0 };
    }
}

export {
    apiHealth,
    apiRegister,
    apiLogin,
    apiSave,
    apiLoad,
    apiSubmitScore,
    apiGetLeaderboard,
};
