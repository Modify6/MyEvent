// 数据层单测:Dexie v2 表结构 / putRow→outbox 写路径 / JSON 列规范化(fake-indexeddb)
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/schema.js';
import { putRow, normalizeRow } from '../src/db/repo.js';

beforeAll(async () => {
  await db.open();
});

describe('schema v3', () => {
  it('包含全部领域表与平台表', () => {
    const names = db.tables.map((t) => t.name);
    for (const t of ['events', 'categories', 'subjects', 'thoughts', 'predictions', 'rules', 'eventEntries', 'outbox', 'meta', 'logs']) {
      expect(names).toContain(t);
    }
  });

  it('过程记录写入并进 outbox(独立行,多端追加不互相覆盖)', async () => {
    await putRow('eventEntries', {
      id: 'en-test-1', eventId: 'e-test-1', content: '看了财报分析视频',
      triggerKind: '视频', triggerNote: 'B站XX的拆解', at: 123, createdAt: 1, deleted: 0,
    });
    const en = await db.eventEntries.get('en-test-1');
    expect(en.triggerKind).toBe('视频');
    const ob = await db.outbox.where('key').equals('eventEntries:en-test-1').toArray();
    expect(ob).toHaveLength(1);
  });

  it('小结(kind=summary)是过程记录的一种,与普通记录同表共存', async () => {
    await putRow('eventEntries', {
      id: 'en-sum-1', eventId: 'e-test-1', kind: 'summary',
      content: '摘要会过滤反证信息,读原文', at: 456, createdAt: 1, deleted: 0,
    });
    const en = await db.eventEntries.get('en-sum-1');
    expect(en.kind).toBe('summary');
    // 老数据无 kind 字段 → 视为普通记录(undefined 不影响展示兜底)
    expect((await db.eventEntries.get('en-test-1')).kind).toBeUndefined();
  });

  it('edits 修订历史作为 JSON 列完整存取(改变要有记录)', async () => {
    await putRow('eventEntries', {
      id: 'en-edit-1', eventId: 'e-test-1', kind: 'record', content: '第二版内容',
      edits: [{ at: 111, content: '第一版内容', triggerKind: '', triggerNote: '' }],
      at: 789, createdAt: 1, deleted: 0,
    });
    const en = await db.eventEntries.get('en-edit-1');
    expect(en.content).toBe('第二版内容');
    expect(en.edits).toHaveLength(1);
    expect(en.edits[0].content).toBe('第一版内容');
  });

  it('putRow 写入并进 outbox 队列(同步协议写路径)', async () => {
    const row = await putRow('rules', { id: 'r-test-1', content: '如果收到模糊需求,则先问清验收标准', validity: 'pending', createdAt: 1, deleted: 0 });
    expect(row.updatedAt).toBeGreaterThan(0);
    const stored = await db.rules.get('r-test-1');
    expect(stored.content).toContain('如果');
    const ob = await db.outbox.where('key').equals('rules:r-test-1').toArray();
    expect(ob).toHaveLength(1);
    expect(ob[0].table).toBe('rules');
  });

  it('预判/想法/对象表可写入 JSON 列(原生结构)', async () => {
    await putRow('predictions', {
      id: 'p-test-1',
      subjectId: 's1',
      content: 'X 一个月内发生',
      status: 'draft',
      origConfidence: 70,
      criteria: { hit: 'X 发生', partial: '', miss: 'X 未发生' },
      lockSnapshot: null,
      createdAt: 1,
      deleted: 0,
    });
    const p = await db.predictions.get('p-test-1');
    expect(p.criteria.hit).toBe('X 发生');
  });
});

describe('normalizeRow(同步拉取行反序列化)', () => {
  it('JSON 字符串 → 原生结构', () => {
    const r = normalizeRow('events', { id: 'e1', subjectIds: '["s1","s2"]', review: '{"actual":"x"}' });
    expect(r.subjectIds).toEqual(['s1', 's2']);
    expect(r.review).toEqual({ actual: 'x' });
  });
  it('null 与坏 JSON 回落该列空态', () => {
    const r = normalizeRow('subjects', { id: 's1', tags: null, topReasons: 'not-json{' });
    expect(r.tags).toEqual([]);
    expect(r.topReasons).toEqual([]);
    const r2 = normalizeRow('events', { id: 'e2', subjectIds: undefined });
    expect(r2.subjectIds).toEqual([]);
  });
  it('已是原生结构的保持不变;edits 列空值兜底为[]', () => {
    const r = normalizeRow('predictions', { id: 'p1', basis: [{ a: 1 }], result: null });
    expect(r.basis).toEqual([{ a: 1 }]);
    expect(r.result).toBeNull();
    const t = normalizeRow('thoughts', { id: 't1', content: 'x', edits: null });
    expect(t.edits).toEqual([]);
    const e = normalizeRow('eventEntries', { id: 'e1', edits: '[{"at":1,"content":"旧"}]' });
    expect(e.edits).toEqual([{ at: 1, content: '旧' }]);
  });
});
