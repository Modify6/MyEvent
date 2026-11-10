<script setup>
// 对象中枢页:顶部当前观点快照 + 中部三线时间线(事实/想法/预判)+ 底部规则与假设
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { useSubjectStore } from '../stores/subject.js';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useRuleStore } from '../stores/rule.js';
import EventComposer from '../components/EventComposer.vue';
import ThoughtComposer from '../components/ThoughtComposer.vue';
import PredictionComposer from '../components/PredictionComposer.vue';
import ReviewForm from '../components/ReviewForm.vue';
import SubjectForm from '../components/SubjectForm.vue';
import StatusTag from '../components/StatusTag.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import { fmtDate } from '../lib/time.js';
import { PREDICTION_VERIFIED } from '../lib/domain.js';

const route = useRoute();
const router = useRouter();
const subjectStore = useSubjectStore();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const ruleStore = useRuleStore();

const sid = computed(() => route.params.id);
const subject = computed(() => subjectStore.byId(sid.value));

const subjectEvents = computed(() => eventStore.active.filter((e) => (e.subjectIds || []).includes(sid.value)));
const subjectPredictions = computed(() => predictionStore.ofSubject(sid.value));
// 三线时间线:事实线 + 想法线 + 预判线,按时间倒序
const timeline = computed(() => {
  const items = [];
  for (const e of subjectEvents.value) items.push({ kind: 'event', at: e.startAt, data: e });
  for (const t of thoughtStore.ofSubject(sid.value)) items.push({ kind: 'thought', at: t.at, data: t });
  for (const p of subjectPredictions.value) items.push({ kind: 'prediction', at: p.madeAt, data: p });
  return items.sort((a, b) => b.at - a.at);
});

const hypotheses = computed(() => thoughtStore.ofSubject(sid.value).filter((t) => t.kind === '假设'));
const relatedRules = computed(() =>
  ruleStore.ofSubjectIds(
    subjectEvents.value.map((e) => e.id),
    subjectPredictions.value.map((p) => p.id)
  )
);
// 预判命中率:hit + 0.5×partial / 有结果数
const hitStat = computed(() => {
  const done = subjectPredictions.value.filter((p) => PREDICTION_VERIFIED.includes(p.status));
  const score = done.reduce((s, p) => s + (p.status === 'hit' ? 1 : p.status === 'partial' ? 0.5 : 0), 0);
  return { total: subjectPredictions.value.length, done: done.length, rate: done.length ? Math.round((score / done.length) * 100) : null };
});

const nextReviewIn = computed(() => {
  const t = subject.value?.nextReviewAt;
  if (!t) return '';
  const days = Math.ceil((t - Date.now()) / 86_400_000);
  return days > 0 ? `${days} 天后回顾` : '已到回顾时间';
});

const showEvent = ref(false);
const showThought = ref(false);
const showPred = ref(false);
const showForm = ref(false);
const editThought = ref(null);
const reviewEventId = ref('');
const showReview = ref(false);

function openTimelineThought(t) {
  editThought.value = t;
  showThought.value = true;
}
function openNewThought() {
  editThought.value = null;
  showThought.value = true;
}
function openTimelineEvent(e) {
  reviewEventId.value = e.id;
  showReview.value = true;
}
</script>

