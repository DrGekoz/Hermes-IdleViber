// ============================================================
// Hermes IdleViber — Main Application
// ============================================================

import {
    G, CONFIG, ROOMS, ROOM_DECOR, getDecorForRoom, AUTOCLICKERS, ROOM_AUTOCLICKERS, PRESTIGE_UPGRADES, ACHIEVEMENTS, TIERS,
    GOLDEN_COOKIE_TYPES, GOLDEN_COOKIE_INTERVAL_MIN, GOLDEN_COOKIE_INTERVAL_MAX, GOLDEN_COOKIE_DURATION,
    goldenCookieSystem, spawnGoldenCookie, collectGoldenCookie, getClickBoostMult, getVpsBoostMult,
    wrinklerSystem, SYNERGIES, getSynergyBonus, getWrinklerPenalty, getEffectiveVpsMultiplier,
    updateWrinklers, popWrinkler, popAllWrinklers,
    getVPS, getClickValue, getPrestigeGain, getPrestigeThreshold, formatNumber, formatBN,
    getActiveDecorVpsMult, calculateOfflineProgress, applyOfflineProgress,
    getBulkCost, getMaxBuyable,
    addVibes, buyAutoclicker, buyPrestigeUpgrade, buyDecor,
    activateDecor, unlockRoom, switchRoom, doPrestige,
    BN_ZERO, BN_ONE, bnFromNumber, bnCompare, bnAdd, bnSub, bnMul, bnDiv, bnFloor, bnLt, bnLe, bnGt, bnGe, bnEq, bnToNumber, bnPow,
    getPrestigeUpgradeCost,
    isPrestigeUnlockable, unlockPrestige, checkAchievements,
    getCurrentTier, getCurrentTierName, getTierFromPrestige,
    onStateChange, saveGame, loadGame, notifyStateChange,
    getDefaultState,
} from './state.js';

import { discoverGateway, pingGateway, getLatencyMultiplier,
         getConnectionQuality, getGatewayStatus, onGatewayChange,
         getAverageLatency, connectToPort, cancelScan, checkGatewayBusy } from './gateway.js';

import { generateSprite, renderRoom, ParticleSystem, PAL,
         startPlacement, cancelPlacement, updatePlacementGhost, isPlacing,
         startDrag, updateDrag, endDrag, isDragging, hitTestDecor,
         snapToGrid, getDecorSpriteId } from './sprites.js';
import { setVolume as setSfxVolume, playClick, playVibe,
         playPrestige as playSfxPrestige, playError, playUnlock,
         playTabSwitch, playPurchase, playNotification, playPlace } from './sfx.js';
import { initMusicPlayer, setMusicVolume } from './music.js';

import { apiHealth, apiRegister, apiLogin, apiSave, apiLoad,
         apiSubmitScore, apiGetLeaderboard } from './api.js';

// ---- Firebase (production backend) ----
import { initFirebase, onAuthChanged, getCurrentUser, isConfigured,
         registerWithEmail, loginWithEmail, loginWithGoogle, logout as fbLogout,
         submitScoreToLeaderboard as fbSubmitScore,
         getLeaderboard as fbGetLeaderboard,
         subscribeLeaderboard as fbSubscribeLeaderboard,
         savePlayerData as fbSave, loadPlayerData as fbLoad,
         syncLeaderboardToFirestore as fbSyncLeaderboard,
         getFirestoreApi, getDb, fbSignInAnon } from './firebase.js';

// ---- P2P Leaderboard (WebRTC mesh via Firestore signaling) ----
import { p2pInit, p2pStart, p2pCleanup, p2pBroadcastScore, p2pSubscribe, p2pGetLocalPlayerId } from './p2p.js';
import { P2PLeaderboardManager } from './p2p-crypto.js?v=61';
let p2pCrypto = null;

// Room ID → file prefix mapping (roomId.substring(0,2) doesn't match actual file names)
const ROOM_PREFIX = {
    campfire_grove: 'cg',
    cyber_den: 'cd',
    zen_garden: 'zg',
    star_deck: 'sd',
    study_lounge: 'sl',
    beach_cove: 'bc',
};

// ---- DOM REFS ----
const $ = (id) => document.getElementById(id);

let dom = {};
let particles = null;
let animFrame = null;
let ticker = null;
let saver = null;
let gwPoller = null;
let lbUpdater = null;
let lbUnsub = null;
let lbP2PUnsub = null;     // P2P leaderboard subscription
let p2pInitialized = false; // P2P mesh initialized
let p2pStarting = false;    // Guard against concurrent tryInitP2P calls
let fbSyncTimer = null;     // Hourly Firestore sync timer
let lbFastTimer = null;     // 50ms leaderboard fast render
let lastP2PEntries = null;  // Cached P2P entries for fast render
let p2pBroadcastTick = 0;   // Tick counter for periodic P2P broadcast

// Get the local player's P2P ID (prefer module state over localStorage for scoped identity)
function getLocalP2PId() {
    const fromState = p2pGetLocalPlayerId();
    if (fromState) return fromState;
    // Fallback: old localStorage key (pre-scoping) — should only hit before P2P init
    return localStorage.getItem('hermes_idleviber_p2p_id');
}
let frameCount = 0;
let fbReady = false;       // Firebase initialized successfully
let fbUser = null;         // Firebase auth user object (when logged in via Firebase)
let _entered = false;      // Guard against double-enterGame
let _autoLoginCheckQueued = false;

// ---- SESSION COOKIE HELPERS ----
function setSessionCookie() {
    if (!G.username && !G.userId) return;
    const data = {
        username: G.username || 'Player',
        userId: G.userId || 'local',
        authMode: G.auth_mode || 'local',
        displayName: G.displayName || '',
        timestamp: Date.now()
    };
    try {
        const json = JSON.stringify(data);
        document.cookie = `hermes_idleviber=${encodeURIComponent(json)}; path=/; max-age=${60*60*24*30}; SameSite=Lax`;
    } catch (e) {
        console.warn('Cookie set failed:', e);
    }
}

function getSessionCookie() {
    try {
        const match = document.cookie.match(/(?:^|;\s*)hermes_idleviber=([^;]*)/);
        if (!match) return null;
        return JSON.parse(decodeURIComponent(match[1]));
    } catch { return null; }
}

function clearSessionCookie() {
    document.cookie = 'hermes_idleviber=; path=/; max-age=0; SameSite=Lax';
}

function migrateBN(state) {
    // Ensure BN fields are BN arrays after cloud load
    if (typeof state.vibes === 'number') state.vibes = bnFromNumber(state.vibes);
    if (typeof state.lifetime_vibes === 'number') state.lifetime_vibes = bnFromNumber(state.lifetime_vibes);
    if (typeof state.prestige_points === 'number') state.prestige_points = bnFromNumber(state.prestige_points);
    if (typeof state.total_pp_earned === 'number') state.total_pp_earned = bnFromNumber(state.total_pp_earned);
    if (typeof state.total_prestiges === 'number') state.total_prestiges = bnFromNumber(state.total_prestiges);
    if (state.total_prestiges === undefined || state.total_prestiges === null) state.total_prestiges = BN_ZERO;
    // Guard against corrupted BN_MAX sentinel values (from Infinity/NaN overflow)
    // A real new player should not have BN_MAX vibes or prestige points
    if (state.vibes && Array.isArray(state.vibes) && state.vibes[1] >= Number.MAX_SAFE_INTEGER - 1) state.vibes = BN_ZERO;
    if (state.lifetime_vibes && Array.isArray(state.lifetime_vibes) && state.lifetime_vibes[1] >= Number.MAX_SAFE_INTEGER - 1) state.lifetime_vibes = BN_ZERO;
    if (state.prestige_points && Array.isArray(state.prestige_points) && state.prestige_points[1] >= Number.MAX_SAFE_INTEGER - 1) state.prestige_points = BN_ZERO;
    if (state.total_pp_earned && Array.isArray(state.total_pp_earned) && state.total_pp_earned[1] >= Number.MAX_SAFE_INTEGER - 1) state.total_pp_earned = BN_ZERO;
    // Migrate old gateway_upgrades to prestige_upgrades
    if (state.gateway_upgrades) {
        state.prestige_upgrades = state.prestige_upgrades || {};
        Object.assign(state.prestige_upgrades, state.gateway_upgrades);
        delete state.gateway_upgrades;
    }
    if (!state.prestige_upgrades || typeof state.prestige_upgrades !== 'object') state.prestige_upgrades = {};
}

// ---- AUTO-LOGIN ----
function checkAutoLogin() {
    if (_entered || _autoLoginCheckQueued) return;
    const cookie = getSessionCookie();
    if (!cookie || !cookie.userId) return;

    _autoLoginCheckQueued = true;

    // Firebase mode: need fbUser to exist
    if (cookie.authMode === 'firebase') {
        if (!fbReady || !fbUser) {
            // Firebase not ready yet — queue re-check when onAuthChanged fires
            _autoLoginCheckQueued = false;
            return;
        }
        // Session restored via Firebase
        G.userId = fbUser.uid;
        G.username = fbUser.displayName || cookie.username || 'Player';
        G.auth_mode = 'firebase';
        G.displayName = cookie.displayName || '';
        dom.userDisplay.textContent = G.displayName || G.username; dom.userDisplay.title = G.displayName || G.username;
        // Attempt cloud load — merge with local, keep the highest progress
        (async () => {
            try {
                const cloudState = await fbLoad();
                if (cloudState) {
                    // Don't blindly overwrite — merge, keeping highest progress
                    const localPrestiges = G.total_prestiges || 0;
                    const localPp = G.total_pp_earned || BN_ZERO;
                    const localVibes = G.lifetime_vibes || BN_ZERO;

                    Object.assign(G, cloudState);
                    migrateBN(G);
                    G.auth_mode = 'firebase';
                    G.userId = fbUser.uid;
                    G.username = fbUser.displayName || G.username;

                    // Restore any progress that's higher than what cloud had
                    if (bnLt(G.total_prestiges, localPrestiges)) {
                        G.total_prestiges = localPrestiges;
                    }
                    if (bnCompare(G.total_pp_earned, localPp) < 0) {
                        G.total_pp_earned = localPp;
                        G.prestige_points = bnAdd(G.prestige_points || BN_ZERO, bnSub(localPp, cloudState.total_pp_earned || BN_ZERO));
                    }
                    if (bnCompare(G.lifetime_vibes, localVibes) < 0) {
                        G.lifetime_vibes = localVibes;
                    }

                    showToast('☁️ Cloud save merged');
                    saveGame();
                }
            } catch (_) {}
            enterGame();
        })();
        return;
    }

    // Local server API mode only
    if (cookie.authMode === 'local_api') {
        G.userId = cookie.userId;
        G.username = cookie.username || 'Player';
        G.auth_mode = 'local_api';
        G.displayName = cookie.displayName || '';
        dom.userDisplay.textContent = G.displayName || G.username; dom.userDisplay.title = G.displayName || G.username;
        loadGame();
        enterGame();
        return;
    }
}

// ---- INIT ----
function init() {
    console.log('🔥 Hermes IdleViber initializing...');
    cacheDOM();
    initFirebaseAsync();
    loadGame();
    applySidebarPosition(); // Restore sidebar position from saved state
    initCanvas();
    initParticles();
    initGateway();
    initAPI();
    initUIEvents();
    initGameLoop();
    startTimers();
    updateAllUI();
    console.log('🔥 Hermes IdleViber ready!');

    // Check for session cookie and auto-login after Firebase has a moment to restore
    setTimeout(checkAutoLogin, 800);
}

// ---- FIREBASE INIT (non-blocking) ----
async function initFirebaseAsync() {
    try {
        fbReady = await initFirebase();
        if (fbReady) {
            console.log('🔥 Firebase ready for production');
            // Listen for auth state
            onAuthChanged((user) => {
                fbUser = user;
                if (user) {
                    console.log('🔥 Firebase user:', user.displayName || user.email || user.uid);
                }
                // Auto-login check: cookie exists + Firebase session resolved
                checkAutoLogin();
            });
        }
    } catch (e) {
        console.warn('🔥 Firebase unavailable, using fallback:', e.message);
        fbReady = false;
    }
}

function cacheDOM() {
    dom = {
        app: $('app'),
        loginScreen: $('login-screen'),
        gameScreen: $('game-screen'),
        loginBtn: $('login-btn'),
        username: $('username'),
        password: $('password'),
        loginMsg: $('login-message'),
        userDisplay: $('user-display'),
        logoutBtn: $('logout-btn'),
        canvas: $('game-canvas'),
        vibeDisplay: $('vibe-display'),
        vpsDisplay: $('vps-display'),
        clickValueDisplay: $('click-value-display'),
        ppDisplay: $('pp-display'),
        lifetimeDisplay: $('lifetime-display'),
        prestigeCount: $('prestige-count'),
        prestigeBtn: $('prestige-btn'),
        prestigeGain: $('prestige-gain'),
        clickBtn: $('click-btn'),
        roomDisplay: $('current-room'),
        roomList: $('room-list'),
        decorList: $('decor-list'),
        upgradeList: $('upgrade-list'),
        gwUpgradeList: $('gw-upgrade-list'),
        leaderboardList: $('leaderboard-list'),
        prestigeUpgradeList: $('prestige-upgrade-list'),
        gatewayStatus: $('gateway-status'),
        gatewayLatency: $('gateway-latency'),
        gatewayMult: $('gateway-mult'),
        gatewayStatusDetailed: $('gateway-status-detailed'),
        gatewayLatencyDetailed: $('gateway-latency-detailed'),
        gatewayMultDetailed: $('gateway-mult-detailed'),
        gatewayQualityDetailed: $('gateway-quality-detailed'),
        gwPortInput: $('gw-port-input'),
        gwConnectBtn: $('gw-connect-btn'),
        gatewayScanProgress: $('gateway-scan-progress'),
        leaderboardPanel: $('leaderboard-panel'),
        leaderboardMinimize: $('leaderboard-minimize'),
        leaderboardList: $('leaderboard-list'),
        buyAllUpgrades: $('buy-all-upgrades-btn'),
        buyAllDecor: $('buy-all-decor-btn'),
        buyAllPrestige: $('buy-all-prestige-btn'),
        clickValueOverlay: $('click-value-display-overlay'),
        roomMultDisplay: $('room-mult-display'),
        offlineRateDisplay: $('offline-rate-display'),
        currentRoomUpgradeLabel: $('current-room-upgrade-label'),
        popup: $('popup'),
        popupTitle: $('popup-title'),
        popupText: $('popup-text'),
        popupOk: $('popup-ok'),
        popupCancel: $('popup-cancel'),
        tabRooms: $('tab-rooms'),
        tabUpgrades: $('tab-upgrades'),
        tabPrestige: $('tab-prestige'),
        tabDecor: $('tab-decor'),
        tabGateway: $('tab-gateway'),
        tabAchievements: $('tab-achievements'),
        tabTiers: $('tab-tiers'),
        panelRooms: $('panel-rooms'),
        panelUpgrades: $('panel-upgrades'),
        panelPrestige: $('panel-prestige'),
        panelDecor: $('panel-decor'),
        panelGateway: $('panel-gateway'),
        panelAchievements: $('panel-achievements'),
        panelTiers: $('panel-tiers'),
        settingsBtn: $('settings-btn'),
        settingsScreen: $('settings-screen'),
        settingsClose: $('settings-close'),
        settingsBackdrop: $('settings-backdrop'),
        settingsSidebarPos: $('settings-sidebar-pos'),
        settingsGwPort: $('settings-gw-port'),
        settingsGwConnect: $('settings-gw-connect'),
        settingsGwStatus: $('settings-gw-status'),
        settingsLogoutBtn: $('settings-logout-btn'),
        settingsLinkGoogle: $('settings-link-google'),
        settingsAccountStatus: $('settings-account-status'),
        settingsAccountUpgrade: $('settings-account-upgrade'),
        settingsUpgradeGoogle: $('settings-upgrade-google'),
        settingsUpgradeEmail: $('settings-upgrade-email'),
        settingsUpgradePassword: $('settings-upgrade-password'),
        settingsUpgradeEmailBtn: $('settings-upgrade-email-btn'),
        settingsUpgradeMsg: $('settings-upgrade-msg'),
        settingsTabName: $('settings-tab-name'),
        settingsTabAudio: $('settings-tab-audio'),
        settingsTabCredits: $('settings-tab-credits'),
        settingsPanelName: $('settings-panel-name'),
        settingsPanelAudio: $('settings-panel-audio'),
        settingsPanelCredits: $('settings-panel-credits'),
        settingsSfxVolume: $('settings-sfx-volume'),
        settingsSfxVolLabel: $('settings-sfx-vol-label'),
        settingsMusicVolume: $('settings-music-volume'),
        settingsMusicVolLabel: $('settings-music-vol-label'),
        settingsNameInput: $('settings-name-input'),
        settingsNameError: $('settings-name-error'),
        settingsCooldownInfo: $('settings-cooldown-info'),
        settingsSaveBtn: $('settings-save-btn'),
        settingsDisplayName: $('settings-display-name'),
        googleBtn: $('google-btn'),
        githubBtn: $('github-btn'),
        settingsLogoutBtn: $('settings-logout-btn'),
    };
}

