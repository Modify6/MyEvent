<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useEventStore } from './stores/event.js';
import { useSyncStore } from './stores/sync.js';
import { isLoggedIn } from './auth/local.js';
import { ensureSeed } from './db/schema.js';

const eventStore = useEventStore();
const sync = useSyncStore();
let unwatch;

onMounted(async () => {
  unwatch = eventStore.watch();
  await ensureSeed();
  await eventStore.load();
  if (isLoggedIn()) sync.setup();
  // 原生前台恢复 → 立即同步
  window.Capacitor?.Plugins?.App?.addListener?.('resume', () => sync.trigger());
});
onUnmounted(() => unwatch?.());
</script>

<template>
  <router-view />
  <van-tabbar route safe-area-inset-bottom>
    <van-tabbar-item to="/" icon="clock-o">今日</van-tabbar-item>
    <van-tabbar-item to="/events" icon="orders-o">事件</van-tabbar-item>
    <van-tabbar-item to="/stats" icon="chart-trending-o">统计</van-tabbar-item>
    <van-tabbar-item to="/settings" icon="setting-o">设置</van-tabbar-item>
  </van-tabbar>
</template>
