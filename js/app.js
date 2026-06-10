// ============================================================
// Hermes IdleViber — Main Application
// ============================================================

import {
    G, CONFIG, ROOMS, DECOR_ITEMS, AUTOCLICKERS, GATEWAY_UPGRADES,
    getVPS, getClickValue, getPrestigeGain, formatNumber,
    getRoomVpsMult,
    addVibes, buyAutoclicker, buyGatewayUpgrade, buyDecor,
    activateDecor, unlockRoom, switchRoom, doPrestige,
    onStateChange, saveGame, loadGame, notifyStateChange,
} from './state.js';

import { discoverGateway, pingGateway, getLatencyMultiplier,
         getConnectionQuality, getGatewayStatus, onGatewayChange,
         getAverageLatency, connectToPort } from './gateway.js';

import { generateSprite, renderRoom, ParticleSystem, PAL,
         startPlacement, cancelPlacement, updatePlacementGhost, isPlacing,
         startDrag, updateDrag, endDrag, isDragging, hitTestDecor,
         playPlacementSound, snapToGrid, getDecorSpriteId } from './sprites.js';

import { initAudio, playSong, stopSong, setGenre, nextTrack,
         toggleMusic, setVolume, getAvailableGenres, playNext,
         toggleShuffle, isShuffleOn, getCurrentSongName, MIDI_FILES } from './music.js';

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

// ---- INIT ----
function init() {
    console.log('🔥 Hermes IdleViber initializing...');
    cacheDOM();
    loadGame();
    initCanvas();
    initParticles();
    initGateway();
    initMusic();
    initUIEvents();
    initGameLoop();
    startTimers();
    updateAllUI();
    console.log('🔥 Hermes IdleViber ready!');
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
        musicGenreSelect: $('music-genre-select'),
        musicShuffleBtn: $('music-shuffle-btn'),
        musicBtn: $('music-btn'),
        musicGenreDisplay: $('music-genre'),
        musicGenreLabel: $('music-genre-label'),
        musicNextBtn: $('music-next-btn'),
        musicVolumeSlider: $('music-volume'),
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
        panelRooms: $('panel-rooms'),
        panelUpgrades: $('panel-upgrades'),
        panelPrestige: $('panel-prestige'),
        panelDecor: $('panel-decor'),
        panelGateway: $('panel-gateway'),
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
    setInterval(() => {
        if (G.gateway_bonus_active) {
            particles.add('firefly', null, null, 1);
        }
    }, 500);
}

// ---- GATEWAY ----
let gwPollerRef = null;
async function initGateway() {
    // Clear any existing poller
    if (gwPollerRef) {
        clearInterval(gwPollerRef);
        gwPollerRef = null;
    }

    // First discovery
    const result = await discoverGateway();
    updateGatewayUI();

    // Periodic check
    gwPollerRef = setInterval(async () => {
        await pingGateway();
        updateGatewayUI();
    }, CONFIG.GATEWAY_POLL_INTERVAL);

    onGatewayChange(() => updateGatewayUI());
}

// ---- MUSIC ----
function initMusic() {
    dom.musicBtn.addEventListener('click', () => {
        const playing = toggleMusic();
        dom.musicBtn.textContent = playing ? '🔊' : '🔇';
    });
    dom.musicNextBtn.addEventListener('click', nextTrack);
    dom.musicVolumeSlider.addEventListener('input', () => {
        setVolume(parseFloat(dom.musicVolumeSlider.value));
    });

    // Shuffle ON by default — show visual indicator
    dom.musicShuffleBtn.style.background = 'rgba(0,255,136,0.3)';
    dom.musicShuffleBtn.style.borderColor = '#0f0';
    dom.musicShuffleBtn.style.color = '#0f0';

    // Autoplay won't work until user gesture (click). The playSongForRoom
    // call in enterGame handles this after the user logs in.
}

