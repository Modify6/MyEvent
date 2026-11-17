// AI 盘点提示词构建测试:数据组装/截断/条数上限/六段指令(fake-indexeddb 不需要,纯函数)
import { describe, expect, it } from 'vitest';
import { buildSubjectPrompt, buildPeriodPrompt, buildDebugReport } from '../src/lib/ai-prompt.js';

const subject = {
  name: 'MyTings',
  type: '项目',
  currentView: '电源接口要重构',
  currentConfidence: 70,
  topReasons: ['报错频发', '接口不统一'],
  biggestRisk: '时间不够',
  openQuestions: '接口形态',
};

describe('对象盘点提示词(buildSubjectPrompt)', () => {
  it('组装对象档案与清单,含六段分析指令', () => {
    const p = buildSubjectPrompt(subject, {
      events: [{ title: '电源重构', startAt: Date.now(), fact: '接口不统一', threadState: 'open' }],
      thoughts: [{ at: Date.now(), kind: '想法', content: '电源不能正常输出尺寸信息' }],
      predictions: [{ content: '两周内完成', madeAt: Date.now(), status: 'locked', origConfidence: 70 }],
    });
    expect(p).toContain('# 对象盘点:MyTings');
    expect(p).toContain('当前观点: 电源接口要重构');
    expect(p).toContain('当前置信度: 70%');
    expect(p).toContain('报错频发');
    expect(p).toContain('- [').toContain('电源重构');
    expect(p).toContain('状态: 进行中');
    expect(p).toContain('想法: 电源不能正常输出尺寸信息');
    expect(p).toContain('状态: locked, 置信度 70%');
    expect(p).toContain('## 一、事实梳理');
    expect(p).toContain('## 六、经验规则候选');
    expect(p).toContain('不编造');
  });

  it('超长内容截断加省略号', () => {
    const long = '长'.repeat(300);
    const p = buildSubjectPrompt(subject, { thoughts: [{ at: Date.now(), kind: '事实', content: long }] });
    expect(p).toContain('…');
    expect(p).not.toContain('长'.repeat(300));
  });

  it('条数上限:超过 60 条记录时截断并注明剩余数', () => {
    const thoughts = Array.from({ length: 65 }, (_, i) => ({ at: Date.now() - i * 1000, kind: '想法', content: '记录' + i }));
    const p = buildSubjectPrompt(subject, { thoughts });
    expect(p).toContain('60/65 条');
    expect(p).toContain('另有 5 条更早记录未附');
  });

  it('空数据也生成可用提示词', () => {
    const p = buildSubjectPrompt(subject, {});
    expect(p).toContain('对象档案');
    expect(p).toContain('## 一、事实梳理');
  });
});

describe('周期盘点提示词(buildPeriodPrompt)', () => {
  it('注入周期标签,合并 thoughts 与 entries 按时间倒序', () => {
    const now = Date.now();
    const p = buildPeriodPrompt('2026-11-09 ~ 2026-11-15', {
      thoughts: [{ at: now, kind: '想法', content: '独立记录' }],
      entries: [{ at: now - 1000, kind: 'record', content: '过程记录' }],
      events: [],
    });
    expect(p).toContain('# 周期盘点:2026-11-09 ~ 2026-11-15');
    expect(p).toContain('想法: 独立记录');
    expect(p).toContain('记录: 过程记录');
    const i1 = p.indexOf('独立记录');
    const i2 = p.indexOf('过程记录');
    expect(i1).toBeLessThan(i2);
  });

  it('线索状态变化清单(非进行中)', () => {
    const p = buildPeriodPrompt('本周', {
      thoughts: [], entries: [],
      events: [{ title: '某线索', threadState: 'done' }, { title: '进行中线索', threadState: 'open' }],
    });
    expect(p).toContain('某线索 → 已完结');
    expect(p).not.toContain('进行中线索 →');
  });

  it('空周期给占位说明,不报错', () => {
    const p = buildPeriodPrompt('本周', { thoughts: [], entries: [], events: [] });
    expect(p).toContain('本周期暂无记录');
  });
});

describe('诊断报告(buildDebugReport)', () => {
  it('包含计数快照/提示词全文/AI 回答,空回答标注(空)', () => {
    const r = buildDebugReport({
      version: '0.9.7',
      time: '2026-11-18T00:00:00Z',
      scope: 'subject',
      subject: { id: 'sid1', name: 'MyTings' },
      rangeLabel: '-',
      counts: { thoughts: 0, entries: 0, events: 3, predictions: 1 },
      storeTotals: { thoughtsAll: 120, thoughtsActive: 110, eventsActive: 30, entriesAll: 200 },
      prompt: '# 对象盘点:MyTings',
      answer: '',
    });
    expect(r).toContain('[MyEvent 诊断信息]');
    expect(r).toContain('v0.9.7');
    expect(r).toContain('对象「MyTings」 id=sid1');
    expect(r).toContain('thoughts: 0');
    expect(r).toContain('thoughtsAll: 120');
    expect(r).toContain('--- 提示词开始 ---');
    expect(r).toContain('# 对象盘点:MyTings');
    expect(r).toContain('--- AI 回答开始 ---');
    expect(r).toContain('(空)');
  });
});
