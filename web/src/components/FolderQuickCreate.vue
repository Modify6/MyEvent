<script setup>
// 文件夹就地快速新建:在选文件夹的地方(表单/移动弹层)点「+ 新建」即建即选,不用跳出流程去「管理」
// scope 由使用方传入('subject'|'event');同名查重与 FolderManage 一致
import { reactive, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useFolderStore } from '../stores/folder.js';
import { PALETTE } from '../lib/display.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  scope: { type: String, required: true }, // 'subject' | 'event'
});
const emit = defineEmits(['update:show', 'created']);

const store = useFolderStore();
const form = reactive({ name: '', color: PALETTE[0] });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    form.name = '';
    form.color = PALETTE[0];
  }
);

async function create() {
  try {
    const name = form.name.trim();
    if (!name) return showFailToast('名称不能为空');
    const dup = store.active.find((f) => f.scope === props.scope && f.name === name);
    if (dup) return showFailToast('已有同名文件夹');
    const row = await store.save({ name, color: form.color, scope: props.scope });
    showSuccessToast(`文件夹「${name}」已创建`);
    emit('created', row.id);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 40vh" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>快速新建文件夹</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <div class="reco">建好即自动选中,不用跳出当前流程</div>
      <van-field v-model="form.name" placeholder="文件夹名称,如:工作 / 投资" @keyup.enter="create" />
      <div class="block-label">颜色</div>
      <div class="swatches">
        <button v-for="c in PALETTE" :key="c" class="sw" :class="{ on: form.color === c }" :style="{ background: c }" @click="form.color = c" />
      </div>
      <van-button type="primary" round block style="margin-top: 14px" @click="create">创建并选中</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.reco { font-size: 12px; color: var(--text-2); background: var(--card-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.swatches { display: flex; gap: 10px; padding: 0 2px; }
.sw { width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.sw.on { border-color: var(--brand); }
</style>
