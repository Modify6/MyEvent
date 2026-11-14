// 文件夹领域测试:CRUD / 排序 / 删除回落 / move 语义(fake-indexeddb)
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '../src/db/schema.js';
import { useFolderStore } from '../src/stores/folder.js';

beforeEach(async () => {
  setActivePinia(createPinia());
  await Promise.all(db.tables.map((t) => t.clear()));
  const store = useFolderStore();
  await store.load();
});

describe('文件夹 CRUD 与排序', () => {
  it('新建追加末位 sort,byScope 按域过滤并按 sort 升序', async () => {
    const store = useFolderStore();
    await store.save({ name: '工作', color: '#4f6ef7', scope: 'subject' });
    await store.save({ name: '投资', color: '#f5a623', scope: 'event' });
    await store.save({ name: '生活', color: '#34c273', scope: 'subject' });
    const subj = store.byScope('subject');
    expect(subj.map((f) => f.name)).toEqual(['工作', '生活']);
    expect(subj[0].sort).toBe(10);
    expect(subj[1].sort).toBe(20);
    expect(store.byScope('event').map((f) => f.name)).toEqual(['投资']);
  });

  it('重命名/换色', async () => {
    const store = useFolderStore();
    const f = await store.save({ name: '旧名', color: '#4f6ef7', scope: 'subject' });
    await store.save({ id: f.id, name: '新名', color: '#ee5a5a', scope: 'subject' });
    const row = store.byId(f.id);
    expect(row.name).toBe('新名');
    expect(row.color).toBe('#ee5a5a');
  });

  it('moveUpDown 交换相邻 sort', async () => {
    const store = useFolderStore();
    const a = await store.save({ name: 'A', color: '#4f6ef7', scope: 'subject' });
    const b = await store.save({ name: 'B', color: '#7c4dff', scope: 'subject' });
    await store.moveUpDown(a.id, 1); // A 下移
    await store.load();
    expect(store.byScope('subject').map((f) => f.name)).toEqual(['B', 'A']);
    void b;
  });

  it('reorder 按数组顺序写 sort', async () => {
    const store = useFolderStore();
    const a = await store.save({ name: 'A', color: '#4f6ef7', scope: 'subject' });
    const b = await store.save({ name: 'B', color: '#7c4dff', scope: 'subject' });
    await store.reorder([b.id, a.id]);
    await store.load();
    expect(store.byScope('subject').map((f) => f.name)).toEqual(['B', 'A']);
    void a;
  });
});

describe('删除回落与 move 语义', () => {
  it('删除文件夹:软删自身,内容 folderId 回落未分类', async () => {
    const store = useFolderStore();
    const f = await store.save({ name: '将删除', color: '#4f6ef7', scope: 'subject' });
    await db.subjects.put({ id: 's1', name: '对象甲', type: '人', folderId: f.id, createdAt: 1, updatedAt: 1, deleted: 0 });
    await store.remove(f.id);
    await store.load();
    expect((await db.subjects.get('s1')).folderId).toBe('');
    expect((await db.folders.get(f.id)).deleted).toBe(1);
    expect(store.active.find((x) => x.id === f.id)).toBeUndefined();
  });

  it('moveItem:对象移入/移出', async () => {
    const store = useFolderStore();
    const f = await store.save({ name: '测试夹', color: '#4f6ef7', scope: 'subject' });
    await db.subjects.put({ id: 's2', name: '对象乙', type: '项目', folderId: '', createdAt: 1, updatedAt: 1, deleted: 0 });
    await store.moveItem('subject', 's2', f.id);
    expect((await db.subjects.get('s2')).folderId).toBe(f.id);
    await store.moveItem('subject', 's2', '');
    expect((await db.subjects.get('s2')).folderId).toBe('');
  });

  it('moveItem:事件线索移入事件文件夹', async () => {
    const store = useFolderStore();
    const f = await store.save({ name: '事件夹', color: '#4f6ef7', scope: 'event' });
    await db.events.put({ id: 'e1', title: '线索甲', threadState: 'open', folderId: '', startAt: 1, createdAt: 1, updatedAt: 1, deleted: 0 });
    await store.moveItem('event', 'e1', f.id);
    expect((await db.events.get('e1')).folderId).toBe(f.id);
  });
});
