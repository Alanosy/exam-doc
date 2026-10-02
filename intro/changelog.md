---
title: 更新日志
description: 砚考版本演进记录与当前版本状态
---

# 更新日志

::: warning 新版尚未正式发版
`exam-back` + `exam-front`（微服务版）仍在开发中，**暂未发布正式版本号**。
本页记录的是能力演进，而非语义化版本。正式发版后将改用 `主版本.次版本.修订号`。
:::

## 当前状态

| 版本 | 目录 | 状态 | 说明 |
| --- | --- | --- | --- |
| 旧版 | `old-exam/` | 已上线 | 单体 Spring Boot 2.x，功能完整，体验地址见 [演示系统](/demo/) |
| **新版** | `exam-back/` + `exam-front/` | 🚧 开发中 | 基于 RuoYi-Cloud-Plus 2.6.2 的微服务重构 |

## 新版能力演进

### 基础设施

- 完成 **10 个考试微服务**的拆分：题库、试卷、考试管理、答题、阅卷、统计、练习、证书、防作弊、AI
- 完成 `ruoyi-api-exam-*` 共 10 个 Dubbo API 契约模块
- 完成 Nacos 侧 22 个配置文件，含 10 个 `ruoyi-exam-*.yml`
- 完成 `ry-exam`（29 表）与 `ry-exam-answer`（2 表）两个业务库脚本
- 完成网关侧 11 条 exam 路由

### 业务能力

| 能力 | 状态 |
| --- | ---: |
| 题库 / 试题管理（9 种题型 + Excel 导入导出） | ✅ |
| 手工 / 随机规则组卷 | ✅ |
| 考试管理（白名单 + 公开链接双准入方式） | ✅ |
| 在线答题（断点续答、自动保存、幂等交卷） | ✅ |
| 客观题自动判分（正确 / 半对 / 错误三态） | ✅ |
| 主观题三级人工阅卷 + 改分审计 | ✅ |
| 13 类防作弊行为检测 + 服务端强制交卷 | ✅ |
| 服务端时钟校准（防改本机时间） | ✅ |
| 7 类考试统计 + 定时/手动重算 | ✅ |
| 错题本（自动收录、重练、笔记、标记掌握） | ✅ |
| 证书（模板占位符、自动颁发、吊销、打印） | ✅ |
| 监考中心（10 秒静默轮询、事件流水、抓拍墙） | ✅ |
| AI 出题 / 阅卷 / 推荐 / 试卷分析 | 🚧 Python 侧完成，待与 Java 接线 |
| 管理端错题维护页 | 📋 规划中 |
| 基于题库 / 章节的刷题练习 | 📋 规划中 |

### 已知待办

这些是**当前仓库里确实存在**的待修项，部署前建议先看一眼：

| 项 | 位置 |
| --- | --- |
| `ruoyi-gateway.yml` 中 `/stat` 路由 id 重复两条 | Nacos 网关配置 |
| `ruoyi-exam-question` 路由残留 4 个无 Controller 的谓词 | Nacos 网关配置 |
| `ruoyi-gateway-mvc.yml` 未同步 exam 路由 | Nacos 网关配置 |
| 10 个 exam 服务缺 Dockerfile | `ruoyi-modules/ruoyi-exam-*/` |
| `docker-compose.yml` 未登记 exam 服务 | `script/docker/` |
| SnailJob 端口 compose(19203) 与配置(29203) 不一致 | compose / Nacos |
| `.env.production` 标题仍是 RuoYi | `exam-front/.env.production` |
| `prod` profile 的 Nacos 地址仍是 127.0.0.1 | 根 `pom.xml` |
| `ruoyi-job` 在 IDEA `.run/` 里无运行配置 | `.run/` |

详细清单见 [打包与部署 — 上线前检查清单](/backend/quickstart/deploy#六上线前检查清单)。

## 底层框架版本

砚考跟随上游 [RuoYi-Cloud-Plus](https://gitee.com/dromara/RuoYi-Cloud-Plus) `2.6.2`，技术底座版本：

```text
Spring Boot            3.5.16
Spring Cloud           2025.0.3
Spring Cloud Alibaba   2025.0.0.0
Nacos Client           2.5.1
Apache Dubbo           3.3.6
Sa-Token               1.45.0
MyBatis-Plus           3.5.16
Redisson               3.52.0
SnailJob               1.10.0
```

升级上游时需注意：

- 框架核心（gateway / auth / common）**未做任何修改**，冲突面小
- 考试能力全部在 `ruoyi-exam-*` 与 `ruoyi-api-exam-*` 中，不会被覆盖
- 数据库增量脚本在 `script/sql/update/`，升级前按顺序执行

## 获取更新

```bash
git pull origin main
```

升级前建议阅读 [如何同步项目更新](/questions/synchronous_update)。
