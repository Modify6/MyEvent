<script setup>
// 收件箱(首页):有什么需要整理和复盘 —— 快捷捕获 + 待复盘事件 + 想法收件箱 + 待验证预判
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useSubjectStore } from '../stores/subject.js';
import EventComposer from '../components/EventComposer.vue';
import ThoughtComposer from '../components/ThoughtComposer.vue';
import ReviewForm from '../components/ReviewForm.vue';
import PredictionComposer from '../components/PredictionComposer.vue';
import StatusTag from '../components/StatusTag.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import { fmtDate } from '../lib/time.js';

const router = useRouter();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const subjectStore = useSubjectStore();

const showEvent = ref(false);
const showThought = ref(false);
const showReview = ref(false);
const showPred = ref(false);
const reviewEventId = ref('');
const editThought = ref(null);
const predDraft = ref(null);

function openReview(id) {
  reviewEventId.value = id;
  showReview.value = true;
}
function openThought(t) {
  editThought.value = t;
  showThought.value = true;
}
function openNewThought() {
  editThought.value = null;
  showThought.value = true;
}
function openPrediction(draft) {
  predDraft.value = draft;
  showPred.value = true;
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>收件箱</h1>
      <div class="head-icons">
        <van-icon name="search" size="20" @click="router.push('/search')" />
        <van-icon name="setting-o" size="20" @click="router.push('/settings')" />
      </div>
    </div>

    <div class="card quick-card">
      <div class="muted" style="margin-bottom: 10px">先快速捕获,再结构化整理</div>
      <div class="quick-row">
        <van-button type="primary" round icon="edit" @click="showEvent = true">记事件</van-button>
        <van-button type="primary" plain round icon="chat-o" @click="openNewThought">记想法</van-button>
      </div>
    </div>

    <!-- 待复盘事件 -->
    <template v-if="eventStore.inbox.length">
      <div class="section-title">待复盘事件 · {{ eventStore.inbox.length }}</div>
      <div class="card">
        <div v-for="e in eventStore.inbox.slice(0, 8)" :key="e.id" class="row-line" @click="openReview(e.id)">
          <div class="row-main">
            <div class="row-title">{{ e.title }}</div>
            <div class="muted">{{ fmtDate(e.startAt) }} · {{ e.subjectIds?.length ? e.subjectIds.map(subjectStore.nameOf).join('/') + ' · ' : '' }}{{ e.status === 'pending' ? '复盘进行中' : '待复盘' }}</div>
          </div>
          <StatusTag kind="event" :status="e.status" />
        </div>
      </div>
    </template>

    <!-- 想法收件箱 -->
    <template v-if="thoughtStore.inbox.length">
      <div class="section-title">想法收件箱 · {{ thoughtStore.inbox.length }}</div>
      <div class="card">
        <div v-for="t in thoughtStore.inbox.slice(0, 8)" :key="t.id" class="row-line" @click="openThought(t)">
          <div class="row-main">
            <div class="row-title thought">{{ t.content }}</div>
            <div class="muted">{{ fmtDate(t.at) }} · {{ t.kind }}<template v-if="t.confidence != null"> · {{ t.confidence }}%</template></div>
          </div>
          <van-tag plain round size="medium" type="primary">{{ t.subjectId ? '待整理' : '未归类' }}</van-tag>
        </div>
      </div>
    </template>

    <!-- 待验证预判 -->
    <template v-if="predictionStore.due.length">
      <div class="section-title">待验证预判 · {{ predictionStore.due.length }}</div>
      <div class="card">
        <div v-for="p in predictionStore.due.slice(0, 8)" :key="p.id" class="row-line" @click="router.push(`/predictions/${p.id}`)">
          <div class="row-main">
            <div class="row-title thought">{{ p.content }}</div>
            <div class="muted">{{ subjectStore.nameOf(p.subjectId) }} · 截止 {{ fmtDate(p.windowEnd) }}</div>
          </div>
          <ConfidenceBar :value="p.origConfidence" style="width: 84px" />
        </div>
      </div>
    </template>

    <div v-if="!eventStore.inbox.length && !thoughtStore.inbox.length && !predictionStore.due.length" class="card">
      <div class="empty-tip">收件箱清空了 —— 记一件事、一个想法,或看看全部事件</div>
      <van-button plain round block size="small" type="primary" @click="router.push('/events')">查看全部事件 ›</van-button>
    </div>
    <div v-else class="row-center" style="margin: 4px 0 8px">
      <van-button plain round size="small" @click="router.push('/events')">查看全部事件 ›</van-button>
    </div>

    <EventComposer v-model:show="showEvent" />
    <ThoughtComposer v-model:show="showThought" :thought="editThought" @to-prediction="openPrediction" />
    <ReviewForm v-model:show="showReview" :event-id="reviewEventId" />
    <PredictionComposer v-model:show="showPred" :draft="predDraft" @saved="router.push(`/predictions/${$event.id}`)" @locked="router.push(`/predictions/${$event.id}`)" />
  </div>
</template>

<style scoped>
.head-icons { display: flex; gap: 16px; color: var(--text-2); cursor: pointer; }
.quick-card { text-align: center; }
.quick-row { display: flex; gap: 12px; justify-content: center; }
.quick-row .van-button { flex: 1; }
.row-line { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.row-line:last-child { border-bottom: 0; }
.row-main { flex: 1; min-width: 0; }
.row-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-title.thought { font-weight: 500; }
.row-center { display: flex; justify-content: center; }
</style>
