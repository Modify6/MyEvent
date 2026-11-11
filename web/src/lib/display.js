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

// —— 对象/线索列表的视觉锚点 ——
// 对象类型 → 专属色(标签用)
export const SUBJECT_TYPE_COLOR = {
  人: '#34c273',
  项目: '#4f6ef7',
  公司: '#f5a623',
  投资标的: '#7c4dff',
  关系: '#ff9d5c',
  主题: '#00b8d4',
  决策: '#ee5a5a',
};
export const typeColor = (t) => SUBJECT_TYPE_COLOR[t] || '#98a2b3';

// 头像色:按 id 稳定散列到调色板(同一对象永远同色)
const AVATAR_PALETTE = ['#4f6ef7', '#7c4dff', '#34c273', '#f5a623', '#00b8d4', '#ee5a5a', '#ff9d5c', '#1e88e5'];
export function avatarColor(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
