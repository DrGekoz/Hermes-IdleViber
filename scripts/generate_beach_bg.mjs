// Generate pixel-art beach cove background as PNG
// Pure Node.js — no external dependencies
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

const W = 256;
const H = 256;

// Create pixel buffer (RGBA)
const pixels = Buffer.alloc(W * H * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

// Simple noise for dithering
function noise() {
  return Math.random() * 20 - 10;
}

// --- SKY GRADIENT (sunset: deep purple → pink → orange → yellow) ---
for (let y = 0; y < H; y++) {
  const t = y / H;
  for (let x = 0; x < W; x++) {
    let r, g, b;
    if (t < 0.25) {
      // Deep purple sky
      const s = t / 0.25;
      r = Math.floor(25 + s * 30 + noise());
      g = Math.floor(5 + s * 20 + noise());
      b = Math.floor(40 + s * 30 + noise());
    } else if (t < 0.45) {
      // Pink transition
      const s = (t - 0.25) / 0.2;
      r = Math.floor(55 + s * 180 + noise());
      g = Math.floor(25 + s * 60 + noise());
      b = Math.floor(70 + s * 30 + noise());
    } else if (t < 0.55) {
      // Orange sunset
      const s = (t - 0.45) / 0.1;
      r = Math.floor(235 + s * 20 + noise());
      g = Math.floor(85 + s * 80 + noise());
      b = Math.floor(30 + noise());
    } else if (t < 0.6) {
      // Horizon glow
      r = Math.floor(255 + noise());
      g = Math.floor(180 + noise());
      b = Math.floor(60 + noise());
    } else if (t < 0.7) {
      // Ocean (dark blue-green at horizon → lighter)
      const s = (t - 0.6) / 0.1;
      r = Math.floor(10 + s * 20 + noise());
      g = Math.floor(30 + s * 60 + noise());
      b = Math.floor(80 + s * 80 + noise());
    } else {
      // Deeper ocean
      const s = (t - 0.7) / 0.3;
      r = Math.floor(10 + s * 5 + noise());
      g = Math.floor(40 + s * 30 + noise());
      b = Math.floor(120 + s * 40 + noise());
    }
    setPixel(x, y, Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
  }
}

// --- SUN ---
const sunX = W * 0.7;
const sunY = H * 0.48;
for (let dy = -14; dy <= 14; dy++) {
  for (let dx = -14; dx <= 14; dx++) {
    if (dx * dx + dy * dy <= 14 * 14) {
      const x = Math.floor(sunX + dx);
      const y = Math.floor(sunY + dy);
      const dist = Math.sqrt(dx * dx + dy * dy) / 14;
      const alpha = Math.max(0, 1 - dist);
      const r = 255;
      const g = Math.floor(220 * alpha + 180 * (1 - alpha));
      const b = Math.floor(140 * alpha + 100 * (1 - alpha));
      setPixel(x, y, r, g, b);
    }
  }
}

// --- OCEAN WAVES ---
for (let y = Math.floor(H * 0.58); y < H * 0.72; y++) {
  const waveT = (y - H * 0.58) / (H * 0.14);
  for (let x = 0; x < W; x++) {
    const wave = Math.sin(x * 0.08 + y * 0.3) * 3 + Math.sin(x * 0.15 + y * 0.1) * 2;
    const highlight = Math.max(0, wave) * 0.4;
    const r = Math.floor(15 + highlight * 60 + noise() * 0.5);
    const g = Math.floor(45 + highlight * 30 + noise() * 0.5);
    const b = Math.floor(90 + highlight * 40 + noise() * 0.5);
    // Wave foam
    if (Math.abs(wave) > 2.5 && y < H * 0.62) {
      setPixel(x, y, 220, 230, 240, 180);
    } else {
      setPixel(x, y, Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
    }
  }
}

// --- BEACH SAND ---
for (let y = Math.floor(H * 0.7); y < H; y++) {
  for (let x = 0; x < W; x++) {
    const sandNoise = Math.random() * 30;
    const r = Math.floor(210 + sandNoise);
    const g = Math.floor(180 + sandNoise);
    const b = Math.floor(130 + sandNoise * 0.5);
    setPixel(x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b));
  }
}

// --- SHORE LINE (wet sand gradient) ---
for (let y = Math.floor(H * 0.68); y < H * 0.74; y++) {
  const t = (y - H * 0.68) / (0.06 * H);
  for (let x = 0; x < W; x++) {
    if (y >= H * 0.7) {
      const wet = (1 - t) * 0.4;
      // Already sand pixels, just darken near shore
      const i = (y * W + x) * 4;
      pixels[i] = Math.floor(pixels[i] * (1 - wet * 0.5));
      pixels[i + 1] = Math.floor(pixels[i + 1] * (1 - wet * 0.4));
      pixels[i + 2] = Math.floor(pixels[i + 2] * (1 - wet * 0.3));
    }
  }
}

// --- PALM TREE SILHOUETTE (left side) ---
function drawPalm(x0, y0) {
  // Trunk
  for (let y = 0; y < 50; y++) {
    const sway = Math.sin(y * 0.08) * (y * 0.08);
    const t = y / 50;
    const trunkW = Math.floor(4 - t * 2);
    for (let dx = -trunkW; dx <= trunkW; dx++) {
      const x = Math.floor(x0 + sway + dx);
      const py = Math.floor(y0 + y);
      setPixel(x, py, 30, 20, 10);
    }
  }
  // Fronds
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + Math.PI * 0.2;
    for (let d = 8; d < 35; d++) {
      const fx = Math.floor(x0 + Math.cos(angle) * d);
      const fy = Math.floor(y0 + Math.sin(angle) * d * 0.4);
      const spread = Math.max(0, (35 - d) / 35) * 5;
      for (let s = -spread; s <= spread; s++) {
        setPixel(fx + Math.floor(s), fy, 20, 50 + Math.floor(Math.random() * 10), 10);
      }
    }
  }
  // Coconuts
  for (let i = 0; i < 3; i++) {
    const cx = x0 - 2 + i * 3;
    const cy = y0 + 3;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy <= 8) {
          setPixel(cx + dx, cy + dy, 60, 30, 10);
        }
      }
    }
  }
}

