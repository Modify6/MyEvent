// 领域 store：对象（Subject）——人/项目/公司/投资标的等长期关注单元
// 对象页顶部维护「当前观点快照」：当前判断/置信度/核心理由/最大反证/开放问题/下次回顾
import { defineStore } from 'pinia';
import { putRow, softDelete, getSubjects, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { clampPct } from '../lib/domain.js';

export const useSubjectStore = defineStore('subject', {
  state: () => ({ subjects: [], loaded: false }),
  getters: {
    active: (s) => s.subjects.filter((x) => !x.deleted).sort((a, b) => b.updatedAt - a.updatedAt),
    byId: (s) => (id) => s.subjects.find((x) => x.id === id),
    // 名称查询（表单选择器/搜索用）
    nameOf() {
      return (id) => (id ? this.byId(id)?.name || '未知对象' : '');
    },
  },
  actions: {
    async load() {
      this.subjects = await getSubjects();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 创建或整体保存（含当前观点快照字段）
    async save(data) {
      const name = String(data.name || '').trim();
      if (!name) throw new Error('请填写对象名称');
      const exists = data.id ? this.subjects.find((x) => x.id === data.id) : null;
      const row = {
        id: exists?.id || uuid(),
        name,
        type: data.type || '主题',
        tags: (data.tags || []).map((t) => String(t).trim()).filter(Boolean),
        currentView: String(data.currentView || '').trim(),
        currentConfidence: clampPct(data.currentConfidence),
        topReasons: (data.topReasons || []).map((t) => String(t).trim()).filter(Boolean).slice(0, 5),
        biggestRisk: String(data.biggestRisk || '').trim(),
        openQuestions: String(data.openQuestions || '').trim(),
        nextReviewAt: data.nextReviewAt || null,
        folderId: data.folderId ?? exists?.folderId ?? '',
        createdAt: exists?.createdAt || Date.now(),
      };
      await putRow('subjects', row);
      logInfo('subject', `${exists ? '更新' : '新建'}对象「${name}」`);
      return row;
    },
    async remove(id) {
      await softDelete('subjects', id);
      logInfo('subject', '删除对象');
    },
  },
});
