// ============================================================
// Hermes IdleViber — MIDI Parser & Player
// Parses .mid binary files and plays via Web Audio API
// ============================================================

// MIDI note to frequency
function midiNoteToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

// ---- MIDI FILE PARSER ----
// Parses standard MIDI file format (SMF) from ArrayBuffer
class MidiParser {
    parse(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        let offset = 0;
        
        // Read header chunk "MThd"
        const headerId = this.readString(view, offset, 4);
        offset += 4;
        if (headerId !== 'MThd') throw new Error('Not a MIDI file');
        
        const headerLen = view.getUint32(offset, false);
        offset += 4;
        const format = view.getUint16(offset, false);
        offset += 2;
        const numTracks = view.getUint16(offset, false);
        offset += 2;
        const division = view.getUint16(offset, false);
        offset += 2;
        
        // Parse tempo and time division
        let ticksPerQuarterNote = division & 0x7FFF;
        let microsecondsPerQuarterNote = 500000; // default 120 BPM
        
        // Read track chunks
        const tracks = [];
        for (let t = 0; t < numTracks; t++) {
            const trackId = this.readString(view, offset, 4);
            offset += 4;
            if (trackId !== 'MTrk') throw new Error('Expected MTrk chunk');
            
            const trackLen = view.getUint32(offset, false);
            offset += 4;
            const trackEnd = offset + trackLen;
            
            const events = [];
            let absoluteTicks = 0;
            
            while (offset < trackEnd) {
                // Delta time (variable length)
                const delta = this.readVarLen(view, offset);
                offset += delta.bytes;
                absoluteTicks += delta.value;
                
                // Event type
                const statusByte = view.getUint8(offset);
                offset++;
                
                if (statusByte === 0xFF) {
                    // Meta event
                    const metaType = view.getUint8(offset);
                    offset++;
                    const len = this.readVarLen(view, offset);
                    offset += len.bytes;
                    const data = [];
                    for (let i = 0; i < len.value; i++) {
                        data.push(view.getUint8(offset + i));
                    }
                    offset += len.value;
                    
                    // Tempo meta event
                    if (metaType === 0x51 && len.value === 3) {
                        microsecondsPerQuarterNote = (data[0] << 16) | (data[1] << 8) | data[2];
                    }
                    
                    events.push({ type: 'meta', metaType, delta: delta.value, absoluteTicks, data });
                } else if (statusByte >= 0x80 && statusByte <= 0xEF) {
                    // MIDI event
                    let runningStatus = statusByte;
                    const command = statusByte & 0xF0;
                    const channel = statusByte & 0x0F;
                    
                    // Read parameters based on command type
                    let param1, param2;
                    if (command === 0xC0 || command === 0xD0) {
                        // Program change or Channel pressure: 1 byte
                        param1 = view.getUint8(offset); offset++;
                        param2 = 0;
                    } else {
                        // Note on/off, controller, etc: 2 bytes
                        param1 = view.getUint8(offset); offset++;
                        param2 = view.getUint8(offset); offset++;
                    }
                    
                    events.push({
                        type: 'midi',
                        command, channel,
                        param1, param2,
                        delta: delta.value,
                        absoluteTicks,
                        runningStatus
                    });
                }
                // else: system real-time or other, skip
            }
            
            tracks.push(events);
        }
        
        return {
            format, numTracks, ticksPerQuarterNote,
            microsecondsPerQuarterNote,
            tracks, bpm: Math.round(60000000 / microsecondsPerQuarterNote)
        };
    }
    
    readString(view, offset, length) {
        let s = '';
        for (let i = 0; i < length; i++) {
            s += String.fromCharCode(view.getUint8(offset + i));
        }
        return s;
    }
    
    readVarLen(view, offset) {
        let value = 0;
        let bytes = 0;
        let byte;
        do {
            byte = view.getUint8(offset + bytes);
            value = (value << 7) | (byte & 0x7F);
            bytes++;
        } while (byte & 0x80);
        return { value, bytes };
    }
}

