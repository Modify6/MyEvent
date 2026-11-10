// 领域 store：预判（Prediction）——可证伪判断的完整闭环
// 生命周期：草稿 → 锁定(原始预判快照，核心字段只读) → 待验证(过窗口截止) → 终态(hit/partial/miss/unverifiable/abandoned)
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllPredictions, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { MAX_ACTIVE_PREDICTIONS, PREDICTION_KINDS, clampPct, predictionEffectiveStatus } from '../lib/domain.js';

export const usePredictionStore = defineStore('prediction', {
  state: () => ({ predictions: [], loaded: false }),
  getters: {
    active: (s) => s.predictions.filter((p) => !p.deleted),
    byId: (s) => (id) => s.predictions.find((p) => p.id === id),
    // 锁定且未终态（含未到期）= 占用注意力的"进行中核心预判"
    lockedCount: (s) => s.predictions.filter((p) => !p.deleted && p.status === 'locked').length,
    atCapacity() {
      return this.lockedCount >= MAX_ACTIVE_PREDICTIONS;
    },
    // 列表三分区（按有效状态：locked 且过期 → verifying）
    drafts: (s) => s.predictions.filter((p) => !p.deleted && p.status === 'draft').sort((a, b) => b.createdAt - a.createdAt),
    running() {
      return this.active
        .filter((p) => predictionEffectiveStatus(p) === 'locked')
        .sort((a, b) => a.windowEnd - b.windowEnd);
    },
    due() {
      return this.active
        .filter((p) => predictionEffectiveStatus(p) === 'verifying')
        .sort((a, b) => a.windowEnd - b.windowEnd);
    },
    verified() {
      return this.active
        .filter((p) => ['hit', 'partial', 'miss', 'unverifiable', 'abandoned'].includes(p.status))
        .sort((a, b) => (b.verifiedAt || b.updatedAt) - (a.verifiedAt || a.updatedAt));
    },
    ofSubject: (s) => (sid) => s.predictions.filter((p) => !p.deleted && p.subjectId === sid),
  },
  actions: {
    async load() {
      this.predictions = await getAllPredictions();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 创建草稿（不占进行中名额）
    async create(data) {
      const content = String(data.content || '').trim();
      if (!content) throw new Error('预判内容必填');
      if (!data.subjectId) throw new Error('请选择所属对象');
      if (!data.windowEnd) throw new Error('请填写验证截止时间');
      const criteria = data.criteria || {};
      if (!String(criteria.hit || '').trim()) throw new Error('请定义「什么算命中」的验证标准');
      const conf = clampPct(data.origConfidence, 50);
      if (conf == null || conf < 50 || conf > 100) throw new Error('置信度需在 50–100%');
      const row = {
        id: uuid(),
        subjectId: data.subjectId,
        content,
        kind: PREDICTION_KINDS.includes(data.kind) ? data.kind : '结果型',
        madeAt: Date.now(),
        windowStart: data.windowStart || Date.now(),
        windowEnd: data.windowEnd,
        origConfidence: conf,
        basis: data.basis || '',
        counterSignals: data.counterSignals || '',
        criteria: {
          hit: String(criteria.hit || '').trim(),
          partial: String(criteria.partial || '').trim(),
          miss: String(criteria.miss || '').trim(),
        },
        status: 'draft',
        lockedAt: null,
        lockSnapshot: null,
        result: null,
        verifiedAt: null,
        createdAt: Date.now(),
      };
      await putRow('predictions', row);
      logInfo('prediction', `新建预判草稿「${content.slice(0, 20)}」`);
      return row;
    },
    // 草稿期编辑
    async patch(id, data) {
      const p = this.byId(id);
      if (!p) return null;
      if (p.status !== 'draft') throw new Error('预判已锁定，原始判断不可修改');
      const next = { ...p, ...data, id: p.id };
      if (next.origConfidence != null) next.origConfidence = clampPct(next.origConfidence);
      await putRow('predictions', next);
      return next;
    },
    // 锁定：写入原始快照，从此核心字段只读（防事后合理化）
    async lock(id) {
      const p = this.byId(id);
      if (!p) throw new Error('预判不存在');
      if (p.status !== 'draft') throw new Error('已锁定');
      if (this.atCapacity) throw new Error(`进行中预判已达上限 ${MAX_ACTIVE_PREDICTIONS} 条，先验证或放弃一条`);
      const snap = {
        content: p.content,
        kind: p.kind,
        windowStart: p.windowStart,
        windowEnd: p.windowEnd,
        origConfidence: p.origConfidence,
        basis: p.basis,
        counterSignals: p.counterSignals,
        criteria: p.criteria,
        madeAt: p.madeAt,
        lockedAt: Date.now(),
      };
      const next = { ...p, status: 'locked', lockedAt: snap.lockedAt, lockSnapshot: snap };
      await putRow('predictions', next);
      logInfo('prediction', `锁定预判「${p.content.slice(0, 20)}」@${p.origConfidence}%`);
      return next;
    },
    // 结果验证：按提前定义的标准评分；分离「实际结果」与「事后信息」
    async verify(id, { actual, score, biasReasons = [], hindsight = '', weakest = '' }) {
      const p = this.byId(id);
      if (!p) throw new Error('预判不存在');
      if (p.status !== 'locked') throw new Error('仅进行中的预判可验证');
      if (!['hit', 'partial', 'miss', 'unverifiable'].includes(score)) throw new Error('请选择验证结果');
      if (!String(actual || '').trim()) throw new Error('请填写实际发生了什么');
      const result = {
        actual: String(actual).trim(),
        score,
        biasReasons,
        hindsight: String(hindsight || '').trim(),
        weakest,
      };
      const next = { ...p, status: score, result, verifiedAt: Date.now() };
      await putRow('predictions', next);
      logInfo('prediction', `验证预判「${p.content.slice(0, 20)}」→ ${score}`);
      return next;
    },
    async abandon(id) {
      const p = this.byId(id);
      if (!p || p.status !== 'locked') return;
      await putRow('predictions', { ...p, status: 'abandoned' });
      logInfo('prediction', '放弃预判');
    },
    async remove(id) {
      await softDelete('predictions', id);
    },
  },
});
