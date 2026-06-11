// Music Player — 8-bit chiptune remixes (8 tracks)
const MUSIC_TRACKS = [
    { file: 'audio/zelda_overworld.mp3', name: 'Zelda Overworld' },
    { file: 'audio/mario_underground.mp3', name: 'Mario Underground' },
    { file: 'audio/pokemon_battle.mp3', name: 'Pokemon Battle' },
    { file: 'audio/megaman_cannon_ball.mp3', name: 'Mega Man Cannon Ball' },
    { file: 'audio/castlevania_bloody_tears.mp3', name: 'Castlevania Bloody Tears' },
    { file: 'audio/chrono_corridor_of_time.mp3', name: 'Chrono Corridor of Time' },
    { file: 'audio/street_fighter_guile.mp3', name: 'Street Fighter Guile' },
    { file: 'audio/ff7_battle.mp3', name: 'FF7 Battle Theme' },
];

const MUSIC_CACHE_KEY = 'hermes_idleviber_music';

let musicAudio = null;
let musicCurrentTrack = 0;
let musicPlaying = false;
let musicShuffle = true;
let _musicVolSlider = null;

// ---- Immediate localStorage persistence ----
function saveMusicToCache() {
    try {
        const data = {
            playing: musicPlaying,
            track: musicCurrentTrack,
            shuffle: musicShuffle,
            volume: musicAudio ? musicAudio.volume : 0.5,
            timestamp: Date.now()
        };
        localStorage.setItem(MUSIC_CACHE_KEY, JSON.stringify(data));
    } catch (_) {}
    // Also mirror to G.settings for the 30s auto-save
    if (typeof G !== 'undefined' && G.settings) {
        G.settings.music_playing = musicPlaying;
        G.settings.music_track_index = musicCurrentTrack;
        G.settings.music_shuffle = musicShuffle;
        if (musicAudio) G.settings.music_volume = musicAudio.volume;
    }
}

