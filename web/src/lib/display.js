// 展示层视觉映射:记录类型 → 图标+专属色;触发源 → 图标
// 纯函数,无存储依赖;颜色为 6 位 hex,便于组件用 alpha 后缀做深浅色兼容的着色
export const KIND_META = {
  想法: { icon: '💡', color: '#4f6ef7' },
  事实: { icon: '📌', color: '#34c273' },
  感想: { icon: '💭', color: '#f5a623' },
  灵感: { icon: '⚡', color: '#7c4dff' },
  疑问: { icon: '❓', color: '#00b8d4' },
  判断: { icon: '⚖️', color: '#ee5a5a' },
  决策: { icon: '🎯', color: '#1e88e5' },
  观察: { icon: '👁️', color: '#98a2b3' },
  记录: { icon: '📝', color: '#8f9bb3' },
  小结: { icon: '✦', color: '#4f6ef7' },
};

export const kindMeta = (k) => KIND_META[k] || { icon: '📝', color: '#8f9bb3' };

export const TRIGGER_ICON = {
  事情: '📌',
  视频: '🎬',
  文章: '📄',
  人: '👤',
  对话: '💬',
  场景: '📍',
  灵感: '⚡',
  其他: '✳️',
};

// source 字段两种形态:「由X触发:说明」(带类型) / 纯说明文本(无类型)
export function parseTrigger(source) {
  const s = String(source || '').trim();
  if (!s) return null;
  const m = s.match(/^由(.+?)触发(?::([\s\S]*))?$/);
  if (m) return { icon: TRIGGER_ICON[m[1]] || '✳️', text: s };
  return { icon: '💭', text: s };
}
