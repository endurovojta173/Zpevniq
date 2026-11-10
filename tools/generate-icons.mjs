/**
 * Vygeneruje PNG ikony pro PWA — bez jediné závislosti (jen node:zlib).
 *
 * Spuštění:  node tools/generate-icons.mjs
 * Výstup:    icons/icon-180.png, icon-192.png, icon-512.png, icon-512-maskable.png
 *
 * Ikona = teplý gradient + notička. Mění se tady, ne ručně v grafickém editoru.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

/* ---------- PNG ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bitová hloubka
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filtr 0 = žádný
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- Geometrie notičky (v jednotkovém boxu 0..1) ---------- */

const NOTE = {
  headX: 0.36,
  headY: 0.7,
  headRx: 0.15,
  headRy: 0.115,
  stemX0: 0.475,
  stemX1: 0.525,
  stemY0: 0.22,
  stemY1: 0.7,
  flagFrom: [0.525, 0.235],
  flagControl: [0.72, 0.26],
  flagTo: [0.8, 0.42],
  flagWidth: 0.075,
};

const FLAG_STEPS = 48;

const FLAG_POINTS = (() => {
  const points = [];
  for (let i = 0; i <= FLAG_STEPS; i += 1) {
    const t = i / FLAG_STEPS;
    const mt = 1 - t;
    const x =
      mt * mt * NOTE.flagFrom[0] + 2 * mt * t * NOTE.flagControl[0] + t * t * NOTE.flagTo[0];
    const y =
      mt * mt * NOTE.flagFrom[1] + 2 * mt * t * NOTE.flagControl[1] + t * t * NOTE.flagTo[1];
    points.push([x, y]);
  }
  return points;
})();

function insideEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function segmentDistanceSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

function insideNote(x, y) {
  if (insideEllipse(x, y, NOTE.headX, NOTE.headY, NOTE.headRx, NOTE.headRy)) {
    return true;
  }
  if (x >= NOTE.stemX0 && x <= NOTE.stemX1 && y >= NOTE.stemY0 && y <= NOTE.stemY1) {
    return true;
  }

  const half = NOTE.flagWidth / 2;
  const halfSq = half * half;
  for (let i = 0; i < FLAG_POINTS.length - 1; i += 1) {
    const [x1, y1] = FLAG_POINTS[i];
    const [x2, y2] = FLAG_POINTS[i + 1];
    if (segmentDistanceSq(x, y, x1, y1, x2, y2) <= halfSq) {
      return true;
    }
  }

  return false;
}

function insideRoundedRect(x, y, radius) {
  if (radius <= 0) {
    return true;
  }
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/* ---------- Barvy ---------- */

const GRADIENT_TOP = [162, 85, 29];
const GRADIENT_BOTTOM = [107, 50, 16];
const NOTE_COLOR = [255, 246, 234];

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* ---------- Vykreslení ---------- */

function renderIcon(size, options) {
  const contentScale = options.contentScale;
  const cornerRadius = options.cornerRadius;

  const rgba = Buffer.alloc(size * size * 4);
  const samples = 3;
  const total = samples * samples;
  const pad = (1 - contentScale) / 2;

  for (let py = 0; py < size; py += 1) {
    const vCenter = (py + 0.5) / size;
    const background = mix(GRADIENT_TOP, GRADIENT_BOTTOM, vCenter);

    for (let px = 0; px < size; px += 1) {
      let backgroundHits = 0;
      let noteHits = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = (px + (sx + 0.5) / samples) / size;
          const v = (py + (sy + 0.5) / samples) / size;

          if (!insideRoundedRect(u, v, cornerRadius)) {
            continue;
          }
          backgroundHits += 1;

          const nx = (u - pad) / contentScale;
          const ny = (v - pad) / contentScale;
          if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 && insideNote(nx, ny)) {
            noteHits += 1;
          }
        }
      }

      const alpha = backgroundHits / total;
      const offset = (py * size + px) * 4;

      if (alpha === 0) {
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
        continue;
      }

      const backgroundWeight = (backgroundHits - noteHits) / total;
      const noteWeight = noteHits / total;
      const sum = backgroundWeight + noteWeight || 1;

      rgba[offset] = Math.round((background[0] * backgroundWeight + NOTE_COLOR[0] * noteWeight) / sum);
      rgba[offset + 1] = Math.round(
        (background[1] * backgroundWeight + NOTE_COLOR[1] * noteWeight) / sum
      );
      rgba[offset + 2] = Math.round(
        (background[2] * backgroundWeight + NOTE_COLOR[2] * noteWeight) / sum
      );
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, rgba);
}

/* ---------- Zápis ---------- */

const TARGETS = [
  { file: 'icon-180.png', size: 180, contentScale: 0.62, cornerRadius: 0.22 },
  { file: 'icon-192.png', size: 192, contentScale: 0.62, cornerRadius: 0.22 },
  { file: 'icon-512.png', size: 512, contentScale: 0.62, cornerRadius: 0.22 },
  // Maskovatelná ikona: plná plocha, obsah jen v bezpečné zóně.
  { file: 'icon-512-maskable.png', size: 512, contentScale: 0.46, cornerRadius: 0 },
];

mkdirSync(OUT_DIR, { recursive: true });

TARGETS.forEach((target) => {
  const png = renderIcon(target.size, target);
  writeFileSync(join(OUT_DIR, target.file), png);
  const kb = (png.length / 1024).toFixed(1);
  console.log(target.file + '  ' + target.size + 'x' + target.size + '  ' + kb + ' kB');
});

