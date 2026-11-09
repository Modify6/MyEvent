// 分类 store：分类名/颜色查询（通用件，继承自 MyTime 模式）
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
      return this.categories.find((c) => c.id === id)?.name || '未分类';
    },
    catColor(id) {
      return this.categories.find((c) => c.id === id)?.color || '#90A4AE';
    },
  },
});
