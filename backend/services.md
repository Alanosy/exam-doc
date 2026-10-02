---
title: 服务清单与端口
description: 砚考全部后端微服务、端口号、对外路径与依赖方向
---

# 服务清单与端口

砚考的 HTTP 端口定义在**各模块自己的 `src/main/resources/application.yml`** 中，而不是 Nacos 配置里；Nacos 只负责数据源、中间件地址与业务参数。排错时别找错地方。

## 端口分配规则

| 区间 | 归属 |
| --- | --- |
| `8080` | 网关 |
| `8800` / `17888` | SnailJob 调度服务端 |
| `9100` | SpringBoot Admin 监控 |
| `9201` ~ `9205` | 框架自带业务服务 |
| `9210` | 认证中心 |
| `9211` ~ `9220` | **考试业务服务（10 个）** |
| `9221` | Python AI Agent |
| `20880` 起 | Dubbo RPC 端口（`dubbo.protocol.port: -1` 自增） |

## 基础设施与框架服务

| 服务 | artifactId | 端口 | 必需 | 说明 |
| --- | --- | --- | :---: | --- |
| `ruoyi-gateway` | `ruoyi-gateway` | 8080 | ✅ | Spring Cloud Gateway（WebFlux），统一入口：鉴权、路由、限流、请求日志 |
| `ruoyi-gateway-mvc` | `ruoyi-gateway-mvc` | 8080 | 二选一 | Servlet MVC 版网关。**当前未配置 exam 路由，请勿直接用它跑考试业务** |
| `ruoyi-auth` | `ruoyi-auth` | 9210 | ✅ | 登录/登出/验证码/注册/社交登录/租户列表 |
| `ruoyi-system` | `ruoyi-system` | 9201 | ✅ | 用户、部门、岗位、角色、菜单、字典、参数、通知、租户、客户端、AI 模型配置 |
| `ruoyi-gen` | `ruoyi-gen` | 9202 | 可选 | 代码生成 |
| `ruoyi-job` | `ruoyi-job` | 9203（+29203） | 可选 | SnailJob 任务执行器，29203 为客户端通信端口 |
| `ruoyi-resource` | `ruoyi-resource` | 9204 | 推荐 | 文件 / OSS / 短信 / 邮件 / SSE / WebSocket |
| `ruoyi-workflow` | `ruoyi-workflow` | 9205 | 可选 | warm-flow 工作流 |
| `ruoyi-monitor` | `ruoyi-monitor` | 9100 | 可选 | SpringBoot Admin 监控中心 |
| `ruoyi-snailjob-server` | `ruoyi-snailjob-server` | 8800 / 17888 | 可选 | SnailJob 服务端 |
| `ruoyi-seata-server` | `ruoyi-seata-server` | 8091 / 7091 | 可选 | Seata 事务协调器 |

## 考试业务服务

| 服务 | 端口 | 网关前缀 | 库 | 职责 |
| --- | --- | --- | --- | --- |
| `ruoyi-exam-question` | 9211 | `/question` | `ry-exam` | 题库分类、题目 CRUD、选项、标签、Excel 导入导出、随机抽题 |
| `ruoyi-exam-paper` | 9212 | `/paper` | `ry-exam` | 试卷 CRUD、手工 / 随机组卷、试卷题目关联 |
| `ruoyi-exam-manage` | 9213 | `/exam`、`/invite` | `ry-exam` | 考试计划、规则、白名单、加入码、考试情况看板 |
| `ruoyi-exam-answer` | 9214 | `/answer`（StripPrefix=1，内部 `/record`） | **`ry-exam-answer`** | 考试中心、开考、存答案、自动判分、交卷、成绩。**高并发写，独立库** |
| `ruoyi-exam-mark` | 9215 | `/mark` | `ry-exam` | 主观题阅卷任务、打分、改分审计、AI 预评 |
| `ruoyi-exam-stat` | 9216 | `/stat` | `ry-exam` | 统计大盘、分数段、题目/知识点分析、重算任务。**只读重查询** |
| `ruoyi-exam-practice` | 9217 | `/practice`（StripPrefix=1，内部 `/wrong`） | `ry-exam` | 错题本、错题来源、重做记录 |
| `ruoyi-exam-cert` | 9218 | `/cert` | `ry-exam` | 证书模板、颁发、吊销、我的证书 |
| `ruoyi-exam-proctor` | 9219 | `/proctor`（StripPrefix=1） | `ry-exam` | 防作弊会话、事件、抓拍、规则判定 |
| `ruoyi-exam-ai` | 9220 | `/ai` | `ry-exam` | AI Java 网关层（**目前仅启动类，无业务代码**） |
| `ruoyi-exam-agent` | 9221 | 不经网关 | — | Python FastAPI + LangChain，**独立构建，不进 Maven** |

::: warning 注意 StripPrefix
`answer` / `practice` / `proctor` 三条路由配置了 `StripPrefix=1`，对外前缀与内部 `@RequestMapping` 不一致：

- 对外 `/answer/record/center` → 内部 `ExamRecordController` 的 `/record/center`
- 对外 `/practice/wrong/overview` → 内部 `/wrong/overview`
- 对外 `/proctor/exam/list` → 内部 `/exam/list`

其余服务的对外前缀与内部路径一致。改路由时千万别搞反。
:::

## 最小可用组合

只跑核心考试业务，启动这 8 个即可：

```bash
# 基础设施
MySQL  Redis  Nacos

# 应用服务（按启动顺序）
ruoyi-gateway   :8080
ruoyi-auth      :9210
ruoyi-system    :9201
ruoyi-exam-question  :9211
ruoyi-exam-paper     :9212
ruoyi-exam-manage    :9213
ruoyi-exam-answer    :9214
ruoyi-exam-mark      :9215
```

证书、错题本、监考、统计、AI 可按需追加，彼此不阻塞。

## 包路径规范

基础包名沿用了框架的 `org.dromara`，考试域在第三级：

```text
业务实现：org.dromara.exam.<模块>.{controller, service, service.impl, mapper, domain, dubbo, task}
接口契约：org.dromara.exam.<模块>.api.{RemoteXxxService, domain.*}
```

示例：

```text
org.dromara.exam.question.RuoYiExamQuestionApplication
org.dromara.exam.question.controller.QuestionController
org.dromara.exam.question.dubbo.RemoteQuestionServiceImpl
org.dromara.exam.answer.service.impl.ExamRecordServiceImpl
```

::: tip 关于包名迁移
目前 `groupId` 仍是 `org.dromara:ruoyi-cloud-plus:2.6.2`，包名沿用 `org.dromara`。
如果要改成自有包名，请参考 [修改包名](/backend/framework/association/update_package_name) 并同步修改 MyBatis-Plus 的 `mapperPackage`、`typeAliasesPackage`（正则是 `org.dromara.**`）。
:::
