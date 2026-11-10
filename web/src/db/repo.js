// 数据仓库层：所有本地写入的必经之路 —— 写 IndexedDB + 进 outbox 队列 + 通知订阅者刷新
import { db } from './schema.js';
import { shouldReplace } from './merge.js';
import { uuid } from '../lib/util.js';

const listeners = new Set();
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 本地写入钩子：enqueue（本地写）后触发，供同步层接线"写后防抖上推"。
// 独立于 onChange（那会连 adoptRow 拉取写入一起通知）——避免拉→推循环。
// 不直接 import sync.js：sync.js 依赖本模块，反向引用会造成环依赖。
let writeHook = null;
export function setWriteHook(fn) {
  writeHook = typeof fn === 'function' ? fn : null;
}

let scheduled = false;
function bump() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
  });
}

export const tableOf = (table) => db[table];

async function enqueue(table, row) {
  const key = `${table}:${row.id}`;
  await db.transaction('rw', db.outbox, async () => {
    // 合并同一实体的历史待推条目，只推最新状态
    await db.outbox.where('key').equals(key).delete();
    await db.outbox.add({ key, table, row });
  });
  try {
    writeHook?.();
  } catch {}
}

// Vue reactive Proxy 无法被 IndexedDB structuredClone（store 里读出的行是深层代理）。
// 字段均为可序列化标量/数组/对象，JSON 往返是安全的纯化方式。
function toPlain(row) {
  return row == null || typeof row !== 'object' ? row : JSON.parse(JSON.stringify(row));
}

// 本地编辑：盖当前时间戳并待同步
export async function putRow(table, row) {
  const r = toPlain({ ...row, updatedAt: Date.now(), deleted: row.deleted ? 1 : 0 });
  await tableOf(table).put(r);
  await enqueue(table, r);
  bump();
  return r;
}

export async function softDelete(table, id) {
  const row = await tableOf(table).get(id);
  if (!row) return;
  await putRow(table, { ...row, deleted: 1 });
}

// —— JSON 列同步规范化 ——
// 本地以原生数组/对象存储；服务端 SQLite 以 JSON 字符串列存储（server/src/db.js JSON_COLS）。
// 拉取/导入的行在采纳前反序列化回来；失败或空值回落到该列的空态。
const JSON_DEFAULTS = {
  subjectIds: [],
  review: null,
  tags: [],
  topReasons: [],
  basis: null,
  criteria: null,
  result: null,
  lockSnapshot: null,
  refEvents: [],
  refPredictions: [],
};

export const JSON_COLS = {
  events: ['subjectIds', 'review'],
  subjects: ['tags', 'topReasons'],
  thoughts: [],
  predictions: ['basis', 'criteria', 'result', 'lockSnapshot'],
  rules: ['refEvents', 'refPredictions'],
};

export function normalizeRow(table, row) {
  const cols = JSON_COLS[table];
  if (!cols || !row) return row;
  const r = { ...row };
  for (const c of cols) {
    const v = r[c];
    if (typeof v === 'string') {
      try {
        r[c] = JSON.parse(v);
      } catch {
        r[c] = JSON_DEFAULTS[c] ?? null;
      }
    } else if (v == null) {
      r[c] = JSON_DEFAULTS[c] ?? null;
    }
  }
  return r;
}

// 采纳一条远端/导入行（保留其 updatedAt 参与 LWW）；push=true 时推送（导入场景）
export async function adoptRow(table, row, { push = false } = {}) {
  if (!row || !row.id) return false;
  const local = await tableOf(table).get(row.id);
  if (!shouldReplace(local, row)) return false;
  const r = normalizeRow(table, { ...row, deleted: row.deleted ? 1 : 0 });
  await tableOf(table).put(r);
  if (push) await enqueue(table, r);
  bump();
  return true;
}

// —— 查询辅助（个人量级，内存过滤足够） ——
export const getCategories = () => db.categories.toArray();
export const getSubjects = () => db.subjects.toArray();
export const getAllThoughts = () => db.thoughts.toArray();
export const getAllPredictions = () => db.predictions.toArray();
export const getAllRules = () => db.rules.toArray();

export const getAllEvents = () => db.events.filter((e) => !e.deleted).toArray();

// 事件归属其 startAt 所在时段（时间线按天分组用）
export const getEventsBetween = (start, end) =>
  db.events
    .where('startAt')
    .between(start, end, true, true)
    .and((e) => !e.deleted)
    .toArray();

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value });
}

export { uuid };
