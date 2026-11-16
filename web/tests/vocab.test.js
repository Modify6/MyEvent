// 词表测试:自定义类型/触发源的 CRUD/查重/排序 + 内置合并 + 白名单放开(fake-indexeddb)
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '../src/db/schema.js';
import { useVocabStore } from '../src/stores/vocab.js';
import { useThoughtStore } from '../src/stores/thought.js';
import { useEventStore } from '../src/stores/event.js';

let vocabStore;
let thoughtStore;
let eventStore;

beforeEach(async () => {
  setActivePinia(createPinia());
  await Promise.all(db.tables.map((t) => t.clear()));
  vocabStore = useVocabStore();
  thoughtStore = useThoughtStore();
  eventStore = useEventStore();
  vocabStore.watch();
  thoughtStore.watch();
  eventStore.watch();
  await vocabStore.load();
  await thoughtStore.load();
  await eventStore.load();
});

describe('词表 CRUD(vocab store)', () => {
  it('自定义类型/触发源:建/查重/删', async () => {
    const k = await vocabStore.save({ type: 'kind', name: '需求评审', icon: '🤝', color: '#4f6ef7' });
    const t = await vocabStore.save({ type: 'trigger', name: '需求评审' }); // 不同 type 同名允许
    expect(vocabStore.byType('kind').map((x) => x.name)).toEqual(['需求评审']);
    await expect(vocabStore.save({ type: 'kind', name: '需求评审' })).rejects.toThrow('已有同名类型');
    await expect(vocabStore.save({ type: 'bogus', name: 'x' })).rejects.toThrow('未知的词表类型');
    await vocabStore.remove(k.id);
    expect(vocabStore.byType('kind')).toHaveLength(0);
    expect(vocabStore.byType('trigger').map((x) => x.id)).toEqual([t.id]);
  });

  it('kinds/triggers 合并:内置在前自定义在后;kindMetaOf/triggerIconOf 兜底与自定义', async () => {
    expect(vocabStore.kinds).toContain('想法'); // 内置
    expect(vocabStore.triggers).toContain('代码'); // 0.9.0 新内置
    await vocabStore.save({ type: 'kind', name: '客户反馈', icon: '📣', color: '#ee5a5a' });
    expect(vocabStore.kinds[vocabStore.kinds.length - 1]).toBe('客户反馈');
    expect(vocabStore.kindMetaOf('客户反馈')).toEqual({ icon: '📣', color: '#ee5a5a' });
    expect(vocabStore.kindMetaOf('想法').icon).toBe('💡'); // 内置优先
    expect(vocabStore.kindMetaOf('不存在')).toEqual({ icon: '📝', color: '#8f9bb3' }); // 兜底
    await vocabStore.save({ type: 'trigger', name: '站会', icon: '🤝' });
    expect(vocabStore.triggerIconOf('站会')).toBe('🤝');
    expect(vocabStore.triggerIconOf('视频')).toBe('🎬');
    expect(vocabStore.triggerIconOf('不存在')).toBe('✳️');
  });

  it('moveUpDown 交换相邻 sort', async () => {
    const a = await vocabStore.save({ type: 'kind', name: '甲' });
    const b = await vocabStore.save({ type: 'kind', name: '乙' });
    await vocabStore.moveUpDown(a.id, 1);
    expect(vocabStore.byType('kind').map((x) => x.name)).toEqual(['乙', '甲']);
    expect(vocabStore.byId(b.id).sort).toBeLessThan(vocabStore.byId(a.id).sort);
  });
});

describe('白名单放开(自定义值直接入库)', () => {
  it('quickAdd/edit 接受自定义 kind', async () => {
    const t = await thoughtStore.quickAdd({ content: '某记录', kind: '需求评审' });
    expect(t.kind).toBe('需求评审');
    await thoughtStore.edit(t.id, { kind: '客户反馈' });
    expect(thoughtStore.byId(t.id).kind).toBe('客户反馈');
  });

  it('addEntry/editEntry 接受自定义 triggerKind', async () => {
    const ev = await eventStore.capture({ title: '某线索' });
    const en = await eventStore.addEntry({ eventId: ev.id, content: '记一笔', triggerKind: '需求评审' });
    expect(en.triggerKind).toBe('需求评审');
    await eventStore.editEntry(en.id, { triggerKind: '站会' });
    expect(eventStore.entries.find((x) => x.id === en.id).triggerKind).toBe('站会');
  });

  it('空值回落:quickAdd 缺 kind 默认 想法;addEntry 空 triggerKind 为空串', async () => {
    const t = await thoughtStore.quickAdd({ content: 'x' });
    expect(t.kind).toBe('想法');
    const ev = await eventStore.capture({ title: 'y' });
    const en = await eventStore.addEntry({ eventId: ev.id, content: 'z', triggerKind: '' });
    expect(en.triggerKind).toBe('');
  });
});