// ---- CANVAS SETUP ----
function initCanvas() {
    const canvas = dom.canvas;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    particles = new ParticleSystem(canvas);
}

function resizeCanvas() {
    const canvas = dom.canvas;
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.clientWidth || 600;
        canvas.height = parent.clientHeight || 400;
    }
}

function initParticles() {
    particles.start();
    // Firefly particles — gateway bonus only
    setInterval(() => {
        if (G.gateway_bonus_active) {
            particles.add('firefly', null, null, 1);
        }
    }, 500);
    // Continuous dust particles — always running
    setInterval(() => {
        if (!G || !G.current_room) return;
        const count = 1 + Math.floor(Math.random() * 3);
        particles.add('dust', null, null, count);
    }, 200);
}

// ---- GATEWAY ----
let gwPollerRef = null;
async function initGateway() {
    // Clear any existing poller
    if (gwPollerRef) {
        clearInterval(gwPollerRef);
        gwPollerRef = null;
    }

    // Fire-and-forget discovery (doesn't block game init)
    discoverGateway().then(result => {
        updateGatewayUI();
    }).catch(() => {});

    // Periodic check
    gwPollerRef = setInterval(async () => {
        await pingGateway();
        // Also check if Hermes is busy processing a task
        const gs = getGatewayStatus();
        if (gs.connected && (gs.checkCount || 0) % 3 === 0) {
            checkGatewayBusy().then(() => updateGatewayUI());
        }
        gs.checkCount = (gs.checkCount || 0) + 1;
        updateGatewayUI();
    }, CONFIG.GATEWAY_POLL_INTERVAL);

    onGatewayChange(() => updateGatewayUI());
}

// ---- API INIT ----
async function initAPI() {
    // Check Firebase first (production) then fallback to local API (dev server)
    if (fbReady) {
        G.server_online = true;
        console.log('🔌 Firebase backend ready');
        return;
    }
    const health = await apiHealth();
    console.log(`🔌 Server API: ${health.status === 'ok' ? 'connected' : 'offline'} (${health.players || 0} players)`);
    G.server_online = health.status === 'ok';
}

// ---- UI EVENTS ----
function initUIEvents() {
    // Auth
    dom.loginBtn.addEventListener('click', () => { playClick(); doLogin(); });
    dom.logoutBtn.addEventListener('click', () => { playClick(); doLogout(); });
    if (dom.settingsBtn) dom.settingsBtn.addEventListener('click', () => { playClick(); openSettings('name'); });
    if (dom.settingsClose) dom.settingsClose.addEventListener('click', () => { playClick(); closeSettings(); });
    if (dom.settingsBackdrop) dom.settingsBackdrop.addEventListener('click', closeSettings);
    // Sidebar position toggle
    if (dom.settingsSidebarPos) {
        dom.settingsSidebarPos.addEventListener('change', () => {
            const right = dom.settingsSidebarPos.checked;
            G.settings.sidebar_position = right ? 'right' : 'left';
            applySidebarPosition();
            saveGame();
        });
    }
    if (dom.settingsSaveBtn) dom.settingsSaveBtn.addEventListener('click', saveDisplayName);
    // Settings: logout button
    if (dom.settingsLogoutBtn) {
        dom.settingsLogoutBtn.addEventListener('click', () => {
            closeSettings();
            doLogout();
        });
    }
    // Settings: upgrade account (Google)
    if (dom.settingsUpgradeGoogle) {
        dom.settingsUpgradeGoogle.addEventListener('click', async () => {
            if (!fbReady) { dom.settingsUpgradeMsg.textContent = '⚠️ Firebase not ready'; return; }
            dom.settingsUpgradeMsg.textContent = '⏳ Signing in with Google...';
            const result = await loginWithGoogle();
            if (result && result.success) {
                G.userId = result.uid;
                G.username = result.user.displayName || 'Player';
                G.auth_mode = 'firebase';
                dom.userDisplay.textContent = G.username; dom.userDisplay.title = G.username;
                const cloudState = await fbLoad();
                if (cloudState) {
                        Object.assign(G, cloudState);
                        migrateBN(G);
                        G.auth_mode = 'firebase';
                        G.userId = result.uid;
                        G.username = result.user.displayName || 'Player';
                        dom.settingsUpgradeMsg.textContent = '☁️ Cloud save loaded';
                } else {
                    await fbSave(G);
                    await fbSubmitScore(G.username || 'Player', bnToNumber(G.lifetime_vibes), Math.min(bnToNumber(G.total_prestiges || BN_ZERO), 1e9), bnToNumber(G.total_pp_earned), G.displayName, bnToNumber(getVPS()));
                    dom.settingsUpgradeMsg.textContent = '✅ Google linked! Progress saved to cloud';
                }
                updateAllUI();
                saveGame();
                setTimeout(closeSettings, 1500);
            } else {
                dom.settingsUpgradeMsg.textContent = '⚠️ Google sign-in cancelled';
            }
        });
    }
    // Settings: upgrade account (Email)
    if (dom.settingsUpgradeEmailBtn) {
        dom.settingsUpgradeEmailBtn.addEventListener('click', async () => {
            const email = dom.settingsUpgradeEmail.value.trim();
            const pw = dom.settingsUpgradePassword.value.trim();
            if (!email || !pw) { dom.settingsUpgradeMsg.textContent = '⚠️ Enter email and password'; return; }
            if (!fbReady) { dom.settingsUpgradeMsg.textContent = '⚠️ Firebase not ready'; return; }
            dom.settingsUpgradeMsg.textContent = '⏳ Registering...';
            const result = await registerWithEmail(email, pw);
            if (result && result.success) {
                G.userId = result.uid;
                G.username = email.split('@')[0];
                G.auth_mode = 'firebase';
                dom.userDisplay.textContent = G.username; dom.userDisplay.title = G.username;
                await fbSave(G);
                    await fbSubmitScore(G.username || 'Player', bnToNumber(G.lifetime_vibes), Math.min(bnToNumber(G.total_prestiges || BN_ZERO), 1e9), bnToNumber(G.total_pp_earned), G.displayName);
                dom.settingsUpgradeMsg.textContent = '✅ Email linked! Progress saved to cloud';
                updateAllUI();
                saveGame();
                setTimeout(closeSettings, 1500);
            } else {
                dom.settingsUpgradeMsg.textContent = result?.error === 'EMAIL_EXISTS' ? '⚠️ Email already registered — use login' : '⚠️ ' + (result?.error || 'Registration failed');
            }
        });
    }
    // Settings tabs
    if (dom.settingsTabName) dom.settingsTabName.addEventListener('click', () => openSettings('name'));
    if (dom.settingsTabAudio) dom.settingsTabAudio.addEventListener('click', () => { openSettings('audio'); playClick(); });
    if (dom.settingsTabCredits) dom.settingsTabCredits.addEventListener('click', () => openSettings('credits'));
    // Settings: Gateway port sync
    if (dom.settingsGwConnect && dom.settingsGwPort) {
        dom.settingsGwConnect.addEventListener('click', () => {
            const port = parseInt(dom.settingsGwPort.value);
            if (!port || port < 1 || port > 65535) {
                if (dom.settingsGwStatus) dom.settingsGwStatus.textContent = '⚠️ Enter a valid port (1-65535)';
                return;
            }
            // Write to gateway cache
            try {
                localStorage.setItem('hermes_idleviber_gateway_port', JSON.stringify({ port, timestamp: Date.now() }));
            } catch {}
            // Sync to gateway tab input and connect
            if (dom.gwPortInput) dom.gwPortInput.value = port;
            if (dom.gwConnectBtn) dom.gwConnectBtn.click();
            if (dom.settingsGwStatus) dom.settingsGwStatus.textContent = '✅ Synced — connecting...';
            setTimeout(() => {
                const gw = getGatewayStatus();
                if (dom.settingsGwStatus) {
                    dom.settingsGwStatus.textContent = gw.connected ? '✅ Connected' : '⛔ No gateway on that port';
                    dom.settingsGwStatus.style.color = gw.connected ? '#0f0' : '#f44';
                }
            }, 2000);
        });
        dom.settingsGwPort.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') dom.settingsGwConnect.click();
        });
    }
    // Settings: Audio volume sliders
    if (dom.settingsSfxVolume) {
        dom.settingsSfxVolume.addEventListener('input', () => {
            const vol = parseFloat(dom.settingsSfxVolume.value);
            G.settings.sfx_volume = vol;
            setSfxVolume(vol);
            if (dom.settingsSfxVolLabel) dom.settingsSfxVolLabel.textContent = Math.round(vol * 100) + '%';
            saveGame();
        });
    }
    if (dom.settingsMusicVolume) {
        dom.settingsMusicVolume.addEventListener('input', () => {
            const vol = parseFloat(dom.settingsMusicVolume.value);
            G.settings.music_volume = vol;
            setMusicVolume(vol);
            if (dom.settingsMusicVolLabel) dom.settingsMusicVolLabel.textContent = Math.round(vol * 100) + '%';
            saveGame();
        });
    }
    // Enter key on name input
    if (dom.settingsNameInput) {
        dom.settingsNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveDisplayName();
        });
    }
    if (dom.googleBtn) dom.googleBtn.addEventListener('click', doGoogleLogin);
    if (dom.githubBtn) {
        dom.githubBtn.addEventListener('click', () => {
            showToast('⚠️ GitHub auth requires OAuth setup — use Google or Email');
        });
        dom.githubBtn.style.opacity = '0.4';
        dom.githubBtn.title = 'GitHub OAuth not configured yet';
    }

    // Click button
    dom.clickBtn.addEventListener('click', () => {
        const val = getClickValue();
        addVibes(val);
        G.total_clicks++;
        spawnClickFloat(val);
        dom.clickBtn.classList.add('clicked');
        setTimeout(() => dom.clickBtn.classList.remove('clicked'), 100);
        playVibe();
    });

    // Prestige
    dom.prestigeBtn.addEventListener('click', () => {
        const gain = getPrestigeGain();
        if (bnLe(gain, BN_ZERO)) return;
        const instant = document.getElementById('prestige-instant')?.checked;
        if (instant) {
            // Instant prestige — skip confirmation and credits
            if (doPrestige()) {
                updateAllUI();
                showToast('✨ Prestiged! +' + formatNumber(gain) + ' PP');
                playSfxPrestige();
            }
        } else {
            const msg = "Reset for " + formatNumber(gain) + " Prestige Chips?\n\nYou'll keep:\n• Prestige Chips (" + formatNumber(bnAdd(G.total_pp_earned, gain)) + " total)\n• All Prestige Upgrades\n\nYou'll lose:\n• All vibes\n• Rooms & room VPS multipliers\n• All autoclickers\n• All decor";
            showPopup('\u2728 Prestige', msg, () => {
                if (doPrestige()) {
                    updateAllUI();
                    showToast('✨ Prestiged! +' + formatNumber(gain) + ' PP');
                    playSfxPrestige();
                    showCredits();
                }
            });
        }
    });

    // Max Prestige — repeatedly prestige until no longer possible.
    // Batches silently with no UI updates during the loop to avoid browser lockup.
    // One full UI refresh + P2P sync at the end.
    const maxPrestigeBtn = document.getElementById('prestige-max-btn');
    if (maxPrestigeBtn) {
        maxPrestigeBtn.addEventListener('click', () => {
            const vps = getVPS();
            if (bnLe(vps, BN_ZERO)) { showToast('⛔ No VPS — cannot prestige'); return; }

            let count = 0;
            const MAX_RUNS = 50000;

            function doBatch() {
                const batchSize = 500;
                let batchCount = 0;
                for (let i = 0; i < batchSize && count < MAX_RUNS; i++) {
                    const threshold = getPrestigeThreshold(G);

                    // Simulate earning enough vibes to meet threshold (direct state, no notifications)
                    if (bnLt(G.lifetime_vibes, threshold)) {
                        const needed = bnSub(bnFromNumber(threshold), G.lifetime_vibes);
                        if (bnLe(needed, BN_ZERO)) break;
                        G.vibes = bnAdd(G.vibes, needed);
                        G.lifetime_vibes = bnAdd(G.lifetime_vibes, needed);
                    }

                    // Unlock check (inline isPrestigeUnlockable, no notifyStateChange)
                    if (!G.prestige_unlocked) {
                        const thresh = getPrestigeThreshold(G);
                        if (bnLt(G.lifetime_vibes, thresh)) break;
                        const totalRoomCost = Object.values(ROOMS).reduce((sum, r) => sum + r.cost, 0);
                        const allRoomIds = Object.keys(ROOMS);
                        if (totalRoomCost > thresh && !allRoomIds.every(id => G.unlocked_rooms.includes(id))) break;
                        G.prestige_unlocked = true;
                    }

                    const gain = getPrestigeGain(G);
                    if (bnLe(gain, BN_ZERO)) break;

                    // Direct prestige (inline doPrestige, no notifyStateChange)
                    G.total_pp_earned = bnAdd(G.total_pp_earned, gain);
                    G.prestige_points = bnAdd(G.prestige_points, gain);
                    G.total_prestiges = bnAdd(G.total_prestiges, BN_ONE);
                    G.vibes = BN_ZERO;
                    G.lifetime_vibes = BN_ZERO;
                    G.prestige_unlocked = false;
                    G.autoclickers = {};
                    G.room_autoclickers = {};
                    G.owned_decor = [];
                    G.active_decor = {};
                    G.placed_decor = {};
                    G.unlocked_rooms = ['campfire_grove'];
                    G.current_room = 'campfire_grove';

                    count++;
                    batchCount++;
                }
                if (batchCount > 0 && count < MAX_RUNS) {
                    // More possible — yield to UI thread
                    requestAnimationFrame(doBatch);
                } else {
                    // One full UI refresh + sync after all prestige cycles
                    updateAllUI();
                    updateLocalLeaderboardEntry();
                    processAchievements();
                    if (G.auth_mode === 'firebase' && fbUser && p2pInitialized) {
                        fbSyncLeaderboard(
                            G.username || 'Player',
                            G.lifetime_vibes,
                            G.total_prestiges,
                            G.total_pp_earned,
                            G.displayName,
                            getVPS()
                        ).catch(() => {});
                        p2pBroadcastScore(G.lifetime_vibes, G.total_prestiges, getVPS(), G.total_pp_earned);
                    }
                    showToast(count > 0 ? '⚡ Max Prestige: ' + count + ' prestiges!' : '⛔ Cannot prestige yet');
                }
            }

            requestAnimationFrame(doBatch);
        });
    }

    // Gateway manual connect
    dom.gwConnectBtn.addEventListener('click', async () => {
        const port = parseInt(dom.gwPortInput.value);
        if (!port || port < 1 || port > 65535) {
            showToast('⚠️ Enter a valid port (1-65535)');
            return;
        }
        dom.gwConnectBtn.textContent = '⏳';
        const result = await connectToPort(port);
        dom.gwConnectBtn.textContent = '▶ Connect';
        if (result.success) {
            showToast(`✅ Connected to localhost:${port}`);
            updateGatewayUI();
            updateResourceUI();
        } else {
            showToast(`⛔ No gateway on port ${port}`);
        }
        // Sync port back to settings field
        if (dom.settingsGwPort) dom.settingsGwPort.value = port;
    });
    dom.gwPortInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') dom.gwConnectBtn.click();
    });

    // Canvas: placement mode + drag
    const canvas = dom.canvas;
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (isPlacing()) {
            updatePlacementGhost(mx, my);
        }
        if (isDragging()) {
            updateDrag(mx, my);
        }
    });

    canvas.addEventListener('click', (e) => {
        if (!isPlacing()) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const snapped = snapToGrid(mx, my);

        const decorId = getPlacingDecorId();
        if (!decorId) return;

        // Add/replace placement (max 1 per decor)
        if (!G.placed_decor[decorId]) G.placed_decor[decorId] = [];
        G.placed_decor[decorId][0] = { x: snapped.x, y: snapped.y }; // Replace or set first
        if (G.placed_decor[decorId].length > 1) G.placed_decor[decorId].length = 1; // Trim extras
        // Sync to saved placements so they survive prestige
        if (!G.saved_decor_placements) G.saved_decor_placements = {};
        G.saved_decor_placements[decorId] = JSON.parse(JSON.stringify(G.placed_decor[decorId]));

        playPlace();
        cancelDecorPlacement();
        notifyStateChange('decor_active');
        showToast(`✅ ${decorId} placed!`);
    });

    canvas.addEventListener('mousedown', (e) => {
        if (isPlacing()) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = hitTestDecor(G, mx, my);
        if (hit) {
            const snapped = snapToGrid(G.placed_decor[hit.decorKey][hit.index].x,
                                       G.placed_decor[hit.decorKey][hit.index].y);
            startDrag(hit.decorKey, hit.index, mx, my, snapped.x, snapped.y);
            // Bring clicked decor to front by reordering the placed_decor object
            if (G.placed_decor[hit.decorKey]) {
                const val = G.placed_decor[hit.decorKey];
                delete G.placed_decor[hit.decorKey];
                G.placed_decor[hit.decorKey] = val;
            }
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDragging()) {
            if (endDrag(G)) {
                playPlace();
                notifyStateChange('decor_active');
            }
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isDragging()) {
            if (endDrag(G)) {
                notifyStateChange('decor_active');
            }
        }
    });

    // Escape cancels placement
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (isPlacing() || isDragging())) {
            cancelDecorPlacement();
            if (isDragging()) endDrag(G);
            notifyStateChange('decor_active');
        }
    });

    // Leaderboard fullscreen toggle
    dom.leaderboardPanel.addEventListener('click', (e) => {
        if (e.target === dom.leaderboardMinimize) return;
        dom.leaderboardPanel.classList.add('fullscreen');
        updateLeaderboardUI();
    });
    dom.leaderboardMinimize.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.leaderboardPanel.classList.remove('fullscreen');
    });

    // Tabs
    setupTabs();

    // Tooltip delegation for shop items
    initTooltipDelegation();

    // Click & hold to spam-purchase upgrades
    initHoldToSpam();

    // Buy All buttons
    if (dom.buyAllUpgrades) dom.buyAllUpgrades.addEventListener('click', () => { playClick(); buyAllUpgrades(); });
    if (dom.buyAllDecor) dom.buyAllDecor.addEventListener('click', () => { playClick(); buyAllDecor(); });
    if (dom.buyAllPrestige) dom.buyAllPrestige.addEventListener('click', () => { playClick(); buyAllPrestige(); });

    // Music player
    initMusicPlayer();

    // State changes
    onStateChange((type) => {
        if (type === 'vibes') {
            updateResourceUI();
            updateShopAffordability();
            updateLocalLeaderboardEntry();
            processAchievements();
            updateSidebarTabIndicators();
        }
        if (type === 'autoclickers' || type === 'gateway_upgrades') {
            updateResourceUI();
            updateShopUI();
            updatePrestigeAffordability();
            processAchievements();
        }
        if (type === 'prestige' || type === 'reset' || type === 'load') {
            updateAllUI();
            updateLocalLeaderboardEntry();
            processAchievements();
            // Immediate Firestore sync + P2P broadcast on prestige
            if (G.auth_mode === 'firebase' && fbUser && p2pInitialized) {
                fbSyncLeaderboard(
                    G.username || 'Player',
                    G.lifetime_vibes,
                    G.total_prestiges,
                    G.total_pp_earned,
                    G.displayName,
                    getVPS()
                ).catch(() => {});
                p2pBroadcastScore(G.lifetime_vibes, G.total_prestiges, getVPS(), G.total_pp_earned);
            }
        }
        if (type === 'rooms' || type === 'room_switch') {
            updateRoomUI();
            updateResourceUI();
            updateCanvas();
            processAchievements();
        }
        if (type === 'decor' || type === 'decor_active') {
            updateDecorUI();
            updateCanvas();
            processAchievements();
        }
        if (type === 'gateway') {
            updateGatewayUI();
            updateResourceUI();
            if (dom.settingsGwStatus && !dom.settingsScreen.classList.contains('hidden')) {
                const gw = getGatewayStatus();
                dom.settingsGwStatus.textContent = gw.connected ? '✅ Connected' : '⏸ Idle';
                dom.settingsGwStatus.style.color = gw.connected ? '#0f0' : 'var(--text-secondary)';
            }
            processAchievements();
        }
    });

    // Popup
    dom.popupOk.addEventListener('click', () => {
        dom.popup.classList.add('hidden');
        if (dom.popup._callback) dom.popup._callback();
    });
    dom.popupCancel.addEventListener('click', () => {
        dom.popup.classList.add('hidden');
    });
}

