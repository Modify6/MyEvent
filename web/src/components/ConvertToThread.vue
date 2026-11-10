<script setup>
// 一键转线索:想法长成事件时,长按菜单「转为线索」——建线索并把这条记录改挂上去
import { ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  thought: { type: Object, default: null },
});
const emit = defineEmits(['update:show', 'done']);

const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const title = ref('');

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    title.value = (props.thought?.content || '').slice(0, 20);
  }
);

async function convert() {
  try {
    if (!title.value.trim()) return showFailToast('给线索起个标题');
    const t = props.thought;
    const ev = await eventStore.capture({
      title: title.value.trim(),
      subjectIds: t.subjectId ? [t.subjectId] : [],
      fact: '',
    });
    // 原记录改挂到新线索(修订历史留痕:改变要有记录)
    await thoughtStore.edit(t.id, { relatedEventId: ev.id });
    showSuccessToast(`已转为线索「${ev.title}」`);
    emit('done', ev);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 42vh" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>转为线索</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <div class="muted" style="margin: 0 2px 8px">这个想法已经长成要推进的事了 —— 建一条线索,原记录会挂到它下面(挂靠对象自动继承)</div>
      <van-field v-model="title" label="线索标题" placeholder="如:XX项目评估" @keyup.enter="convert" />
      <van-button type="primary" round block style="margin-top: 16px" @click="convert">创建线索并挂上这条记录</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
</style>
