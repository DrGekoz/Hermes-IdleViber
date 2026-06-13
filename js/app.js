// ============================================================
// Hermes IdleViber — Main Application
// ============================================================

import {
    G, CONFIG, ROOMS, ROOM_DECOR, getDecorForRoom, AUTOCLICKERS, PRESTIGE_UPGRADES, ACHIEVEMENTS,
    GOLDEN_COOKIE_TYPES, GOLDEN_COOKIE_INTERVAL_MIN, GOLDEN_COOKIE_INTERVAL_MAX, GOLDEN_COOKIE_DURATION,
    goldenCookieSystem, spawnGoldenCookie, collectGoldenCookie, getClickBoostMult, getVpsBoostMult,
    wrinklerSystem, SYNERGIES, getSynergyBonus, getWrinklerPenalty, getEffectiveVpsMultiplier,
    updateWrinklers, popWrinkler, popAllWrinklers,
    getVPS, getClickValue, getPrestigeGain, getPrestigeThreshold, formatNumber,
    getRoomVpsMult, calculateOfflineProgress, applyOfflineProgress,
    getBulkCost, getMaxBuyable,
    addVibes, buyAutoclicker, buyPrestigeUpgrade, buyDecor,
    activateDecor, unlockRoom, switchRoom, doPrestige,
    isPrestigeUnlockable, unlockPrestige, checkAchievements,
    onStateChange, saveGame, loadGame, notifyStateChange,
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
         savePlayerData as fbSave, loadPlayerData as fbLoad } from './firebase.js';

// ---- DOM REFS ----
const $ = (id) => document.getElementById(id);

