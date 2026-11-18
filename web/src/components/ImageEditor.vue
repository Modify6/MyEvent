<script setup>
// 图片编辑器:一次编辑一张(旋转 90°/裁切 方形·自由/所见即所得预览),多文件自动成队列
// 应用 = 旋转 canvas → 裁切映射 → calcTargetSize 压缩(1280/JPEG0.82);跳过 = 沿用默认压缩
import { computed, nextTick, ref, watch } from 'vue';
import { showFailToast } from 'vant';
import { calcTargetSize, readAsImage, rotatedSize } from '../lib/image.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  queue: { type: Array, required: true }, // File 数组
});
const emit = defineEmits(['confirm', 'update:show']);

const stageRef = ref(null);
const wrapRef = ref(null);
const previewUrl = ref('');
const rotation = ref(0);
const mode = ref('free'); // 'free' | 'square'
const idx = ref(0);
const disp = ref({ w: 1, h: 1 }); // 预览图显示像素尺寸(映射基准)
const results = ref([]);
const peek = ref(false); // 按住「查看全图」时隐藏裁切遮罩,亮看整张原图
let srcImg = null; // 当前文件的 HTMLImageElement
let dragging = null; // { type:'box'|handle, startX, startY, orig:{x,y,w,h} }

// 裁切框(显示像素坐标,相对预览图)
const crop = ref({ x: 0, y: 0, w: 0, h: 0 });

const total = computed(() => props.queue.length);

function initCropSquare() {
  const side = Math.min(disp.value.w, disp.value.h) * 0.8;
  crop.value = {
    x: (disp.value.w - side) / 2,
    y: (disp.value.h - side) / 2,
    w: side,
    h: side,
  };
}
function initCropFree() {
  // 0.9.14:默认全图(不裁就不暗),需要裁再拖角点收缩
  crop.value = { x: 0, y: 0, w: disp.value.w, h: disp.value.h };
}

// 旋转后的预览 dataURL(长边 ≤2048,只做展示;应用时按原图全分辨率裁切)
function buildPreview() {
  if (!srcImg) return;
  const rot = rotatedSize(srcImg.naturalWidth, srcImg.naturalHeight, rotation.value);
  const k = Math.min(1, 2048 / Math.max(rot.w, rot.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(rot.w * k));
  c.height = Math.max(1, Math.round(rot.h * k));
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation.value * Math.PI) / 180);
  ctx.drawImage(srcImg, -srcImg.naturalWidth / 2, -srcImg.naturalHeight / 2);
  previewUrl.value = c.toDataURL('image/jpeg', 0.9);
}

async function loadCurrent() {
  const file = props.queue[idx.value];
  if (!file) return;
  rotation.value = 0;
  srcImg = await readAsImage(file);
  await nextTick();
  buildPreview();
  await nextTick();
  measure();
  mode.value === 'square' ? initCropSquare() : initCropFree();
}
function measure() {
  const r = wrapRef.value?.getBoundingClientRect();
  if (r && r.width) disp.value = { w: r.width, h: r.height };
  if (crop.value.w === 0) (mode.value === 'square' ? initCropSquare : initCropFree)();
}

watch(
  () => props.show,
  async (v) => {
    if (!v) return;
    results.value = [];
    idx.value = 0;
    try {
      await loadCurrent();
    } catch (e) {
      showFailToast(e.message);
      nextInQueue();
    }
  }
);

async function rotate(delta) {
  rotation.value = (rotation.value + delta + 360) % 360;
  buildPreview();
  await nextTick();
  // 旋转后重新测量,裁切框按新显示尺寸重置为居中
  measure();
  (mode.value === 'square' ? initCropSquare : initCropFree)();
}

function switchMode(m) {
  mode.value = m;
  m === 'square' ? initCropSquare() : initCropFree();
}