function setupTabs() {
    const tabs = [
        { btn: dom.tabRooms, panel: dom.panelRooms },
        { btn: dom.tabUpgrades, panel: dom.panelUpgrades },
        { btn: dom.tabPrestige, panel: dom.panelPrestige },
        { btn: dom.tabDecor, panel: dom.panelDecor },
        { btn: dom.tabGateway, panel: dom.panelGateway },
        { btn: dom.tabAchievements, panel: dom.panelAchievements },
        { btn: dom.tabTiers, panel: dom.panelTiers },
    ];

    tabs.forEach(({ btn, panel }) => {
        btn.addEventListener('click', () => {
            tabs.forEach(t => {
                t.btn.classList.remove('active');
                t.panel.classList.remove('active');
            });
            btn.classList.add('active');
            panel.classList.add('active');
            if (panel === dom.panelRooms) updateRoomUI();
            if (panel === dom.panelUpgrades) updateShopUI();
            if (panel === dom.panelPrestige) {
                updatePrestigeUI();
                renderPrestigeUpgrades();
            }
            if (panel === dom.panelDecor) updateDecorUI();
            if (panel === dom.panelGateway) {
                updateGatewayUI();
            }
            if (panel === dom.panelAchievements) {
                updateAchievementsUI();
                // Mark achievements as notified
                ACHIEVEMENTS.forEach(ach => ach._notified = true);
                dom.tabAchievements.classList.remove('has-new');
            }
            if (panel === dom.panelTiers) renderTiers();
        });
    });
}

// ---- AUTH ----
async function doLogin() {
    const username = dom.username.value.trim();
    const password = dom.password.value.trim();
    if (!username || !password) {
        dom.loginMsg.textContent = 'Enter both fields.';
        return;
    }
    // Reserved: DrGekoz is the game dev
    if (/^drgekoz$/i.test(username)) {
        dom.loginMsg.textContent = '⛔ That username is reserved';
        return;
    }

    dom.loginMsg.textContent = '⏳ Authenticating...';

    // Try Firebase first (production / Netlify)
    if (fbReady) {
        const result = await loginWithEmail(username, password);
        if (result && result.success) {
            G.userId = result.uid;
            G.username = result.user.displayName || username;
            G.auth_mode = 'firebase';
            dom.userDisplay.textContent = G.username; dom.userDisplay.title = G.username;

            // Load cloud save from Firestore
            const cloudState = await fbLoad();
            if (cloudState) {
                    Object.assign(G, cloudState);
                    G.auth_mode = 'firebase';
                    G.userId = result.uid;
                    G.username = result.user.displayName || username;
                    showToast('☁️ Cloud save loaded');
                    saveGame();
            } else {
                // First login — upload local save data to Firebase
                fbSave(G).catch(() => {});
                fbSubmitScore(G.username || 'Player', bnToNumber(G.lifetime_vibes), Math.min(bnToNumber(G.total_prestiges || BN_ZERO), 1e9), G.total_pp_earned, G.displayName, getVPS()).catch(() => {});
            }

            enterGame();
            return;
        }
        if (result && result.error === 'Username already taken') {
            dom.loginMsg.textContent = '⏳ Account exists, trying password...';
            const retry = await loginWithEmail(username, password);
            if (retry && retry.success) {
                G.userId = retry.uid;
                G.username = retry.user.displayName || username;
                G.auth_mode = 'firebase';
                dom.userDisplay.textContent = G.username; dom.userDisplay.title = G.username;
                const cloudState = await fbLoad();
                if (cloudState) {
                    Object.assign(G, cloudState);
                } else {
                    // First login — upload local save
                    fbSave(G).catch(() => {});
                    fbSubmitScore(G.username || 'Player', bnToNumber(G.lifetime_vibes), Math.min(bnToNumber(G.total_prestiges || BN_ZERO), 1e9), G.total_pp_earned, G.displayName, getVPS()).catch(() => {});
                }
                enterGame();
                return;
            }
        }
        // Firebase login failed, fall through to local API
        console.warn('Firebase login failed:', result?.error);
    }

    // Try local server API (dev mode — fails silently on Netlify)
    dom.loginMsg.textContent = '⏳ Authenticating (local)...';
    const result = await apiLogin(username, password);
    if (result && result.success) {
        G.userId = username;
        G.username = username;
        G.auth_token = result.token;
        G.auth_mode = 'local_api';
        dom.userDisplay.textContent = username; dom.userDisplay.title = username;

        // Attempt to load cloud save
        const cloud = await apiLoad(result.token);
        if (cloud && cloud.success && cloud.state) {
            try {
                const cloudState = typeof cloud.state === 'string' ? JSON.parse(cloud.state) : cloud.state;
                Object.assign(G, cloudState);
                G.auth_token = result.token;
                G.auth_mode = 'local_api';
                showToast('☁️ Cloud save loaded');
            } catch (e) {
                console.warn('Cloud save parse failed, using local', e);
            }
        }

        enterGame();
        return;
    }

    if (result && result.error && result.error !== 'Invalid username or password') {
        console.warn('Server login failed:', result.error);
    }

    // Fallback: Register new account on local server
    if (result && result.error === 'Invalid username or password') {
        dom.loginMsg.textContent = '⏳ Creating account...';
        const reg = await apiRegister(username, password);
        if (reg && reg.success) {
            const login2 = await apiLogin(username, password);
            if (login2 && login2.success) {
                G.userId = username;
                G.username = username;
                G.auth_token = login2.token;
                G.auth_mode = 'local_api';
                dom.userDisplay.textContent = username; dom.userDisplay.title = username;
                enterGame();
                return;
            }
        }
    }

    // Block local mode fallback — Firebase auth required
    dom.loginMsg.textContent = '⚠️ Sign in with Google or create an account above';
}

function doGoogleLogin() {
    dom.loginMsg.textContent = '⏳ Signing in with Google...';
    doGoogleLoginAsync();
}

async function doGoogleLoginAsync() {
    if (!fbReady) {
        showToast('⚠️ Firebase not ready — use Email');
        return;
    }
    const result = await loginWithGoogle();
    if (result && result.success) {
        G.userId = result.uid;
        G.username = result.user.displayName || 'Player';
        G.auth_mode = 'firebase';
        dom.userDisplay.textContent = G.username; dom.userDisplay.title = G.username;

        // Load cloud save
        const cloudState = await fbLoad();
        if (cloudState) {
                Object.assign(G, cloudState);
                G.auth_mode = 'firebase';
                G.userId = result.uid;
                G.username = result.user.displayName || 'Player';
                showToast('☁️ Cloud save loaded');
                saveGame();
        } else {
            // First login — upload local save
            fbSave(G).catch(() => {});
            fbSubmitScore(G.username || 'Player', bnToNumber(G.lifetime_vibes), Math.min(bnToNumber(G.total_prestiges || BN_ZERO), 1e9), G.total_pp_earned, G.displayName, getVPS()).catch(() => {});
        }

        enterGame();
    } else {
        const msg = result?.error || 'Google sign-in failed';
        dom.loginMsg.textContent = msg;
        console.warn('Google login:', msg);
    }
}


function doLogout() {
    saveGame();
    // Sign out of Firebase if applicable
    if (fbReady && fbUser) {
        fbLogout().catch(console.warn);
    }
    // Clear session cookie — forces login screen next visit
    clearSessionCookie();
    // Reset state guards
    _entered = false;
    _autoLoginCheckQueued = false;
    fbUser = null;
    G.auth_token = null;
    clearGameLoop();
    dom.loginScreen.classList.remove('hidden');
    dom.gameScreen.classList.add('hidden');
    // Reset login fields
    dom.username.value = '';
    dom.password.value = '';
    dom.loginMsg.textContent = '';
}

function enterGame() {
    // Guard against double-entry from cookie auto-login + user clicking login
    if (_entered) {
        console.log('Already entered game, ignoring duplicate enterGame()');
        return;
    }
    _entered = true;
    _autoLoginCheckQueued = false;

    dom.loginScreen.classList.add('hidden');
    dom.gameScreen.classList.remove('hidden');

    // Set display name
    const display = G.displayName || G.username || 'Player';
    dom.userDisplay.textContent = display; dom.userDisplay.title = display;

    // Persist session cookie (keeps them logged in across page reloads)
    setSessionCookie();

    resizeCanvas();
    // Apply offline progress earned while away
    const offline = applyOfflineProgress();
    updateAllUI();
    applySidebarPosition();
    initGameLoop();
    initGateway();
    // Show offline earnings toast
    if (offline && offline.earned > 0) {
        setTimeout(() => showToast(`⏰ Welcome back! +${formatNumber(Math.floor(offline.earned))} ✦ while away`), 500);
    }

    // Prompt for display name if not set (only on first login, not on page refresh)
    if (!G.displayName && G.auth_mode !== 'local') {
        if (!localStorage.getItem('hermes_idleviber_np')) {
            localStorage.setItem('hermes_idleviber_np', '1');
            setTimeout(() => showDisplayNamePrompt(), 800);
        }
    }
}

