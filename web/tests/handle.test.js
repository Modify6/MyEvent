// 处理状态测试:记录三态流转留痕/回退清时间 + 线索状态扩展(issue)与自动落过程记录(fake-indexeddb)
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '../src/db/schema.js';
import { useThoughtStore } from '../src/stores/thought.js';
import { useEventStore } from '../src/stores/event.js';
import { normalizeRow } from '../src/db/repo.js';

let thoughtStore;
let eventStore;

beforeEach(async () => {
  setActivePinia(createPinia());
  await Promise.all(db.tables.map((t) => t.clear()));
  // 与应用一致的 watch 订阅:写入后 onChange → load;测试内写入后显式 load 兜微任务时序
  thoughtStore = useThoughtStore();
  eventStore = useEventStore();
  thoughtStore.watch();
  eventStore.watch();
  await thoughtStore.load();
  await eventStore.load();
});

describe('记录处理状态(thought.setHandle)', () => {
  it('新记录默认未处理;标记已处理写入结果说明与时间', async () => {
    const t = await thoughtStore.quickAdd({ content: '实现文件夹就地新建' });
    expect(t.handleStatus).toBe('pending');
    await thoughtStore.setHandle(t.id, 'done', '已上线 v0.7.0');
    await thoughtStore.load();
    const row = thoughtStore.byId(t.id);
    expect(row.handleStatus).toBe('done');
    expect(row.handleNote).toBe('已上线 v0.7.0');
    expect(row.handledAt).toBeTruthy();
    expect(row.statusHistory).toHaveLength(1);
    expect(row.statusHistory[0]).toMatchObject({ from: 'pending', to: 'done', note: '已上线 v0.7.0' });
  });

  it('再标记有问题:历史累积两条', async () => {
    const t = await thoughtStore.quickAdd({ content: '某需求' });
    await thoughtStore.setHandle(t.id, 'done', '先做了一版');
    await thoughtStore.setHandle(t.id, 'issue', '方案有回归,要重做');
    await thoughtStore.load();
    const row = thoughtStore.byId(t.id);
    expect(row.handleStatus).toBe('issue');
    expect(row.statusHistory).toHaveLength(2);
    expect(row.statusHistory[1]).toMatchObject({ from: 'done', to: 'issue' });
  });

  it('切回未处理清空 handledAt,非法状态抛错', async () => {
    const t = await thoughtStore.quickAdd({ content: '某需求' });
    await thoughtStore.setHandle(t.id, 'done', 'ok');
    await thoughtStore.setHandle(t.id, 'pending', '');
    await thoughtStore.load();
    const row = thoughtStore.byId(t.id);
    expect(row.handleStatus).toBe('pending');
    expect(row.handledAt).toBeNull();
    await expect(thoughtStore.setHandle(t.id, 'bogus', '')).rejects.toThrow('未知的处理状态');
  });

  it('0.9.9:状态与说明都未变时不写库不留痕;仅改说明只更新备注不刷历史', async () => {
    const t = await thoughtStore.quickAdd({ content: '某需求' });
    await thoughtStore.setHandle(t.id, 'done', '结果A');
    const before = JSON.stringify(thoughtStore.byId(t.id));
    // 查看后原样保存:不写库不留痕
    await thoughtStore.setHandle(t.id, 'done', '结果A');
    expect(JSON.stringify(thoughtStore.byId(t.id))).toBe(before);
    expect(thoughtStore.byId(t.id).statusHistory).toHaveLength(1);
    // 仅改说明:备注更新,但状态未变,不追加历史
    await thoughtStore.setHandle(t.id, 'done', '结果B(补充)');
    const row = thoughtStore.byId(t.id);
    expect(row.handleNote).toBe('结果B(补充)');
    expect(row.statusHistory).toHaveLength(1);
  });
});

