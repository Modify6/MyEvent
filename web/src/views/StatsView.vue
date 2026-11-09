<script setup>
// 统计：按分类的投入汇总（骨架——聚合逻辑放 stats/ 纯函数便于单测）
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { getEventsBetween, onChange } from '../db/repo.js';
import { rangeFor, shiftCursor, fmtDur } from '../lib/time.js';
import { useCatalogStore } from '../stores/catalog.js';
import dayjs from 'dayjs';

const catalog = useCatalogStore();
const period = ref('week');
const cursor = ref(Date.now());
const events = ref([]);
let un;
async function load() {
  events.value = await getEventsBetween(...Object.values(rangeFor(period.value, cursor.value)));
}
onMounted(async () => {
  un = onChange(load);
  await load();
});
onUnmounted(() => un?.());
watch([period, cursor], load);

const range = computed(() => rangeFor(period.value, cursor.value));
const headLabel = computed(() =>
  period.value === 'day'
    ? dayjs(range.value.start).format('M月D日')
    : period.value === 'week'
      ? dayjs(range.value.start).format('M月D日') + ' – ' + dayjs(range.value.end - 1).format('M月D日')
      : dayjs(range.value.start).format('YYYY年M月')
);

const byCat = computed(() => {
  const m = new Map();
  for (const e of events.value) m.set(e.categoryId, (m.get(e.categoryId) || 0) + (e.endAt - e.startAt));
  return [...m.entries()].map(([categoryId, ms]) => ({ categoryId, ms })).sort((a, b) => b.ms - a.ms);
});
const prev = () => (cursor.value = shiftCursor(period.value, cursor.value, -1));
const next = () => (cursor.value = shiftCursor(period.value, cursor.value, 1));
</script>

<template>
  <div class="page">
    <div class="page-head"><h1>统计</h1></div>
    <div class="stats-nav">
      <van-button size="small" round plain icon="arrow-left" @click="prev" />
      <div class="seg">
        <button :class="{ active: period === 'day' }" @click="period = 'day'">日</button>
        <button :class="{ active: period === 'week' }" @click="period = 'week'">周</button>
        <button :class="{ active: period === 'month' }" @click="period = 'month'">月</button>
      </div>
      <van-button size="small" round plain icon="arrow" @click="next" />
    </div>
    <div class="muted" style="text-align: center; margin: 6px 0 12px">{{ headLabel }}</div>
    <div class="card">
      <div v-for="t in byCat" :key="t.categoryId" class="bar-row">
        <span class="name">{{ catalog.catName(t.categoryId) }}</span>
        <div class="track">
          <div class="fill" :style="{ width: (t.ms / (byCat[0]?.ms || 1)) * 100 + '%', background: catalog.catColor(t.categoryId) }"></div>
        </div>
        <span class="val">{{ fmtDur(t.ms) }}</span>
      </div>
      <div v-if="!byCat.length" class="empty-tip">本时段暂无事件</div>
    </div>
  </div>
</template>

<style scoped>
.stats-nav { display: flex; align-items: center; gap: 10px; }
.seg { flex: 1; display: flex; background: var(--card-2); border-radius: 999px; padding: 3px; }
.seg button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 6px 0; font-size: 13px; color: var(--text-2); }
.seg button.active { background: var(--card); font-weight: 700; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
.bar-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; }
.bar-row .name { width: 56px; flex: none; font-size: 12px; color: var(--text-2); }
.bar-row .track { flex: 1; height: 8px; border-radius: 4px; background: var(--track); overflow: hidden; }
.bar-row .fill { height: 100%; border-radius: 4px; }
.bar-row .val { width: 64px; flex: none; font-size: 11px; color: var(--text-2); text-align: right; }
</style>
