// ============================================================
// Hermes IdleViber — MIDI Parser (Powered by MidiPlayerJS)
// + Web Audio Synthesizer (8-bit GM Sound Engine)
// ============================================================
// MIDI parsing: MidiPlayerJS (MIT) — github.com/grimmdude/MidiPlayerJS
// Synthesis engine: Custom 8-bit GM synthesizer
// ============================================================

import MidiPlayerJS from './lib/midi-player-js.js';

// --- MIDI PARSER (wraps MidiPlayerJS) ---
class MidiParser {
    parse(buffer) {
        const player = new MidiPlayerJS.Player();
        player.loadArrayBuffer(buffer);

        // Get parsed events (populated by dryRun inside fileLoaded)
        const allTrackEvents = player.getEvents();   // Array of arrays (one per track)
        const division = player.division;
        const format = player.format;
        const numTracks = player.tracks.length;

        // Build ticks-to-seconds conversion
        const tempoMap = player.tempoMap || [{ tick: 0, tempo: 120 }];
        const defaultBpm = tempoMap[0].tempo;
        const ticksPerQuarter = division;
        const secondsPerTick = 60.0 / (defaultBpm * ticksPerQuarter);

        // Convert MidiPlayerJS events to our internal format
        const tracks = [];
        let bpm = defaultBpm;
        let totalDurationTicks = 0;

        for (let t = 0; t < allTrackEvents.length; t++) {
            const rawEvents = allTrackEvents[t] || [];
            const ourEvents = [];

            for (const ev of rawEvents) {
                // MidiPlayerJS channels are 1-indexed; ours are 0-indexed
                const channel = (ev.channel || 1) - 1;
                const tick = ev.tick || 0;

                if (tick > totalDurationTicks) totalDurationTicks = tick;

                switch (ev.name) {
                    case 'Note on':
                        ourEvents.push({
                            ticks: tick,
                            type: 'noteOn',
                            channel,
                            note: ev.noteNumber,
                            velocity: ev.velocity || 80,
                        });
                        break;

                    case 'Note off':
                        ourEvents.push({
                            ticks: tick,
                            type: 'noteOff',
                            channel,
                            note: ev.noteNumber,
                            velocity: ev.velocity || 0,
                        });
                        break;

                    case 'Program Change':
                        ourEvents.push({
                            ticks: tick,
                            type: 'program',
                            channel,
                            program: ev.value || 0,
                        });
                        break;

                    case 'Controller Change':
                        ourEvents.push({
                            ticks: tick,
                            type: 'cc',
                            channel,
                            controller: ev.number || 0,
                            value: ev.value || 0,
                        });
                        break;

                    case 'Pitch Bend':
                        ourEvents.push({
                            ticks: tick,
                            type: 'pitchBend',
                            channel,
                            value: ev.value || 8192,
                        });
                        break;

                    case 'Set Tempo':
                        // MidiPlayerJS already converts to BPM
                        bpm = ev.data || defaultBpm;
                        ourEvents.push({
                            ticks: tick,
                            type: 'tempo',
                            tempo: bpm,
                            bpm: bpm,
                        });
                        break;
                }
            }

            tracks.push(ourEvents);
        }

        const duration = totalDurationTicks * secondsPerTick;

        return {
            format,
            numTracks,
            ticksPerQuarter,
            bpm,
            tracks,
            duration: Math.max(duration, 15),
            secondsPerTick,
        };
    }
}

// ============================================================
// MIDI SYNTHESIZER — General MIDI Sound Engine (8-bit style)
// All 128 GM programs mapped with ADSR envelopes, filters, FX
// ============================================================

