<script setup>
// AI 盘点弹层:应用把数据组装成带分析框架的提示词 → 用户复制发给任意 AI → 把回答粘贴回来存为「复盘」记录
// scope='subject'(对象盘点,绑定对象) | 'period'(周期盘点,弹层内可切 本周/本月/全部历史)
// 「复制诊断信息」:一键复制 计数+提示词+AI回答,发给开发者排查"没带入数据"类问题
import { computed, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useThoughtStore } from '../stores/thought.js';
import { useEventStore } from '../stores/event.js';
import { APP_VERSION } from '../lib/logger.js';
import { buildSubjectPrompt, buildPeriodPrompt, buildDebugReport } from '../lib/ai-prompt.js';
import { copyText } from '../lib/clipboard.js';
import dayjs from 'dayjs';
import { rangeFor } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  scope: { type: String, required: true }, // 'subject' | 'period'
  subject: { type: Object, default: null }, // 对象盘点:对象行
  data: { type: Object, default: null }, // 对象盘点:{ events, thoughts, predictions }(0.9.7 修复:此前漏声明,落入 attrs 导致盘点永远 0 条)
});
const emit = defineEmits(['update:show', 'saved']);

const thoughtStore = useThoughtStore();
const eventStore = useEventStore();
const promptText = ref('');
const aiAnswer = ref('');
const periodSel = ref('week'); // 周期盘点范围:'week' | 'month' | 'all'

const isSubject = () => props.scope === 'subject';

// —— 周期盘点的数据在弹层内自算(范围可切换,不依赖调用方传参) ——
const periodSelData = computed(() => {
  const inR = (x) => {
    const r = periodSel.value === 'week' ? rangeFor('week', Date.now()) : rangeFor('month', Date.now());
    return x >= r.start && x < r.end;
  };
  if (periodSel.value === 'all') {
    return {
      label: '全部历史',
      thoughts: thoughtStore.active,
      entries: eventStore.entries.filter((en) => !en.deleted),
      events: eventStore.active,
    };
  }
  return {
    label: periodSel.value === 'week' ? '本周' : '本月',
    thoughts: thoughtStore.active.filter((t) => inR(t.at || t.createdAt)),
    entries: eventStore.entries.filter((en) => !en.deleted && inR(en.at)),
    events: eventStore.active.filter((e) => inR(e.startAt)),
  };
});
const periodLabelFull = computed(() => {
  if (periodSelSelAll()) return '全部历史';
  const r = periodSel.value === 'week' ? rangeFor('week', Date.now()) : rangeFor('month', Date.now());
  const f = (x) => dayjs(x).format('YYYY-MM-DD');
  return f(r.start) + ' ~ ' + f(r.end - 1);
});
const periodSelSelAll = () => periodSel.value === 'all';

// 当前盘点用的数据:对象盘点用调用方传入(绑定关系),周期盘点自算
const invData = computed(() => (isSubject() ? props.data || {} : periodSelData.value));
const invCounts = computed(() => ({
  thoughts: (invData.value.thoughts || []).length,
  entries: (invData.value.entries || []).length,
  events: (invData.value.events || []).length,
  predictions: (invData.value.predictions || []).length,
}));
const totalCount = computed(() => invCounts.value.thoughts + invCounts.value.entries);
const scopeStats = computed(() => {
  const c = invCounts.value;
  if (isSubject()) {
    return `盘点对象「${props.subject?.name}」:${c.thoughts} 条记录 · ${c.events} 条线索 · ${c.predictions} 条预判`;
  }
  return `盘点周期 ${periodLabelFull.value}:${c.thoughts + c.entries} 条记录 · ${c.events} 条线索`;
});
// 空数据诊断提示:告诉用户为什么没带入数据
const emptyHint = computed(() => {
  if (totalCount.value > 0) return '';
  if (isSubject()) {
    return '⚠ 该对象名下暂无记录——对象盘点只统计已挂到本对象的记录。去记录流用「添加细节」把记录绑定到对象,或改用回顾页的「AI 盘点」做周期盘点。';
  }
  return '⚠ 当前范围暂无记录——可切换 本周/本月/全部历史,或确认记录的时间。';
});

