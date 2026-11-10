<script setup>
// 应用外壳:预载全部领域 store + 5 主入口 tabbar(收件箱/对象/预判/经验库/回顾)
// 收件箱 tab 徽标 = 待复盘事件 + 想法收件箱 + 待验证预判
import { computed, onMounted, onUnmounted } from 'vue';
import { useEventStore } from './stores/event.js';
import { useThoughtStore } from './stores/thought.js';
import { usePredictionStore } from './stores/prediction.js';
import { useSubjectStore } from './stores/subject.js';
import { useRuleStore } from './stores/rule.js';
import { useCatalogStore } from './stores/catalog.js';
import { useSyncStore } from './stores/sync.js';
import { isLoggedIn } from './auth/local.js';
import { ensureSeed } from './db/schema.js';

const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const subjectStore = useSubjectStore();
const ruleStore = useRuleStore();
const catalog = useCatalogStore();
const sync = useSyncStore();

let unsubs = [];

onMounted(async () => {
  unsubs = [
    eventStore.watch(),
    thoughtStore.watch(),
    predictionStore.watch(),
    subjectStore.watch(),
    ruleStore.watch(),
    catalog.watch(),
  ];
  await ensureSeed();
  await Promise.all([
    eventStore.load(),
    thoughtStore.load(),
    predictionStore.load(),
    subjectStore.load(),
    ruleStore.load(),
    catalog.load(),
  ]);
  if (isLoggedIn()) sync.setup();
  // 原生前台恢复 → 立即同步
  window.Capacitor?.Plugins?.App?.addListener?.('resume', () => sync.trigger());
});
onUnmounted(() => unsubs.forEach((u) => u?.()));

const inboxBadge = computed(() => {
  const n = eventStore.inbox.length + thoughtStore.inbox.length + predictionStore.due.length;
  return n > 99 ? '99+' : n > 0 ? String(n) : '';
});
</script>

<template>
  <router-view />
  <van-tabbar route safe-area-inset-bottom>
    <van-tabbar-item to="/" icon="todo-list-o" :badge="inboxBadge">收件箱</van-tabbar-item>
    <van-tabbar-item to="/subjects" icon="apps-o">对象</van-tabbar-item>
    <van-tabbar-item to="/predictions" icon="aim">预判</van-tabbar-item>
    <van-tabbar-item to="/rules" icon="bookmark-o">经验库</van-tabbar-item>
    <van-tabbar-item to="/review" icon="chart-trending-o">回顾</van-tabbar-item>
  </van-tabbar>
</template>
