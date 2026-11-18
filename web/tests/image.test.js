// 图片附件测试:压缩尺寸计算 / image store CRUD / AI 盘点附图占位
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '../src/db/schema.js';
import { calcTargetSize } from '../src/lib/image.js';
import { useImageStore } from '../src/stores/image.js';
import { buildEventPrompt } from '../src/lib/ai-prompt.js';

let imageStore;

beforeEach(async () => {
  setActivePinia(createPinia());
  await Promise.all(db.tables.map((t) => t.clear()));
  imageStore = useImageStore();
  imageStore.watch();
  await imageStore.load();
});

describe('calcTargetSize(等比压缩尺寸)', () => {
  it('横图/竖图长边缩到 1280', () => {
    expect(calcTargetSize(4000, 3000)).toEqual({ w: 1280, h: 960 });
    expect(calcTargetSize(3000, 4000)).toEqual({ w: 960, h: 1280 });
  });
  it('小图不放大', () => {
    expect(calcTargetSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(calcTargetSize(64, 64)).toEqual({ w: 64, h: 64 });
  });
  it('非法输入兜底', () => {
    expect(calcTargetSize(0, 0)).toEqual({ w: 1, h: 1 });
    expect(calcTargetSize('x', null)).toEqual({ w: 1, h: 1 });
  });
});

describe('image store(save/byOwner/remove)', () => {
  it('保存并按 owner 查询;不同 owner 不串', async () => {
    const a = await imageStore.save({ ownerTable: 'thoughts', ownerId: 't1', data: 'data:image/jpeg;base64,AAA', w: 1280, h: 960 });
    await imageStore.save({ ownerTable: 'thoughts', ownerId: 't1', data: 'data:image/jpeg;base64,BBB', w: 100, h: 100 });
    await imageStore.save({ ownerTable: 'eventEntries', ownerId: 't1', data: 'data:image/jpeg;base64,CCC', w: 100, h: 100 });
    await imageStore.save({ ownerTable: 'thoughts', ownerId: 't2', data: 'data:image/jpeg;base64,DDD', w: 100, h: 100 });
    const own = imageStore.byOwner('thoughts', 't1');
    expect(own).toHaveLength(2);
    expect(own.map((x) => x.w)).toEqual([1280, 100]);
    expect(imageStore.byOwner('eventEntries', 't1')).toHaveLength(1);
    expect(imageStore.byOwner('thoughts', 't2')).toHaveLength(1);
    // 删除
    await imageStore.remove(a.id);
    expect(imageStore.byOwner('thoughts', 't1')).toHaveLength(1);
  });

  it('校验:非法 ownerTable/缺 ownerId/非图片数据 抛错', async () => {
    await expect(imageStore.save({ ownerTable: 'bogus', ownerId: 'x', data: 'data:image/jpeg;base64,A' })).rejects.toThrow('未知的图片归属');
    await expect(imageStore.save({ ownerTable: 'thoughts', ownerId: '', data: 'data:image/jpeg;base64,A' })).rejects.toThrow('缺少挂靠的记录');
    await expect(imageStore.save({ ownerTable: 'thoughts', ownerId: 'x', data: 'hello' })).rejects.toThrow('图片数据无效');
  });
});

describe('AI 盘点附图占位', () => {
  it('记录行尾追加 [附图×N]', () => {
    const p = buildEventPrompt(
      { title: 'bug' },
      { entries: [{ at: Date.now(), kind: 'record', content: '带图记录', _imgs: 2 }], thoughts: [], subjects: [] }
    );
    expect(p).toContain('[附图×2]');
  });
  it('无图不追加占位', () => {
    const p = buildEventPrompt({ title: 'bug' }, { entries: [{ at: Date.now(), kind: 'record', content: '无图记录' }], thoughts: [], subjects: [] });
    expect(p).not.toContain('[附图');
  });
});
