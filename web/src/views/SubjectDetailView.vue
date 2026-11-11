<script setup>
// 对象中枢页:当前观点快照 + 三轨时间线 + 未验证假设 + 关联规则 + 预判命中
// 视觉:彩色首字头像贯穿列表与详情
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { showConfirmDialog, showSuccessToast } from 'vant';
import { useSubjectStore } from '../stores/subject.js';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useRuleStore } from '../stores/rule.js';
import { useCatalogStore } from '../stores/catalog.js';
import EventComposer from '../components/EventComposer.vue';
import NoteComposer from '../components/NoteComposer.vue';
import PredictionComposer from '../components/PredictionComposer.vue';
import ThreadEditor from '../components/ThreadEditor.vue';
import SubjectForm from '../components/SubjectForm.vue';
import StatusTag from '../components/StatusTag.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import { avatarColor } from '../lib/display.js';
import { fmtDate } from '../lib/time.js';
import { PREDICTION_VERIFIED } from '../lib/domain.js';

const route = useRoute();
const router = useRouter();
const subjectStore = useSubjectStore();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const ruleStore = useRuleStore();
const catalog = useCatalogStore();

const sid = computed(() => route.params.id);
const subject = computed(() => subjectStore.byId(sid.value));

const subjectEvents = computed(() => eventStore.active.filter((e) => (e.subjectIds || []).includes(sid.value)));
const subjectPredictions = computed(() => predictionStore.ofSubject(sid.value));

// 三轨时间线:事实线 + 想法线 + 预判线,倒序;支持过滤与分页
const timeline = computed(() => {
  const items = [];
  for (const e of subjectEvents.value) items.push({ kind: 'event', at: e.startAt, data: e });
  for (const t of thoughtStore.ofSubject(sid.value)) items.push({ kind: 'thought', at: t.at, data: t });
  for (const p of subjectPredictions.value) items.push({ kind: 'prediction', at: p.madeAt, data: p });
  return items.sort((a, b) => b.at - a.at);
});
const tlFilter = ref('all');
const timelineFiltered = computed(() => {
  if (tlFilter.value === 'idea') return timeline.value.filter((it) => it.kind === 'thought');
  if (tlFilter.value === 'prediction') return timeline.value.filter((it) => it.kind === 'prediction');
  if (tlFilter.value === 'event') return timeline.value.filter((it) => it.kind === 'event');
  return timeline.value;
});
const PAGE_SIZE = 50;
const limit = ref(PAGE_SIZE);
const tlShown = computed(() => timelineFiltered.value.slice(0, limit.value));
const hasMore = computed(() => timelineFiltered.value.length > limit.value);
const loadMore = () => { limit.value += PAGE_SIZE; };
watch(tlFilter, () => { limit.value = PAGE_SIZE; });

const hypotheses = computed(() => thoughtStore.ofSubject(sid.value).filter((t) => t.kind === '假设'));
const relatedRules = computed(() =>
  ruleStore.ofSubjectIds(
    subjectEvents.value.map((e) => e.id),
    subjectPredictions.value.map((p) => p.id)
  )
);
const hitStat = computed(() => {
  const done = subjectPredictions.value.filter((p) => PREDICTION_VERIFIED.includes(p.status));
  const score = done.reduce((s, p) => s + (p.status === 'hit' ? 1 : p.status === 'partial' ? 0.5 : 0), 0);
  return { total: subjectPredictions.value.length, done: done.length, rate: done.length ? Math.round((score / done.length) * 100) : null };
});

// 观点快照温和提醒:超 30 天未更新且期间有新记录(纯被动)
const snapshotHint = computed(() => {
  const sub = subject.value;
  if (!sub?.currentView) return '';
  const days = Math.floor((Date.now() - (sub.updatedAt || sub.createdAt || 0)) / 86_400_000);
  if (days < 30) return '';
  const since = sub.updatedAt || 0;
  const newCount = thoughtStore.ofSubject(sub.id).filter((t) => t.at > since).length
    + eventStore.active.filter((e) => (e.subjectIds || []).includes(sub.id) && e.updatedAt > since).length;
  return `观点已 ${days} 天未更新,期间新增 ${newCount} 条记录 —— 可基于它们更新当前观点`;
});

const nextReviewIn = computed(() => {
  const t = subject.value?.nextReviewAt;
  if (!t) return '';
  const days = Math.ceil((t - Date.now()) / 86_400_000);
  return days > 0 ? `${days} 天后回顾` : '已到回顾时间';
});

// 观点快照草稿:纯本地拼接最近 8 条记录(非 AI)
const viewDraft = computed(() => {
  const lines = [];
  for (const t of thoughtStore.ofSubject(sid.value).slice(0, 8)) lines.push(`[${dayjs(t.at).format('M月D日')}] ${t.kind}: ${t.content}`);
  for (const e of subjectEvents.value.slice(0, 4)) lines.push(`[${dayjs(e.startAt).format('M月D日')}] 线索: ${e.title}`);
  return lines.length ? lines.join('\n') : '';
});

const avatarStyle = computed(() => {
  const c = avatarColor(subject.value.id);
  return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c };
});

// 时间线行跳转:预判→详情;事件→线索页;想法→其挂靠的线索(若有)
function goTimeline(it) {
  if (it.kind === 'prediction') return router.push(`/predictions/${it.data.id}`);
  if (it.kind === 'event') return router.push(`/events/${it.data.id}`);
  if (it.kind === 'thought' && it.data.relatedEventId) return router.push(`/events/${it.data.relatedEventId}`);
}

