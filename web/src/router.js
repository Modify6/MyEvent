import { createRouter, createWebHistory } from 'vue-router';
import TodayView from './views/TodayView.vue';
import EventsView from './views/EventsView.vue';
import StatsView from './views/StatsView.vue';
import SettingsView from './views/SettingsView.vue';

// 页面保持静态导入：原生 WebView 内动态 import 的 chunk 加载不可靠（MyTime 教训）。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'today', component: TodayView },
    { path: '/events', name: 'events', component: EventsView },
    { path: '/stats', name: 'stats', component: StatsView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});

export default router;
