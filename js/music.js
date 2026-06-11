// ============================================================
// Hermes IdleViber — MIDI Music Engine
// MIDI parsing: MidiPlayerJS (MIT) — github.com/grimmdude/MidiPlayerJS
// 8-bit synth engine: Custom GM Synthesizer
// Real public-domain MIDI files from Mutopia Project
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

// --- MIDI FILE MAP: 9 unique songs, all real public-domain MIDIs ---
// Sources: Mutopia Project (mutopiaproject.org) — CC-BY or Public Domain
// Artists attributed in game credits
const MIDI_FILES = [
    { genre: 'chill',  name: 'Gymnopedie No.1',       file: 'chill_gymnopedie_1.mid',    bpm: 72, artist: 'Erik Satie' },
    { genre: 'chill',  name: 'Gymnopedie No.2',       file: 'chill_gymnopedie_2.mid',    bpm: 76, artist: 'Erik Satie' },
    { genre: 'chill',  name: 'Gymnopedie No.3',       file: 'chill_gymnopedie_3.mid',    bpm: 70, artist: 'Erik Satie' },
    { genre: 'chill',  name: 'Arabesque No.1',        file: 'chill_arabesque_1.mid',     bpm: 85, artist: 'Claude Debussy' },
    { genre: 'chill',  name: 'Clair de Lune',         file: 'chill_clair_de_lune.mid',   bpm: 68, artist: 'Claude Debussy' },
    { genre: 'cyber',  name: 'Toccata & Fugue',       file: 'cyber_toccata_fugue.mid',   bpm: 120, artist: 'J.S. Bach' },
    { genre: 'cyber',  name: 'Fugue in G Minor',      file: 'cyber_fugue_gminor.mid',    bpm: 110, artist: 'J.S. Bach' },
    { genre: 'jazz',   name: 'The Entertainer',       file: 'jazz_entertainer.mid',      bpm: 95, artist: 'Scott Joplin' },
    { genre: 'jazz',   name: 'Maple Leaf Rag',        file: 'jazz_maple_leaf.mid',       bpm: 100, artist: 'Scott Joplin' },
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
    // Update now-playing if DOM available
    const el = document.getElementById('music-now-playing');
    if (el) el.textContent = track.name;
    const toggle = document.getElementById('music-toggle');
    if (toggle) toggle.classList.add('playing');
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
        console.log(`🎵 Now playing: ${track.name} — ${track.artist} (${track.genre})`);
    } else {
        currentDuration = 30;
        console.log(`🎵 No MIDI data for ${track.file} — using silent 30s placeholder`);
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
    const toggle = document.getElementById('music-toggle');
    if (toggle) toggle.classList.remove('playing');
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

function getCurrentArtist() {
    const t = MIDI_FILES[currentTrack] || MIDI_FILES[0];
    return t ? t.artist : '';
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
    getCurrentArtist,
    playSpecificTrack,
    MIDI_FILES,
};
