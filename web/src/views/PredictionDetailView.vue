<script setup>
// 预判详情:草稿可改;锁定后原始判断只读 + 结果验证(按提前定义的标准评分)+ 验证后沉淀
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import { usePredictionStore } from '../stores/prediction.js';
import { useSubjectStore } from '../stores/subject.js';
import PredictionComposer from '../components/PredictionComposer.vue';
import RuleComposer from '../components/RuleComposer.vue';
import StatusTag from '../components/StatusTag.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import { fmtDate } from '../lib/time.js';
import { BIAS_REASONS, CHAIN_STEPS, predictionEffectiveStatus } from '../lib/domain.js';

const route = useRoute();
const router = useRouter();
const store = usePredictionStore();
const subjectStore = useSubjectStore();

const p = computed(() => store.byId(route.params.id));
const effStatus = computed(() => (p.value ? predictionEffectiveStatus(p.value) : ''));
const isDraft = computed(() => p.value?.status === 'draft');
const isLocked = computed(() => p.value?.status === 'locked');
const isFinal = computed(() => !['draft', 'locked'].includes(p.value?.status));
const overdue = computed(() => isLocked.value && effStatus.value === 'verifying');

const showEdit = ref(false);
const showVerify = ref(false);
const showRule = ref(false);
const rulePrefill = ref(null);

const verifyForm = reactive({
  actual: '',
  score: 'hit',
  biasReasons: [],
  hindsight: '',
  weakest: '',
});

function openVerify() {
  Object.assign(verifyForm, { actual: '', score: 'hit', biasReasons: [], hindsight: '', weakest: '' });
  showVerify.value = true;
}

async function submitVerify() {
  try {
    await store.verify(p.value.id, { ...verifyForm });
    showSuccessToast('预判已验证');
    showVerify.value = false;
  } catch (e) {
    showFailToast(e.message);
  }
}

async function lockNow() {
  try {
    await showConfirmDialog({
      title: '锁定原始预判?',
      message: `锁定后内容/窗口/置信度(${p.value.origConfidence}%)不再可改,过程只能追加。`,
      confirmButtonText: '锁定',
    });
    await store.lock(p.value.id);
    showSuccessToast('已锁定');
  } catch (e) {
    if (e?.message && e !== 'cancel') showFailToast(e.message);
  }
}

async function abandon() {
  try {
    await showConfirmDialog({ title: '放弃该预判?', message: '不再跟踪,标记为已放弃(保留记录,不计入校准)。', confirmButtonText: '放弃' });
    await store.abandon(p.value.id);
    showSuccessToast('已放弃');
  } catch {}
}

// 验证后沉淀:错误/部分命中 → 校准规则;命中 → 也可记有效经验
function distill() {
  const r = p.value?.result || {};
  rulePrefill.value = {
    scene: subjectStore.nameOf(p.value?.subjectId) + ' · ' + (p.value?.kind || ''),
    trigger: p.value?.counterSignals || '再次出现类似判断场景',
    content: '',
    reason: `来自预判「${(p.value?.content || '').slice(0, 30)}」的验证(${r.score}):${(r.actual || '').slice(0, 60)}${r.weakest ? ';最弱环节:' + r.weakest : ''}`,
    refPredictions: [p.value?.id],
  };
  showRule.value = true;
}
</script>

