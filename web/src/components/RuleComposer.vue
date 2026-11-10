<script setup>
// 经验规则表单:手动新建 / 复盘或预判验证后的沉淀(可预填)
import { reactive, computed, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useRuleStore } from '../stores/rule.js';
import { validateRuleText } from '../lib/domain.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  prefill: { type: Object, default: null }, // { scene, trigger, content, reason, refEvents, refPredictions }
});
const emit = defineEmits(['update:show', 'saved']);

const store = useRuleStore();
const form = reactive({ scene: '', trigger: '', content: '', reason: '', counterEx: '' });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    const p = props.prefill || {};
    Object.assign(form, {
      scene: p.scene || '',
      trigger: p.trigger || '',
      content: p.content || '',
      reason: p.reason || '',
      counterEx: p.counterEx || '',
    });
  }
);

const check = computed(() => validateRuleText(form.content));

async function save() {
  try {
    const r = await store.create({ ...form, refEvents: props.prefill?.refEvents || [], refPredictions: props.prefill?.refPredictions || [] });
    showSuccessToast('规则已入库');
    emit('saved', r);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 76vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>经验规则</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <van-field v-model="form.content" type="textarea" rows="2" autosize placeholder="如果 X,则 Y * —— 下次遇到相似场景的行动规则" />
      <div v-if="form.content" class="rule-tip" :class="check.ok ? 'ok' : 'bad'">{{ check.msg || '✓ 规则可执行' }}</div>
      <van-field v-model="form.scene" label="适用场景" placeholder="如:需求沟通 / 投资决策 / 例会" />
      <van-field v-model="form.trigger" label="触发信号" placeholder="看到什么信号时应用" />
      <van-field v-model="form.reason" type="textarea" rows="2" autosize label="背后原因" placeholder="为什么这条规则成立" />
      <van-field v-model="form.counterEx" type="textarea" rows="1" autosize label="反例" placeholder="什么情况下它不适用(选填)" />
      <van-button type="primary" round block style="margin-top: 14px" :disabled="!check.ok" @click="save">保存到经验库</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.rule-tip { font-size: 12px; margin: 4px 16px; }
.rule-tip.ok { color: #34c273; }
.rule-tip.bad { color: var(--danger); }
</style>
