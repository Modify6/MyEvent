<script setup>
// 置信度条：0–100 展示（null = 未定，不渲染数值）
import { computed } from 'vue';
import { clampPct } from '../lib/domain.js';

const props = defineProps({
  value: { type: [Number, String], default: null },
  size: { type: String, default: 'sm' }, // sm | lg
});

const pct = computed(() => clampPct(props.value));
const color = computed(() => {
  if (pct.value == null) return 'var(--text-3)';
  if (pct.value >= 80) return 'var(--danger)';
  if (pct.value >= 65) return '#f5a623';
  return 'var(--brand)';
});
</script>

<template>
  <div class="conf" :class="size">
    <div class="track"><div class="fill" :style="{ width: (pct ?? 0) + '%', background: color }"></div></div>
    <span class="num" :style="{ color }">{{ pct == null ? '未定' : pct + '%' }}</span>
  </div>
</template>

<style scoped>
.conf { display: flex; align-items: center; gap: 8px; }
.conf .track { flex: 1; height: 6px; border-radius: 3px; background: var(--track); overflow: hidden; }
.conf.lg .track { height: 8px; border-radius: 4px; }
.conf .fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.conf .num { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.conf.lg .num { font-size: 14px; }
</style>