<template>
  <div class="page" v-if="p">
    <div class="page-head">
      <h1 class="head-name">
        <van-icon name="arrow-left" size="20" @click="router.back()" />预判详情
      </h1>
      <StatusTag kind="prediction" :prediction="p" />
    </div>

    <!-- 原始预判(锁定后即为不可变快照) -->
    <div class="card">
      <div class="pred-content">{{ p.content }}</div>
      <div class="meta-grid">
        <span class="muted">对象</span><span @click="router.push(`/subjects/${p.subjectId}`)" class="link">{{ subjectStore.nameOf(p.subjectId) }}</span>
        <span class="muted">类型</span><span>{{ p.kind }}</span>
        <span class="muted">做出时间</span><span>{{ fmtDate(p.madeAt) }}</span>
        <span class="muted">验证窗口</span><span>{{ fmtDate(p.windowStart) }} ~ {{ fmtDate(p.windowEnd) }}</span>
        <span class="muted">锁定</span><span>{{ p.lockedAt ? fmtDate(p.lockedAt) : '未锁定' }}</span>
      </div>
      <div style="margin-top: 12px"><ConfidenceBar :value="p.origConfidence" size="lg" /></div>
      <div v-if="isLocked && !overdue" class="muted" style="margin-top: 8px">🔒 原始预判已锁定,过程只能追加,不可修改</div>
      <div v-if="overdue" class="overdue-tip">⏰ 已过验证截止 —— 按下面的标准给结果</div>
    </div>

    <!-- 验证标准(提前定义,防挪门柱) -->
    <div class="card" v-if="p.criteria">
      <div class="card-title">验证标准<span class="muted" style="font-weight: 400">(提交时定义)</span></div>
      <div class="std-line"><van-tag type="success" plain round size="medium">命中</van-tag><span>{{ p.criteria.hit || '—' }}</span></div>
      <div class="std-line" v-if="p.criteria.partial"><van-tag type="warning" plain round size="medium">部分</van-tag><span>{{ p.criteria.partial }}</span></div>
      <div class="std-line" v-if="p.criteria.miss"><van-tag type="danger" plain round size="medium">错误</van-tag><span>{{ p.criteria.miss }}</span></div>
    </div>

    <!-- 依据与反证 -->
    <div class="card" v-if="p.basis || p.counterSignals">
      <div class="card-title">依据链与反证</div>
      <div v-if="p.basis" class="muted pre-wrap">{{ p.basis }}</div>
      <div v-if="p.counterSignals" class="muted pre-wrap" style="margin-top: 8px">⚠ 反证信号:{{ p.counterSignals }}</div>
    </div>

    <!-- 结果 -->
    <div class="card" v-if="isFinal && p.result">
      <div class="card-title">验证结果 · {{ fmtDate(p.verifiedAt) }}</div>
      <div class="pre-wrap">{{ p.result.actual }}</div>
      <div v-if="p.result.biasReasons?.length" class="chips-row" style="margin-top: 8px">
        <van-tag v-for="b in p.result.biasReasons" :key="b" plain round size="medium" type="warning">{{ b }}</van-tag>
      </div>
      <div v-if="p.result.weakest" class="muted" style="margin-top: 8px">链路最弱环节:{{ p.result.weakest }}</div>
      <div v-if="p.result.hindsight" class="muted" style="margin-top: 4px">事后才知:{{ p.result.hindsight }}</div>
    </div>

    <!-- 操作 -->
    <div class="btn-col" v-if="isDraft">
      <van-button type="primary" round block icon="edit" @click="showEdit = true">编辑草稿</van-button>
      <van-button plain round type="primary" block icon="lock" @click="lockNow">锁定原始预判</van-button>
    </div>
    <div class="btn-col" v-else-if="isLocked">
      <van-button type="primary" round block @click="openVerify">{{ overdue ? '立即验证结果' : '提前验证(窗口未截止)' }}</van-button>
      <van-button plain round type="danger" block @click="abandon">放弃跟踪</van-button>
    </div>
    <div class="btn-col" v-else>
      <van-button plain round type="primary" block icon="bookmark-o" @click="distill">沉淀经验/校准规则</van-button>
    </div>

    <!-- 验证弹层 -->
    <van-popup :show="showVerify" position="bottom" round style="height: 82vh; overflow: auto" @update:show="showVerify = $event">
      <div class="popup-safe form-wrap">
        <div class="pop-head"><span>验证预判</span><van-button size="small" plain round @click="showVerify = false">关闭</van-button></div>
        <van-field v-model="verifyForm.actual" type="textarea" rows="3" autosize label="实际结果 *" placeholder="实际发生了什么(只写当时应知的信息)" />
        <div class="block-label">按提交时的标准评分 *</div>
        <van-radio-group v-model="verifyForm.score" direction="horizontal" class="radio-row">
          <van-radio name="hit">命中</van-radio>
          <van-radio name="partial">部分命中</van-radio>
          <van-radio name="miss">错误</van-radio>
          <van-radio name="unverifiable">无法验证</van-radio>
        </van-radio-group>
        <div class="block-label">偏差原因(可多选)</div>
        <van-checkbox-group v-model="verifyForm.biasReasons" direction="horizontal" class="radio-row">
          <van-checkbox v-for="b in BIAS_REASONS" :key="b" :name="b" shape="square">{{ b }}</van-checkbox>
        </van-checkbox-group>
        <div class="block-label">思考链路最弱环节</div>
        <van-radio-group v-model="verifyForm.weakest" direction="horizontal" class="radio-row">
          <van-radio v-for="c in CHAIN_STEPS" :key="c" :name="c">{{ c }}</van-radio>
        </van-radio-group>
        <van-field v-model="verifyForm.hindsight" type="textarea" rows="2" autosize label="事后信息" placeholder="哪些信息是验证时才知道的(与当时信息分开)" />
        <van-button type="primary" round block style="margin-top: 16px" @click="submitVerify">提交验证</van-button>
      </div>
    </van-popup>

    <PredictionComposer v-model:show="showEdit" :prediction="p" />
    <RuleComposer v-model:show="showRule" :prefill="rulePrefill" @saved="router.push('/rules')" />
  </div>
  <div v-else class="page"><div class="card"><div class="empty-tip">预判不存在或已删除</div></div></div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.card-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.pred-content { font-size: 16px; font-weight: 700; line-height: 1.6; margin-bottom: 10px; }
.meta-grid { display: grid; grid-template-columns: 64px 1fr; gap: 6px 10px; font-size: 13px; }
.link { color: var(--brand); cursor: pointer; }
.std-line { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; font-size: 13px; color: var(--text-2); }
.overdue-tip { margin-top: 8px; font-size: 13px; color: #f5a623; font-weight: 600; }
.pre-wrap { white-space: pre-wrap; font-size: 13px; color: var(--text-2); line-height: 1.7; }
.chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
.btn-col { display: flex; flex-direction: column; gap: 10px; }
.form-wrap { padding: 18px 14px 6px; display: flex; flex-direction: column; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.radio-row { padding: 0 16px; display: flex; flex-wrap: wrap; gap: 10px; }
</style>