function loadMusicFromCache() {
    try {
        const raw = localStorage.getItem(MUSIC_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) { return null; }
}

// ---- Volume ----
function setMusicVolume(vol) {
    if (musicAudio) musicAudio.volume = vol;
    if (_musicVolSlider) _musicVolSlider.value = vol;
    // Sync settings slider
    const settingsVol = document.getElementById('settings-music-volume');
    if (settingsVol) settingsVol.value = vol;
    const settingsLabel = document.getElementById('settings-music-vol-label');
    if (settingsLabel) settingsLabel.textContent = Math.round(vol * 100) + '%';
    // Persist
    if (typeof G !== 'undefined' && G.settings) G.settings.music_volume = vol;
    saveMusicToCache();
}

// ---- Init ----
function initMusicPlayer() {
    const toggleBtn = document.getElementById('music-toggle-btn');
    const panel = document.getElementById('music-panel');
    const trackName = document.getElementById('music-track-name');
    const playBtn = document.getElementById('music-play');
    const prevBtn = document.getElementById('music-prev');
    const nextBtn = document.getElementById('music-next');
    const shuffleBtn = document.getElementById('music-shuffle');
    const volumeSlider = document.getElementById('music-volume');
    const player = document.getElementById('music-player');

    if (!toggleBtn || !panel) return;

    _musicVolSlider = volumeSlider;
    player.classList.remove('hidden');

    // Create audio element
    musicAudio = new Audio();

    // ---- Restore from cache (takes priority over G.settings) ----
    const cache = loadMusicFromCache();
    let savedVol = 0.5;
    let savedTrack = 0;
    let wasPlaying = false;

    if (cache) {
        savedVol = cache.volume != null ? cache.volume : 0.5;
        savedTrack = cache.track != null ? cache.track : 0;
        wasPlaying = cache.playing || false;
        musicShuffle = cache.shuffle != null ? cache.shuffle : true;
    } else if (typeof G !== 'undefined' && G.settings) {
        // Fallback to G.settings
        savedVol = G.settings.music_volume != null ? G.settings.music_volume : 0.5;
        savedTrack = G.settings.music_track_index != null ? G.settings.music_track_index : 0;
        wasPlaying = G.settings.music_playing || false;
        musicShuffle = G.settings.music_shuffle != null ? G.settings.music_shuffle : true;
    }

    musicAudio.volume = savedVol;
    if (volumeSlider) volumeSlider.value = savedVol;
    musicCurrentTrack = savedTrack;

    // Sync shuffle button state
    updateShuffleButton(shuffleBtn);

    // Toggle panel
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
    });

    // ---- Track loading ----
    function loadTrack(index) {
        if (index < 0) index = MUSIC_TRACKS.length - 1;
        if (index >= MUSIC_TRACKS.length) index = 0;
        musicCurrentTrack = index;
        const track = MUSIC_TRACKS[index];
        musicAudio.src = track.file;
        trackName.textContent = track.name;
        document.title = `♫ ${track.name} — Hermes IdleViber`;
        saveMusicToCache();
    }

    function playPause() {
        if (!musicAudio.src) loadTrack(musicCurrentTrack);
        if (musicPlaying) {
            musicAudio.pause();
            musicPlaying = false;
            playBtn.textContent = '▶';
            document.title = 'Hermes IdleViber';
        } else {
            musicAudio.play().catch(() => {});
            musicPlaying = true;
            playBtn.textContent = '⏸';
            trackName.textContent = MUSIC_TRACKS[musicCurrentTrack].name;
            document.title = `♫ ${MUSIC_TRACKS[musicCurrentTrack].name} — Hermes IdleViber`;
        }
        saveMusicToCache();
    }

    function nextTrack() {
        musicCurrentTrack = musicShuffle
            ? Math.floor(Math.random() * MUSIC_TRACKS.length)
            : (musicCurrentTrack + 1) % MUSIC_TRACKS.length;
        if (musicPlaying) {
            loadTrack(musicCurrentTrack);
            musicAudio.play().catch(() => {});
            trackName.textContent = MUSIC_TRACKS[musicCurrentTrack].name;
        } else {
            loadTrack(musicCurrentTrack);
        }
    }

    function prevTrack() {
        musicCurrentTrack = musicCurrentTrack - 1;
        if (musicCurrentTrack < 0) musicCurrentTrack = MUSIC_TRACKS.length - 1;
        if (musicPlaying) {
            loadTrack(musicCurrentTrack);
            musicAudio.play().catch(() => {});
        } else {
            loadTrack(musicCurrentTrack);
        }
    }

    // ---- Shuffle toggle ----
    function updateShuffleButton(btn) {
        if (!btn) return;
        if (musicShuffle) {
            btn.textContent = '🔀';
            btn.title = 'Shuffle ON — click to disable';
            btn.classList.add('active');
        } else {
            btn.textContent = '🔁';
            btn.title = 'Shuffle OFF — click to enable';
            btn.classList.remove('active');
        }
    }

    function toggleShuffle() {
        musicShuffle = !musicShuffle;
        updateShuffleButton(shuffleBtn);
        saveMusicToCache();
    }

    // ---- Event listeners ----
    playBtn.addEventListener('click', playPause);
    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);

    // Volume slider
    volumeSlider.addEventListener('input', () => {
        const vol = parseFloat(volumeSlider.value);
        musicAudio.volume = vol;
        if (typeof G !== 'undefined' && G.settings) G.settings.music_volume = vol;
        // Sync settings slider
        const settingsVol = document.getElementById('settings-music-volume');
        if (settingsVol) settingsVol.value = vol;
        const settingsLabel = document.getElementById('settings-music-vol-label');
        if (settingsLabel) settingsLabel.textContent = Math.round(vol * 100) + '%';
        saveMusicToCache();
    });

    musicAudio.addEventListener('ended', () => { nextTrack(); });
    musicAudio.addEventListener('error', () => { nextTrack(); });

    // ---- Initial load & auto-play ----
    loadTrack(musicCurrentTrack);

    if (wasPlaying && musicAudio) {
        musicAudio.play().then(() => {
            musicPlaying = true;
            playBtn.textContent = '⏸';
            trackName.textContent = MUSIC_TRACKS[musicCurrentTrack].name;
            document.title = `♫ ${MUSIC_TRACKS[musicCurrentTrack].name} — Hermes IdleViber`;
            saveMusicToCache();
        }).catch(() => {
            musicPlaying = false;
            playBtn.textContent = '▶';
            saveMusicToCache();
        });
    }
}

export { initMusicPlayer, setMusicVolume };
