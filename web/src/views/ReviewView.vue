<script setup>
// 回顾页(P0 简化周报):本周新增/待办/场景频次/预判校准 —— 统计只服务于校准,不制造焦虑
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useCatalogStore } from '../stores/catalog.js';
import { calibrationBuckets, PREDICTION_VERIFIED, PREDICTION_KINDS } from '../lib/domain.js';
import { weekRange, fmtDate } from '../lib/time.js';

const router = useRouter();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const catalog = useCatalogStore();

// 周从周一开始;可左右切换查看最近几周
const cursor = ref(Date.now());
const range = computed(() => weekRange(cursor.value));
const weekLabel = computed(() => {
  const { start, end } = range.value;
  const sameMonth = dayjs(start).month() === dayjs(end).month();
  return `${dayjs(start).format('M月D日')} ~ ${dayjs(end).format(sameMonth ? 'D日' : 'M月D日')}`;
});
function shiftWeek(dir) {
  cursor.value = dayjs(cursor.value).add(dir * 7, 'day').valueOf();
}
const inRange = (t) => t >= range.value.start && t < range.value.end;

const weekEvents = computed(() => eventStore.active.filter((e) => inRange(e.startAt)));
const weekThoughts = computed(() => thoughtStore.active.filter((t) => inRange(t.at || t.createdAt)));
const weekEntries = computed(() => eventStore.entries.filter((en) => !en.deleted && inRange(en.at)));
const weekPredictions = computed(() => predictionStore.active.filter((p) => inRange(p.madeAt || p.createdAt)));
const weekVerified = computed(() => predictionStore.active.filter((p) => p.verifiedAt && inRange(p.verifiedAt)));
const weekReviewed = computed(() => weekEvents.value.filter((e) => e.status === 'reviewed'));

// 校准统计(全部历史,不限于本周 —— 分桶需要足够样本)
const buckets = computed(() => calibrationBuckets(predictionStore.active));
const byKind = computed(() =>
  PREDICTION_KINDS.map((k) => {
    const done = predictionStore.active.filter((p) => p.kind === k && PREDICTION_VERIFIED.includes(p.status));
    const score = done.reduce((s, p) => s + (p.status === 'hit' ? 1 : p.status === 'partial' ? 0.5 : 0), 0);
    return { kind: k, n: done.length, rate: done.length ? Math.round((score / done.length) * 100) : null };
  }).filter((x) => x.n > 0)
);

// 本周场景标签频次
const sceneFreq = computed(() => {
  const map = new Map();
  for (const e of weekEvents.value) {
    if (!e.categoryId) continue;
    map.set(e.categoryId, (map.get(e.categoryId) || 0) + 1);
  }
  const max = Math.max(1, ...map.values());
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ name: catalog.catName(id), n, pct: Math.round((n / max) * 100), color: catalog.catColor(id) }));
});

const todos = computed(() => [
  { label: '本周记录', n: weekThoughts.value.length + weekEntries.value.length, to: '/' },
  { label: '活跃线索', n: eventStore.threads.filter((e) => e.updatedAt >= range.value.start || (eventStore.entriesOf(e.id)[0]?.at ?? 0) >= range.value.start).length, to: '/events' },
  { label: '待验证预判', n: predictionStore.due.length, to: '/predictions' },
]);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>回顾</h1>
      <div class="week-nav">
        <van-icon name="arrow-left" @click="shiftWeek(-1)" />
        <span class="week-label" @click="cursor = Date.now()">{{ weekLabel }}</span>
        <van-icon name="arrow" @click="shiftWeek(1)" />
      </div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">本周概览</div>
      <div class="stat-grid">
        <div class="cell"><div class="num">{{ weekEvents.length }}</div><div class="lab">新事件</div></div>
        <div class="cell"><div class="num">{{ weekThoughts.length }}</div><div class="lab">新想法</div></div>
        <div class="cell"><div class="num">{{ weekPredictions.length }}</div><div class="lab">新预判</div></div>
        <div class="cell"><div class="num">{{ weekReviewed.length }}/{{ weekEvents.length }}</div><div class="lab">已复盘</div></div>
      </div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">本周动态</div>
      <div v-for="t in todos" :key="t.label" class="todo-line" @click="router.push(t.to)">
        <span>{{ t.label }}</span>
        <span class="todo-right" :class="{ hot: t.label === '待验证预判' && t.n > 0 }">{{ t.n }} {{ t.label === '待验证预判' ? '条 ›' : '›' }}</span>
      </div>
      <div v-if="weekVerified.length" class="muted" style="margin-top: 8px">本周完成验证 {{ weekVerified.length }} 条预判</div>
    </div>

    <div class="card" v-if="sceneFreq.length">
      <div class="section-title" style="margin-top: 0">本周高频场景</div>
      <div v-for="s in sceneFreq" :key="s.name" class="bar-row">
        <span class="name">{{ s.name }}</span>
        <div class="track"><div class="fill" :style="{ width: s.pct + '%', '--c': s.color }"></div></div>
        <span class="val">{{ s.n }} 次</span>
      </div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">置信度校准 · 全部历史<span class="muted">我说的 70% 真的是 70% 吗</span></div>
      <template v-if="buckets.some((b) => b.n > 0)">
        <div v-for="b in buckets" :key="b.label" class="bar-row">
          <span class="name">{{ b.label }}</span>
          <div class="track">
            <div class="fill" :style="{ width: (b.rate ?? 0) + '%' }"></div>
            <div class="ideal" :style="{ left: b.ideal + '%' }"></div>
          </div>
          <span class="val">{{ b.rate == null ? '—' : b.rate + '%' }}<span class="muted"> / {{ b.n }}条</span></span>
        </div>
        <div class="muted" style="margin-top: 6px">竖线 = 完美校准位置:实际命中率(条)越接近它,你的置信度越准。</div>
      </template>
      <div v-else class="empty-tip">还没有已验证的预判 —— 锁定几条预判并等窗口到期,校准曲线会出现在这里</div>
    </div>

    <div class="card" v-if="byKind.length">
      <div class="section-title" style="margin-top: 0">按类型命中率 · 我擅长哪种判断</div>
      <div v-for="k in byKind" :key="k.kind" class="bar-row">
        <span class="name">{{ k.kind }}</span>
        <div class="track"><div class="fill" :style="{ width: k.rate + '%' }"></div></div>
        <span class="val">{{ k.rate }}% / {{ k.n }}条</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-nav { display: flex; align-items: center; gap: 12px; color: var(--text-2); font-size: 13px; cursor: pointer; }
.week-label { min-width: 110px; text-align: center; }
.todo-line { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 14px; cursor: pointer; }
.todo-line:last-child { border-bottom: 0; }
.todo-right { font-size: 13px; color: var(--text-3); }
.todo-right.hot { color: #f5a623; font-weight: 600; }
.bar-row .track { position: relative; }
.ideal { position: absolute; top: -2px; bottom: -2px; width: 1.5px; background: var(--text-3); opacity: 0.5; }
</style>
