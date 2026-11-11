import { createRouter, createWebHistory } from 'vue-router';
import TimelineView from './views/TimelineView.vue';
import EventsView from './views/EventsView.vue';
import EventDetailView from './views/EventDetailView.vue';
import SubjectsView from './views/SubjectsView.vue';
import SubjectDetailView from './views/SubjectDetailView.vue';
import PredictionsView from './views/PredictionsView.vue';
import PredictionDetailView from './views/PredictionDetailView.vue';
import RulesView from './views/RulesView.vue';
import ReviewView from './views/ReviewView.vue';
import SearchView from './views/SearchView.vue';
import SettingsView from './views/SettingsView.vue';
import TrashView from './views/TrashView.vue';

// 页面保持静态导入：原生 WebView 内动态 import 的 chunk 加载不可靠（MyTime 教训）。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'timeline', component: TimelineView },
    { path: '/events', name: 'events', component: EventsView },
    { path: '/events/:id', name: 'event-detail', component: EventDetailView },
    { path: '/subjects', name: 'subjects', component: SubjectsView },
    { path: '/subjects/:id', name: 'subject-detail', component: SubjectDetailView },
    // 预判:撤出底部主入口(重流程功能,按需使用),从对象页/回顾页进入
    { path: '/predictions', name: 'predictions', component: PredictionsView },
    { path: '/predictions/:id', name: 'prediction-detail', component: PredictionDetailView },
    { path: '/rules', name: 'rules', component: RulesView },
    { path: '/review', name: 'review', component: ReviewView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/trash', name: 'trash', component: TrashView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
