<script setup>
// 记录二次编辑:新值生效,旧值进 edits 修订历史 —— 改变要有记录
// 编辑能力与创建细节对齐:内容/类型/触发源/时间;thought 可改挂靠对象与线索,entry 可改挂其他线索(选错线索时移过去)
import { computed, reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { useSubjectStore } from '../stores/subject.js';
import QuickCreate from './QuickCreate.vue';
import VocabQuickCreate from './VocabQuickCreate.vue';
import VocabManage from './VocabManage.vue';
import AttachGuide from './AttachGuide.vue';
import { useVocabStore } from '../stores/vocab.js';
import { useImageStore } from '../stores/image.js';
import ImageEditor from './ImageEditor.vue';
import ImgPreviewOverlay from './ImgPreviewOverlay.vue';
const preview = ref(null);
import { toLocalInput, fromLocalInput } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  thought: { type: Object, default: null },
  entry: { type: Object, default: null },
});
const emit = defineEmits(['update:show', 'saved']);

const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const subjectStore = useSubjectStore();
const vocabStore = useVocabStore();
const imageStore = useImageStore();
const showHistory = ref(false);
// 附件图:已有图可删,可补图(直接入库绑定当前记录);thought/entry 通用
const ownerTable = () => (props.entry ? 'eventEntries' : 'thoughts');
const ownerId = () => (props.entry || props.thought)?.id || '';
const myImages = computed(() => (ownerId() ? imageStore.byOwner(ownerTable(), ownerId()) : []));
const fileRef = ref(null);
const showEditor = ref(false);
const editorQueue = ref([]);
function pickFiles() {
  fileRef.value?.click();
}
function onPickFiles(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  editorQueue.value = files;
  showEditor.value = true;
}
async function onEditorConfirm(results) {
  for (const img of results) {
    await imageStore.save({ ownerTable: ownerTable(), ownerId: ownerId(), data: img.data, w: img.w, h: img.h });
  }
  if (results.length) showSuccessToast(`已补 ${results.length} 张图`);
  showEditor.value = false;
}
async function removeImage(im) {
  await imageStore.remove(im.id);
}
function previewImages(imgs, idx) {
  preview.value = { images: imgs.map((x) => x.data), start: idx };
}
const form = reactive({
  content: '', kind: '', triggerKind: '', triggerNote: '', at: '',
  subjectId: '', eventId: '',
});

const isEntry = () => !!props.entry;
const isSummary = () => props.entry?.kind === 'summary';

// entry 改挂列表:最近 8 条 + 当前所属(保证现在挂的线索始终可见)
const entryThreads = computed(() => {
  const list = eventStore.threads.slice(0, 8);
  if (form.eventId && !list.some((e) => e.id === form.eventId)) {
    const cur = eventStore.byId(form.eventId);
    if (cur) list.push(cur);
  }
  return list;
});

// thought 挂线索联动:选了对象,线索 chips 收窄为该对象下的线索(当前已选不在其中也保留)
const attachThreads = computed(() => {
  if (!form.subjectId) return eventStore.threads.slice(0, 8);
  let list = eventStore.threads.filter((e) => (e.subjectIds || []).includes(form.subjectId)).slice(0, 12);
  if (form.eventId && !list.some((e) => e.id === form.eventId)) {
    const cur = eventStore.byId(form.eventId);
    if (cur) list = [...list, cur];
  }
  return list;
});
const attachSubjectName = computed(() => subjectStore.nameOf(form.subjectId));

// thought.source 的拼装/解析(「由X触发:说明」)与创建侧保持一致;0.9.0 起触发源不限内置白名单(自定义词表值原样保留)
function parseSource(src) {
  const m = String(src || '').match(/^由(.+?)触发(?::([\s\S]*))?$/);
  if (m) return { kind: m[1], note: m[2] || '' };
  return { kind: '', note: String(src || '') };
}
function buildSource(kind, note) {
  const n = String(note || '').trim();
  return kind ? `由${kind}触发${n ? ':' + n : ''}` : n;
}

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    if (props.thought) {
      const t = props.thought;
      const { kind, note } = parseSource(t.source);
      Object.assign(form, {
        content: t.content || '',
        kind: t.kind || '想法',
        triggerKind: kind,
        triggerNote: note,
        at: toLocalInput(t.at),
        subjectId: t.subjectId || '',
        eventId: t.relatedEventId || '',
      });
    } else if (props.entry) {
      const en = props.entry;
      Object.assign(form, {
        content: en.content || '',
        triggerKind: en.triggerKind || '',
        triggerNote: en.triggerNote || '',
        at: toLocalInput(en.at),
        subjectId: '',
        eventId: en.eventId || '',
      });
    }
    showHistory.value = false;
  }
);

