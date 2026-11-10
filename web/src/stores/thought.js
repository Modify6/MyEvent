// 领域 store:想法/随手记录(Thought)——过程记录驱动的核心实体
// 0.3.0:记录即完成,直接归档(收件箱概念移除);可挂对象/事件;可带触发源
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllThoughts, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { THOUGHT_KINDS, clampPct } from '../lib/domain.js';

export const useThoughtStore = defineStore('thought', {
  state: () => ({ thoughts: [], loaded: false }),
  getters: {
    active: (s) => s.thoughts.filter((t) => !t.deleted),
    byId: (s) => (id) => s.thoughts.find((t) => t.id === id),
    ofSubject: (s) => (sid) => s.thoughts.filter((t) => !t.deleted && t.subjectId === sid).sort((a, b) => b.at - a.at),
    ofEvent: (s) => (eid) => s.thoughts.filter((t) => !t.deleted && t.relatedEventId === eid).sort((a, b) => b.at - a.at),
  },
  actions: {
    async load() {
      this.thoughts = await getAllThoughts();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 随手记:内容必填,其余全可选 —— 3 秒记完即入库归档
    async quickAdd({ content, kind = '想法', subjectId = '', relatedEventId = '', confidence = null, source = '', basis = '', counter = '', at }) {
      const text = String(content || '').trim();
      if (!text) throw new Error('想记点什么？先写一句');
      const row = {
        id: uuid(),
        subjectId: subjectId || '',
        relatedEventId: relatedEventId || '',
        content: text,
        kind: THOUGHT_KINDS.includes(kind) ? kind : '想法',
        at: at || Date.now(),
        source: source || '',
        confidence: clampPct(confidence),
        basis: basis || '',
        counter: counter || '',
        parentThoughtId: null,
        relation: '',
        state: 'archived',
        createdAt: Date.now(),
      };
      await putRow('thoughts', row);
      logInfo('thought', `随手记一条(${row.kind})`);
      return row;
    },
    async remove(id) {
      await softDelete('thoughts', id);
    },
  },
});
