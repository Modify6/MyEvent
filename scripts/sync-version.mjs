// 版本贯通：web/package.json 为唯一版本源
// 同步到：根目录/server 的 package.json + app/android/app/build.gradle（versionName/versionCode）+ .apk-version
// 用法：node scripts/sync-version.mjs（apk.bat 打包与 release.mjs 发版前自动执行）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/package.json'), 'utf8'));
const version = pkg.version; // e.g. "0.2.0"
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`版本号格式异常: ${version}`);
  process.exit(1);
}
const [major, minor, patch] = version.split('.').map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

// —— package.json 贯通（根目录 / server）：写前比对，无变化不动文件 ——
for (const rel of ['package.json', 'server/package.json']) {
  const p = path.join(ROOT, rel);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (j.version !== version) {
    j.version = version;
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    console.log(`版本已写入: ${rel} → v${version}`);
  } else {
    console.log(`版本已同步: ${rel} (v${version})`);
  }
}

const gradlePath = path.join(ROOT, 'app/android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const before = gradle;
gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`);

if (gradle === before) {
  console.log(`版本已同步: build.gradle (v${version}, code ${versionCode})`);
} else {
  fs.writeFileSync(gradlePath, gradle);
  console.log(`版本已写入: versionName ${version} · versionCode ${versionCode}`);
}
// 供打包脚本读取，给打包产物命名（MyEvent-v<版本>.apk）
fs.writeFileSync(path.join(ROOT, '.apk-version'), version);
