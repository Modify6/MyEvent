import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router.js';
import { initLogger } from './lib/logger.js';
import { isNative, applyNativeSafeArea } from './lib/native.js';
import { migrateLegacyKeys } from './auth/local.js';
import './styles/main.css';

// MyTime 时期 localStorage key → myevent.* 一次性迁移
migrateLegacyKeys();
// 函数式组件的样式需手动引入（模板组件由 unplugin-vue-components 自动按需引入）
import 'vant/es/toast/style';
import 'vant/es/dialog/style';

// 安卓 APK：禁用 PWA Service Worker（资源随 APK 分发，旧 SW 缓存会导致资源陈旧、
// 路由懒加载 chunk 拿不到），并清理历史注册的 SW
if (typeof window !== 'undefined' && window.Capacitor) {
  applyNativeSafeArea();
  navigator.serviceWorker?.getRegistrations?.()?.then?.((rs) => rs.forEach((r) => r.unregister()));
} else {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

// 深色模式跟随系统：页面配色走 CSS 变量，Vant 用根类 van-theme-dark 切换
const applyTheme = () => {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('van-theme-dark', !!dark);
};
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', applyTheme);

initLogger();

// 数据安全:请求持久化存储 —— 浏览器不再因磁盘紧张自动回收 IndexedDB(被拒仅记日志,不阻塞)
navigator.storage?.persist?.().then?.((ok) => {
  if (!ok) console.warn('[storage] persist 未获批准,数据仍可能被浏览器回收,建议连接云端同步');
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
