// 领域 store：事件管理（状态与业务规则在此，UI 只消费）
// 规则：进行中的事件同一时刻只允许一个（串行原则，复用 MyTime 验证过的模式）
import { defineStore } from 'pinia';
import { getEventsBetween, putRow, getAllEvents, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';

export const useEventStore = defineStore('event', {
  state: () => ({ events: [], loaded: false }),
  getters: {
    running: (s) => s.events.find((e) => e.endAt == null && !e.deleted) || null,
    upcoming: (s) =>
      s.events
        .filter((e) => !e.deleted && e.startAt > Date.now())
        .sort((a, b) => a.startAt - b.startAt),
    recent: (s) =>
      s.events
        .filter((e) => !e.deleted && e.endAt != null)
        .sort((a, b) => b.startAt - a.startAt),
  },
  actions: {
    async load() {
      this.events = await getAllEvents();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 开始一个事件（串行守卫：已有进行中的则拒绝）
    async start({ title, categoryId, location, note }) {
      if (this.running) throw new Error('已有进行中的事件，请先结束');
      const ev = {
        id: uuid(),
        title: (title || '').trim() || '未命名事件',
        categoryId,
        location: location || '',
        note: note || '',
        startAt: Date.now(),
        endAt: null,
        createdAt: Date.now(),
      };
      await putRow('events', ev);
      logInfo('event', `开始事件「${ev.title}」`);
      return ev;
    },
    // 补录一个已完成的事件
    async add({ title, categoryId, location, note, startAt, endAt }) {
      if (!title?.trim()) throw new Error('请填写事件名称');
      const ev = {
        id: uuid(),
        title: title.trim(),
        categoryId,
        location: location || '',
        note: note || '',
        startAt,
        endAt,
        createdAt: Date.now(),
      };
      await putRow('events', ev);
      logInfo('event', `补录事件「${ev.title}」`);
      return ev;
    },
    async finishCurrent(note) {
      const ev = this.running;
      if (!ev) return null;
      await putRow('events', { ...ev, endAt: Date.now(), ...(note ? { note } : {}) });
      logInfo('event', `结束事件「${ev.title}」`);
      return ev;
    },
    async remove(id) {
      const { softDelete } = await import('../db/repo.js');
      await softDelete('events', id);
      logInfo('event', '删除事件');
    },
  },
});
