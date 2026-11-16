<script setup>
// 类型与触发源管理弹层:内置项只读(带「内置」标),自定义项可改名/换图标色/上下移/删除
// scope='kind' | 'trigger';删除不影响已用该值的旧记录(原样展示)
import { computed, onMounted, ref, watch } from 'vue';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import { useVocabStore } from '../stores/vocab.js';
import { VOCAB_ICONS, PALETTE } from '../lib/display.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  scope: { type: String, required: true }, // 'kind' | 'trigger'
});
const emit = defineEmits(['update:show']);

const store = useVocabStore();
const isKind = () => props.scope === 'kind';

// 内置项(只读展示)与自定义项
const builtins = computed(() => (isKind() ? store.kinds : store.triggers).filter((n) => !store.byType(props.scope).some((x) => x.name === n)));
const customs = computed(() => store.byType(props.scope));

const editingId = ref(null);
const editName = ref('');
const editIcon = ref('');
const editColor = ref(PALETTE[0]);
const creating = ref(false);
const newName = ref('');
const newIcon = ref('');
const newColor = ref(PALETTE[0]);

watch(
  () => props.show,
  async (v) => {
    if (!v) return;
    await store.load();
  }
);
onMounted(async () => {
  await store.load();
});

function startEdit(x) {
  editingId.value = x.id;
  editName.value = x.name;
  editIcon.value = x.icon || '';
  editColor.value = x.color || PALETTE[0];
}
async function saveEdit(x) {
  try {
    if (!editName.value.trim()) return showFailToast('名称不能为空');
    await store.save({ id: x.id, type: props.scope, name: editName.value, icon: editIcon.value, color: editColor.value });
    editingId.value = null;
    showSuccessToast('已保存');
  } catch (e) {
    showFailToast(e.message);
  }
}
async function create() {
  try {
    if (!newName.value.trim()) return showFailToast('名称不能为空');
    await store.save({ type: props.scope, name: newName.value, icon: newIcon.value, color: newColor.value });
    newName.value = '';
    newIcon.value = '';
    creating.value = false;
    showSuccessToast('已创建');
  } catch (e) {
    showFailToast(e.message);
  }
}
async function removeCustom(x) {
  try {
    await showConfirmDialog({
      title: `删除「${x.name}」?`,
      message: '已有记录不受影响,仍按原值展示;筛选里将不再出现。',
      confirmButtonText: '删除',
    });
    await store.remove(x.id);
    showSuccessToast('已删除');
  } catch {}
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 72vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>管理{{ isKind() ? '类型' : '触发源' }}</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <div class="muted" style="margin: 0 2px 10px">内置项不可删改;自定义项可改名/换图标/排序/删除。删除不影响已有记录(原值原样展示)。</div>

      <div class="group-label">内置 · {{ builtins.length }}</div>
      <div class="v-row" v-for="n in builtins" :key="'b-' + n">
        <span class="v-icon">{{ isKind() ? store.kindMetaOf(n).icon : store.triggerIconOf(n) }}</span>
        <span class="v-name">{{ n }}</span>
        <van-tag plain round size="small" type="default">内置</van-tag>
      </div>

      <div class="group-label">自定义 · {{ customs.length }}</div>
      <div v-for="x in customs" :key="x.id" class="v-row">
        <template v-if="editingId === x.id">
          <input v-model="editName" class="v-input" @keyup.enter="saveEdit(x)" />
          <div class="icon-row">
            <button v-for="ic in VOCAB_ICONS" :key="ic" class="icon-sw" :class="{ on: editIcon === ic }" @click="editIcon = editIcon === ic ? '' : ic">{{ ic }}</button>
          </div>
          <div v-if="isKind()" class="swatches">
            <button v-for="c in PALETTE" :key="c" class="sw" :class="{ on: editColor === c }" :style="{ background: c }" @click="editColor = c" />
          </div>
          <div class="v-ops">
            <van-button size="mini" type="primary" round @click="saveEdit(x)">存</van-button>
            <van-button size="mini" plain round @click="editingId = null">取消</van-button>
          </div>
        </template>
        <template v-else>
          <span class="v-icon">{{ isKind() ? store.kindMetaOf(x.name).icon : store.triggerIconOf(x.name) }}</span>
          <span class="v-name">{{ x.name }}</span>
          <span class="v-ops">
            <van-icon name="arrow-up" @click="store.moveUpDown(x.id, -1)" />
            <van-icon name="arrow-down" @click="store.moveUpDown(x.id, 1)" />
            <van-icon name="edit" @click="startEdit(x)" />
            <van-icon name="delete-o" color="var(--danger)" @click="removeCustom(x)" />
          </span>
        </template>
      </div>
      <div v-if="!customs.length && !creating" class="muted" style="padding: 4px">还没有自定义项 —— 下面新建一个</div>

      <div v-if="creating" class="v-creating">
        <van-field v-model="newName" :placeholder="isKind() ? '类型名称' : '触发源名称'" @keyup.enter="create" />
        <div class="icon-row">
          <button v-for="ic in VOCAB_ICONS" :key="ic" class="icon-sw" :class="{ on: newIcon === ic }" @click="newIcon = newIcon === ic ? '' : ic">{{ ic }}</button>
        </div>
        <div v-if="isKind()" class="swatches">
          <button v-for="c in PALETTE" :key="c" class="sw" :class="{ on: newColor === c }" :style="{ background: c }" @click="newColor = c" />
        </div>
        <div class="v-ops" style="margin-top: 8px">
          <van-button size="small" type="primary" round @click="create">创建</van-button>
          <van-button size="small" plain round @click="creating = false">取消</van-button>
        </div>
      </div>
      <van-button v-else size="small" plain round block icon="plus" style="margin-top: 12px" @click="creating = true">新建{{ isKind() ? '类型' : '触发源' }}</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.group-label { font-size: 12px; color: var(--text-3); margin: 10px 2px 4px; }
.v-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.v-icon { flex: none; width: 24px; text-align: center; font-size: 16px; }
.v-name { flex: 1; font-size: 14px; font-weight: 600; }
.v-ops { display: flex; align-items: center; gap: 10px; color: var(--text-3); }
.v-ops .van-icon { cursor: pointer; font-size: 16px; }
.v-input { flex: 1; border: 1px solid var(--line); border-radius: 6px; padding: 5px 9px; font-size: 13px; background: var(--card-2); color: var(--text); }
.icon-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
.icon-sw { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); font-size: 16px; cursor: pointer; }
.icon-sw.on { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, transparent); }
.swatches { display: flex; gap: 8px; margin: 4px 0; flex-wrap: wrap; }
.sw { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.v-creating { margin-top: 10px; padding: 10px; border: 1px dashed var(--line); border-radius: 8px; }
</style>
