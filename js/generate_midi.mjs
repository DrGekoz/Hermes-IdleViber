// MIDI file generator — generates .mid from our song data
// Run: node js/generate_midi.mjs
// FIXED: wVar now writes to track buffer instead of global buf (was producing corrupt files)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const midiDir = path.join(__dirname, '..', 'midi');

const TPB = 480;

function toMidi(name, oct) {
  const map = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
  if (!name || name === '-') return -1;
  return 12 + oct * 12 + (map[name] || 0);
}

function buildMidi(tracks, bpm) {
  const mpb = Math.round(60000000 / bpm);
  const buf = [];
  const w16 = v => { buf.push((v>>8)&255, v&255); };
  const w32 = v => { buf.push((v>>24)&255, (v>>16)&255, (v>>8)&255, v&255); };
  const wStr = s => { for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i)); };
  const wVarGlobal = v => {
    const b = [v & 0x7F];
    while (v > 0x7F) { v >>>= 7; b.push(0x80 | (v & 0x7F)); }
    b.reverse();
    buf.push(...b);
  };

  wStr('MThd'); w32(6); w16(1); w16(tracks.length); w16(TPB);

  for (let t = 0; t < tracks.length; t++) {
    const ch = [];
    // *** FIX: local wVar that writes to track buffer, NOT global buf ***
    const wVarCh = v => {
      const b = [v & 0x7F];
      let vv = v;
      while (vv > 0x7F) { vv >>>= 7; b.push(0x80 | (vv & 0x7F)); }
      b.reverse();
      ch.push(...b);
    };
    const eV = (d, e) => { wVarCh(d); ch.push(...e); };

    eV(0, [0xFF, 0x51, 0x03, (mpb>>16)&255, (mpb>>8)&255, mpb&255]);
    const tn = 'T' + t;
    eV(0, [0xFF, 0x03, tn.length, ...tn.split('').map(c => c.charCodeAt(0))]);
    if (t === 0) eV(0, [0xC0, 0]); else eV(0, [0xC1, 34]);

    const notes = (tracks[t] || []).sort((a, b) => a.tick - b.tick);
    let last = 0;
    for (const n of notes) {
      eV(n.tick - last, [0x90 | n.ch, n.note, n.vel]);
      eV(n.dur, [0x80 | n.ch, n.note, 0]);
      last = n.tick + n.dur;
    }
    eV(0, [0xFF, 0x2F, 0x00]);

    wStr('MTrk'); w32(ch.length); buf.push(...ch);
  }
  return Buffer.from(buf);
}

