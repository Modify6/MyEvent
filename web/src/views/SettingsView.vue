<script setup>
// 设置页：多设备同步 / 运行日志 / 关于 + 版本迭代（全部为平台件）
import { onMounted, onUnmounted, ref } from 'vue';
import { showToast } from 'vant';
import { useAuthStore } from '../stores/auth.js';
import { useSyncStore } from '../stores/sync.js';
import { getLogs, logsToText, clearLogs, APP_VERSION } from '../lib/logger.js';
import SyncDot from '../components/SyncDot.vue';
import VersionHistory from '../components/VersionHistory.vue';

const auth = useAuthStore();
const sync = useSyncStore();
const serverUrl = ref('');
const password = ref('');
const loggingIn = ref(false);
const logsText = ref('');
const showLogs = ref(false);
const showVersionHistory = ref(false);

onMounted(async () => {
  if (auth.hasToken) sync.setup();
  serverUrl.value = auth.serverUrl || '';
});

async function login() {
  loggingIn.value = true;
  try {
    await auth.login(serverUrl.value.trim(), password.value);
    sync.setup();
    showToast('已连接并同步');
  } catch (e) {
    showToast(e.message || '连接失败');
  } finally {
    loggingIn.value = false;
  }
}
async function logout() {
  await auth.logout();
  showToast('已断开');
}
async function copyLogs() {
  logsText.value = await logsToText(500);
  try {
    await navigator.clipboard.writeText(logsText.value);
    showToast('日志已复制');
  } catch {
    showLogs.value = true;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head"><h1>设置</h1><SyncDot /></div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">多设备同步</div>
      <template v-if="!auth.hasToken">
        <van-field v-model="serverUrl" label="服务器" placeholder="留空 = 本机服务（同源）" clearable />
        <van-field v-model="password" label="密码" type="password" placeholder="服务端访问密码" />
        <div style="margin-top: 10px">
          <van-button type="primary" round block :loading="loggingIn" @click="login">连接并同步</van-button>
        </div>
      </template>
      <template v-else>
        <div class="muted">服务器：{{ auth.serverUrl || '本机服务（同源）' }}</div>
        <div style="margin-top: 10px"><van-button round block plain type="primary" @click="logout">断开</van-button></div>
      </template>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">运行日志</div>
      <van-button size="small" plain round icon="records" @click="copyLogs">复制全部日志</van-button>
      <van-button size="small" plain round style="margin-left: 8px" type="danger" @click="clearLogs(); showToast('已清空')">清空</van-button>
      <div class="muted" style="margin-top: 6px">App 出问题时把日志复制发给开发者。</div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">关于</div>
      <div class="muted">MyEvent v{{ APP_VERSION }} · 个人事件管理。记录每件事的时间与地点，回顾时间流向。</div>
      <div class="about-row" @click="showVersionHistory = true">
        <span>版本迭代</span>
        <span class="about-link">v{{ APP_VERSION }} ›</span>
      </div>
    </div>

    <VersionHistory v-model:show="showVersionHistory" />

    <van-popup v-model:show="showLogs" position="bottom" round style="height: 70vh">
      <pre class="logs-pre">{{ logsText }}</pre>
    </van-popup>
  </div>
</template>

<style scoped>
.about-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  cursor: pointer;
}
.about-link { color: var(--brand); font-size: 12px; }
.logs-pre { padding: 16px; font-size: 11px; white-space: pre-wrap; word-break: break-all; overflow: auto; height: 100%; }
</style>
