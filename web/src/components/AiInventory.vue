<script setup>
// AI 盘点弹层:应用把数据组装成带分析框架的提示词 → 用户复制发给任意 AI → 把回答粘贴回来存为「复盘」记录
// scope='subject'(对象盘点,绑定对象) | 'period'(周期盘点,独立记录);提示词可编辑后再复制
import { computed, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useThoughtStore } from '../stores/thought.js';
import { buildSubjectPrompt, buildPeriodPrompt } from '../lib/ai-prompt.js';
import { copyText } from '../lib/clipboard.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  scope: { type: String, required: true }, // 'subject' | 'period'
  subject: { type: Object, default: null }, // 对象盘点:对象行
  data: { type: Object, default: null }, // 调用方圈定的数据 { events, thoughts, predictions } 或 { thoughts, entries, events }
  periodLabel: { type: String, default: '' }, // 周期盘点:周期标签,如 2026-11-09 ~ 11-15
});
const emit = defineEmits(['update:show', 'saved']);

const thoughtStore = useThoughtStore();
const promptText = ref('');
const aiAnswer = ref('');

const isSubject = () => props.scope === 'subject';

// 范围说明(自动统计,让用户知道盘的是什么)
const scopeStats = computed(() => {
  const d = props.data || {};
  const evs = d.events || [];
  const ths = d.thoughts || [];
  const ens = d.entries || [];
  const preds = d.predictions || [];
  if (isSubject()) {
    return `盘点对象「${props.subject?.name}」:${ths.length} 条记录 · ${evs.length} 条线索 · ${preds.length} 条预判`;
  }
  return `盘点周期 ${props.periodLabel}:${ths.length + ens.length} 条记录 · ${evs.length} 条线索`;
});

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    aiAnswer.value = '';
    if (isSubject()) {
      promptText.value = buildSubjectPrompt(props.subject, {
        events: props.data?.events || [],
        thoughts: props.data?.thoughts || [],
        predictions: props.data?.predictions || [],
      });
    } else {
      promptText.value = buildPeriodPrompt(props.periodLabel, {
        thoughts: props.data?.thoughts || [],
        entries: props.data?.entries || [],
        events: props.data?.events || [],
      });
    }
  }
);

async function copyPrompt() {
  await copyText(promptText.value);
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
      <div class="muted" style="font-size: 11px; margin-top: 8px">保存后可在记录流继续编辑;对象盘点会自动挂到该对象名下。</div>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.scope-line { font-size: 12px; color: var(--text-2); background: var(--card-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; }
.step-label { font-size: 12px; color: var(--text-3); margin: 6px 2px; }
.prompt-box :deep(textarea) { font-size: 12px; font-family: monospace; }
</style>
