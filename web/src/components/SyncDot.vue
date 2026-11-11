<script setup>
// 同步状态点：显示当前同步状态；已连接时点击立即同步（手动兜底——日常全自动，无需点它），未连接时点击去设置页配置
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useSyncStore } from '../stores/sync.js';
import { isLoggedIn } from '../auth/local.js';
import { onChange } from '../db/repo.js';
import { db } from '../db/schema.js';

const sync = useSyncStore();
const router = useRouter();

// 重算信号:时间老化与跨页登录态变化(storage 事件)驱动 label/stale 重算
const tick = ref(0);
setInterval(() => tick.value++, 60_000);
window.addEventListener('storage', () => tick.value++);

const hhmm = (ts) =>
  new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

// 未上推积压:outbox 有条目 = 数据只在本地(未登录或同步失败时持续存在)——真实的数据安全信号
const pending = ref(0);
let unsubChange = null;
onMounted(() => {
  db.outbox.count().then((n) => (pending.value = n));
  unsubChange = onChange(() => db.outbox.count().then((n) => (pending.value = n)));
  window.addEventListener('online', updatePending);
});
onUnmounted(() => {
  unsubChange?.();
  window.removeEventListener('online', updatePending);
});
async function updatePending() {
  pending.value = await db.outbox.count();
}
const stale = computed(() => {
  void tick.value;
  return pending.value > 0 && (sync.status === 'error' || !isLoggedIn());
});

const label = computed(() => {
  void tick.value;
  if (sync.status === 'syncing') return '同步中';
  if (stale.value) return `${pending.value} 条未同步`;
  if (!isLoggedIn()) return '未连接';
  if (sync.status === 'error') return '同步失败';
  if (sync.status === 'ok' && sync.lastSyncAt) return `已同步 ${hhmm(sync.lastSyncAt)}`;
  if (sync.status === 'ok') return '已同步';
  return '待同步';
});

function onClick() {
  if (!isLoggedIn()) {
    router.push('/settings');
    return;
  }
  void 0;
  sync.syncManual().then((ok) => {
    showToast(ok ? `已同步 ${hhmm(Date.now())}` : `同步失败：${sync.error || '稍后自动重试'}`);
  });
}
</script>

<template>
  <span class="sync-dot" :class="stale ? 'stale' : sync.status" @click="onClick">
    <i class="led"></i>{{ label }}
  </span>
</template>

<style scoped>
.sync-dot.stale { color: #f5a623; }
.sync-dot.stale .led { background: #f5a623; }
</style>
