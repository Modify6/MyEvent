<script setup>
// 事件过程记录:往已有事件追加一条带触发源的跟进记录
// 触发源 = 这条记录由什么引发(一件事/一个视频/一个人/一个场景…),类型可扩展
import { reactive, ref, watch } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { useEventStore } from '../stores/event.js';
import { TRIGGER_KINDS } from '../lib/domain.js';
import { toLocalInput, fromLocalInput } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  eventId: { type: String, required: true },
});
const emit = defineEmits(['update:show', 'saved']);

const eventStore = useEventStore();
const more = ref(false);
const kind = ref('');
const form = reactive({ content: '', triggerNote: '', at: '' });

watch(
  () => props.show,
  (v) => {
    if (!v) return;
    Object.assign(form, { content: '', triggerNote: '', at: toLocalInput(Date.now()) });
    kind.value = '';
    more.value = false;
  }
);

async function save() {
  try {
    const row = await eventStore.addEntry({
      eventId: props.eventId,
      content: form.content,
      triggerKind: kind.value,
      triggerNote: form.triggerNote,
      at: fromLocalInput(form.at) || Date.now(),
    });
    showSuccessToast('已追加记录');
    emit('saved', row);
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 72vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>追加过程记录</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <div class="muted" style="margin: 0 2px 8px">{{ eventStore.byId(eventId)?.title || '' }} · 有什么新进展/新信息?</div>

      <van-field v-model="form.content" type="textarea" rows="3" autosize placeholder="这条记录的内容 *" />

      <div class="block-label">触发源 —— 这条记录由什么引发?</div>
      <div class="chip-row">
        <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = kind === k ? '' : k">{{ k }}</button>
      </div>
      <van-field
        v-model="form.triggerNote"
        type="textarea"
        rows="1"
        autosize
        placeholder="触发说明(选填),如:看了XX的分析视频 / 和老张吃饭时提到"
      />

      <template v-if="more">
        <van-field v-model="form.at" type="datetime-local" label="发生时间" />
      </template>
      <div v-else class="row-center" style="margin-top: 8px">
        <van-button size="small" plain round @click="more = true">修改时间</van-button>
      </div>

      <van-button type="primary" round block style="margin-top: 14px" @click="save">追加</van-button>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.row-center { display: flex; justify-content: center; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
</style>
