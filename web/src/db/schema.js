// MyEvent 数据库 schema：认知复盘领域（对象/事件/想法/预判/规则）+ 平台表
// 通用字段约定（全表必带）：id / createdAt / updatedAt / deleted / serverRev（继承自 MyTime 架构约定）
// JSON 列（数组/对象）本地存原生结构，同步序列化见 repo.js 的 JSON_COLS
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

// v2：MyTime 计时领域 → 认知复盘领域
// - events 语义扩展：关联对象（多值索引）/场景/一句话事实/复盘状态与内容
// - 新增 subjects（对象）/ thoughts（想法）/ predictions（预判）/ rules（经验规则）
db.version(2)
  .stores({
    events: 'id, categoryId, *subjectIds, status, startAt, endAt, reviewedAt, createdAt, updatedAt, deleted',
    categories: 'id, name, updatedAt, deleted',
    subjects: 'id, name, type, nextReviewAt, createdAt, updatedAt, deleted',
    thoughts: 'id, subjectId, kind, state, at, createdAt, updatedAt, deleted',
    predictions: 'id, subjectId, kind, status, windowEnd, verifiedAt, createdAt, updatedAt, deleted',
    rules: 'id, validity, scene, createdAt, updatedAt, deleted',
    outbox: '++seq, key',
    meta: 'key',
    logs: '++id, at',
  })
  .upgrade((tx) =>
    // 存量计时事件补默认字段（视为待复盘进入收件箱）
    tx.table('events').toCollection().modify((e) => {
      if (!Array.isArray(e.subjectIds)) e.subjectIds = [];
      if (!e.status) e.status = 'inbox';
    })
  );

// v3：事件过程记录(eventEntries)——事件可持续跟进,每条记录带触发源(类型+说明)
// 独立表而非 events 内嵌 JSON:多端并发追加时 LWW 按"行"合并,内嵌数组会整列覆盖丢数据
db.version(3).stores({
  events: 'id, categoryId, *subjectIds, status, startAt, endAt, reviewedAt, createdAt, updatedAt, deleted',
  categories: 'id, name, updatedAt, deleted',
  subjects: 'id, name, type, nextReviewAt, createdAt, updatedAt, deleted',
  thoughts: 'id, subjectId, kind, state, at, createdAt, updatedAt, deleted',
  predictions: 'id, subjectId, kind, status, windowEnd, verifiedAt, createdAt, updatedAt, deleted',
  rules: 'id, validity, scene, createdAt, updatedAt, deleted',
  eventEntries: 'id, eventId, at, createdAt, updatedAt, deleted',
  outbox: '++seq, key',
  meta: 'key',
  logs: '++id, at',
});

// v4:线索软收尾——threadState(open 进行中 / done 已完结 / shelved 已搁置),纯手动标记,与旧复盘 status 字段无关
db.version(4).stores({
  events: 'id, categoryId, *subjectIds, status, threadState, startAt, endAt, reviewedAt, createdAt, updatedAt, deleted',
  categories: 'id, name, updatedAt, deleted',
  subjects: 'id, name, type, nextReviewAt, createdAt, updatedAt, deleted',
  thoughts: 'id, subjectId, kind, state, at, createdAt, updatedAt, deleted',
  predictions: 'id, subjectId, kind, status, windowEnd, verifiedAt, createdAt, updatedAt, deleted',
  rules: 'id, validity, scene, createdAt, updatedAt, deleted',
  eventEntries: 'id, eventId, at, createdAt, updatedAt, deleted',
  outbox: '++seq, key',
  meta: 'key',
  logs: '++id, at',
});

// v5:自定义文件夹——对象与线索各自的文件夹组(folders),内容挂 folderId(空=未分类)
db.version(5).stores({
  events: 'id, categoryId, threadState, folderId, updatedAt, createdAt, deleted',
  categories: 'id, sort, updatedAt, deleted',
  subjects: 'id, type, folderId, createdAt, updatedAt, deleted',
  thoughts: 'id, subjectId, kind, state, at, createdAt, updatedAt, deleted',
  predictions: 'id, subjectId, kind, status, windowEnd, verifiedAt, createdAt, updatedAt, deleted',
  rules: 'id, validity, scene, createdAt, updatedAt, deleted',
  eventEntries: 'id, eventId, at, createdAt, updatedAt, deleted',
  folders: 'id, sort, updatedAt, deleted',
  outbox: '++seq, key',
  meta: 'key',
  logs: '++id, at',
});

// 供 E2E 数据库级断言（Playwright）
if (typeof window !== 'undefined') window.__myeventDebug = { db };

export { db };

// 首启播种默认场景标签（与服务端 seedDefaultCategories 同 id 同名，连接同步后 LWW 一致化）
const DEFAULT_SCENES = [
  ['cat-work', '工作', '#4f6ef7'],
  ['cat-people', '人际', '#34c273'],
  ['cat-invest', '投资', '#f5a623'],
  ['cat-learn', '学习', '#7c4dff'],
  ['cat-decision', '决策', '#ee5a5a'],
  ['cat-life', '生活', '#00b8d4'],
  ['cat-other', '其他', '#98a2b3'],
];

export async function ensureSeed() {
  const n = await db.categories.count();
  if (n > 0) return;
  const now = Date.now();
  await db.categories.bulkPut(
    DEFAULT_SCENES.map(([id, name, color], i) => ({
      id,
      name,
      color,
      sort: i,
      createdAt: now,
      updatedAt: now,
      deleted: 0,
    }))
  );
}
