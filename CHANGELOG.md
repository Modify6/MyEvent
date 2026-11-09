# 更新日志

所有对外可感知的变化都记录在此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.1.0] - 2026-11-10

### 新增
- 项目初始版本：基于 MyTime 架构蓝图（docs/architecture.md）生成
- 平台层原样继承：本地优先存储、全自动双向同步（LWW+增量游标）、Fastify+SQLite 服务端、CI 三 job、一键发版、VPS 部署体系、迁移脚本、工具链自举
- 领域层（事件管理）：事件开始/结束/补录、分类（工作/生活/学习/其他）、今日页、事件时间线、分类统计
