# MyEvent · 事件账本

基于 [MyTime 架构蓝图](../MyTime/docs/architecture.md) 生成的**个人事件管理**应用：
记录每件事的时间与地点，今日聚焦 + 时间线回顾 + 分类统计。PWA + 安卓 APK + 自建同步服务。

## 快速开始

```bash
npm install && npm install --prefix server && npm install --prefix web
npm run dev      # 开发模式 http://localhost:5173
npm run build && npm start   # 生产模式 http://localhost:3128
npm test         # 单元测试
```

默认密码 `mytime123`（环境变量 MYTIME_PASSWORD 修改）。数据在 `server/data/`。

## 架构

平台层（数据/同步/服务端/CI/发版/部署/迁移）继承自 MyTime——详见 `../MyTime/docs/architecture.md`。
领域层：events（事件：标题/分类/地点/起止/备注）+ categories。

## 打包 APK / 部署 / 版本发布

与 MyTime 完全一致：`apk.bat`（工具链自举）、`bash deploy/upload.sh`、`node scripts/release.mjs minor`。
首次使用前把 deploy/deploy.config.example 复制为 deploy/config 并填入自己的服务器。
