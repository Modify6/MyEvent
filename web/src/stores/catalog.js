// 场景标签 store：场景名/颜色查询（categories 表复用为场景标签库）
import { defineStore } from 'pinia';
import { getCategories, onChange } from '../db/repo.js';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({ categories: [], loaded: false }),
  getters: {
    active: (s) => s.categories.filter((c) => !c.deleted),
  },
  actions: {
    async load() {
      this.categories = await getCategories();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    catName(id) {
      return this.categories.find((c) => c.id === id)?.name || '未标记';
    },
    catColor(id) {
      return this.categories.find((c) => c.id === id)?.color || '#90A4AE';
    },
  },
});