let dom = {};
let particles = null;
let animFrame = null;
let ticker = null;
let saver = null;
let gwPoller = null;
let lbUpdater = null;
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
        userId: G.userId || 'local_guest',
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
        dom.userDisplay.textContent = G.displayName || G.username;
        // Attempt cloud load
        (async () => {
            try {
                const cloudState = await fbLoad();
                if (cloudState) {
                    Object.assign(G, cloudState);
                    G.auth_mode = 'firebase';
                    G.userId = fbUser.uid;
                    G.username = fbUser.displayName || G.username;
                    showToast('☁️ Cloud save loaded');
                }
            } catch (_) {}
            enterGame();
        })();
        return;
    }

    // Local / guest / local_api mode
    if (cookie.authMode === 'local' || cookie.authMode === 'local_api' || cookie.authMode === 'guest') {
        G.userId = cookie.userId;
        G.username = cookie.username || 'Player';
        G.auth_mode = cookie.authMode;
        G.displayName = cookie.displayName || '';
        dom.userDisplay.textContent = G.displayName || G.username;
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
        guestBtn: $('guest-btn'),
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

        ppDisplayTotal: $('pp-display-total'),
        clickValueOverlay: $('click-value-display-overlay'),
        roomMultDisplay: $('room-mult-display'),
        popup: $('popup'),
        popupTitle: $('popup-title'),
        popupText: $('popup-text'),
        popupOk: $('popup-ok'),
        tabRooms: $('tab-rooms'),
        tabUpgrades: $('tab-upgrades'),
        tabPrestige: $('tab-prestige'),
        tabDecor: $('tab-decor'),
        tabGateway: $('tab-gateway'),
        tabAchievements: $('tab-achievements'),
        panelRooms: $('panel-rooms'),
        panelUpgrades: $('panel-upgrades'),
        panelPrestige: $('panel-prestige'),
        panelDecor: $('panel-decor'),
        panelGateway: $('panel-gateway'),
        panelAchievements: $('panel-achievements'),
        settingsBtn: $('settings-btn'),
        settingsScreen: $('settings-screen'),
        settingsClose: $('settings-close'),
        settingsBackdrop: $('settings-backdrop'),
        settingsSidebarPos: $('settings-sidebar-pos'),
        settingsLogoutBtn: $('settings-logout-btn'),
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
        if (gatewayStatus.connected && (gatewayStatus.checkCount || 0) % 3 === 0) {
            checkGatewayBusy().then(() => updateGatewayUI());
        }
        gatewayStatus.checkCount = (gatewayStatus.checkCount || 0) + 1;
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
    dom.guestBtn.addEventListener('click', () => { playClick(); doGuest(); });
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
    // Settings tabs
    if (dom.settingsTabName) dom.settingsTabName.addEventListener('click', () => openSettings('name'));
    if (dom.settingsTabAudio) dom.settingsTabAudio.addEventListener('click', () => { openSettings('audio'); playClick(); });
    if (dom.settingsTabCredits) dom.settingsTabCredits.addEventListener('click', () => openSettings('credits'));
    // Settings: Audio volume sliders
    if (dom.settingsSfxVolume) {
        dom.settingsSfxVolume.addEventListener('input', () => {
            const vol = parseFloat(dom.settingsSfxVolume.value);
            G.settings.sfx_volume = vol;
            setSfxVolume(vol);
            if (dom.settingsSfxVolLabel) dom.settingsSfxVolLabel.textContent = Math.round(vol * 100) + '%';
            playClick();
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
        if (gain <= 0) return;
        const msg = "Reset for " + gain + " Prestige Chips?\n\nYou'll keep:\n• Prestige Chips (" + (G.total_pp_earned + gain) + " total)\n• All Prestige Upgrades\n\nYou'll lose:\n• All vibes\n• Rooms & room VPS multipliers\n• All autoclickers\n• All decor";
        showPopup('\u2728 Prestige', msg, () => {
            if (doPrestige()) {
                updateAllUI();
                showToast(`✨ Prestiged! +${gain} PP`);
                playSfxPrestige();
                showCredits();
            }
        });
    });

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

        // Add placement
        if (!G.placed_decor[decorId]) G.placed_decor[decorId] = [];
        G.placed_decor[decorId].push({ x: snapped.x, y: snapped.y });

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
            startDrag(hit.decorKey, hit.index, snapped.x, snapped.y);
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

    // Music player
    initMusicPlayer();

    // State changes
    onStateChange((type) => {
        if (type === 'vibes') {
            updateResourceUI();
            updateShopAffordability(); // Lightweight: just toggles locked class
            updateLocalLeaderboardEntry(); // Realtime local score
        }
        if (type === 'autoclickers' || type === 'gateway_upgrades') {
            updateResourceUI();
            updateShopUI();
            renderPrestigeUpgrades();
        }
        if (type === 'prestige' || type === 'reset' || type === 'load') {
            updateAllUI();
        }
        if (type === 'rooms' || type === 'room_switch') {
            updateRoomUI();
            updateResourceUI();
            updateCanvas();
        }
        if (type === 'decor' || type === 'decor_active') {
            updateDecorUI();
            updateCanvas();
        }
        if (type === 'gateway') {
            updateGatewayUI();
            updateResourceUI();
        }
    });

    // Popup
    dom.popupOk.addEventListener('click', () => {
        dom.popup.classList.add('hidden');
        if (dom.popup._callback) dom.popup._callback();
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
            }
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
            dom.userDisplay.textContent = G.username;

            // Load cloud save from Firestore
            const cloudState = await fbLoad();
            if (cloudState) {
                Object.assign(G, cloudState);
                G.auth_mode = 'firebase';
                G.userId = result.uid;
                G.username = result.user.displayName || username;
                showToast('☁️ Cloud save loaded');
            } else {
                // First login — upload local save data to Firebase
                fbSave(G).catch(() => {});
                fbSubmitScore(G.username || 'Player', G.lifetime_vibes, G.total_prestiges, G.total_pp_earned).catch(() => {});
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
                dom.userDisplay.textContent = G.username;
                const cloudState = await fbLoad();
                if (cloudState) {
                    Object.assign(G, cloudState);
                } else {
                    // First login — upload local save
                    fbSave(G).catch(() => {});
                    fbSubmitScore(G.username || 'Player', G.lifetime_vibes, G.total_prestiges, G.total_pp_earned).catch(() => {});
                }
                enterGame();
                return;
            }
        }
        // Firebase login failed, fall through to local API
        console.warn('Firebase login failed:', result?.error);
    }

    // Try local server API (dev mode)
    dom.loginMsg.textContent = '⏳ Authenticating (local)...';
    const result = await apiLogin(username, password);
    if (result && result.success) {
        G.userId = username;
        G.username = username;
        G.auth_token = result.token;
        G.auth_mode = 'local_api';
        dom.userDisplay.textContent = username;

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
                dom.userDisplay.textContent = username;
                enterGame();
                return;
            }
        }
    }

    // Last resort: local mode (works offline, no cloud saves)
    dom.loginMsg.textContent = '';
    G.userId = `local_${username}`;
    G.username = username;
    G.auth_token = null;
    G.auth_mode = 'local';
    dom.userDisplay.textContent = username;
    showToast('🔌 Offline mode (local save only)');
    loadGame();
    enterGame();
}

