import { createRouter, createWebHistory } from 'vue-router';
import InboxView from './views/InboxView.vue';
import SubjectsView from './views/SubjectsView.vue';
import SubjectDetailView from './views/SubjectDetailView.vue';
import PredictionsView from './views/PredictionsView.vue';
import PredictionDetailView from './views/PredictionDetailView.vue';
import RulesView from './views/RulesView.vue';
import ReviewView from './views/ReviewView.vue';
import EventsView from './views/EventsView.vue';
import SearchView from './views/SearchView.vue';
import SettingsView from './views/SettingsView.vue';

// 页面保持静态导入：原生 WebView 内动态 import 的 chunk 加载不可靠（MyTime 教训）。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'inbox', component: InboxView },
    { path: '/subjects', name: 'subjects', component: SubjectsView },
    { path: '/subjects/:id', name: 'subject-detail', component: SubjectDetailView },
    { path: '/predictions', name: 'predictions', component: PredictionsView },
    { path: '/predictions/:id', name: 'prediction-detail', component: PredictionDetailView },
    { path: '/rules', name: 'rules', component: RulesView },
    { path: '/review', name: 'review', component: ReviewView },
    { path: '/events', name: 'events', component: EventsView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