// 生成提示词:打开时、以及周期范围切换时
function build() {
  if (isSubject()) {
    promptText.value = buildSubjectPrompt(props.subject, {
      events: props.data?.events || [],
      thoughts: props.data?.thoughts || [],
      predictions: props.data?.predictions || [],
    });
  } else {
    promptText.value = buildPeriodPrompt(periodLabelFull.value, {
      thoughts: periodSelData.value.thoughts,
      entries: periodSelData.value.entries,
      events: periodSelData.value.events,
    });
  }
}
watch(
  () => props.show,
  (v) => {
    if (!v) return;
    aiAnswer.value = '';
    build();
  }
);
watch(periodSel, () => {
  if (props.show && !isSubject()) build();
});
// store 异步 load 完成/数据变化时,弹层开着就重建(修硬刷新直进页面时 store 未就绪的竞态)
watch(
  () => [props.show, thoughtStore.loaded, eventStore.loaded, thoughtStore.active.length, eventStore.active.length],
  () => {
    if (props.show) build();
  }
);

async function copyPrompt() {
  await copyText(promptText.value);
}

// 一键复制诊断信息:计数快照 + 完整提示词 + AI 回答,发给开发者即可定位"没带入数据"类问题
async function copyDebug() {
  const report = buildDebugReport({
    version: APP_VERSION,
    time: new Date().toISOString(),
    scope: props.scope,
    subject: isSubject() ? { id: props.subject?.id, name: props.subject?.name } : null,
    rangeLabel: isSubject() ? '-' : periodLabelFull.value,
    counts: invCounts.value,
    storeTotals: {
      thoughtsAll: thoughtStore.thoughts.length,
      thoughtsActive: thoughtStore.active.length,
      eventsActive: eventStore.active.length,
      entriesAll: eventStore.entries.length,
    },
    prompt: promptText.value,
    answer: aiAnswer.value,
  });
  await copyText(report, { silent: false });
}

async function saveAnswer() {
  try {
    const text = aiAnswer.value.trim();
    if (!text) return showFailToast('先把 AI 的回答粘贴进来');
    const row = await thoughtStore.quickAdd({
      content: text,
      kind: '复盘',
      subjectId: isSubject() ? props.subject?.id || '' : '',
      source: 'AI 盘点',
    });
    showSuccessToast('已保存为复盘记录');
    emit('saved', row);
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
        <span>🤖 AI 盘点</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <div class="scope-line">{{ scopeStats }}</div>
      <div v-if="!isSubject()" class="chip-row" style="margin-bottom: 10px">
        <button v-for="o in [
          { k: 'week', t: '本周' },
          { k: 'month', t: '本月' },
          { k: 'all', t: '全部历史' },
        ]" :key="o.k" class="tag-chip" :class="{ active: periodSel === o.k }" @click="periodSel = o.k">{{ o.t }}</button>
      </div>
      <div v-if="emptyHint" class="empty-hint">{{ emptyHint }}</div>

      <div class="step-label">① 提示词(已按你的数据生成,可改)——复制后发给任意 AI</div>
      <van-field
        v-model="promptText"
        type="textarea"
        rows="6"
        autosize
        class="prompt-box"
      />
      <van-button type="primary" size="small" round icon="records" block style="margin-top: 8px" @click="copyPrompt">复制提示词</van-button>

      <div class="step-label" style="margin-top: 16px">② 把 AI 的回答粘贴到下面,保存为「复盘」记录</div>
      <van-field
        v-model="aiAnswer"
        type="textarea"
        rows="5"
        autosize
        placeholder="粘贴 AI 的盘点报告…(可先编辑再保存)"
      />
      <van-button type="success" round block style="margin-top: 10px" :disabled="!aiAnswer.trim()" @click="saveAnswer">保存为复盘记录</van-button>
      <div class="foot-row">
        <div class="muted" style="font-size: 11px">保存后可在记录流继续编辑;对象盘点会自动挂到该对象名下。</div>
        <span class="debug-link" @click="copyDebug">复制诊断信息</span>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.scope-line { font-size: 12px; color: var(--text-2); background: var(--card-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; }
.empty-hint { font-size: 12px; color: #f5a623; background: color-mix(in srgb, #f5a623 8%, transparent); border-radius: 8px; padding: 8px 10px; margin: -4px 0 10px; line-height: 1.6; }
.step-label { font-size: 12px; color: var(--text-3); margin: 6px 2px; }
.prompt-box :deep(textarea) { font-size: 12px; font-family: monospace; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.foot-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; gap: 10px; }
.debug-link { font-size: 11px; color: var(--brand); cursor: pointer; flex: none; }
</style>
