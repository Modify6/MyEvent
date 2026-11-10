// 领域 store：事件线索与其过程记录（状态与业务规则在此，UI 只消费）
// 0.3.0：事件 = 可持续追加的线索；小结是自由文本（kind='summary' 的过程记录），无复盘状态机
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllEvents, getAllEventEntries, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { TRIGGER_KINDS } from '../lib/domain.js';

export const useEventStore = defineStore('event', {
  state: () => ({ events: [], entries: [], loaded: false }),
  getters: {
    active: (s) => s.events.filter((e) => !e.deleted),
    // 线索列表：按最后活动时间(自身更新或最新一条过程记录)倒序
    threads(s) {
      const last = (e) => {
        let t = e.updatedAt || 0;
        for (const en of s.entries) if (!en.deleted && en.eventId === e.id && en.at > t) t = en.at;
        return t;
      };
      return s.events.filter((e) => !e.deleted).sort((a, b) => last(b) - last(a));
    },
    byId: (s) => (id) => s.events.find((e) => e.id === id),
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
    },
    // 新建线索：标题必填，其余全可选；填了触发源则自动成为首条过程记录
    async capture({ title, startAt, endAt, subjectIds = [], categoryId = '', fact = '', note = '' }) {
      if (!String(title || '').trim()) throw new Error('给这条线索起个标题');
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
        createdAt: Date.now(),
      };
      await putRow('events', ev);
      logInfo('event', `新建线索「${ev.title}」`);
      return ev;
    },
    async patch(id, data) {
      const ev = this.byId(id);
      if (!ev) return null;
      const next = { ...ev, ...data, id: ev.id };
      const st = data.startAt ?? null;
      if (st == null) next.startAt = ev.startAt;
      await putRow('events', next);
      return next;
    },
    async remove(id) {
      await softDelete('events', id);
      logInfo('event', '删除线索');
    },
    // —— 过程记录：可持续跟进，每条带触发源；kind='summary' 为小结(自由文本) ——
    // 存在性查库而非 store state —— 新建线索后立即追加首条记录时,onChange → load 可能尚未跑完
    async addEntry({ eventId, content, triggerKind = '', triggerNote = '', at, kind = 'record' }) {
      const text = String(content || '').trim();
      if (!text) throw new Error('记点什么?一句话也行');
      if (!eventId) throw new Error('缺少所属线索');
      const { db } = await import('../db/schema.js');
      const ev = await db.events.get(eventId);
      if (!ev || ev.deleted) throw new Error('线索不存在');
      const row = {
        id: uuid(),
        eventId,
        kind: kind === 'summary' ? 'summary' : 'record',
        content: text,
        triggerKind: TRIGGER_KINDS.includes(triggerKind) ? triggerKind : '',
        triggerNote: String(triggerNote || '').trim(),
        at: at || Date.now(),
        createdAt: Date.now(),
      };
      await putRow('eventEntries', row);
      logInfo('event', kind === 'summary' ? '写小结' : `追加过程记录(${row.triggerKind || '无触发源'})`);
      return row;
    },
    async removeEntry(id) {
      await softDelete('eventEntries', id);
    },
  },
});