// ---- HELPER: Track current placing decor ID ----
let _placingDecorId = null;

function startDecorPlacement(decorId) {
    const spriteId = getDecorSpriteId(decorId);
    if (!spriteId) return;
    _placingDecorId = decorId;
    startPlacement(spriteId);
}

function getPlacingDecorId() {
    return _placingDecorId;
}

function cancelDecorPlacement() {
    _placingDecorId = null;
    cancelPlacement();
}

// ---- GAME LOOP ----
// ---- GAME LOOP ----
let p2pInitDone = false;
async function tryInitP2P() {
    if (p2pInitDone || p2pStarting) return;
    p2pStarting = true;
    const db = getDb(); const fbApi = getFirestoreApi();
    if (!db || !fbApi) { console.log('🌀 P2P waiting for DB/Firestore...'); p2pStarting = false; setTimeout(tryInitP2P, 500); return; }
    console.log('🌀 P2P initializing crypto mesh...');
    const mgr = new P2PLeaderboardManager(
        { db, doc:fbApi.doc, setDoc:fbApi.setDoc, collection:fbApi.collection, onSnapshot:fbApi.onSnapshot, deleteDoc:fbApi.deleteDoc, Timestamp:fbApi.Timestamp },
        G.displayName || G.username || 'Player',
        (sorted) => {
            const l = dom.leaderboardList; if (!l) return;
            for (const e of sorted) {
                const rows = l.querySelectorAll('.lb-entry');
                for (const r of rows) {
                    const n = r.querySelector('.lb-name'); if (!n) continue;
                    const rowName = n.textContent.replace('◆ ','').replace('⭐ ','').replace(/\(DEV\).*/s, '').trim();
                    if (rowName !== e.username) continue;
                    const v=r.querySelector('.lb-vibes'), s=r.querySelector('.lb-vps'), pp=r.querySelector('.lb-pp'), pr=r.querySelector('.lb-prestige'), t=r.querySelector('.lb-tier');
                    if (v) {
                        let txt;
                        try {
                            if (Array.isArray(e.score)) txt = formatBN(e.score);
                            else if (typeof e.score === 'number') txt = formatNumber(e.score);
                            else txt = String(e.score);
                        } catch(e2) { txt = '0'; console.warn('P2P fmt err', e2); }
                        v.textContent = txt;
                    }
                    if (s) {
                        try { s.textContent = Array.isArray(e.vps) ? formatBN(e.vps) : formatNumber(e.vps); } catch(_){}
                    }
                    if (pp) {
                        try { pp.textContent = Array.isArray(e.pp) ? formatBN(e.pp) : formatNumber(e.pp); } catch(_){}
                    }
                    if (pr) pr.textContent = fmtSafe(e.prestige);
                    if (t) { const ti = getTierFromPrestige(e.prestige ?? 0); t.textContent = ti >= 0 ? TIERS[ti].name : '—'; }
                    break;
                }
            }
        },
        fbSyncLeaderboard
    );
    await mgr.init(); mgr.join(); p2pCrypto = mgr; p2pInitDone = true; p2pStarting = false;
    console.log('🌀 P2P mesh ready —', mgr.kid);
}

function initGameLoop() {
    let prestigeCheckCounter = 0;
    // Game logic: VPS generation at 100ms (10 ticks/sec)
    ticker = setInterval(() => {
        const vps = getVPS();
        if (bnGt(vps, BN_ZERO)) {
            addVibes(bnMul(vps, bnFromNumber(0.1)));
        }
        // Check prestige unlock every 1s (every 10 ticks)
        prestigeCheckCounter++;
        if (prestigeCheckCounter >= 10) {
            prestigeCheckCounter = 0;
            if (!G.prestige_unlocked) {
                unlockPrestige();
                updatePrestigeUI();
            }
            processAchievements(); // Periodic achievement check (catches VPS milestones)
        }
        // Crypto P2P broadcast every tick (~100ms, 10x/sec)
        if (p2pCrypto) {
            p2pCrypto.broadcast(G.lifetime_vibes, bnToNumber(G.total_prestiges), getVPS(), G.total_pp_earned);
        }
        // Update sidebar tab indicators every tick (lightweight)
        updateSidebarTabIndicators();
    }, CONFIG.TICK_INTERVAL);

    // Auto-save every 30s + cloud sync + P2P broadcast
    saver = setInterval(() => {
        saveGame();
        // Cloud save if authenticated (leaderboard synced separately via hourly timer)
        if (G.auth_mode === 'firebase' && fbUser) {
            fbSave(G).catch(() => {});
            // P2P broadcast current score to mesh (realtime, no Firestore write)
            if (p2pInitialized) {
                p2pBroadcastScore(G.lifetime_vibes, G.total_prestiges, getVPS(), G.total_pp_earned);
            }
        } else if (G.auth_token && G.server_online) {
            apiSave(G.auth_token, G).catch(() => {});
            apiSubmitScore(G.auth_token, bnToNumber(G.lifetime_vibes), G.total_prestiges, bnToNumber(getVPS()), G.total_pp_earned).catch(() => {});
        }
    }, CONFIG.SAVE_INTERVAL);

    // Leaderboard — P2P mesh with Firestore backup
    tryInitP2P();

    // Fallback: poll local API (no Firebase auth, or no user)
    if (!lbUpdater && !lbP2PUnsub && !(fbReady && fbUser)) {
        lbUpdater = setInterval(updateLeaderboardUI, 15000);
        updateLeaderboardUI(); // Immediate first render
    }

    // Fast leaderboard render every 50ms — reads cached P2P entries + local state
    if (lbFastTimer) clearInterval(lbFastTimer);
    if (lbP2PUnsub) {
        lbFastTimer = setInterval(() => {
            if (!lastP2PEntries) return;
            const list = dom.leaderboardList;
            if (!list) return;
            // Update local player row from live game state
            updateLocalLeaderboardEntry();
            // Update P2P peer rows from cached entries (lightweight textContent swaps)
            const localPid = getLocalP2PId();
            for (const entry of lastP2PEntries) {
                if (!entry.playerId || entry.playerId === localPid) continue;
                const row = list.querySelector(`.lb-entry[data-player-id="${entry.playerId}"]`);
                if (!row) continue;
                const vibeEl = row.querySelector('.lb-vibes');
                const vpsEl = row.querySelector('.lb-vps');
                const ppEl = row.querySelector('.lb-pp');
                const prestigeEl = row.querySelector('.lb-prestige');
                const tierEl = row.querySelector('.lb-tier');
                if (vibeEl) vibeEl.textContent = fmtVibes(entry.score);
                if (vpsEl) vpsEl.textContent = fmtSafe(entry.vps);
                if (ppEl) ppEl.textContent = fmtSafe(entry.totalPp);
                if (prestigeEl) prestigeEl.textContent = fmtSafe(entry.prestigeLevel);
                if (tierEl) {
                    const tierVal = getTierFromPrestige(entry.prestigeLevel ?? 0);
                    tierEl.textContent = tierVal >= 0 ? TIERS[tierVal].name : '—';
                }
            }
        }, 50);
    }

    // --- RENDER LOOP: runs at display refresh rate (up to 180Hz) ---
    let lastBgRoom = null;
    let bgCanvas = null;
    let lastFrameTime = 0;
    
    // --- EVENT BATCHING: batch clicks and send to server every 1s ---
    let eventQueue = [];
    let clickBatchCount = 0;
    let lastEventFlush = Date.now();
    
    // Override the click handler to also batch events
    const origClickHandler = dom.clickBtn.onclick;
    dom.clickBtn.onclick = (e) => {
        clickBatchCount++;
        if (origClickHandler) origClickHandler.call(dom.clickBtn, e);
    };
    
    setInterval(() => {
        const now = Date.now();
        if (clickBatchCount > 0 || eventQueue.length > 0) {
            const batch = {
                ts: now,
                events: [...eventQueue],
                clicks: clickBatchCount,
                session: G.userId || G.auth_mode || 'local',
                vps: Math.round(getVPS())
            };
            eventQueue = [];
            clickBatchCount = 0;
            // Send to server (fire-and-forget)
            fetch('/api/events', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(batch)
            }).catch(() => {});
        }
    }, 1000);

    function renderFrame(timestamp) {
        const canvas = dom.canvas;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Cache background render per room (redraw only on room change)
        if (lastBgRoom !== G.current_room) {
            lastBgRoom = G.current_room;
        }

        // Delta time in seconds, capping at 50ms to avoid spiral of death
        const dt = lastFrameTime ? Math.min(timestamp - lastFrameTime, 50) / 1000 : 1/60;
        lastFrameTime = timestamp;

        // Render room at full display refresh rate
        renderRoom(G.current_room, canvas, G);

        // Particles animate every frame with delta-time scaling
        particles.update(dt);

        // Gateway glow effect (animated every frame)
        const gw = getGatewayStatus();
        if (gw.connected) {
            const intensity = 0.1 + getLatencyMultiplier() * 0.05;
            const size = Math.min(40, 20 + gw.latency * 0.05);
            dom.canvas.style.boxShadow = `0 0 ${size}px rgba(0, 255, 136, ${intensity})`;
        } else {
            dom.canvas.style.boxShadow = '0 0 10px rgba(255,68,68,0.1)';
        }

        // Update local leaderboard row every frame for smooth realtime display
        updateLocalLeaderboardEntry();

        animFrame = requestAnimationFrame(renderFrame);
    }
    animFrame = requestAnimationFrame(renderFrame);
}

function clearGameLoop() {
    clearInterval(ticker);
    clearInterval(saver);
    clearInterval(lbUpdater);
    clearInterval(lbFastTimer); lbFastTimer = null;
    clearInterval(fbSyncTimer); fbSyncTimer = null;
    if (typeof lbUnsub === 'function') { lbUnsub(); lbUnsub = null; }
    if (lbP2PUnsub) { lbP2PUnsub(); lbP2PUnsub = null; }
    p2pCleanup();
    p2pInitialized = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (gwPollerRef) { clearInterval(gwPollerRef); gwPollerRef = null; }
    stopSong();
}

function startTimers() {
    window.addEventListener('beforeunload', saveGame);
}

// ---- CANVAS RENDER ----
function updateCanvas() {
    const canvas = dom.canvas;
    const ctx = canvas.getContext('2d');
    renderRoom(G.current_room, canvas, G);
    particles.update(1/60);
}

// ---- UI UPDATES ----
function updateAllUI() {
    updateResourceUI();
    updatePrestigeUI();
    updateShopUI();
    updateDecorUI();
    updateRoomUI();
    updateGatewayUI();
    renderPrestigeUpgrades();
    updateLeaderboardUI();
    updateCanvas();
}

// ---- ACHIEVEMENT PROCESSING ----
function processAchievements() {
    const vps = getVPS();
    const newUnlocks = checkAchievements(G, vps);
    if (newUnlocks.length === 0) return;
    for (const ach of newUnlocks) {
        showToast(`🏆 ${ach.icon} ${ach.name}: ${ach.desc}`);
        playUnlock();
    }
    // Update UI to show new achievements
    updateLeaderboardUI();
}

function updateResourceUI() {
    dom.vibeDisplay.textContent = formatNumber(G.vibes);
    dom.vpsDisplay.textContent = formatNumber(getVPS());
    dom.clickValueDisplay.textContent = formatNumber(getClickValue());
    if (dom.clickValueOverlay) dom.clickValueOverlay.textContent = formatNumber(getClickValue());
    if (dom.roomMultDisplay) {
        const rm = getActiveDecorVpsMult();
        dom.roomMultDisplay.textContent = rm > 1.0 ? rm.toFixed(2) + '×' : '1.0×';
        dom.roomMultDisplay.style.color = rm > 1.0 ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    }
    // Offline rate
    if (dom.offlineRateDisplay) {
        let rate = 0.01; // base 1%
        if (G.prestige_upgrades) {
            rate += 0.01 * (G.prestige_upgrades.offline_amp || 0);
        }
        const pct = Math.round(rate * 100);
        dom.offlineRateDisplay.textContent = pct >= 1000 ? (rate).toFixed(1) + '×' : pct + '%';
    }
}

function updatePrestigeUI() {
    const gain = getPrestigeGain();
    const threshold = getPrestigeThreshold();
    const ppFormatted = formatNumber(G.prestige_points);
    const ppParts = ppFormatted.split(' ');
    if (ppParts.length >= 2) {
        // InfZ format: "InfZ⁵ (2.50)" — show as 3 lines
        dom.ppDisplay.innerHTML = ppParts[0] + '<br>×<br>' + (ppParts.length >= 3 ? ppParts.slice(2).join(' ') : ppParts[1]);
    } else {
        dom.ppDisplay.textContent = ppFormatted;
    }
    const lifeFormatted = formatNumber(G.lifetime_vibes);
    const lifeParts = lifeFormatted.split(' ');
    if (lifeParts.length >= 2) {
        dom.lifetimeDisplay.innerHTML = lifeParts[0] + '<br>×<br>' + (lifeParts.length >= 3 ? lifeParts.slice(2).join(' ') : lifeParts[1]);
    } else {
        dom.lifetimeDisplay.textContent = lifeFormatted;
    }
    dom.prestigeCount.textContent = formatNumber(G.total_prestiges);

    let needMsg;
    if (bnGt(gain, BN_ZERO)) {
        needMsg = `✨ Earn ${formatNumber(gain)} chips on prestige!`;
    } else if (!G.prestige_unlocked) {
        const totalRoomCost = Object.values(ROOMS).reduce((sum, r) => sum + r.cost, 0);
        const allRoomIds = Object.keys(ROOMS);
        const needRooms = totalRoomCost > threshold && !allRoomIds.every(id => G.unlocked_rooms.includes(id));
        if (needRooms) {
            const locked = allRoomIds.filter(id => !G.unlocked_rooms.includes(id));
            needMsg = `🔒 Unlock all rooms first (${locked.length} left) — then ${formatNumber(threshold)} vibes`;
        } else if (bnLt(G.lifetime_vibes, threshold)) {
            needMsg = `Need ${formatNumber(threshold)} Total This Round (${formatNumber(G.lifetime_vibes)} / ${formatNumber(threshold)})`;
        } else {
            needMsg = `Need ${formatNumber(threshold)} Total This Round to unlock`;
        }
    } else {
        // Already unlocked, just not enough vibes
        needMsg = `Need ${formatNumber(threshold)} Total This Round to prestige again (${formatNumber(G.lifetime_vibes)} / ${formatNumber(threshold)})`;
    }
    dom.prestigeGain.textContent = needMsg;
    dom.prestigeBtn.disabled = bnLe(gain, BN_ZERO);
    dom.prestigeBtn.style.opacity = bnGt(gain, BN_ZERO) ? 1 : 0.5;
    const chipGain = document.getElementById('prestige-chip-gain');
    if (chipGain) chipGain.textContent = formatNumber(gain);
    // Update affordability of chip upgrades
    document.querySelectorAll('#prestige-upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.upgId;
        if (!id) return;
        const cost = getPrestigeUpgradeCost(id);
        el.classList.toggle('locked', bnLt(G.prestige_points, cost));
    });
}

