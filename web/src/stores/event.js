// 领域 store：事件捕获与结构化复盘（状态与业务规则在此，UI 只消费）
// 状态机（设计方案 5.1）：inbox 收件箱 → pending 复盘中 → reviewed 已复盘
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllEvents, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { isReviewComplete } from '../lib/domain.js';

export const useEventStore = defineStore('event', {
  state: () => ({ events: [], loaded: false }),
  getters: {
    active: (s) => s.events.filter((e) => !e.deleted),
    // 收件箱：待复盘（含复盘中）
    inbox: (s) =>
      s.events
        .filter((e) => !e.deleted && e.status !== 'reviewed')
        .sort((a, b) => b.startAt - a.startAt),
    reviewed: (s) =>
      s.events.filter((e) => !e.deleted && e.status === 'reviewed').sort((a, b) => b.startAt - a.startAt),
    byId: (s) => (id) => s.events.find((e) => e.id === id),
  },
  actions: {
    async load() {
      this.events = await getAllEvents();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 快速捕获（30 秒记下事实；复盘另起）
    async capture({ title, startAt, endAt, subjectIds = [], categoryId = '', fact = '', note = '' }) {
      if (!String(title || '').trim()) throw new Error('请填写事件标题');
      const ev = {
        id: uuid(),
        title: String(title).trim(),
        categoryId: categoryId || '',
        subjectIds: subjectIds.filter(Boolean),
        fact: String(fact || '').trim(),
        note: note || '',
        location: '',
        startAt: startAt || Date.now(),
        endAt: endAt ?? null,
        status: 'inbox',
        review: null,
        reviewedAt: null,
        ruleId: null,
        createdAt: Date.now(),
      };
      await putRow('events', ev);
      logInfo('event', `捕获事件「${ev.title}」`);
      return ev;
    },
    // 捕获信息/复盘草稿的普通更新（不动状态机）
    async patch(id, data) {
      const ev = this.byId(id);
      if (!ev) return null;
      const next = { ...ev, ...data, id: ev.id };
      if (next.status !== 'reviewed') {
        // 草稿保存时若填了复盘内容则标记复盘中
        const hasDraft = next.review && (String(next.review.expect || '').trim() || String(next.review.actual || '').trim());
        if (hasDraft && next.status === 'inbox') next.status = 'pending';
      }
      await putRow('events', next);
      return next;
    },
    // 提交复盘：完成校验 → 已复盘；可选沉淀规则并回写 ruleId
    async submitReview(id, review, { ruleId = null } = {}) {
      if (!isReviewComplete(review)) throw new Error('复盘未完成：需要「预期 vs 实际」与合格的「下次规则」');
      const ev = this.byId(id);
      if (!ev) throw new Error('事件不存在');
      const next = { ...ev, review, status: 'reviewed', reviewedAt: Date.now(), ruleId: ruleId || ev.ruleId || null };
      await putRow('events', next);
      logInfo('event', `完成复盘「${ev.title}」`);
      return next;
    },
    async remove(id) {
      await softDelete('events', id);
      logInfo('event', '删除事件');
    },
  },
});
