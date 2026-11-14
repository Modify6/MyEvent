<script setup>
// 对象列表:按类型分文件夹抽屉 + 排序切换 + 页内关键词
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSubjectStore } from '../stores/subject.js';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useFolderStore } from '../stores/folder.js';
import SubjectForm from '../components/SubjectForm.vue';
import FolderManage from '../components/FolderManage.vue';
import MoveToFolder from '../components/MoveToFolder.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import FolderDrawer from '../components/FolderDrawer.vue';
import { typeColor, avatarColor } from '../lib/display.js';
import { SUBJECT_TYPES } from '../lib/domain.js';

const router = useRouter();
const store = useSubjectStore();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const folderStore = useFolderStore();
const showForm = ref(false);
const showManage = ref(false);
const showMove = ref(false);
const moveTarget = ref(null);
function openMove(s) {
  moveTarget.value = s;
  showMove.value = true;
}
async function onMoved() {
  await store.load();
}

// 页内关键词(名称/当前观点/标签)
const q = ref('');
const matchKw = (s) => {
  const kw = q.value.trim().toLowerCase();
  if (!kw) return true;
  return [s.name, s.currentView, (s.tags || []).join(' ')].some((t) => String(t || '').toLowerCase().includes(kw));
};

// 抽屉内排序:最近活动(updatedAt,默认)/ 名称 / 创建时间
const SORTS = [
  { key: 'activity', label: '最近活动' },
  { key: 'name', label: '名称' },
  { key: 'created', label: '创建时间' },
];
const SORT_KEY = 'myevent.subjectSort';
const sortSel = ref(localStorage.getItem(SORT_KEY) || 'activity');
function setSort(k) {
  sortSel.value = k;
  localStorage.setItem(SORT_KEY, k);
}
const sortFn = (a, b) => {
  if (sortSel.value === 'name') return a.name.localeCompare(b.name, 'zh');
  if (sortSel.value === 'created') return (b.createdAt || 0) - (a.createdAt || 0);
  return (b.updatedAt || 0) - (a.updatedAt || 0);
};

// 按自定义文件夹分组抽屉(scope=subject)+ 未分类(folderId 空);组内排序;关键词过滤组内条目
const drawers = computed(() => {
  const arr = store.active.filter(matchKw).sort(sortFn);
  const groups = folderStore.byScope('subject').map((f) => ({
    key: f.id, title: f.name, color: f.color, list: arr.filter((s) => s.folderId === f.id),
  }));
  const loose = arr.filter((s) => !s.folderId);
  if (loose.length) groups.push({ key: '未分类', title: '未分类', color: '#98a2b3', list: loose });
  return groups;
});

// 抽屉展开状态持久化
const OPEN_KEY = 'myevent.subjectDrawers';
const openSet = ref(new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')));
function toggleDrawer(t) {
  const s = new Set(openSet.value);
  s.has(t) ? s.delete(t) : s.add(t);
  openSet.value = s;
  localStorage.setItem(OPEN_KEY, JSON.stringify([...s]));
}
const isOpen = (t) => openSet.value.has(t);

// 每对象统计:线索 / 记录 / 预判
const statsOf = (id) => ({
  threads: eventStore.active.filter((e) => (e.subjectIds || []).includes(id)).length,
  notes: thoughtStore.ofSubject(id).length,
  preds: predictionStore.ofSubject(id).length,
});
const avatarStyle = (s) => {
  const c = avatarColor(s.id);
  return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c };
};
const typeStyle = (s) => {
  const c = typeColor(s.type);
  return { color: c, borderColor: c + '59', background: c + '1f' };
};
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>对象</h1>
      <div class="head-btns">
        <van-button size="small" plain round icon="setting-o" @click="showManage = true">管理</van-button>
        <van-button size="small" round type="primary" icon="plus" @click="showForm = true">新建</van-button>
      </div>
    </div>

    <div class="hint-line hint-brand">🎯 对象 = 长期关注的主体(人 / 项目 / 公司 / 主题):想法挂上去,时间线就是认知演化史</div>

    <template v-if="store.active.length">
      <van-search v-model="q" placeholder="搜名称 / 观点 / 标签" shape="round" background="transparent" />

      <div class="seg" style="margin-bottom: 10px">
        <button
          v-for="sOpt in SORTS"
          :key="sOpt.key"
          :class="{ active: sortSel === sOpt.key }"
          @click="setSort(sOpt.key)"
        >{{ sOpt.label }}</button>
      </div>

      <FolderDrawer
        v-for="g in drawers"
        :key="g.type"
        :title="g.type"
        :color="g.color"
        :count="g.list.length"
        :open="isOpen(g.type)"
        @toggle="toggleDrawer(g.type)"
      >
        <div v-for="s in g.list" :key="s.id" class="subj-line" @click="router.push(`/subjects/${s.id}`)">
          <div class="avatar" :style="avatarStyle(s)">{{ s.name.slice(0, 1) }}</div>
          <div class="row-main">
            <div class="row-title">
              {{ s.name }}
              <span class="type-tag" :style="typeStyle(s)">{{ s.type }}</span>
            </div>
            <div v-if="s.currentView" class="muted view-line">{{ s.currentView }}</div>
            <div class="muted stats">{{ statsOf(s.id).threads }} 线索 · {{ statsOf(s.id).notes }} 记录<template v-if="statsOf(s.id).preds"> · {{ statsOf(s.id).preds }} 预判</template></div>
          </div>
          <div class="right-col">
            <van-icon name="exchange" color="var(--text-3)" title="移入文件夹" @click.stop="openMove(s)" />
            <ConfidenceBar v-if="s.currentConfidence != null" :value="s.currentConfidence" style="width: 76px" />
            <van-icon name="arrow" color="var(--text-3)" />
          </div>
        </div>
      </FolderDrawer>
      <div v-if="!drawers.length" class="card">
        <div class="empty-tip">筛选无结果 —— 换个关键词试试</div>
      </div>
    </template>
    <div v-else class="card">
      <div class="empty-tip">还没有对象。<br />把长期关注的一个人、一个项目、一个投资标的建进来,<br />它的事实、想法、预判都会在这里沉淀。</div>
      <van-button type="primary" round block @click="showForm = true">创建第一个对象</van-button>
    </div>

    <SubjectForm v-model:show="showForm" />
    <FolderManage v-model:show="showManage" scope="subject" />
    <MoveToFolder
      v-if="moveTarget"
      v-model:show="showMove"
      scope="subject"
      :item-id="moveTarget.id"
      :current-folder-id="moveTarget.folderId || ''"
      @moved="onMoved"
    />
  </div>
</template>

<style scoped>
.subj-line { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.subj-line:last-child { border-bottom: 0; }
.avatar { flex: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 700; }
.row-main { flex: 1; min-width: 0; }
.row-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.type-tag { flex: none; font-size: 10px; border: 1px solid; border-radius: 4px; padding: 0 5px; font-weight: 600; }
.view-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.stats { font-size: 11px; margin-top: 2px; }
.right-col { display: flex; align-items: center; gap: 8px; }
.head-btns { display: flex; gap: 8px; }
.right-col .van-icon[name="exchange"] { cursor: pointer; }
</style>
