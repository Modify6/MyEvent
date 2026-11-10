<script setup>
// 结构化复盘(设计方案 5.1):四步分步引导 —— 捕获信息 → 目标与预期 → 过程与结果 → 教训与规则
// 完成标准:预期 vs 实际 + 合格的「下次规则」;可选沉淀为经验规则
import { computed, reactive, ref, watch } from 'vue';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import dayjs from 'dayjs';
import { useEventStore } from '../stores/event.js';
import { useSubjectStore } from '../stores/subject.js';
import { useCatalogStore } from '../stores/catalog.js';
import { useRuleStore } from '../stores/rule.js';
import EntryComposer from './EntryComposer.vue';
import { validateRuleText, isReviewComplete } from '../lib/domain.js';
import { toLocalInput, fromLocalInput, fmtDate, fmtTime } from '../lib/time.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  eventId: { type: String, default: '' },
});
const emit = defineEmits(['update:show', 'done']);

const eventStore = useEventStore();
const subjectStore = useSubjectStore();
const catalog = useCatalogStore();
const ruleStore = useRuleStore();

const STEPS = ['事件', '目标与预期', '过程与结果', '教训与规则'];
const step = ref(0);
const form = reactive({
  title: '',
  startAt: '',
  subjectIds: [],
  categoryId: '',
  fact: '',
  goal: '',
  expect: '',
  expectConfidence: 60,
  hasExpectConf: false,
  keyNodes: [''],
  basis: '',
  emotion: '',
  actual: '',
  deviation: '',
  redoPoint: '',
  lesson: '',
  nextRule: '',
  saveRule: true,
  ruleScene: '',
  ruleTrigger: '',
  action: '',
  actionDueDate: '',
});

watch(
  () => props.show,
  (v) => {
    if (!v || !props.eventId) return;
    const ev = eventStore.byId(props.eventId);
    if (!ev) return;
    const r = ev.review || {};
    Object.assign(form, {
      title: ev.title || '',
      startAt: toLocalInput(ev.startAt),
      subjectIds: ev.subjectIds || [],
      categoryId: ev.categoryId || '',
      fact: ev.fact || '',
      goal: r.goal || '',
      expect: r.expect || '',
      expectConfidence: r.expectConfidence ?? 60,
      hasExpectConf: r.expectConfidence != null,
      keyNodes: (r.keyNodes?.length ? r.keyNodes : ['']).slice(0, 5),
      basis: r.basis || '',
      emotion: r.emotion || '',
      actual: r.actual || '',
      deviation: r.deviation || '',
      redoPoint: r.redoPoint || '',
      lesson: r.lesson || '',
      nextRule: r.nextRule || '',
      saveRule: true,
      ruleScene: catalog.catName(ev.categoryId) === '未标记' ? '' : catalog.catName(ev.categoryId),
      ruleTrigger: r.redoPoint || '',
      action: r.action || '',
      actionDueDate: r.actionDueAt ? dayjs(r.actionDueAt).format('YYYY-MM-DD') : '',
    });
    step.value = ev.status === 'reviewed' ? 3 : 0;
  }
);

const ruleCheck = computed(() => validateRuleText(form.nextRule));
const isDone = computed(() => {
  const ev = eventStore.byId(props.eventId);
  return ev?.status === 'reviewed';
});
const entries = computed(() => eventStore.entriesOf(props.eventId));
const showEntry = ref(false);

function toggleSubject(id) {
  const i = form.subjectIds.indexOf(id);
  if (i >= 0) form.subjectIds.splice(i, 1);
  else form.subjectIds.push(id);
}
function addNode() {
  if (form.keyNodes.length < 5) form.keyNodes.push('');
}
function removeNode(i) {
  if (form.keyNodes.length > 1) form.keyNodes.splice(i, 1);
  else form.keyNodes[0] = '';
}

function buildReview() {
  return {
    goal: form.goal,
    expect: form.expect,
    expectConfidence: form.hasExpectConf ? form.expectConfidence : null,
    keyNodes: form.keyNodes.map((s) => s.trim()).filter(Boolean).slice(0, 5),
    basis: form.basis,
    emotion: form.emotion,
    actual: form.actual,
    deviation: form.deviation,
    redoPoint: form.redoPoint,
    lesson: form.lesson,
    nextRule: form.nextRule,
    action: form.action,
    actionDueAt: form.actionDueDate ? dayjs(form.actionDueDate).valueOf() : null,
  };
}

// 保存草稿:捕获信息 + 已填复盘内容,状态 → 复盘中
async function saveDraft() {
  if (!form.title.trim()) return showFailToast('事件标题不能为空');
  const data = {
    title: form.title,
    subjectIds: [...form.subjectIds],
    categoryId: form.categoryId,
    fact: form.fact,
    review: buildReview(),
  };
  const st = fromLocalInput(form.startAt);
  if (st) data.startAt = st;
  await eventStore.patch(props.eventId, data);
  showSuccessToast('草稿已保存,可稍后继续');
  emit('update:show', false);
}

