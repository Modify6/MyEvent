// 数据层：node:sqlite（Node 内置，无原生依赖）
// 所有表共享同步字段：id / updatedAt(客户端逻辑时钟，用于 LWW) / serverRev(服务端接收时间，用于增量拉取) / deleted(软删)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TABLES = {
  categories: ['id', 'name', 'color', 'sort', 'createdAt', 'updatedAt', 'deleted'],
  events: ['id', 'title', 'categoryId', 'location', 'note', 'startAt', 'endAt', 'createdAt', 'updatedAt', 'deleted'],
};

const INT_COLS = new Set(['sort', 'createdAt', 'updatedAt', 'deleted', 'startAt', 'endAt']);
const FLOAT_COLS = new Set([]);

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'mytime.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT '#4F6EF7',
      "sort" INTEGER NOT NULL DEFAULT 0, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL,
      "deleted" INTEGER NOT NULL DEFAULT 0, "serverRev" INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events (
      "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT NOT NULL,
      "location" TEXT NOT NULL DEFAULT '', "note" TEXT NOT NULL DEFAULT '',
      "startAt" INTEGER NOT NULL, "endAt" INTEGER,
      "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL,
      "deleted" INTEGER NOT NULL DEFAULT 0, "serverRev" INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_events_start ON events("startAt");
    CREATE INDEX IF NOT EXISTS idx_rev ON events("serverRev");
  `);
  migrateSchema(db);
  seedDefaultCategories(db);
  return db;
}

// 老库升级：逐列补齐新增字段（幂等）——新项目暂无迁移，留作扩展点
function migrateSchema(db) {
  // 示例：if (!cols.has('newCol')) db.exec('ALTER TABLE events ADD COLUMN "newCol" TEXT');
}

// 首次启动时写入默认分类（柳比歇夫分类法的常见维度）
function seedDefaultCategories(db) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (n > 0) return;
  const now = Date.now();
  const defaults = [
    ['cat-work', '工作', '#4f6ef7'],
    ['cat-life', '生活', '#34c273'],
    ['cat-learn', '学习', '#f5a623'],
    ['cat-other', '其他', '#98a2b3'],
  ];
  const ins = db.prepare(
    'INSERT INTO categories (id, name, color, sort, createdAt, updatedAt, deleted, serverRev) VALUES (?, ?, ?, 0, ?, ?, 0, 0)'
  );
  defaults.forEach(([id, name, color], i) => ins.run(id, name, color, now, now));
  console.log('已写入默认分类');
}

// 只允许白名单字段写入，类型做防御性转换
function sanitize(table, row) {
  if (!row || typeof row !== 'object') return null;
  const cols = TABLES[table];
  const out = {};
  for (const c of cols) {
    let v = row[c];
    if (INT_COLS.has(c)) v = v == null ? null : Number(v) || 0;
    else if (FLOAT_COLS.has(c)) v = v == null || v === '' ? null : Number(v);
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
  const data = { version: 1, exportedAt: Date.now() };
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
