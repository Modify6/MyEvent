<script setup>
// 应用外壳:预载全部领域 store + 5 主入口 tabbar(记录/事件/对象/经验/回顾)
// 0.3.0 过程记录驱动:无待办徽标、无催促 —— 预判入口收进对象页与回顾页
import { onMounted, onUnmounted } from 'vue';
import { useEventStore } from './stores/event.js';
import { useThoughtStore } from './stores/thought.js';
import { usePredictionStore } from './stores/prediction.js';
import { useSubjectStore } from './stores/subject.js';
import { useRuleStore } from './stores/rule.js';
import { useCatalogStore } from './stores/catalog.js';
import { useFolderStore } from './stores/folder.js';
import { useSyncStore } from './stores/sync.js';
import { isLoggedIn } from './auth/local.js';
import { ensureSeed } from './db/schema.js';

const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const subjectStore = useSubjectStore();
const ruleStore = useRuleStore();
const catalog = useCatalogStore();
const folderStore = useFolderStore();
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
    folderStore.watch(),
  ];
  await ensureSeed();
  await Promise.all([
    eventStore.load(),
    thoughtStore.load(),
    predictionStore.load(),
    subjectStore.load(),
    ruleStore.load(),
    catalog.load(),
    folderStore.load(),
  ]);
  if (isLoggedIn()) sync.setup();
  // 原生前台恢复 → 立即同步
  window.Capacitor?.Plugins?.App?.addListener?.('resume', () => sync.trigger());
});
onUnmounted(() => unsubs.forEach((u) => u?.()));
</script>

<template>
  <router-view />
  <van-tabbar route safe-area-inset-bottom>
    <van-tabbar-item to="/" icon="edit">记录</van-tabbar-item>
    <van-tabbar-item to="/events" icon="orders-o">事件</van-tabbar-item>
    <van-tabbar-item to="/subjects" icon="apps-o">对象</van-tabbar-item>
    <van-tabbar-item to="/rules" icon="bookmark-o">经验</van-tabbar-item>
    <van-tabbar-item to="/review" icon="chart-trending-o">回顾</van-tabbar-item>
  </van-tabbar>
</template>