function updateShopUI() {
    // Autoclickers - use room-specific definitions
    dom.upgradeList.innerHTML = '';
    const curRoom = G.current_room || 'campfire_grove';
    const roomDefs = typeof ROOM_AUTOCLICKERS !== 'undefined' ? (ROOM_AUTOCLICKERS[curRoom] || []) : [];
    const upgradeDefs = roomDefs.length > 0 ? roomDefs : AUTOCLICKERS;
    const roomClickers = (G.room_autoclickers || {})[curRoom] || {};
    upgradeDefs.forEach(tier => {
        // Count only in current room (each room has independent progression)
        const count = roomClickers[tier.id] || 0;
        const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
        const canBuy = bnGe(G.vibes, cost);
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? '' : 'locked'}`;
        el.dataset.tierId = tier.id;
        const iconHtml = `<img src="sprites/images/icons/individual/${tier.id}_64.webp" alt="${tier.name}" class="shop-icon-img" onerror="this.style.display='none';this.nextElementSibling.style.display=''" loading="lazy"><span class="shop-icon-fallback" style="display:none">💻</span>`;
        el.innerHTML = `
            <div class="shop-item-icon">${iconHtml}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${tier.name}</div>
                <div class="shop-item-desc">${tier.desc}</div>
                <div class="shop-item-vps">✦ ${tier.vps} VPS each</div>
            </div>
            <div class="shop-item-right">
                <div class="shop-item-count">${count}</div>
                <div class="shop-item-cost">${formatNumber(cost)} ✦</div>
            </div>
        `;
        el.onclick = () => { if (buyAutoclicker(tier.id)) { playPurchase(); updateAllUI(); } };
        el._tooltipData = {
            name: tier.name,
            desc: tier.desc,
            icon: `sprites/images/icons/individual/${tier.id}_64.webp`,
            stats: [
                { label: 'VPS each', value: '✦ ' + tier.vps, cls: 'cyan' },
                { label: 'Room VPS', value: '✦ ' + formatNumber(tier.vps * count), cls: 'green' },
                { label: 'Owned here', value: String(count), cls: '' },
                { label: 'Cost', value: formatNumber(cost) + ' ✦', cls: canBuy ? 'green' : 'gold' }
            ]
        };
        dom.upgradeList.appendChild(el);
    });

    // Affordability updates (called separately)
}

// Lightweight affordability update - no DOM rebuild
function updateShopAffordability() {
    const vibes = G.vibes;
    // Autoclickers
    const curRoomAff = G.current_room || 'campfire_grove';
    const roomDefsAff = typeof ROOM_AUTOCLICKERS !== 'undefined' ? (ROOM_AUTOCLICKERS[curRoomAff] || []) : [];
    const upgradeDefsAff = roomDefsAff.length > 0 ? roomDefsAff : AUTOCLICKERS;
    document.querySelectorAll('#upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.tierId;
        if (!id) return;
        const tier = upgradeDefsAff.find(t => t.id === id);
        if (!tier) return;
        const roomClickers3 = (G.room_autoclickers || {})[curRoomAff] || {};
        const currentRoomCount = roomClickers3[id] || 0;
        const cost = Math.floor(tier.baseCost * Math.pow(1.15, currentRoomCount));
        const locked = vibes < cost;
        el.classList.toggle('locked', locked);
        el.classList.toggle('affordable', !locked);
    });
    // Prestige upgrades (count-based, chip cost)
    updatePrestigeAffordability();
    // Decor
    document.querySelectorAll('#decor-list .shop-item').forEach(el => {
        const id = el.dataset.decorId;
        if (!id) return;
        const item = getDecorForRoom(G.current_room).find(d => d.id === id) || (() => { for (const r of Object.keys(ROOM_DECOR)) { const f = ROOM_DECOR[r].find(d => d.id === id); if (f) return f; } return null; })();
        if (!item) return;
        const owned = G.owned_decor.includes(id);
        const canBuy = !owned && vibes >= item.cost;
        el.classList.toggle('locked', !owned ? !canBuy : false);
        el.classList.toggle('affordable', canBuy);
    });
}

// Lightweight prestige affordability update - no DOM rebuild
function updatePrestigeAffordability() {
    const chips = G.prestige_points;
    document.querySelectorAll('#prestige-upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.upgId;
        if (!id) return;
        const cost = getPrestigeUpgradeCost(id);
        const locked = bnLt(chips, cost);
        el.classList.toggle('locked', locked);
        el.classList.toggle('affordable', !locked);
    });
}

// Lightweight sidebar tab state indicators — runs every tick
function updateSidebarTabIndicators() {
    const vibes = G.vibes;
    const chips = G.prestige_points;

    // --- Rooms tab: any locked room affordable? ---
    let roomsAvailable = false;
    for (const room of Object.values(ROOMS)) {
        if (!G.unlocked_rooms.includes(room.id) && vibes >= room.cost) {
            roomsAvailable = true;
            break;
        }
    }
    dom.tabRooms.classList.toggle('has-available', roomsAvailable);
    // Also update room card affordabilities in real-time so Rooms tab stays live
    const roomCards = dom.roomList.querySelectorAll('.room-card');
    if (roomCards.length > 0) {
        for (const card of roomCards) {
            const id = card.dataset.roomId;
            if (!id) continue;
            const isLocked = card.classList.contains('locked');
            if (!isLocked) continue;
            const room = ROOMS[id];
            if (!room) continue;
            const canBuy = vibes >= room.cost;
            card.classList.toggle('affordable', canBuy);
        }
    }

    // --- Upgrades tab: any autoclicker in current room affordable? ---
    let upgradesAvailable = false;
    const curRoom = G.current_room || 'campfire_grove';
    const roomDefs = ROOM_AUTOCLICKERS[curRoom] || [];
    const upgradeDefs = roomDefs.length > 0 ? roomDefs : AUTOCLICKERS;
    const roomClickers = (G.room_autoclickers || {})[curRoom] || {};
    for (const tier of upgradeDefs) {
        const count = roomClickers[tier.id] || 0;
        const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
        if (vibes >= cost) {
            upgradesAvailable = true;
            break;
        }
    }
    dom.tabUpgrades.classList.toggle('has-available', upgradesAvailable);

    // --- Decor tab: any decor item in current room affordable & not owned? ---
    let decorAvailable = false;
    const decorItems = getDecorForRoom(curRoom) || [];
    for (const item of decorItems) {
        if (!G.owned_decor.includes(item.id) && vibes >= item.cost) {
            decorAvailable = true;
            break;
        }
    }
    dom.tabDecor.classList.toggle('has-available', decorAvailable);

    // --- Prestige tab: prestige ready OR any prestige upgrade affordable ---
    const gain = getPrestigeGain();
    let prestigeReady = bnGt(gain, BN_ZERO);
    let prestigeUpgradesAvailable = false;
    if (!prestigeReady) {
        for (const upg of PRESTIGE_UPGRADES) {
            const cost = getPrestigeUpgradeCost(upg.id);
            if (bnGe(chips, cost)) {
                prestigeUpgradesAvailable = true;
                break;
            }
        }
    }
    dom.tabPrestige.classList.toggle('has-ready', prestigeReady);
    dom.tabPrestige.classList.toggle('has-available', !prestigeReady && prestigeUpgradesAvailable);

    // --- Achievements tab: any achievement newly unlocked? ---
    let newAchievements = false;
    for (const ach of ACHIEVEMENTS) {
        if (G.achievements.includes(ach.id) && !ach._notified) {
            newAchievements = true;
            break;
        }
    }
    dom.tabAchievements.classList.toggle('has-new', newAchievements);

    // Real-time affordability for all purchasable items (upgrades, decor, prestige upgrades)
    updateShopAffordability();
}

function renderPrestigeUpgrades() {
    const list = dom.prestigeUpgradeList;
    if (!list) return;

    // Calculate and display prestige stats
    let clickMult = 1;
    let vpsMult = 1;
    let gwAdd = 0;
    let baseVps = 0;
    for (const upg of PRESTIGE_UPGRADES) {
        const count = G.prestige_upgrades[upg.id] || 0;
        if (count === 0) continue;
        if (upg.type === 'click_mult') {
            const val = Math.pow(upg.value, count);
            if (isFinite(val)) clickMult *= val;
        }
        if (upg.type === 'perma_mult') {
            const val = Math.pow(upg.value, count);
            if (isFinite(val)) vpsMult *= val;
        }
        if (upg.type === 'gw_add') gwAdd += upg.value * count;
        if (upg.type === 'base_vps') baseVps += upg.value * count;
    }
    const statClick = document.getElementById('prestige-stat-click');
    const statVps = document.getElementById('prestige-stat-vps');
    const statGw = document.getElementById('prestige-stat-gw');
    const statBase = document.getElementById('prestige-stat-base');
    if (statClick) statClick.textContent = formatNumber(clickMult) + '×';
    if (statVps) statVps.textContent = formatNumber(vpsMult) + '×';
    if (statGw) statGw.textContent = gwAdd > 0 ? '+' + formatNumber(gwAdd) + '×' : '0×';
    if (statBase) statBase.textContent = formatNumber(baseVps);

    list.innerHTML = '';
    const sorted = [...PRESTIGE_UPGRADES].sort((a, b) => {
        const costA = getPrestigeUpgradeCost(a.id);
        const costB = getPrestigeUpgradeCost(b.id);
        return bnCompare(costB, costA); // most expensive first
    });
    sorted.forEach(upg => {
        const count = G.prestige_upgrades[upg.id] || 0;
        const cost = getPrestigeUpgradeCost(upg.id);
        const canBuy = bnGe(G.prestige_points, cost);
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? 'affordable' : 'locked'} ${count > 0 ? 'owned' : ''}`;
        el.dataset.upgId = upg.id;
        const iconName = `individual/${upg.id}_64.webp`;
        const iconHtml = `<img src="sprites/images/icons/${iconName}" alt="${upg.name}" class="shop-icon-img" onerror="this.style.display='none';this.nextElementSibling.style.display=''" loading="lazy"><span class="shop-icon-fallback" style="display:none">🔶</span>`;
        el.innerHTML = `
            <div class="shop-item-icon">${iconHtml}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${upg.name} ${count > 0 ? '×' + count : ''}</div>
                <div class="shop-item-desc">${upg.desc}</div>
            </div>
            <div class="shop-item-right">
                <div class="shop-item-count">${count}</div>
                <div class="shop-item-cost">${formatNumber(cost)} 💎</div>
            </div>
        `;
        el.onclick = () => {
            if (canBuy && buyPrestigeUpgrade(upg.id)) {
                playPurchase();
                updateAllUI();
            }
        };
        el._tooltipData = {
            name: upg.name,
            desc: upg.desc,
            icon: `sprites/images/icons/individual/${upg.id}_64.webp`,
            stats: [
                { label: 'Effect', value: upg.desc, cls: 'cyan' },
                { label: 'Owned', value: String(count), cls: '' },
                { label: 'Next cost', value: formatNumber(cost) + ' 💎', cls: canBuy ? 'green' : 'gold' }
            ],
            owned: false
        };
        list.appendChild(el);
    });
}

function updateDecorUI() {
    dom.decorList.innerHTML = '';
    getDecorForRoom(G.current_room).forEach(item => {
        const owned = G.owned_decor.includes(item.id);
        const active = !!G.active_decor[item.id];
        const canBuy = bnGe(G.vibes, item.cost) && !owned;
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? '' : 'locked'} ${active ? 'active' : ''}`;
        el.dataset.decorId = item.id;
        const di = `<img src="sprites/images/room_decor/icons/${item.id}.webp" alt="${item.name}" class="shop-icon-img" onerror="this.style.display='none';this.nextElementSibling.style.display=''" loading="lazy"><span class="shop-icon-fallback" style="display:none">${owned ? (active ? '⭐' : '✨') : '🔒'}</span>`;
        el.innerHTML = `
            <div class="shop-item-icon">${di}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.type} decor</div>
            </div>
            <div class="shop-item-right">
                ${owned ? (active ? '<span style="color:#0f0">ACTIVATED</span>' : '<span style="color:#ff0">EQUIP</span>') : `<div class="shop-item-cost">${formatNumber(item.cost)} ✦</div>`}
            </div>
        `;
        el.onclick = () => {
            if (!owned) {
                if (canBuy && buyDecor(item.id)) {
                    playPurchase();
                    // Only enter placement mode if no saved positions exist
                    if (!G.saved_decor_placements || !G.saved_decor_placements[item.id]) {
                        startDecorPlacement(item.id);
                        showToast(`🎯 Click on the screen to place ${item.name}`);
                    } else {
                        showToast(`✅ ${item.name} restored!`);
                    }
                    updateAllUI();
                }
            } else if (!active) {
                activateDecor(item.id);
                // No placement mode — decor restores to saved positions automatically
                showToast(`✅ ${item.name} equipped!`);
                updateAllUI();
            } else {
                // Deactivate — toggle off and remove from canvas
                activateDecor(item.id);
                showToast(`❌ ${item.name} removed from canvas`);
                updateAllUI();
            }
        };
        el._tooltipData = {
            name: item.name,
            desc: item.type + ' decor',
            icon: `sprites/images/room_decor/icons/${item.id}.webp`,
            stats: [
                { label: 'VPS', value: `+${((item.vpsMult - 1) * 100).toFixed(1).replace(/\.0$/, '')}%`, cls: 'green' },
                { label: 'Status', value: owned ? (active ? 'ACTIVE' : 'OWNED') : 'LOCKED', cls: active ? 'green' : (owned ? 'gold' : '') },
                { label: 'Cost', value: owned ? '—' : formatNumber(item.cost) + ' ✦', cls: owned ? '' : 'gold' }
            ],
            owned: owned
        };
        dom.decorList.appendChild(el);
    });
}

function applyRoomTheme(roomId) {
    const room = ROOMS[roomId];
    if (!room || !room.theme) return;
    const t = room.theme;
    const root = document.documentElement;
    root.style.setProperty('--room-sidebar', t.sidebar);
    root.style.setProperty('--room-panel', t.panel);
    root.style.setProperty('--room-tab-active', t.tab_active);
    root.style.setProperty('--room-tab-inactive', t.tab_inactive);
    root.style.setProperty('--room-tab-text-active', t.tab_text_active);
    root.style.setProperty('--room-tab-text-inactive', t.tab_text_inactive);
    root.style.setProperty('--room-btn-bg', t.btn_bg);
    root.style.setProperty('--room-btn-text', t.btn_text);
    root.style.setProperty('--room-btn-border', t.btn_border);
    root.style.setProperty('--room-title-color', t.title_color);
    root.style.setProperty('--room-accent', t.accent);
    root.style.setProperty('--room-secondary', t.secondary);
    root.style.setProperty('--room-text-primary', t.text_primary);
    root.style.setProperty('--room-text-secondary', t.text_secondary);
    root.style.setProperty('--room-border', t.border);
    root.style.setProperty('--room-highlight', t.highlight);
    root.style.setProperty('--room-vibe-color', t.vibe_color);
    root.style.setProperty('--room-resource-bg', t.resource_bg);
    // Set room-themed button background images
    const prefix = ROOM_PREFIX[roomId] || roomId.substring(0, 2);
    root.style.setProperty('--room-btn-img', `url(/sprites/images/ui/${prefix}_btn.webp)`);
    root.style.setProperty('--room-btn-sm-img', `url(/sprites/images/ui/${prefix}_btn_sm.webp)`);
    root.style.setProperty('--room-btn-wide-img', `url(/sprites/images/ui/${prefix}_btn_wide.webp)`);
    root.style.setProperty('--room-btn-xl-img', `url(/sprites/images/ui/${prefix}_btn_xl.webp)`);
    // Set text contrast vars (always white fill + black stroke)
    root.style.setProperty('--room-btn-text-color', '#ffffff');
    root.style.setProperty('--room-btn-text-stroke', '#000000');
    // Swap room-themed UI divider
    const divider = document.getElementById('room-theme-divider');
    if (divider) {
        const prefix = ROOM_PREFIX[roomId] || roomId.substring(0, 2);
        divider.src = `sprites/images/ui/${prefix}_ui_divider.png`;
    }
}

function updateRoomUI() {
    const prefix = ROOM_PREFIX[G.current_room] || (G.current_room || '').substring(0, 2);
    const divider = document.getElementById('current-room');
    if (divider) divider.src = `sprites/images/ui/${prefix}_ui_divider.png`;
    applyRoomTheme(G.current_room);
    if (dom.currentRoomUpgradeLabel) {
        dom.currentRoomUpgradeLabel.textContent = ROOMS[G.current_room]?.name || 'Campfire Grove';
    }
    dom.roomList.innerHTML = '';
    Object.values(ROOMS).forEach(room => {
        const unlocked = G.unlocked_rooms.includes(room.id);
        const active = G.current_room === room.id;
        const canUnlock = bnGe(G.vibes, room.cost) && !unlocked;
        const el = document.createElement('div');
        el.className = `room-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'} ${canUnlock ? 'affordable' : ''} ${unlocked && !active ? 'purchased' : ''}`;
        el.dataset.roomId = room.id;
        el.innerHTML = `
            <div class="room-card-bg" style="background-image:url('${room.bgImage || ''}');background-size:cover;background-position:center;"></div>
            <div class="room-card-info">
                <div class="room-card-name">${room.name}</div>
                <div class="room-card-desc">${room.desc}</div>
                <div class="room-card-cost">${unlocked ? (active ? 'Current' : 'Click to enter') : `${formatNumber(room.cost)} ✦`}</div>
            </div>
        `;
        el.onclick = () => {
            if (unlocked) {
                switchRoom(room.id);
                updateAllUI();
            } else if (bnGe(G.vibes, room.cost)) {
                if (unlockRoom(room.id)) {
                    playUnlock();
                    switchRoom(room.id);
                    updateAllUI();
                }
            }
        };
        dom.roomList.appendChild(el);
    });
}