// ---- MIDI PLAYER ----
// Plays MIDI file data through Web Audio API
class MidiPlayer {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.songGain = null;
        this.playing = false;
        this.scheduledNodes = [];
        this.tempoMultiplier = 1.0;
        this._ready = false;
    }
    
    // Async init: creates AudioContext if needed, awaits resume
    async ensureReady() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
        this._ready = true;
    }
    
    init() {
        // Legacy sync init — no longer the primary entry
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
    }
    
    setVolume(vol) {
        if (this.masterGain) this.masterGain.gain.value = vol;
    }
    
    // Play a parsed MIDI structure
    play(midiData) {
        this.stop();
        this.init();
        
        this.songGain = this.audioCtx.createGain();
        this.songGain.gain.value = 1.0;
        this.songGain.connect(this.masterGain);
        
        this.playing = true;
        const bpm = midiData.bpm || 120;
        const ticksPerQuarter = midiData.ticksPerQuarterNote || 480;
        const secondsPerTick = (60 / bpm) / ticksPerQuarter;
        
        // Flatten all track events into one sorted list
        const allEvents = [];
        for (const track of midiData.tracks) {
            for (const event of track) {
                allEvents.push(event);
            }
        }
        allEvents.sort((a, b) => a.absoluteTicks - b.absoluteTicks);
        
        // Track note-on events to calculate note durations
        const activeNotes = {};
        
        for (const event of allEvents) {
            if (event.type === 'midi' && event.command === 0x90 && event.param2 > 0) {
                // Note on
                const note = event.param1;
                const velocity = event.param2;
                const time = event.absoluteTicks * secondsPerTick;
                activeNotes[note] = { time, velocity, channel: event.channel };
            } else if (event.type === 'midi' && (event.command === 0x80 || (event.command === 0x90 && event.param2 === 0))) {
                // Note off
                const note = event.param1;
                const active = activeNotes[note];
                if (active) {
                    const startTime = active.time;
                    const endTime = event.absoluteTicks * secondsPerTick;
                    const duration = endTime - startTime;
                    const velocity = active.velocity / 127;
                    
                    this.scheduleNote(note, startTime, duration, velocity, active.channel);
                    delete activeNotes[note];
                }
            }
        }
        
        // Calculate total duration
        const totalTicks = allEvents.length > 0 ? allEvents[allEvents.length - 1].absoluteTicks : 480;
        const totalDuration = totalTicks * secondsPerTick;
        
        return totalDuration;
    }
    
    scheduleNote(note, startTime, duration, velocity, channel) {
        if (!this.songGain || !this.playing) return;
        
        const freq = midiNoteToFreq(note);
        const now = this.audioCtx.currentTime;
        const absStart = now + startTime * this.tempoMultiplier;
        
        // Choose instrument based on channel and note range
        let oscType = 'triangle';
        let gainBase = 0.08 + velocity * 0.06;
        
        if (note < 48) {
            // Bass notes
            oscType = 'sawtooth';
            gainBase = 0.12 + velocity * 0.04;
        } else if (note >= 60 && note < 72) {
            // Mid range
            oscType = 'square';
            gainBase = 0.06 + velocity * 0.04;
        } else {
            // High (melody)
            oscType = 'triangle';
            gainBase = 0.05 + velocity * 0.03;
        }
        
        const osc = this.audioCtx.createOscillator();
        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, absStart);
        
        // Slight pitch bend for expression
        osc.frequency.setValueAtTime(freq * 1.01, absStart);
        osc.frequency.linearRampToValueAtTime(freq, absStart + 0.02);
        
        const env = this.audioCtx.createGain();
        env.gain.setValueAtTime(0, absStart);
        env.gain.linearRampToValueAtTime(gainBase, absStart + 0.005);
        env.gain.linearRampToValueAtTime(gainBase * 0.7, absStart + duration * 0.3);
        env.gain.linearRampToValueAtTime(0, absStart + duration + 0.02);
        
        osc.connect(env);
        env.connect(this.songGain);
        
        osc.start(absStart);
        osc.stop(absStart + duration + 0.05);
        
        this.scheduledNodes.push(osc);
    }
    
    stop() {
        this.playing = false;
        if (this.songGain) {
            // Kill instantly
            try { this.songGain.gain.value = 0; } catch(e) {}
            try { this.songGain.disconnect(); } catch(e) {}
            this.songGain = null;
        }
        this.scheduledNodes = [];
    }
}

