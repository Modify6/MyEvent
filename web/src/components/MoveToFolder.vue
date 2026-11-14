<script setup>
// 移动到文件夹:列出当前域的文件夹 + 未分类,点击即移动
import { onMounted, ref, watch } from 'vue';
import { showSuccessToast } from 'vant';
import { useFolderStore } from '../stores/folder.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  scope: { type: String, required: true }, // 'subject' | 'event'
  itemId: { type: String, required: true }, // 被移动的内容 id
  currentFolderId: { type: String, default: '' },
});
const emit = defineEmits(['update:show', 'moved']);

const store = useFolderStore();
const folders = ref([]);

watch(() => props.show, async (v) => {
  if (!v) return;
  await store.load();
  folders.value = store.byScope(props.scope);
});
onMounted(async () => {
  await store.load();
  folders.value = store.byScope(props.scope);
});

async function moveTo(folderId) {
  await store.moveItem(props.scope, props.itemId, folderId);
  showSuccessToast(folderId ? '已移入文件夹' : '已移出文件夹');
  emit('moved', folderId);
  emit('update:show', false);
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 56vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>移入文件夹</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <button class="mv-row" :class="{ cur: currentFolderId === '' }" @click="moveTo('')">
        <span class="mv-name">🗂 未分类</span>
        <van-icon v-if="currentFolderId === ''" name="success" color="var(--brand)" />
      </button>
      <button v-for="f in folders" :key="f.id" class="mv-row" :class="{ cur: currentFolderId === f.id }" @click="moveTo(f.id)">
        <span class="f-dot" :style="{ background: f.color }" />
        <span class="mv-name">{{ f.name }}</span>
        <van-icon v-if="currentFolderId === f.id" name="success" color="var(--brand)" />
      </button>
      <div v-if="!folders.length" class="muted" style="padding: 8px 4px">还没有文件夹 —— 去「管理」新建</div>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.mv-row { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 6px; border: 0; background: transparent; border-bottom: 1px solid var(--line); cursor: pointer; font-size: 14px; color: var(--text); text-align: left; }
.mv-row.cur .mv-name { color: var(--brand); font-weight: 600; }
.f-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
.mv-name { flex: 1; }
</style>
