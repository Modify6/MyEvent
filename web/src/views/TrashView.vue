<script setup>
// 回收站:软删记录的查看与恢复(不做物理删除 —— 同步协议无 delete 语义,物理删会在他端复活;
// 软删行保留在本地与云端以防误删,恢复 = deleted 置 0 并盖时间戳正常同步)
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { showConfirmDialog, showSuccessToast } from 'vant';
import { useThoughtStore } from '../stores/thought.js';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useRuleStore } from '../stores/rule.js';
import { putRow } from '../db/repo.js';
import { kindMeta } from '../lib/display.js';

const router = useRouter();
const thoughtStore = useThoughtStore();
const eventStore = useEventStore();
const subjectStore = useSubjectStore();
const predictionStore = usePredictionStore();
const ruleStore = useRuleStore();

// 合并五类软删:恢复动作按类型路由到对应表的 putRow(deleted:0)
const items = computed(() => {
  const list = [];
  const push = (table, row, type, text) => {
    if (row.deleted) list.push({ key: table + ':' + row.id, table, row, type, text, at: row.updatedAt || 0 });
  };
  for (const t of thoughtStore.thoughts) push('thoughts', t, t.kind, t.content);
  for (const en of eventStore.entries) push('eventEntries', en, en.kind === 'summary' ? '小结' : '记录', en.content);
  for (const e of eventStore.events) push('events', e, '线索', e.title);
  for (const s of subjectStore.subjects) push('subjects', s, '对象', s.name);
  for (const p of predictionStore.predictions) push('predictions', p, '预判', p.content);
  for (const r of ruleStore.rules) push('rules', r, '规则', r.content);
  return list.sort((a, b) => b.at - a.at);
});

async function restore(it) {
  try {
    await showConfirmDialog({ title: '恢复这条记录?', message: '它将回到相关页面与时间线。', confirmButtonText: '恢复' });
    await putRow(it.table, { ...it.row, deleted: 0 });
    showSuccessToast('已恢复');
  } catch {}
}

const typeColor = (t) => kindMeta(t)?.color || '#8f9bb3';
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="head-name">
        <van-icon name="arrow-left" size="20" @click="router.back()" />回收站
      </h1>
    </div>

    <div class="hint-line">已删除的记录保留在本地与云端以防误删,可随时恢复;不提供彻底销毁(同步一致性与数据安全优先)。</div>

    <div v-if="items.length" class="card">
      <div v-for="it in items" :key="it.key" class="trash-item">
        <span class="t-kind" :style="{ color: typeColor(it.type), borderColor: typeColor(it.type) + '59' }">{{ it.type }}</span>
        <div class="row-main">
          <div class="t-text">{{ it.text }}</div>
          <div class="muted">删除于 {{ dayjs(it.at).format('M月D日 HH:mm') }}</div>
        </div>
        <van-button size="mini" plain round type="primary" @click="restore(it)">恢复</van-button>
      </div>
    </div>
    <div v-else class="card"><div class="empty-tip">回收站是空的</div></div>
  </div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.hint-line { font-size: 12px; color: var(--text-3); margin: -2px 2px 8px; line-height: 1.6; }
.trash-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.trash-item:last-child { border-bottom: 0; }
.t-kind { flex: none; font-size: 11px; border: 1px solid; border-radius: 4px; padding: 1px 6px; margin-top: 2px; white-space: nowrap; font-weight: 600; }
.row-main { flex: 1; min-width: 0; }
.t-text { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