function next() {
  if (step.value === 0 && !form.title.trim()) return showFailToast('先给事件起个标题');
  step.value = Math.min(step.value + 1, 3);
}

async function finish() {
  const review = buildReview();
  if (!isReviewComplete(review)) {
    const gap = !review.expect?.trim() ? '「我的预期」' : !review.actual?.trim() ? '「实际结果」' : '「下次规则」';
    return showFailToast(`复盘未完成:请补 ${gap}`);
  }
  try {
    let ruleId = null;
    if (form.saveRule && ruleCheck.value.ok) {
      const rule = await ruleStore.create({
        scene: form.ruleScene || '通用',
        trigger: form.ruleTrigger,
        content: form.nextRule,
        reason: form.deviation || form.basis,
        counterEx: '',
        refEvents: [props.eventId],
      });
      ruleId = rule.id;
    }
    await eventStore.submitReview(props.eventId, review, { ruleId });
    showSuccessToast('复盘完成');
    emit('done');
    emit('update:show', false);
  } catch (e) {
    showFailToast(e.message);
  }
}

async function close() {
  const touched = form.expect.trim() || form.actual.trim() || form.nextRule.trim();
  if (touched && !isDone.value) {
    try {
      await showConfirmDialog({ title: '保存草稿?', message: '已填内容将保留,事件仍在待复盘列表', confirmButtonText: '保存草稿', cancelButtonText: '丢弃' });
      await saveDraft();
    } catch {
      emit('update:show', false);
    }
  } else {
    emit('update:show', false);
  }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 92vh; overflow: auto" @update:show="(v) => { if (!v) close(); else emit('update:show', true) }">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>复盘 · {{ form.title || '事件' }}</span>
        <van-button size="small" plain round @click="close">关闭</van-button>
      </div>

      <van-steps :active="step" active-color="var(--brand)">
        <van-step v-for="s in STEPS" :key="s">{{ s }}</van-step>
      </van-steps>

      <!-- 步骤 0:捕获信息 -->
      <div v-if="step === 0" class="step-panel">
        <van-field v-model="form.title" placeholder="事件标题 *" />
        <van-field v-model="form.startAt" type="datetime-local" label="发生时间" />
        <van-field v-model="form.fact" type="textarea" rows="2" autosize label="一句话事实" placeholder="客观发生了什么" />
        <div class="block-label">关联对象</div>
        <div class="chip-row">
          <button v-for="s in subjectStore.active" :key="s.id" class="tag-chip" :class="{ active: form.subjectIds.includes(s.id) }" @click="toggleSubject(s.id)">{{ s.name }}</button>
        </div>
        <div class="block-label">场景标签</div>
        <div class="chip-row">
          <button
            v-for="c in catalog.active"
            :key="c.id"
            class="tag-chip"
            :class="{ active: form.categoryId === c.id }"
            :style="form.categoryId === c.id ? { borderColor: c.color, color: c.color } : {}"
            @click="form.categoryId = form.categoryId === c.id ? '' : c.id"
          >{{ c.name }}</button>
        </div>

        <!-- 过程记录:事件可持续跟进,每条带触发源 -->
        <div class="block-label row-between">
          <span>过程记录 · {{ entries.length }} 条<span class="muted">(每次跟进由什么触发)</span></span>
          <van-button size="small" plain round type="primary" icon="plus" @click="showEntry = true">追加</van-button>
        </div>
        <template v-if="entries.length">
          <div v-for="en in entries" :key="en.id" class="entry-line">
            <div class="row-main">
              <div class="entry-text">{{ en.content }}</div>
              <div class="muted">
                {{ fmtDate(en.at) }} {{ fmtTime(en.at) }}
                <template v-if="en.triggerKind"> · 由{{ en.triggerKind }}触发</template>
                <template v-if="en.triggerNote && en.triggerNote !== en.content"> · {{ en.triggerNote }}</template>
              </div>
            </div>
            <van-icon name="cross" size="15" color="var(--text-3)" @click="eventStore.removeEntry(en.id)" />
          </div>
        </template>
        <div v-else class="muted" style="padding: 2px 2px 6px">还没有过程记录 —— 捕获时未填触发源,可点「追加」补记</div>
      </div>

      <!-- 步骤 1:目标与预期 -->
      <div v-if="step === 1" class="step-panel">
        <van-field v-model="form.goal" type="textarea" rows="2" autosize label="最初目标" placeholder="我当时想达成什么" />
        <van-field v-model="form.expect" type="textarea" rows="2" autosize label="我的预期 *" placeholder="我预期会发生什么" />
        <div class="slider-row">
          <van-checkbox v-model="form.hasExpectConf" shape="square" icon-size="14px">预期置信度</van-checkbox>
          <template v-if="form.hasExpectConf">
            <van-slider v-model="form.expectConfidence" :min="0" :max="100" style="flex: 1" />
            <span class="conf-num">{{ form.expectConfidence }}%</span>
          </template>
        </div>
      </div>

      <!-- 步骤 2:过程与结果 -->
      <div v-if="step === 2" class="step-panel">
        <div class="block-label">关键转折点(最多 5 个,只写改变走向的节点)</div>
        <div v-for="(n, i) in form.keyNodes" :key="i" class="node-row">
          <van-field v-model="form.keyNodes[i]" type="textarea" rows="1" autosize :placeholder="`节点 ${i + 1}`" />
          <van-button size="mini" plain round type="danger" class="node-del" @click="removeNode(i)">删</van-button>
        </div>
        <div class="row-center" style="margin-top: 6px">
          <van-button v-if="form.keyNodes.length < 5" size="small" plain round icon="plus" @click="addNode">加节点</van-button>
        </div>
        <van-field v-model="form.basis" type="textarea" rows="2" autosize label="当时判断" placeholder="当时的判断和依据" />
        <van-field v-model="form.emotion" type="textarea" rows="1" autosize label="情绪身体" placeholder="情绪与身体反应(选填)" />
        <van-field v-model="form.actual" type="textarea" rows="2" autosize label="实际结果 *" placeholder="实际发生了什么" />
        <van-field v-model="form.deviation" type="textarea" rows="2" autosize label="最大偏差" placeholder="预期 vs 实际,差在哪" />
        <van-field v-model="form.redoPoint" type="textarea" rows="2" autosize label="可改节点" placeholder="如果重来,哪个节点可以不同" />
      </div>

      <!-- 步骤 3:教训与规则 -->
      <div v-if="step === 3" class="step-panel">
        <van-field v-model="form.lesson" type="textarea" rows="2" autosize label="一句话教训" placeholder="这件事教会我什么" />
        <van-field v-model="form.nextRule" type="textarea" rows="2" autosize label="下次规则 *" placeholder="如果 X,则 Y —— 下次遇到相似场景的行动规则" />
        <div class="rule-tip" :class="ruleCheck.ok ? 'ok' : 'bad'">{{ ruleCheck.msg || '✓ 规则可执行' }}</div>
        <van-checkbox v-model="form.saveRule" shape="square" style="margin: 8px 16px">沉淀到经验库</van-checkbox>
        <template v-if="form.saveRule">
          <van-field v-model="form.ruleScene" label="适用场景" placeholder="如:需求沟通 / 投资决策" />
          <van-field v-model="form.ruleTrigger" label="触发信号" placeholder="看到什么信号时应用此规则" />
        </template>
        <van-field v-model="form.action" type="textarea" rows="1" autosize label="行动项" placeholder="接下来要做什么(选填)" />
        <van-field v-model="form.actionDueDate" type="date" label="验证日期" placeholder="何时检查行动项" />
      </div>

      <div class="nav-row">
        <van-button v-if="step > 0" plain round @click="step--">上一步</van-button>
        <van-button plain round type="default" style="margin-left: auto" @click="saveDraft" v-if="!isDone">存草稿</van-button>
        <van-button v-if="step < 3" type="primary" round style="margin-left: 10px" @click="next">下一步</van-button>
        <van-button v-else type="primary" round style="margin-left: 10px" :disabled="isDone" @click="finish">{{ isDone ? '已复盘' : '完成复盘' }}</van-button>
      </div>
    </div>
    <!-- 追加过程记录(带触发源) -->
    <EntryComposer v-model:show="showEntry" :event-id="eventId" />
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 12px 6px; display: flex; flex-direction: column; min-height: 100%; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.step-panel { margin-top: 12px; }
.block-label { font-size: 12px; color: var(--text-3); margin: 12px 2px 6px; }
.row-center { display: flex; justify-content: center; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
.tag-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 5px 13px; font-size: 12px; color: var(--text-2); }
.tag-chip.active { border-color: var(--brand); color: var(--brand); font-weight: 600; background: color-mix(in srgb, var(--brand) 8%, transparent); }
.slider-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px 4px; }
.conf-num { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
.node-row { display: flex; align-items: flex-start; gap: 6px; }
.node-del { margin-top: 6px; flex: none; }
.rule-tip { font-size: 12px; margin: 4px 16px; }
.rule-tip.ok { color: #34c273; }
.rule-tip.bad { color: var(--danger); }
.nav-row { display: flex; align-items: center; margin-top: 18px; padding-bottom: 6px; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.entry-line { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.entry-line:last-child { border-bottom: 0; }
.entry-text { font-size: 13px; line-height: 1.5; }
.entry-line .van-icon { cursor: pointer; margin-top: 3px; flex: none; }
</style>