// GM Program → synthesis profile
const GM_PROFILES = {
    // Pianos (0-7)
    0:  { name: 'Piano',     type: 'piano',     ops: ['sine','sine','sine'],    detune: [0,4,-4],   adsr: {a:0.003,d:0.3,s:0.35,r:0.6},  filt: null },
    1:  { name: 'BrightPno', type: 'piano',     ops: ['sine','sine','sine'],    detune: [0,7,-7],   adsr: {a:0.003,d:0.25,s:0.3,r:0.5},  filt: {f:8000,Q:1} },
    2:  { name: 'ElecPno',   type: 'epiano',    ops: ['sine','sine','triangle'],detune: [0,12,0],   adsr: {a:0.005,d:0.2,s:0.4,r:0.4},  filt: {f:4000,Q:2} },
    3:  { name: 'Harpsi',    type: 'pluck',     ops: ['square','sawtooth'],     detune: [0,12],     adsr: {a:0.002,d:0.15,s:0,r:0.3},    filt: {f:3000,Q:3} },

    // Organ (16-23)
    16: { name: 'Organ',     type: 'organ',     ops: ['sine','sine','sine'],    detune: [0,0,0],    harmonics: [1,0.5,0.3],                adsr: {a:0.01,d:0.05,s:0.9,r:0.2},filt: null },
    17: { name: 'PercOrg',   type: 'organ',     ops: ['sine','sine','sine'],    detune: [0,0,0],    harmonics: [1,0.6,0.2],                adsr: {a:0.001,d:0.1,s:0.8,r:0.15},filt: null },
    18: { name: 'RockOrg',   type: 'organ',     ops: ['sawtooth','square','sine'],detune: [0,7,0],  adsr: {a:0.005,d:0.05,s:0.9,r:0.15}, filt: null },

    // Guitar (24-31)
    24: { name: 'NylonGtr',  type: 'pluck',     ops: ['sine','triangle'],       detune: [0,12],     adsr: {a:0.002,d:0.2,s:0,r:0.4},     filt: {f:5000,Q:1} },
    25: { name: 'SteelGtr',  type: 'pluck',     ops: ['sine','sawtooth'],       detune: [0,7],      adsr: {a:0.002,d:0.2,s:0,r:0.3},     filt: {f:6000,Q:1} },
    26: { name: 'JazzGtr',   type: 'pluck',     ops: ['sine','sine'],           detune: [0,5],      adsr: {a:0.003,d:0.25,s:0,r:0.35},   filt: {f:4000,Q:2} },

    // Bass (32-39)
    32: { name: 'AcoBass',   type: 'bass',      ops: ['triangle','sawtooth'],   detune: [0,-12],    adsr: {a:0.008,d:0.15,s:0.4,r:0.3},  filt: {f:800,Q:2} },
    33: { name: 'ElecBass',  type: 'bass',      ops: ['square','sawtooth'],     detune: [0,-5],     adsr: {a:0.005,d:0.1,s:0.5,r:0.3},   filt: {f:600,Q:3} },
    34: { name: 'SlapBass',  type: 'bass',      ops: ['sawtooth','sine'],       detune: [0,-7],     adsr: {a:0.002,d:0.08,s:0.2,r:0.25}, filt: {f:1500,Q:2} },
    35: { name: 'FretBass',  type: 'bass',      ops: ['square','sine'],         detune: [0,-12],    adsr: {a:0.005,d:0.1,s:0.3,r:0.25},  filt: {f:500,Q:3} },
    36: { name: 'PickBass',  type: 'bass',      ops: ['sawtooth','square'],     detune: [0,-5],     adsr: {a:0.003,d:0.12,s:0.35,r:0.3}, filt: {f:1000,Q:2} },

    // Strings (48-51)
    48: { name: 'Strings',   type: 'pad',       ops: ['sawtooth','sawtooth','sawtooth'],detune: [0,-8,8],adsr:{a:0.08,d:0.5,s:0.6,r:1.2},  filt: {f:4000,Q:1},  reverb:0.4 },
    49: { name: 'SlowStr',   type: 'pad',       ops: ['sawtooth','triangle','sawtooth'],detune: [0,-12,12],adsr:{a:0.2,d:0.6,s:0.7,r:1.5},filt: {f:3000,Q:1},  reverb:0.5 },
    50: { name: 'SynStr',    type: 'pad',       ops: ['sawtooth','sawtooth'],   detune: [0,7],      adsr: {a:0.05,d:0.4,s:0.5,r:0.8},   filt: {f:5000,Q:2},  reverb:0.3 },

    // Brass (56-63)
    56: { name: 'Trumpet',   type: 'brass',     ops: ['sawtooth','sine'],       detune: [0,0],      adsr: {a:0.02,d:0.2,s:0.7,r:0.4},   filt: {f:3000,Q:2} },
    57: { name: 'Trombone',  type: 'brass',     ops: ['sawtooth','sine'],       detune: [0,0],      adsr: {a:0.03,d:0.2,s:0.6,r:0.4},   filt: {f:2000,Q:2} },
    58: { name: 'Tuba',      type: 'brass',     ops: ['sine','triangle'],       detune: [0,-12],    adsr: {a:0.04,d:0.2,s:0.5,r:0.5},   filt: {f:500,Q:2} },

    // Reed (65-71)
    65: { name: 'SopranoSax',type: 'reed',      ops: ['sawtooth','sine'],       detune: [0,5],      adsr: {a:0.02,d:0.15,s:0.6,r:0.35}, filt: {f:2000,Q:3} },
    66: { name: 'AltoSax',   type: 'reed',       ops: ['sawtooth','sine'],       detune: [0,0],      adsr: {a:0.02,d:0.2,s:0.5,r:0.4},   filt: {f:1500,Q:3} },
    67: { name: 'TenorSax',  type: 'reed',       ops: ['sawtooth','sine'],       detune: [0,-5],     adsr: {a:0.025,d:0.2,s:0.5,r:0.4},  filt: {f:1200,Q:3} },
    71: { name: 'Clarinet',  type: 'reed',       ops: ['sine','triangle'],       detune: [0,0],      adsr: {a:0.03,d:0.2,s:0.5,r:0.35},  filt: {f:2500,Q:2} },

    // Pipe (72-79)
    72: { name: 'Flute',     type: 'flute',     ops: ['sine','triangle'],       detune: [0,0],      adsr: {a:0.04,d:0.2,s:0.5,r:0.4},   filt: {f:4000,Q:1} },
    73: { name: 'Recorder',  type: 'flute',     ops: ['sine','sine'],           detune: [0,12],     adsr: {a:0.02,d:0.15,s:0.4,r:0.3},  filt: {f:3000,Q:2} },

    // Synth Leads (80-87)
    80: { name: 'LeadSaw',   type: 'lead',      ops: ['sawtooth','sawtooth'],   detune: [0,5],      adsr: {a:0.005,d:0.1,s:0.7,r:0.3},  filt: {f:5000,Q:1},  reverb:0.15 },
    81: { name: 'LeadSaw2',  type: 'lead',      ops: ['sawtooth','square'],      detune: [0,7],      adsr: {a:0.005,d:0.15,s:0.6,r:0.3}, filt: {f:6000,Q:1},  reverb:0.15 },
    82: { name: 'LeadCalliope',type: 'lead',    ops: ['sine','sine'],           detune: [0,12],     adsr: {a:0.01,d:0.15,s:0.5,r:0.35}, filt: null,          reverb:0.2 },
    83: { name: 'LeadChiff', type: 'lead',      ops: ['square','triangle'],      detune: [0,0],      adsr: {a:0.008,d:0.12,s:0.5,r:0.3}, filt: {f:4000,Q:2} },
    85: { name: 'LeadCharang',type: 'lead',     ops: ['sawtooth','square'],     detune: [0,10],     adsr: {a:0.003,d:0.1,s:0.7,r:0.25}, filt: {f:7000,Q:1} },

    // Synth Pads (88-95)
    88: { name: 'PadFantasia',type: 'pad',      ops: ['sawtooth','sawtooth','sawtooth'],detune:[0,-10,10],adsr:{a:0.3,d:0.4,s:0.7,r:1.0},filt:{f:3000,Q:1}, reverb:0.5 },
    89: { name: 'PadWarm',   type: 'pad',       ops: ['sine','triangle','sine'],detune: [0,-7,7],   adsr: {a:0.15,d:0.5,s:0.6,r:1.0},  filt: {f:2000,Q:1},  reverb:0.4 },
    90: { name: 'PadPolySynth',type:'pad',      ops: ['sawtooth','sawtooth'],   detune: [0,-5],     adsr: {a:0.1,d:0.3,s:0.5,r:0.8},   filt: {f:4000,Q:2},  reverb:0.35 },
    91: { name: 'PadSpace',  type: 'pad',       ops: ['sine','sawtooth','triangle'],detune:[0,-12,12],adsr:{a:0.4,d:0.5,s:0.6,r:1.5},filt:{f:2500,Q:1},reverb:0.6 },
    92: { name: 'PadBowed',  type: 'pad',       ops: ['sawtooth','sawtooth','sawtooth'],detune:[0,-5,5],adsr:{a:0.2,d:0.4,s:0.5,r:1.2},filt:{f:3500,Q:1},reverb:0.45 },

    // FX (96-103)
    96: { name: 'FXIceRain',  type: 'fx',      ops: ['sine','sine'],           detune: [0,24],     adsr: {a:0.1,d:0.3,s:0,r:0.8},     filt: {f:8000,Q:4},  reverb:0.6 },
    97: { name: 'FXSoundtrack',type:'pad',     ops: ['sawtooth','sine'],       detune: [0,0],      adsr: {a:0.3,d:0.5,s:0.4,r:1.5},   filt: {f:1500,Q:2},  reverb:0.7 },

    // Percussive (112-127)
    112: { name: 'TinkleBell', type: 'bell',    ops: ['sine','sine'],           detune: [0,24],     adsr: {a:0.001,d:0.5,s:0,r:0.8},   filt: null,          reverb:0.3 },
    113: { name: 'Agogo',     type: 'bell',     ops: ['sine','sine'],           detune: [0,0],      adsr: {a:0.001,d:0.2,s:0,r:0.3},   filt: {f:4000,Q:5} },
    114: { name: 'SteelDrums',type: 'bell',     ops: ['sine','sine'],           detune: [0,7],      adsr: {a:0.001,d:0.3,s:0,r:0.5},   filt: {f:5000,Q:3},  reverb:0.2 },
    115: { name: 'Woodblock', type: 'perc',     ops: ['square','sine'],         detune: [0,0],      adsr: {a:0.001,d:0.05,s:0,r:0.08},  filt: {f:3000,Q:2} },
    118: { name: 'MelodicTom',type: 'perc',     ops: ['sine','triangle'],       detune: [0,0],      adsr: {a:0.002,d:0.15,s:0,r:0.2},  filt: {f:1500,Q:2} },
};