function updateGatewayUI() {
    const gw = getGatewayStatus();
    const quality = getConnectionQuality();
    if (dom.gatewayStatus) dom.gatewayStatus.textContent = `${quality.icon} ${quality.label}`;
    if (dom.gatewayStatus) dom.gatewayStatus.style.color = quality.color;
    if (dom.gatewayLatency) dom.gatewayLatency.textContent = gw.connected ? `${gw.latency.toFixed(0)}ms` : '---';
    const taskBusy = checkGatewayBusy();
    const baseMult = getLatencyMultiplier();
    const latMult = taskBusy ? baseMult * 1.5 : baseMult;
    if (dom.gatewayMult) dom.gatewayMult.textContent = gw.connected ? `${latMult.toFixed(1)}x` : '0x';
    if (dom.gatewayMult) dom.gatewayMult.style.color = taskBusy ? '#ffd700' : (gw.connected ? '#0f0' : '#f44');
    if (dom.gatewayStatus && taskBusy) {
        dom.gatewayStatus.textContent = `🔥 ${getGatewayTaskLabel() || 'IN USE'}`;
        dom.gatewayStatus.style.color = '#ffd700';
    }
    // Detailed panel
    if (dom.gatewayStatusDetailed) dom.gatewayStatusDetailed.textContent = `${quality.icon} ${quality.label}`;
    if (dom.gatewayLatencyDetailed) dom.gatewayLatencyDetailed.textContent = gw.connected ? `${gw.latency.toFixed(0)}ms (avg ${getAverageLatency().toFixed(0)}ms)` : '---';
    if (dom.gatewayMultDetailed) dom.gatewayMultDetailed.textContent = gw.connected ? `${latMult.toFixed(1)}x` : '0x';
    if (dom.gatewayQualityDetailed) dom.gatewayQualityDetailed.textContent = gw.connected ? `${quality.label} tier` : 'No connection';
    // Scan progress
    if (dom.gatewayScanProgress) {
        if (gw.scanning) {
            const pct = gw.scanTotal > 0 ? Math.round((gw.scanProgress / gw.scanTotal) * 100) : 0;
            dom.gatewayScanProgress.textContent = `🔍 ${gw.scanProgress.toLocaleString()}/${gw.scanTotal.toLocaleString()} (${pct}%)`;
            dom.gatewayScanProgress.style.color = '#ffaa00';
        } else if (gw.connected) {
            dom.gatewayScanProgress.textContent = '✅ Connected';
            dom.gatewayScanProgress.style.color = '#0f0';
        } else if (gw.lastError && gw.lastError.includes('No gateway')) {
            dom.gatewayScanProgress.textContent = '⛔ No gateway found (hot + web range)';
            dom.gatewayScanProgress.style.color = '#666';
        } else {
            dom.gatewayScanProgress.textContent = '⏸ Idle — type a port above';
            dom.gatewayScanProgress.style.color = '#666';
        }
    }
}

// ---- LEADERBOARD RENDERING ----

// Universal number formatter for ALL leaderboard cells. Never throws, always returns a safe string.
function fmtAll(v, fallback = '0') {
    try {
        if (v === undefined || v === null) return fallback;
        if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? (console.warn('fmtAll: unparseable string',v),v) : formatNumber(n); }
        return formatNumber(v);
    } catch (e) {
        console.warn('fmtAll error:', e, v);
        return fallback;
    }
}
// Legacy alias for VIBES column (same safe logic)
function fmtVibes(v) { return fmtAll(v); }

function fmtSafe(v, fallback = '0') { return fmtAll(v, fallback); }

// Deduplicate leaderboard entries by playerId (preferred) or name (fallback)
// When two entries share an identity, keep the one with most progress
function deduplicateEntries(entries) {
    const seenByPid = new Map();
    const seenByName = new Map();
    for (const entry of entries) {
        // Track by playerId
        if (entry.playerId) {
            const key = 'pid:' + entry.playerId;
            const existing = seenByPid.get(key);
            if (existing) {
                const winner = pickBetterEntry(entry, existing);
                seenByPid.set(key, winner);
            } else {
                seenByPid.set(key, entry);
            }
        }
        // Also track by name (catches Firebase UID vs P2P UUID for same player)
        const nameKey = 'name:' + entry.name;
        const existing = seenByName.get(nameKey);
        if (existing) {
            const winner = pickBetterEntry(entry, existing);
            seenByName.set(nameKey, winner);
        } else {
            seenByName.set(nameKey, entry);
        }
    }
    // Build result: take best entry per unique identity (pid preferred, name fallback)
    // Also deduplicate by name across PIDs (Firebase UID vs P2P UUID for same player)
    const result = [];
    const usedNames = new Set();
    const usedPids = new Set();
    for (const entry of entries) {
        const pidKey = entry.playerId ? 'pid:' + entry.playerId : null;
        const nameKey = 'name:' + entry.name;

        // Skip if we've already output this pid
        if (pidKey && usedPids.has(pidKey)) continue;
        // Skip if this name was already output (catches same player with different pid)
        if (usedNames.has(nameKey)) continue;

        // Output the best version of this identity from our maps
        const best = pidKey ? seenByPid.get(pidKey) : seenByName.get(nameKey);
        if (!best) continue;

        if (pidKey) usedPids.add(pidKey);
        usedNames.add(nameKey);
        result.push(best);
    }
    return result;
}

// Compare two entries and return the one with higher progress
function pickBetterEntry(a, b) {
    if (a.tier > b.tier) return a;
    if (a.tier < b.tier) return b;
    if (a.prestige > b.prestige) return a;
    if (a.prestige < b.prestige) return b;
    const ppCmp = bnCompare(a.pp, b.pp);
    if (ppCmp > 0) return a;
    if (ppCmp < 0) return b;
    const vpsCmp = bnCompare(a.vps, b.vps);
    if (vpsCmp > 0) return a;
    if (vpsCmp < 0) return b;
    const vibeCmp = bnCompare(a.vibes, b.vibes);
    return vibeCmp >= 0 ? a : b;
}

