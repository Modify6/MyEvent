<script setup>
// 文件夹管理弹层:新建/重命名/换色/上下移排序/删除(删除时内容回落未分类)
import { onMounted, ref, watch } from 'vue';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import { useFolderStore } from '../stores/folder.js';
import { PALETTE } from '../lib/display.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  scope: { type: String, required: true }, // 'subject' | 'event'
});
const emit = defineEmits(['update:show']);

const store = useFolderStore();
const editingId = ref(null);
const editName = ref('');
const editColor = ref(PALETTE[0]);
const creating = ref(false);
const newName = ref('');
const newColor = ref(PALETTE[0]);
const folders = ref([]);

watch(() => props.show, async (v) => {
  if (!v) return;
  await store.load();
  folders.value = store.byScope(props.scope);
});

async function refresh() {
  await store.load();
  folders.value = store.byScope(props.scope);
}
function startEdit(f) {
  editingId.value = f.id;
  editName.value = f.name;
  editColor.value = f.color;
}
async function saveEdit(f) {
  try {
    if (!editName.value.trim()) return showFailToast('名称不能为空');
    await store.save({ id: f.id, name: editName.value, color: editColor.value, scope: props.scope });
    editingId.value = null;
    showSuccessToast('已保存');
    await refresh();
  } catch (e) {
    showFailToast(e.message);
  }
}
async function create() {
  try {
    if (!newName.value.trim()) return showFailToast('名称不能为空');
    const dup = folders.value.find((f) => f.name === newName.value.trim());
    if (dup) return showFailToast('已有同名文件夹');
    await store.save({ name: newName.value, color: newColor.value, scope: props.scope });
    newName.value = '';
    creating.value = false;
    showSuccessToast('文件夹已创建');
    await refresh();
  } catch (e) {
    showFailToast(e.message);
  }
}
async function moveUpDown(f, dir) {
  await store.moveUpDown(f.id, dir);
  await refresh();
}
async function removeFolder(f) {
  try {
    await showConfirmDialog({
      title: '删除文件夹?',
      message: `「${f.name}」内的内容不会删除,将回落到未分类。`,
      confirmButtonText: '删除',
    });
    await store.remove(f.id);
    showSuccessToast('已删除,内容回落未分类');
    await refresh();
  } catch {}
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 72vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>管理文件夹</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <div class="muted" style="margin: 0 2px 10px">文件夹按此处顺序展示为抽屉;删除文件夹时,里面的内容回落到「未分类」,不会丢失。</div>

      <div v-for="f in folders" :key="f.id" class="f-row">
        <template v-if="editingId === f.id">
          <input v-model="editName" class="f-input" @keyup.enter="saveEdit(f)" />
          <div class="swatches">
            <button v-for="c in PALETTE" :key="c" class="sw" :class="{ on: editColor === c }" :style="{ background: c }" @click="editColor = c" />
          </div>
          <div class="f-ops">
            <van-button size="mini" type="primary" round @click="saveEdit(f)">存</van-button>
            <van-button size="mini" plain round @click="editingId = null">取消</van-button>
          </div>
        </template>
        <template v-else>
          <span class="f-dot" :style="{ background: f.color }" />
          <span class="f-name">{{ f.name }}</span>
          <span class="f-ops">
            <van-icon name="arrow-up" @click="moveUpDown(f, -1)" />
            <van-icon name="arrow-down" @click="moveUpDown(f, 1)" />
            <van-icon name="edit" @click="startEdit(f)" />
            <van-icon name="delete-o" color="var(--danger)" @click="removeFolder(f)" />
          </span>
        </template>
      </div>

      <div v-if="creating" class="f-creating">
        <van-field v-model="newName" placeholder="文件夹名称" @keyup.enter="create" />
        <div class="swatches">
          <button v-for="c in PALETTE" :key="c" class="sw" :class="{ on: newColor === c }" :style="{ background: c }" @click="newColor = c" />
        </div>
        <div class="f-ops">
          <van-button size="small" type="primary" round @click="create">创建</van-button>
          <van-button size="small" plain round @click="creating = false">取消</van-button>
        </div>
      </div>
      <van-button v-else size="small" plain round block icon="plus" style="margin-top: 12px" @click="creating = true">新建文件夹</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.f-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--line); }
.f-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
.f-name { flex: 1; font-size: 14px; font-weight: 600; }
.f-ops { display: flex; align-items: center; gap: 10px; color: var(--text-3); }
.f-ops .van-icon { cursor: pointer; font-size: 16px; }
.f-input { flex: 1; border: 1px solid var(--line); border-radius: 6px; padding: 5px 9px; font-size: 13px; background: var(--card-2); color: var(--text); }
.swatches { display: flex; gap: 8px; margin: 6px 0; }
.sw { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.f-creating { margin-top: 10px; padding: 10px; border: 1px dashed var(--line); border-radius: 8px; }
</style>