const edits = () => (props.thought || props.entry)?.edits || [];

// 挂靠就地快速新建:建好即自动选中
const showQuickCreate = ref(false);
// 自定义类型/触发源:就地新建 + 管理
const showKindCreate = ref(false);
const showTriggerCreate = ref(false);
const showVocabManage = ref(false);
const vocabManageScope = ref('kind');
const quickCreateType = ref('subject');
function quickCreate(type) {
  quickCreateType.value = type;
  showQuickCreate.value = true;
}
function onQuickCreated(row) {
  if (quickCreateType.value === 'event') form.eventId = row.id;
  else form.subjectId = row.id;
}
const showGuide = ref(false);

async function save() {
  try {
    const at = fromLocalInput(form.at) || undefined;
    if (isEntry()) {
      await eventStore.editEntry(props.entry.id, {
        content: form.content,
        triggerKind: isSummary() ? '' : form.triggerKind,
        triggerNote: isSummary() ? '' : form.triggerNote,
        at,
      });
      // 改挂其他线索(选错线索时移过去;与原线索相同则无操作)
      if (form.eventId && form.eventId !== props.entry.eventId) {
        await eventStore.moveEntry(props.entry.id, form.eventId);
      }
    } else {
      await thoughtStore.edit(props.thought.id, {
        content: form.content,
        kind: form.kind,
        at,
        subjectId: form.subjectId,
        relatedEventId: form.eventId,
        source: buildSource(isSummary() ? '' : form.triggerKind, form.triggerNote),
      });
    }
    showSuccessToast('已修改(原文已存档)');
    emit('saved');
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 86vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>修改记录</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <van-field v-model="form.content" type="textarea" rows="3" autosize placeholder="修改后的内容 *" />

      <!-- 附件图:已有图可删/预览,可补图(3 列网格) -->
      <div v-if="ownerId()" class="attach-grid">
        <div v-for="im in myImages" :key="im.id" class="attach-th">
          <img :src="im.data" alt="" @click="previewImages(myImages, myImages.indexOf(im))" />
          <span class="attach-x" @click="removeImage(im)">✕</span>
        </div>
        <div class="attach-add" @click="pickFiles">
          <van-icon name="plus" /><span>补图</span>
        </div>
        <input ref="fileRef" type="file" accept="image/*" multiple hidden @change="onPickFiles" />
        <ImageEditor v-model:show="showEditor" :queue="editorQueue" @confirm="onEditorConfirm" />
      </div>
      <ImgPreviewOverlay :show="!!preview" :images="preview?.images || []" :start="preview?.start || 0" @close="preview = null" />

      <template v-if="!isEntry()">
        <div class="block-label row-between"><span>类型</span><span class="manage-link" @click="vocabManageScope = 'kind'; showVocabManage = true">管理</span></div>
        <div class="chip-row">
          <button v-for="k in vocabStore.kinds" :key="k" class="tag-chip" :class="{ active: form.kind === k }" @click="form.kind = k">{{ vocabStore.kindMetaOf(k).icon }} {{ k }}</button>
          <button class="tag-chip add-chip" @click="showKindCreate = true">+ 自定义</button>
        </div>
      </template>
      <template v-if="!isSummary()">
        <div class="block-label row-between"><span>触发源</span><span class="manage-link" @click="vocabManageScope = 'trigger'; showVocabManage = true">管理</span></div>
        <div class="chip-row">
          <button v-for="k in vocabStore.triggers" :key="k" class="tag-chip" :class="{ active: form.triggerKind === k }" @click="form.triggerKind = form.triggerKind === k ? '' : k">{{ vocabStore.triggerIconOf(k) }} {{ k }}</button>
          <button class="tag-chip add-chip" @click="showTriggerCreate = true">+ 自定义</button>
        </div>
        <van-field v-model="form.triggerNote" type="textarea" rows="1" autosize placeholder="触发说明" />
      </template>

      <!-- 挂靠:与创建细节对齐(thought 可改挂对象/线索;entry 可改挂其他线索) -->
      <template v-if="!isEntry()">
        <div class="block-label row-between">
          <span>挂到线索 · 哪件事<template v-if="form.subjectId"><span class="muted"> · @{{ attachSubjectName }} 下的线索</span></template></span>
          <span class="guide-link" @click="showGuide = true">怎么选?</span>
        </div>
        <div class="chip-row">
          <button v-for="e in attachThreads" :key="e.id" class="tag-chip" :class="{ active: form.eventId === e.id }" @click="form.eventId = form.eventId === e.id ? '' : e.id">{{ e.title.slice(0, 12) }}</button>
          <button class="tag-chip add-chip" @click="quickCreate('event')">+ 新建</button>
        </div>
        <div class="block-label">🎯 挂到对象 · 关于谁</div>
        <div class="chip-row">
          <button v-for="s in subjectStore.active" :key="s.id" class="tag-chip" :class="{ active: form.subjectId === s.id }" @click="form.subjectId = form.subjectId === s.id ? '' : s.id">{{ s.name }}</button>
          <button class="tag-chip add-chip" @click="quickCreate('subject')">+ 新建</button>
        </div>
      </template>
      <template v-else>
        <div class="block-label">所属线索 · 记错了就移到别的事件</div>
        <div class="chip-row">
          <button v-for="e in entryThreads" :key="e.id" class="tag-chip" :class="{ active: form.eventId === e.id }" @click="form.eventId = e.id">{{ e.title.slice(0, 12) }}</button>
        </div>
      </template>

      <van-field v-model="form.at" type="datetime-local" label="时间" />

      <!-- 修订历史:改变要有记录 -->
      <div v-if="edits().length" class="block-label row-between">
        <span>修订历史 · {{ edits().length }} 次<span class="muted">(原文自动存档)</span></span>
        <van-button size="small" plain round @click="showHistory = !showHistory">{{ showHistory ? '收起' : '查看' }}</van-button>
      </div>
      <div v-if="showHistory" class="history-box">
        <div v-for="(h, i) in [...edits()].reverse()" :key="i" class="history-item">
          <div class="muted">{{ new Date(h.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }} 前的版本:</div>
          <div class="history-text">{{ h.content }}</div>
        </div>
      </div>

      <van-button type="primary" round block style="margin-top: 14px" @click="save">保存修改</van-button>
      <QuickCreate v-model:show="showQuickCreate" :type="quickCreateType" @created="onQuickCreated" />
      <VocabQuickCreate v-model:show="showKindCreate" type="kind" @created="(row) => (form.kind = row.name)" />
      <VocabQuickCreate v-model:show="showTriggerCreate" type="trigger" @created="(row) => (form.triggerKind = row.name)" />
      <VocabManage v-model:show="showVocabManage" :scope="vocabManageScope" />
      <AttachGuide v-model:show="showGuide" />
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.manage-link { color: var(--brand); cursor: pointer; font-size: 12px; }
.tag-chip.add-chip { border-style: dashed; color: var(--text-3); }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.add-chip { border-style: dashed; color: var(--text-3); }
.guide-link { color: var(--brand); cursor: pointer; font-size: 12px; }
.history-box { background: var(--card-2); border-radius: 8px; padding: 10px; }
.history-item { padding: 6px 0; border-bottom: 1px dashed var(--line); }
.history-item:last-child { border-bottom: 0; }
.history-text { font-size: 13px; color: var(--text-2); margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
  .attach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 2px 0; }
  .attach-th { position: relative; aspect-ratio: 1/1; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  .attach-th img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer; }
  .attach-x { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: rgba(0,0,0,0.6); color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; }
  .attach-add { aspect-ratio: 1/1; border: 1px dashed var(--line); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--text-3); font-size: 12px; cursor: pointer; background: var(--card); }
  .attach-add .van-icon { font-size: 20px; }
</style>