<template>
  <div class="page" v-if="subject">
    <div class="page-head">
      <h1 class="head-name">
        <van-icon name="arrow-left" size="20" @click="router.back()" />{{ subject.name }}
      </h1>
      <van-button size="small" plain round @click="showForm = true">编辑</van-button>
    </div>

    <!-- 当前观点快照 -->
    <div class="card">
      <div class="row-between">
        <span class="card-title">当前观点</span>
        <van-tag plain round size="medium">{{ subject.type }}</van-tag>
      </div>
      <template v-if="subject.currentView">
        <div class="view-text">{{ subject.currentView }}</div>
        <ConfidenceBar :value="subject.currentConfidence" size="lg" style="margin-top: 10px" />
        <template v-if="subject.topReasons?.length">
          <div class="block-label">核心理由</div>
          <ul class="reason-list">
            <li v-for="(r, i) in subject.topReasons" :key="i">{{ r }}</li>
          </ul>
        </template>
        <template v-if="subject.biggestRisk">
          <div class="block-label">最大反证 / 风险</div>
          <div class="muted">{{ subject.biggestRisk }}</div>
        </template>
        <template v-if="subject.openQuestions">
          <div class="block-label">开放问题</div>
          <div class="muted">{{ subject.openQuestions }}</div>
        </template>
        <div v-if="nextReviewIn" class="muted" style="margin-top: 8px">📅 {{ nextReviewIn }}({{ dayjs(subject.nextReviewAt).format('M月D日') }})</div>
      </template>
      <template v-else>
        <div class="empty-tip" style="padding: 10px 0">还没有形成当前观点 —— 记下你此刻的判断、置信度和最大反证</div>
        <van-button size="small" round type="primary" plain block @click="showForm = true">填写观点快照</van-button>
      </template>
    </div>

    <!-- 快捷操作 -->
    <div class="card quick-row">
      <van-button size="small" plain round type="primary" icon="edit" @click="showEvent = true">记事件</van-button>
      <van-button size="small" plain round type="primary" icon="chat-o" @click="openNewThought">记想法</van-button>
      <van-button size="small" plain round type="primary" icon="aim" @click="showPred = true">做预判</van-button>
    </div>

    <!-- 三线时间线 -->
    <div class="section-title">时间线 · 事实 / 想法 / 预判</div>
    <div class="card">
      <template v-if="timeline.length">
        <div v-for="it in timeline.slice(0, 30)" :key="it.kind + it.data.id" class="tl-line" @click="it.kind === 'event' ? openTimelineEvent(it.data) : it.kind === 'prediction' ? router.push(`/predictions/${it.data.id}`) : openTimelineThought(it.data)">
          <span class="tl-kind" :class="it.kind">{{ it.kind === 'event' ? '事' : it.kind === 'thought' ? '想' : '判' }}</span>
          <div class="row-main">
            <div class="tl-text">{{ it.kind === 'event' ? it.data.title : it.data.content }}</div>
            <div class="muted">
              {{ fmtDate(it.at) }}
              <template v-if="it.kind === 'event'">· {{ it.data.status === 'reviewed' ? '已复盘' : '待复盘' }}</template>
              <template v-if="it.kind === 'thought'">· {{ it.data.kind }}<template v-if="it.data.confidence != null"> · {{ it.data.confidence }}%</template></template>
              <template v-if="it.kind === 'prediction'">· {{ it.data.origConfidence }}%</template>
            </div>
          </div>
          <StatusTag v-if="it.kind !== 'thought'" :kind="it.kind" :status="it.data.status" :prediction="it.kind === 'prediction' ? it.data : null" />
        </div>
      </template>
      <div v-else class="empty-tip">这个对象还没有记录 —— 用上面的按钮记第一笔</div>
    </div>

    <!-- 底部:命中 / 假设 / 规则 -->
    <div class="card">
      <div class="row-between">
        <span class="card-title">预判命中</span>
        <span class="muted">{{ hitStat.done }}/{{ hitStat.total }} 已验证</span>
      </div>
      <div v-if="hitStat.rate != null" class="big-stat">
        {{ hitStat.rate }}<small>%</small>
        <span class="muted" style="font-size: 12px; margin-left: 6px">命中得分(hit + 0.5×partial)</span>
      </div>
      <div v-else class="muted">暂无已验证预判</div>
    </div>

    <template v-if="hypotheses.length">
      <div class="section-title">未验证假设</div>
      <div class="card">
        <div v-for="h in hypotheses" :key="h.id" class="row-line" @click="openTimelineThought(h)">
          <div class="row-main">
            <div class="tl-text">{{ h.content }}</div>
            <div class="muted">{{ fmtDate(h.at) }}<template v-if="h.confidence != null"> · {{ h.confidence }}%</template></div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="relatedRules.length">
      <div class="section-title">关联经验规则</div>
      <div class="card">
        <div v-for="r in relatedRules" :key="r.id" class="row-line" @click="router.push('/rules')">
          <div class="row-main">
            <div class="rule-text">{{ r.content }}</div>
            <div class="muted">{{ r.scene || '通用' }}</div>
          </div>
          <StatusTag kind="rule" :status="r.validity === 'pending' ? 'pending_rule' : r.validity" />
        </div>
      </div>
    </template>

    <EventComposer v-model:show="showEvent" :subject-id="sid" />
    <ThoughtComposer v-model:show="showThought" :thought="editThought" :subject-id="sid" />
    <PredictionComposer v-model:show="showPred" :subject-id="sid" @saved="router.push(`/predictions/${$event.id}`)" @locked="router.push(`/predictions/${$event.id}`)" />
    <ReviewForm v-model:show="showReview" :event-id="reviewEventId" />
    <SubjectForm v-model:show="showForm" :subject="subject" />
  </div>
  <div v-else class="page"><div class="card"><div class="empty-tip">对象不存在或已删除</div></div></div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.card-title { font-size: 14px; font-weight: 700; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.view-text { font-size: 15px; line-height: 1.6; margin-top: 8px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 10px 2px 4px; }
.reason-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-2); line-height: 1.8; }
.quick-row { display: flex; gap: 10px; }
.quick-row .van-button { flex: 1; }
.tl-line { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.tl-line:last-child { border-bottom: 0; }
.tl-kind { flex: none; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
.tl-kind.event { background: var(--brand); }
.tl-kind.thought { background: #f5a623; }
.tl-kind.prediction { background: var(--brand-2); }
.row-main { flex: 1; min-width: 0; }
.tl-text { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-text { font-size: 13px; font-weight: 600; }
.row-line { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.row-line:last-child { border-bottom: 0; }
.big-stat { font-size: 32px; font-weight: 800; color: var(--brand); margin-top: 6px; font-variant-numeric: tabular-nums; }
.big-stat small { font-size: 16px; }
</style>
