export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // 老环境兜底
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// store 乐观更新专用:写库后同步内存,按 id replace-or-push
// (onChange→load 是异步的且与 push 竞序——直接 push 在 load 先完成时会重复,直接 replace 在 load 未跑时丢失)
export function upsertById(list, row) {
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
  return row;
}