function doGoogleLogin() {
    dom.loginMsg.textContent = '⏳ Signing in with Google...';
    doGoogleLoginAsync();
}

async function doGoogleLoginAsync() {
    if (!fbReady) {
        showToast('⚠️ Firebase not ready — use Email or Guest');
        return;
    }
    const result = await loginWithGoogle();
    if (result && result.success) {
        G.userId = result.uid;
        G.username = result.user.displayName || 'Player';
        G.auth_mode = 'firebase';
        dom.userDisplay.textContent = G.username;

        // Load cloud save
        const cloudState = await fbLoad();
        if (cloudState) {
            Object.assign(G, cloudState);
            G.auth_mode = 'firebase';
            G.userId = result.uid;
            G.username = result.user.displayName || 'Player';
            showToast('☁️ Cloud save loaded');
        } else {
            // First login — upload local save
            fbSave(G).catch(() => {});
            fbSubmitScore(G.username || 'Player', G.lifetime_vibes, G.total_prestiges, G.total_pp_earned).catch(() => {});
        }

        enterGame();
    } else {
        const msg = result?.error || 'Google sign-in failed';
        dom.loginMsg.textContent = msg;
        console.warn('Google login:', msg);
    }
}

function doGuest() {
    G.userId = 'local_guest';
    G.username = 'Guest';
    G.auth_mode = 'local';
    dom.userDisplay.textContent = 'Guest';
    loadGame();
    enterGame();
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
    dom.userDisplay.textContent = display;

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

    // Prompt for display name if not set
    if (!G.displayName && G.auth_mode !== 'local') {
        setTimeout(() => showDisplayNamePrompt(), 800);
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
function initGameLoop() {
    let prestigeCheckCounter = 0;
    // Game logic: VPS generation at 100ms (10 ticks/sec)
    ticker = setInterval(() => {
        const vps = getVPS();
        if (vps > 0) {
            addVibes(vps / 10);
        }
        // Check prestige unlock every 1s (every 10 ticks)
        prestigeCheckCounter++;
        if (prestigeCheckCounter >= 10 && !G.prestige_unlocked) {
            prestigeCheckCounter = 0;
            unlockPrestige();
            updatePrestigeUI();
        }
    }, CONFIG.TICK_INTERVAL);

    // Auto-save every 30s + cloud sync
    saver = setInterval(() => {
        saveGame();
        // Cloud save + leaderboard submit if authenticated
        if (G.auth_mode === 'firebase' && fbUser) {
            fbSave(G).catch(() => {});
            fbSubmitScore(G.username || 'Player', G.lifetime_vibes, G.total_prestiges, G.total_pp_earned).catch(() => {});
        } else if (G.auth_token && G.server_online) {
            apiSave(G.auth_token, G).catch(() => {});
            apiSubmitScore(G.auth_token, G.lifetime_vibes, G.total_pp_earned).catch(() => {});
        }
    }, CONFIG.SAVE_INTERVAL);

    // Leaderboard refresh every 15s
    lbUpdater = setInterval(updateLeaderboardUI, 15000);

    // --- RENDER LOOP: 60fps via requestAnimationFrame ---
    let lastBgRoom = null;
    let bgCanvas = null;
    let lastFrameTime = 0;

    function renderFrame(timestamp) {
        const canvas = dom.canvas;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Cache background render per room (redraw only on room change)
        if (lastBgRoom !== G.current_room) {
            lastBgRoom = G.current_room;
            // Trigger async background load — renderRoom handles it
        }

        // Smooth 30fps cap for the heavy canvas render
        const elapsed = timestamp - lastFrameTime;
        if (elapsed > 33) { // ~30fps
            lastFrameTime = timestamp;
            renderRoom(G.current_room, canvas, G);
        }

        // Particles animate every frame regardless (lightweight)
        particles.update();

        // Gateway glow effect (animated every frame)
        const gw = getGatewayStatus();
        if (gw.connected) {
            const intensity = 0.1 + getLatencyMultiplier() * 0.05;
            const size = Math.min(40, 20 + gw.latency * 0.05);
            dom.canvas.style.boxShadow = `0 0 ${size}px rgba(0, 255, 136, ${intensity})`;
        } else {
            dom.canvas.style.boxShadow = '0 0 10px rgba(255,68,68,0.1)';
        }

        animFrame = requestAnimationFrame(renderFrame);
    }
    animFrame = requestAnimationFrame(renderFrame);
}

function clearGameLoop() {
    clearInterval(ticker);
    clearInterval(saver);
    clearInterval(lbUpdater);
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
    particles.update();
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

function updateResourceUI() {
    dom.vibeDisplay.textContent = formatNumber(G.vibes);
    dom.vpsDisplay.textContent = formatNumber(getVPS());
    dom.clickValueDisplay.textContent = formatNumber(getClickValue());
    if (dom.clickValueOverlay) dom.clickValueOverlay.textContent = formatNumber(getClickValue());
    if (dom.roomMultDisplay) {
        const rm = getRoomVpsMult();
        dom.roomMultDisplay.textContent = rm > 1.0 ? rm.toFixed(2) + '×' : '1.0×';
        dom.roomMultDisplay.style.color = rm > 1.0 ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    }
}

function updatePrestigeUI() {
    const gain = getPrestigeGain();
    const threshold = getPrestigeThreshold();
    dom.ppDisplay.textContent = G.prestige_points;
    dom.lifetimeDisplay.textContent = formatNumber(G.lifetime_vibes);
    dom.prestigeCount.textContent = G.total_prestiges;

    let needMsg;
    if (gain > 0) {
        needMsg = `✨ Earn ${gain} chips on prestige!`;
    } else if (!G.prestige_unlocked) {
        const totalRoomCost = Object.values(ROOMS).reduce((sum, r) => sum + r.cost, 0);
        const allRoomIds = Object.keys(ROOMS);
        const needRooms = totalRoomCost > threshold && !allRoomIds.every(id => G.unlocked_rooms.includes(id));
        if (needRooms) {
            const locked = allRoomIds.filter(id => !G.unlocked_rooms.includes(id));
            needMsg = `🔒 Unlock all rooms first (${locked.length} left) — then ${formatNumber(threshold)} vibes`;
        } else if (G.lifetime_vibes < threshold) {
            needMsg = `Need ${formatNumber(threshold)} lifetime vibes (${formatNumber(G.lifetime_vibes)} / ${formatNumber(threshold)})`;
        } else {
            needMsg = `Need ${formatNumber(threshold)} lifetime vibes to unlock`;
        }
    } else {
        // Already unlocked, just not enough vibes
        needMsg = `Need ${formatNumber(threshold)} lifetime vibes to prestige again (${formatNumber(G.lifetime_vibes)} / ${formatNumber(threshold)})`;
    }
    dom.prestigeGain.textContent = needMsg;
    dom.prestigeBtn.disabled = gain <= 0;
    dom.prestigeBtn.style.opacity = gain > 0 ? 1 : 0.5;
    const chipGain = document.getElementById('prestige-chip-gain');
    if (chipGain) chipGain.textContent = gain;
    // Update affordability of chip upgrades
    document.querySelectorAll('#prestige-upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.upgId;
        if (!id) return;
        const upg = PRESTIGE_UPGRADES.find(u => u.id === id);
        if (!upg) return;
        const owned = G.prestige_upgrades[id] || false;
        el.classList.toggle('locked', owned || G.prestige_points < upg.cost);
    });
}

function updateShopUI() {
    // Autoclickers
    dom.upgradeList.innerHTML = '';
    AUTOCLICKERS.forEach(tier => {
        const count = G.autoclickers[tier.id] || 0;
        const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
        const canBuy = G.vibes >= cost;
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? '' : 'locked'}`;
        el.dataset.tierId = tier.id;
        const iconHtml = `<img src="sprites/images/icons/individual/${tier.id}_64.png" alt="${tier.name}" class="shop-icon-img" onerror="this.style.display='none';this.nextElementSibling.style.display=''" loading="lazy"><span class="shop-icon-fallback" style="display:none">💻</span>`;
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
            icon: `sprites/images/icons/individual/${tier.id}_64.png`,
            stats: [
                { label: 'VPS each', value: '✦ ' + tier.vps, cls: 'cyan' },
                { label: 'Owned', value: String(count), cls: '' },
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
    document.querySelectorAll('#upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.tierId;
        if (!id) return;
        const tier = AUTOCLICKERS.find(t => t.id === id);
        if (!tier) return;
        const count = G.autoclickers[id] || 0;
        const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
        el.classList.toggle('locked', vibes < cost);
    });
    // Prestige upgrades (count-based, chip cost)
    document.querySelectorAll('#prestige-upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.upgId;
        if (!id) return;
        const upg = PRESTIGE_UPGRADES.find(u => u.id === id);
        if (!upg) return;
        const count = G.prestige_upgrades[id] || 0;
        const cost = Math.floor(upg.baseCost * Math.pow(upg.costMult, count));
        el.classList.toggle('locked', G.prestige_points < cost);
    });
    // Decor
    document.querySelectorAll('#decor-list .shop-item').forEach(el => {
        const id = el.dataset.decorId;
        if (!id) return;
        const item = getDecorForRoom(G.current_room).find(d => d.id === id) || (() => { for (const r of Object.keys(ROOM_DECOR)) { const f = ROOM_DECOR[r].find(d => d.id === id); if (f) return f; } return null; })();
        if (!item) return;
        const owned = G.owned_decor.includes(id);
        const canBuy = !owned && vibes >= item.cost;
        el.classList.toggle('locked', !owned ? !canBuy : false);
    });
}

function renderPrestigeUpgrades() {
    const list = dom.prestigeUpgradeList;
    if (!list) return;
    list.innerHTML = '';
    PRESTIGE_UPGRADES.forEach(upg => {
        const count = G.prestige_upgrades[upg.id] || 0;
        const cost = Math.floor(upg.baseCost * Math.pow(upg.costMult, count));
        const canBuy = G.prestige_points >= cost;
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? 'affordable' : 'locked'} ${count > 0 ? 'owned' : ''}`;
        el.dataset.upgId = upg.id;
        const iconName = `individual/${upg.id}_64.png`;
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
            icon: `sprites/images/icons/individual/${upg.id}_64.png`,
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
        const canBuy = G.vibes >= item.cost && !owned;
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? '' : 'locked'} ${active ? 'active' : ''}`;
        el.dataset.decorId = item.id;
        const decorIcon = `<img src="sprites/images/room_decor/icons/${item.id}.png" alt="${item.name}" class="shop-icon-img" onerror="this.style.display='none';this.nextElementSibling.style.display=''" loading="lazy"><span class="shop-icon-fallback" style="display:none">${owned ? (active ? '⭐' : '✨') : '🔒'}</span>`;
        el.innerHTML = `
            <div class="shop-item-icon">${decorIcon}</div>
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
                    // Enter placement mode
                    startDecorPlacement(item.id);
                    showToast(`🎯 Click on the screen to place ${item.name}`);
                    updateAllUI();
                }
            } else if (!active) {
                activateDecor(item.id);
                startDecorPlacement(item.id);
                updateAllUI();
            } else {
                // Deactivate — toggle off and remove from canvas
                activateDecor(item.id);
                updateAllUI();
            }
        };
        el._tooltipData = {
            name: item.name,
            desc: item.type + ' decor',
            icon: `sprites/images/room_decor/icons/${item.id}.png`,
            stats: [
                { label: 'Type', value: item.type, cls: '' },
                { label: 'Status', value: owned ? (active ? 'ACTIVE' : 'OWNED') : 'LOCKED', cls: active ? 'green' : (owned ? 'gold' : '') },
                { label: 'Cost', value: owned ? '—' : formatNumber(item.cost) + ' ✦', cls: owned ? '' : 'gold' }
            ],
            owned: owned
        };
        dom.decorList.appendChild(el);
    });
}

