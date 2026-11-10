// 领域 store：事件捕获、过程记录与结构化复盘（状态与业务规则在此，UI 只消费）
// 状态机（设计方案 5.1）：inbox 收件箱 → pending 复盘中 → reviewed 已复盘
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllEvents, getAllEventEntries, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { isReviewComplete, TRIGGER_KINDS } from '../lib/domain.js';

export const useEventStore = defineStore('event', {
  state: () => ({ events: [], entries: [], loaded: false }),
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
    // 某事件的过程记录（倒序）；含软删过滤
    entriesOf: (s) => (eventId) =>
      s.entries.filter((t) => !t.deleted && t.eventId === eventId).sort((a, b) => b.at - a.at),
    entryCountOf() {
      return (eventId) => this.entriesOf(eventId).length;
    },
  },
  actions: {
    async load() {
      this.events = await getAllEvents();
      this.entries = await getAllEventEntries();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },    // 快速捕获（30 秒记下事实；复盘另起）
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
    // —— 过程记录：事件可持续跟进，每条记录带触发源(类型+说明) ——
    // 注意:存在性查库而非 store state —— 捕获事件后立即追加首条记录时,onChange → load 可能尚未跑完
    async addEntry({ eventId, content, triggerKind = '', triggerNote = '', at }) {
      const text = String(content || '').trim();
      if (!text) throw new Error('记点什么?一句话也行');
      if (!eventId) throw new Error('缺少所属事件');
      const { db } = await import('../db/schema.js');
      const ev = await db.events.get(eventId);
      if (!ev || ev.deleted) throw new Error('事件不存在');
      const row = {
        id: uuid(),
        eventId,
        content: text,
        triggerKind: TRIGGER_KINDS.includes(triggerKind) ? triggerKind : '',
        triggerNote: String(triggerNote || '').trim(),
        at: at || Date.now(),
        createdAt: Date.now(),
      };
      await putRow('eventEntries', row);
      logInfo('event', `追加过程记录(${row.triggerKind || '无触发源'})`);
      return row;
    },
    async removeEntry(id) {
      await softDelete('eventEntries', id);
    },
  },
});
