<script setup>
// 文件夹式抽屉:折叠分组头部(文件夹图标+名称+计数+箭头),点击展开/收起
defineProps({
  title: { type: String, required: true },
  color: { type: String, default: '#98a2b3' },
  count: { type: Number, default: 0 },
  open: { type: Boolean, default: false },
});
defineEmits(['toggle']);
</script>

<template>
  <div class="folder">
    <button class="folder-head" @click="$emit('toggle')">
      <van-icon name="folder-o" class="f-icon" :style="{ color }" />
      <span class="f-title" :style="{ color }">{{ title || '未命名文件夹' }}</span>
      <span class="f-count">{{ count }}</span>
      <van-icon name="arrow" class="f-chev" :class="{ down: open }" />
    </button>
    <div v-show="open" class="folder-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.folder { margin-bottom: 10px; }
.folder-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border: 0;
  background: var(--card);
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}
.f-icon { font-size: 17px; }
.f-title { font-weight: 700; flex: 1; text-align: left; }
.f-count { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.f-chev { color: var(--text-3); transition: transform 0.2s; }
.f-chev.down { transform: rotate(90deg); }
.folder-body { padding: 4px 12px 8px; }
</style>
