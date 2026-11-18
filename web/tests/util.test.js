// 通用工具测试:筛选选项排序(频次/名称,全部类置顶)
import { describe, expect, it } from 'vitest';
import { sortFilterOptions } from '../src/lib/util.js';

const opts = [
  { text: '全部类型', value: '', count: 30 },
  { text: '想法', value: '想法', count: 12 },
  { text: '疑问', value: '疑问', count: 12 },
  { text: '小结', value: '小结', count: 3 },
  { text: '零', value: '零', count: 0 },
];

describe('sortFilterOptions', () => {
  it('默认频次降序,同频按中文名,全部类置顶', () => {
    const r = sortFilterOptions(opts, 'freq');
    expect(r[0].value).toBe('');
    expect(r[1].text).toBe('想法');
    expect(r[2].text).toBe('疑问');
    expect(r[r.length - 1].text).toBe('零');
  });

  it('名称模式:按中文拼音/字形排序,全部类仍置顶', () => {
    const r = sortFilterOptions(opts, 'name');
    expect(r[0].value).toBe('');
    const names = r.slice(1).map((o) => o.text);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh')));
  });

  it('未知模式回落频次;空数组不报错', () => {
    expect(sortFilterOptions(opts, 'bogus')[0].value).toBe('');
    expect(sortFilterOptions([], 'freq')).toEqual([]);
  });
});
