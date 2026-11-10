// 数据层：node:sqlite（Node 内置，无原生依赖）
// 所有表共享同步字段：id / updatedAt(客户端逻辑时钟，用于 LWW) / serverRev(服务端接收时间，用于增量拉取) / deleted(软删)
// JSON_COLS：数组/对象列以 JSON 字符串存储，客户端 repo.normalizeRow 负责反序列化
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TABLES = {
  categories: ['id', 'name', 'color', 'sort', 'createdAt', 'updatedAt', 'deleted'],
  events: [
    'id', 'title', 'categoryId', 'subjectIds', 'fact', 'status', 'review', 'location', 'note',
    'startAt', 'endAt', 'reviewedAt', 'ruleId', 'createdAt', 'updatedAt', 'deleted',
  ],
  subjects: [
    'id', 'name', 'type', 'tags', 'currentView', 'currentConfidence', 'topReasons', 'biggestRisk',
    'openQuestions', 'nextReviewAt', 'createdAt', 'updatedAt', 'deleted',
  ],
  thoughts: [
    'id', 'subjectId', 'content', 'kind', 'at', 'source', 'confidence', 'basis', 'counter',
    'relatedEventId', 'parentThoughtId', 'relation', 'state', 'createdAt', 'updatedAt', 'deleted',
  ],
  predictions: [
    'id', 'subjectId', 'content', 'kind', 'madeAt', 'windowStart', 'windowEnd', 'origConfidence',
    'basis', 'counterSignals', 'criteria', 'status', 'lockedAt', 'lockSnapshot', 'result', 'verifiedAt',
    'createdAt', 'updatedAt', 'deleted',
  ],
  rules: [
    'id', 'scene', 'trigger', 'content', 'reason', 'counterEx', 'refEvents', 'refPredictions',
    'verifyCount', 'validity', 'lastVerifiedAt', 'createdAt', 'updatedAt', 'deleted',
  ],
  eventEntries: [
    'id', 'eventId', 'kind', 'content', 'triggerKind', 'triggerNote', 'at', 'createdAt', 'updatedAt', 'deleted',
  ],
};

const INT_COLS = new Set([
  'sort', 'createdAt', 'updatedAt', 'deleted', 'startAt', 'endAt', 'reviewedAt',
  'currentConfidence', 'nextReviewAt', 'at', 'confidence',
  'madeAt', 'windowStart', 'windowEnd', 'origConfidence', 'lockedAt', 'verifiedAt',
  'verifyCount', 'lastVerifiedAt',
]);

// 以 JSON 字符串存储的数组/对象列（与 web/src/db/repo.js JSON_COLS 对应，白名单交集为准）
const JSON_COLS = new Set([
  'subjectIds', 'review', 'tags', 'topReasons',
  'basis', 'criteria', 'result', 'lockSnapshot', 'refEvents', 'refPredictions',
]);

// 业务表（TABLES 全集）；建表列后缀（核心列 NOT NULL，业务列宽松以便 ALTER 补列语义一致）
const NOT_NULL_COLS = new Set(['id', 'updatedAt']);

function createTableSql(table, cols) {
  const defs = cols
    .map((c) => {
      const type = INT_COLS.has(c) ? 'INTEGER' : 'TEXT';
      if (c === 'id') return `"id" TEXT PRIMARY KEY`;
      if (NOT_NULL_COLS.has(c)) return `"${c}" ${type} NOT NULL DEFAULT ${type === 'INTEGER' ? 0 : "''"}`;
      return `"${c}" ${type} DEFAULT NULL`;
    })
    .concat(['"serverRev" INTEGER NOT NULL DEFAULT 0']);
  return `CREATE TABLE IF NOT EXISTS "${table}" (${defs.join(', ')})`;
}

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  // 一次性迁移（MyTime 时期）：mytime.db → myevent.db，主文件与 WAL/SHM 边车一起改名，内容无损
  const newMain = path.join(dataDir, 'myevent.db');
  const oldMain = path.join(dataDir, 'mytime.db');
  if (!fs.existsSync(newMain) && fs.existsSync(oldMain)) {
    for (const suffix of ['', '-wal', '-shm']) {
      const from = oldMain + suffix;
      if (fs.existsSync(from)) fs.renameSync(from, newMain + suffix);
    }
    console.log('已迁移历史数据库 mytime.db → myevent.db');
  }
  const db = new DatabaseSync(newMain);
  db.exec('PRAGMA journal_mode = WAL;');
  for (const [table, cols] of Object.entries(TABLES)) {
    db.exec(createTableSql(table, cols));
    db.exec(`CREATE INDEX IF NOT EXISTS "idx_${table}_rev" ON "${table}"("serverRev")`);
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_start ON events("startAt")');
  migrateSchema(db);
  seedDefaultScenes(db);
  return db;
}