// Default profile fallback
function getProfile(program) {
    return GM_PROFILES[program] || {
        name: 'Default',
        type: 'lead',
        ops: ['square'],
        detune: [0],
        adsr: { a: 0.005, d: 0.1, s: 0.5, r: 0.3 },
        filt: null,
        reverb: 0.1,
    };
}

// --- GM Drum Map (channel 9 / program 128) ---
const DRUM_MAP = {
    35: { name: 'Kick',     type: 'kick',    pitch: 60 },  // Acoustic Bass Drum
    36: { name: 'Kick',     type: 'kick',    pitch: 60 },  // Bass Drum 1
    37: { name: 'Rim',      type: 'rim',     pitch: 77 },
    38: { name: 'Snare',    type: 'snare',   pitch: 72 },
    39: { name: 'Clap',     type: 'clap',    pitch: 0 },
    40: { name: 'Snare',    type: 'snare',   pitch: 66 },
    41: { name: 'TomLow',   type: 'tom',     pitch: 55 },
    42: { name: 'HHClosed', type: 'hhc',     pitch: 0 },
    43: { name: 'TomMid',   type: 'tom',     pitch: 60 },
    44: { name: 'HHPedal',  type: 'hhc',     pitch: 0 },
    45: { name: 'TomHigh',  type: 'tom',     pitch: 65 },
    46: { name: 'HHOpen',   type: 'hho',     pitch: 0 },
    47: { name: 'TomLow2',  type: 'tom',     pitch: 55 },
    48: { name: 'TomMid2',  type: 'tom',     pitch: 61 },
    49: { name: 'Crash',    type: 'crash',   pitch: 0 },
    50: { name: 'TomHigh2', type: 'tom',     pitch: 67 },
    51: { name: 'Ride',     type: 'ride',    pitch: 0 },
    52: { name: 'China',    type: 'crash',   pitch: 0 },
    53: { name: 'RideBell', type: 'bell',    pitch: 72 },
    54: { name: 'Tamb',     type: 'tamb',    pitch: 0 },
    56: { name: 'Cowbell',  type: 'cowbell', pitch: 0 },
    57: { name: 'Crash2',   type: 'crash',   pitch: 0 },
    59: { name: 'Ride2',    type: 'ride',    pitch: 0 },
    66: { name: 'CongaLow', type: 'conga',   pitch: 55 },
    67: { name: 'CongaHigh',type: 'conga',   pitch: 65 },
    68: { name: 'TimbaleLow',type:'timbale', pitch: 57 },
    69: { name: 'TimbaleHigh',type:'timbale',pitch: 66 },
};

