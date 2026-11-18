<script setup>
// 全屏图片预览层(自研,替代 vant showImagePreview):黑底居中 contain,左右翻页,点背景关闭
// 自研原因:vant 预览在弹层之上叠开时容器宽度偶发塌陷成竖条
import { ref, watch } from 'vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  images: { type: Array, required: true }, // dataURL 数组
  start: { type: Number, default: 0 },
});
const emit = defineEmits(['close']);

const idx = ref(0);
watch(
  () => props.show,
  (v) => {
    if (v) idx.value = Math.min(props.start || 0, (props.images || []).length - 1);
  }
);
function prev() {
  if (idx.value > 0) idx.value--;
}
function next() {
  if (idx.value < (props.images || []).length - 1) idx.value++;
}
</script>

<template>
  <teleport to="body">
    <div v-if="show" class="ipo-overlay" @click="emit('close')">
      <img v-if="images[idx]" :src="images[idx]" class="ipo-img" alt="" @click.stop />
      <span v-if="images.length > 1" class="ipo-nav left" @click.stop="prev">‹</span>
      <span v-if="images.length > 1" class="ipo-nav right" @click.stop="next">›</span>
      <span class="ipo-close" @click="emit('close')">✕</span>
      <span v-if="images.length > 1" class="ipo-count">{{ idx + 1 }} / {{ images.length }}</span>
    </div>
  </teleport>
</template>

<style>
.ipo-overlay { position: fixed; inset: 0; z-index: 2300; background: rgba(0, 0, 0, 0.94); display: flex; align-items: center; justify-content: center; }
.ipo-img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
.ipo-nav { position: fixed; top: 50%; transform: translateY(-50%); font-size: 42px; line-height: 1; color: rgba(255, 255, 255, 0.85); padding: 18px 14px; cursor: pointer; user-select: none; }
.ipo-nav.left { left: 4px; }
.ipo-nav.right { right: 4px; }
.ipo-close { position: fixed; top: 16px; right: 16px; width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, 0.16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; }
.ipo-count { position: fixed; top: 26px; left: 22px; color: rgba(255, 255, 255, 0.8); font-size: 13px; font-variant-numeric: tabular-nums; }
</style>
