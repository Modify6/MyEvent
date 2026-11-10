# MyEvent · 认知复盘

**个人认知复盘系统**：以「对象」为中心，同时记录外部事件与内部想法的演化；预判先锁定再验证，沉淀「如果 X，则 Y」的可复用经验规则。
PWA + 安卓 APK（com.myevent.app）+ 自建同步服务，本地优先、单用户、隐私优先。架构平台层（本地存储 / LWW 增量同步 / CI / 发版部署）继承自同作者的 MyTime 项目。

## 五大入口

| 入口 | 回答的问题 |
|---|---|
| 收件箱 | 有什么需要整理和复盘（待复盘事件 / 想法收件箱 / 待验证预判） |
| 对象 | 这个人/项目/标的的事实、想法、预判如何演化（三线时间线 + 当前观点快照） |
| 预判 | 我做过哪些判断，哪些待验证，我准不准（锁定 → 验证 → 校准） |
| 经验库 | 我沉淀了哪些可复用规则，它们是否仍然有效 |
| 回顾 | 本周做了什么、置信度校准如何、哪些场景反复出现 |

## 快速开始

```bash
npm install && npm install --prefix server && npm install --prefix web
npm run dev      # 开发模式 http://localhost:5173
npm run build && npm start   # 生产模式 http://localhost:3129
npm test         # 单元测试
```

默认密码 `mytime123`（环境变量 `MYEVENT_PASSWORD` 修改）。数据在 `server/data/`。

## 架构

平台层（数据/同步/服务端/CI/发版/部署）继承自 MyTime 项目的架构模式：Dexie(IndexedDB) 本地优先 + outbox 队列 + LWW 增量同步 + Fastify/SQLite 服务端。
领域层（认知复盘）：subjects（对象）/ events（事件+复盘）/ thoughts（想法）/ predictions（预判）/ rules（经验规则）+ categories（场景标签）；JSON 列（依据链/复盘/快照等）经同步层序列化，详见 `web/src/db/repo.js`。

## 打包 APK / 部署 / 版本发布

与 MyTime 完全一致：`apk.bat`（工具链自举）、`bash deploy/upload.sh`、`node scripts/release.mjs minor`。
首次使用前把 deploy/deploy.config.example 复制为 deploy/config 并填入自己的服务器。

> 0.2.0 起安卓 appId 已由 com.mytime.app 改为 com.myevent.app，旧 MyTime APK 不会被覆盖安装。
