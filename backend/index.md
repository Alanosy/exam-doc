---
title: 后端文档
description: 砚考在线考试系统后端（exam-back）的部署、微服务说明与框架能力文档
---

# 后端文档

砚考后端 `exam-back` 基于 [RuoYi-Cloud-Plus](https://gitee.com/dromara/RuoYi-Cloud-Plus) `2.6.2` 构建，在其通用权限与基础设施之上，叠加了 **10 个考试业务微服务**。

::: warning 阅读建议
本文默认是给「要把它跑起来」和「要在上面写业务」的人看的。如果你是第一次接触，建议按左侧顺序从 [环境准备](/backend/quickstart/requirements) 读起。
:::

## 一图看清后端

```text
                        ┌──────────────┐
   浏览器 / 考试端  ──▶  │   Nginx :80   │
                        └──────┬───────┘
                               │ /prod-api
                        ┌──────▼────────┐
                        │  Gateway:8080 │   统一入口：鉴权 / 路由 / 限流 / 日志
                        └──────┬────────┘
        ┌───────────┬──────────┼──────────┬───────────┐
        │           │          │          │           │
   ┌────▼───┐  ┌────▼───┐ ┌────▼───┐ ┌────▼────┐ ┌────▼────┐
   │ auth   │  │ system │ │ exam-* │ │  mark   │ │  stat   │  ...
   │ :9210  │  │ :9201  │ │ 9211+  │ │ :9215   │ │ :9216   │
   └────────┘  └────────┘ └────────┘ └─────────┘ └─────────┘
        └──────────  Nacos(注册/配置) + Dubbo RPC  ──────────┘
                    MySQL 多库   Redis   MinIO    SnailJob
```

## 技术底座

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| JDK | OpenJDK | 17（21 亦可） |
| 基础框架 | Spring Boot | 3.5.16 |
| 微服务 | Spring Cloud / Spring Cloud Alibaba | 2025.0.3 / 2025.0.0.0 |
| 注册配置中心 | Nacos | 2.5.1（客户端） |
| RPC | Apache Dubbo | 3.3.6 |
| 网关 | Spring Cloud Gateway（WebFlux） | — |
| 认证 | Sa-Token + JWT | 1.45.0 |
| ORM | MyBatis-Plus | 3.5.16 |
| 动态数据源 | dynamic-datasource | 4.3.1 |
| 缓存 / 分布式锁 | Redis + Redisson | 3.52.0 |
| 任务调度 | SnailJob | 1.10.0 |
| 分布式事务 | Seata | 2.6.0（默认关闭） |
| 工作流 | warm-flow | 1.8.9 |
| 接口文档 | SpringDoc | 2.8.17 |
| Excel | FastExcel | 1.3.0 |
| 构建 | Maven（+ flatten-maven-plugin） | 3.8+ |

::: tip 内核零侵入
`ruoyi-gateway`、`ruoyi-auth`、`ruoyi-common` 等框架核心源码**未做任何修改**，考试能力全部以新增模块方式实现。
这意味着后续跟进 RuoYi-Cloud-Plus 上游版本时，冲突面很小。
:::

## 文档分区

| 分区 | 适用人群 | 说明 |
| --- | --- | --- |
| [服务清单与端口](/backend/services) | 所有人 | 所有微服务的端口、职责与依赖方向 |
| [快速开始](/backend/quickstart/requirements) | 部署人员 | 从装中间件到跑完整套环境的完整链路 |
| [考试微服务](/backend/exam/overview) | 后端开发 | 10 个考试服务的领域划分、数据表与调用关系 |
| [AI 能力](/backend/ai/) | 后端开发 / 部署 | AI 子系统：Java 网关 + Python Agent、Skill、Tool、模型网关 |
| [框架能力](/backend/framework/tree) | 后端开发 | 继承的通用能力：代码生成、权限、多租户、RPC、缓存… |
| [扩展功能](/backend/extend-function/nacos) | 运维 | ELK、SkyWalking、消息队列等可选中间件搭建 |

## 后端源码范围

```text
exam-back/
├── ruoyi-gateway/          网关（WebFlux，端口 8080）
├── ruoyi-gateway-mvc/      网关（Servlet MVC 版，与上面二选一）
├── ruoyi-auth/             认证中心 9210
├── ruoyi-api/              Dubbo API 契约模块（含 10 个 ruoyi-api-exam-*）
├── ruoyi-common/           公共组件（30+ 子模块）
├── ruoyi-modules/
│   ├── ruoyi-system/       用户/角色/菜单/字典/租户… 9201
│   ├── ruoyi-gen/          代码生成 9202
│   ├── ruoyi-job/          定时任务客户端 9203
│   ├── ruoyi-resource/     文件/OSS/短信/邮件/SSE 9204
│   ├── ruoyi-workflow/     工作流 9205
│   └── ruoyi-exam-*/       考试业务 10 个服务 9211~9220
├── ruoyi-visual/           monitor / snailjob-server / seata-server / nacos
├── ruoyi-agent/
│   └── ruoyi-exam-agent/   Python AI Agent 9221
├── script/
│   ├── config/nacos/       Nacos 配置文件（含 10 个 exam 配置）
│   ├── docker/             docker-compose 与中间件配置
│   └── sql/                数据库脚本
└── pom.xml
```

## 相关链接

- 源码仓库：[exam-platform / exam-back](https://github.com/Alanosy/exam-platform)
- 上游框架：[RuoYi-Cloud-Plus](https://gitee.com/dromara/RuoYi-Cloud-Plus)
- 遇到问题先看：[常见问题](/questions/)
