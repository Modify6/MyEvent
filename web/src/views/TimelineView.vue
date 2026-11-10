<script setup>
// 记录流首页:3 秒随手记(内容即可),全部记录按时间倒序混排(想法/事实/感想 + 线索过程记录)
// 没有待办、没有必填 —— 重点是过程,持续记录,演化自然沉淀
import { computed, nextTick, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showFailToast, showSuccessToast } from 'vant';
import dayjs from 'dayjs';
import { useThoughtStore } from '../stores/thought.js';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import NoteEditor from '../components/NoteEditor.vue';
import QuickCreate from '../components/QuickCreate.vue';
import AttachGuide from '../components/AttachGuide.vue';
import ConvertToThread from '../components/ConvertToThread.vue';
import SyncDot from '../components/SyncDot.vue';
import { THOUGHT_KINDS, TRIGGER_KINDS } from '../lib/domain.js';
import { kindMeta, parseTrigger } from '../lib/display.js';
import { fmtTime } from '../lib/time.js';

const router = useRouter();
const thoughtStore = useThoughtStore();
const eventStore = useEventStore();
const subjectStore = useSubjectStore();

// —— 快捷输入(内联,最快路径:内容 + 发送) ——
const kind = ref('想法');
const triggerKind = ref('');
const detail = ref(false);
const form = reactive({ content: '', triggerNote: '', subjectId: '', eventId: '' });

async function quickSend() {
  try {
    const src = triggerKind.value
      ? `由${triggerKind.value}触发${form.triggerNote ? ':' + form.triggerNote : ''}`
      : form.triggerNote;
    await thoughtStore.quickAdd({
      content: form.content,
      kind: kind.value,
      subjectId: form.subjectId,
      relatedEventId: form.eventId,
      source: src,
    });
    form.content = '';
    form.triggerNote = '';
    showSuccessToast('已记录');
    // 连续记录:发送后焦点回到输入框
    nextTick(() => document.querySelector('.quick-input textarea')?.focus());
  } catch (e) {
    showFailToast(e.message);
  }
}

// —— 统一记录时间线:thoughts(独立/挂对象/挂线索的随手记) + eventEntries(线索过程记录) ——
const feed = computed(() => {
  const items = [];
  for (const t of thoughtStore.active) {
    items.push({
      key: 't:' + t.id, type: 't', raw: t, kind: t.kind, content: t.content, at: t.at,
      trigger: t.source || '', summary: false, edited: (t.edits || []).length > 0,
      subjectId: t.subjectId || '', eventId: t.relatedEventId || '',
    });
  }
  for (const en of eventStore.entries) {
    if (en.deleted) continue;
    items.push({
      key: 'e:' + en.id, type: 'e', raw: en, kind: en.kind === 'summary' ? '小结' : '记录', content: en.content, at: en.at,
      trigger: en.triggerKind ? `由${en.triggerKind}触发${en.triggerNote ? ':' + en.triggerNote : ''}` : (en.triggerNote || ''),
      summary: en.kind === 'summary', edited: (en.edits || []).length > 0,
      subjectId: (eventStore.byId(en.eventId)?.subjectIds || [])[0] || '', eventId: en.eventId,
    });
  }
  return items.sort((a, b) => b.at - a.at);
});

// 按天分组:今天 / 昨天 / M月D日
const groups = computed(() => {
  const map = new Map();
  for (const it of feed.value) {
    const d = dayjs(it.at);
    const label = d.isSame(dayjs(), 'day') ? '今天' : d.isSame(dayjs().subtract(1, 'day'), 'day') ? '昨天' : d.format('M月D日');
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(it);
  }
  return [...map.entries()];
});

const subjectName = (id) => subjectStore.nameOf(id);
const eventTitle = (id) => eventStore.byId(id)?.title || '线索';
// 视觉映射:类型色标签 / 触发源图标
const kindStyle = (k) => {
  const m = kindMeta(k);
  return { color: m.color, borderColor: m.color + '59', background: m.color + '1f' };
};
const kindIcon = (k) => kindMeta(k).icon;
const trig = (src) => parseTrigger(src);

