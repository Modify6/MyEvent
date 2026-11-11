<script setup>
// 预判页:我做过哪些判断,哪些待验证,我准不准 —— 草稿/进行中/待验证/已验证
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePredictionStore } from '../stores/prediction.js';
import { useSubjectStore } from '../stores/subject.js';
import PredictionComposer from '../components/PredictionComposer.vue';
import StatusTag from '../components/StatusTag.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import { fmtDate } from '../lib/time.js';
import { MAX_ACTIVE_PREDICTIONS } from '../lib/domain.js';

const router = useRouter();
const store = usePredictionStore();
const subjectStore = useSubjectStore();
const tab = ref(0);
const showForm = ref(false);

const groups = computed(() => [
  { items: store.running, empty: '还没有进行中的预判' },
  { items: store.due, empty: '没有到期待验证的预判' },
  { items: store.drafts, empty: '没有草稿' },
  { items: store.verified, empty: '还没有已验证的预判' },
]);
const current = computed(() => groups.value[tab.value]);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>预判</h1>
      <van-button size="small" round type="primary" icon="plus" @click="showForm = true">新预判</van-button>
    </div>

    <div class="hint-line hint-brand">🎯 预判 = 可证伪的判断:锁定后原始判断不可改,到期按提交时定的标准验证 —— 用来校准你的自信,按需使用</div>
    <div class="seg" style="margin-bottom: 12px">
      <button :class="{ active: tab === 0 }" @click="tab = 0">进行中 {{ store.running.length }}</button>
      <button :class="{ active: tab === 1 }" @click="tab = 1">待验证 {{ store.due.length }}</button>
      <button :class="{ active: tab === 2 }" @click="tab = 2">草稿 {{ store.drafts.length }}</button>
      <button :class="{ active: tab === 3 }" @click="tab = 3">已验证 {{ store.verified.length }}</button>
    </div>

    <div class="card" v-if="store.lockedCount >= MAX_ACTIVE_PREDICTIONS - 2" style="text-align: center">
      <div class="muted">进行中 {{ store.lockedCount }}/{{ MAX_ACTIVE_PREDICTIONS }} —— 预判太多会跟踪不过来,先验证一些再新增</div>
    </div>

    <div class="card" v-if="current.items.length">
      <div v-for="p in current.items" :key="p.id" class="pred-line" @click="router.push(`/predictions/${p.id}`)">
        <div class="row-main">
          <div class="pred-text">{{ p.content }}</div>
          <div class="muted">
            {{ subjectStore.nameOf(p.subjectId) }} · {{ p.kind }} · 截止 {{ fmtDate(p.windowEnd) }}
          </div>
        </div>
        <div class="right-col">
          <ConfidenceBar :value="p.origConfidence" style="width: 76px" />
          <StatusTag kind="prediction" :prediction="p" />
        </div>
      </div>
    </div>
    <div v-else class="card"><div class="empty-tip">{{ current.empty }}</div></div>

    <PredictionComposer v-model:show="showForm" @saved="router.push(`/predictions/${$event.id}`)" @locked="router.push(`/predictions/${$event.id}`)" />
  </div>
</template>

<style scoped>
.pred-line { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.pred-line:last-child { border-bottom: 0; }
.row-main { flex: 1; min-width: 0; }
.pred-text { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.right-col { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
</style>