// --- SONG DATA: 9 unique songs matching music.js ---
const songs = [
  // CHILL (5 songs)
  { genre: 'chill', name: 'campfire_dreams', bpm: 80, m: [
      ['C',4,0.5],['-',4,0.25],['E',4,0.25],['G',4,0.5],['A',4,0.5],['G',4,0.25],['E',4,0.25],['C',4,0.5],
      ['D',4,0.25],['F',4,0.25],['A',4,0.5],['C',5,0.5],['B',4,0.5],['A',4,0.25],['G',4,0.25],['E',4,1],
    ], b: [
      ['C',2,1],['G',2,0.5],['A',2,0.5],['E',2,1],['F',2,1],['C',2,0.5],['G',2,0.5],['C',2,1],
    ] },
  { genre: 'chill', name: 'starlight_waltz', bpm: 72, m: [
      ['D',4,0.75],['F',4,0.5],['G',4,0.75],['A',4,0.5],['G',4,0.25],['F',4,0.25],['D',4,0.5],['-',4,0.25],
      ['E',4,0.75],['G',4,0.5],['A',4,0.75],['C',5,0.5],['A',4,0.25],['G',4,0.25],['E',4,0.5],['-',4,1],
    ], b: [
      ['D',2,1.5],['G',2,0.5],['A',2,1],['D',2,1],['D',2,1.5],['E',2,0.5],['F',2,1],['G',2,1],
    ] },
  { genre: 'chill', name: 'midnight_embers', bpm: 68, m: [
      ['E',4,1],['G',4,0.5],['B',4,0.5],['A',4,1],['G',4,0.5],['E',4,0.5],['-',4,0.5],
      ['F',4,0.75],['A',4,0.5],['C',5,0.75],['B',4,0.5],['A',4,0.5],['-',4,0.5],
      ['G',4,0.5],['B',4,0.5],['D',5,1],['C',5,0.5],['B',4,0.5],['G',4,0.5],['E',4,1],
    ], b: [
      ['E',2,1.5],['A',2,1],['F',2,1],['C',2,0.5],['G',2,1.5],['D',2,1],['E',2,1],
    ] },
  { genre: 'chill', name: 'sunlit_grove', bpm: 88, m: [
      ['G',4,0.5],['B',4,0.5],['D',5,0.5],['B',4,0.25],['G',4,0.25],['-',4,0.5],
      ['A',4,0.5],['C',5,0.5],['E',5,0.5],['C',5,0.25],['A',4,0.25],['-',4,0.5],
      ['F',4,0.5],['A',4,0.5],['C',5,0.5],['A',4,0.25],['F',4,0.25],['G',4,0.5],
      ['E',4,0.5],['G',4,0.5],['B',4,0.5],['C',5,0.5],['B',4,0.5],['G',4,0.5],['E',4,1],
    ], b: [
      ['G',2,1],['D',2,0.5],['E',2,0.5],['C',2,1],['F',2,1],['C',2,0.5],['G',2,0.5],['C',2,1],
    ] },
  { genre: 'chill', name: 'cozy_hearth', bpm: 72, m: [
      ['C',4,0.5],['E',4,0.5],['G',4,0.5],['E',4,0.5],['C',4,0.5],['D',4,0.5],['E',4,0.5],['-',4,0.5],
      ['F',4,0.5],['A',4,0.5],['C',5,0.75],['B',4,0.25],['A',4,0.5],['F',4,0.5],['-',4,0.5],
      ['E',4,0.5],['G',4,0.5],['B',4,0.5],['D',5,0.5],['C',5,0.5],['B',4,0.5],['G',4,0.5],['E',4,1],
    ], b: [
      ['C',2,1],['F',2,0.5],['C',2,0.5],['G',2,1],['F',2,1],['C',2,0.5],['G',2,0.5],['C',2,1],
    ] },
  // CYBER (2 songs)
  { genre: 'cyber', name: 'neon_pulse', bpm: 110, m: [
      ['E',4,0.25],['G',4,0.25],['C',5,0.25],['G',4,0.25],['E',4,0.25],['G',4,0.25],['C',5,0.25],['G',4,0.25],
      ['D',4,0.25],['F',4,0.25],['A',4,0.25],['F',4,0.25],['D',4,0.25],['F',4,0.25],['A',4,0.25],['F',4,0.25],
    ], b: [
      ['C',2,1],['G',1,0.5],['A',1,0.5],['E',1,1],['F',1,1],['C',2,0.5],['G',1,0.5],['C',2,1],
    ] },
  { genre: 'cyber', name: 'digital_rain', bpm: 115, m: [
      ['F',4,0.25],['A',4,0.25],['C',5,0.25],['A',4,0.25],['F',4,0.25],['A',4,0.25],['C',5,0.25],['A',4,0.25],
      ['E',4,0.25],['G',4,0.25],['B',4,0.25],['G',4,0.25],['E',4,0.25],['G',4,0.25],['B',4,0.25],['D',5,0.25],
      ['D',4,0.25],['F',4,0.25],['A',4,0.25],['F',4,0.25],['D',4,0.25],['F',4,0.25],['A',4,0.25],['E',5,0.25],
      ['C',4,0.25],['E',4,0.25],['G',4,0.25],['B',4,0.25],['C',5,0.125],['B',4,0.125],['A',4,0.25],['G',4,0.25],
    ], b: [
      ['F',2,1],['C',2,0.5],['D',2,0.5],['A',1,1],['B',1,1],['F',2,0.5],['C',2,0.5],['F',2,1],
    ] },
  // JAZZ (1 song)
  { genre: 'jazz', name: 'moonlit_swing', bpm: 95, m: [
      ['G',4,0.5],['A',4,0.25],['G',4,0.25],['E',4,0.5],['C',4,0.25],['D',4,0.25],['E',4,0.5],['G',4,0.5],
      ['A',4,0.5],['C',5,0.5],['A',4,0.25],['G',4,0.25],['-',4,0.5],
      ['D',4,0.5],['G',4,0.5],['B',4,0.5],['A',4,0.5],['G',4,0.25],['E',4,0.25],['C',4,0.5],['E',4,0.5],
    ], b: [
      ['C',2,1.5],['G',1,0.5],['A',1,1.5],['E',1,0.5],['F',1,1.5],['C',2,0.5],['D',1,0.5],['G',1,1],
    ] },
  // NATURE (1 song)
  { genre: 'nature', name: 'forest_breath', bpm: 65, m: [
      ['A',4,0.75],['C',5,0.5],['E',5,0.75],['D',5,0.5],['C',5,0.25],['A',4,0.25],['-',4,0.25],
      ['G',4,0.75],['B',4,0.5],['D',5,0.75],['C',5,0.5],['B',4,0.25],['G',4,0.25],['-',4,0.25],
      ['F',4,0.75],['A',4,0.5],['C',5,0.75],['E',5,0.5],['D',5,0.25],['C',5,0.25],['-',4,0.5],
      ['A',4,0.5],['E',5,0.5],['D',5,0.5],['C',5,0.5],['B',4,0.25],['A',4,0.25],['G',4,0.5],['A',4,0.5],['-',4,1],
    ], b: [
      ['A',2,1.5],['E',2,1],['F',2,1],['C',2,0.5],['G',2,1.5],['D',2,1],['E',2,0.5],['A',2,1],
    ] },
];

// Clean old midi files first
const oldFiles = fs.readdirSync(midiDir).filter(f => f.endsWith('.mid'));
for (const f of oldFiles) {
  if (f === 'test.mid' || f.startsWith('beethoven') || f.startsWith('brahms') || f.startsWith('chopin')) continue;
  fs.unlinkSync(path.join(midiDir, f));
  console.log(`🗑️  Removed old: ${f}`);
}

// Generate new MIDI files
for (const song of songs) {
  const notes = [];
  let tick = 0;
  for (const [n, o, d] of song.m) {
    const dt = Math.round(d * TPB);
    if (n && n !== '-') notes.push({ tick, note: toMidi(n, o), dur: dt, vel: 80, ch: 0 });
    tick += dt;
  }
  let bt = 0;
  for (const [n, o, d] of song.b) {
    const dt = Math.round(d * TPB);
    if (n && n !== '-') notes.push({ tick: bt, note: toMidi(n, o), dur: dt, vel: 90, ch: 1 });
    bt += dt;
  }

  const data = buildMidi([notes], song.bpm);
  const filename = path.join(midiDir, `${song.genre}_${song.name}.mid`);
  fs.writeFileSync(filename, data);
  console.log(`✅ ${filename} (${data.length} bytes, BPM=${song.bpm})`);
}

console.log(`\n🔥 Generated ${songs.length} MIDI files in ${midiDir}`);
