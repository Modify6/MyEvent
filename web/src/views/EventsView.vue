<script setup>
// 线索列表:状态过滤 + 自定义文件夹抽屉(按 MyAsset 移植的账户模块?)——不:线索抽屉按自定义文件夹
// 实际结构:状态 seg + 对象下拉 + 关键词 + 自定义文件夹抽屉(未归类垫底)
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { useCatalogStore } from '../stores/catalog.js';
import { useFolderStore } from '../stores/folder.js';
import EventComposer from '../components/EventComposer.vue';
import FolderDrawer from '../components/FolderDrawer.vue';
import FolderManage from '../components/FolderManage.vue';
import MoveToFolder from '../components/MoveToFolder.vue';
import { fmtDate } from '../lib/time.js';
import { avatarColor } from '../lib/display.js';

const router = useRouter();
const store = useEventStore();
const subjectStore = useSubjectStore();
const catalog = useCatalogStore();
const folderStore = useFolderStore();
const showNew = ref(false);
const showManage = ref(false);

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

// 归纳分类:自定义文件夹抽屉 + 页内关键词 + 挂靠对象下拉
const fSubject = ref('');
const q = ref('');
const subjectOptions = computed(() => [
  { text: '全部对象', value: '' },
  ...subjectStore.active.map((s) => ({ text: s.name, value: s.id })),
]);
const baseFiltered = computed(() => {
  let arr = stateFilter.value === 'all' ? store.threads : store.threads.filter((e) => stateOf(e) === stateFilter.value);
  if (fSubject.value) arr = arr.filter((e) => (e.subjectIds || []).includes(fSubject.value));
  const kw = q.value.trim().toLowerCase();
  if (kw) arr = arr.filter((e) => [e.title, e.fact].some((t) => String(t || '').toLowerCase().includes(kw)));
  return arr;
});
const SORTS = [
  { key: 'activity', label: '最近活动' },
  { key: 'name', label: '名称' },
  { key: 'created', label: '创建时间' },
];
const SORT_KEY = 'myevent.eventSort';
const sortSel = ref(localStorage.getItem(SORT_KEY) || 'activity');
function setSort(k) {
  sortSel.value = k;
  localStorage.setItem(SORT_KEY, k);
}
const sortFn = (a, b) => {
  if (sortSel.value === 'name') return a.title.localeCompare(b.title, 'zh');
  if (sortSel.value === 'created') return (b.createdAt || 0) - (a.createdAt || 0);
  return (b.updatedAt || 0) - (a.updatedAt || 0);
};

// 抽屉:自定义文件夹(scope=event)+ 未分类(folderId 空)
const eventFolders = computed(() => folderStore.byScope('event'));
const unsorted = computed(() => baseFiltered.value.filter((e) => !e.folderId));
const drawers = computed(() => [
  ...eventFolders.value.map((f) => ({
    key: f.id, title: f.name, color: f.color, list: baseFiltered.value.filter((e) => e.folderId === f.id),
  })),
  { key: '未分类', title: '未分类', color: '#98a2b3', list: unsorted.value },
]);
const drawersFiltered = computed(() =>
  drawers.value.map((g) => ({ ...g, list: g.list.slice().sort(sortFn) })).filter((g) => g.list.length)
);

// 抽屉展开状态:按 folderId / 未分类 持久化
const OPEN_KEY = 'myevent.eventDrawers';
const openSet = ref(new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')));
function toggleDrawer(k) {
  const s = new Set(openSet.value);
  s.has(k) ? s.delete(k) : s.add(k);
  openSet.value = s;
  localStorage.setItem(OPEN_KEY, JSON.stringify([...s]));
}
const isOpen = (k) => openSet.value.has(k);

const lastAt = (e) => {
  let t = e.updatedAt || 0;
  for (const en of store.entries) if (!en.deleted && en.eventId === e.id && en.at > t) t = en.at;
  return t;
};
const emptyText = computed(() => {
  if (store.threads.length === 0) return '还没有线索';
  return '筛选无结果 —— 换个状态/对象或关键词试试';
});

// 移入文件夹
const showMove = ref(false);
const moveTarget = ref(null);
function openMove(e) {
  moveTarget.value = e;
  showMove.value = true;
}
async function onMoved() {
  await store.load();
}
const showFolderManage = ref(false);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>事件</h1>
      <div class="head-btns">
        <van-button size="small" plain round icon="setting-o" @click="showFolderManage = true">管理</van-button>
        <van-button size="small" round type="primary" icon="plus" @click="showNew = true">新线索</van-button>
      </div>
    </div>

    <div class="hint-line hint-brand">🧵 线索 = 一件持续跟进的事;完结/搁置只是标记,过程记录全保留</div>

    <van-search v-model="q" placeholder="搜线索标题 / 事实" shape="round" background="transparent" />

    <div class="seg" style="margin-bottom: 10px">
      <button :class="{ active: stateFilter === 'open' }" @click="stateFilter = 'open'">进行中 {{ counts.open }}</button>
      <button :class="{ active: stateFilter === 'done' }" @click="stateFilter = 'done'">已完结 {{ counts.done }}</button>
      <button :class="{ active: stateFilter === 'shelved' }" @click="stateFilter = 'shelved'">已搁置 {{ counts.shelved }}</button>
      <button :class="{ active: stateFilter === 'all' }" @click="stateFilter = 'all'">全部 {{ store.threads.length }}</button>
    </div>

    <van-dropdown-menu style="margin-bottom: 10px">
      <van-dropdown-item v-model="fSubject" :options="subjectOptions" title="对象" />
    </van-dropdown-menu>

    <FolderDrawer
      v-for="g in drawersFiltered"
      :key="g.key"
      :title="g.title"
      :color="g.color"
      :count="g.list.length"
      :open="isOpen(g.key)"
      @toggle="toggleDrawer(g.key)"
    >
      <div v-for="e in g.list" :key="e.id" class="ev-item" @click="router.push(`/events/${e.id}`)">
        <div class="avatar" :style="{ background: `color-mix(in srgb, ${avatarColor(e.id)} 16%, transparent)`, color: avatarColor(e.id) }">{{ e.title.slice(0, 1) }}</div>
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
    </FolderDrawer>
    <div v-if="!drawersFiltered.length" class="card">
      <div class="empty-tip">{{ emptyText[stateFilter] || '筛选无结果 —— 换个条件试试' }}</div>
      <van-button v-if="stateFilter === 'open' && !store.threads.length" type="primary" round block @click="showNew = true">创建第一条线索</van-button>
    </div>

    <EventComposer v-model:show="showNew" @saved="router.push(`/events/${$event.id}`)" />
    <FolderManage v-model:show="showFolderManage" scope="event" />
    <MoveToFolder
      v-if="moveTarget"
      v-model:show="showMove"
      scope="event"
      :item-id="moveTarget.id"
      :current-folder-id="moveTarget.folderId || ''"
      @moved="onMoved"
    />
  </div>
</template>

<style scoped>
.head-btns { display: flex; gap: 8px; }
.ev-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.ev-item:last-child { border-bottom: 0; }
.ev-main { flex: 1; min-width: 0; }
.ev-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ev-note { font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-side { display: flex; align-items: center; gap: 10px; }
.avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; }
</style>
