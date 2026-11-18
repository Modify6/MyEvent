<script setup>
// 记录流首页:3 秒随手记(内容即可),全部记录按时间倒序混排(想法/事实/感想 + 线索过程记录)
// 没有待办、没有必填 —— 重点是过程,持续记录,演化自然沉淀
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showFailToast, showSuccessToast } from 'vant';
import dayjs from 'dayjs';
import { useThoughtStore } from '../stores/thought.js';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { useVocabStore } from '../stores/vocab.js';
import FilterSortOptions from '../components/FilterSortOptions.vue';
import { sortFilterOptions } from '../lib/util.js';
import NoteEditor from '../components/NoteEditor.vue';
import QuickCreate from '../components/QuickCreate.vue';
import AttachGuide from '../components/AttachGuide.vue';
import ConvertToThread from '../components/ConvertToThread.vue';
import SyncDot from '../components/SyncDot.vue';
import VocabQuickCreate from '../components/VocabQuickCreate.vue';
import VocabManage from '../components/VocabManage.vue';
import StatusTag from '../components/StatusTag.vue';
import HandleStatusSheet from '../components/HandleStatusSheet.vue';
import { copyText } from '../lib/clipboard.js';
import { HANDLE_STATUSES, HANDLE_STATUS_META } from '../lib/domain.js';
import { getLastAttach, setLastAttach } from '../auth/local.js';
import { kindChipStyle, trigChipStyle, parseTrigger, avatarColor } from '../lib/display.js';
import { fmtTime } from '../lib/time.js';

const router = useRouter();
const thoughtStore = useThoughtStore();
const eventStore = useEventStore();
const subjectStore = useSubjectStore();
const vocabStore = useVocabStore();

// —— 快捷输入(内联,最快路径:内容 + 发送) ——
const kind = ref('想法');
const triggerKind = ref('');
const detail = ref(false);
const form = reactive({ content: '', triggerNote: '', subjectId: '', eventId: '' });

// 高频手感:一键重挂上次的挂靠组合
const lastAttach = computed(() => getLastAttach());
const lastSubjectName = computed(() => lastAttach.value?.subjectId ? subjectStore.nameOf(lastAttach.value.subjectId) : '');
const lastEventTitle = computed(() => lastAttach.value?.eventId ? eventStore.byId(lastAttach.value.eventId)?.title?.slice(0, 10) : '');
function reattachLast() {
  if (!lastAttach.value) return;
  form.subjectId = lastAttach.value.subjectId || '';
  form.eventId = lastAttach.value.eventId || '';
  if (!detail.value) detail.value = true;
}

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
    if (form.subjectId || form.eventId) setLastAttach({ subjectId: form.subjectId, eventId: form.eventId });
    showSuccessToast('已记录');
    // 连续记录:发送后焦点回到输入框
    nextTick(() => document.querySelector('.quick-input textarea')?.focus());
  } catch (e) {
    showFailToast(e.message);
  }
}