function updateRoomUI() {
    dom.roomDisplay.textContent = ROOMS[G.current_room]?.name || 'Unknown';
    dom.roomList.innerHTML = '';
    Object.values(ROOMS).forEach(room => {
        const unlocked = G.unlocked_rooms.includes(room.id);
        const active = G.current_room === room.id;
        const canUnlock = G.vibes >= room.cost && !unlocked;
        const el = document.createElement('div');
        el.className = `room-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`;
        el.innerHTML = `
            <div class="room-card-bg" style="background-image:url('${room.bgImage || ''}');background-size:cover;background-position:center;">
                <div class="room-card-icon">${active ? '📍' : unlocked ? '🏠' : '🔒'}</div>
            </div>
            <div class="room-card-info">
                <div class="room-card-name">${room.name}</div>
                <div class="room-card-desc">${room.desc}</div>
                <div class="room-card-cost">${unlocked ? (active ? 'Current' : 'Click to enter') : `${formatNumber(room.cost)} ✦`}</div>
                ${unlocked ? `<div class="room-card-mult">×${room.vpsMult} VPS</div>` : ''}
            </div>
        `;
        el.onclick = () => {
            if (unlocked) {
                switchRoom(room.id);
                updateAllUI();
            } else if (canUnlock) {
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

async function updateLeaderboardUI() {
    const list = dom.leaderboardList;
    if (!list) return;
    list.innerHTML = '<div class="lb-entry"><span style="color:#666;font-size:6px;">Loading...</span></div>';

    let entries = [];
    let fbHadData = false;

    // Try Firebase leaderboard first (production)
    if (fbReady) {
        const fbEntries = await fbGetLeaderboard(50);
        if (fbEntries && fbEntries.length > 0) {
            fbHadData = true;
            entries = fbEntries.map(e => ({
                name: e.username,
                vibes: e.score,
                pp: e.total_pp || e.prestige_level || 0,
                prestige: e.prestige_level || 0,
            }));
        }
    }

    // Fallback to local server API (only if Firebase isn't available)
    if (!fbReady && entries.length === 0) {
        const lbResult = await apiGetLeaderboard(50);
        if (lbResult && lbResult.entries && lbResult.entries.length > 0) {
            entries = lbResult.entries.map(e => ({
                name: e.username,
                vibes: e.score,
                pp: e.prestige_level || 0,
                prestige: e.prestige_level || 0,
            }));
        }
    }

    // Fallback to local + mock data (only if no backend at all)
    if (!fbReady && entries.length === 0) {
        entries = [
            { name: G.username || 'You', vibes: G.lifetime_vibes, pp: G.total_pp_earned, prestige: G.total_prestiges },
            { name: 'Zoops', vibes: 252_000_000_000_000, pp: 1_183_807, prestige: 12 },
            { name: 'CipherZero', vibes: 136_000_000_000_000, pp: 611_620, prestige: 8 },
            { name: 'PixelWarden', vibes: 70_000_000_000_000, pp: 294_303, prestige: 5 },
        ];
    }

    // Always include local player if not in list (even with Firebase)
    const displayName = G.displayName || G.username || 'You';
    const localEntry = { name: displayName + (fbReady ? '' : ''), vibes: G.lifetime_vibes, pp: G.total_pp_earned, prestige: G.total_prestiges };
    if (!entries.find(e => e.name === displayName || e.name === G.username)) {
        if (fbHadData || !fbReady) {
            // Only add local player if Firebase has data or Firebase isn't in use
            entries.push(localEntry);
        }
    }

    entries.sort((a, b) => {
        if (b.prestige !== a.prestige) return b.prestige - a.prestige;
        if (b.pp !== a.pp) return b.pp - a.pp;
        return b.vibes - a.vibes;
    });
    list.innerHTML = '';
    if (entries.length === 0 && fbReady) {
        const el = document.createElement('div');
        el.className = 'lb-entry';
        el.style.cssText = 'justify-content:center;color:#666;font-size:7px;padding:12px 5px;border:none;';
        el.textContent = '✨ No entries yet — log in and play to be first!';
        list.appendChild(el);
        return;
    }
    entries.slice(0, 50).forEach((entry, i) => {
        const isYou = entry.name === displayName || entry.name === G.username;
        const isDev = /^drgekoz$/i.test(entry.name);
        const el = document.createElement('div');
        el.className = `lb-entry ${isYou ? 'you' : ''} ${isDev ? 'dev' : ''}`;
        if (isDev) {
            // DrGekoz — game dev with diamond, (DEV) badge, tooltip popup
            el.innerHTML = `
                <span class="lb-rank">#${i + 1}</span>
                <span class="lb-name dev">◆ ${entry.name}</span>
                <span class="lb-dev-badge">(DEV)
                    <span class="dev-tooltip">
                        <strong>Official Game Dev</strong>
                        <a href="https://adsdoctormelbourne.com.au" target="_blank" rel="noopener">🌐 Website</a>
                        <a href="https://github.com/DrGekoz" target="_blank" rel="noopener">🐙 GitHub</a>
                        <a href="https://buymeacoffee.com/DrGekoz" target="_blank" rel="noopener">☕ Buy Me a Coffee</a>
                    </span>
                </span>
                <span class="lb-vibes">${formatNumber(entry.vibes)}</span>
                <span class="lb-pp">${formatNumber(entry.pp)} PP</span>
                <span class="lb-prestige">P${entry.prestige}</span>
            `;
        } else {
            el.innerHTML = `
                <span class="lb-rank">#${i + 1}</span>
                <span class="lb-name">${isYou ? '⭐ ' : ''}${entry.name}</span>
                <span class="lb-vibes">${formatNumber(entry.vibes)}</span>
                <span class="lb-pp">${formatNumber(entry.pp)} PP</span>
                <span class="lb-prestige">P${entry.prestige}</span>
            `;
        }
        list.appendChild(el);
    });
}

// ---- REALTIME LOCAL LEADERBOARD UPDATE ----
// Updates just the local player's row numbers without re-fetching from server
function updateLocalLeaderboardEntry() {
    const list = dom.leaderboardList;
    if (!list) return;
    const entries = list.querySelectorAll('.lb-entry');
    const displayName = G.displayName || G.username || 'You';
    for (const row of entries) {
        const nameEl = row.querySelector('.lb-name');
        if (!nameEl) continue;
        const rowName = nameEl.textContent.replace('◆ ', '').replace('⭐ ', '').trim();
        if (rowName === displayName || rowName === G.username) {
            const vibeEl = row.querySelector('.lb-vibes');
            const ppEl = row.querySelector('.lb-pp');
            if (vibeEl) vibeEl.textContent = formatNumber(G.lifetime_vibes);
            if (ppEl) ppEl.textContent = formatNumber(G.total_pp_earned) + ' PP';
            break;
        }
    }
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
        el.innerHTML = `<div class="ach-icon">${earned ? ach.icon : '🔒'}</div>
            <div class="ach-info">
                <div class="ach-name">${earned ? ach.name : '???'}</div>
                <div class="ach-desc">${earned ? ach.desc : '???'}</div>
            </div>
            <div class="ach-status">${earned ? '✓' : ''}</div>`;
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
    if (daysSince < 30 && G.displayName) {
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
    G.display_name_last_changed = Date.now();
    dom.userDisplay.textContent = name;
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
            await fbSubmitScore(name, G.lifetime_vibes, G.total_prestiges, G.total_pp_earned);
        } catch (_) {}
    }
}

function updateSettingsCooldown() {
    const lastChanged = G.display_name_last_changed || 0;
    if (!lastChanged || !G.displayName) {
        dom.settingsCooldownInfo.style.display = 'none';
        return;
    }
    const daysSince = Math.floor((Date.now() - lastChanged) / (1000 * 60 * 60 * 24));
    if (daysSince >= 30) {
        dom.settingsCooldownInfo.style.display = 'none';
        dom.settingsSaveBtn.disabled = false;
        return;
    }
    const daysLeft = 30 - daysSince;
    dom.settingsCooldownInfo.style.display = 'block';
    dom.settingsCooldownInfo.textContent = `⏳ ${daysLeft} DAY(S) UNTIL NEXT CHANGE`;
    dom.settingsSaveBtn.disabled = true;
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
function showShopTooltip(data, event) {
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
    const tt = document.getElementById('shop-tooltip-main');
    if (tt) tt.classList.add('hidden');
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
    if (!list) return;

    function stopHold() {
        if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
        if (_holdSpamTimer) { clearInterval(_holdSpamTimer); _holdSpamTimer = null; }
        _holdTarget = null;
    }

    list.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.shop-item');
        if (!item || item.classList.contains('locked')) return;
        // Only allow on main button (left click)
        if (e.button !== 0) return;

        const tierId = item.dataset.tierId;
        if (!tierId) return;

        stopHold();
        _holdTarget = item;

        // First purchase immediately on click (normal behavior)
        // But only if this wasn't already handled by the item's onclick
        // The onclick fires anyway — we just layer hold-to-spam on top

        // 500ms delay before spam starts
        _holdTimer = setTimeout(() => {
            if (_holdTarget !== item) return;
            _holdSpamTimer = setInterval(() => {
                if (!_holdTarget || _holdTarget !== item) {
                    stopHold();
                    return;
                }
                const id = _holdTarget.dataset.tierId;
                if (!id) { stopHold(); return; }
                const tier = AUTOCLICKERS.find(t => t.id === id);
                if (!tier) { stopHold(); return; }
                const count = G.autoclickers[id] || 0;
                const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
                if (G.vibes >= cost) {
                    if (buyAutoclicker(tier.id)) {
                        playPurchase();
                        updateAllUI();
                        // Update tooltip data for the item
                        updateShopItemTooltip(item, id);
                    } else {
                        stopHold(); // Can't buy anymore
                    }
                } else {
                    stopHold(); // Can't afford
                }
            }, 5);
        }, 500);
    });

    // Stop on mouseup/leave anywhere on the list
    list.addEventListener('mouseup', stopHold);
    list.addEventListener('mouseleave', stopHold);
}

function updateShopItemTooltip(item, tierId) {
    const tier = AUTOCLICKERS.find(t => t.id === tierId);
    if (!tier) return;
    const count = G.autoclickers[tierId] || 0;
    const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
    const canBuy = G.vibes >= cost;
    item._tooltipData = {
        name: tier.name,
        desc: tier.desc,
        icon: `sprites/images/icons/individual/${tier.id}_64.png`,
        stats: [
            { label: 'VPS each', value: '✦ ' + tier.vps, cls: 'cyan' },
            { label: 'Owned', value: String(count), cls: '' },
            { label: 'Cost', value: formatNumber(cost) + ' ✦', cls: canBuy ? 'green' : 'gold' }
        ]
    };
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
