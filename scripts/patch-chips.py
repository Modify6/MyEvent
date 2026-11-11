# -*- coding: utf-8 -*-
# 一次性补丁:弹层 chips 上色 + 标签图标 + 说明重点词
import io

# 1) display.js:chip 样式助手
p = 'web/src/lib/display.js'
s = io.open(p, encoding='utf-8').read()
if 'kindChipStyle' not in s:
    s += '''
// —— 弹层表单 chips:与时间线标签同色系 ——
export const kindChipStyle = (k, active = false) => {
  const m = KIND_META[k] || { color: '#98a2b3', icon: '📝' };
  return {
    color: m.color,
    borderColor: m.color + (active ? '' : '59'),
    background: active ? m.color + '1f' : 'transparent',
    fontWeight: active ? 700 : 400,
  };
};
export const trigChipStyle = (k, active = false) => ({
  color: active ? '#4f6ef7' : 'inherit',
  borderColor: active ? '#4f6ef7' : '',
  background: active ? '#4f6ef71f' : 'transparent',
  fontWeight: active ? 700 : 400,
});
'''
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('display ok')

# 2) NoteComposer
p = 'web/src/components/NoteComposer.vue'
s = io.open(p, encoding='utf-8').read()
if 'kindChipStyle' not in s:
    s = s.replace(
        "import { TRIGGER_KINDS, THOUGHT_KINDS } from '../lib/domain.js';",
        "import { TRIGGER_KINDS, THOUGHT_KINDS } from '../lib/domain.js';\n"
        "import { kindChipStyle, kindMeta, trigChipStyle, TRIGGER_ICON } from '../lib/display.js';")
    old = '''          <div class="block-label">类型 · 这是一条什么性质的记录</div>
          <div class="chip-row">
            <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
          </div>'''
    assert old in s, 'nc1'
    s = s.replace(old, '''          <div class="block-label">🏷 类型 · 这是一条什么性质的记录</div>
          <div class="chip-row">
            <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" :style="kindChipStyle(k, kind === k)" @click="kind = k">{{ kindMeta(k).icon }} {{ k }}</button>
          </div>''')
    old2 = '''        <div class="block-label">触发源 · 由什么引发(选填)</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" @click="triggerKind = triggerKind === k ? '' : k">{{ k }}</button>
        </div>'''
    assert old2 in s, 'nc2'
    s = s.replace(old2, '''        <div class="block-label">📌 触发源 · 由什么引发(选填)</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" :style="trigChipStyle(k, triggerKind === k)" @click="triggerKind = triggerKind === k ? '' : k">{{ TRIGGER_ICON[k] }} {{ k }}</button>
        </div>''')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('notecomposer ok')

# 3) NoteEditor
p = 'web/src/components/NoteEditor.vue'
s = io.open(p, encoding='utf-8').read()
if 'kindChipStyle' not in s:
    s = s.replace(
        "import { TRIGGER_KINDS, THOUGHT_KINDS } from '../lib/domain.js';",
        "import { TRIGGER_KINDS, THOUGHT_KINDS } from '../lib/domain.js';\n"
        "import { kindChipStyle, kindMeta, trigChipStyle, TRIGGER_ICON } from '../lib/display.js';")
    old = '''        <div class="block-label">类型</div>
        <div class="chip-row">
          <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: form.kind === k }" @click="form.kind = k">{{ k }}</button>
        </div>'''
    assert old in s, 'ne1'
    s = s.replace(old, '''        <div class="block-label">🏷 类型 · 这是一条什么性质的记录</div>
        <div class="chip-row">
          <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: form.kind === k }" :style="kindChipStyle(k, form.kind === k)" @click="form.kind = k">{{ kindMeta(k).icon }} {{ k }}</button>
        </div>''')
    old2 = '''        <div class="block-label">触发源</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: form.triggerKind === k }" @click="form.triggerKind = form.triggerKind === k ? '' : k">{{ k }}</button>
        </div>'''
    assert old2 in s, 'ne2'
    s = s.replace(old2, '''        <div class="block-label">📌 触发源 · 由什么引发</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: form.triggerKind === k }" :style="trigChipStyle(k, form.triggerKind === k)" @click="form.triggerKind = form.triggerKind === k ? '' : k">{{ TRIGGER_ICON[k] }} {{ k }}</button>
        </div>''')
    old3 = '''        <div class="block-label">挂到线索</div>'''
    assert old3 in s, 'ne3'
    s = s.replace(old3, '''        <div class="block-label">🧵 挂到线索 · 哪件事</div>''')
    old4 = '''        <div class="block-label">挂到对象</div>'''
    assert old4 in s, 'ne4'
    s = s.replace(old4, '''        <div class="block-label">🎯 挂到对象 · 关于谁</div>''')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('noteeditor ok')

# 4) EventComposer
p = 'web/src/components/EventComposer.vue'
s = io.open(p, encoding='utf-8').read()
if 'TRIGGER_ICON' not in s:
    s = s.replace(
        "import { TRIGGER_KINDS } from '../lib/domain.js';",
        "import { TRIGGER_KINDS } from '../lib/domain.js';\n"
        "import { trigChipStyle, TRIGGER_ICON } from '../lib/display.js';")
    old = '''      <div class="block-label">触发源 —— 这件事由什么引发?(选填,记下出发原因)</div>
      <div class="chip-row">
        <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" @click="triggerKind = triggerKind === k ? '' : k">{{ k }}</button>
      </div>'''
    assert old in s, 'ec1'
    s = s.replace(old, '''      <div class="block-label">📌 触发源 —— 这件事由什么引发?(选填,记下出发原因)</div>
      <div class="chip-row">
        <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" :style="trigChipStyle(k, triggerKind === k)" @click="triggerKind = triggerKind === k ? '' : k">{{ TRIGGER_ICON[k] }} {{ k }}</button>
      </div>''')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('eventcomposer ok')

