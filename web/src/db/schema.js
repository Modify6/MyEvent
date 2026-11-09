// MyEvent 数据库 schema：events（事件）+ categories（分类）
// 通用字段约定（全表必带）：id / createdAt / updatedAt / deleted / serverRev
// 详见 docs/architecture.md §3
import Dexie from 'dexie';

const db = new Dexie('myevent');

db.version(1).stores({
  // 索引字段 only（非索引数据自动存储）
  events: 'id, categoryId, startAt, endAt, createdAt, updatedAt, deleted',
  categories: 'id, name, updatedAt, deleted',
  outbox: '++seq, key',
  meta: 'key',
  logs: '++id, at',
});

// 供 E2E 数据库级断言（Playwright）
if (typeof window !== 'undefined') window.__mytimeDebug = { db };

export { db };

// 首启播种默认分类（全新离线用户的第一分钟就能用；连接服务端后 LWW 一致化）
export async function ensureSeed() {
  const n = await db.categories.count();
  if (n > 0) return;
  await db.categories.bulkPut([
    { id: 'cat-work', name: '工作', color: '#4f6ef7', createdAt: Date.now(), updatedAt: Date.now(), deleted: 0 },
    { id: 'cat-life', name: '生活', color: '#34c273', createdAt: Date.now(), updatedAt: Date.now(), deleted: 0 },
    { id: 'cat-learn', name: '学习', color: '#f5a623', createdAt: Date.now(), updatedAt: Date.now(), deleted: 0 },
    { id: 'cat-other', name: '其他', color: '#98a2b3', createdAt: Date.now(), updatedAt: Date.now(), deleted: 0 },
  ]);
}
