// 领域 store：事件线索与其过程记录（状态与业务规则在此，UI 只消费）
// 0.3.0：事件 = 可持续追加的线索；小结是自由文本（kind='summary' 的过程记录），无复盘状态机
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllEvents, getAllEventEntries, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { TRIGGER_KINDS, THREAD_STATES, THREAD_STATE_META, HANDLE_STATUSES } from '../lib/domain.js';

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
    async capture({ title, startAt, endAt, subjectIds = [], categoryId = '', fact = '', note = '', folderId = '' }) {
      if (!String(title || '').trim()) throw new Error('给这条线索起个标题');
      const ev = {
        id: uuid(),
        title: String(title).trim(),
        categoryId: categoryId || '',
        folderId: folderId || '',
        subjectIds: subjectIds.filter(Boolean),
        fact: String(fact || '').trim(),
        note: note || '',
        location: '',
        startAt: startAt || Date.now(),
        endAt: endAt ?? null,
        threadState: 'open',
        createdAt: Date.now(),
      };
      await putRow('events', ev);
      // 同步进内存状态:onChange→load 是异步的,紧随其后的读写(如改状态)不等它
      this.events.push(ev);
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
        handleStatus: 'pending',
        createdAt: Date.now(),
      };
      await putRow('eventEntries', row);
      this.entries.push(row);
      logInfo('event', kind === 'summary' ? '写小结' : `追加过程记录(${row.triggerKind || '无触发源'})`);
      return row;
    },
    // 二次修改过程记录/小结:新值生效,旧值存入 edits 修订历史(改变要有记录)
    async editEntry(id, { content, triggerKind, triggerNote, at }) {
      const en = this.entries.find((x) => x.id === id && !x.deleted);
      if (!en) throw new Error('记录不存在');
      const text = String(content ?? en.content).trim();
      if (!text) throw new Error('内容不能为空');
      const next = {
        ...en,
        content: text,
        triggerKind: triggerKind !== undefined ? (TRIGGER_KINDS.includes(triggerKind) ? triggerKind : '') : en.triggerKind,
        triggerNote: triggerNote !== undefined ? String(triggerNote).trim() : en.triggerNote,
        at: at ?? en.at,
        edits: [...(en.edits || []), { at: Date.now(), content: en.content, triggerKind: en.triggerKind || '', triggerNote: en.triggerNote || '' }],
      };
      await putRow('eventEntries', next);
      logInfo('event', '修改过程记录(已留痕)');
      return next;
    },
    // 过程记录改挂线索:选错线索时移到另一条(内容/时间/触发源原样保留,旧值入修订历史)
    async moveEntry(id, newEventId) {
      const en = this.entries.find((x) => x.id === id && !x.deleted);
      if (!en) throw new Error('记录不存在');
      if (en.eventId === newEventId) return en;
      const { db } = await import('../db/schema.js');
      const ev = await db.events.get(newEventId);
      if (!ev || ev.deleted) throw new Error('目标线索不存在');
      const next = {
        ...en,
        eventId: newEventId,
        edits: [...(en.edits || []), { at: Date.now(), content: en.content, triggerKind: en.triggerKind || '', triggerNote: en.triggerNote || '', movedFrom: en.eventId }],
      };
      await putRow('eventEntries', next);
      logInfo('event', '过程记录移至其他线索(已留痕)');
      return next;
    },
    // 过程记录标记处理:通用三态(未处理/已处理/有问题)+结果说明,变更写 statusHistory 留痕
    async setEntryHandle(id, status, note = '') {
      const en = this.entries.find((x) => x.id === id && !x.deleted);
      if (!en) throw new Error('记录不存在');
      if (!HANDLE_STATUSES.includes(status)) throw new Error('未知的处理状态');
      const text = String(note || '').trim();
      const from = en.handleStatus || 'pending';
      const next = {
        ...en,
        handleStatus: status,
        handleNote: text,
        handledAt: status === 'pending' ? null : Date.now(),
        statusHistory: [...(en.statusHistory || []), { at: Date.now(), from, to: status, note: text }],
      };
      await putRow('eventEntries', next);
      const idx = this.entries.findIndex((x) => x.id === id);
      if (idx >= 0) this.entries[idx] = next;
      logInfo('event', `过程记录处理状态 → ${status}${text ? `:${text.slice(0, 20)}` : ''}`);
      return next;
    },
    async removeEntry(id) {
      await softDelete('eventEntries', id);
    },
    // 线索状态流转:进行中/已完结/已搁置/有问题(0.8.0) —— 纯手动,过程全保留
    // 状态变更写 statusHistory 留痕;完结/有问题时填了说明,自动落一条过程记录(处理结果进过程时间线)
    async setThreadState(id, state, note = '') {
      const ev = this.byId(id);
      if (!ev || !THREAD_STATES.includes(state)) return;
      const text = String(note || '').trim();
      const from = ev.threadState || 'open';
      const next = {
        ...ev,
        threadState: state,
        handleNote: text || (state === 'open' ? '' : ev.handleNote || ''),
        statusHistory: [...(ev.statusHistory || []), { at: Date.now(), from, to: state, note: text }],
      };
      await putRow('events', next);
      // 同步进内存状态:onChange→load 是异步的,紧随其后的读写不等它(同 addEntry 的取舍)
      const idx = this.events.findIndex((x) => x.id === id);
      if (idx >= 0) this.events[idx] = next;
      const label = THREAD_STATE_META[state]?.label || state;
      logInfo('event', `线索状态 → ${label}${text ? `:${text.slice(0, 20)}` : ''}`);
      if (text && ['done', 'issue'].includes(state)) {
        await this.addEntry({
          eventId: id,
          content: `状态 → ${label}${text ? ':' + text : ''}`,
          kind: 'record',
        });
      }
      return next;
    },
  },
});