const showEvent = ref(false);
const showThought = ref(false);
const showPred = ref(false);
const showForm = ref(false);
const showThreadEditor = ref(false);

async function removeSubject() {
  try {
    await showConfirmDialog({ title: '删除对象?', message: `「${subject.value.name}」及其挂靠关系将移入回收状态(软删,可在回收站恢复)。`, confirmButtonText: '删除' });
    await subjectStore.remove(sid.value);
    router.replace('/subjects');
  } catch {}
}
</script>

<template>
  <div class="page" v-if="subject">
    <div class="page-head">
      <h1 class="head-name">
        <van-icon name="arrow-left" size="20" @click="router.back()" />
        <span class="header-avatar" :style="avatarStyle">{{ subject.name.slice(0, 1) }}</span>{{ subject.name }}
      </h1>
      <span class="head-actions">
        <van-button size="small" plain round @click="showThreadEditor = true">编辑</van-button>
        <van-icon name="delete-o" size="20" color="var(--text-3)" @click="removeSubject" />
      </span>
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
        <div v-if="snapshotHint" class="snap-hint">💡 {{ snapshotHint }}</div>
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
        <div class="empty-tip" style="padding: 10px 0">还没有形成当前观点 —— 记下你此刻的<b style="color: var(--brand)">判断</b>、<b style="color: #f5a623">置信度</b>和<b style="color: var(--danger)">最大反证</b></div>
        <van-button size="small" round type="primary" plain block @click="showForm = true">填写观点快照</van-button>
        <van-button v-if="viewDraft" size="small" plain block style="margin-top: 8px" @click="showForm = true">从最近记录生成草稿</van-button>
      </template>
    </div>

    <!-- 快捷操作 -->
    <div class="card quick-row">
      <van-button size="small" plain round type="primary" icon="edit" @click="showEvent = true">记事件</van-button>
      <van-button size="small" plain round type="primary" icon="chat-o" @click="showThought = true">记一笔</van-button>
      <van-button size="small" plain round type="primary" icon="aim" @click="showPred = true">做预判</van-button>
    </div>
    <div class="hint-line hint-brand seg-explain">
      <span class="se-item"><b style="color: var(--brand)">记事件</b> 新建一条线索</span>
      <span class="se-item"><b style="color: #f5a623">记一笔</b> 想法直接挂到这个对象</span>
      <span class="se-item"><b style="color: var(--brand-2)">做预判</b> 记一个可验证的判断,到期看准不准</span>
    </div>

    <!-- 三轨时间线 -->
    <div class="section-title">时间线 · 事实 / 想法 / 预判</div>
    <div class="seg" v-if="timeline.length" style="margin-bottom: 10px">
      <button :class="{ active: tlFilter === 'all' }" @click="tlFilter = 'all'">全部</button>
      <button :class="{ active: tlFilter === 'event' }" @click="tlFilter = 'event'">事实</button>
      <button :class="{ active: tlFilter === 'thought' }" @click="tlFilter = 'thought'">想法</button>
      <button :class="{ active: tlFilter === 'prediction' }" @click="tlFilter = 'prediction'">预判</button>
    </div>
    <div class="card" v-if="tlShown.length">
      <div v-for="it in tlShown.slice(0, 30)" :key="it.kind + it.data.id" class="tl-line" @click="goTimeline(it)">
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
    </div>
    <div v-if="hasMore" class="row-center" style="margin: 4px 0 8px">
      <van-button plain round size="small" @click="loadMore">还有 {{ timelineFiltered.length - limit }} 条 · 加载更多</van-button>
    </div>
    <div v-else-if="!timeline.length" class="card"><div class="empty-tip">这个对象还没有记录 —— 用上面的按钮记第一笔</div></div>

    <!-- 预判命中 -->
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

    <!-- 未验证假设 -->
    <template v-if="hypotheses.length">
      <div class="section-title">未验证假设</div>
      <div class="card">
        <div v-for="h in hypotheses" :key="h.id" class="row-line" @click="goTimeline({ kind: 'thought', data: h })">
          <div class="row-main">
            <div class="tl-text">{{ h.content }}</div>
            <div class="muted">{{ fmtDate(h.at) }}<template v-if="h.confidence != null"> · {{ h.confidence }}%</template></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 关联经验规则 -->
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
    <NoteComposer v-model:show="showThought" :subject-id="sid" />
    <PredictionComposer v-model:show="showPred" :subject-id="sid" @saved="router.push(`/predictions/${$event.id}`)" @locked="router.push(`/predictions/${$event.id}`)" />
    <SubjectForm v-model:show="showForm" :subject="subject" :draft="subject?.currentView ? '' : viewDraft" />
    <ThreadEditor v-model:show="showThreadEditor" :thread="subject" />
  </div>
  <div v-else class="page"><div class="card"><div class="empty-tip">对象不存在或已删除</div></div></div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.header-avatar { width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
.head-actions { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.card-title { font-size: 14px; font-weight: 700; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.view-text { font-size: 15px; line-height: 1.6; margin-top: 8px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 10px 2px 4px; }
.reason-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-2); line-height: 1.8; }
.snap-hint { font-size: 12px; color: #f5a623; margin-top: 8px; line-height: 1.6; }
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
.row-center { display: flex; justify-content: center; }
</style>