// ---- MIDI FILE GENERATOR ----
// Generates valid .mid binary from our note data
class MidiGenerator {
    // Convert our song format to a MIDI file ArrayBuffer
    static generate(song, bpm) {
        const ticksPerQuarter = 480;
        const tracks = [[], []]; // track 0: melody+chords, track 1: bass, we'll add percussion later
        
        let melodyTicks = 0;
        if (song.melody) {
            for (const note of song.melody) {
                const durTicks = Math.round(note.dur * ticksPerQuarter);
                if (note.note !== '-') {
                    const midiNote = MidiGenerator.noteNameToMidi(note.note, note.octave);
                    tracks[0].push({ tick: melodyTicks, type: 'note', note: midiNote, dur: durTicks, vel: 80, ch: 0 });
                }
                melodyTicks += durTicks;
            }
        }
        
        let bassTicks = 0;
        if (song.bass) {
            for (const note of song.bass) {
                const durTicks = Math.round(note.dur * ticksPerQuarter);
                if (note.note !== '-') {
                    const midiNote = MidiGenerator.noteNameToMidi(note.note, note.octave);
                    tracks[1].push({ tick: bassTicks, type: 'note', note: midiNote, dur: durTicks, vel: 90, ch: 1 });
                }
                bassTicks += durTicks;
            }
        }
        
        return MidiGenerator.buildMidiFile(tracks, ticksPerQuarter, bpm);
    }
    
    static noteNameToMidi(name, octave) {
        const semitones = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
        const st = semitones[name] || 0;
        return 12 + (octave * 12) + st;
    }
    
    static buildMidiFile(tracks, ticksPerQuarter, bpm) {
        const microPerBeat = Math.round(60000000 / bpm);
        const bytes = [];
        
        const writeBytes = (arr) => { for (const b of arr) bytes.push(b); };
        const writeStr = (s) => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); };
        const writeU16 = (v) => { bytes.push((v >> 8) & 0xFF, v & 0xFF); };
        const writeU32 = (v) => { bytes.push((v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF); };
        const writeVarLen = (v) => {
            const buf = [];
            buf.push(v & 0x7F);
            while (v > 0x7F) { v >>= 7; buf.push(0x80 | (v & 0x7F)); }
            buf.reverse();
            for (const b of buf) bytes.push(b);
        };
        
        // Header
        writeStr('MThd');
        writeU32(6);
        writeU16(1); // format 1 (multiple tracks)
        writeU16(tracks.length);
        writeU16(ticksPerQuarter);
        
        // Per-track data
        for (let t = 0; t < tracks.length; t++) {
            const trackBytes = [];
            const writeTB = (arr) => { for (const b of arr) trackBytes.push(b); };
            
            const addEvent = (delta, eventBytes) => {
                writeVarLen(delta);
                writeTB(eventBytes);
            };
            
            // Tempo meta
            addEvent(0, [0xFF, 0x51, 0x03, (microPerBeat >> 16) & 0xFF, (microPerBeat >> 8) & 0xFF, microPerBeat & 0xFF]);
            
            // Track name
            const name = `Track ${t}`;
            addEvent(0, [0xFF, 0x03, name.length, ...name.split('').map(c => c.charCodeAt(0))]);
            
            // Sort events by tick
            tracks[t].sort((a, b) => a.tick - b.tick);
            
            let lastTick = 0;
            for (const ev of tracks[t]) {
                if (ev.type === 'note') {
                    const delta = ev.tick - lastTick;
                    // Note on
                    addEvent(delta, [0x90 | ev.ch, ev.note, ev.vel]);
                    // Note off (after duration)
                    addEvent(ev.dur, [0x80 | ev.ch, ev.note, 0]);
                    lastTick = ev.tick + ev.dur;
                }
            }
            
            // End of track
            addEvent(0, [0xFF, 0x2F, 0x00]);
            
            // Write track chunk
            const trackLen = trackBytes.length;
            bytes.push(...[77, 84, 114, 107]); // "MTrk"
            writeU32(trackLen);
            bytes.push(...trackBytes);
        }
        
        return new Uint8Array(bytes).buffer;
    }
}

export { MidiParser, MidiPlayer, MidiGenerator };
