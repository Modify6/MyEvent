<script setup>
// 标记处理弹层:记录与线索共用的「处理状态」三态 + 结果说明 + 状态变更历史
// 记录(thought)走 thoughtStore.setHandle;线索(event)走 eventStore.setThreadState(open/done/shelved/issue)
// 设计取舍:通用三态不特化场景 —— 未处理/已处理/有问题,结果说明自由文本
import { reactive, ref, watch, computed } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useThoughtStore } from '../stores/thought.js';
import { useEventStore } from '../stores/event.js';
import { HANDLE_STATUSES, HANDLE_STATUS_META, THREAD_STATE_META } from '../lib/domain.js';
import { fmtDate, fmtTime } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  type: { type: String, required: true }, // 'thought' | 'entry' | 'event'
  target: { type: Object, default: null }, // thought / eventEntry / event 行
  preset: { type: String, default: '' }, // 预选状态(从「完结/有问题」等快捷按钮进入时)
});
const emit = defineEmits(['update:show', 'saved']);

const thoughtStore = useThoughtStore();
const eventStore = useEventStore();
const form = reactive({ status: '', note: '' });
const showHistory = ref(false);

const isThought = () => props.type === 'thought';
const isEntry = () => props.type === 'entry';
// 记录类(thought/entry)走三态;线索(event)走 threadState 全集
const isThread = () => props.type === 'event';

// 可选状态:记录三态;线索 threadState 全集(进行中/已完结/已搁置/有问题)
const STATUS_OPTIONS = computed(() =>
  isThread()
    ? Object.entries(THREAD_STATE_META).map(([key, m]) => ({ key, ...m }))
    : HANDLE_STATUSES.map((s) => ({ key: s, ...HANDLE_STATUS_META[s] }))
);

// van-tag type → 页内 CSS 色(与全局用色一致)
const colorOf = (type) => ({ primary: 'var(--brand)', success: '#34c273', warning: '#f5a623', danger: 'var(--danger)' }[type] || 'var(--brand)');

// 历史条目的状态名:记录类(thought/entry)的 done=已处理,线索的 done=已完结
const statusLabel = (s) => {
  const primary = isThread() ? THREAD_STATE_META[s] : HANDLE_STATUS_META[s];
  const fallback = isThread() ? HANDLE_STATUS_META[s] : THREAD_STATE_META[s];
  return (primary || fallback)?.label || s;
};

// 当前状态与历史(取行内字段,缺省回落)
const currentStatus = computed(() => {
  const t = props.target;
  if (!t) return '';
  if (isThread()) return t.threadState || 'open';
  return t.handleStatus || 'pending';
});
const history = computed(() => props.target?.statusHistory || []);

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    form.status = props.preset || currentStatus.value;
    form.note = props.target?.handleNote || '';
    showHistory.value = false;
  }
);

async function save() {
  try {
    const t = props.target;
    if (!t) return;
    if (isThread()) {
      await eventStore.setThreadState(t.id, form.status, form.note);
    } else if (isEntry()) {
      await eventStore.setEntryHandle(t.id, form.status, form.note);
    } else {
      await thoughtStore.setHandle(t.id, form.status, form.note);
    }
    showSuccessToast('处理状态已更新(已留痕)');
    emit('saved');
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 62vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>标记处理</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <div class="block-label">处理状态</div>
      <div class="chip-row">
        <button
          v-for="opt in STATUS_OPTIONS"
          :key="opt.key"
          class="tag-chip"
          :class="{ active: form.status === opt.key }"
          :style="form.status === opt.key ? { borderColor: colorOf(opt.type), color: colorOf(opt.type) } : {}"
          @click="form.status = opt.key"
        >{{ opt.label }}</button>
      </div>

      <van-field
        v-model="form.note"
        type="textarea"
        rows="2"
        autosize
        label="处理结果说明"
        :placeholder="form.status === 'done' ? '处理成了什么样,结论/结果一句话' : form.status === 'issue' ? '什么问题,需要再处理什么' : '说明(选填)'"
      />

      <div v-if="history.length" class="block-label row-between">
        <span>状态历史 · {{ history.length }} 次<span class="muted">(自动留痕)</span></span>
        <van-button size="small" plain round @click="showHistory = !showHistory">{{ showHistory ? '收起' : '查看' }}</van-button>
      </div>
      <div v-if="showHistory" class="history-box">
        <div v-for="(h, i) in [...history].reverse()" :key="i" class="history-item">
          <span class="muted">{{ fmtDate(h.at) }} {{ fmtTime(h.at) }}</span>
          <span class="hist-trans">{{ statusLabel(h.from) }} → {{ statusLabel(h.to) }}</span>
          <div v-if="h.note" class="history-note">{{ h.note }}</div>
        </div>
      </div>

      <van-button type="primary" round block style="margin-top: 14px" @click="save">保存</van-button>
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
.tag-chip.active { font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.history-box { background: var(--card-2); border-radius: 8px; padding: 10px; }
.history-item { padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 13px; }
.history-item:last-child { border-bottom: 0; }
.hist-trans { margin-left: 8px; font-weight: 600; }
.history-note { font-size: 12px; color: var(--text-2); margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
</style>