async function updateLeaderboardUI(externalEntries) {
    const list = dom.leaderboardList;
    if (!list) return;

    let entries = externalEntries ? [...externalEntries] : [];
    let fbHadData = false;

    // If no external data provided, fetch it ourselves (poll fallback)
    if (!externalEntries) {
        // Try Firebase leaderboard first (production)
        if (fbReady) {
            const fbEntries = await fbGetLeaderboard(50);
            if (fbEntries && fbEntries.length > 0) {
                fbHadData = true;
                entries = fbEntries.map(e => ({
                    playerId: e.uid,
                    name: e.username,
                    vibes: e.score_full ?? e.score ?? 0,
                    pp: e.pp_full ?? e.total_pp ?? 0,
                    prestige: e.prestige_level ?? 0,
                    vps: e.vps_full ?? e.vps ?? 0,
                    tier: getTierFromPrestige(e.prestige_level ?? 0),
                }));
            }
        }

        // Fallback to local server API (only if Firebase isn't available)
        if (!fbReady && entries.length === 0) {
            const lbResult = await apiGetLeaderboard(50);
            if (lbResult && lbResult.entries && lbResult.entries.length > 0) {
                entries = lbResult.entries.map(e => ({
                    playerId: e.id || e.username,
                    name: e.username,
                    vibes: e.score,
                    pp: e.total_pp || e.prestige_level || 0,
                    prestige: e.prestige_level || 0,
                    vps: e.vps || 0,
                    tier: getTierFromPrestige(e.prestige_level || 0),
                }));
            }
        }

        // Fallback to local + mock data (only if no backend at all)
        if (!fbReady && entries.length === 0) {
            entries = [
                { playerId: 'local', name: G.username || 'You', vibes: G.lifetime_vibes, pp: G.total_pp_earned, prestige: G.total_prestiges, vps: getVPS(), tier: getCurrentTier(G) },
                { playerId: 'mock-zoops', name: 'Zoops', vibes: 252_000_000_000_000, pp: 1_183_807, prestige: 12, vps: 85_000_000_000_000, tier: 3 },
                { playerId: 'mock-cipher', name: 'CipherZero', vibes: 136_000_000_000_000, pp: 611_620, prestige: 8, vps: 42_000_000_000_000, tier: 2 },
                { playerId: 'mock-pixel', name: 'PixelWarden', vibes: 70_000_000_000_000, pp: 294_303, prestige: 5, vps: 18_000_000_000_000, tier: 1 },
            ];
        }
    } else {
        fbHadData = true;
    }

    // Always include local player if not in list (even with Firebase)
    const displayName = G.displayName || G.username || 'Player';
    // Check by playerId first (P2P entries carry identity), then by name
    const localPlayerId = getLocalP2PId();
    // Check by P2P UUID, Firebase UID, and name to prevent duplicate rows
    const localAlreadyInEntries = entries.some(e =>
        e.playerId === localPlayerId ||
        (fbUser && e.playerId === fbUser.uid) ||
        e.name === displayName ||
        e.name === G.username
    );
    if (!localAlreadyInEntries) {
        if (entries.length === 0 || externalEntries || fbHadData || !fbReady) {
            entries.push({
                playerId: localPlayerId || fbUser?.uid || 'local',
                name: displayName, vibes: G.lifetime_vibes, pp: G.total_pp_earned,
                prestige: G.total_prestiges, vps: getVPS(), tier: getCurrentTier(G)
            });
        }
    }

    entries.sort((a, b) => {
        if (b.tier !== a.tier) return b.tier - a.tier;
        if (b.prestige !== a.prestige) return b.prestige - a.prestige;
        const ppCmp = bnCompare(b.pp, a.pp);
        if (ppCmp !== 0) return ppCmp;
        const vpsCmp = bnCompare(b.vps, a.vps);
        if (vpsCmp !== 0) return vpsCmp;
        return bnCompare(b.vibes, a.vibes);
    });

    // Deduplicate: keep only the best entry per playerId (or name as fallback)
    entries = deduplicateEntries(entries);

    // Normalize all entry values so every cell is safely formattable
    for (const e of entries) {
        e.vibes = e.vibes ?? 0;
        e.pp = e.pp ?? 0;
        e.vps = e.vps ?? 0;
        e.prestige = e.prestige ?? 0;
    }

    // DOM diffing: update in-place without flicker
    const maxRows = 50;
    const oldRows = list.querySelectorAll('.lb-entry');
    const nameField = (n) => n.replace('◆ ', '').replace('⭐ ', '').trim();

    // Build lookup of old rows by playerId (if data-attr set), fallback to name
    const oldRowMap = new Map();
    oldRows.forEach(row => {
        if (row.classList.contains('lb-header')) return;
        // Prefer playerId data attribute for identity-based matching
        const pid = row.dataset && row.dataset.playerId;
        if (pid) {
            oldRowMap.set('pid:' + pid, row);
            return;
        }
        const nameEl = row.querySelector('.lb-name');
        if (nameEl) oldRowMap.set('name:' + nameField(nameEl.textContent), row);
    });

    // Handle empty state
    if (entries.length === 0 && externalEntries) {
        let empty = list.querySelector('.lb-empty');
        if (!empty) {
            list.innerHTML = '';
            empty = document.createElement('div');
            empty.className = 'lb-entry lb-empty';
            empty.style.cssText = 'justify-content:center;color:#666;font-size:7px;padding:12px 5px;border:none;';
            empty.textContent = '✨ No entries yet — log in and play to be first!';
            list.appendChild(empty);
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    // Generate header row (inside list so columns align with entries)
    const hdrEl = document.createElement('div');
    hdrEl.className = 'lb-entry lb-header';
    hdrEl.innerHTML = '<span class="lb-rank">#</span><span class="lb-name">NAME</span><span class="lb-vibes">VIBES</span><span class="lb-vps">VPS</span><span class="lb-pp">PP</span><span class="lb-prestige">PRESTIGE</span><span class="lb-tier">TIER</span>';
    fragment.appendChild(hdrEl);
    entries.slice(0, maxRows).forEach((entry, i) => {
        const rowName = nameField(entry.name);
        // Lookup by playerId first, fallback to name
        const lookupKey = entry.playerId ? 'pid:' + entry.playerId : ('name:' + rowName);
        let el = oldRowMap.get(lookupKey);
        // Remove any stale name-only match if we now have a playerId
        if (!el && entry.playerId) {
            // If a row with the same name exists but no playerId, reclaim it
            el = oldRowMap.get('name:' + rowName);
            if (el && el.dataset && el.dataset.playerId && el.dataset.playerId !== entry.playerId) {
                el = null; // different playerId, don't reuse
            }
        }

        if (el) {
            // Update existing row in-place
            oldRowMap.delete(lookupKey);
            if (entry.playerId) { el.dataset.playerId = entry.playerId; }
            const rankEl = el.querySelector('.lb-rank');
            const vibeEl = el.querySelector('.lb-vibes');
            const ppEl = el.querySelector('.lb-pp');
            const vpsEl = el.querySelector('.lb-vps');
            const prestigeEl = el.querySelector('.lb-prestige');
            const tierEl = el.querySelector('.lb-tier');
            if (rankEl) rankEl.textContent = '#' + (i + 1);
            if (vibeEl) vibeEl.textContent = fmtVibes(entry.vibes);
            if (vpsEl) vpsEl.textContent = fmtSafe(entry.vps);
            if (ppEl) ppEl.textContent = fmtSafe(entry.pp);
            if (prestigeEl) prestigeEl.textContent = fmtSafe(entry.prestige);
            if (tierEl) {
                const name = entry.tier >= 0 ? TIERS[entry.tier].name : '—';
                const iconNum = entry.tier >= 0 ? getTierIconNum(entry.tier) : 0;
                tierEl.innerHTML = name + (iconNum > 0 ? `<img src="sprites/images/icons/individual/tier_${iconNum}.webp" class="lb-tier-img" style="width:24px;height:24px;vertical-align:middle;margin-left:3px;image-rendering:pixelated;" onerror="this.style.display='none'">` : '');
            }
        } else {
            // Create new row
            const isYou = entry.name === displayName || entry.name === G.username;
            const isDev = /^drgekoz$/i.test(entry.name);
            el = document.createElement('div');
            el.className = `lb-entry ${isYou ? 'you' : ''} ${isDev ? 'dev' : ''}`;
            if (entry.playerId) el.dataset.playerId = entry.playerId;
            if (isDev) {
                el.innerHTML = `
                    <span class="lb-rank">#${i + 1}</span>
                    <span class="lb-name dev">◆ ${entry.name} <span class="lb-dev-badge">(DEV)
                        <span class="dev-tooltip">
                            <strong>Official Game Dev</strong>
                            <a href="https://adsdoctormelbourne.com.au" target="_blank" rel="noopener">🌐 Website</a>
                            <a href="https://github.com/DrGekoz" target="_blank" rel="noopener">🐙 GitHub</a>
                            <a href="https://buymeacoffee.com/DrGekoz" target="_blank" rel="noopener">☕ Buy Me a Coffee</a>
                        </span>
                    </span></span>
                    <span class="lb-vibes">${fmtVibes(entry.vibes)}</span>
                    <span class="lb-vps">${fmtSafe(entry.vps)}</span>
                    <span class="lb-pp">${fmtSafe(entry.pp)}</span>
                    <span class="lb-prestige">${fmtSafe(entry.prestige)}</span>
                    <span class="lb-tier">${(() => { const n = (entry.tier >= 0 ? TIERS[entry.tier].name : '—'); const ni = (entry.tier >= 0 ? getTierIconNum(entry.tier) : 0); return n + (ni > 0 ? `<img src="sprites/images/icons/individual/tier_${ni}.webp" class="lb-tier-img" style="width:24px;height:24px;vertical-align:middle;margin-left:3px;image-rendering:pixelated;" onerror="this.style.display='none'">` : ''); })()}</span>
                `;
            } else {
                el.innerHTML = `
                    <span class="lb-rank">#${i + 1}</span>
                    <span class="lb-name">${isYou ? `<img src="sprites/images/icons/vibe_icon.webp" class="vibe-icon-sm" alt=""> ` : ''}${entry.name}</span>
                    <span class="lb-vibes">${fmtVibes(entry.vibes)}</span>
                    <span class="lb-vps">${fmtSafe(entry.vps)}</span>
                    <span class="lb-pp">${fmtSafe(entry.pp)}</span>
                    <span class="lb-prestige">${fmtSafe(entry.prestige)}</span>
                    <span class="lb-tier">${(() => { const n = (entry.tier >= 0 ? TIERS[entry.tier].name : '—'); const ni = (entry.tier >= 0 ? getTierIconNum(entry.tier) : 0); return n + (ni > 0 ? `<img src="sprites/images/icons/individual/tier_${ni}.webp" class="lb-tier-img" style="width:24px;height:24px;vertical-align:middle;margin-left:3px;image-rendering:pixelated;" onerror="this.style.display='none'">` : ''); })()}</span>
                `;
            }
        }
        fragment.appendChild(el);
    });

    // Remove rows that no longer exist in data
    oldRowMap.forEach(row => row.remove());

    // Replace list content atomically
    list.innerHTML = '';
    list.appendChild(fragment);
}

// ---- REALTIME LOCAL LEADERBOARD UPDATE ----
// Updates just the local player's row numbers without re-fetching from server
function updateLocalLeaderboardEntry() {
    const list = dom.leaderboardList;
    if (!list) return;

    // Prefer data-player-id lookup over name matching (avoids duplicate-row confusion)
    const localPid = getLocalP2PId();
    let row = null;
    if (localPid) row = list.querySelector(`.lb-entry[data-player-id="${localPid}"]`);
    // Fallback to Firebase UID if P2P ID not available
    if (!row && fbUser) row = list.querySelector(`.lb-entry[data-player-id="${fbUser.uid}"]`);
    // Fallback to 'local' placeholder ID
    if (!row) row = list.querySelector('.lb-entry[data-player-id="local"]');
    // Last resort: name-based fallback
    if (!row) {
        const displayName = G.displayName || G.username || 'You';
        for (const r of list.querySelectorAll('.lb-entry')) {
            const nameEl = r.querySelector('.lb-name');
            if (!nameEl) continue;
            const rowName = nameEl.textContent.replace('◆ ', '').replace('⭐ ', '').trim();
            if (rowName === displayName || rowName === G.username) {
                row = r;
                break;
            }
        }
    }
    if (!row) return;

    const vibeEl = row.querySelector('.lb-vibes');
    const ppEl = row.querySelector('.lb-pp');
    const vpsEl = row.querySelector('.lb-vps');
    const prestigeEl = row.querySelector('.lb-prestige');
    const tierEl = row.querySelector('.lb-tier');
    if (vibeEl) vibeEl.textContent = fmtSafe(G.lifetime_vibes);
    if (ppEl) ppEl.textContent = fmtSafe(G.total_pp_earned);
    if (vpsEl) vpsEl.textContent = fmtSafe(getVPS());
    if (prestigeEl) prestigeEl.textContent = fmtSafe(G.total_prestiges);
    if (tierEl) {
        const cur = getCurrentTier(G);
        tierEl.textContent = cur >= 0 ? TIERS[cur].name : '—';
    }
    const tierIconEl = row.querySelector('.lb-tier-icon');
    if (tierIconEl) {
        const cur = getCurrentTier(G);
        const iconNum = cur >= 0 ? getTierIconNum(cur) : 0;
        tierIconEl.innerHTML = iconNum > 0 ? `<img src="sprites/images/icons/individual/tier_${iconNum}.webp" class="lb-tier-img" onerror="this.style.display='none'">` : '';
    }
}

// ---- TIERS UI ----
// Map tier index to icon number (1-50, cycles back)
function getTierIconNum(tierIdx) {
    if (tierIdx < 0) return 0;
    return ((tierIdx) % 50) + 1;
}
// Direct fallback renderer for leaderboard — bypasses any BN/comparison issues
function renderLeaderboardFallback(list) {
    if (!list) return;
    const name = G.displayName || G.username || 'Player';
    const entries = [
        { name, vibes: formatNumber(G.lifetime_vibes), vps: formatNumber(getVPS()), pp: formatNumber(G.total_pp_earned), prestige: G.total_prestiges, tier: getCurrentTierName(G) },
        { name: 'Zoops', vibes: '252.00T', vps: '85.00T', pp: '1.18M', prestige: 12, tier: 'Gold' },
        { name: 'CipherZero', vibes: '136.00T', vps: '42.00T', pp: '611.62k', prestige: 8, tier: 'Silver' },
        { name: 'PixelWarden', vibes: '70.00T', vps: '18.00T', pp: '294.30k', prestige: 5, tier: 'Bronze' },
    ];
    list.innerHTML = '<div class="lb-entry lb-header"><span class="lb-rank">#</span><span class="lb-name">NAME</span><span class="lb-vibes">VIBES</span><span class="lb-vps">VPS</span><span class="lb-pp">PP</span><span class="lb-prestige">PRESTIGE</span><span class="lb-tier">TIER</span></div>'
        + entries.map((e, i) => {
            const iconNum = e.tierName ? getTierIconNum(e.tierName) : 0;
            const iconHtml = iconNum > 0 ? `<img src=\"sprites/images/icons/individual/tier_${iconNum}.webp\" class=\"lb-tier-img\" onerror=\"this.style.display='none'\">` : '';
            return '<div class=\"lb-entry\"><span class=\"lb-rank\">#' + (i+1) + '</span><span class=\"lb-name\">' + e.name + '</span><span class=\"lb-vibes\">' + e.vibes + '</span><span class=\"lb-vps\">' + e.vps + '</span><span class=\"lb-pp\">' + e.pp + '</span><span class=\"lb-prestige\">' + e.prestige + '</span><span class=\"lb-tier\">' + e.tier + '</span><span class=\"lb-tier-icon\">' + iconHtml + '</span></div>';
        }).join('');
}

function renderTiers() {
    const list = document.getElementById('tier-list');
    const statsEl = document.getElementById('tier-stats');
    if (!list || !TIERS || !statsEl) return;
    const currentTier = getCurrentTier(G);
    const nextTierIdx = TIERS.findIndex(t => bnGt(t.requires, G.total_prestiges));
    const unlocked = TIERS.filter(t => bnGe(G.total_prestiges, t.requires)).length;
    // Stats bar
    // Accumulated bonuses from unlocked tiers
    let totalClick = 0, totalVps = 0, totalOffline = 0, totalAll = 0, totalRooms = 0;
    for (const tier of TIERS) {
        if (!bnGe(G.total_prestiges, tier.requires)) break;
        switch (tier.type) {
            case 'click': totalClick += tier.value; break;
            case 'vps': totalVps += tier.value; break;
            case 'offline': totalOffline += tier.value; break;
            case 'all': totalAll += tier.value; break;
            case 'rooms': totalRooms += tier.value; break;
        }
    }
    statsEl.innerHTML = '<div class="stat-box prestige-chip-box" style="min-width:100px;"><div class="stat-value chip-value" style="font-size:11px;">' + unlocked + ' / ' + TIERS.length + '</div><div class="stat-label">TIERS UNLOCKED</div></div>'
        + '<div class="stat-box" style="min-width:100px;"><div class="stat-value" style="font-size:11px;color:var(--accent-gold);">' + formatNumber(G.total_prestiges) + '</div><div class="stat-label">TOTAL PRESTIGES</div></div>'
        + '<div class="stat-box" style="min-width:100px;"><div class="stat-value" style="font-size:11px;color:var(--accent-cyan);">' + (nextTierIdx >= 0 ? formatNumber(TIERS[nextTierIdx].requires) : 'MAX') + '</div><div class="stat-label">NEXT TIER AT</div></div>'
        // Tier bonus stat boxes (matching prestige stats style)
        + '<div style="display:flex;gap:4px;flex-wrap:wrap;grid-column:1/-1;margin-top:4px;">'
        + '<div class="prestige-stat-box"><span class="prestige-stat-label">CLICK ×</span><span class="prestige-stat-value" style="color:var(--accent-gold);">' + formatNumber(1 + totalClick) + '</span></div>'
        + '<div class="prestige-stat-box"><span class="prestige-stat-label">VPS ×</span><span class="prestige-stat-value" style="color:var(--accent-green);">' + formatNumber(1 + totalVps) + '</span></div>'
        + '<div class="prestige-stat-box"><span class="prestige-stat-label">OFFLINE +%</span><span class="prestige-stat-value" style="color:var(--accent-pink);">' + formatNumber(totalOffline) + '</span></div>'
        + '<div class="prestige-stat-box"><span class="prestige-stat-label">ALL ×</span><span class="prestige-stat-value" style="color:var(--accent-cyan);">' + formatNumber(1 + totalAll) + '</span></div>'
        + '<div class="prestige-stat-box"><span class="prestige-stat-label">ROOMS</span><span class="prestige-stat-value" style="color:var(--accent-gold);">' + formatNumber(totalRooms) + '</span></div>'
        + '</div>';
    // Tier list
    list.innerHTML = '';
    TIERS.forEach((tier, idx) => {
        const unlocked = bnGe(G.total_prestiges, tier.requires);
        const el = document.createElement('div');
        el.className = `shop-item ${unlocked ? 'affordable' : 'locked'}`;
        el.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px;padding:4px 6px;font-size:6px;';
        el.innerHTML = `
            <span style="color:${unlocked ? 'var(--accent-gold)' : 'var(--text-secondary)'};font-size:8px;"><img src="sprites/images/icons/individual/tier_${getTierIconNum(idx)}.webp" style="width:28px;height:28px;image-rendering:pixelated;object-fit:contain;vertical-align:middle;display:inline-block;" onerror="this.style.display='none'"></span>
            <div>
                <div style="color:${unlocked ? 'var(--accent-gold)' : 'var(--text-primary)'}"><strong>${tier.name}</strong> — ${formatNumber(tier.requires)} prestiges</div>
                <div style="color:${unlocked ? 'var(--accent-green)' : 'var(--text-secondary)'}">${tier.bonus}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

// ---- HELPER FUNCTIONS ----
// ---- ACHIEVEMENTS UI ----
function updateAchievementsUI() {
    const list = dom.panelAchievements;
    if (!list || !ACHIEVEMENTS) return;
    const unlocked = G.achievements.length;
    const total = ACHIEVEMENTS.length;
    const pct = total > 0 ? Math.round(unlocked / total * 100) : 0;
    list.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:7px;color:var(--accent-gold);white-space:nowrap;">🏆 ${unlocked}/${total}</span>
        <div style="flex:1;height:6px;background:#1a1a1a;border:1px solid #333;position:relative;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, #ffd700, #ffaa00);transition:width 0.5s;"></div>
        </div>
        <span style="font-size:6px;color:var(--text-secondary);white-space:nowrap;">${pct}%</span>
    </div>`;
    ACHIEVEMENTS.forEach(ach => {
        const earned = G.achievements.includes(ach.id);
        const el = document.createElement('div');
        el.className = `ach-item ${earned ? 'unlocked' : 'locked'}`;
        el.innerHTML = '<div class="ach-icon">' + ach.icon + '</div>' +
            '<div class="ach-info">' +
                '<div class="ach-name">' + ach.name + '</div>' +
                '<div class="ach-desc">' + ach.desc + '</div>' +
            '</div>' +
            '<div class="ach-status">' + (earned ? '&#10003;' : '&#128274;') + '</div>';
        list.appendChild(el);
    });
}

function spawnClickFloat(value) {
    if (!G.settings.show_float_text) return;
    const el = document.createElement('div');
    el.className = 'click-float';
    el.textContent = `+${formatNumber(value)} ✦`;
    const btn = dom.clickBtn;
    const rect = btn.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2 - 30) + 'px';
    el.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function showPopup(title, text, callback) {
    dom.popupTitle.textContent = title;
    dom.popupText.textContent = text;
    dom.popup._callback = callback || null;
    dom.popup.classList.remove('hidden');
}

function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function showCredits() {
    const screen = document.getElementById('credits-screen');
    const skip = document.getElementById('credits-skip');
    if (!screen) return;
    screen.classList.remove('hidden');

    // Restart animation by reflow
    const scroll = screen.querySelector('.credits-scroll');
    if (scroll) {
        scroll.style.animation = 'none';
        void scroll.offsetHeight;
        scroll.style.animation = 'creditsScroll 25s linear forwards';
    }

    const handler = () => {
        screen.classList.add('hidden');
        skip.removeEventListener('click', handler);
        // Reset room
    };
    skip.addEventListener('click', handler);

    // Auto-close after animation
    setTimeout(handler, 26000);
}

// ---- SETTINGS & DISPLAY NAME ----
function showDisplayNamePrompt() {
    const current = G.displayName || G.username || 'Player';
    dom.settingsNameInput.value = current;
    dom.settingsCooldownInfo.style.display = 'none';
    dom.settingsNameError.textContent = '';
    dom.settingsSaveBtn.disabled = false;
    dom.settingsSaveBtn.textContent = '▶ SAVE';
    openSettings('name');
}

async function saveDisplayName() {
    const name = dom.settingsNameInput.value.trim();
    if (!name || name.length < 2) {
        dom.settingsNameError.textContent = 'MIN 2 CHARS';
        return;
    }
    if (name.length > 20) {
        dom.settingsNameError.textContent = 'MAX 20 CHARS';
        return;
    }

    const lastChanged = G.display_name_last_changed || 0;
    const daysSince = Math.floor((Date.now() - lastChanged) / (1000 * 60 * 60 * 24));
    // No cooldown — name can be changed freely
    if (false) {
        const daysLeft = 30 - daysSince;
        dom.settingsNameError.textContent = `⚠️ ${daysLeft} DAY(S) REMAINING`;
        return;
    }

    // Check if name is already taken (skip if same as current)
    if (name !== G.displayName && name !== G.username) {
        dom.settingsSaveBtn.textContent = '⏳ CHECKING...';
        dom.settingsSaveBtn.disabled = true;
        try {
            let taken = false;
            if (G.auth_mode === 'firebase' && typeof fbCheckName === 'function') {
                taken = await fbCheckName(name);
            } else if (G.auth_token && G.server_online) {
                const lb = await apiGetLeaderboard();
                if (lb && lb.entries) {
                    taken = lb.entries.some(e => e.name.toLowerCase() === name.toLowerCase());
                }
            }
            if (taken) {
                dom.settingsNameError.textContent = '⚠️ NAME ALREADY TAKEN';
                dom.settingsSaveBtn.textContent = '▶ SAVE';
                dom.settingsSaveBtn.disabled = false;
                return;
            }
        } catch (_) {
            // Server unreachable — allow save
        }
    }

    G.displayName = name;
    dom.userDisplay.textContent = name; dom.userDisplay.title = name;
    dom.settingsDisplayName.textContent = name;
    dom.settingsNameError.textContent = '';
    dom.settingsSaveBtn.textContent = '✅ SAVED';
    dom.settingsSaveBtn.disabled = true;
    saveGame();
    showToast(`✨ Name set to "${name}"`);

    if (G.auth_mode === 'firebase' && fbUser) {
        try {
            const { updateProfile } = await import(
                'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'
            );
            await updateProfile(fbUser, { displayName: name });
        } catch (_) {}
        // Upload local save to Firebase
        try {
            await fbSave(G);
            await fbSubmitScore(name, bnToNumber(G.lifetime_vibes), G.total_prestiges, G.total_pp_earned, name, getVPS());
        } catch (_) {}
    }
}

function updateSettingsCooldown() {
    // No cooldown — always allow name changes
    dom.settingsCooldownInfo.style.display = 'none';
    dom.settingsSaveBtn.disabled = false;
}

function openSettings(tab) {
    dom.settingsScreen.classList.remove('hidden');
    dom.settingsNameInput.value = G.displayName || G.username || '';
    dom.settingsDisplayName.textContent = G.displayName || G.username || 'Player';
    updateSettingsCooldown();

    // Sync volume sliders
    if (dom.settingsSfxVolume) dom.settingsSfxVolume.value = G.settings.sfx_volume;
    if (dom.settingsMusicVolume) dom.settingsMusicVolume.value = G.settings.music_volume || 0.5;
    if (dom.settingsMusicVolLabel) dom.settingsMusicVolLabel.textContent = Math.round((G.settings.music_volume || 0.5) * 100) + '%';
    // Sync sidebar position checkbox
    if (dom.settingsSidebarPos) {
        dom.settingsSidebarPos.checked = G.settings && G.settings.sidebar_position === 'right';
    }
    // Sync gateway port from cache
    if (dom.settingsGwPort) {
        try {
            const raw = localStorage.getItem('hermes_idleviber_gateway_port');
            if (raw) {
                const { port } = JSON.parse(raw);
                if (port) dom.settingsGwPort.value = port;
            }
        } catch {}
    }
    if (dom.settingsGwStatus) {
        const gw = getGatewayStatus();
        dom.settingsGwStatus.textContent = gw.connected ? '✅ Connected' : '⏸ Idle';
        dom.settingsGwStatus.style.color = gw.connected ? '#0f0' : 'var(--text-secondary)';
    }
    // Show account status
    if (dom.settingsAccountStatus) {
        const mode = G.auth_mode === 'firebase' ? (G.displayName || G.username || 'Signed in').toUpperCase() : 'NOT SIGNED IN';
        dom.settingsAccountStatus.textContent = mode;
    }

    dom.settingsTabName.classList.remove('active');
    dom.settingsTabAudio.classList.remove('active');
    dom.settingsTabCredits.classList.remove('active');
    dom.settingsPanelName.classList.add('hidden');
    dom.settingsPanelAudio.classList.add('hidden');
    dom.settingsPanelCredits.classList.add('hidden');

    if (tab === 'name') {
        dom.settingsTabName.classList.add('active');
        dom.settingsPanelName.classList.remove('hidden');
    } else if (tab === 'audio') {
        dom.settingsTabAudio.classList.add('active');
        dom.settingsPanelAudio.classList.remove('hidden');
    } else {
        dom.settingsTabCredits.classList.add('active');
        dom.settingsPanelCredits.classList.remove('hidden');
    }
}

function closeSettings() {
    dom.settingsScreen.classList.add('hidden');
}

// ---- SHOP TOOLTIP ---- 
let _tooltipHideTimer = null;

function showShopTooltip(data, event) {
    if (_tooltipHideTimer) {
        clearTimeout(_tooltipHideTimer);
        _tooltipHideTimer = null;
    }
    const tt = document.getElementById('shop-tooltip-main');
    if (!tt) return;
    
    let html = '';
    if (data.icon) html += `<img src="${data.icon}" class="tt-icon-img" onerror="this.style.display='none'">`;
    if (data.name) html += `<div class="tt-name">${data.name}</div>`;
    if (data.desc) html += `<div class="tt-desc">${data.desc}</div>`;
    if (data.stats) {
        data.stats.forEach(s => {
            html += `<div class="tt-stat"><span class="tt-label">${s.label}</span><span class="tt-value ${s.cls || ''}">${s.value}</span></div>`;
        });
    }
    if (data.owned) html += `<div class="tt-stat"><span class="tt-value green">✓ OWNED</span></div>`;
    
    tt.innerHTML = html;
    tt.classList.remove('hidden');
}

function hideShopTooltip() {
    if (_tooltipHideTimer) {
        clearTimeout(_tooltipHideTimer);
        _tooltipHideTimer = null;
    }
    _tooltipHideTimer = setTimeout(() => {
        const tt = document.getElementById('shop-tooltip-main');
        if (tt) tt.classList.add('hidden');
        _tooltipHideTimer = null;
    }, 100); // 0.1s delay to prevent flickering when moving mouse across items
}

function initTooltipDelegation() {
    const panels = ['upgrade-list', 'prestige-upgrade-list', 'decor-list', 'gw-upgrade-list'];
    panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        panel.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.shop-item');
            if (!item) { hideShopTooltip(); return; }
            const ttData = item._tooltipData;
            if (ttData) showShopTooltip(ttData, e);
        });
        
        panel.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.shop-item');
            if (!item || !e.relatedTarget || !item.contains(e.relatedTarget)) {
                hideShopTooltip();
            }
        });
    });
}