# 5) TimelineView 细节区
p = 'web/src/views/TimelineView.vue'
s = io.open(p, encoding='utf-8').read()
if 'kindChipStyle' not in s:
    s = s.replace(
        "import { kindChipStyle, kindMeta, trigChipStyle, TRIGGER_ICON, parseTrigger } from '../lib/display.js';",
        "import { kindChipStyle, kindMeta, trigChipStyle, TRIGGER_ICON, parseTrigger } from '../lib/display.js';")
    old = '''        <div class="block-label">类型</div>
        <div class="chip-row">
          <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
        </div>
        <div class="block-label">触发源</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" @click="triggerKind = triggerKind === k ? '' : k">{{ k }}</button>
        </div>'''
    assert old in s, 'tv1'
    s = s.replace(old, '''        <div class="block-label">🏷 类型 · 这是一条什么性质的记录</div>
        <div class="chip-row">
          <button v-for="k in THOUGHT_KINDS" :key="k" class="tag-chip" :class="{ active: kind === k }" :style="kindChipStyle(k, kind === k)" @click="kind = k">{{ kindMeta(k).icon }} {{ k }}</button>
        </div>
        <div class="block-label">📌 触发源 · 由什么引发</div>
        <div class="chip-row">
          <button v-for="k in TRIGGER_KINDS" :key="k" class="tag-chip" :class="{ active: triggerKind === k }" :style="trigChipStyle(k, triggerKind === k)" @click="triggerKind = triggerKind === k ? '' : k">{{ TRIGGER_ICON[k] }} {{ k }}</button>
        </div>''')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('timeline ok')

# 6) QuickCreate 类型 chips 上色
p = 'web/src/components/QuickCreate.vue'
s = io.open(p, encoding='utf-8').read()
if 'typeColor' not in s:
    s = s.replace(
        "import { SUBJECT_TYPES } from '../lib/domain.js';",
        "import { SUBJECT_TYPES } from '../lib/domain.js';\n"
        "import { typeColor } from '../lib/display.js';")
    old = '''        <div class="block-label">类型</div>
        <div class="chip-row">
          <button v-for="t in SUBJECT_TYPES" :key="t" class="tag-chip" :class="{ active: subjectType === t }" @click="subjectType = t">{{ t }}</button>
        </div>'''
    assert old in s, 'qc1'
    s = s.replace(old, '''        <div class="block-label">🎯 类型</div>
        <div class="chip-row">
          <button v-for="t in SUBJECT_TYPES" :key="t" class="tag-chip" :class="{ active: subjectType === t }" :style="{ color: typeColor(t), borderColor: typeColor(t) + (subjectType === t ? '' : '59'), background: subjectType === t ? typeColor(t) + '1f' : 'transparent', fontWeight: subjectType === t ? 700 : 400 }" @click="subjectType = t">{{ t }}</button>
        </div>''')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('quickcreate ok')

# 7) 说明重点词上色
p = 'web/src/views/RulesView.vue'
s = io.open(p, encoding='utf-8').read()
old = '<div class="hint-line hint-brand">📜 规则 = 沉淀下来的「遇到 X 就怎么做」;实际用了一次,就点下面的「这次有效/无效」登记 —— 让规则自己被验证</div>'
assert old in s, 'rv1'
new = '<div class="hint-line hint-brand">📜 <b>规则</b> = 沉淀下来的「遇到 X 就怎么做」;实际用了一次,就点下面的「这次<b style="color: #34c273">有效</b>/<b style="color: var(--danger)">无效</b>」登记 —— 让规则自己被验证</div>'
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

p = 'web/src/views/EventDetailView.vue'
s = io.open(p, encoding='utf-8').read()
old = '<div class="hint-line hint-brand">记一笔 = 过程中的一个点(新进展/新信息/新想法) · 写小结 = 阶段性回顾,想到哪写到哪,随时可再补</div>'
assert old in s, 'ed1'
new = '<div class="hint-line hint-brand"><b style="color: #8f9bb3">记一笔</b> = 过程中的一个点(新进展/新信息/新想法) · <b style="color: var(--brand)">写小结</b> = 阶段性回顾,想到哪写到哪,随时可再补</div>'
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

p = 'web/src/views/SubjectDetailView.vue'
s = io.open(p, encoding='utf-8').read()
old = '<div class="empty-tip" style="padding: 10px 0">还没有形成当前观点 —— 记下你此刻的判断、置信度和最大反证</div>'
assert old in s, 'sd1'
s = s.replace(old, '<div class="empty-tip" style="padding: 10px 0">还没有形成当前观点 —— 记下你此刻的<b style="color: var(--brand)">判断</b>、<b style="color: #f5a623">置信度</b>和<b style="color: var(--danger)">最大反证</b></div>')
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('hints ok')
print('ALL DONE')
