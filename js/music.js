// Music Player — 8-bit chiptune remixes (45 tracks)
const MUSIC_TRACKS = [
    // --- Original tracks ---
    { file: 'audio/zelda_overworld.mp3', name: 'Zelda Overworld' },
    { file: 'audio/mario_underground.mp3', name: 'Mario Underground' },
    { file: 'audio/pokemon_battle.mp3', name: 'Pokemon Battle' },
    { file: 'audio/megaman_cannon_ball.mp3', name: 'Mega Man Cannon Ball' },
    { file: 'audio/castlevania_bloody_tears.mp3', name: 'Castlevania Bloody Tears' },
    { file: 'audio/chrono_corridor_of_time.mp3', name: 'Chrono Corridor of Time' },
    { file: 'audio/street_fighter_guile.mp3', name: 'Street Fighter Guile' },
    { file: 'audio/ff7_battle.mp3', name: 'FF7 Battle Theme' },
    // --- New chiptune covers ---
    { file: 'audio/smells_like_teen_spirit.mp3', name: 'Smells Like Teen Spirit' },
    { file: 'audio/take_on_me.mp3', name: 'Take On Me' },
    { file: 'audio/eye_of_the_tiger.mp3', name: 'Eye Of The Tiger' },
    { file: 'audio/get_lucky.mp3', name: 'Get Lucky' },
    { file: 'audio/final_countdown.mp3', name: 'Final Countdown' },
    { file: 'audio/harder_better_faster.mp3', name: 'Harder Better Faster Stronger' },
    { file: 'audio/blinding_lights.mp3', name: 'Blinding Lights' },
    { file: 'audio/kiss_from_a_rose.mp3', name: 'Kiss From A Rose' },
    { file: 'audio/money.mp3', name: 'Money' },
    { file: 'audio/lose_yourself.mp3', name: 'Lose Yourself' },
    { file: 'audio/hey_ya.mp3', name: 'Hey Ya' },
    { file: 'audio/centuries.mp3', name: 'Centuries' },
    { file: 'audio/plastic_love.mp3', name: 'Plastic Love' },
    { file: 'audio/good_luck_babe.mp3', name: 'Good Luck Babe' },
    { file: 'audio/million_dollar_baby.mp3', name: 'Million Dollar Baby' },
    { file: 'audio/bye_bye_bye.mp3', name: 'Bye Bye Bye' },
    { file: 'audio/little_dark_age.mp3', name: 'Little Dark Age' },
    { file: 'audio/west_end_girls.mp3', name: 'West End Girls' },
    { file: 'audio/my_ordinary_life.mp3', name: 'My Ordinary Life' },
    { file: 'audio/any_way_you_want_it.mp3', name: 'Any Way You Want It' },
    { file: 'audio/tiny_dancer.mp3', name: 'Tiny Dancer' },
    { file: 'audio/ready_for_it.mp3', name: 'Ready For It' },
    { file: 'audio/washing_machine_heart.mp3', name: 'Washing Machine Heart' },
    { file: 'audio/beautiful_things.mp3', name: 'Beautiful Things' },
    { file: 'audio/gourmet_race.mp3', name: 'Gourmet Race' },
    { file: 'audio/battle_true_hero.mp3', name: 'Battle Against A True Hero' },
    { file: 'audio/otonoke_dandadan.mp3', name: 'Otonoke (Dandadan OP)' },
    { file: 'audio/order_ultrakill.mp3', name: 'Order (Ultrakill)' },
    { file: 'audio/rohirrim_charge.mp3', name: 'Rohirrim Charge' },
    { file: 'audio/at_dooms_gate.mp3', name: 'At Doom\'s Gate' },
    { file: 'audio/super_mario_theme.mp3', name: 'Super Mario Theme' },
    { file: 'audio/stronger_than_you.mp3', name: 'Stronger Than You' },
    { file: 'audio/naruto_silhouette.mp3', name: 'Naruto Silhouette' },
    { file: 'audio/piranha_plants.mp3', name: 'Piranha Plants On Parade' },
    { file: 'audio/tetris_theme.mp3', name: 'Tetris Theme' },
    { file: 'audio/static_flavor.mp3', name: 'Static Flavor' },
    { file: 'audio/otonoke_creepy_nuts.mp3', name: 'Otonoke (Creepy Nuts)' },
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
    const settingsVol = document.getElementById('settings-music-volume');
    if (settingsVol) settingsVol.value = vol;
    const settingsLabel = document.getElementById('settings-music-vol-label');
    if (settingsLabel) settingsLabel.textContent = Math.round(vol * 100) + '%';
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
        // Close chat if opening music
        const chatPanel = document.getElementById('chat-panel');
        if (!panel.classList.contains('hidden') && chatPanel && !chatPanel.classList.contains('hidden')) {
            chatPanel.classList.add('hidden');
        }
    });

    // ---- Track loading ----
    function loadTrack(index) {
        if (index < 0) index = MUSIC_TRACKS.length - 1;
        if (index >= MUSIC_TRACKS.length) index = 0;
        musicCurrentTrack = index;
        const track = MUSIC_TRACKS[index];
        musicAudio.src = track.file;
        trackName.textContent = track.name;
        document.title = 'Hermes IdleViber';
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
            document.title = 'Hermes IdleViber';
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
        // Keep the SVG icon, just toggle the glow and title
        btn.title = musicShuffle ? 'Shuffle ON — click to disable' : 'Shuffle OFF — click to enable';
        if (musicShuffle) {
            btn.classList.add('active');
        } else {
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
            document.title = 'Hermes IdleViber';
            saveMusicToCache();
        }).catch(() => {
            musicPlaying = false;
            playBtn.textContent = '▶';
            saveMusicToCache();
        });
    }
}

export { initMusicPlayer, setMusicVolume };
