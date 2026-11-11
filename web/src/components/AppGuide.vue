<script setup>
// 使用指南:全部核心概念一页总表 —— 防误用的统一参考(设置页入口)
const props = defineProps({
  show: { type: Boolean, default: false },
});
const emit = defineEmits(['update:show']);

const concepts = [
  {
    name: '记录',
    icon: '💡',
    text: '最小单元:一个念头、一个进展、一句感想。在记录页随手记,可挂线索/对象,可带触发源。点击=修改,长按=编辑/删除;所有修改原文自动存档。',
  },
  {
    name: '线索(事件)',
    icon: '🧵',
    text: '一件持续跟进的事(一轮研究/一次谈判/一个决策)。它的详情页 = 完整过程时间线:过程记录 + 挂过来的想法 + 小结。完结/搁置只是标记,随时可改。',
  },
  {
    name: '对象',
    icon: '🎯',
    text: '长期关注的主体:一个项目/一个人/一家公司/一个主题。挂想法、挂线索、做预判——对象页时间线就是「我对它的认知演化史」。顶部「当前观点」写此刻的核心判断,回看时对比。',
  },
  {
    name: '挂靠怎么选',
    icon: '🧭',
    text: '对象 = 关于谁(长期主体);线索 = 哪件事(有始有终);拿不准就裸记不挂——归类成本为零,随时可改。同一件事的念头反复冒出来,就把它转成线索。',
  },
  {
    name: '触发源',
    icon: '🎬',
    text: '这条记录由什么引发:事情/视频/文章/人/对话/场景/灵感。回顾页会统计分布——看什么最容易影响你的想法和情绪。',
  },
  {
    name: '小结',
    icon: '✦',
    text: '线索页「写小结」:完全自由的一段话,想写多少写多少,可多次、随时补,时间线里高亮。没有格式要求——总结是水到渠成的事。',
  },
  {
    name: '经验规则',
    icon: '📜',
    text: '沉淀下来的「遇到 X 就怎么做」。推荐「如果…则…」句式但不强制;实际用了一次就点「这次有效/无效」登记,让规则自己被验证。',
  },
  {
    name: '预判(按需)',
    icon: '🎯',
    text: '可证伪的判断:提交时定死验证标准和置信度并锁定(之后不可改),到期按原标准评分命中/部分/错误。回顾页的校准统计会告诉你:你说的 70% 是不是真的 70%。',
  },
  {
    name: '同步与数据',
    icon: '☁️',
    text: '本地优先:不连服务器一切照常。连接后各端自动合并(按修改时间,不覆盖新数据),云端是备份副本。导出 JSON 可带走全部数据;删除是软删,改动有修订历史。',
  },
];
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 82vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>使用指南</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>
      <div class="motto">
        <span style="color: #8f9bb3; font-weight: 700">记录</span>是砖 →
        <span style="color: var(--brand); font-weight: 700">线索</span>是用砖砌的一段墙 →
        <span style="color: var(--brand-2); font-weight: 700">对象</span>是整栋楼。
        <br />散放一块砖也没关系,以后随时砌回去。
      </div>

      <div v-for="c in concepts" :key="c.name" class="concept">
        <div class="c-name">{{ c.icon }} {{ c.name }}</div>
        <div class="c-text">{{ c.text }}</div>
      </div>

      <div class="tip">💡 找旧记录:用搜索,或去线索/对象页看聚合时间线;记录页只显示最近 50 条,底部可加载更多。</div>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.motto { font-size: 13px; text-align: center; padding: 10px; border-radius: 10px; background: color-mix(in srgb, var(--brand) 8%, transparent); margin-bottom: 14px; line-height: 1.7; }
.concept { padding: 10px 0; border-bottom: 1px solid var(--line); }
.concept:last-of-type { border-bottom: 0; }
.c-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.c-text { font-size: 13px; color: var(--text-2); line-height: 1.7; }
.tip { font-size: 12px; color: var(--text-3); margin: 12px 2px 4px; line-height: 1.7; }
</style>
