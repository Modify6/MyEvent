<script setup>
// 全局搜索:对象 / 事件 / 想法 / 预判 / 规则 的标题与内容匹配(个人量级内存过滤)
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSubjectStore } from '../stores/subject.js';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import { useRuleStore } from '../stores/rule.js';

const router = useRouter();
const subjectStore = useSubjectStore();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const ruleStore = useRuleStore();
const q = ref('');

const hit = (s) => String(s || '').toLowerCase().includes(q.value.trim().toLowerCase());

const sections = computed(() => {
  const kw = q.value.trim();
  if (!kw) return [];
  const lim = (arr, n = 8) => arr.slice(0, n);
  return [
    {
      key: 'subjects',
      label: '对象',
      items: lim(subjectStore.active.filter((s) => hit(s.name) || hit(s.currentView) || (s.tags || []).some(hit)).map((s) => ({ id: s.id, text: s.name, sub: s.type, to: `/subjects/${s.id}` }))),
    },
    {
      key: 'events',
      label: '事件',
      items: lim(eventStore.active.filter((e) => hit(e.title) || hit(e.fact)).map((e) => ({ id: e.id, text: e.title, sub: e.status === 'reviewed' ? '已复盘' : '待复盘', to: '/events' }))),
    },
    {
      key: 'thoughts',
      label: '想法',
      items: lim(thoughtStore.active.filter((t) => hit(t.content) || hit(t.basis)).map((t) => ({ id: t.id, text: t.content, sub: t.kind, to: '/' }))),
    },
    {
      key: 'predictions',
      label: '预判',
      items: lim(predictionStore.active.filter((p) => hit(p.content) || hit(p.basis)).map((p) => ({ id: p.id, text: p.content, sub: p.kind, to: `/predictions/${p.id}` }))),
    },
    {
      key: 'rules',
      label: '规则',
      items: lim(ruleStore.active.filter((r) => hit(r.content) || hit(r.scene) || hit(r.trigger)).map((r) => ({ id: r.id, text: r.content, sub: r.scene || '通用', to: '/rules' }))),
    },
  ].filter((s) => s.items.length);
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="head-name"><van-icon name="arrow-left" size="20" @click="router.back()" />搜索</h1>
    </div>

    <van-search v-model="q" placeholder="搜对象 / 事件 / 想法 / 预判 / 规则" shape="round" background="transparent" />

    <template v-for="s in sections" :key="s.key">
      <div class="section-title">{{ s.label }} · {{ s.items.length }}</div>
      <div class="card">
        <div v-for="it in s.items" :key="it.id" class="s-line" @click="router.push(it.to)">
          <div class="row-main">
            <div class="s-text">{{ it.text }}</div>
            <div class="muted">{{ it.sub }}</div>
          </div>
          <van-icon name="arrow" color="var(--text-3)" />
        </div>
      </div>
    </template>
    <div v-if="q.trim() && !sections.length" class="card"><div class="empty-tip">没有匹配「{{ q }}」的记录</div></div>
    <div v-if="!q.trim()" class="card"><div class="empty-tip">输入关键词,横跨五类记录查找</div></div>
  </div>
</template>

<style scoped>
.head-name { display: flex; align-items: center; gap: 10px; }
.head-name .van-icon { color: var(--text-2); cursor: pointer; }
.s-line { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.s-line:last-child { border-bottom: 0; }
.row-main { flex: 1; min-width: 0; }
.s-text { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
