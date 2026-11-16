// 领域 store:自定义词表(Vocab)——用户自建的记录类型与触发源,与内置常量合并展示
// type='kind' 记录类型 / 'trigger' 触发源;行可带 icon/color;随云端同步
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllVocab, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { KIND_META, TRIGGER_ICON } from '../lib/display.js';

export const VOCAB_TYPES = ['kind', 'trigger'];

export const useVocabStore = defineStore('vocab', {
  state: () => ({ rows: [], loaded: false }),
  getters: {
    active: (s) => s.rows.filter((x) => !x.deleted),
    byType() {
      return (type) => this.active.filter((x) => x.type === type).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    },
    byId: (s) => (id) => s.rows.find((x) => x.id === id),
    nextSort() {
      return (type) => {
        const list = this.byType(type);
        return list.length ? Math.max(...list.map((x) => x.sort || 0)) + 10 : 10;
      };
    },
    // —— 视觉映射:内置表优先,自定义行补位(未知名兜底 📝 灰 / ✳️) ——
    kindMetaOf: (s) => (k) => {
      if (KIND_META[k]) return KIND_META[k];
      const row = s.rows.find((x) => !x.deleted && x.type === 'kind' && x.name === k);
      return { icon: row?.icon || '📝', color: row?.color || '#8f9bb3' };
    },
    triggerIconOf: (s) => (k) => {
      if (TRIGGER_ICON[k]) return TRIGGER_ICON[k];
      const row = s.rows.find((x) => !x.deleted && x.type === 'trigger' && x.name === k);
      return row?.icon || '✳️';
    },
    // 合并后的完整候选列表(内置在前,自定义按 sort)
    kinds() {
      return [...Object.keys(KIND_META).filter((k) => !['记录', '小结'].includes(k)), ...this.byType('kind').map((x) => x.name)];
    },
    triggers() {
      return [...Object.keys(TRIGGER_ICON), ...this.byType('trigger').map((x) => x.name)];
    },
  },
  actions: {
    async load() {
      this.rows = await getAllVocab();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 新建/改名/换图标色;同类型同名查重
    async save({ id, type, name, color, icon }) {
      const t = String(name || '').trim();
      if (!t) throw new Error('名称不能为空');
      if (!VOCAB_TYPES.includes(type)) throw new Error('未知的词表类型');
      const dup = this.active.find((x) => x.type === type && x.name === t && x.id !== id);
      if (dup) throw new Error(`已有同名${type === 'kind' ? '类型' : '触发源'}「${t}」`);
      let row;
      if (id) {
        const exists = await dbGet('vocab', id);
        if (!exists || exists.deleted) throw new Error('词表项不存在');
        row = { ...exists, name: t, color: color || exists.color, icon: icon || exists.icon };
      } else {
        row = {
          id: uuid(),
          type,
          name: t,
          color: color || '',
          icon: icon || (type === 'kind' ? '📝' : '✳️'),
          sort: this.nextSort(type),
          createdAt: Date.now(),
        };
      }
      await putRow('vocab', row);
      const i = this.rows.findIndex((x) => x.id === row.id);
      if (i >= 0) this.rows[i] = row;
      else this.rows.push(row);
      logInfo('vocab', `${id ? '更新' : '新建'}自定义${type === 'kind' ? '类型' : '触发源'}「${t}」`);
      return row;
    },
    async remove(id) {
      const row = this.byId(id);
      await softDelete('vocab', id);
      this.rows = this.rows.filter((x) => x.id !== id);
      logInfo('vocab', `删除自定义词表项「${row?.name || id}」(已有记录不受影响,原样展示)`);
    },
    // 上移/下移:交换相邻 sort
    async moveUpDown(id, dir) {
      const f = this.byId(id);
      if (!f) return;
      const list = this.byType(f.type);
      const idx = list.findIndex((x) => x.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      await putRow('vocab', { ...f, sort: swap.sort || 0 });
      await putRow('vocab', { ...swap, sort: f.sort || 0 });
      await this.load();
    },
  },
});

// 兜底直查(写路径读旧行;与 event.js addEntry 同一取舍)
async function dbGet(table, id) {
  const { db } = await import('../db/schema.js');
  return db[table].get(id);
}
