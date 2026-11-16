<script setup>
// 自定义类型/触发源就地快速新建:在 chips 行点「+ 自定义」即建即选,不用跳出流程
// type='kind' 记录类型 / 'trigger' 触发源;名称查重同 VocabManage
import { reactive, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useVocabStore } from '../stores/vocab.js';
import { VOCAB_ICONS, PALETTE } from '../lib/display.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  type: { type: String, required: true }, // 'kind' | 'trigger'
});
const emit = defineEmits(['update:show', 'created']);

const store = useVocabStore();
const form = reactive({ name: '', icon: '', color: PALETTE[0] });

const isKind = () => props.type === 'kind';

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    form.name = '';
    form.icon = '';
    form.color = PALETTE[0];
  }
);

async function create() {
  try {
    const name = form.name.trim();
    if (!name) return showFailToast('名称不能为空');
    const row = await store.save({ type: props.type, name, icon: form.icon, color: isKind() ? form.color : '' });
    showSuccessToast(`自定义${isKind() ? '类型' : '触发源'}「${name}」已创建`);
    emit('created', row);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 52vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>自定义{{ isKind() ? '类型' : '触发源' }}</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <div class="reco">{{ isKind() ? '记录的性质,如:需求评审 / 灵感碎片 / 客户反馈' : '这条记录由什么引发,如:需求评审 / 站会 / 联调报错' }}</div>
      <van-field v-model="form.name" :placeholder="isKind() ? '类型名称,如:需求评审' : '触发源名称,如:需求评审'" @keyup.enter="create" />
      <div class="block-label">图标</div>
      <div class="icon-row">
        <button v-for="ic in VOCAB_ICONS" :key="ic" class="icon-sw" :class="{ on: form.icon === ic }" @click="form.icon = form.icon === ic ? '' : ic">{{ ic }}</button>
      </div>
      <div class="muted" style="margin: 2px 2px 0; font-size: 11px">不选图标则用默认{{ isKind() ? ' 📝' : ' ✳️' }}</div>
      <template v-if="isKind()">
        <div class="block-label">颜色</div>
        <div class="swatches">
          <button v-for="c in PALETTE" :key="c" class="sw" :class="{ on: form.color === c }" :style="{ background: c }" @click="form.color = c" />
        </div>
      </template>
      <van-button type="primary" round block style="margin-top: 14px" @click="create">创建并选中</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.reco { font-size: 12px; color: var(--text-2); background: var(--card-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.icon-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 2px; }
.icon-sw { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); font-size: 17px; cursor: pointer; }
.icon-sw.on { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, transparent); }
.swatches { display: flex; gap: 10px; padding: 0 2px; flex-wrap: wrap; }
.sw { width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.sw.on { border-color: var(--brand); }
</style>