// ---- UI EVENTS ----
function initUIEvents() {
    // Auth
    dom.loginBtn.addEventListener('click', doLogin);
    dom.guestBtn.addEventListener('click', doGuest);
    dom.logoutBtn.addEventListener('click', doLogout);

    // Click button
    dom.clickBtn.addEventListener('click', () => {
        const val = getClickValue();
        addVibes(val);
        G.total_clicks++;
        spawnClickFloat(val);
        dom.clickBtn.classList.add('clicked');
        setTimeout(() => dom.clickBtn.classList.remove('clicked'), 100);
    });

    // Prestige
    dom.prestigeBtn.addEventListener('click', () => {
        const gain = getPrestigeGain();
        if (gain <= 0) return;
        const msg = "Reset for " + gain + " Prestige Points?\n\nYou'll keep:\n\u2022 Prestige Points (" + (G.total_pp_earned + gain) + " total)\n\u2022 Gateway upgrades\n\nYou'll lose:\n\u2022 All vibes\n\u2022 Rooms & room VPS multipliers\n\u2022 All upgrades\n\u2022 All decor";
        showPopup('\u2728 Prestige', msg, () => {
            if (doPrestige()) {
                updateAllUI();
                showToast(`✨ Prestiged! +${gain} PP`);
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

        playPlacementSound();
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
                playPlacementSound();
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

    // Genre select
    dom.musicGenreSelect.addEventListener('change', () => {
        const genre = dom.musicGenreSelect.value;
        dom.musicGenreDisplay.textContent = genre.toUpperCase();
        if (dom.musicGenreLabel) dom.musicGenreLabel.textContent = genre.toUpperCase();
        // If ALL, just shuffle all tracks
        if (genre === 'all') {
            stopSong();
            // Refill shuffle queue with all tracks
            setTimeout(() => playNext(), 100);
        } else {
            setGenre(genre);
        }
    });

    // Shuffle toggle
    dom.musicShuffleBtn.addEventListener('click', () => {
        const on = toggleShuffle();
        dom.musicShuffleBtn.style.background = on ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,0,0.15)';
        dom.musicShuffleBtn.style.borderColor = on ? '#0f0' : '#f44';
        dom.musicShuffleBtn.style.color = on ? '#0f0' : '#f88';
        if (on) {
            showToast('🔀 Shuffle ON');
        } else {
            showToast('🔀 Shuffle OFF');
        }
    });

    // Tabs
    setupTabs();

    // State changes
    onStateChange((type) => {
        if (type === 'vibes') {
            updateResourceUI();
            updateShopAffordability(); // Lightweight: just toggles locked class
        }
        if (type === 'autoclickers' || type === 'gateway_upgrades') {
            updateResourceUI();
            updateShopUI();
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
            if (panel === dom.panelPrestige) updatePrestigeUI();
            if (panel === dom.panelDecor) updateDecorUI();
            if (panel === dom.panelGateway) updateGatewayUpgradeUI();
        });
    });
}

// ---- AUTH ----
function doLogin() {
    const username = dom.username.value.trim();
    const password = dom.password.value.trim();
    if (!username || !password) {
        dom.loginMsg.textContent = 'Enter both fields.';
        return;
    }
    G.userId = `local_${username}`;
    G.username = username;
    dom.userDisplay.textContent = username;
    enterGame();
}

function doGuest() {
    G.userId = 'local_guest';
    G.username = 'Guest';
    dom.userDisplay.textContent = 'Guest';
    enterGame();
}

function doLogout() {
    saveGame();
    clearGameLoop();
    dom.loginScreen.classList.remove('hidden');
    dom.gameScreen.classList.add('hidden');
}

function enterGame() {
    dom.loginScreen.classList.add('hidden');
    dom.gameScreen.classList.remove('hidden');
    resizeCanvas();
    loadGame();
    updateAllUI();
    initGameLoop();
    initGateway();
    // Create AudioContext synchronously during this click gesture
    initAudio();
    playSongForRoom(G.current_room);
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
    ticker = setInterval(() => {
        const vps = getVPS();
        if (vps > 0) {
            addVibes(vps / 10);
        }
        frameCount++;
        if (frameCount % 2 === 0) {
            updateCanvas();
        }
    }, CONFIG.TICK_INTERVAL);

    saver = setInterval(saveGame, CONFIG.SAVE_INTERVAL);

    // Leaderboard refresh
    lbUpdater = setInterval(updateLeaderboardUI, 15000);

    // Animation frame for canvas
    function frame() {
        const gw = getGatewayStatus();
        if (gw.connected) {
            dom.canvas.style.boxShadow = `0 0 ${20 + gw.latency < 50 ? 30 : 10}px rgba(0, 255, 136, ${0.1 + getLatencyMultiplier() * 0.05})`;
        } else {
            dom.canvas.style.boxShadow = '0 0 10px rgba(255,68,68,0.1)';
        }
        animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);
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
    // Auto-save before unload
    window.addEventListener('beforeunload', saveGame);
}

// ---- CANVAS RENDER ----
function updateCanvas() {
    const canvas = dom.canvas;
    const ctx = canvas.getContext('2d');

    // Render room background with all decor
    renderRoom(G.current_room, canvas, G);

    // Draw particles on top
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
    updateGatewayUpgradeUI();
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
    dom.ppDisplay.textContent = G.prestige_points;
    dom.lifetimeDisplay.textContent = formatNumber(G.lifetime_vibes);
    dom.prestigeCount.textContent = G.total_prestiges;
    dom.prestigeGain.textContent = gain > 0 ? `+${gain} PP available` : 'Need 1M lifetime vibes';
    dom.prestigeBtn.disabled = gain <= 0;
    dom.prestigeBtn.style.opacity = gain > 0 ? 1 : 0.5;
    if (dom.ppDisplayTotal) {
        dom.ppDisplayTotal.textContent = G.total_pp_earned;
    }
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
        el.innerHTML = `
            <div class="shop-item-icon">💻</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${tier.name}</div>
                <div class="shop-item-desc">${tier.desc} | <span style="color:#0ff">${tier.vps} VPS</span></div>
            </div>
            <div class="shop-item-right">
                <div class="shop-item-count">${count}</div>
                <div class="shop-item-cost">${formatNumber(cost)} ✦</div>
            </div>
        `;
        el.onclick = () => { if (buyAutoclicker(tier.id)) updateAllUI(); };
        dom.upgradeList.appendChild(el);
    });

    // Gateway Upgrades (in gateway tab)
    updateGatewayUpgradeUI();
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
    // Gateway upgrades
    document.querySelectorAll('#gw-upgrade-list .shop-item').forEach(el => {
        const id = el.dataset.upgId;
        if (!id) return;
        const upg = GATEWAY_UPGRADES.find(u => u.id === id);
        if (!upg) return;
        const owned = G.gateway_upgrades[id] || false;
        el.classList.toggle('locked', owned || vibes < upg.cost);
    });
    // Decor
    document.querySelectorAll('#decor-list .shop-item').forEach(el => {
        const id = el.dataset.decorId;
        if (!id) return;
        const item = DECOR_ITEMS.find(d => d.id === id);
        if (!item) return;
        const owned = G.owned_decor.includes(id);
        const canBuy = !owned && vibes >= item.cost;
        el.classList.toggle('locked', !owned ? !canBuy : false);
    });
}

function updateGatewayUpgradeUI() {
    dom.gwUpgradeList.innerHTML = '';
    GATEWAY_UPGRADES.forEach(upg => {
        const owned = G.gateway_upgrades[upg.id] || false;
        const canBuy = G.vibes >= upg.cost && !owned;
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? '' : 'locked'}`;
        el.dataset.upgId = upg.id;
        el.innerHTML = `
            <div class="shop-item-icon">${owned ? '✅' : '🔌'}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${upg.name}</div>
                <div class="shop-item-desc">${upg.desc}</div>
            </div>
            <div class="shop-item-right">
                <div class="shop-item-cost">${owned ? 'OWNED' : formatNumber(upg.cost) + ' ✦'}</div>
            </div>
        `;
        el.onclick = () => { if (canBuy && buyGatewayUpgrade(upg.id)) updateAllUI(); };
        dom.gwUpgradeList.appendChild(el);
    });
}

function updateDecorUI() {
    dom.decorList.innerHTML = '';
    DECOR_ITEMS.forEach(item => {
        const owned = G.owned_decor.includes(item.id);
        const active = G.active_decor[item.type] === item.id;
        const canBuy = G.vibes >= item.cost && !owned;
        const el = document.createElement('div');
        el.className = `shop-item ${canBuy ? '' : 'locked'} ${active ? 'active' : ''}`;
        el.dataset.decorId = item.id;
        el.innerHTML = `
            <div class="shop-item-icon">${owned ? (active ? '⭐' : '✨') : '🔒'}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.type} decor</div>
            </div>
            <div class="shop-item-right">
                ${owned ? (active ? '<span style="color:#0f0">ACTIVE</span>' : '<span style="color:#ff0">EQUIP</span>') : `<div class="shop-item-cost">${formatNumber(item.cost)} ✦</div>`}
            </div>
        `;
        el.onclick = () => {
            if (!owned) {
                if (canBuy && buyDecor(item.id)) {
                    // Enter placement mode
                    startDecorPlacement(item.id);
                    showToast(`🎯 Click on the screen to place ${item.name}`);
                    updateAllUI();
                }
            } else if (!active) {
                activateDecor(item.id);
                startDecorPlacement(item.id);
                updateAllUI();
            }
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
            <div class="room-card-bg" style="background: linear-gradient(135deg, ${room.bg[0]}, ${room.bg[1]});">
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
                playSongForRoom(room.id);
                updateAllUI();
            } else if (canUnlock) {
                if (unlockRoom(room.id)) {
                    switchRoom(room.id);
                    playSongForRoom(room.id);
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
    dom.gatewayStatus.textContent = `${quality.icon} ${quality.label}`;
    dom.gatewayStatus.style.color = quality.color;
    dom.gatewayLatency.textContent = gw.connected ? `${gw.latency.toFixed(0)}ms` : '---';
    const latMult = getLatencyMultiplier();
    dom.gatewayMult.textContent = gw.connected ? `${latMult.toFixed(1)}x` : '0x';
    dom.gatewayMult.style.color = gw.connected ? '#0f0' : '#f44';
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
        } else if (gw.lastError && gw.lastError.includes('complete')) {
            dom.gatewayScanProgress.textContent = '✅ All ports scanned — no gateway';
            dom.gatewayScanProgress.style.color = '#666';
        } else {
            dom.gatewayScanProgress.textContent = '⏸ Idle';
            dom.gatewayScanProgress.style.color = '#666';
        }
    }
}

function updateLeaderboardUI() {
    const list = dom.leaderboardList;
    list.innerHTML = '';
    // Local leaderboard with mock data for now
    const entries = [
        { name: G.username || 'You', vibes: G.lifetime_vibes, pp: G.total_pp_earned, prestige: G.total_prestiges },
        { name: 'DrGekoz', vibes: 100_000_000_000, pp: 1500, prestige: 25 },
        { name: 'Zoops', vibes: 50_000_000_000, pp: 800, prestige: 12 },
        { name: 'CipherZero', vibes: 25_000_000_000, pp: 400, prestige: 8 },
        { name: 'PixelWarden', vibes: 10_000_000_000, pp: 200, prestige: 5 },
    ];
    entries.sort((a, b) => b.vibes - a.vibes);
    entries.forEach((entry, i) => {
        const isYou = entry.name === (G.username || 'You');
        const el = document.createElement('div');
        el.className = `lb-entry ${isYou ? 'you' : ''}`;
        el.innerHTML = `
            <span class="lb-rank">#${i + 1}</span>
            <span class="lb-name">${isYou ? '⭐ ' : ''}${entry.name}</span>
            <span class="lb-vibes">${formatNumber(entry.vibes)}</span>
            <span class="lb-pp">${entry.pp} PP</span>
        `;
        list.appendChild(el);
    });
}

// ---- HELPER FUNCTIONS ----
function playSongForRoom(roomId) {
    const room = ROOMS[roomId];
    if (!room) return;
    stopSong();
    // Pick a track matching the room's genre
    const genreTracks = MIDI_FILES.filter(t => t.genre === room.musicGenre);
    if (isShuffleOn()) {
        const idx = Math.floor(Math.random() * genreTracks.length);
        if (genreTracks[idx]) playSong(genreTracks[idx].genre, genreTracks[idx].name);
    } else if (genreTracks.length > 0) {
        playSong(genreTracks[0].genre, genreTracks[0].name);
    }
    dom.musicGenreDisplay.textContent = room.musicGenre.toUpperCase();
    if (dom.musicGenreLabel) dom.musicGenreLabel.textContent = room.musicGenre.toUpperCase();
    if (dom.musicGenreSelect) dom.musicGenreSelect.value = room.musicGenre;
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
        // Stop music if it was playing
        stopSong();
    };
    skip.addEventListener('click', handler);

    // Auto-close after animation
    setTimeout(handler, 26000);
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', init);
