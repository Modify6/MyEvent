<script setup>
// 想法捕获与整理:10 秒只填内容即可入收件箱;整理时补对象/类型/置信度并归档;可升级为预判
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useThoughtStore } from '../stores/thought.js';
import { useSubjectStore } from '../stores/subject.js';
import { THOUGHT_KINDS } from '../lib/domain.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  thought: { type: Object, default: null }, // 传入 = 整理/编辑该想法
  subjectId: { type: String, default: '' }, // 从对象页打开:保存后直接归档到该对象,不进收件箱
});
const emit = defineEmits(['update:show', 'saved', 'to-prediction']);

const thoughtStore = useThoughtStore();
const subjectStore = useSubjectStore();

const kind = ref('观察');
const more = ref(false);
const form = reactive({ content: '', subjectId: '', source: '', basis: '', counter: '', hasConf: false, confidence: 60 });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    const t = props.thought;
    Object.assign(form, {
      content: t?.content || '',
      subjectId: t?.subjectId || props.subjectId || '',
      source: t?.source || '',
      basis: t?.basis || '',
      counter: t?.counter || '',
      hasConf: t?.confidence != null,
      confidence: t?.confidence ?? 60,
    });
    kind.value = t?.kind || '观察';
    more.value = !!t; // 整理模式直接展开
  }
);

const isEdit = () => !!props.thought;

async function persist(extra = {}) {
  const payload = {
    content: form.content,
    kind: kind.value,
    subjectId: form.subjectId,
    source: form.source,
    basis: form.basis,
    counter: form.counter,
    confidence: form.hasConf ? form.confidence : null,
    ...extra,
  };
  if (isEdit()) return thoughtStore.patch(props.thought.id, payload);
  return thoughtStore.quickAdd(payload);
}

async function save({ archive = false } = {}) {
  try {
    const t = await persist(archive ? { state: 'archived' } : {});
    showSuccessToast(archive ? '已归档' : '已记录');
    emit('saved', t);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}

// 升级为预判:整理好内容 → 交给父页面打开 PredictionComposer 预填
function toPrediction() {
  if (!form.content.trim()) return showFailToast('先写下想法内容');
  emit(
    'to-prediction',
    thoughtStore.toPredictionDraft({ content: form.content, subjectId: form.subjectId, confidence: form.hasConf ? form.confidence : null })
  );
  emit('update:show', false);
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 82vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>{{ isEdit() ? '整理想法' : '记想法' }}</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <van-field v-model="form.content" type="textarea" rows="3" autosize placeholder="此刻的想法/判断/疑问…一句话也行 *" />

      <div class="block-label">类型</div>
      <div class="chip-row">
        <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
      </div>

      <div class="block-label">所属对象(整理时归入;留空待周整理)</div>
      <div class="chip-row">
        <button
          v-for="s in subjectStore.active"
          :key="s.id"
          class="tag-chip"
          :class="{ active: form.subjectId === s.id }"
          @click="form.subjectId = form.subjectId === s.id ? '' : s.id"
        >{{ s.name }}</button>
        <span v-if="!subjectStore.active.length" class="muted">还没有对象,可先不选</span>
      </div>

      <template v-if="more">
        <div class="slider-row">
          <van-checkbox v-model="form.hasConf" shape="square" icon-size="14px">设定置信度</van-checkbox>
          <template v-if="form.hasConf">
            <van-slider v-model="form.confidence" :min="0" :max="100" style="flex: 1" />
            <span class="conf-num">{{ form.confidence }}%</span>
          </template>
        </div>
        <van-field v-model="form.basis" type="textarea" rows="2" autosize label="依据" placeholder="为什么这么判断" />
        <van-field v-model="form.counter" type="textarea" rows="2" autosize label="反证" placeholder="什么情况说明我错了" />
        <van-field v-model="form.source" label="触发来源" placeholder="看到/听到/想到什么" />
      </template>
      <div v-else class="row-center" style="margin-top: 8px">
        <van-button size="small" plain round @click="more = true">补充细节</van-button>
      </div>

      <div class="btn-col">
        <template v-if="!isEdit()">
          <van-button type="primary" round block @click="save({ archive: !!props.subjectId })">{{ props.subjectId ? '记录到对象' : '存入收件箱' }}</van-button>
          <van-button plain round type="primary" @click="toPrediction">升级为预判 →</van-button>
        </template>
        <template v-else>
          <van-button type="primary" round block @click="save({ archive: !!form.subjectId })">{{ form.subjectId ? '保存并归档' : '保存' }}</van-button>
          <van-button plain round type="primary" @click="toPrediction">升级为预判 →</van-button>
        </template>
      </div>
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
.slider-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px 4px; }
.conf-num { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
.btn-col { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
</style>
