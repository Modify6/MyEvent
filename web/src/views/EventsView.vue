<script setup>
// 事件时间线:全部事件按天分组倒序;点击进入复盘(捕获→复盘一体的分步表单)
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog } from 'vant';
import dayjs from 'dayjs';
import { useEventStore } from '../stores/event.js';
import { useCatalogStore } from '../stores/catalog.js';
import ReviewForm from '../components/ReviewForm.vue';
import StatusTag from '../components/StatusTag.vue';

const router = useRouter();
const store = useEventStore();
const catalog = useCatalogStore();
const showReview = ref(false);
const reviewEventId = ref('');

const groups = computed(() => {
  const map = new Map();
  for (const e of [...store.active].sort((a, b) => b.startAt - a.startAt)) {
    const key = dayjs(e.startAt).format('YYYY-MM-DD');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.entries()].map(([key, list]) => ({ key, label: dayjs(key).format('M月D日 dd'), list }));
});

function open(e) {
  reviewEventId.value = e.id;
  showReview.value = true;
}

async function removeEv(e) {
  try {
    await showConfirmDialog({ title: '删除事件?', message: `「${e.title}」及其复盘内容将移入回收状态(软删)。`, confirmButtonText: '删除' });
    await store.remove(e.id);
  } catch {}
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="head-name"><van-icon name="arrow-left" size="20" @click="router.back()" />全部事件</h1>
    </div>

    <template v-for="g in groups" :key="g.key">
      <div class="section-title">{{ g.label }}</div>
      <div class="card">
        <div v-for="e in g.list" :key="e.id" class="ev-item">
          <div class="ev-main" @click="open(e)">
            <div class="ev-title">
              {{ e.title }}
              <span v-if="e.categoryId" class="chip" :style="{ '--c': catalog.catColor(e.categoryId) }">{{ catalog.catName(e.categoryId) }}</span>
            </div>
            <div v-if="e.fact" class="muted ev-note">{{ e.fact }}</div>
          </div>
          <div class="ev-side">
            <StatusTag kind="event" :status="e.status" />
            <van-icon name="cross" color="var(--text-3)" size="16" @click="removeEv(e)" />
          </div>
        </div>
      </div>
    </template>
    <div v-if="!groups.length" class="card">
      <div class="empty-tip">还没有事件 —— 去收件箱「记事件」</div>
    </div>

    <ReviewForm v-model:show="showReview" :event-id="reviewEventId" />
  </div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.ev-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.ev-item:last-child { border-bottom: 0; }
.ev-main { flex: 1; min-width: 0; cursor: pointer; }
.ev-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ev-note { font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-side { display: flex; align-items: center; gap: 12px; }
.ev-side .van-icon { cursor: pointer; }
</style>
