<script setup>
// 对象表单：新建/编辑对象 + 当前观点快照（当前判断/置信度/核心理由/最大反证/开放问题/下次回顾）
import { computed, reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import dayjs from 'dayjs';
import { useSubjectStore } from '../stores/subject.js';
import { useFolderStore } from '../stores/folder.js';
import { SUBJECT_TYPES, clampPct } from '../lib/domain.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  subject: { type: Object, default: null }, // 传入为编辑模式
  draft: { type: String, default: '' }, // 观点草稿(仅新建视角时预填,用户改写)
});
const emit = defineEmits(['update:show', 'saved']);

const store = useSubjectStore();
const folderStore = useFolderStore();
const type = ref('主题');
const showView = ref(false);

const form = reactive({
  id: null,
  folderId: '',
  name: '',
  tags: '',
  currentView: '',
  currentConfidence: 60,
  hasConfidence: false,
  topReasons: '',
  biggestRisk: '',
  openQuestions: '',
  nextReviewDate: '',
});

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    const s = props.subject;
    Object.assign(form, {
      id: s?.id || null,
      name: s?.name || '',
      tags: (s?.tags || []).join(', '),
      currentView: s?.currentView || '',
      currentConfidence: clampPct(s?.currentConfidence) ?? 60,
      hasConfidence: s?.currentConfidence != null,
      topReasons: (s?.topReasons || []).join('\n'),
      biggestRisk: s?.biggestRisk || '',
      openQuestions: s?.openQuestions || '',
      nextReviewDate: s?.nextReviewAt ? dayjs(s.nextReviewAt).format('YYYY-MM-DD') : '',
    });
    type.value = s?.type || '主题';
    form.folderId = s?.folderId || '';
    showView.value = !!(s?.currentView);
    if (!s && props.draft && !form.currentView) form.currentView = props.draft;
  }
);

const isEdit = computed(() => !!form.id);

async function save() {
  try {
    const row = await store.save({
        folderId: form.folderId || '',
      id: form.id,
      name: form.name,
      type: type.value,
      tags: form.tags.split(/[,，]/),
      currentView: form.currentView,
      currentConfidence: form.hasConfidence ? form.currentConfidence : null,
      topReasons: form.topReasons.split('\n'),
      biggestRisk: form.biggestRisk,
      openQuestions: form.openQuestions,
      nextReviewAt: form.nextReviewDate ? dayjs(form.nextReviewDate).valueOf() : null,
    });
    showSuccessToast(isEdit.value ? '已保存' : `对象「${row.name}」已创建`);
    emit('saved', row);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 88vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>{{ isEdit ? '编辑对象' : '新建对象' }}</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <van-field v-model="form.name" label="名称" placeholder="人 / 项目 / 公司 / 投资标的…" required />
      <div class="block-label">类型</div>
      <div class="chip-row">
        <button v-for="t in SUBJECT_TYPES" :key="t" class="tag-chip" :class="{ active: type === t }" @click="type = t">{{ t }}</button>
      </div>
      <van-field v-model="form.tags" label="标签" placeholder="逗号分隔,如: 重要, 长期" />
      <div class="block-label">📁 文件夹(选填)</div>
      <div class="chip-row">
        <button class="tag-chip" :class="{ active: form.folderId === '' }" @click="form.folderId = ''">未分类</button>
        <button v-for="f in folderStore.byScope('subject')" :key="f.id" class="tag-chip" :class="{ active: form.folderId === f.id }" @click="form.folderId = f.id">{{ f.name }}</button>
      </div>

      <div class="block-label row-between" style="margin-top: 14px">
        <span>当前观点快照<span class="muted">（选填,可后补）</span></span>
        <van-button v-if="!showView" size="small" plain round type="primary" @click="showView = true">填写</van-button>
      </div>
      <template v-if="showView">
        <van-field v-model="form.currentView" type="textarea" rows="2" autosize label="当前判断" placeholder="我现在对这个对象的核心判断是…" />
        <div class="block-label">当前置信度</div>
        <div class="slider-row">
          <van-checkbox v-model="form.hasConfidence" shape="square" icon-size="14px">已形成置信度</van-checkbox>
          <template v-if="form.hasConfidence">
            <van-slider v-model="form.currentConfidence" :min="0" :max="100" style="flex: 1" />
            <span class="conf-num">{{ form.currentConfidence }}%</span>
          </template>
        </div>
        <van-field v-model="form.topReasons" type="textarea" rows="3" autosize label="核心理由" placeholder="一行一条,最多 5 条" />
        <van-field v-model="form.biggestRisk" type="textarea" rows="2" autosize label="最大反证" placeholder="最可能推翻判断的证据/风险" />
        <van-field v-model="form.openQuestions" type="textarea" rows="2" autosize label="开放问题" placeholder="还没想清楚的问题" />
        <van-field v-model="form.nextReviewDate" type="date" label="下次回顾" placeholder="选择日期" />
      </template>

      <van-button type="primary" round block style="margin-top: 16px" @click="save">{{ isEdit ? '保存' : '创建' }}</van-button>
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
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.slider-row { display: flex; align-items: center; gap: 10px; padding: 0 16px 4px; }
.conf-num { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
</style>
