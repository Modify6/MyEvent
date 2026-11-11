<script setup>
// 事件快速捕获（30 秒记下事实）：标题/发生时间/关联对象(多选)/场景/一句话事实
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { useCatalogStore } from '../stores/catalog.js';
import { TRIGGER_KINDS } from '../lib/domain.js';
import { trigChipStyle, TRIGGER_ICON } from '../lib/display.js';
import { toLocalInput, fromLocalInput } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  subjectId: { type: String, default: '' }, // 从对象页打开时预填
});
const emit = defineEmits(['update:show', 'saved']);

const eventStore = useEventStore();
const subjectStore = useSubjectStore();
const catalog = useCatalogStore();

const form = reactive({ title: '', startAt: '', fact: '', categoryId: '', subjectIds: [], triggerNote: '' });
const more = ref(false);
const triggerKind = ref('');

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    Object.assign(form, {
      title: '',
      startAt: toLocalInput(Date.now()),
      fact: '',
      categoryId: '',
      subjectIds: props.subjectId ? [props.subjectId] : [],
      triggerNote: '',
    });
    triggerKind.value = '';
    more.value = false;
  }
);

function toggleSubject(id) {
  const i = form.subjectIds.indexOf(id);
  if (i >= 0) form.subjectIds.splice(i, 1);
  else form.subjectIds.push(id);
}

async function save() {
  try {
    const ev = await eventStore.capture({
      title: form.title,
      startAt: fromLocalInput(form.startAt) || Date.now(),
      subjectIds: form.subjectIds,
      categoryId: form.categoryId,
      fact: form.fact,
    });
    // 捕获时填了触发源 → 成为第 1 条过程记录(这件事的"出发原因")
    if (triggerKind.value || form.triggerNote.trim()) {
      await eventStore.addEntry({
        eventId: ev.id,
        content: form.triggerNote.trim() || `由${triggerKind.value}触发`,
        triggerKind: triggerKind.value,
        triggerNote: form.triggerNote.trim(),
        at: fromLocalInput(form.startAt) || Date.now(),
      });
    }
    showSuccessToast('线索已创建');
    emit('saved', ev);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 78vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>记事件</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <van-field v-model="form.title" placeholder="发生了什么?一句话标题 *" />
      <van-field v-model="form.fact" type="textarea" rows="2" autosize placeholder="一句话事实:只写客观发生了什么(选填)" />

      <div class="block-label">📌 触发源 —— 这件事由什么引发?(选填,记下出发原因)</div>
      <div class="chip-row">
        <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" :style="trigChipStyle(k, triggerKind === k)" @click="triggerKind = triggerKind === k ? '' : k">{{ TRIGGER_ICON[k] }} {{ k }}</button>
      </div>
      <van-field v-model="form.triggerNote" type="textarea" rows="1" autosize placeholder="触发说明(选填),如:看了XX视频 / 和XX聊天时提到" />

      <div class="block-label">关联对象(可多选)</div>
      <div class="chip-row">
        <button
          v-for="s in subjectStore.active"
          :key="s.id"
          class="tag-chip"
          :class="{ active: form.subjectIds.includes(s.id) }"
          @click="toggleSubject(s.id)"
        >{{ s.name }}</button>
        <span v-if="!subjectStore.active.length" class="muted">还没有对象,可不选</span>
      </div>

      <template v-if="more">
        <van-field v-model="form.startAt" type="datetime-local" label="发生时间" />
        <div class="block-label">场景标签</div>
        <div class="chip-row">
          <button
            v-for="c in catalog.active"
            :key="c.id"
            class="tag-chip"
            :class="{ active: form.categoryId === c.id }"
            :style="form.categoryId === c.id ? { borderColor: c.color, color: c.color } : {}"
            @click="form.categoryId = form.categoryId === c.id ? '' : c.id"
          >{{ c.name }}</button>
        </div>
      </template>
      <div class="row-center" style="margin-top: 8px">
        <van-button v-if="!more" size="small" plain round @click="more = true">更多选项</van-button>
      </div>

      <van-button type="primary" round block style="margin-top: 14px" @click="save">创建线索</van-button>
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
