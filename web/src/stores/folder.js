// 文件夹领域 store:对象与线索各自的自定义文件夹组(名称/颜色/排序)
// 内容挂 folderId(空 = 未分类);删除文件夹时内容回落未分类,不删除内容
import { defineStore } from 'pinia';
import { db } from '../db/schema.js';
import { getAllFolders, putRow, softDelete, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';

const TABLE_OF = { subject: 'subjects', event: 'events' };

export const useFolderStore = defineStore('folder', {
  state: () => ({ folders: [], loaded: false }),
  getters: {
    active: (s) => s.folders.filter((x) => !x.deleted),
    byScope() {
      return (scope) => this.active.filter((x) => x.scope === scope).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    },
    byId: (s) => (id) => s.folders.find((x) => x.id === id),
    nextSort() {
      return (scope) => {
        const list = this.byScope(scope);
        return list.length ? Math.max(...list.map((x) => x.sort || 0)) + 10 : 10;
      };
    },
  },
  actions: {
    async load() {
      this.folders = await getAllFolders();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 新建/重命名/换色(新建时 sort 追加末位);返回实际写入的行
    async save({ id, name, color, scope }) {
      const n = String(name || '').trim();
      if (!n) throw new Error('请填写文件夹名称');
      let row;
      if (id) {
        row = await db.folders.get(id);
        if (!row || row.deleted) throw new Error('文件夹不存在');
        row = { ...row, name: n, color: color || row.color };
        logInfo('folder', `更新文件夹「${n}」`);
      } else {
        row = {
          id: uuid(),
          name: n,
          color: color || '#4f6ef7',
          scope,
          sort: this.nextSort(scope),
          createdAt: Date.now(),
        };
        logInfo('folder', `新建文件夹「${n}」`);
      }
      await putRow('folders', row);
      await this.load();
      return row;
    },
    // 删除文件夹:内容回落未分类(folderId 置空),不删除内容
    async remove(id) {
      const f = await db.folders.get(id);
      if (!f || f.deleted) return;
      const table = TABLE_OF[f.scope];
      const rows = await db[table].where('folderId').equals(id).toArray();
      for (const r of rows) await putRow(table, { ...r, folderId: '' });
      await softDelete('folders', id);
      await this.load();
      logInfo('folder', `删除文件夹「${f.name}」,内容已回落未分类`);
    },
    // 上移/下移:交换相邻 sort
    async moveUpDown(id, dir) {
      const f = await db.folders.get(id);
      if (!f || f.deleted) return;
      const list = this.active.filter((x) => x.scope === f.scope).sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const idx = list.findIndex((x) => x.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      await putRow('folders', { ...f, sort: swap.sort || 0 });
      await putRow('folders', { ...swap, sort: f.sort || 0 });
      await this.load();
    },
    // 批量重排:按数组顺序写 sort(管理弹层拖拽预留)
    async reorder(orderedIds) {
      for (let i = 0; i < orderedIds.length; i++) {
        const f = await db.folders.get(orderedIds[i]);
        if (f && !f.deleted && (f.sort || 0) !== i * 10) await putRow('folders', { ...f, sort: i * 10 });
      }
      await this.load();
    },
    // 内容移入文件夹(folderId 为空 = 移出未分类);table 由 scope 映射
    async moveItem(scope, itemId, folderId) {
      const table = TABLE_OF[scope];
      if (!table) throw new Error('未知的归属域');
      const row = await db[table].get(itemId);
      if (!row) throw new Error('内容不存在');
      await putRow(table, { ...row, folderId: folderId || '' });
      logInfo('folder', folderId ? '已移入文件夹' : '已移出文件夹');
      return row;
    },
  },
});
