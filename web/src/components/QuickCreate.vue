<script setup>
// 挂靠就地快速新建:在「添加细节/编辑记录」里输入名称即建即选,不用跳出流程
// type='event' 新建线索(标题即名称);type='subject' 新建对象(可选类型,默认主题)
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { SUBJECT_TYPES } from '../lib/domain.js';
import { typeColor } from '../lib/display.js';
import AttachGuide from './AttachGuide.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  type: { type: String, default: 'subject' }, // 'event' | 'subject'
});
const emit = defineEmits(['update:show', 'created']);

const eventStore = useEventStore();
const subjectStore = useSubjectStore();
const subjectType = ref('主题');
const form = reactive({ name: '' });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    form.name = '';
    subjectType.value = '主题';
  }
);

const isEvent = () => props.type === 'event';
const showGuide = ref(false);

async function create() {
  try {
    if (isEvent()) {
      const ev = await eventStore.capture({ title: form.name });
      showSuccessToast('线索已创建并挂靠');
      emit('created', ev);
    } else {
      const s = await subjectStore.save({ name: form.name, type: subjectType.value });
      showSuccessToast('对象已创建并挂靠');
      emit('created', s);
    }
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 46vh" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>快速新建{{ isEvent() ? '线索' : '对象' }}</span>
        <span class="head-right">
          <span class="guide-link" @click="showGuide = true">怎么选?</span>
          <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
        </span>
      </div>
      <div class="reco">{{ isEvent() ? '适合:马上要推进的具体事情(一轮重构 / 一次谈判 / 一个决策)' : '适合:长期关注的主体(一个项目 / 一个人 / 一家公司 / 一个主题)' }}</div>
      <van-field
        v-model="form.name"
        :placeholder="isEvent() ? '线索标题,如:XX项目评估' : '对象名称,如:老张 / A公司'"
        @keyup.enter="create"
      />
      <template v-if="!isEvent()">
        <div class="block-label">🎯 类型</div>
        <div class="chip-row">
          <button v-for="t in SUBJECT_TYPES" :key="t" class="tag-chip" :class="{ active: subjectType === t }" :style="{ color: typeColor(t), borderColor: typeColor(t) + (subjectType === t ? '' : '59'), background: subjectType === t ? typeColor(t) + '1f' : 'transparent', fontWeight: subjectType === t ? 700 : 400 }" @click="subjectType = t">{{ t }}</button>
        </div>
      </template>
      <van-button type="primary" round block style="margin-top: 14px" @click="create">创建并挂靠</van-button>
      <AttachGuide v-model:show="showGuide" />
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.head-right { display: flex; align-items: center; gap: 12px; font-weight: 400; }
.guide-link { color: var(--brand); cursor: pointer; font-size: 12px; }
.reco { font-size: 12px; color: var(--text-2); background: var(--card-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
</style>