// —— 裁切框拖拽(pointer 事件,兼容触摸) ——
function onBoxDown(e, type) {
  e.preventDefault();
  dragging = { type, startX: e.clientX, startY: e.clientY, orig: { ...crop.value } };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragUp, { once: true });
}
function onDragMove(e) {
  if (!dragging) return;
  const dx = e.clientX - dragging.startX;
  const dy = e.clientY - dragging.startY;
  const o = dragging.orig;
  const W = disp.value.w;
  const H = disp.value.h;
  let { x, y, w, h } = o;
  const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  if (dragging.type === 'box') {
    x = clampN(o.x + dx, 0, W - w);
    y = clampN(o.y + dy, 0, H - h);
  } else {
    // 四角手柄:固定对角,拖动对应角
    let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
    if (dragging.type.includes('l')) x1 = clampN(o.x + dx, 0, x2 - 20);
    if (dragging.type.includes('r')) x2 = clampN(o.x + o.w + dx, x1 + 20, W);
    if (dragging.type.includes('t')) y1 = clampN(o.y + dy, 0, y2 - 20);
    if (dragging.type.includes('b')) y2 = clampN(o.y + o.h + dy, y1 + 20, H);
    x = x1; y = y1; w = x2 - x1; h = y2 - y1;
    if (mode.value === 'square') {
      // 固定对角,边长取主轴位移,边界内钳制
      let side = Math.max(Math.abs(dx), Math.abs(dy), 20);
      if (dragging.type.includes('l')) side = Math.min(side, x2, o.x + o.w);
      if (dragging.type.includes('r')) side = Math.min(side, W - o.x, o.w + dx);
      if (dragging.type.includes('t')) side = Math.min(side, y2, o.y + o.h);
      if (dragging.type.includes('b')) side = Math.min(side, H - o.y, o.h + dy);
      side = Math.max(20, side);
      if (dragging.type.includes('l')) { x = x2 - side; y = dragging.type.includes('t') ? y2 - side : y1; }
      else if (dragging.type.includes('t')) { y = y2 - side; x = o.x; }
      else if (dragging.type.includes('b')) { y = y1; x = o.x; }
      else { x = x1; y = y1; }
      w = side; h = side;
      crop.value = { x, y, w, h };
      return;
    }
    w = Math.max(20, w);
    h = Math.max(20, h);
  }
  crop.value = { x, y, w, h };
}
function onDragUp() {
  dragging = null;
  window.removeEventListener('pointermove', onDragMove);
}

const cropStyle = computed(() => ({
  left: `${(crop.value.x / disp.value.w) * 100}%`,
  top: `${(crop.value.y / disp.value.h) * 100}%`,
  width: `${(crop.value.w / disp.value.w) * 100}%`,
  height: `${(crop.value.h / disp.value.h) * 100}%`,
}));

// 应用:全分辨率 旋转→裁切→压缩
async function apply() {
  if (!srcImg) return;
  const rot = rotatedSize(srcImg.naturalWidth, srcImg.naturalHeight, rotation.value);
  const kx = rot.w / disp.value.w;
  const ky = rot.h / disp.value.h;
  const sx = Math.max(0, Math.min(rot.w - 1, crop.value.x * kx));
  const sy = Math.max(0, Math.min(rot.h - 1, crop.value.y * ky));
  const sw = Math.max(1, Math.min(rot.w - sx, crop.value.w * kx));
  const sh = Math.max(1, Math.min(rot.h - sy, crop.value.h * ky));
  const full = document.createElement('canvas');
  full.width = rot.w;
  full.height = rot.h;
  const ctx = full.getContext('2d');
  ctx.translate(full.width / 2, full.height / 2);
  ctx.rotate((rotation.value * Math.PI) / 180);
  ctx.drawImage(srcImg, -srcImg.naturalWidth / 2, -srcImg.naturalHeight / 2);
  const { w: tw, h: th } = calcTargetSize(Math.round(sw), Math.round(sh));
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  out.getContext('2d').drawImage(full, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, tw, th);
  results.value.push({ data: out.toDataURL('image/jpeg', 0.82), w: tw, h: th });
  nextInQueue();
}

