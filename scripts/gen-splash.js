// 生成安卓启动图 splash.png(输出覆盖 app/android/.../res/drawable*/splash.png)
// 视觉与启动图标一致:品牌渐变底 + 居中校准环(几何同 scripts/pnglib.js calibrationMark)
// 用法:node scripts/gen-splash.js(需已执行 cap add android)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './pnglib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const res = path.join(__dirname, '..', 'app', 'android', 'app', 'src', 'main', 'res');

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const GRAD = { from: [79, 110, 247], to: [124, 77, 255] }; // #4F6EF7 -> #7C4DFF
function bg(v) {
  const t = Math.min(1, Math.max(0, v));
  return [
    Math.round(GRAD.from[0] + (GRAD.to[0] - GRAD.from[0]) * t),
    Math.round(GRAD.from[1] + (GRAD.to[1] - GRAD.from[1]) * t),
    Math.round(GRAD.from[2] + (GRAD.to[2] - GRAD.from[2]) * t),
  ];
}

// 像素坐标的校准环命中判断(u,v 为像素坐标;cx/cy/R/W/dot/cursor 均为像素单位)
function mark(px, py, cx, cy, R, W, dotR, cursorR) {
  const d = Math.hypot(px - cx, py - cy);
  const ang = ((Math.atan2(px - cx, cy - py) * 180) / Math.PI + 360) % 360;
  const inGap = ang < 54 || ang > 342;
  if (Math.abs(d - R) <= W / 2 && !inGap) return true;
  const a = (54 * Math.PI) / 180;
  if (Math.hypot(px - (cx + Math.sin(a) * R), py - (cy - Math.cos(a) * R)) <= cursorR) return true;
  return d <= dotR;
}

// 2x2 超采样渲染 W×H splash
function renderSplash(W, H) {
  const SS = 2;
  const m = Math.min(W, H);
  const cx = W / 2, cy = H / 2;
  const R = m * 0.115, W2 = m * 0.024, dotR = m * 0.026, cursorR = m * 0.027;
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, white = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          if (mark(px, py, cx, cy, R, W2, dotR, cursorR)) {
            white++;
          } else {
            const c = bg(py / H);
            r += c[0]; g += c[1]; b += c[2];
          }
        }
      const n = SS * SS, i = (y * W + x) * 4;
      rgba[i] = Math.round((r + white * 255) / n);
      rgba[i + 1] = Math.round((g + white * 255) / n);
      rgba[i + 2] = Math.round((b + white * 255) / n);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

let count = 0;
for (const dir of fs.readdirSync(res)) {
  if (!dir.startsWith('drawable')) continue;
  const file = path.join(res, dir, 'splash.png');
  if (!fs.existsSync(file)) continue;
  const { w, h } = pngSize(file); // 沿用原尺寸,保持与 styles/manifest 引用一致
  fs.writeFileSync(file, encodePNG(w, h, renderSplash(w, h)));
  console.log(`生成 ${dir}/splash.png (${w}x${h})`);
  count++;
}
if (!count) console.error('未找到任何 splash.png(需先 cap add android)');
