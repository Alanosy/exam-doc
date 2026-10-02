---
title: 技术栈
description: 砚考前后端与基础设施的完整技术选型清单
---

# 技术栈

## 后端

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| JDK | OpenJDK | 17（21 亦可） |
| 基础框架 | Spring Boot | 3.5.16 |
| 微服务 | Spring Cloud / Spring Cloud Alibaba | 2025.0.3 / 2025.0.0.0 |
| 注册配置中心 | Nacos | 2.5.1 |
| RPC | Apache Dubbo | 3.3.6 |
| 网关 | Spring Cloud Gateway（WebFlux） | — |
| 认证 | Sa-Token + JWT | 1.45.0 |
| ORM | MyBatis-Plus | 3.5.16 |
| 多数据源 | dynamic-datasource | 4.3.1 |
| 缓存 / 分布式锁 | Redis + Redisson | 3.52.0 |
| 任务调度 | SnailJob | 1.10.0 |
| 分布式事务 | Seata | 2.6.0（默认关闭） |
| 工作流 | warm-flow | 1.8.9 |
| 接口文档 | SpringDoc | 2.8.17 |
| Excel | FastExcel | 1.3.0 |
| 对象存储 | MinIO（AWS S3 SDK） | SDK 2.28.22 |
| 短信 | sms4j | 3.3.5 |
| 第三方登录 | JustAuth | 1.16.7 |
| 工具库 | Hutool | 5.8.43 |
| 连接池 | HikariCP | — |
| 数据库连接监控 | p6spy | 3.9.1 |
| Web 容器 | Undertow | — |
| 构建 | Maven + flatten-maven-plugin | 3.8+ |

## 前端

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | Vue | 3.5.30 |
| 语言 | TypeScript | ~5.9.3 |
| UI 组件库 | Element Plus | 2.13.5 |
| 构建 | Vite | 7.3.2 |
| 状态管理 | Pinia | 3.0.4 |
| 路由 | Vue Router | 5.0.3 |
| HTTP | Axios | 1.13.6 |
| CSS | **UnoCSS**（非 Tailwind） | 66.6.6 |
| 富文本 | @vueup/vue-quill | 1.2.0 |
| 图表 | ECharts | 6.0.0 |
| 复杂表格 | vxe-table | 4.18.1 |
| 组合式工具 | @vueuse/core | 14.2.1 |
| 国际化 | vue-i18n | 11.3.0 |
| 加密 | jsencrypt / crypto-js | 3.5.4 / 4.2.0 |
| 文件下载 | file-saver | 2.0.5 |
| 全屏 | screenfull | — |
| 代码高亮 | highlight.js | — |
| 单元测试 | Vitest | 4.0.18 |
| Node | ≥ 20.19 | — |
| npm | ≥ 8.19 | — |

::: tip UnoCSS 不是 Tailwind
改样式前先确认这一点。项目用 `uno.config.ts` 配置，预设了 `presetUno`、`presetAttributify`、`presetIcons`、`presetTypography`。
业务侧大量使用原子类（`class="p-[16px]" flex items-center gap-2`），习惯了传统 SCSS 的同学会有点不适应。
:::

## 基础设施

| 组件 | 版本 | 用途 |
| --- | --- | --- |
| MySQL | 8.0.42 | 主数据库（5 个库） |
| Redis | 7.2.8 | 缓存、分布式锁、会话 |
| Nacos | 2.6.2 | 注册 + 配置中心 |
| MinIO | RELEASE.2026-02-14 | 对象存储 |
| Nginx | 1.22.1 | 静态托管 + 反代 |
| Seata | 2.6.2 | 分布式事务（可选） |
| Elasticsearch | 7.17.6 | 日志检索（可选） |
| SkyWalking | 9.7.0 | 链路追踪（可选） |
| Prometheus + Grafana | v2.40.1 / 9.2.4 | 指标监控（可选） |
| ShardingSphere-Proxy | 5.4.0 | 分库分表（可选） |
| Kafka / RocketMQ / RabbitMQ | 3.9.1 / 5.2.0 / 3.13.3 | 消息队列（可选） |

## AI 侧

Python Agent 独立部署，不进 Maven 构建。

| 组件 | 说明 |
| --- | --- |
| FastAPI | HTTP 服务框架 |
| LangChain | LLM 编排 |
| Nacos SDK | 注册到 Nacos，供 Java 侧发现 |

环境变量：

```bash
AGENT_PORT=9221
AGENT_NACOS_SERVER=127.0.0.1:8848
AGENT_NACOS_NAMESPACE=dev
AGENT_LLM_BASE_URL=<大模型地址>
AGENT_LLM_API_KEY=<密钥>
AGENT_LLM_MODEL=qwen-plus
```

::: warning AI 尚未与 Java 接线
四类能力（出题 / 阅卷 / 推荐 / 试卷分析）已在 Python 侧实现，但 Java 网关还没接上，
当前 AI 阅卷返回「未接入」。
:::

## 数据库拆分

```text
ry-cloud          系统基础（用户/角色/菜单/字典/租户/AI 模型配置）
ry-exam           考试主库（29 张表）
ry-exam-answer    答卷成绩库（2 张表，高并发大表）
ry-config         Nacos 配置库
ry-job            SnailJob 任务库
ry-workflow       工作流库
```

详见 [数据库初始化](/backend/quickstart/database)。

## 与旧版对比

| 项 | 旧版 old-exam | 新版 exam-platform |
| --- | --- | --- |
| 架构 | 单体 Spring Boot 2.x | 微服务 RuoYi-Cloud-Plus |
| 后端 | Spring Boot 2.x + MyBatis-Plus + Druid + Fastjson + EasyExcel | Spring Boot 3.5 + MyBatis-Plus + HikariCP + Jackson + FastExcel |
| RPC | 无 | Apache Dubbo 3.3.6 |
| 前端 | Vue 2 | Vue 3 + TypeScript + Element Plus + Vite |
| 状态 | 已上线 | 🚧 开发中 |

## 下一步

- 架构分层：[系统架构](/intro/architecture)
- 部署准备：[环境准备](/backend/quickstart/requirements)