function nextInQueue() {
  if (idx.value + 1 < total.value) {
    idx.value += 1;
    loadCurrent().catch((e) => {
      showFailToast(e.message);
      nextInQueue();
    });
  } else {
    finish();
  }
}
function finish() {
  emit('confirm', results.value);
  emit('update:show', false);
}
function skip() {
  nextInQueue();
}
function resetCrop() {
  measure();
  (mode.value === 'square' ? initCropSquare : initCropFree)();
}
</script>

<template>
  <van-popup :show="show" position="bottom" :style="{ height: '92vh' }" :z-index="2100" @update:show="emit('update:show', $event)">
    <div class="popup-safe ed-wrap">
      <div class="pop-head">
        <span>图片编辑 · 第 {{ idx + 1 }}/{{ total }} 张</span>
        <van-button size="small" plain round @click="finish">完成</van-button>
      </div>

      <div class="ed-stage" ref="stageRef">
        <div class="ed-imgwrap" ref="wrapRef">
          <img :src="previewUrl" class="ed-img" draggable="false" alt="" />
          <div v-if="!peek" class="ed-crop" :style="cropStyle" @pointerdown="onBoxDown($event, 'box')">
            <span class="ed-h tl" @pointerdown.stop="onBoxDown($event, 'tl')" />
            <span class="ed-h tr" @pointerdown.stop="onBoxDown($event, 'tr')" />
            <span class="ed-h bl" @pointerdown.stop="onBoxDown($event, 'bl')" />
            <span class="ed-h br" @pointerdown.stop="onBoxDown($event, 'br')" />
          </div>
        </div>
      </div>

      <div class="ed-tools">
        <van-button size="small" plain round icon="revoke" @click="rotate(-90)">左旋</van-button>
        <van-button size="small" plain round icon="replay" style="--van-icon:replay" @click="rotate(90)">右旋</van-button>
        <van-button size="small" plain round :type="mode === 'square' ? 'primary' : 'default'" @click="switchMode('square')">方形</van-button>
        <van-button size="small" plain round :type="mode === 'free' ? 'primary' : 'default'" @click="switchMode('free')">自由</van-button>
        <van-button size="small" plain round @click="resetCrop">重置</van-button>
        <van-button size="small" plain round class="peek-btn" @pointerdown.prevent="peek = true" @pointerup="peek = false" @pointerleave="peek = false">查看全图</van-button>
      </div>
      <div class="ed-actions">
        <van-button size="small" plain round @click="skip">跳过此张</van-button>
        <van-button size="small" type="primary" round @click="apply">应用</van-button>
      </div>
      <div class="muted ed-tip">暗色区域将被裁掉;「重置」恢复全图,「查看全图」按住可亮看整张原图;应用后自动压缩到长边 1280</div>
    </div>
  </van-popup>
</template>

<style scoped>
.ed-wrap { padding: 14px 12px 10px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; margin-bottom: 10px; }
.ed-stage { flex: 1; display: flex; align-items: center; justify-content: center; background: #14161c; border-radius: 12px; overflow: hidden; min-height: 0; }
.ed-imgwrap { position: relative; line-height: 0; max-width: 100%; max-height: 100%; }
.ed-img { max-width: 100%; max-height: 52vh; object-fit: contain; display: block; user-select: none; -webkit-user-select: none; }
.ed-crop { position: absolute; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55); cursor: move; touch-action: none; }
.ed-h { position: absolute; width: 22px; height: 22px; border: 3px solid #fff; background: rgba(0, 0, 0, 0.35); border-radius: 50%; touch-action: none; }
.ed-h.tl { left: -9px; top: -9px; cursor: nwse-resize; }
.ed-h.tr { right: -9px; top: -9px; cursor: nesw-resize; }
.ed-h.bl { left: -9px; bottom: -9px; cursor: nesw-resize; }
.ed-h.br { right: -9px; bottom: -9px; cursor: nwse-resize; }
.ed-tools { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.ed-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
.ed-tip { font-size: 11px; margin-top: 8px; text-align: center; }
.peek-btn { color: var(--brand); border-color: var(--brand); }
</style>
