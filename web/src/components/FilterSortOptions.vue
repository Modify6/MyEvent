<script setup>
// 筛选选项列表(带频次计数与排序切换):供记录首页的 类型/对象/线索 下拉使用
// 排序:按频次(默认,命中条数降序) / 按名称;"全部"类选项恒置顶
import { computed } from 'vue';
import { sortFilterOptions } from '../lib/util.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  sort: { type: String, default: 'freq' }, // 'freq' | 'name'
  options: { type: Array, required: true }, // [{ text, value, count }]
});
const emit = defineEmits(['update:modelValue', 'update:sort', 'close']);

const sorted = computed(() => sortFilterOptions(props.options, props.sort));

function pick(o) {
  emit('update:modelValue', o.value);
  emit('close');
}
</script>

<template>
  <div class="fs-wrap">
    <div class="fs-head">
      <span class="fs-label">排序</span>
      <button class="fs-sort" :class="{ on: sort === 'freq' }" @click="emit('update:sort', 'freq')">按频次</button>
      <button class="fs-sort" :class="{ on: sort === 'name' }" @click="emit('update:sort', 'name')">按名称</button>
    </div>
    <div
      v-for="o in sorted"
      :key="o.value"
      class="fs-row"
      :class="{ active: o.value === modelValue }"
      @click="pick(o)"
    >
      <span class="fs-text">{{ o.text }}</span>
      <span v-if="o.count != null && o.value" class="fs-count">{{ o.count }}</span>
      <van-icon v-if="o.value === modelValue" name="success" color="var(--brand)" />
    </div>
  </div>
</template>

<style scoped>
.fs-wrap { padding: 4px 0 8px; max-height: 56vh; overflow: auto; }
.fs-head { display: flex; align-items: center; gap: 8px; padding: 6px 14px 8px; border-bottom: 1px solid var(--line); }
.fs-label { font-size: 11px; color: var(--text-3); }
.fs-sort { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 3px 11px; font-size: 11px; color: var(--text-2); cursor: pointer; }
.fs-sort.on { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.fs-row { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; font-size: 14px; color: var(--text); }
.fs-row.active { color: var(--brand); font-weight: 600; }
.fs-row:active { background: color-mix(in srgb, var(--text) 6%, transparent); }
.fs-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-count { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; background: var(--card-2); border-radius: 999px; padding: 1px 8px; }
.fs-row.active .fs-count { color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, transparent); }
</style>