// ---- CLICK & HOLD TO SPAM BUY ----
let _holdTimer = null;
let _holdSpamTimer = null;
let _holdTarget = null;

function initHoldToSpam() {
    const list = document.getElementById('upgrade-list');
    const prestigeList = document.getElementById('prestige-upgrade-list');

    function stopHold() {
        if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
        if (_holdSpamTimer) { clearInterval(_holdSpamTimer); _holdSpamTimer = null; }
        _holdTarget = null;
    }

    // Get current room's upgrade definitions
    function getUpgradeDefs() {
        const room = G.current_room || 'campfire_grove';
        const roomDefs = typeof ROOM_AUTOCLICKERS !== 'undefined' ? (ROOM_AUTOCLICKERS[room] || []) : [];
        return roomDefs.length > 0 ? roomDefs : AUTOCLICKERS;
    }

    function setupHoldOnContainer(container) {
        if (!container) return;

        container.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.shop-item');
            if (!item || item.classList.contains('locked')) return;
            if (e.button !== 0) return;

            const tierId = item.dataset.tierId;
            const upgId = item.dataset.upgId;
            const isPrestige = !!upgId;
            if (!tierId && !upgId) return;

            stopHold();
            _holdTarget = item;

            _holdTimer = setTimeout(() => {
                if (_holdTarget !== item) return;
                _holdSpamTimer = setInterval(() => {
                    if (!_holdTarget || _holdTarget !== item) {
                        stopHold();
                        return;
                    }
                    if (isPrestige) {
                        // Prestige upgrade spam
                        const id = _holdTarget.dataset.upgId;
                        if (!id) { stopHold(); return; }
                        const cost = getPrestigeUpgradeCost(id);
                        if (bnGe(G.prestige_points, cost)) {
                            if (buyPrestigeUpgrade(id)) {
                                playPurchase();
                                updateAllUI();
                            } else {
                                stopHold();
                            }
                        } else {
                            stopHold();
                        }
                    } else {
                        // Autoclicker spam (per-room)
                        const id = _holdTarget.dataset.tierId;
                        if (!id) { stopHold(); return; }
                        const defs = getUpgradeDefs();
                        const tier = defs.find(t => t.id === id);
                        if (!tier) { stopHold(); return; }
                        const room = G.current_room || 'campfire_grove';
                        const roomClickers = G.room_autoclickers[room] || {};
                        const count = roomClickers[id] || 0;
                        const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
                        if (bnGe(G.vibes, cost)) {
                            if (buyAutoclicker(tier.id)) {
                                playPurchase();
                                updateAllUI();
                                updateShopItemTooltip(item, id);
                            } else {
                                stopHold();
                            }
                        } else {
                            stopHold();
                        }
                    }
                }, 5);
            }, 500);
        });

        container.addEventListener('mouseup', stopHold);
        container.addEventListener('mouseleave', stopHold);
    }

    setupHoldOnContainer(list);
    setupHoldOnContainer(prestigeList);
}

function updateShopItemTooltip(item, tierId) {
    // Find tier in per-room definitions first, fallback to global
    const room = G.current_room || 'campfire_grove';
    const roomDefs = typeof ROOM_AUTOCLICKERS !== 'undefined' ? (ROOM_AUTOCLICKERS[room] || []) : [];
    const defs = roomDefs.length > 0 ? roomDefs : AUTOCLICKERS;
    const tier = defs.find(t => t.id === tierId);
    if (!tier) return;
    const roomClickers = (G.room_autoclickers || {})[room] || {};
    const count = roomClickers[tierId] || 0;
    const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
    const canBuy = bnGe(G.vibes, cost);
    item._tooltipData = {
        name: tier.name,
        desc: tier.desc,
        icon: `sprites/images/icons/individual/${tier.id}_64.webp`,
        stats: [
            { label: 'VPS each', value: '✦ ' + tier.vps, cls: 'cyan' },
            { label: 'Room VPS', value: '✦ ' + formatNumber(tier.vps * count), cls: 'green' },
            { label: 'Owned here', value: String(count), cls: '' },
            { label: 'Cost', value: formatNumber(cost) + ' ✦', cls: canBuy ? 'green' : 'gold' }
        ]
    };
}

// ---- BUY ALL BUTTONS ----
function buyAllUpgrades() {
    const room = G.current_room || 'campfire_grove';
    const roomDefs = typeof ROOM_AUTOCLICKERS !== 'undefined' ? (ROOM_AUTOCLICKERS[room] || []) : [];
    const defs = roomDefs.length > 0 ? roomDefs : AUTOCLICKERS;
    if (defs.length === 0) return;

    // Sort by baseCost descending (most expensive first)
    const sorted = [...defs].sort((a, b) => b.baseCost - a.baseCost);
    const roomClickers = (G.room_autoclickers || {})[room] || {};
    let bought = 0;

    for (const tier of sorted) {
        const count = roomClickers[tier.id] || 0;
        const maxQty = getMaxBuyable(tier.baseCost, count, bnToNumber(G.vibes));
        if (maxQty > 0) {
            const result = buyAutoclicker(tier.id, maxQty);
            if (result) bought += result;
        }
    }

    if (bought > 0) {
        playPurchase();
        updateAllUI();
    }
}

function buyAllDecor() {
    const room = G.current_room || 'campfire_grove';
    const items = getDecorForRoom(room) || [];
    if (items.length === 0) return;

    // Sort by cost descending, filter unowned
    const sorted = items.filter(d => !G.owned_decor.includes(d.id)).sort((a, b) => b.cost - a.cost);
    let bought = 0;

    for (const item of sorted) {
        if (bnGe(G.vibes, item.cost) && !G.owned_decor.includes(item.id)) {
            if (buyDecor(item.id)) bought++;
        }
    }

    if (bought > 0) {
        playPurchase();
        updateAllUI();
        showToast(`✅ ${bought} decor items restored to canvas`);
    }
}

function buyAllPrestige() {
    if (!PRESTIGE_UPGRADES || PRESTIGE_UPGRADES.length === 0) return;

    // Build sorted list by progressive cost descending
    const withCost = PRESTIGE_UPGRADES.map(upg => {
        const count = G.prestige_upgrades[upg.id] || 0;
        const cost = getPrestigeUpgradeCost(upg.id);
        return { upg, cost, count };
    }).sort((a, b) => bnCompare(b.cost, a.cost));

    let bought = 0;

    for (const entry of withCost) {
        if (bnGe(G.prestige_points, entry.cost)) {
            if (buyPrestigeUpgrade(entry.upg.id)) {
                bought++;
                // After buying one, recalculate remaining costs
                // Since buying changes prestige_points, re-check next iterations
            }
        }
    }

    if (bought > 0) {
        playPurchase();
        updateAllUI();
    }
}

function applySidebarPosition() {
    const gameScreen = dom.gameScreen || document.getElementById('game-screen');
    if (!gameScreen) return;
    if (G.settings && G.settings.sidebar_position === 'right') {
        gameScreen.classList.add('sidebar-right');
    } else {
        gameScreen.classList.remove('sidebar-right');
    }
    // Sync checkbox
    if (dom.settingsSidebarPos) {
        dom.settingsSidebarPos.checked = G.settings && G.settings.sidebar_position === 'right';
    }
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', init);
