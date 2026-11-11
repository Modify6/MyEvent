<script setup>
// 线索列表:按状态过滤(默认进行中);每条按最后活动倒序,点击进入过程时间线
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { useEventStore } from '../stores/event.js';
import { useCatalogStore } from '../stores/catalog.js';
import EventComposer from '../components/EventComposer.vue';
import { fmtDate } from '../lib/time.js';

const router = useRouter();
const store = useEventStore();
const catalog = useCatalogStore();
const showNew = ref(false);

// 软收尾:默认只看进行中;完结/搁置的线索沉到对应过滤里,过程全保留
const STATE_META = {
  open: { label: '进行中', type: 'primary' },
  done: { label: '已完结', type: 'success' },
  shelved: { label: '已搁置', type: 'warning' },
};
const stateOf = (e) => e.threadState || 'open';
const stateFilter = ref('open');
const counts = computed(() => {
  const c = { open: 0, done: 0, shelved: 0 };
  for (const e of store.threads) c[stateOf(e)]++;
  return c;
});
const filtered = computed(() =>
  stateFilter.value === 'all' ? store.threads : store.threads.filter((e) => stateOf(e) === stateFilter.value)
);

const lastAt = (e) => {
  let t = e.updatedAt || 0;
  for (const en of store.entries) if (!en.deleted && en.eventId === e.id && en.at > t) t = en.at;
  return t;
};
const emptyText = {
  all: '还没有线索',
  open: '没有进行中的线索 —— 一件开始跟进的事就是一条线索',
  done: '还没有已完结的线索',
  shelved: '没有搁置的线索',
};
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>事件</h1>
      <van-button size="small" round type="primary" icon="plus" @click="showNew = true">新线索</van-button>
    </div>

    <div class="hint-line hint-brand">🧵 线索 = 一件持续跟进的事;完结/搁置只是标记,过程记录全保留</div>

    <div class="seg" style="margin-bottom: 12px">
      <button :class="{ active: stateFilter === 'open' }" @click="stateFilter = 'open'">进行中 {{ counts.open }}</button>
      <button :class="{ active: stateFilter === 'done' }" @click="stateFilter = 'done'">已完结 {{ counts.done }}</button>
      <button :class="{ active: stateFilter === 'shelved' }" @click="stateFilter = 'shelved'">已搁置 {{ counts.shelved }}</button>
      <button :class="{ active: stateFilter === 'all' }" @click="stateFilter = 'all'">全部 {{ store.threads.length }}</button>
    </div>

    <div v-if="filtered.length" class="card">
      <div v-for="e in filtered" :key="e.id" class="ev-item" @click="router.push(`/events/${e.id}`)">
        <div class="ev-main">
          <div class="ev-title">
            {{ e.title }}
            <span v-if="e.categoryId" class="chip" :style="{ '--c': catalog.catColor(e.categoryId) }">{{ catalog.catName(e.categoryId) }}</span>
          </div>
          <div class="muted">
            {{ fmtDate(e.startAt) }} 开始<template v-if="store.entryCountOf(e.id)"> · {{ store.entryCountOf(e.id) }} 条记录</template>
            <template v-if="lastAt(e) > e.startAt"> · 最近 {{ dayjs(lastAt(e)).format('M月D日') }}</template>
          </div>
          <div v-if="e.fact" class="muted ev-note">{{ e.fact }}</div>
        </div>
        <div class="ev-side">
          <van-tag v-if="stateFilter === 'all'" :type="STATE_META[stateOf(e)].type" plain round size="medium">{{ STATE_META[stateOf(e)].label }}</van-tag>
          <van-icon name="arrow" color="var(--text-3)" />
        </div>
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-tip">{{ emptyText[stateFilter] }}</div>
      <van-button v-if="stateFilter === 'open' && !store.threads.length" type="primary" round block @click="showNew = true">创建第一条线索</van-button>
    </div>

    <EventComposer v-model:show="showNew" @saved="router.push(`/events/${$event.id}`)" />
  </div>
</template>

<style scoped>
.ev-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.ev-item:last-child { border-bottom: 0; }
.ev-main { flex: 1; min-width: 0; }
.ev-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ev-note { font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-side { display: flex; align-items: center; gap: 10px; }
</style>