// 老库升级：逐列补齐新增字段（幂等）——CREATE TABLE IF NOT EXISTS 不会改已存在的表
function migrateSchema(db) {
  for (const [table, cols] of Object.entries(TABLES)) {
    const have = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name));
    for (const c of cols) {
      if (have.has(c)) continue;
      const type = INT_COLS.has(c) ? 'INTEGER' : 'TEXT';
      db.exec(`ALTER TABLE "${table}" ADD COLUMN "${c}" ${type} DEFAULT NULL`);
    }
  }
}

// 首次启动写入默认场景标签（与客户端 schema.js ensureSeed 同 id 同名，LWW 一致化）
function seedDefaultScenes(db) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (n > 0) return;
  const now = Date.now();
  const defaults = [
    ['cat-work', '工作', '#4f6ef7'],
    ['cat-people', '人际', '#34c273'],
    ['cat-invest', '投资', '#f5a623'],
    ['cat-learn', '学习', '#7c4dff'],
    ['cat-decision', '决策', '#ee5a5a'],
    ['cat-life', '生活', '#00b8d4'],
    ['cat-other', '其他', '#98a2b3'],
  ];
  const ins = db.prepare(
    'INSERT INTO categories (id, name, color, sort, createdAt, updatedAt, deleted, serverRev) VALUES (?, ?, ?, 0, ?, ?, 0, 0)'
  );
  defaults.forEach(([id, name, color], i) => ins.run(id, name, color, i, now, now));
  console.log('已写入默认场景标签');
}

// 只允许白名单字段写入，类型做防御性转换
function sanitize(table, row) {
  if (!row || typeof row !== 'object') return null;
  const cols = TABLES[table];
  const out = {};
  for (const c of cols) {
    let v = row[c];
    if (INT_COLS.has(c)) v = v == null ? null : Number(v) || 0;
    else if (JSON_COLS.has(c)) v = v == null ? null : JSON.stringify(v);
    else v = v == null ? null : String(v);
    out[c] = v;
  }
  if (!out.id || out.updatedAt == null) return null;
  return out;
}

// LWW upsert：仅当新行的 updatedAt 更大时覆盖；serverRev 记录服务端接收时间（变更流的游标依据）
export function pushChanges(db, table, rows) {
  const cols = TABLES[table];
  if (!cols || !Array.isArray(rows)) return 0;
  const setCols = cols.filter((c) => c !== 'id');
  const sql =
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')}) ` +
    `ON CONFLICT("id") DO UPDATE SET ${setCols.map((c) => `"${c}"=excluded."${c}"`).join(',')} ` +
    `WHERE "${table}"."updatedAt" < excluded."updatedAt"`;
  const stmt = db.prepare(sql);
  let applied = 0;
  const rev = Date.now();
  for (const raw of rows) {
    const row = sanitize(table, raw);
    if (!row) continue;
    const result = stmt.run(...cols.map((c) => row[c]));
    if (Number(result.changes) > 0) {
      db.prepare(`UPDATE "${table}" SET "serverRev"=? WHERE "id"=? AND "serverRev"<?`).run(rev, row.id, rev);
      applied++;
    }
  }
  return applied;
}

export function pullSince(db, since) {
  const changes = [];
  for (const table of Object.keys(TABLES)) {
    const rows = db.prepare(`SELECT * FROM "${table}" WHERE "serverRev" > ?`).all(since);
    for (const row of rows) changes.push({ table, row });
  }
  return changes;
}

export function exportAll(db) {
  const data = { version: 2, exportedAt: Date.now() };
  for (const table of Object.keys(TABLES)) {
    data[table] = db.prepare(`SELECT * FROM "${table}"`).all();
  }
  return data;
}

const BACKUP_NAME_RE = /^backup-\d{8}-\d{6}\.json$/;
export const isBackupName = (name) => BACKUP_NAME_RE.test(name);

// 生成一次备份快照并裁剪旧备份（保留最近 30 份）
export function createBackupSnapshot(db, backupsDir) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
  fs.writeFileSync(path.join(backupsDir, name), JSON.stringify(exportAll(db)));
  const files = fs.readdirSync(backupsDir).filter((f) => BACKUP_NAME_RE.test(f)).sort().reverse();
  for (const old of files.slice(30)) fs.unlinkSync(path.join(backupsDir, old));
  return { name, time: Date.now(), size: fs.statSync(path.join(backupsDir, name)).size };
}

export function listBackups(backupsDir) {
  if (!fs.existsSync(backupsDir)) return [];
  return fs
    .readdirSync(backupsDir)
    .filter((f) => BACKUP_NAME_RE.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(backupsDir, f));
      return { name: f, time: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => b.time - a.time);
}

export function randomId() {
  return crypto.randomUUID();
}
