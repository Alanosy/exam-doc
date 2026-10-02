---
title: 系统架构
description: 砚考微服务架构全景、请求链路与技术选型
---

# 系统架构

砚考采用微服务架构，基于 [RuoYi-Cloud-Plus](https://gitee.com/dromara/RuoYi-Cloud-Plus) `2.6.2` 构建，**对框架内核零侵入**——考试能力全部以新增模块实现。

## 全景图

```text
┌─────────────────────────────────────────────────────────────┐
│  用户侧                                                       │
│  管理后台 / 教师工作台 / 考生答题端（PC + 移动端浏览器）          │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│  接入层                                                       │
│  Nginx 80/443  静态托管 + API 反代 + SSE 长连接               │
└───────────────────────────┬─────────────────────────────────┘
                            │ /prod-api
┌───────────────────────────▼─────────────────────────────────┐
│  网关层  Gateway :8080                                        │
│  鉴权 · 路由 · 限流 · 请求响应日志 · 跨域                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ lb://服务名
┌───────────────────────────▼─────────────────────────────────┐
│  业务服务层                                                    │
│  ┌──────────┬───────────┬──────────────────────────────┐    │
│  │ auth     │ system    │ gen  job  resource  workflow │    │
│  │ :9210    │ :9201     │ 9202 9203 9204     9205      │    │
│  ├──────────┴───────────┴──────────────────────────────┤    │
│  │ 考试域 9211~9220                                      │    │
│  │ question paper manage answer mark                    │    │
│  │ stat     practice cert   proctor ai                  │    │
│  └──────────────────────────────────────────────────────┘    │
│        └──── Nacos 注册发现 + Dubbo RPC ────┘                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  数据层                                                       │
│  MySQL（ry-cloud / ry-exam / ry-exam-answer / ry-job / …）    │
│  Redis 7 · MinIO · Elasticsearch（可选）                      │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

| 组件 | 选型 | 作用 |
| --- | --- | --- |
| 注册 / 配置中心 | Nacos 2.5.1 | 服务注册发现；22 个配置文件集中管理 |
| 网关 | Spring Cloud Gateway | 统一入口，WebFlux 版（另提供 MVC 版） |
| RPC | Apache Dubbo 3.3.6 | 服务间调用，端口从 20880 自增 |
| 认证 | Sa-Token + JWT | Token 签发与校验，支持二级认证 |
| ORM | MyBatis-Plus | 分页、多租户、数据权限、乐观锁插件 |
| 多数据源 | dynamic-datasource | 异构数据库、spel 动态切换 |
| 缓存 / 锁 | Redis + Redisson | 分布式缓存、分布式锁、限流队列 |
| 任务调度 | SnailJob | 超时自动交卷、统计定时重算 |
| 对象存储 | MinIO（S3 协议） | 试题附件、证书图、**监考抓拍** |
| 事务 | Seata 2.6.0 | 默认关闭，按需启用 |
| 工作流 | warm-flow | 国产工作流引擎 |

## 请求链路

以「考生交卷」为例：

```text
浏览器
  │ POST /prod-api/answer/record/{id}/submit
  ▼
Nginx ── 剥掉 /prod-api 前缀 ──▶ Gateway :8080
                                  │ ① Sa-Token 校验
                                  │ ② 路由匹配 /answer/**，StripPrefix=1
                                  │ ③ 转发 lb://ruoyi-exam-answer/record/{id}/submit
                                  ▼
                          exam-answer :9214
                            │ ④ 幂等校验（是否重复提交）
                            │ ⑤ 客观题自动判分
                            │ ⑥ ─Dubbo─▶ exam-mark     同步主观题阅卷任务
                            │ ⑦ ─Dubbo─▶ exam-practice 错题入错题本
                            │ ⑧ ─Dubbo─▶ exam-proctor  结束监考会话
                            │ ⑨ ─Dubbo─▶ exam-cert     及格则颁发证书
                            ▼
                          写入 ry-exam-answer 库
```

## 为什么这么拆

| 拆分决策 | 理由 |
| --- | --- |
| `exam-answer` 独立成库 | 唯一高并发写场景；将来可单独按 `exam_id` 分库分表 |
| `exam-stat` 独立服务 | 重查询会拖垮 OLTP；用预聚合表隔离负载 |
| `exam-proctor` 独立服务 | 写多读多（事件流水 + 抓拍），与主流程解耦，挂了不影响答题 |
| `exam-cert` 独立服务 | 发证要等阅卷完成，异步触发，天然适合独立 |
| 其余按领域边界拆 | 每个服务对应考试全链路的一个环节 |

::: tip 依赖方向严格单向
`question ← paper ← manage ← answer ← mark`，`stat` 旁路只读。
**禁止反向调用**，这是这套微服务能单独扩容的前提。
详见 [服务间调用](/backend/exam/invocation)。
:::

## 服务端口全景

完整清单见 [服务清单与端口](/backend/services)，这里只给概览：

```text
8080  gateway          网关
9210  auth             认证中心
9201  system           系统管理
9202  gen              代码生成
9203  job              定时任务
9204  resource         文件/OSS/短信
9205  workflow         工作流

9211  exam-question    题库
9212  exam-paper       试卷
9213  exam-manage      考试管理
9214  exam-answer      答题（独立库）
9215  exam-mark        阅卷
9216  exam-stat        统计
9217  exam-practice    错题本
9218  exam-cert        证书
9219  exam-proctor     防作弊
9220  exam-ai          AI 网关
9221  exam-agent       Python AI（不经网关）

9100  monitor          监控中心
8800  snailjob-server  调度中心
8848  nacos            注册配置中心
```

## 高可用建议

| 组件 | 生产建议 |
| --- | --- |
| Gateway | ≥ 2 实例 + Nginx 负载均衡 |
| `exam-answer` | ≥ 2 实例（考试期唯一高并发写服务） |
| `exam-stat` | ≥ 2 实例（重查询隔离） |
| Nacos | 集群部署，见 [Nacos 集群搭建](/backend/extend-function/nacos) |
| Redis | 哨兵或集群模式 |
| MySQL | 主从；`ry-exam-answer` 量大后可上 ShardingSphere |
| MinIO | 多机多盘，配抓拍生命周期策略 |

## 下一步

- 每个服务的领域边界：[考试微服务总览](/backend/exam/overview)
- 怎么把它跑起来：[环境准备](/backend/quickstart/requirements)
