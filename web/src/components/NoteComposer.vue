<script setup>
// 通用记录弹层:事件页「记一笔/写小结」、对象页「记一笔」共用
// summaryMode:小结(自由文本,存为 kind='summary' 的过程记录,无类型/触发源选择)
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { TRIGGER_KINDS, THOUGHT_KINDS } from '../lib/domain.js';
import { toLocalInput, fromLocalInput } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  eventId: { type: String, default: '' }, // 挂到线索 → 过程记录(eventEntries)
  subjectId: { type: String, default: '' }, // 挂到对象/独立 → 随手记(thoughts)
  summaryMode: { type: Boolean, default: false },
});
const emit = defineEmits(['update:show', 'saved']);

const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const kind = ref('想法');
const triggerKind = ref('');
const more = ref(false);
const form = reactive({ content: '', triggerNote: '', at: '' });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    Object.assign(form, { content: '', triggerNote: '', at: toLocalInput(Date.now()) });
    kind.value = '想法';
    triggerKind.value = '';
    more.value = false;
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
    showSuccessToast(props.summaryMode ? '小结已记下' : '已记录');
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

      <template v-if="!summaryMode">
        <template v-if="!eventId">
          <div class="block-label">类型 · 这是一条什么性质的记录</div>
          <div class="chip-row">
            <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
          </div>
        </template>

        <div class="block-label">触发源 · 由什么引发(选填)</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" @click="triggerKind = triggerKind === k ? '' : k">{{ k }}</button>
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
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.row-center { display: flex; justify-content: center; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
</style>
