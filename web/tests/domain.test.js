import { describe, expect, it } from 'vitest';
import {
  validateRuleText,
  predictionEffectiveStatus,
  calibrationBuckets,
  clampPct,
  MAX_ACTIVE_PREDICTIONS,
} from '../src/lib/domain.js';

describe('validateRuleText', () => {
  it('接受合格的「如果 X,则 Y」', () => {
    expect(validateRuleText('如果收到模糊需求,则先问清验收标准再动手').ok).toBe(true);
    expect(validateRuleText('如果开会跑题,就提醒主持人拉回议程').ok).toBe(true);
    expect(validateRuleText('如果老板当场拍板,则在24小时内发邮件确认结论').ok).toBe(true);
  });
  it('拒绝空值与错误句式', () => {
    expect(validateRuleText('').ok).toBe(false);
    expect(validateRuleText('下次小心点').ok).toBe(false);
    expect(validateRuleText('如果下雨,带伞').ok).toBe(false);
  });
  it('拒绝空泛态度词(Y 部分只有态度词)', () => {
    expect(validateRuleText('如果吵架,则要冷静').ok).toBe(false);
    expect(validateRuleText('如果出错,则要细心认真').ok).toBe(false);
  });
  it('复合句中的态度词不误伤(有具体动作)', () => {
    expect(validateRuleText('如果情绪上头,则先离开10分钟再冷静回复事实').ok).toBe(true);
  });
});

describe('validateRuleText(0.3.0 起仅引导,不再阻断)', () => {
  it('「如果X则Y」给出通过提示,空泛态度词给出改进建议(均为提示性质)', () => {
    expect(validateRuleText('如果收到模糊需求,则先问清验收标准').ok).toBe(true);
    expect(validateRuleText('如果吵架,则要冷静').ok).toBe(false); // 引导提示,不阻断保存
    expect(validateRuleText('下次小心点').ok).toBe(false);
  });
});

describe('predictionEffectiveStatus', () => {
  const now = 1_000_000_000;
  it('锁定且过截止 → 待验证', () => {
    expect(predictionEffectiveStatus({ status: 'locked', windowEnd: now - 1 }, now)).toBe('verifying');
  });
  it('锁定未到截止 → 进行中', () => {
    expect(predictionEffectiveStatus({ status: 'locked', windowEnd: now + 1 }, now)).toBe('locked');
  });
  it('其他状态原样返回', () => {
    expect(predictionEffectiveStatus({ status: 'hit', windowEnd: now - 1 }, now)).toBe('hit');
    expect(predictionEffectiveStatus({ status: 'draft' }, now)).toBe('draft');
    expect(predictionEffectiveStatus(null)).toBe('draft');
  });
});

describe('calibrationBuckets', () => {
  it('hit=1 / partial=0.5 / miss=0,未验证不计入', () => {
    const preds = [
      { status: 'hit', origConfidence: 70 },
      { status: 'hit', origConfidence: 72 },
      { status: 'miss', origConfidence: 70 },
      { status: 'miss', origConfidence: 90 },
      { status: 'partial', origConfidence: 90 },
      { status: 'unverifiable', origConfidence: 80 }, // 不计
      { status: 'locked', origConfidence: 80 }, // 不计
      { status: 'abandoned', origConfidence: 60 }, // 不计
    ];
    const buckets = calibrationBuckets(preds);
    const b = Object.fromEntries(buckets.map((x) => [x.label, x]));
    expect(b['70-80%'].n).toBe(3);
    expect(b['70-80%'].rate).toBe(67); // (1+1+0)/3
    expect(b['90-100%'].n).toBe(2);
    expect(b['90-100%'].rate).toBe(25); // (0+0.5)/2
    expect(b['80-90%'].n).toBe(0);
    expect(b['80-90%'].rate).toBeNull();
    expect(b['<50%'].ideal).toBe(25);
    expect(b['90-100%'].ideal).toBe(95);
  });
  it('边界:50 → 50-60 桶,100 → 90-100 桶,49 → <50 桶', () => {
    const buckets = calibrationBuckets([
      { status: 'hit', origConfidence: 50 },
      { status: 'miss', origConfidence: 100 },
      { status: 'hit', origConfidence: 49 },
    ]);
    const b = Object.fromEntries(buckets.map((x) => [x.label, x]));
    expect(b['50-60%'].n).toBe(1);
    expect(b['90-100%'].n).toBe(1);
    expect(b['<50%'].n).toBe(1);
  });
});

describe('clampPct', () => {
  it('夹取 0-100 并取整', () => {
    expect(clampPct(120)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(66.6)).toBe(67);
  });
  it('非数值回落默认值', () => {
    expect(clampPct(null)).toBeNull();
    expect(clampPct(undefined, 50)).toBe(50);
    expect(clampPct('abc')).toBeNull();
  });
});

describe('预判上限常量', () => {
  it('进行中上限为 10-15 区间', () => {
    expect(MAX_ACTIVE_PREDICTIONS).toBeGreaterThanOrEqual(10);
    expect(MAX_ACTIVE_PREDICTIONS).toBeLessThanOrEqual(15);
  });
});
