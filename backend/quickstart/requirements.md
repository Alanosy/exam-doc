---
title: 环境准备
description: 部署砚考前需要准备的 JDK、Maven、Node、数据库与中间件清单
---

# 环境准备

这一页列出跑起砚考全栈所需的全部依赖。本地开发只需要 **JDK + Maven + Node + MySQL + Redis + Nacos**，其余按需。

## 版本清单

| 组件 | 版本要求 | 必需 | 备注 |
| --- | --- | :---: | --- |
| JDK | **17**（推荐）/ 21 | ✅ | 禁止使用 OracleJDK，已知会导致 Spring 打包/运行异常；推荐 [BellSoft Liberica](https://bell-sw.com/pages/downloads/) |
| Maven | ≥ 3.8 | ✅ | 建议配置华为云镜像，项目 pom 已内置 repository |
| MySQL | 8.0（推荐）/ 5.7 | ✅ | 需 `utf8mb4`、`lower_case_table_names=1` |
| Redis | ≥ 6.x | ✅ | 框架大量使用新特性（分布式队列、限流） |
| Nacos | 2.x | ✅ | **必须与框架版本匹配**，推荐直接使用项目内置 `ruoyi-nacos` |
| Node.js | ≥ 20.19 | 前端 | `package.json` 的 engines 已限定 |
| npm | ≥ 8.19 | 前端 | 7.x 有已知问题 |
| MinIO | 最新稳定版 | 推荐 | 攒件/证书/抓拍图都用对象存储 |
| SnailJob Server | 1.10.0 | 可选 | 定时器：超时自动交卷、统计重算 |
| Seata Server | 2.6.0 | 可选 | 分布式事务，默认关闭 |
|Nginx | 1.22+ | 生产 | 静态资源 + API 反向代理 |

::: warning JDK 红线
OracleJDK 会导致 Spring Boot 3.x 打包异常，遇到 `Unsupported class file major version` 或打包后启动报奇怪的错，先确认是不是 JDK 发行版的问题。
:::

## 磁盘与内存预算

一套完整环境的最小资源占用：

| 场景 | CPU | 内存 | 磁盘 |
| --- | --- | --- | --- |
| 本地开发（8 个服务） | 4 核 | 8 GB（JVM 合计约 5 GB） | 20 GB |
| 单机生产（全量） | 8 核 | 16 GB | 100 GB（含 MinIO 与日志） |
| Docker 全栈 | 8 核 | 16 GB | 100 GB |

每个考试服务默认 JVM 堆约 512 MB ~ 1 GB，10 个考试服务全开会吃掉 6 GB 以上。开发机起不全是很正常的事，按 [最小可用组合](/backend/services#最小可用组合) 来即可。

## 源码获取

```bash
git clone https://github.com/Alanosy/exam-platform.git
cd exam-platform

# 后端
cd exam-back

# 前端
cd ../exam-front
```

::: tip 关于 old-exam
仓库根目录下的 `old-exam/` 是旧版单体系统（Spring Boot 2.x），**已停止演进**，仅作参考。新版是 `exam-back` + `exam-front`。
:::

## IDE 版本建议

| IDE | 结论 |
| --- | --- |
| IntelliJ IDEA 2023 全系列 | ❌ 不推荐，问题较多 |
| IntelliJ IDEA 2024.1 / 2024.2 | ⚠️ Maven 插件可能无法刷新依赖 |
| IntelliJ IDEA 2024.3 | ✅ 推荐（配合 JDK17） |
| IntelliJ IDEA 2025.3 | ✅ 推荐（配合 JDK21-25） |

详细配置见 [IDEA 环境配置](/backend/quickstart/idea_environment)。

## MySQL 启动参数

如果用项目自带的 docker-compose，参数已经配好。自建实例请参考：

```ini
--default-authentication-plugin=mysql_native_password
--character-set-server=utf8mb4
--collation-server=utf8mb4_general_ci
--explicit_defaults_for_timestamp=true
--lower_case_table_names=1
```

::: danger lower_case_table_names 不可中途变更
这个参数必须在**初始化数据目录之前**设定。已有数据的实例改它会导致表名全部无法识别。
:::

## 下一步

准备就绪后，进入 [中间件部署](/backend/quickstart/middleware)。
