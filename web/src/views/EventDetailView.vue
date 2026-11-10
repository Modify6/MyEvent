<script setup>
// 线索详情:头部信息 + [记一笔][写小结] + 过程时间线(过程记录 ∪ 挂靠想法,倒序;小结高亮)
// 小结 = kind='summary' 的过程记录,自由文本、可多次、随时 —— 总结水到渠成,不设完成标准
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { useSubjectStore } from '../stores/subject.js';
import { useCatalogStore } from '../stores/catalog.js';
import NoteComposer from '../components/NoteComposer.vue';
import NoteEditor from '../components/NoteEditor.vue';
import { fmtDate, fmtTime } from '../lib/time.js';

const route = useRoute();
const router = useRouter();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const subjectStore = useSubjectStore();
const catalog = useCatalogStore();

const eid = computed(() => route.params.id);
const ev = computed(() => eventStore.byId(eid.value));

// 过程时间线:过程记录(含小结) + 挂靠本线索的随手记,倒序
const timeline = computed(() => {
  const items = [];
  for (const en of eventStore.entriesOf(eid.value)) {
    items.push({
      key: 'en:' + en.id, type: 'e', raw: en, kind: en.kind === 'summary' ? '小结' : '记录', summary: en.kind === 'summary',
      content: en.content, at: en.at, edited: (en.edits || []).length > 0,
      trigger: en.triggerKind ? `由${en.triggerKind}触发${en.triggerNote ? ':' + en.triggerNote : ''}` : (en.triggerNote || ''),
    });
  }
  for (const t of thoughtStore.ofEvent(eid.value)) {
    items.push({
      key: 't:' + t.id, type: 't', raw: t, kind: t.kind + ' · 挂记', summary: false,
      content: t.content, at: t.at, edited: (t.edits || []).length > 0,
      trigger: t.source || '',
    });
  }
  return items.sort((a, b) => b.at - a.at);
});

// 二次修改:左滑编辑/删除;旧值自动存入修订历史
const showEditor = ref(false);
const editItem = ref(null);
function openEdit(it) {
  editItem.value = it;
  showEditor.value = true;
}
async function removeItem(it) {
  if (it.type === 't') await thoughtStore.remove(it.raw.id);
  else await eventStore.removeEntry(it.raw.id);
}

const showNote = ref(false);
const showSummary = ref(false);

async function removeThread() {
  try {
    await showConfirmDialog({ title: '删除这条线索?', message: `「${ev.value?.title}」及其过程记录将移入回收状态(软删)。`, confirmButtonText: '删除' });
    await eventStore.remove(eid.value);
    router.back();
  } catch {}
}
</script>

<template>
  <div class="page" v-if="ev">
    <div class="page-head">
      <h1 class="head-name">
        <van-icon name="arrow-left" size="20" @click="router.back()" />{{ ev.title }}
      </h1>
      <van-icon name="delete-o" size="20" color="var(--text-3)" @click="removeThread" />
    </div>

    <div class="card">
      <div class="meta-row">
        <span class="muted">开始于 {{ fmtDate(ev.startAt) }}</span>
        <span class="muted">· {{ timeline.length }} 条记录</span>
      </div>
      <div class="chips-row">
        <span v-if="ev.categoryId" class="chip" :style="{ '--c': catalog.catColor(ev.categoryId) }">{{ catalog.catName(ev.categoryId) }}</span>
        <span v-for="sid in ev.subjectIds" :key="sid" class="chip" @click="router.push(`/subjects/${sid}`)">@ {{ subjectStore.nameOf(sid) }}</span>
      </div>
      <div v-if="ev.fact" class="fact">{{ ev.fact }}</div>
      <div class="btn-row">
        <van-button type="primary" size="small" round icon="edit" @click="showNote = true">记一笔</van-button>
        <van-button plain type="primary" size="small" round icon="notes-o" @click="showSummary = true">写小结</van-button>
      </div>
    </div>

    <div class="section-title">过程时间线</div>
    <div class="card" v-if="timeline.length">
      <van-swipe-cell v-for="it in timeline" :key="it.key">
        <template #right>
          <van-button square type="primary" text="编辑" class="swipe-btn" @click="openEdit(it)" />
          <van-button square type="danger" text="删除" class="swipe-btn" @click="removeItem(it)" />
        </template>
        <div class="tl-item" :class="{ summary: it.summary }">
          <div class="tl-kind" :class="{ 'k-summary': it.summary }">{{ it.kind }}</div>
          <div class="row-main">
            <div class="tl-text">{{ it.content }}</div>
            <div class="muted">
              {{ fmtDate(it.at) }} {{ fmtTime(it.at) }}
              <template v-if="it.edited"> · 已编辑</template>
              <template v-if="it.trigger"> · {{ it.trigger }}</template>
            </div>
          </div>
        </div>
      </van-swipe-cell>
    </div>
    <div v-else class="card"><div class="empty-tip">还没有过程记录 —— 点「记一笔」开始记录变化过程</div></div>

    <NoteComposer v-model:show="showNote" :event-id="eid" />
    <NoteComposer v-model:show="showSummary" :event-id="eid" summary-mode />
    <NoteEditor v-model:show="showEditor" :thought="editItem?.type === 't' ? editItem.raw : null" :entry="editItem?.type === 'e' ? editItem.raw : null" @saved="editItem = null" />
  </div>
  <div v-else class="page"><div class="card"><div class="empty-tip">线索不存在或已删除</div></div></div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.meta-row { display: flex; gap: 6px; }
.chips-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.chips-row .chip { cursor: pointer; }
.fact { font-size: 13px; color: var(--text-2); margin-top: 8px; line-height: 1.6; }
.btn-row { display: flex; gap: 10px; margin-top: 12px; }
.tl-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); align-items: flex-start; }
.tl-item:last-child { border-bottom: 0; }
.tl-item.summary { background: color-mix(in srgb, var(--brand) 5%, transparent); border-radius: 8px; padding: 10px 8px; margin: 4px 0; border-bottom: 0; }
.tl-kind { flex: none; font-size: 11px; color: var(--text-3); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; margin-top: 2px; white-space: nowrap; }
.tl-kind.k-summary { color: var(--brand); border-color: var(--brand); font-weight: 600; }
.row-main { flex: 1; min-width: 0; }
.tl-text { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.tl-item .van-icon { cursor: pointer; margin-top: 3px; flex: none; }
.swipe-btn { height: 100%; }
</style>
