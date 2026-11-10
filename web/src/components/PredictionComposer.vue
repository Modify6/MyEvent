<script setup>
// 预判表单:创建草稿 / 编辑草稿 / 锁定提交(写入原始快照,核心字段从此只读)
// 预判必须可证伪:内容 + 所属对象 + 验证窗口 + 置信度 + 「什么算命中」标准
import { reactive, ref, watch } from 'vue';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import { usePredictionStore } from '../stores/prediction.js';
import { useSubjectStore } from '../stores/subject.js';
import { PREDICTION_KINDS, MAX_ACTIVE_PREDICTIONS } from '../lib/domain.js';
import { toLocalInput, fromLocalInput } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  subjectId: { type: String, default: '' },
  draft: { type: Object, default: null }, // 想法升级:预填 { subjectId, content, origConfidence }
  prediction: { type: Object, default: null }, // 草稿编辑
});
const emit = defineEmits(['update:show', 'saved', 'locked']);

const store = usePredictionStore();
const subjectStore = useSubjectStore();
const kind = ref('结果型');
const locking = ref(false);

const form = reactive({
  content: '',
  subjectId: '',
  windowStart: '',
  windowEnd: '',
  origConfidence: 70,
  basis: '',
  counterSignals: '',
  hit: '',
  partial: '',
  miss: '',
});

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    const p = props.prediction;
    const d = props.draft;
    const now = toLocalInput(Date.now());
    Object.assign(form, {
      content: p?.content || d?.content || '',
      subjectId: p?.subjectId || d?.subjectId || props.subjectId || '',
      windowStart: p?.windowStart ? toLocalInput(p.windowStart) : now,
      windowEnd: p?.windowEnd ? toLocalInput(p.windowEnd) : '',
      origConfidence: p?.origConfidence ?? d?.origConfidence ?? 70,
      basis: p?.basis || '',
      counterSignals: p?.counterSignals || '',
      hit: p?.criteria?.hit || '',
      partial: p?.criteria?.partial || '',
      miss: p?.criteria?.miss || '',
    });
    kind.value = p?.kind || '结果型';
  }
);

const isEdit = () => !!props.prediction;

function payload() {
  return {
    subjectId: form.subjectId,
    content: form.content,
    kind: kind.value,
    windowStart: fromLocalInput(form.windowStart) || Date.now(),
    windowEnd: fromLocalInput(form.windowEnd),
    origConfidence: form.origConfidence,
    basis: form.basis,
    counterSignals: form.counterSignals,
    criteria: { hit: form.hit, partial: form.partial, miss: form.miss },
  };
}

async function persist() {
  if (isEdit()) return store.patch(props.prediction.id, payload());
  return store.create(payload());
}

async function saveDraft() {
  try {
    const p = await persist();
    showSuccessToast('草稿已保存');
    emit('saved', p);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}

async function lock() {
  try {
    const p = await persist();
    await showConfirmDialog({
      title: '锁定原始预判?',
      message: `锁定后内容/窗口/置信度(${p.origConfidence}%)不再可改,过程只能追加——这是防事后合理化的关键。`,
      confirmButtonText: '锁定',
    });
    locking.value = true;
    await store.lock(p.id);
    showSuccessToast('预判已锁定,进入跟踪');
    emit('locked', p);
    emit('update:show', false);
  } catch (e) {
    if (e?.message && e !== 'cancel') showFailToast(e.message);
  } finally {
    locking.value = false;
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 90vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>{{ isEdit() ? '编辑预判草稿' : '新预判' }}</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <van-field
        v-model="form.content"
        type="textarea"
        rows="2"
        autosize
        placeholder="可证伪的判断 * ,如:一个月内 X 项目会拿到新融资;下季度我会推迟交付至少一次"
      />
      <div class="block-label">类型</div>
      <div class="chip-row">
        <button v-for="k in PREDICTION_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
      </div>

      <div class="block-label">所属对象 *</div>
      <div class="chip-row">
        <button
          v-for="s in subjectStore.active"
          :key="s.id"
          class="tag-chip"
          :class="{ active: form.subjectId === s.id }"
          @click="form.subjectId = form.subjectId === s.id ? '' : s.id"
        >{{ s.name }}</button>
      </div>
      <div v-if="!subjectStore.active.length" class="muted" style="padding: 0 4px">先去「对象」页创建一个对象</div>

      <van-field v-model="form.windowStart" type="datetime-local" label="窗口开始" />
      <van-field v-model="form.windowEnd" type="datetime-local" label="截止 *" placeholder="到何时必须见分晓" />

      <div class="block-label">原始置信度(50–100%)*</div>
      <div class="slider-row">
        <van-slider v-model="form.origConfidence" :min="50" :max="100" style="flex: 1" />
        <span class="conf-num">{{ form.origConfidence }}%</span>
      </div>

      <div class="block-label">验证标准(提交前定义,防止事后挪门柱)</div>
      <van-field v-model="form.hit" type="textarea" rows="1" autosize label="算命中 *" placeholder="出现什么才算命中" />
      <van-field v-model="form.partial" type="textarea" rows="1" autosize label="算部分" placeholder="什么情况算部分命中(选填)" />
      <van-field v-model="form.miss" type="textarea" rows="1" autosize label="算错误" placeholder="什么情况算错误(选填)" />

      <van-field v-model="form.basis" type="textarea" rows="2" autosize label="依据链" placeholder="支持判断的事实/想法/规则;也写下削弱它的" />
      <van-field v-model="form.counterSignals" type="textarea" rows="2" autosize label="反证信号" placeholder="出现什么信号说明我可能错了" />

      <div v-if="store.atCapacity && !isEdit()" class="cap-tip">⚠ 进行中预判已达上限 {{ MAX_ACTIVE_PREDICTIONS }} 条,请先验证或放弃一些</div>

      <div class="btn-col">
        <van-button plain round type="primary" @click="saveDraft">存草稿</van-button>
        <van-button type="primary" round :loading="locking" :disabled="store.atCapacity && !isEdit()" @click="lock">锁定提交</van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.slider-row { display: flex; align-items: center; gap: 10px; padding: 4px 16px; }
.conf-num { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
.btn-col { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.cap-tip { font-size: 12px; color: var(--danger); margin: 10px 4px 0; }
</style>
