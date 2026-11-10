<script setup>
// 设置页:多设备同步 / 数据导出导入 / 运行日志 / 关于 + 版本迭代
import { onMounted, ref } from 'vue';
import { showToast } from 'vant';
import dayjs from 'dayjs';
import { useAuthStore } from '../stores/auth.js';
import { useSyncStore } from '../stores/sync.js';
import { getLogs, logsToText, clearLogs, APP_VERSION } from '../lib/logger.js';
import { db } from '../db/schema.js';
import { adoptRow } from '../db/repo.js';
import { api } from '../api/client.js';
import SyncDot from '../components/SyncDot.vue';
import VersionHistory from '../components/VersionHistory.vue';

const DATA_TABLES = ['categories', 'events', 'subjects', 'thoughts', 'predictions', 'rules'];

const auth = useAuthStore();
const sync = useSyncStore();
const serverUrl = ref('');
const password = ref('');
const loggingIn = ref(false);
const logsText = ref('');
const showLogs = ref(false);
const showVersionHistory = ref(false);
const importing = ref(false);
const lastBackupAt = ref('');

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

// —— 数据导出/导入(本地文件,不依赖服务器) ——
async function exportData() {
  try {
    const data = { app: 'myevent', version: 2, exportedAt: Date.now() };
    for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `myevent-backup-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('已导出 JSON');
  } catch (e) {
    showToast(`导出失败:${e?.message || e}`);
  }
}

async function onImportFile(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  importing.value = true;
  try {
    const data = JSON.parse(await file.text());
    let n = 0;
    for (const t of DATA_TABLES) {
      for (const row of data[t] || []) {
        // adoptRow 内含 LWW 裁决与 JSON 列规范化;push=true 使导入也上推服务器
        if (await adoptRow(t, row, { push: true })) n++;
      }
    }
    showToast(`导入完成:采纳 ${n} 条(按时间戳合并,不覆盖新数据)`);
  } catch (e) {
    showToast(`导入失败:${e?.message || '文件格式不正确'}`);
  } finally {
    importing.value = false;
  }
}

async function backupNow() {
  try {
    const res = await api.serverBackup();
    lastBackupAt.value = dayjs(res.time).format('M月D日 HH:mm');
    showToast('已在服务器创建快照');
  } catch (e) {
    showToast(e.message || '备份失败');
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
      <div class="section-title" style="margin-top: 0">数据 · 导出 / 导入</div>
      <div class="muted" style="margin-bottom: 10px">本地数据完全归你:导出 JSON 随时带走;导入按修改时间合并,不覆盖新数据。</div>
      <div class="btn-row">
        <van-button size="small" plain round type="primary" icon="down" @click="exportData">导出 JSON</van-button>
        <label class="import-label">
          <input type="file" accept="application/json,.json" :disabled="importing" @change="onImportFile" />
          <span class="van-button--default">{{ importing ? '导入中…' : '导入 JSON' }}</span>
        </label>
        <van-button v-if="auth.hasToken" size="small" plain round icon="records" @click="backupNow">服务器快照</van-button>
      </div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">运行日志</div>
      <van-button size="small" plain round icon="records" @click="copyLogs">复制全部日志</van-button>
      <van-button size="small" plain round style="margin-left: 8px" type="danger" @click="clearLogs(); showToast('已清空')">清空</van-button>
      <div class="muted" style="margin-top: 6px">App 出问题时把日志复制发给开发者。</div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">关于</div>
      <div class="muted">MyEvent v{{ APP_VERSION }} · 个人认知复盘系统。记录事实与想法的演化,验证预判,沉淀可复用的经验规则。</div>
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
.btn-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.import-label { position: relative; display: inline-flex; }
.import-label input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.import-label span {
  display: inline-flex;
  align-items: center;
  padding: 0 15px;
  height: 30px;
  font-size: 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--text-2);
  cursor: pointer;
}
</style>
