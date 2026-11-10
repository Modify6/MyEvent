<script setup>
// 记录二次编辑:新值生效,旧值进 edits 修订历史 —— 改变要有记录
// 编辑能力与创建细节对齐:内容/类型/触发源/时间,thought 还可改挂靠对象与线索
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { useSubjectStore } from '../stores/subject.js';
import { TRIGGER_KINDS, THOUGHT_KINDS } from '../lib/domain.js';
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
const showHistory = ref(false);
const form = reactive({
  content: '', kind: '', triggerKind: '', triggerNote: '', at: '',
  subjectId: '', eventId: '',
});

const isEntry = () => !!props.entry;
const isSummary = () => props.entry?.kind === 'summary';

// thought.source 的拼装/解析(「由X触发:说明」)与创建侧保持一致
function parseSource(src) {
  const m = String(src || '').match(/^由(.+?)触发(?::([\s\S]*))?$/);
  if (m) return { kind: TRIGGER_KINDS.includes(m[1]) ? m[1] : '', note: m[2] || '' };
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
        eventId: '',
      });
    }
    showHistory.value = false;
  }
);

const edits = () => (props.thought || props.entry)?.edits || [];

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

      <template v-if="!isEntry()">
        <div class="block-label">类型</div>
        <div class="chip-row">
          <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: form.kind === k }" @click="form.kind = k">{{ k }}</button>
        </div>
      </template>
      <template v-if="!isSummary()">
        <div class="block-label">触发源</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: form.triggerKind === k }" @click="form.triggerKind = form.triggerKind === k ? '' : k">{{ k }}</button>
        </div>
        <van-field v-model="form.triggerNote" type="textarea" rows="1" autosize placeholder="触发说明" />
      </template>

      <!-- 挂靠:与创建细节对齐(thought 可改挂对象/线索;entry 属于其线索不可改) -->
      <template v-if="!isEntry()">
        <div class="block-label">挂到线索</div>
        <div class="chip-row">
          <button v-for="e in eventStore.threads.slice(0, 8)" :key="e.id" class="tag-chip" :class="{ active: form.eventId === e.id }" @click="form.eventId = form.eventId === e.id ? '' : e.id">{{ e.title.slice(0, 12) }}</button>
          <span v-if="!eventStore.threads.length" class="muted">还没有线索</span>
        </div>
        <div class="block-label">挂到对象</div>
        <div class="chip-row">
          <button v-for="s in subjectStore.active" :key="s.id" class="tag-chip" :class="{ active: form.subjectId === s.id }" @click="form.subjectId = form.subjectId === s.id ? '' : s.id">{{ s.name }}</button>
          <span v-if="!subjectStore.active.length" class="muted">还没有对象</span>
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
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.history-box { background: var(--card-2); border-radius: 8px; padding: 10px; }
.history-item { padding: 6px 0; border-bottom: 1px dashed var(--line); }
.history-item:last-child { border-bottom: 0; }
.history-text { font-size: 13px; color: var(--text-2); margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
</style>
