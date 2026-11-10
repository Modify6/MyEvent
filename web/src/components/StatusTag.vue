<script setup>
// 状态标签：事件复盘状态 / 预判生命周期 / 规则有效性 的统一彩色小签
import { computed } from 'vue';
import { EVENT_STATUS_LABELS, PREDICTION_STATUS_LABELS, predictionEffectiveStatus } from '../lib/domain.js';

const props = defineProps({
  kind: { type: String, required: true }, // event | prediction | rule
  status: { type: String, default: '' },
  prediction: { type: Object, default: null }, // 预判传对象以计算有效状态（过窗 → 待验证）
});

const COLOR = {
  inbox: 'warning',
  pending: 'primary',
  reviewed: 'success',
  draft: 'default',
  locked: 'primary',
  verifying: 'warning',
  hit: 'success',
  partial: 'warning',
  miss: 'danger',
  unverifiable: 'default',
  abandoned: 'default',
  valid: 'success',
  invalid: 'danger',
  pending_rule: 'warning',
};
const LABEL = {
  ...EVENT_STATUS_LABELS,
  ...PREDICTION_STATUS_LABELS,
  valid: '有效',
  invalid: '无效',
  pending: '待验证',
};

const info = computed(() => {
  if (props.kind === 'prediction' && props.prediction) {
    const st = predictionEffectiveStatus(props.prediction);
    return { label: LABEL[st] || st, color: COLOR[st] || 'default' };
  }
  const st = props.status;
  return { label: LABEL[st] || st || '—', color: COLOR[st] || 'default' };
});
</script>

<template>
  <van-tag :type="info.color" plain size="medium" round>{{ info.label }}</van-tag>
</template>
