// 领域 store:图片附件(Image)——挂在记录(thoughts)或过程记录(eventEntries)下
// 行存 base64 压缩图(data),随 outbox → /api/sync 上云;ownerTable+ownerId 定位归属
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllImages, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';

export const OWNER_TABLES = ['thoughts', 'eventEntries'];

export const useImageStore = defineStore('image', {
  state: () => ({ images: [], loaded: false }),
  getters: {
    active: (s) => s.images.filter((x) => !x.deleted),
    byOwner() {
      return (ownerTable, ownerId) =>
        this.active
          .filter((x) => x.ownerTable === ownerTable && x.ownerId === ownerId)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0) || (a.createdAt || 0) - (b.createdAt || 0));
    },
    byId: (s) => (id) => s.images.find((x) => x.id === id),
    countOf() {
      return (ownerTable, ownerId) => this.byOwner(ownerTable, ownerId).length;
    },
  },
  actions: {
    async load() {
      this.images = await getAllImages();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 保存压缩图(base64 dataURL);ownerTable 限 thoughts/eventEntries
    async save({ ownerTable, ownerId, data, w = 0, h = 0 }) {
      if (!OWNER_TABLES.includes(ownerTable)) throw new Error('未知的图片归属');
      if (!ownerId) throw new Error('缺少挂靠的记录');
      if (!String(data || '').startsWith('data:image/')) throw new Error('图片数据无效');
      const row = {
        id: uuid(),
        ownerTable,
        ownerId,
        data: String(data),
        w: Number(w) || 0,
        h: Number(h) || 0,
        sort: this.byOwner(ownerTable, ownerId).length,
        createdAt: Date.now(),
      };
      await putRow('images', row);
      upsertLocal(this.images, row);
      logInfo('image', `保存附件图(${ownerTable})`);
      return row;
    },
    async remove(id) {
      const row = this.byId(id);
      if (!row) return;
      await softDelete('images', id);
      upsertLocal(this.images, { ...row, deleted: 1 });
      logInfo('image', '删除附件图');
    },
  },
});

// 与 onChange→load 竞序,按 id replace-or-push 防重复
function upsertLocal(list, row) {
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
}