describe('线索处理状态(event.setThreadState 扩展)', () => {
  it('完结时填说明:状态变更留痕并自动落一条过程记录', async () => {
    const ev = await eventStore.capture({ title: '需求A' });
    await eventStore.setThreadState(ev.id, 'done', '按方案X实现完成');
    await eventStore.load();
    const row = eventStore.byId(ev.id);
    expect(row.threadState).toBe('done');
    expect(row.handleNote).toBe('按方案X实现完成');
    expect(row.statusHistory).toHaveLength(1);
    const entries = eventStore.entriesOf(ev.id);
    expect(entries.some((en) => en.content.includes('状态 → 已完结') && en.content.includes('按方案X实现完成'))).toBe(true);
  });

  it('0.9.9:线索状态未变时不写库不留痕,也不自动落过程记录', async () => {
    const ev = await eventStore.capture({ title: '需求C' });
    await eventStore.setThreadState(ev.id, 'done', '完成');
    const entriesBefore = eventStore.entriesOf(ev.id).length;
    await eventStore.setThreadState(ev.id, 'done', '完成');
    expect(eventStore.byId(ev.id).statusHistory).toHaveLength(1);
    expect(eventStore.entriesOf(ev.id).length).toBe(entriesBefore);
    await eventStore.setThreadState(ev.id, 'done', '完成(补充验收标准)');
    const row = eventStore.byId(ev.id);
    expect(row.handleNote).toBe('完成(补充验收标准)');
    expect(row.statusHistory).toHaveLength(1);
    expect(eventStore.entriesOf(ev.id).length).toBe(entriesBefore);
  });

  it('标记有问题(新状态);重新打开清说明', async () => {
    const ev = await eventStore.capture({ title: '需求B' });
    await eventStore.setThreadState(ev.id, 'issue', '实现有回归');
    await eventStore.load();
    expect(eventStore.byId(ev.id).threadState).toBe('issue');
    await eventStore.setThreadState(ev.id, 'open');
    await eventStore.load();
    const row = eventStore.byId(ev.id);
    expect(row.threadState).toBe('open');
    expect(row.handleNote).toBe('');
  });
});

describe('过程记录处理状态(event.setEntryHandle)', () => {
  it('过程记录标已处理+说明,留痕;切回清时间', async () => {
    const ev = await eventStore.capture({ title: '开发中的 app' });
    const en = await eventStore.addEntry({ eventId: ev.id, content: '需求:处理状态功能' });
    expect(en.handleStatus).toBe('pending');
    await eventStore.setEntryHandle(en.id, 'done', 'v0.8.0 已实现');
    await eventStore.load();
    const row = eventStore.entries.find((x) => x.id === en.id);
    expect(row.handleStatus).toBe('done');
    expect(row.handleNote).toBe('v0.8.0 已实现');
    expect(row.statusHistory).toHaveLength(1);
    expect(row.statusHistory[0]).toMatchObject({ from: 'pending', to: 'done', note: 'v0.8.0 已实现' });
    await eventStore.setEntryHandle(en.id, 'pending', '');
    expect(eventStore.entries.find((x) => x.id === en.id).handledAt).toBeNull();
    await expect(eventStore.setEntryHandle(en.id, 'bogus', '')).rejects.toThrow('未知的处理状态');
  });
});

describe('同步层 normalizeRow(statusHistory 列)', () => {
  it('服务端 JSON 字符串反序列化;空值回落 []', () => {
    const hist = [{ at: 1, from: 'pending', to: 'done', note: 'ok' }];
    const row = normalizeRow('thoughts', { id: 'x', statusHistory: JSON.stringify(hist) });
    expect(row.statusHistory).toEqual(hist);
    expect(normalizeRow('thoughts', { id: 'y' }).statusHistory).toEqual([]);
    expect(normalizeRow('events', { id: 'z' }).statusHistory).toEqual([]);
    expect(normalizeRow('eventEntries', { id: 'w' }).statusHistory).toEqual([]);
  });
});