// 二次修改:点击=编辑,长按=操作菜单(编辑/删除);旧值自动存入修订历史
const showEditor = ref(false);
const editItem = ref(null);
const showActions = ref(false);
let pressTimer = null;
let pressFired = false;
function openEdit(it) {
  editItem.value = it;
  showEditor.value = true;
}
function startPress(it) {
  pressFired = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressFired = true;
    editItem.value = it;
    showActions.value = true;
  }, 550);
}
function cancelPress() {
  clearTimeout(pressTimer);
}
function onItemClick(it) {
  if (pressFired) {
    pressFired = false;
    return; // 长按已处理,吞掉紧随的 click
  }
  openEdit(it);
}
async function removeItem(it) {
  if (it.type === 't') await thoughtStore.remove(it.raw.id);
  else await eventStore.removeEntry(it.raw.id);
}
// 挂靠就地快速新建:建好即自动选中
const showQuickCreate = ref(false);
const quickCreateType = ref('subject');
function quickCreate(type) {
  quickCreateType.value = type;
  showQuickCreate.value = true;
}
function onQuickCreated(row) {
  if (quickCreateType.value === 'event') form.eventId = row.id;
  else form.subjectId = row.id;
}
const showGuide = ref(false);
// 一键转线索:想法长成事件时,长按菜单直达(建线索+原记录改挂)
const showConvert = ref(false);
function startConvert() {
  showConvert.value = true;
}
// 操作菜单按记录类型动态生成:想法多一个「转为线索」
const sheetActions = computed(() => {
  const a = [{ name: '编辑', key: 'edit' }];
  if (editItem.value?.type === 't') a.splice(1, 0, { name: '转为线索', key: 'convert' });
  a.push({ name: '删除', key: 'remove', color: 'var(--danger)' });
  return a;
});
function onSheetSelect(a) {
  if (!editItem.value) return;
  if (a.key === 'edit') openEdit(editItem.value);
  else if (a.key === 'convert') startConvert();
  else if (a.key === 'remove') removeItem(editItem.value);
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>记录</h1>
      <div class="head-icons">
        <SyncDot />
        <van-icon name="search" size="20" @click="router.push('/search')" />
        <van-icon name="setting-o" size="20" @click="router.push('/settings')" />
      </div>
    </div>

    <!-- 快捷输入:内容即可发送;细节全部可选展开 -->
    <div class="hint-line">点击记录 = 修改 · 长按 = 编辑/删除;# 线索、@ 对象标签可点跳转</div>
    <div class="card quick">
      <van-field
        v-model="form.content"
        type="textarea"
        rows="2"
        autosize
        :placeholder="`随手记一句(${kind}…)`"
        class="quick-input"
        @keydown.enter.exact.prevent="quickSend"
      />
      <div class="quick-foot">
        <van-button size="small" plain round @click="detail = !detail">{{ detail ? '收起细节' : '添加细节' }}</van-button>
        <van-button type="primary" size="small" round icon="promotion" @click="quickSend">记下</van-button>
      </div>
      <template v-if="detail">
        <div class="block-label">类型</div>
        <div class="chip-row">
          <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
        </div>
        <div class="block-label">触发源</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" @click="triggerKind = triggerKind === k ? '' : k">{{ k }}</button>
        </div>
        <van-field v-model="form.triggerNote" type="textarea" rows="1" autosize placeholder="触发说明(选填)" />
        <div class="block-label row-between">
          <span>挂到线索 · 哪件事(选填)</span>
          <span class="guide-link" @click="showGuide = true">怎么选?</span>
        </div>
        <div class="chip-row">
          <button v-for="e in eventStore.threads.slice(0, 6)" :key="e.id" class="tag-chip" :class="{ active: form.eventId === e.id }" @click="form.eventId = form.eventId === e.id ? '' : e.id">{{ e.title.slice(0, 10) }}</button>
          <button class="tag-chip add-chip" @click="quickCreate('event')">+ 新建</button>
        </div>
        <div class="block-label">挂到对象 · 关于谁(选填)</div>
        <div class="chip-row">
          <button v-for="s in subjectStore.active" :key="s.id" class="tag-chip" :class="{ active: form.subjectId === s.id }" @click="form.subjectId = form.subjectId === s.id ? '' : s.id">{{ s.name }}</button>
          <button class="tag-chip add-chip" @click="quickCreate('subject')">+ 新建</button>
        </div>
      </template>
    </div>

    <!-- 记录流 -->
    <template v-for="[label, list] in groups" :key="label">
      <div class="section-title">{{ label }} · {{ list.length }}</div>
      <div class="card">
        <div v-for="it in list" :key="it.key">
          <div
            class="feed-item"
            :class="{ summary: it.summary }"
            @click="onItemClick(it)"
            @touchstart.passive="startPress(it)"
            @touchmove.passive="cancelPress"
            @touchend="cancelPress"
            @contextmenu.prevent
          >
            <div class="feed-kind" :style="kindStyle(it.kind)">{{ kindIcon(it.kind) }} {{ it.kind }}</div>
            <div class="row-main">
              <div class="feed-text">{{ it.content }}</div>
              <div class="muted">
                {{ fmtTime(it.at) }}
                <template v-if="it.edited"> · ✎ 已编辑</template>
                <template v-if="trig(it.trigger)"> · <span class="trig">{{ trig(it.trigger).icon }} {{ trig(it.trigger).text }}</span></template>
              </div>
              <div class="feed-chips">
                <span v-if="it.eventId" class="chip chip-thread" @click.stop="router.push(`/events/${it.eventId}`)"># {{ eventTitle(it.eventId) }}</span>
                <span v-if="it.subjectId" class="chip chip-subject" @click.stop="router.push(`/subjects/${it.subjectId}`)">@ {{ subjectName(it.subjectId) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-if="!feed.length" class="card">
      <div class="empty-tip">还没有记录 —— 上面输入框里写一句,3 秒记下第一笔</div>
    </div>

    <NoteEditor v-model:show="showEditor" :thought="editItem?.type === 't' ? editItem.raw : null" :entry="editItem?.type === 'e' ? editItem.raw : null" @saved="editItem = null" />

    <QuickCreate v-model:show="showQuickCreate" :type="quickCreateType" @created="onQuickCreated" />
    <AttachGuide v-model:show="showGuide" />

    <van-action-sheet
      v-model:show="showActions"
      :actions="sheetActions"
      cancel-text="取消"
      close-on-click-action
      @select="onSheetSelect"
    />

    <ConvertToThread v-model:show="showConvert" :thought="editItem?.type === 't' ? editItem.raw : null" @done="editItem = null" />
  </div>
</template>

<style scoped>
.head-icons { display: flex; gap: 16px; color: var(--text-2); cursor: pointer; }
.hint-line { font-size: 12px; color: var(--text-3); margin: -2px 2px 8px; }
.quick { padding-bottom: 10px; }
.quick-input :deep(.van-field__control) { font-size: 15px; }
.quick-foot { display: flex; justify-content: space-between; padding: 4px 2px 0; }
.block-label { font-size: 12px; color: var(--text-3); margin: 10px 2px 6px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.add-chip { border-style: dashed; color: var(--text-3); }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.guide-link { color: var(--brand); cursor: pointer; font-size: 12px; }
.feed-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.feed-item:last-child { border-bottom: 0; }
.feed-item.summary { background: color-mix(in srgb, var(--brand) 5%, transparent); border-left: 3px solid var(--brand); border-radius: 8px; padding: 10px 8px; margin: 4px 0; border-bottom: 0; }
.feed-kind { flex: none; font-size: 11px; border: 1px solid; border-radius: 4px; padding: 1px 6px; height: fit-content; margin-top: 2px; white-space: nowrap; font-weight: 600; }
.trig { color: var(--text-2); }
.row-main { flex: 1; min-width: 0; }
.feed-text { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.feed-chips { margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap; }
.feed-chips .chip { cursor: pointer; }
.chip-thread { color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.chip-subject { color: #ff9d5c; background: color-mix(in srgb, #ff9d5c 12%, transparent); }
.feed-item { cursor: pointer; -webkit-user-select: none; user-select: none; }
</style>
