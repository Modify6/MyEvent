<script setup>
// 今日页：进行中的事件 + 快捷开始
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useCatalogStore } from '../stores/catalog.js';
import { getCategories } from '../db/repo.js';
import { fmtClock, fmtDur } from '../lib/time.js';

const store = useEventStore();
const catalog = useCatalogStore();
const now = ref(Date.now());
let tick;
onMounted(() => {
  store.load();
  catalog.load();
  tick = setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => clearInterval(tick));

const title = ref('');
const categoryId = ref('cat-work');
const location = ref('');

async function start() {
  try {
    await store.start({ title: title.value, categoryId: categoryId.value, location: location.value });
    title.value = '';
    location.value = '';
    showToast('已开始');
  } catch (e) {
    showToast(e.message);
  }
}
async function finish() {
  const ev = await store.finishCurrent();
  if (ev) showToast(`已结束「${ev.title}」用时 ${fmtDur(now.value - ev.startAt)}`);
}
const elapsed = computed(() => (store.running ? now.value - store.running.startAt : 0));
</script>

<template>
  <div class="page">
    <div class="page-head"><h1>今日</h1><SyncDot /></div>

    <div v-if="store.running" class="card run-card">
      <div class="run-title">{{ store.running.title }}</div>
      <div class="run-clock">{{ fmtClock(elapsed) }}</div>
      <div class="muted">从 {{ new Date(store.running.startAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }} 开始</div>
      <van-button type="primary" block round style="margin-top: 14px" @click="finish">结束事件</van-button>
    </div>

    <div v-else class="card">
      <van-field v-model="title" placeholder="事件名称（如：团队周会）" />
      <van-field v-model="location" placeholder="地点（选填）" />
      <div class="cat-row">
        <button
          v-for="c in catalog.categories.filter((x) => !x.deleted)"
          :key="c.id"
          class="cat-chip"
          :class="{ active: categoryId === c.id }"
          :style="categoryId === c.id ? { borderColor: c.color, color: c.color } : {}"
          @click="categoryId = c.id"
        >{{ c.name }}</button>
      </div>
      <van-button type="primary" block round style="margin-top: 10px" @click="start">开始事件</van-button>
    </div>

    <div v-if="store.upcoming.length" class="card">
      <div class="section-title" style="margin-top: 0">即将开始</div>
      <div v-for="e in store.upcoming.slice(0, 5)" :key="e.id" class="ev-line">
        <span>{{ e.title }}</span>
        <span class="muted">{{ new Date(e.startAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-card { text-align: center; padding: 26px 16px; }
.run-title { font-size: 17px; font-weight: 700; }
.run-clock { font-size: 44px; font-weight: 800; color: var(--brand); margin: 10px 0; font-variant-numeric: tabular-nums; }
.cat-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.cat-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 6px 14px; font-size: 12px; color: var(--text-2); }
.cat-chip.active { border-width: 1.5px; font-weight: 600; }
.ev-line { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
</style>