// ============================================================
// MIDI PLAYER — Web Audio Synthesizer
// ============================================================

class MidiPlayer {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.reverbNode = null;
        this.delayNode = null;
        this._allNodes = [];       // Track all created nodes
        this._scheduledStopTime = 0;
        this._channels = [];       // Per-channel state: program, volume, pitch bend
        this._initChannels();
        this.isPlaying = false;
    }

    _initChannels() {
        this._channels = [];
        for (let i = 0; i < 16; i++) {
            this._channels.push({
                program: 0,          // Default piano
                volume: 100,
                pan: 64,
                expression: 127,
                pitchBend: 0,
                pitchBendRange: 2,
                modWheel: 0,
                reverbSend: 40,
            });
        }
        // Channel 9 (drums) defaults to program 128 (drums)
        this._channels[9].program = 128;
    }

    async ensureReady() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._buildFXChain();
        }
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        return this.ctx;
    }

    _buildFXChain() {
        const ctx = this.ctx;

        // Master gain
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(ctx.destination);

        // --- Reverb ---
        this.reverbNode = ctx.createConvolver();
        this._buildReverbIR(ctx, 2.0, 0.6); // 2s decay, 60% mix ready
        this.reverbGain = ctx.createGain();
        this.reverbGain.gain.value = 0.35;  // Reverb wet level
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);

        // --- Stereo Delay ---
        this.delayNode = ctx.createDelay(1.0);
        this.delayNode.delayTime.value = 0.18;
        this.delayFeedback = ctx.createGain();
        this.delayFeedback.gain.value = 0.2;
        this.delayDryGain = ctx.createGain();
        this.delayDryGain.gain.value = 0.0; // Don't send dry through delay
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayWetGain = ctx.createGain();
        this.delayWetGain.gain.value = 0.15;
        this.delayNode.connect(this.delayWetGain);
        this.delayWetGain.connect(this.masterGain);

        this._allNodes.push(this.masterGain, this.reverbNode, this.reverbGain,
                            this.delayNode, this.delayFeedback, this.delayDryGain, this.delayWetGain);
    }

    _buildReverbIR(ctx, duration, decay) {
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const env = Math.exp(-t * decay * 3) * (1 - Math.random() * 0.6);
            // Stereo diffusion
            left[i] = (Math.random() * 2 - 1) * env * 0.8;
            right[i] = (Math.random() * 2 - 1) * env * 0.8;
            // Early reflections
            if (i < sampleRate * 0.03) {
                left[i] += Math.random() * 0.3;
                right[i] += Math.random() * 0.3;
            }
        }
        this.reverbNode.buffer = impulse;
    }

    // ---- MAIN PLAY ENTRY ----
    play(midiData) {
        this.stop(false);

        if (!this.ctx || !midiData || !midiData.tracks) {
            console.warn('MidiPlayer: no data to play');
            return 30;
        }

        this.isPlaying = true;
        this._initChannels();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Merge all tracks into one sorted event list
        const allEvents = [];
        for (const track of midiData.tracks) {
            for (const ev of track) {
                allEvents.push(ev);
            }
        }
        allEvents.sort((a, b) => a.ticks - b.ticks);

        // Schedule everything
        for (const ev of allEvents) {
            const time = now + ev.ticks * midiData.secondsPerTick;

            switch (ev.type) {
                case 'noteOn':
                    this._scheduleNoteOn(ctx, time, ev);
                    break;
                case 'noteOff':
                    this._scheduleNoteOff(ctx, time, ev);
                    break;
                case 'program':
                    this._channels[ev.channel].program = ev.program;
                    break;
                case 'cc':
                    this._handleCC(ev.channel, ev.controller, ev.value);
                    break;
                case 'pitchBend':
                    this._channels[ev.channel].pitchBend = ev.value;
                    break;
                case 'tempo':
                    // Already handled during parse
                    break;
            }
        }

        const duration = Math.max(midiData.duration || 30, 15);
        this._scheduledStopTime = now + duration + 2; // Extra tail for reverb
        return duration;
    }

    _handleCC(channel, controller, value) {
        const ch = this._channels[channel];
        switch (controller) {
            case 7:  ch.volume = value; break;
            case 10: ch.pan = value; break;
            case 11: ch.expression = value; break;
            case 91: ch.reverbSend = value; break;
            case 1:  ch.modWheel = value; break;
        }
    }

    _scheduleNoteOn(ctx, time, ev) {
        const ch = ev.channel;
        const channel = this._channels[ch];

        // If drum channel (9), use drum synthesis
        if (ch === 9 || channel.program === 128) {
            this._playDrum(ctx, time, ev.note, ev.velocity);
            return;
        }

        const profile = getProfile(channel.program);
        const freq = 440 * Math.pow(2, (ev.note - 69) / 12);

        // PB amount
        const pbAmount = (channel.pitchBend - 8192) / 8192;

        // Create each oscillator based on profile
        const voiceGroup = [];

        for (let i = 0; i < profile.ops.length; i++) {
            const oscType = profile.ops[i];
            const detune = profile.detune[i] || 0;

            const osc = ctx.createOscillator();
            osc.type = oscType;

            // Frequency with pitch bend and detune
            const noteFreq = freq * Math.pow(2, detune / 12);
            osc.frequency.setValueAtTime(noteFreq, time);

            // Pitch bend (ramp from 0 to target since we schedule at exact time)
            if (pbAmount !== 0) {
                const bendSemitones = pbAmount * channel.pitchBendRange;
                const bendTarget = noteFreq * Math.pow(2, bendSemitones / 12);
                osc.frequency.setValueAtTime(noteFreq, time);
                osc.frequency.linearRampToValueAtTime(bendTarget, time + 0.005);
            }

            // Oscillator gain (amplitude envelope)
            const gainNode = ctx.createGain();
            const adsr = profile.adsr;

            // ADSR envelope
            const vel = Math.min(1, ev.velocity / 127);
            const volScale = channel.volume / 127 * channel.expression / 127;
            const volume = vel * volScale * 0.5;

            // For "pluck" type, or any profile where sustain is 0 (like bell/tinkle), use fast decay to 0
            if (profile.type === 'pluck' || adsr.s <= 0) {
                gainNode.gain.setValueAtTime(0, time);
                gainNode.gain.linearRampToValueAtTime(volume, time + adsr.a);
                gainNode.gain.exponentialRampToValueAtTime(0.001, time + adsr.a + adsr.d + adsr.r);
            } else {
                // Standard ADSR
                gainNode.gain.setValueAtTime(0, time);
                gainNode.gain.linearRampToValueAtTime(volume, time + adsr.a);
                gainNode.gain.setValueAtTime(volume, time + adsr.a);
                gainNode.gain.linearRampToValueAtTime(volume * adsr.s, time + adsr.a + adsr.d);
                // Sustain until note off — we'll schedule release in noteOff
                gainNode.gain.setValueAtTime(volume * adsr.s, time + adsr.a + adsr.d);
            }

            // Filter
            let filterNode = null;
            if (profile.filt) {
                filterNode = ctx.createBiquadFilter();
                filterNode.type = 'lowpass';
                filterNode.frequency.setValueAtTime(profile.filt.f, time);
                filterNode.Q.setValueAtTime(profile.filt.Q || 1, time);
                filterNode.frequency.linearRampToValueAtTime(profile.filt.f * 1.5, time + 0.1);
            }

            // Reverb send
            const reverbAmt = profile.reverb || 0;
            let reverbSendNode = null;
            if (reverbAmt > 0 && this.reverbNode) {
                reverbSendNode = ctx.createGain();
                reverbSendNode.gain.value = reverbAmt * 0.5;
            }

            // Connect chain
            let output = gainNode;
            if (filterNode) {
                gainNode.connect(filterNode);
                output = filterNode;
            }

            osc.connect(gainNode);
            output.connect(this.masterGain);

            if (reverbSendNode) {
                output.connect(reverbSendNode);
                reverbSendNode.connect(this.reverbNode);
                this._allNodes.push(reverbSendNode);
            }

            // Start and schedule stop
            const safeStopTime = time + 10.0; // Max note length if no note off
            osc.start(time);
            osc.stop(safeStopTime);

            voiceGroup.push({
                osc, gainNode, filterNode, note: ev.note, channel: ch,
                startTime: time, adsr, volume,
                released: false,
            });

            this._allNodes.push(osc, gainNode);
            if (filterNode) this._allNodes.push(filterNode);
        }

        // Store for note-off handling
        if (!this._activeNotes) this._activeNotes = {};
        if (!this._activeNotes[ch]) this._activeNotes[ch] = {};
        this._activeNotes[ch][ev.note] = voiceGroup;
    }

    _scheduleNoteOff(ctx, time, ev) {
        const ch = ev.channel;
        if (!this._activeNotes || !this._activeNotes[ch]) return;
        const voiceGroup = this._activeNotes[ch][ev.note];
        if (!voiceGroup) return;

        for (const voice of voiceGroup) {
            if (voice.released) continue;
            voice.released = true;

            const releaseTime = voice.adsr.r || 0.3;
            const currentGain = voice.gainNode.gain.value || voice.volume * 0.3;

            // Schedule release phase
            voice.gainNode.gain.cancelScheduledValues(time);
            voice.gainNode.gain.setValueAtTime(currentGain, time);
            voice.gainNode.gain.exponentialRampToValueAtTime(0.001, time + releaseTime);

            // Schedule osc stop after release
            try {
                voice.osc.stop(time + releaseTime + 0.05);
            } catch (_) {}
        }

        delete this._activeNotes[ch][ev.note];
    }

    // ---- DRUM SYNTHESIS ----
    _playDrum(ctx, time, note, velocity) {
        const drum = DRUM_MAP[note];
        if (!drum) return; // Unknown drum note

        const vel = velocity / 127;
        const gain = ctx.createGain();
        const master = this.masterGain;
        // time is already an absolute ctx time — use directly, not now+time

        switch (drum.type) {
            case 'kick': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                const freq = 150 * Math.pow(2, (drum.pitch - 60) / 12);
                osc.frequency.setValueAtTime(freq, time);
                osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.5, time + 0.003);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

                osc.connect(gain);
                gain.connect(master);
                osc.start(time); osc.stop(time + 0.4);
                this._allNodes.push(osc, gain);
                break;
            }
            case 'snare': {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, time);

                // Noise layer
                const bufSize = ctx.sampleRate * 0.1;
                const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0, time);
                noiseGain.gain.linearRampToValueAtTime(vel * 0.4, time + 0.002);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

                const noiseFilt = ctx.createBiquadFilter();
                noiseFilt.type = 'highpass';
                noiseFilt.frequency.value = 1000;

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.4, time + 0.003);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

                osc.connect(gain);
                noise.connect(noiseFilt);
                noiseFilt.connect(noiseGain);
                gain.connect(master);
                noiseGain.connect(master);

                osc.start(time); osc.stop(time + 0.25);
                noise.start(time);
                this._allNodes.push(osc, gain, noise, noiseFilt, noiseGain);
                break;
            }
            case 'hhc': {
                const bufSize = ctx.sampleRate * 0.05;
                const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const filt = ctx.createBiquadFilter();
                filt.type = 'highpass';
                filt.frequency.value = 7000;

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.3, time + 0.001);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

                noise.connect(filt);
                filt.connect(gain);
                gain.connect(master);
                noise.start(time);
                this._allNodes.push(noise, filt, gain);
                break;
            }
            case 'hho': {
                const bufSize = ctx.sampleRate * 0.3;
                const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const filt = ctx.createBiquadFilter();
                filt.type = 'highpass';
                filt.frequency.value = 6000;

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.25, time + 0.001);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

                noise.connect(filt);
                filt.connect(gain);
                gain.connect(master);
                noise.start(time);
                this._allNodes.push(noise, filt, gain);
                break;
            }
            case 'crash':
            case 'ride': {
                const bufSize = ctx.sampleRate * 0.8;
                const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) {
                    const env = Math.exp(-i / (ctx.sampleRate * 0.3));
                    data[i] = (Math.random() * 2 - 1) * env;
                }
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const filt = ctx.createBiquadFilter();
                filt.type = 'highpass';
                filt.frequency.value = drum.type === 'crash' ? 2000 : 3000;

                gain.gain.setValueAtTime(vel * 0.35, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);

                noise.connect(filt);
                filt.connect(gain);
                gain.connect(master);
                noise.start(time);
                this._allNodes.push(noise, filt, gain);
                break;
            }
            case 'tom': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                const freq = 100 * Math.pow(2, (drum.pitch - 55) / 12);
                osc.frequency.setValueAtTime(freq, time);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.1);

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.35, time + 0.003);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

                osc.connect(gain);
                gain.connect(master);
                osc.start(time); osc.stop(time + 0.25);
                this._allNodes.push(osc, gain);
                break;
            }
            case 'clap': {
                // Clap: layered noise bursts
                for (let i = 0; i < 3; i++) {
                    const delay = time + i * 0.012;
                    const bufSize = ctx.sampleRate * 0.06;
                    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                    const d = noiseBuf.getChannelData(0);
                    for (let j = 0; j < bufSize; j++) d[j] = Math.random() * 2 - 1;

                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuf;

                    const filt = ctx.createBiquadFilter();
                    filt.type = 'lowpass';
                    filt.frequency.value = 2000;

                    const cGain = ctx.createGain();
                    cGain.gain.setValueAtTime(vel * 0.2, delay);
                    cGain.gain.exponentialRampToValueAtTime(0.001, delay + 0.05);

                    noise.connect(filt);
                    filt.connect(cGain);
                    cGain.connect(master);
                    noise.start(delay);
                    this._allNodes.push(noise, filt, cGain);
                }
                break;
            }
            case 'conga': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                const freq = 160 * Math.pow(2, (drum.pitch - 60) / 12);
                osc.frequency.setValueAtTime(freq, time);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + 0.04);

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.35, time + 0.002);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

                osc.connect(gain);
                gain.connect(master);
                osc.start(time); osc.stop(time + 0.15);
                this._allNodes.push(osc, gain);
                break;
            }
            case 'tamb':
            case 'cowbell':
            case 'timbale': {
                const osc = ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(800, time);
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.15, time + 0.001);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
                osc.connect(gain);
                gain.connect(master);
                osc.start(time); osc.stop(time + 0.1);
                this._allNodes.push(osc, gain);
                break;
            }
            case 'bell': {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                const freq = 440 * Math.pow(2, (drum.pitch - 69) / 12);
                osc.frequency.setValueAtTime(freq, time);

                gain.gain.setValueAtTime(vel * 0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

                osc.connect(gain);
                gain.connect(master);
                osc.start(time); osc.stop(time + 0.6);
                this._allNodes.push(osc, gain);
                break;
            }
            default: {
                // Generic percussion
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, time);
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(vel * 0.2, time + 0.001);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
                osc.connect(gain);
                gain.connect(master);
                osc.start(time); osc.stop(time + 0.1);
                this._allNodes.push(osc, gain);
            }
        }
    }

    // ---- STOP ----
    stop(fade = true) {
        this.isPlaying = false;
        this._activeNotes = {};

        // Fade out master gently (only when user-initiated stop, NOT when play() calls stop())
        if (fade && this.masterGain && this.ctx) {
            try {
                this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
                this.masterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
            } catch (_) {}
        }

        // Schedule quick stop — disconnect all nodes after a short fade
        if (this.ctx) {
            const now = this.ctx.currentTime;
            const stopTime = fade ? now + 0.2 : now + 0.01;
            for (const node of this._allNodes) {
                try {
                    if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
                        node.stop(stopTime);
                    }
                } catch (_) {}
            }
        }

        // Rebuild FX chain (fresh start)
        if (this.ctx) {
            const delay = fade ? 250 : 10;
            setTimeout(() => {
                try {
                    this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
                } catch (_) {}
            }, delay);
        }

        this._scheduledStopTime = 0;
    }

    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
        }
    }

    destroy() {
        this.stop();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this._allNodes = [];
    }
}

export { MidiParser, MidiPlayer };
