<script setup>
// 挂靠怎么选:对象 vs 线索 vs 裸记 的判断依据(想不通时的随身参考)
const props = defineProps({
  show: { type: Boolean, default: false },
});
const emit = defineEmits(['update:show']);
</script>

<template>
  <van-popup :show="show" position="bottom" round style="height: 68vh; overflow: auto" @update:show="emit('update:show', $event)">
    <div class="popup-safe form-wrap">
      <div class="pop-head">
        <span>挂靠怎么选?</span>
        <van-button size="small" plain round @click="emit('update:show', false)">关闭</van-button>
      </div>

      <div class="motto">
        <span style="color: #34c273; font-weight: 700">对象</span> = <b>关于谁</b>(长期主体) ·
        <span style="color: var(--brand-2); font-weight: 700">线索</span> = <b>哪件事</b>(有始有终) ·
        <span style="color: #f5a623; font-weight: 700">想法</span> = 念头本身
      </div>

      <div class="card-mini">
        <div class="row"><span class="who">对象</span><span>长期关注的主体:一个项目 / 一个人 / 一家公司 / 一个主题。没有期限,看它时问「我对它的判断怎么演化的?」</span></div>
        <div class="row"><span class="what">线索</span><span>要推进的具体事情:一轮重构 / 一次谈判 / 一个决策。有起点有过程,看它时问「这件事推进到哪了?」</span></div>
        <div class="row"><span class="none">裸记</span><span>拿不准就不挂。归类成本永远是零 —— 随时可编辑改挂靠。</span></div>
      </div>

      <div class="block-label">例子:随手记录对 MyEvent 的想法</div>
      <div class="card-mini">
        <div class="row">① 建<span class="who">对象「MyEvent」</span>,想法随手记、挂 @MyEvent —— 对象页就是想法演化史</div>
        <div class="row">② 某个想法要落地了(比如"做筛选功能")→ 建<span class="what">线索「记录流筛选」</span>挂到 MyEvent 下,过程记到线索里</div>
        <div class="row">③ 做完写小结,水到渠成</div>
      </div>

      <div class="block-label">演化路径(不用一开始就想清楚)</div>
      <div class="path">随手记 → 想法围着某主题转,挂对象 → 某件事要推进,建线索 → 小结</div>

      <div class="tip">💡 判断信号:同一件事的念头在不同场合反复冒出来 —— 它已经从「想法」长成「事件」了,该建线索。</div>
    </div>
  </van-popup>
</template>

<style scoped>
.form-wrap { padding: 18px 14px 6px; }
.pop-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.motto { font-size: 14px; text-align: center; padding: 10px; border-radius: 10px; background: color-mix(in srgb, var(--brand) 8%, transparent); margin-bottom: 12px; }
.motto b { color: var(--brand); }
.card-mini { background: var(--card-2); border-radius: 10px; padding: 10px 12px; }
.row { display: flex; gap: 8px; font-size: 13px; line-height: 1.7; padding: 4px 0; align-items: flex-start; }
.row > span:first-child { flex: none; }
.who { color: var(--brand); font-weight: 700; }
.what { color: var(--brand-2); font-weight: 700; }
.none { color: var(--text-3); font-weight: 700; }
.block-label { font-size: 12px; color: var(--text-3); margin: 14px 2px 6px; }
.path { font-size: 13px; background: var(--card-2); border-radius: 10px; padding: 10px 12px; text-align: center; color: var(--text-2); }
.tip { font-size: 13px; margin: 12px 2px 4px; color: var(--text-2); line-height: 1.7; }
</style>
