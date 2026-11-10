<script setup>
// 线索信息编辑:标题/一句话事实/场景/挂靠对象 —— 建后可改
import { reactive, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { useCatalogStore } from '../stores/catalog.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  thread: { type: Object, default: null },
});
const emit = defineEmits(['update:show', 'saved']);

const eventStore = useEventStore();
const subjectStore = useSubjectStore();
const catalog = useCatalogStore();
const form = reactive({ title: '', fact: '', categoryId: '', subjectIds: [] });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    const t = props.thread;
    Object.assign(form, {
      title: t?.title || '',
      fact: t?.fact || '',
      categoryId: t?.categoryId || '',
      subjectIds: [...(t?.subjectIds || [])],
    });
  }
);

function toggleSubject(id) {
  const i = form.subjectIds.indexOf(id);
  if (i >= 0) form.subjectIds.splice(i, 1);
  else form.subjectIds.push(id);
}

async function save() {
  try {
    if (!form.title.trim()) return showFailToast('标题不能为空');
    await eventStore.patch(props.thread.id, {
      title: form.title.trim(),
      fact: form.fact.trim(),
      categoryId: form.categoryId,
      subjectIds: [...form.subjectIds],
    });
    showSuccessToast('线索信息已更新');
    emit('saved');
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 66vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>编辑线索信息</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <van-field v-model="form.title" label="标题" placeholder="线索标题 *" />
      <van-field v-model="form.fact" type="textarea" rows="2" autosize label="一句话事实" placeholder="客观发生了什么" />
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
      <div class="block-label">挂到对象(可多选)</div>
      <div class="chip-row">
        <button v-for="s in subjectStore.active" :key="s.id" class="tag-chip" :class="{ active: form.subjectIds.includes(s.id) }" @click="toggleSubject(s.id)">{{ s.name }}</button>
        <span v-if="!subjectStore.active.length" class="muted">还没有对象</span>
      </div>
      <van-button type="primary" round block style="margin-top: 16px" @click="save">保存</van-button>
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
</style>