// —— 筛选条:类型 / 对象 / 线索 / 处理状态(与搜索互补,流内快速聚焦) ——
const fType = ref('');
const fSubject = ref('');
const fThread = ref('');
const fHandle = ref('');
const typeItemRef = ref(null);
const subjectItemRef = ref(null);
const threadItemRef = ref(null);
// 筛选选项排序:默认按频次(命中条数降序),localStorage 记忆
const FS_KEY = 'myevent.filterSort';
const filterSort = ref(localStorage.getItem(FS_KEY) || 'freq');
function setFilterSort(m) {
  filterSort.value = m;
  localStorage.setItem(FS_KEY, m);
}
// 筛选选项带命中计数(按全量统计),排序由 FilterSortOptions 按 filterSort 处理(默认频次)
const cnt = (fn) => allItems.value.filter(fn).length;
const typeOptions = computed(() => [
  { text: '全部类型', value: '', count: allItems.value.length },
  ...vocabStore.kinds.map((k) => ({ text: k, value: k, count: cnt((it) => it.kind === k) })),
  { text: '记录', value: '记录', count: cnt((it) => it.kind === '记录') },
  { text: '小结', value: '小结', count: cnt((it) => it.kind === '小结') },
]);
const subjectOptions = computed(() => [
  { text: '全部对象', value: '', count: allItems.value.length },
  ...subjectStore.active.map((s) => ({ text: s.name, value: s.id, count: cnt((it) => it.subjectId === s.id) })),
]);
const threadOptions = computed(() => [
  { text: '全部线索', value: '', count: allItems.value.length },
  ...eventStore.threads.map((e) => ({ text: e.title.slice(0, 12), value: e.id, count: cnt((it) => it.eventId === e.id) })),
]);
// 下拉标题显示当前选中项
const typeTitle = computed(() => (fType.value ? String(fType.value) : '类型'));
const subjectTitle = computed(() => (fSubject.value ? '@ ' + subjectStore.nameOf(fSubject.value) : '对象'));
const threadTitle = computed(() => (fThread.value ? '# ' + eventTitle(fThread.value).slice(0, 10) : '线索'));
const handleOptions = computed(() => [
  { text: '处理状态', value: '' },
  ...HANDLE_STATUSES.map((s) => ({ text: HANDLE_STATUS_META[s].label, value: s })),
]);
watch([fType, fSubject, fThread, fHandle], () => { limit.value = PAGE_SIZE; });

// —— 统一记录时间线:thoughts(独立/挂对象/挂线索的随手记) + eventEntries(线索过程记录) ——
const allItems = computed(() => {
  const items = [];
  for (const t of thoughtStore.active) {
    items.push({
      key: 't:' + t.id, type: 't', raw: t, kind: t.kind, content: t.content, at: t.at,
      trigger: t.source || '', summary: false, edited: (t.edits || []).length > 0,
      subjectId: t.subjectId || '', eventId: t.relatedEventId || '',
      handleStatus: t.handleStatus || 'pending', handleNote: t.handleNote || '',
    });
  }
  for (const en of eventStore.entries) {
    if (en.deleted) continue;
    items.push({
      key: 'e:' + en.id, type: 'e', raw: en, kind: en.kind === 'summary' ? '小结' : '记录', content: en.content, at: en.at,
      trigger: en.triggerKind ? `由${en.triggerKind}触发${en.triggerNote ? ':' + en.triggerNote : ''}` : (en.triggerNote || ''),
      summary: en.kind === 'summary', edited: (en.edits || []).length > 0,
      subjectId: (eventStore.byId(en.eventId)?.subjectIds || [])[0] || '', eventId: en.eventId,
      handleStatus: en.handleStatus || 'pending', handleNote: en.handleNote || '',
    });
  }
  return items.sort((a, b) => b.at - a.at);
});
const feed = computed(() => {
  let arr = allItems.value;
  if (fType.value) arr = arr.filter((it) => it.kind === fType.value);
  if (fSubject.value) arr = arr.filter((it) => it.subjectId === fSubject.value);
  if (fThread.value) arr = arr.filter((it) => it.eventId === fThread.value);
  if (fHandle.value) arr = arr.filter((it) => it.handleStatus === fHandle.value);
  return arr;
});

// 分页渲染:默认最近 50 条,底部「加载更多」继续(几千条时手机不卡)
const PAGE_SIZE = 50;
const limit = ref(PAGE_SIZE);
const rendered = computed(() => feed.value.slice(0, limit.value));
const hasMore = computed(() => feed.value.length > limit.value);
const loadMore = () => { limit.value += PAGE_SIZE; };

// 按天分组:今天 / 昨天 / M月D日(仅对已渲染部分)
const groups = computed(() => {
  const map = new Map();
  for (const it of rendered.value) {
    const d = dayjs(it.at);
    const label = d.isSame(dayjs(), 'day') ? '今天' : d.isSame(dayjs().subtract(1, 'day'), 'day') ? '昨天' : d.format('M月D日');
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(it);
  }
  return [...map.entries()];
});

