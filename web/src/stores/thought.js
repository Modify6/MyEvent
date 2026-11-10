// 领域 store：想法（Thought）——先 10 秒捕获进收件箱，每周整理：归入对象 / 合并 / 丢弃 / 升级预判
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllThoughts, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { THOUGHT_KINDS, clampPct } from '../lib/domain.js';

export const useThoughtStore = defineStore('thought', {
  state: () => ({ thoughts: [], loaded: false }),
  getters: {
    active: (s) => s.thoughts.filter((t) => !t.deleted),
    // 想法收件箱：尚未归档整理的
    inbox: (s) => s.thoughts.filter((t) => !t.deleted && t.state === 'inbox').sort((a, b) => b.at - a.at),
    archived: (s) => s.thoughts.filter((t) => !t.deleted && t.state === 'archived').sort((a, b) => b.at - a.at),
    byId: (s) => (id) => s.thoughts.find((t) => t.id === id),
    ofSubject: (s) => (sid) => s.thoughts.filter((t) => !t.deleted && t.subjectId === sid).sort((a, b) => b.at - a.at),
  },
  actions: {
    async load() {
      this.thoughts = await getAllThoughts();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 十秒快记：内容必填，其余可后补；从对象页记录时直接归档（state='archived'）不进收件箱
    async quickAdd({ content, kind = '观察', subjectId = '', confidence = null, source = '', basis = '', counter = '', at, state = 'inbox' }) {
      const text = String(content || '').trim();
      if (!text) throw new Error('想记点什么？先写一句');
      const row = {
        id: uuid(),
        subjectId: subjectId || '',
        content: text,
        kind: THOUGHT_KINDS.includes(kind) ? kind : '观察',
        at: at || Date.now(),
        source: source || '',
        confidence: clampPct(confidence),
        basis: basis || '',
        counter: counter || '',
        relatedEventId: null,
        parentThoughtId: null,
        relation: '',
        state: state === 'archived' ? 'archived' : 'inbox',
        createdAt: Date.now(),
      };
      await putRow('thoughts', row);
      logInfo('thought', `记录想法(${row.kind})`);
      return row;
    },
    // 编辑（整理收件箱时补对象/类型/置信度等）
    async patch(id, data) {
      const t = this.byId(id);
      if (!t) return null;
      const next = { ...t, ...data, id: t.id };
      if (next.confidence != null) next.confidence = clampPct(next.confidence);
      await putRow('thoughts', next);
      return next;
    },
    // 归档整理：指定对象（可为空）后离开收件箱
    async archive(id, subjectId) {
      const t = this.byId(id);
      if (!t) return;
      await putRow('thoughts', { ...t, subjectId: subjectId ?? t.subjectId, state: 'archived' });
      logInfo('thought', '想法已归档');
    },
    // 升级为预判：返回预填数据（由 PredictionComposer 接管）
    toPredictionDraft(t) {
      return {
        subjectId: t?.subjectId || '',
        content: t?.content || '',
        origConfidence: t?.confidence ?? null,
      };
    },
    async remove(id) {
      await softDelete('thoughts', id);
    },
  },
});
