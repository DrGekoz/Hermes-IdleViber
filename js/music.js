// ============================================================
// Hermes IdleViber — MIDI Music Engine
// Fixed: unique MIDI files per song, proper AudioContext init
// ============================================================

import { MidiParser, MidiPlayer } from './midi_player.js';

let midiPlayer = new MidiPlayer();
let midiParser = new MidiParser();
let currentSong = null;
let currentGenre = 'chill';
let currentTrack = 0;
let isPlaying = false;
let musicVolume = 0.5;
let loopCount = 0;
let shuffleEnabled = true;
let shuffleQueue = [];
let timerId = null;
let currentDuration = 0;

const PLAYS_BEFORE_ADVANCE = 5;

// --- MIDI FILE MAP: 9 unique songs, 1 file per entry ---
const MIDI_FILES = [
    { genre: 'chill',  name: 'Campfire Dreams',    file: 'chill_campfire_dreams.mid',   bpm: 80 },
    { genre: 'chill',  name: 'Starlight Waltz',    file: 'chill_starlight_waltz.mid',   bpm: 72 },
    { genre: 'chill',  name: 'Midnight Embers',    file: 'chill_midnight_embers.mid',   bpm: 68 },
    { genre: 'chill',  name: 'Sunlit Grove',       file: 'chill_sunlit_grove.mid',      bpm: 88 },
    { genre: 'chill',  name: 'Cozy Hearth',        file: 'chill_cozy_hearth.mid',       bpm: 72 },
    { genre: 'cyber',  name: 'Neon Pulse',         file: 'cyber_neon_pulse.mid',        bpm: 110 },
    { genre: 'cyber',  name: 'Digital Rain',       file: 'cyber_digital_rain.mid',      bpm: 115 },
    { genre: 'jazz',   name: 'Moonlit Swing',      file: 'jazz_moonlit_swing.mid',      bpm: 95 },
    { genre: 'nature', name: 'Forest Breath',      file: 'nature_forest_breath.mid',    bpm: 65 },
];

// Cache for loaded MIDI data
const midiCache = {};

async function loadMidi(fileName) {
    if (midiCache[fileName]) return midiCache[fileName];
    try {
        const url = `midi/${fileName}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const data = midiParser.parse(buffer);
        midiCache[fileName] = data;
        console.log(`🎵 MIDI loaded: ${fileName} (${buffer.byteLength}B, ${data.bpm}BPM, ${data.tracks.length} track(s))`);
        return data;
    } catch (e) {
        console.warn(`MIDI load failed: ${fileName} — ${e.message}`);
        return null;
    }
}

function getTracksForGenre(genre) {
    if (genre === 'all') return MIDI_FILES;
    return MIDI_FILES.filter(t => t.genre === genre);
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function refillQueue(genre) {
    const tracks = getTracksForGenre(genre);
    shuffleQueue = shuffleEnabled ? shuffle(tracks) : [...tracks];
}

function getNextTrack() {
    if (shuffleQueue.length === 0) refillQueue(currentGenre);
    return shuffleQueue.shift() || null;
}

async function playNext() {
    const track = getNextTrack();
    if (!track) return;
    await playSong(track.genre, track.name);
}

async function playSong(genre, trackName, isReplay = false) {
    // Ensure AudioContext is ready BEFORE scheduling notes
    await midiPlayer.ensureReady();

    // Find track by genre + name
    let track;
    if (trackName && typeof trackName === 'string') {
        track = MIDI_FILES.find(t => t.genre === genre && t.name === trackName);
    }
    if (!track) {
        const tracks = getTracksForGenre(genre || currentGenre);
        track = tracks[currentTrack] || tracks[0] || MIDI_FILES[0];
    }

    if (!track) return;

    currentGenre = track.genre;
    currentTrack = MIDI_FILES.indexOf(track);
    isPlaying = true;

    if (!isReplay) loopCount = 0;

    // Load and play MIDI
    const midiData = await loadMidi(track.file);
    if (midiData) {
        currentDuration = midiPlayer.play(midiData);
        setVolume(musicVolume);
        console.log(`🎵 Now playing: ${track.name} (${track.genre}, ${track.bpm}BPM)`);
    } else {
        currentDuration = 30;
        console.log(`🎵 No MIDI data for ${track.name} — using silent 30s placeholder`);
    }

    // Schedule next loop/advance
    const songDuration = Math.max(currentDuration || 30, 15) * 1000;
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
        if (!isPlaying) return;
        loopCount++;
        if (loopCount >= PLAYS_BEFORE_ADVANCE) {
            playNext();
        } else {
            playSong(currentGenre, track.name, true);
        }
    }, songDuration);
}

function stopSong() {
    isPlaying = false;
    midiPlayer.stop();
    if (timerId) { clearTimeout(timerId); timerId = null; }
}

async function initAudio() {
    await midiPlayer.ensureReady();
}

function setVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    midiPlayer.setVolume(musicVolume);
}

function setGenre(genre) {
    if (genre === 'all' || MIDI_FILES.some(t => t.genre === genre)) {
        if (genre === 'all') refillQueue('all');
        currentGenre = genre;
        if (isPlaying) {
            stopSong();
            setTimeout(() => playNext(), 100);
        }
    }
}

async function playSpecificTrack(genre, trackName) {
    await playSong(genre, trackName);
}

function nextTrack() {
    stopSong();
    setTimeout(() => playNext(), 50);
}

function toggleMusic() {
    if (isPlaying) { stopSong(); return false; }
    else { playSong(currentGenre); return true; }
}

function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    return shuffleEnabled;
}

function isShuffleOn() { return shuffleEnabled; }

function getCurrentSongName() {
    const t = MIDI_FILES[currentTrack] || MIDI_FILES[0];
    return t ? t.name : 'Unknown';
}

function getAvailableGenres() {
    return ['all', ...new Set(MIDI_FILES.map(t => t.genre))];
}

export {
    initAudio,
    playSong,
    stopSong,
    setGenre,
    nextTrack,
    playNext,
    toggleMusic,
    setVolume,
    getAvailableGenres,
    toggleShuffle,
    isShuffleOn,
    getCurrentSongName,
    playSpecificTrack,
    MIDI_FILES,
};
