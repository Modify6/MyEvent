// 认知复盘领域规则（纯函数，无 UI / 存储依赖）——单测覆盖见 tests/domain.test.js

// —— 枚举常量 ——
export const EVENT_STATUS_LABELS = { inbox: '待复盘', pending: '复盘中', reviewed: '已复盘' };

export const SUBJECT_TYPES = ['人', '项目', '公司', '投资标的', '关系', '主题', '决策'];
export const THOUGHT_KINDS = ['观察', '假设', '判断', '疑问', '情绪', '灵感', '决策'];
export const PREDICTION_KINDS = ['结果型', '数值型', '时间型', '行为型', '自我型'];

export const PREDICTION_STATUS_LABELS = {
  draft: '草稿',
  locked: '进行中',
  verifying: '待验证',
  hit: '命中',
  partial: '部分命中',
  miss: '错误',
  unverifiable: '无法验证',
  abandoned: '已放弃',
};
// 有明确结果的终态（校准统计只计这些）
export const PREDICTION_VERIFIED = ['hit', 'partial', 'miss'];

// 进行中核心预判上限（防跟踪过载，设计方案 §7）
export const MAX_ACTIVE_PREDICTIONS = 15;

// 验证时可选的偏差原因 / 链路弱环节（设计方案 5.5 / 5.7）
export const BIAS_REASONS = ['信息不足', '过度自信', '忽略反证', '情绪干扰', '时间估计错误', '外部意外'];
export const CHAIN_STEPS = ['事实', '假设', '规则', '推理跳跃'];

// —— 事件复盘 ——

// 复盘完成标准（设计方案 5.1）：必须有「预期 vs 实际」对比 + 合格的「下次规则」
export function isReviewComplete(review) {
  if (!review) return false;
  const hasExpect = !!String(review.expect || '').trim();
  const hasActual = !!String(review.actual || '').trim();
  return hasExpect && hasActual && validateRuleText(review.nextRule).ok;
}

// 「下次规则」校验：必须可执行可检验——「如果 X,则 Y」句式，且 Y 不是空泛态度词
const VAGUE_WORDS = ['冷静', '细心', '认真', '努力', '加油', '用心', '注意', '小心', '坚持', '谨慎', '耐心', '专注'];

export function validateRuleText(text) {
  const t = String(text || '').trim();
  if (!t) return { ok: false, msg: '必填：下次遇到相似场景的行动规则' };
  const m = t.match(/如果(.+?)[,，。;；]?\s*(?:则|就)(.+)/);
  if (!m) return { ok: false, msg: '请用「如果 X，则 Y」句式，让规则可执行' };
  // 剥掉语气词与空泛态度词后，Y 里得剩下可检验的具体动作
  let y = m[2].replace(/[。,，\s]/g, '').replace(/[要更先再后多应该需必须尽]/g, '');
  for (const w of VAGUE_WORDS) y = y.replaceAll(w, '');
  if (y.length < 2) return { ok: false, msg: '「则」之后是空泛态度词，改成可检验的具体动作' };
  return { ok: true, msg: '' };
}

// —— 预判 ——

// 展示用有效状态：已锁定且过了验证窗口截止 → 待验证
export function predictionEffectiveStatus(p, now = Date.now()) {
  if (p?.status === 'locked' && Number(p?.windowEnd) <= now) return 'verifying';
  return p?.status || 'draft';
}

// 预判可否进入验证（已锁定且未到终态）
export function isPredictionOpen(p) {
  return !!p && p.status === 'locked';
}

// 置信度分桶命中率：已验证预判按原始置信度分桶；hit=1、partial=0.5、miss=0
// 返回 [{label, n, rate, ideal}]，rate/ideal 为百分比；rate 为 null 表示该桶无样本；ideal = 桶区间中点（完美校准位置）
export function calibrationBuckets(predictions) {
  const defs = [{ lo: 0, hi: 50, label: '<50%' }];
  for (let lo = 50; lo < 100; lo += 10) defs.push({ lo, hi: lo + 10, label: `${lo}-${lo + 10}%` });
  const buckets = defs.map((d) => ({ ...d, n: 0, score: 0 }));
  for (const p of predictions || []) {
    if (!PREDICTION_VERIFIED.includes(p?.status)) continue;
    const c = Number(p.origConfidence);
    if (!Number.isFinite(c)) continue;
    const idx = c < 50 ? 0 : Math.min(Math.floor(c / 10) - 4, buckets.length - 1);
    buckets[idx].n += 1;
    buckets[idx].score += p.status === 'hit' ? 1 : p.status === 'partial' ? 0.5 : 0;
  }
  return buckets.map((b) => ({
    label: b.label,
    n: b.n,
    rate: b.n ? Math.round((b.score / b.n) * 100) : null,
    ideal: Math.round((b.lo + b.hi) / 2),
  }));
}

// —— 通用 ——

// 数值安全取值（滑条/表单兜底）
export const clampPct = (v, fallback = null) => {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
};
