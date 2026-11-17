// AI 盘点提示词构建(纯函数,无 UI/存储依赖,单测覆盖见 tests/ai-prompt.test.js)
// 数据组装 + 内嵌六段分析指令 —— 解决"不知道怎么分析、范围怎么定":范围由调用方圈定,框架由指令给定
import dayjs from 'dayjs';

// 截断:超长内容加省略号,保尾部语义
const clip = (s, n = 150) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};
const fmt = (at) => dayjs(at).format('YYYY-MM-DD');
const THREAD_LABEL = { open: '进行中', done: '已完结', shelved: '已搁置', issue: '有问题' };

// 六段分析指令:AI 按此框架输出,用户粘贴回存后即为结构化复盘
const INSTRUCTIONS = `请你扮演一名认知复盘教练。基于我提供的原始记录(零散、口语化,可能有噪音),输出一份结构化盘点报告。严格使用以下 Markdown 结构:

## 一、事实梳理
按时间线归纳发生了什么:合并同类项,保留关键日期,不要逐条罗列。

## 二、模式与规律
重复出现的问题、行为、思维模式;每条必须引用记录原文短语作为证据。

## 三、判断校验
我的观点/预判与事实的矛盾之处;哪些判断被验证、哪些被推翻、哪些悬而未决。

## 四、盲点与反证
我可能忽略的角度;未处理/无结论的悬置事项清单。

## 五、下一步
3-5 条具体可执行的建议(有动作、有对象、有标准,不要空话)。

## 六、经验规则候选
2-3 条「如果X,则Y」句式的规则,可直接沉淀入经验库。

约束:只基于我给的数据,不编造;不确定的地方标注[推断];全部用中文;总长 800-1500 字。`;

const HEAD = (title) => `# ${title}\n\n以下是我的原始记录数据。请基于数据完成文末的盘点任务。\n`;

// —— 对象盘点:对象档案 + 线索/记录/预判清单 ——
export function buildSubjectPrompt(subject, { events = [], thoughts = [], predictions = [] } = {}) {
  const parts = [HEAD(`对象盘点:${subject?.name || '未命名'}`)];

  parts.push(`## 对象档案
- 名称: ${subject?.name || ''}
- 类型: ${subject?.type || ''}
- 当前观点: ${clip(subject?.currentView, 200) || '(未填)'}
- 当前置信度: ${subject?.currentConfidence != null ? subject.currentConfidence + '%' : '(未填)'}
- 核心理由: ${(subject?.topReasons || []).filter(Boolean).map((x) => clip(x)).join(' ; ') || '(未填)'}
- 最大反证: ${clip(subject?.biggestRisk, 200) || '(未填)'}
- 开放问题: ${clip(subject?.openQuestions, 200) || '(未填)'}`);

  const evs = [...events].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
  if (evs.length) {
    parts.push(`## 线索(${Math.min(evs.length, 20)}/${evs.length} 条,按开始时间倒序)
${evs.slice(0, 20).map((e) => `- [${fmt(e.startAt)}] ${clip(e.title, 60)}(状态: ${THREAD_LABEL[e.threadState] || '进行中'})${e.fact ? ' 事实: ' + clip(e.fact, 100) : ''}`).join('\n')}${evs.length > 20 ? `\n(另有 ${evs.length - 20} 条更早线索未附)` : ''}`);
  }

  const ths = [...thoughts].sort((a, b) => (b.at || 0) - (a.at || 0));
  if (ths.length) {
    parts.push(`## 记录(${Math.min(ths.length, 60)}/${ths.length} 条,按时间倒序)
${ths.slice(0, 60).map((t) => `- [${fmt(t.at)}] ${t.kind || '想法'}: ${clip(t.content)}`).join('\n')}${ths.length > 60 ? `\n(另有 ${ths.length - 60} 条更早记录未附)` : ''}`);
  }

  const preds = [...predictions].sort((a, b) => (b.madeAt || 0) - (a.madeAt || 0));
  if (preds.length) {
    parts.push(`## 预判(${Math.min(preds.length, 10)}/${preds.length} 条)
${preds.slice(0, 10).map((p) => `- [${fmt(p.madeAt)}] ${clip(p.content, 120)}(状态: ${p.status || 'draft'}, 置信度 ${p.origConfidence ?? '?'}%${p.result?.actual ? ', 实际: ' + clip(p.result.actual, 60) : ''})`).join('\n')}`);
  }

  parts.push(INSTRUCTIONS);
  return parts.join('\n\n');
}

// —— 周期盘点:周期内记录/线索动态 ——
export function buildPeriodPrompt(label, { thoughts = [], entries = [], events = [] } = {}) {
  const parts = [HEAD(`周期盘点:${label}`)];

  const ths = [...thoughts].sort((a, b) => (b.at || 0) - (a.at || 0));
  const ens = [...entries].sort((a, b) => (b.at || 0) - (a.at || 0));
  const all = [
    ...ths.map((t) => ({ at: t.at, kind: t.kind || '想法', content: t.content })),
    ...ens.map((en) => ({ at: en.at, kind: en.kind === 'summary' ? '小结' : '记录', content: en.content })),
  ].sort((a, b) => b.at - a.at);
  if (all.length) {
    parts.push(`## 本周期记录(${Math.min(all.length, 80)}/${all.length} 条,按时间倒序)
${all.slice(0, 80).map((x) => `- [${fmt(x.at)}] ${x.kind}: ${clip(x.content)}`).join('\n')}${all.length > 80 ? `\n(另有 ${all.length - 80} 条未附)` : ''}`);
  } else {
    parts.push('## 本周期记录\n(本周期暂无记录)');
  }

  const dynamic = events
    .filter((e) => e.threadState && e.threadState !== 'open')
    .map((e) => `- ${clip(e.title, 50)} → ${THREAD_LABEL[e.threadState] || e.threadState}`);
  if (dynamic.length) parts.push(`## 线索状态变化\n${dynamic.join('\n')}`);

  parts.push(INSTRUCTIONS);
  return parts.join('\n\n');
}

// 诊断报告:计数快照 + 完整提示词 + AI 回答 —— 用户一键复制发给开发者,定位"没带入数据"类问题
export function buildDebugReport({ version = '', time = '', scope = '', subject = null, rangeLabel = '-', counts = {}, storeTotals = {}, prompt = '', answer = '' } = {}) {
  const kv = (obj) => Object.entries(obj).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
  const lines = [
    '[MyEvent 诊断信息]',
    `- 版本: v${version}`,
    `- 时间: ${time}`,
    `- 盘点范围: ${scope}${subject ? `(对象「${subject.name}」 id=${subject.id})` : ''}`,
    `- 周期标签: ${rangeLabel}`,
    `- 盘点用数据计数:\n${kv(counts)}`,
    `- 全库总量(对照):\n${kv(storeTotals)}`,
    `- 提示词长度: ${String(prompt || '').length} 字`,
    '',
    '--- 提示词开始 ---',
    String(prompt || '(空)'),
    '--- 提示词结束 ---',
    '',
    '--- AI 回答开始 ---',
    String(answer || '').trim() || '(空)',
    '--- AI 回答结束 ---',
  ];
  return lines.join('\n');
}
