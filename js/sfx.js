// ============================================================
// Hermes IdleViber — 8-bit Sound Effects Engine
// Programmatic chiptune sounds via Web Audio API
// All open source / public domain (generated at runtime)
// ============================================================

let _ctx = null;
let _volume = 0.5;

// Lazy AudioContext init (unlock on first user gesture)
function getCtx() {
    if (!_ctx) {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') {
        _ctx.resume().catch(() => {});
    }
    return _ctx;
}

function setVolume(vol) {
    _volume = Math.max(0, Math.min(1, vol));
}

function getVolume() {
    return _volume;
}

// ---- CHIPTUNE NOTE HELPERS ----
function playNote(freq, duration, type, gain, dest) {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    env.gain.setValueAtTime(gain * _volume, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(env);
    env.connect(dest || ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, gain, dest) {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain * _volume, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(env);
    env.connect(dest || ctx.destination);
    source.start(ctx.currentTime);
}

// ---- SFX: UI Click (short blip) ----
function playClick() {
    playNote(880, 0.06, 'square', 0.15);
}

// ---- SFX: VIBE Button (satisfying coin ding) ----
function playVibe() {
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Two-note ascending chime
    [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.04);
        env.gain.setValueAtTime(0.2 * _volume, t + i * 0.04);
        env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.1);
        osc.connect(env);
        env.connect(ctx.destination);
        osc.start(t + i * 0.04);
        osc.stop(t + i * 0.04 + 0.12);
    });
    // Sparkle high harmonics
    [1760, 2640].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.03);
        env.gain.setValueAtTime(0.06 * _volume, t + i * 0.03);
        env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.06);
        osc.connect(env);
        env.connect(ctx.destination);
        osc.start(t + i * 0.03);
        osc.stop(t + i * 0.03 + 0.08);
    });
}

// ---- SFX: Prestige (grand fanfare) ----
function playPrestige() {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.12);
        env.gain.setValueAtTime(0.25 * _volume, t + i * 0.12);
        env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
        osc.connect(env);
        env.connect(ctx.destination);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.35);
    });
    // Celebration sparkle
    setTimeout(() => {
        for (let i = 0; i < 3; i++) {
            playNote(1200 + Math.random() * 800, 0.08, 'sine', 0.08);
        }
    }, 350);
}

// ---- SFX: Unlock (ascending chime) ----
function playUnlock() {
    const ctx = getCtx();
    const t = ctx.currentTime;
    [660, 880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        env.gain.setValueAtTime(0.18 * _volume, t + i * 0.08);
        env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
        osc.connect(env);
        env.connect(ctx.destination);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.18);
    });
}

// ---- SFX: Error / Denied (buzz) ----
function playError() {
    playNote(120, 0.12, 'sawtooth', 0.15);
    setTimeout(() => playNote(90, 0.08, 'sawtooth', 0.12), 100);
}

// ---- SFX: Tab Switch (soft tap) ----
function playTabSwitch() {
    playNote(660, 0.04, 'square', 0.08);
}

// ---- SFX: Purchase / Buy (quick blip) ----
function playPurchase() {
    playNote(1100, 0.05, 'square', 0.12);
    setTimeout(() => playNote(1320, 0.05, 'square', 0.1), 60);
}

// ---- SFX: Popup / Notification ----
function playNotification() {
    playNote(1400, 0.08, 'sine', 0.1);
    playNote(1800, 0.06, 'sine', 0.07);
}

// ---- SFX: Placed Decor ----
function playPlace() {
    const ctx = getCtx();
    const t = ctx.currentTime;
    playNote(500, 0.05, 'triangle', 0.1);
    playNote(600, 0.05, 'triangle', 0.08);
}

// ---- SFX: Chat Typing (soft click) ----
function playChatTyping() {
    playNote(400, 0.03, 'sine', 0.04);
}

// ---- SFX: Chat Sent (pop) ----
function playChatSend() {
    playNote(880, 0.06, 'sine', 0.12);
    setTimeout(() => playNote(1100, 0.04, 'sine', 0.08), 50);
}

// ---- SFX: Chat Received (gentle chime) ----
function playChatReceive() {
    const ctx = getCtx();
    const t = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);
        env.gain.setValueAtTime(0.08 * _volume, t + i * 0.06);
        env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.08);
        osc.connect(env);
        env.connect(ctx.destination);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.1);
    });
}

export {
    setVolume, getVolume,
    playClick,
    playVibe,
    playPrestige,
    playError,
    playUnlock,
    playTabSwitch,
    playPurchase,
    playNotification,
    playPlace,
    playChatTyping,
    playChatSend,
    playChatReceive,
};
