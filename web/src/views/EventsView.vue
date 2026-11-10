<script setup>
// 线索列表:每条线索按最后活动倒序;点击进入过程时间线
import { ref } from 'vue';
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

const lastAt = (e) => {
  let t = e.updatedAt || 0;
  for (const en of store.entries) if (!en.deleted && en.eventId === e.id && en.at > t) t = en.at;
  return t;
};
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>事件</h1>
      <van-button size="small" round type="primary" icon="plus" @click="showNew = true">新线索</van-button>
    </div>

    <div class="hint-line">线索 = 一件持续跟进的事;所有过程记录、想法、小结都挂在它的时间线上,点进去看完整演化</div>
    <div v-if="store.threads.length" class="card">
      <div v-for="e in store.threads" :key="e.id" class="ev-item" @click="router.push(`/events/${e.id}`)">
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
        <van-icon name="arrow" color="var(--text-3)" />
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-tip">还没有线索 —— 一个持续跟进的事情(一个项目/一次决策/一段关系)就是一条线索,<br />过程记录都会挂在它下面</div>
      <van-button type="primary" round block @click="showNew = true">创建第一条线索</van-button>
    </div>

    <EventComposer v-model:show="showNew" @saved="router.push(`/events/${$event.id}`)" />
  </div>
</template>

<style scoped>
.hint-line { font-size: 12px; color: var(--text-3); margin: -2px 2px 8px; }
.ev-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.ev-item:last-child { border-bottom: 0; }
.ev-main { flex: 1; min-width: 0; }
.ev-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ev-note { font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
