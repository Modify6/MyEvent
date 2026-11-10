// 领域 store：经验规则（Rule）——「如果 X，则 Y」的可复用行动规则
// 来源：事件复盘沉淀 / 预判验证沉淀 / 手动创建；周期回顾检查有效性
import { defineStore } from 'pinia';
import { putRow, softDelete, getAllRules, onChange } from '../db/repo.js';
import { uuid } from '../lib/util.js';
import { logInfo } from '../lib/logger.js';
import { validateRuleText } from '../lib/domain.js'; // 仅用于 RuleComposer 的引导提示,不再强制

export const useRuleStore = defineStore('rule', {
  state: () => ({ rules: [], loaded: false }),
  getters: {
    active: (s) => s.rules.filter((r) => !r.deleted).sort((a, b) => b.updatedAt - a.updatedAt),
    byId: (s) => (id) => s.rules.find((r) => r.id === id),
    // 关联某对象的规则（通过复盘/预判的引用关系）
    ofSubjectIds() {
      return (eventIds = [], predictionIds = []) =>
        this.active.filter(
          (r) =>
            (r.refEvents || []).some((id) => eventIds.includes(id)) ||
            (r.refPredictions || []).some((id) => predictionIds.includes(id))
        );
    },
  },
  actions: {
    async load() {
      this.rules = await getAllRules();
      this.loaded = true;
    },
    watch() {
      return onChange(() => this.load());
    },
    // 创建规则（内容自由;「如果X则Y」句式仅作引导,不强制 —— 总结水到渠成）；refEvents/refPredictions 记录来源
    async create({ scene, trigger, content, reason = '', counterEx = '', refEvents = [], refPredictions = [] }) {
      if (!String(content || '').trim()) throw new Error('请写下规则内容');
      const row = {
        id: uuid(),
        scene: String(scene || '').trim(),
        trigger: String(trigger || '').trim(),
        content: String(content).trim(),
        reason: reason || '',
        counterEx: counterEx || '',
        refEvents: refEvents.filter(Boolean),
        refPredictions: refPredictions.filter(Boolean),
        verifyCount: 0,
        validity: 'pending',
        lastVerifiedAt: null,
        createdAt: Date.now(),
      };
      await putRow('rules', row);
      logInfo('rule', `沉淀规则「${row.content.slice(0, 24)}」`);
      return row;
    },
    async patch(id, data) {
      const r = this.byId(id);
      if (!r) return null;
      if (data.content != null) {
        const check = validateRuleText(data.content);
        if (!check.ok) throw new Error(check.msg);
      }
      await putRow('rules', { ...r, ...data, id: r.id });
      return r;
    },
    // 登记一次使用验证：有效/无效
    async bumpVerify(id, valid) {
      const r = this.byId(id);
      if (!r) return;
      await putRow('rules', {
        ...r,
        verifyCount: (r.verifyCount || 0) + 1,
        validity: valid ? 'valid' : 'invalid',
        lastVerifiedAt: Date.now(),
      });
      logInfo('rule', `规则验证标记: ${valid ? '有效' : '无效'}`);
    },
    async remove(id) {
      await softDelete('rules', id);
    },
  },
});
