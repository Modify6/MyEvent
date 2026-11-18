<script setup>
// 通用记录弹层:事件页「记一笔/写小结」、对象页「记一笔」共用
// summaryMode:小结(自由文本,存为 kind='summary' 的过程记录,无类型/触发源选择)
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { useVocabStore } from '../stores/vocab.js';
import { useImageStore } from '../stores/image.js';
import ImageEditor from './ImageEditor.vue';
import { kindChipStyle, trigChipStyle } from '../lib/display.js';
import { toLocalInput, fromLocalInput } from '../lib/time.js';
import VocabQuickCreate from './VocabQuickCreate.vue';
import VocabManage from './VocabManage.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  eventId: { type: String, default: '' }, // 挂到线索 → 过程记录(eventEntries)
  subjectId: { type: String, default: '' }, // 挂到对象/独立 → 随手记(thoughts)
  summaryMode: { type: Boolean, default: false },
});
const emit = defineEmits(['update:show', 'saved']);

const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const vocabStore = useVocabStore();
const imageStore = useImageStore();
const kind = ref('想法');
const triggerKind = ref('');
const more = ref(false);
const form = reactive({ content: '', triggerNote: '', at: '' });
// 自定义类型/触发源:就地新建 + 管理
const showKindCreate = ref(false);
const showTriggerCreate = ref(false);
const showManage = ref(false);
const manageScope = ref('kind');
function onVocabCreated(row) {
  if (row.type === 'kind') kind.value = row.name;
  else triggerKind.value = row.name;
}

// 附件图:选中即压缩暂存,保存成功后绑定到新记录
const staged = ref([]);
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
function onEditorConfirm(results) {
  staged.value.push(...results);
  showEditor.value = false;
}
function removeStaged(i) {
  staged.value.splice(i, 1);
}

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    Object.assign(form, { content: '', triggerNote: '', at: toLocalInput(Date.now()) });
    kind.value = '想法';
    triggerKind.value = '';
    more.value = false;
    staged.value = [];
  }
);

const threadTitle = () => eventStore.byId(props.eventId)?.title || '';

async function save() {
  try {
    const at = fromLocalInput(form.at) || Date.now();
    let row;
    if (props.eventId) {
      // 挂线索 → 过程记录(小结或普通记录)
      row = await eventStore.addEntry({
        eventId: props.eventId,
        content: form.content,
        kind: props.summaryMode ? 'summary' : 'record',
        triggerKind: props.summaryMode ? '' : triggerKind.value,
        triggerNote: props.summaryMode ? '' : form.triggerNote,
        at,
      });
    } else {
      // 挂对象或独立 → 随手记;触发源拼进 source 字段
      const src = triggerKind.value
        ? `由${triggerKind.value}触发${form.triggerNote ? ':' + form.triggerNote : ''}`
        : form.triggerNote;
      row = await thoughtStore.quickAdd({
        content: form.content,
        kind: kind.value,
        subjectId: props.subjectId,
        source: src,
        at,
      });
    }
    for (const img of staged.value) {
      await imageStore.save({ ownerTable: props.eventId ? 'eventEntries' : 'thoughts', ownerId: row.id, data: img.data, w: img.w, h: img.h });
    }
    if (staged.value.length) showSuccessToast(`已记录 + ${staged.value.length} 张图`);
    else showSuccessToast(props.summaryMode ? '小结已记下' : '已记录');
    staged.value = [];
    emit('saved', row);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 74vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>{{ summaryMode ? '写小结' : '记一笔' }}<span v-if="eventId && threadTitle()" class="muted"> · {{ threadTitle() }}</span></span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <div v-if="summaryMode" class="muted" style="margin: 0 2px 8px">自由发挥 —— 想到什么写什么,写多写少都行,随时可以再补</div>

      <van-field
        v-model="form.content"
        type="textarea"
        rows="3"
        autosize
        :placeholder="summaryMode ? '这阵子的收获/教训/规律,用自己的话…' : '这条记录的内容 *'"
      />

      <!-- 附件图:选择即压缩暂存,保存后绑定到新记录(3 列网格) -->
      <div class="attach-grid">
        <div v-for="(img, i) in staged" :key="i" class="attach-th">
          <img :src="img.data" alt="" />
          <span class="attach-x" @click="removeStaged(i)">✕</span>
        </div>
        <div class="attach-add" @click="pickFiles">
          <van-icon name="plus" /><span>附加图</span>
        </div>
        <input ref="fileRef" type="file" accept="image/*" multiple hidden @change="onPickFiles" />
        <ImageEditor v-model:show="showEditor" :queue="editorQueue" @confirm="onEditorConfirm" />
      </div>

      <template v-if="!summaryMode">
        <template v-if="!eventId">
          <div class="block-label row-between">
            <span>🏷 类型 · 这是一条什么性质的记录</span>
            <span class="manage-link" @click="manageScope = 'kind'; showManage = true">管理</span>
          </div>
          <div class="chip-row">
            <button v-for="k in vocabStore.kinds" :key="k" class="tag-chip" :class="{ active: kind === k }" :style="kindChipStyle(k, kind === k)" @click="kind = k">{{ vocabStore.kindMetaOf(k).icon }} {{ k }}</button>
            <button class="tag-chip add-chip" @click="showKindCreate = true">+ 自定义</button>
          </div>
        </template>

        <div class="block-label row-between">
          <span>📌 触发源 · 由什么引发(选填)</span>
          <span class="manage-link" @click="manageScope = 'trigger'; showManage = true">管理</span>
        </div>
        <div class="chip-row">
          <button v-for="k in vocabStore.triggers" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" :style="trigChipStyle(k, triggerKind === k)" @click="triggerKind = triggerKind === k ? '' : k">{{ vocabStore.triggerIconOf(k) }} {{ k }}</button>
          <button class="tag-chip add-chip" @click="showTriggerCreate = true">+ 自定义</button>
        </div>
        <van-field v-model="form.triggerNote" type="textarea" rows="1" autosize placeholder="触发说明(选填),如:看了XX视频 / 和XX聊天" />
      </template>

      <template v-if="more">
        <van-field v-model="form.at" type="datetime-local" label="时间" />
      </template>
      <div v-else class="row-center" style="margin-top: 8px">
        <van-button size="small" plain round @click="more = true">修改时间</van-button>
      </div>

      <van-button type="primary" round block style="margin-top: 14px" @click="save">{{ summaryMode ? '记下小结' : '记一笔' }}</van-button>
      <VocabQuickCreate v-model:show="showKindCreate" type="kind" @created="onVocabCreated" />
      <VocabQuickCreate v-model:show="showTriggerCreate" type="trigger" @created="onVocabCreated" />
      <VocabManage v-model:show="showManage" :scope="manageScope" />
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
.row-center { display: flex; justify-content: center; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.attach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 2px 0; }
.attach-th { position: relative; aspect-ratio: 1/1; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
.attach-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.attach-x { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: rgba(0,0,0,0.6); color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; }
.attach-add { aspect-ratio: 1/1; border: 1px dashed var(--line); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--text-3); font-size: 12px; cursor: pointer; background: var(--card); }
.attach-add .van-icon { font-size: 20px; }
</style>
