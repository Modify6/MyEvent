<script setup>
// 事件时间线：全部事件按天分组倒序
import { onMounted, onUnmounted, ref } from 'vue';
import { getAllEvents, onChange } from '../db/repo.js';
import { useEventStore } from '../stores/event.js';
import { useCatalogStore } from '../stores/catalog.js';
import { fmtDur } from '../lib/time.js';
import dayjs from 'dayjs';

const store = useEventStore();
const catalog = useCatalogStore();
const events = ref([]);
let un;
async function load() {
  events.value = (await getAllEvents()).filter((e) => e.endAt != null).sort((a, b) => b.startAt - a.startAt);
}
onMounted(async () => {
  un = onChange(load);
  await store.load();
  await load();
});
onUnmounted(() => un?.());

const groups = computed(() => {
  const map = new Map();
  for (const e of events.value) {
    const key = dayjs(e.startAt).format('YYYY-MM-DD');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.entries()].map(([key, list]) => ({ key, label: dayjs(key).format('M月D日 dd'), list }));
});
import { computed } from 'vue';

async function removeEv(id) {
  await store.remove(id);
}
</script>

<template>
  <div class="page">
    <div class="page-head"><h1>事件</h1></div>
    <template v-for="g in groups" :key="g.key">
      <div class="section-title">{{ g.label }}</div>
      <div class="card">
        <div v-for="e in g.list" :key="e.id" class="ev-item">
          <div class="ev-main">
            <b>{{ e.title }}</b>
            <span class="muted" style="margin-left: 6px">{{ fmtDur(e.endAt - e.startAt) }}</span>
            <span v-if="e.location" class="muted"> · {{ e.location }}</span>
            <div v-if="e.note" class="muted ev-note">{{ e.note }}</div>
          </div>
          <van-button size="mini" plain round type="danger" @click="removeEv(e.id)">删</van-button>
        </div>
      </div>
    </template>
    <div v-if="!groups.length" class="card"><div class="empty-tip">还没有事件记录——去「今日」开始第一个</div></div>
  </div>
</template>

<style scoped>
.ev-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--line); }
.ev-item:last-child { border-bottom: 0; }
.ev-note { font-size: 12px; margin-top: 3px; }
</style>
