<script setup>
// 经验库:「如果 X,则 Y」规则卡片 + 搜索 + 有效性登记
import { computed, ref } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import { useRuleStore } from '../stores/rule.js';
import RuleComposer from '../components/RuleComposer.vue';
import StatusTag from '../components/StatusTag.vue';
import { fmtDate } from '../lib/time.js';

const store = useRuleStore();
const q = ref('');
const showForm = ref(false);

const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase();
  if (!kw) return store.active;
  return store.active.filter((r) => [r.content, r.scene, r.trigger, r.reason].some((s) => String(s || '').toLowerCase().includes(kw)));
});

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待验证' },
  { key: 'valid', label: '有效' },
  { key: 'invalid', label: '无效' },
];
const filter = ref('all');

const list = computed(() => (filter.value === 'all' ? filtered.value : filtered.value.filter((r) => r.validity === filter.value)));

async function mark(r, valid) {
  try {
    await showConfirmDialog({
      title: `标记为${valid ? '有效' : '无效'}?`,
      message: `这次使用中,规则「${r.content.slice(0, 24)}…」${valid ? '帮到了你' : '没有适用'}?`,
      confirmButtonText: '确认',
    });
    await store.bumpVerify(r.id, valid);
    showToast(`已标记为${valid ? '有效' : '无效'}`);
  } catch {}
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>经验库</h1>
      <van-button size="small" round type="primary" icon="plus" @click="showForm = true">新规则</van-button>
    </div>

    <van-search v-model="q" placeholder="搜场景 / 信号 / 规则内容" shape="round" background="transparent" />

    <div class="seg" style="margin-bottom: 12px">
      <button v-for="t in tabs" :key="t.key" :class="{ active: filter === t.key }" @click="filter = t.key">{{ t.label }}</button>
    </div>

    <template v-if="list.length">
      <div v-for="r in list" :key="r.id" class="card rule-card">
        <div class="rule-head">
          <van-tag v-if="r.scene" plain round size="medium" type="primary">{{ r.scene }}</van-tag>
          <StatusTag kind="rule" :status="r.validity === 'pending' ? 'pending_rule' : r.validity" />
        </div>
        <div class="rule-content">{{ r.content }}</div>
        <div v-if="r.trigger" class="muted">触发信号:{{ r.trigger }}</div>
        <div v-if="r.reason" class="muted">原因:{{ r.reason }}</div>
        <div v-if="r.counterEx" class="muted bad">反例:{{ r.counterEx }}</div>
        <div class="rule-foot">
          <span class="muted">验证 {{ r.verifyCount || 0 }} 次{{ r.lastVerifiedAt ? ' · 最近 ' + fmtDate(r.lastVerifiedAt) : '' }}</span>
          <span class="foot-btns">
            <van-button size="mini" plain round type="success" @click="mark(r, true)">这次有效</van-button>
            <van-button size="mini" plain round type="danger" @click="mark(r, false)">这次无效</van-button>
          </span>
        </div>
      </div>
    </template>
    <div v-else class="card"><div class="empty-tip">{{ store.active.length ? '没有匹配的规则' : '经验库还是空的 —— 完成一次事件复盘,沉淀第一条「如果 X,则 Y」' }}</div></div>

    <RuleComposer v-model:show="showForm" />
  </div>
</template>

<style scoped>
.rule-card { padding: 14px; }
.rule-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.rule-content { font-size: 15px; font-weight: 700; line-height: 1.6; }
.rule-card .muted { margin-top: 4px; font-size: 12px; }
.rule-card .muted.bad { color: var(--danger); }
.rule-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.foot-btns { display: flex; gap: 8px; }
</style>