drawPalm(40, H * 0.42);
drawPalm(55, H * 0.46);  // Smaller palm behind

// --- DISTANT PALM (right side, smaller) ---
drawPalm(210, H * 0.47);

// --- STARS (top portion) ---
for (let i = 0; i < 40; i++) {
  const sx = Math.floor(Math.random() * W);
  const sy = Math.floor(Math.random() * H * 0.22);
  const bright = 150 + Math.floor(Math.random() * 105);
  setPixel(sx, sy, bright, bright, bright);
  // Some stars get a faint cross
  if (Math.random() < 0.2) {
    setPixel(sx + 1, sy, bright, bright, bright, 100);
    setPixel(sx - 1, sy, bright, bright, bright, 100);
    setPixel(sx, sy + 1, bright, bright, bright, 100);
    setPixel(sx, sy - 1, bright, bright, bright, 100);
  }
}

// --- SUN REFLECTION ON WATER ---
for (let y = Math.floor(H * 0.59); y < H * 0.7; y++) {
  const ry = y - H * 0.58;
  for (let dx = -8; dx <= 8; dx++) {
    const intensity = Math.max(0, 1 - Math.abs(dx) / 8) * Math.max(0, 1 - ry / (H * 0.12)) * 0.4;
    if (intensity > 0.05 && Math.random() < intensity * 3) {
      const x = Math.floor(sunX + dx);
      const r = Math.floor(255 * intensity * 0.6);
      const g = Math.floor(200 * intensity * 0.4);
      const b = Math.floor(100 * intensity * 0.2);
      if (x >= 0 && x < W && y < H) {
        const i = (y * W + x) * 4;
        pixels[i] = Math.min(255, pixels[i] + r);
        pixels[i + 1] = Math.min(255, pixels[i + 1] + g);
        pixels[i + 2] = Math.min(255, pixels[i + 2] + b);
      }
    }
  }
}

// --- PNG ENCODER ---
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcData = Buffer.concat([typeB, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crcVal]);
}

// Build raw image data (filtered scanlines)
const rawData = [];
for (let y = 0; y < H; y++) {
  rawData.push(0); // filter: none
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    rawData.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
  }
}
const rawBuf = Buffer.from(rawData);

// Deflate
const compressed = deflateSync(rawBuf, { level: 9 });

// Build PNG
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(W, 0);
ihdrData.writeUInt32BE(H, 4);
ihdrData[8] = 8;  // bit depth
ihdrData[9] = 6;  // color type: RGBA
ihdrData[10] = 0; // compression
ihdrData[11] = 0; // filter
ihdrData[12] = 0; // interlace

const ihdr = pngChunk('IHDR', ihdrData);
const idat = pngChunk('IDAT', compressed);
const iend = pngChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);
writeFileSync('sprites/images/bg/bg_beach_cove.png', png);
console.log(`Generated bg_beach_cove.png: ${W}x${H}, ${png.length} bytes`);