// 挂靠联动:选了对象,线索 chips 收窄为该对象下的线索(当前已选的线索不在其中也保留显示)
const attachThreads = computed(() => {
  let list;
  if (form.subjectId) {
    list = eventStore.threads.filter((e) => (e.subjectIds || []).includes(form.subjectId)).slice(0, 12);
    if (form.eventId && !list.some((e) => e.id === form.eventId)) {
      const cur = eventStore.byId(form.eventId);
      if (cur) list = [...list, cur];
    }
  } else {
    list = eventStore.threads.slice(0, 6);
  }
  return list;
});
const attachSubjectName = computed(() => subjectStore.nameOf(form.subjectId));

const subjectName = (id) => subjectStore.nameOf(id);
const eventTitle = (id) => eventStore.byId(id)?.title || '线索';
// 一键复制这条记录的原文
const copyRow = (it) => copyText(it.content);

// 行侧边操作菜单:带文字说明(解决裸按钮提示弱的问题),单按钮不占行宽
const popoverKey = ref('');
const popoverPlace = ref('top-end');
// 位置智能选边:按钮在屏幕下半 → 菜单朝上(右对齐),上半 → 朝下,避免盖住正文
function setPopoverPlace(e) {
  const r = e.currentTarget.getBoundingClientRect();
  popoverPlace.value = r.top > window.innerHeight / 2 ? 'top-end' : 'bottom-end';
}
// 行侧边菜单数据:彩色图标块 + 主标题 + 副标题(对象色随其专属色)
const rowActions = (it) => {
  const a = [];
  if (it.eventId) a.push({ key: 'event', icon: 'notes-o', color: '#4f6ef7', title: '进入线索', sub: eventTitle(it.eventId) });
  a.push({ key: 'handle', icon: 'todo-list-o', color: '#f5a623', title: '标记处理', sub: '状态与结果说明' });
  if (it.subjectId) {
    const c = avatarColor(it.subjectId);
    a.push({ key: 'subject', icon: 'contact', color: c, title: '进入对象', sub: subjectName(it.subjectId) });
  }
  if (a.length) a.push({ key: 'sep' });
  a.push({ key: 'copy', icon: 'records', color: '#8f9bb3', title: '复制这条' });
  return a;
};
function onRowAction(a, it) {
  if (a.key === 'event') router.push(`/events/${it.eventId}`);
  else if (a.key === 'subject') router.push(`/subjects/${it.subjectId}`);
  else if (a.key === 'handle') openHandle(it);
  else if (a.key === 'copy') copyRow(it);
}
// 视觉映射:类型色标签 / 触发源图标
const kindStyle = (k) => {
  const m = vocabStore.kindMetaOf(k);
  return { color: m.color, borderColor: m.color + '59', background: m.color + '1f' };
};
const kindIcon = (k) => vocabStore.kindMetaOf(k).icon;
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
function onItemClick(e, it) {
  if (pressFired) {
    pressFired = false;
    return; // 长按已处理,吞掉紧随的 click
  }
  // 行侧边「更多操作」触发器的点击归 popover 管,不进编辑
  if (e?.target?.closest?.('.van-popover__wrapper')) return;
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
// 自定义类型/触发源:就地新建 + 管理
const showKindCreate = ref(false);
const showTriggerCreate = ref(false);
const showVocabManage = ref(false);
const vocabManageScope = ref('kind');
// 一键转线索:想法长成事件时,长按菜单直达(建线索+原记录改挂)
const showConvert = ref(false);
function startConvert() {
  showConvert.value = true;
}
// 操作菜单按记录类型动态生成:想法多「转为线索」;全部记录都可「标记处理」
const sheetActions = computed(() => {
  const a = [{ name: '编辑', key: 'edit' }];
  if (editItem.value?.type === 't') a.splice(1, 0, { name: '转为线索', key: 'convert' });
  a.splice(editItem.value?.type === 't' ? 2 : 1, 0, { name: '标记处理', key: 'handle' });
  a.push({ name: '删除', key: 'remove', color: 'var(--danger)' });
  return a;
});
function onSheetSelect(a) {
  if (!editItem.value) return;
  if (a.key === 'edit') openEdit(editItem.value);
  else if (a.key === 'convert') startConvert();
  else if (a.key === 'handle') openHandle(editItem.value);
  else if (a.key === 'remove') removeItem(editItem.value);
}

// 标记处理:点状态 tag 或长按菜单,打开共用弹层(thought 与 entry 都可标)
const showHandle = ref(false);
const handleItem = ref(null);
const handleType = computed(() => (handleItem.value?.type === 'e' ? 'entry' : 'thought'));
function openHandle(it) {
  handleItem.value = it;
  showHandle.value = true;
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
    <div class="hint-line seg-explain">
      <span class="se-item"><b>点击</b> 修改</span>
      <span class="se-item"><b>长按</b> 编辑/删除</span>
      <span class="se-item"><b>#</b> 线索、<b>@</b> 对象标签可点跳转</span>
    </div>
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
        <div v-if="lastAttach" class="block-label row-between">
          <span>上次挂靠</span>
          <span class="reattach" @click="reattachLast">⟲ 重挂{{ lastSubjectName ? ' @' + lastSubjectName : '' }}{{ lastEventTitle ? ' #' + lastEventTitle : '' }}</span>
        </div>
        <div class="block-label row-between"><span>🏷 类型 · 这是一条什么性质的记录</span><span class="manage-link" @click="vocabManageScope = 'kind'; showVocabManage = true">管理</span></div>
        <div class="chip-row">
          <button v-for="k in vocabStore.kinds" :key="k" class="tag-chip" :class="{ active: kind === k }" :style="kindChipStyle(k, kind === k)" @click="kind = k">{{ vocabStore.kindMetaOf(k).icon }} {{ k }}</button>
          <button class="tag-chip add-chip" @click="showKindCreate = true">+ 自定义</button>
        </div>
        <div class="block-label row-between"><span>📌 触发源 · 由什么引发</span><span class="manage-link" @click="vocabManageScope = 'trigger'; showVocabManage = true">管理</span></div>
        <div class="chip-row">
          <button v-for="k in vocabStore.triggers" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" :style="trigChipStyle(k, triggerKind === k)" @click="triggerKind = triggerKind === k ? '' : k">{{ vocabStore.triggerIconOf(k) }} {{ k }}</button>
          <button class="tag-chip add-chip" @click="showTriggerCreate = true">+ 自定义</button>
        </div>
        <van-field v-model="form.triggerNote" type="textarea" rows="1" autosize placeholder="触发说明(选填)" />
        <div class="block-label row-between">
          <span>挂到线索 · 哪件事(选填)<template v-if="form.subjectId"><span class="muted"> · @{{ attachSubjectName }} 下的线索</span></template></span>
          <span class="guide-link" @click="showGuide = true">怎么选?</span>
        </div>
        <div class="chip-row">
          <button v-for="e in attachThreads" :key="e.id" class="tag-chip" :class="{ active: form.eventId === e.id }" @click="form.eventId = form.eventId === e.id ? '' : e.id">{{ e.title.slice(0, 10) }}</button>
          <button class="tag-chip add-chip" @click="quickCreate('event')">+ 新建</button>
        </div>
        <div v-if="form.subjectId && !attachThreads.length" class="muted" style="padding: 2px 4px">该主题下还没有线索 —— 可不挂,或点「+ 新建」建一条</div>
        <div class="block-label">挂到对象 · 关于谁(选填)</div>
        <div class="chip-row">
          <button v-for="s in subjectStore.active" :key="s.id" class="tag-chip" :class="{ active: form.subjectId === s.id }" @click="form.subjectId = form.subjectId === s.id ? '' : s.id">{{ s.name }}</button>
          <button class="tag-chip add-chip" @click="quickCreate('subject')">+ 新建</button>
        </div>
      </template>
    </div>

    <van-dropdown-menu v-if="feed.length || fType || fSubject || fThread || fHandle">
      <van-dropdown-item ref="typeItemRef" :title="typeTitle">
        <FilterSortOptions v-model="fType" :sort="filterSort" @update:sort="setFilterSort" :options="typeOptions" @close="typeItemRef?.toggle(false)" />
      </van-dropdown-item>
      <van-dropdown-item ref="subjectItemRef" :title="subjectTitle">
        <FilterSortOptions v-model="fSubject" :sort="filterSort" @update:sort="setFilterSort" :options="subjectOptions" @close="subjectItemRef?.toggle(false)" />
      </van-dropdown-item>
      <van-dropdown-item ref="threadItemRef" :title="threadTitle">
        <FilterSortOptions v-model="fThread" :sort="filterSort" @update:sort="setFilterSort" :options="threadOptions" @close="threadItemRef?.toggle(false)" />
      </van-dropdown-item>
      <van-dropdown-item v-model="fHandle" :options="handleOptions" title="处理" />
    </van-dropdown-menu>

    <!-- 记录流 -->
    <template v-for="[label, list] in groups" :key="label">
      <div class="section-title">{{ label }} · {{ list.length }}</div>
      <div class="card">
        <div v-for="it in list" :key="it.key">
          <div
            class="feed-item"
            :class="{ summary: it.summary, handled: it.handleStatus === 'done', issue: it.handleStatus === 'issue' }"
            @click="onItemClick($event, it)"
            @touchstart.passive="startPress(it)"
            @touchmove.passive="cancelPress"
            @touchend="cancelPress"
            @contextmenu.prevent
          >
            <div class="feed-kind" :style="kindStyle(it.kind)">{{ kindIcon(it.kind) }} {{ it.kind }}</div>
            <div class="row-main">
              <div class="feed-text">{{ it.content }}</div>
              <div v-if="it.handleStatus !== 'pending' && it.handleNote" class="handle-note">{{ HANDLE_STATUS_META[it.handleStatus].label }}:{{ it.handleNote }}</div>
              <div class="muted">
                {{ fmtTime(it.at) }}
                <template v-if="it.edited"> · ✎ 已编辑</template>
                <template v-if="trig(it.trigger)"> · <span class="trig">{{ trig(it.trigger).icon }} {{ trig(it.trigger).text }}</span></template>
              </div>
              <div class="feed-chips">
                <span v-if="it.eventId" class="chip chip-thread" @click.stop="router.push(`/events/${it.eventId}`)"># {{ eventTitle(it.eventId) }}</span>
                <span v-if="it.subjectId" class="chip chip-subject" @click.stop="router.push(`/subjects/${it.subjectId}`)">@ {{ subjectName(it.subjectId) }}</span>
                <span class="handle-tag" title="标记处理" @click.stop="openHandle(it)">
                  <StatusTag kind="handle" :status="it.handleStatus" />
                </span>
              </div>
            </div>
            <!-- 行侧边操作:单按钮弹出菜单(带文字说明,不占行宽) -->
            <van-popover
              :show="popoverKey === it.key"
              :placement="popoverPlace"
              @update:show="(v) => (popoverKey = v ? it.key : '')"
            >
              <template #reference>
                <van-icon name="ellipsis" class="row-more" title="更多操作" @click="setPopoverPlace($event)" />
              </template>
              <div class="row-menu">
                <template v-for="a in rowActions(it)" :key="a.key">
                  <div v-if="a.key === 'sep'" class="row-menu-sep" />
                  <div v-else class="row-menu-item" @click.stop="onRowAction(a, it)">
                    <span class="row-menu-ic" :style="{ background: a.color + '1f', color: a.color }"><van-icon :name="a.icon" /></span>
                    <span class="row-menu-txt">
                      <b>{{ a.title }}</b>
                      <i v-if="a.sub">{{ a.sub }}</i>
                    </span>
                  </div>
                </template>
              </div>
            </van-popover>
          </div>
        </div>
      </div>
    </template>
    <div v-if="!feed.length" class="card">
      <div class="empty-tip">还没有记录 —— 上面输入框里写一句,3 秒记下第一笔</div>
    </div>
    <div v-if="hasMore" class="row-center" style="margin: 4px 0 8px">
      <van-button plain round size="small" @click="loadMore">还有 {{ feed.length - limit }} 条 · 加载更多</van-button>
    </div>

    <NoteEditor v-model:show="showEditor" :thought="editItem?.type === 't' ? editItem.raw : null" :entry="editItem?.type === 'e' ? editItem.raw : null" @saved="editItem = null" />

    <QuickCreate v-model:show="showQuickCreate" :type="quickCreateType" @created="onQuickCreated" />
    <AttachGuide v-model:show="showGuide" />
    <VocabQuickCreate v-model:show="showKindCreate" type="kind" @created="(row) => (kind = row.name)" />
    <VocabQuickCreate v-model:show="showTriggerCreate" type="trigger" @created="(row) => (triggerKind = row.name)" />
    <VocabManage v-model:show="showVocabManage" :scope="vocabManageScope" />
    <HandleStatusSheet v-model:show="showHandle" :type="handleType" :target="handleItem?.raw || null" @saved="handleItem = null" />

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
.row-center { display: flex; justify-content: center; }
.hint-line { font-size: 12px; color: var(--text-3); margin: -2px 2px 8px; }
.quick { padding-bottom: 10px; }
.quick-input :deep(.van-field__control) { font-size: 15px; }
.quick-foot { display: flex; justify-content: space-between; padding: 4px 2px 0; }
.block-label { font-size: 12px; color: var(--text-3); margin: 10px 2px 6px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.manage-link { color: var(--brand); cursor: pointer; font-size: 12px; }
.tag-chip.add-chip { border-style: dashed; color: var(--text-3); }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.add-chip { border-style: dashed; color: var(--text-3); }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.reattach { color: var(--brand); cursor: pointer; }
.guide-link { color: var(--brand); cursor: pointer; font-size: 12px; }
.feed-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.feed-item:last-child { border-bottom: 0; }
.feed-item.summary { background: color-mix(in srgb, var(--brand) 5%, transparent); border-left: 3px solid var(--brand); border-radius: 8px; padding: 10px 8px; margin: 4px 0; border-bottom: 0; }
.feed-kind { flex: none; font-size: 11px; border: 1px solid; border-radius: 4px; padding: 1px 6px; height: fit-content; margin-top: 2px; white-space: nowrap; font-weight: 600; }
.trig { color: var(--text-2); }
.row-main { flex: 1; min-width: 0; }
.row-more { color: var(--text-3); font-size: 16px; margin-top: 4px; flex: none; cursor: pointer; padding: 0 4px; }
.feed-text { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.feed-item.handled .feed-text { color: var(--text-3); }
.feed-item.issue .feed-text { color: var(--text-2); }
.handle-note { font-size: 12px; margin-top: 3px; color: var(--text-2); background: var(--card-2); border-radius: 6px; padding: 4px 8px; white-space: pre-wrap; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.feed-item.issue .handle-note { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.handle-tag { cursor: pointer; display: inline-flex; }
.feed-chips { margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap; }
.feed-chips .chip { cursor: pointer; }
.chip-thread { color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.chip-subject { color: #ff9d5c; background: color-mix(in srgb, #ff9d5c 12%, transparent); }
.feed-item { cursor: pointer; -webkit-user-select: none; user-select: none; }
</style>

<style>
/* 行侧边弹出菜单(popover 内容挂 body,须用全局样式) */
.row-menu { min-width: 178px; padding: 6px; }
.row-menu-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; cursor: pointer; }
.row-menu-item:active { background: color-mix(in srgb, var(--text) 7%, transparent); }
.row-menu-ic { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex: none; }
.row-menu-txt { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.row-menu-txt b { font-size: 13.5px; font-weight: 600; color: var(--text); }
.row-menu-txt i { font-style: normal; font-size: 11.5px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 158px; }
.row-menu-sep { height: 1px; background: var(--line); margin: 4px 6px; }
.row-more { border-radius: 8px; transition: background 0.15s, color 0.15s; }
.row-more:active { background: color-mix(in srgb, var(--text) 10%, transparent); color: var(--brand); }
</style>
