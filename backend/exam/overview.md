---
title: 考试微服务总览
description: 砚考 10 个考试业务微服务的领域边界、数据表、核心控制器与依赖关系
---

# 考试微服务总览

砚考把考试业务拆成 10 个微服务，每个服务对应考试全链路上的一个环节。这一页讲清楚它们的**边界**和**谁调谁**。

## 领域地图

```text
  题库 question ──┐
                  ├──▶ 试卷 paper ──▶ 考试管理 manage ──▶ 答题 answer
                  │                                          │
                  │                        ┌─────────────────┼──────────────┐
                  │                        ▼                 ▼              ▼
                  │                   阅卷 mark        防作弊 proctor   证书 cert
                  │                        │                               │
                  └────────────────────────┼───────────────────────────────┘
                                           ▼
                                      错题本 practice
                                           │
                                     统计 stat（旁路只读）
```

::: tip 依赖方向严格单向
`question ← paper ← manage ← answer ← mark`，`stat` 只做旁路只读。
**禁止反向调用**（例如 question 不能去调 answer），这是这套微服务能单独扩容的前提。
:::

## 各服务职责

### 题库服务 `ruoyi-exam-question` : 9211

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.question` |
| 前缀 | `/question` |
| 主表 | `question`、`question_option`、`question_bank`、`question_bank_category` |
| 源码规模 | 42 个类 |

负责题库的分类树归类、题目 CRUD、选项维护、标签打标、Excel 模板导入导出，以及组卷时的随机抽题接口。

- 支持 9 种题型：单选、多选、判断、填空、简答、论述、代码、文件上传、匹配
- 难度分 `easy` / `medium` / `hard` 三档
- 导入采用「整批校验，失败整批回滚」策略
- `RemoteQuestionServiceImpl` 以 Dubbo 暴露 `RemoteQuestionService`

### 试卷服务 `ruoyi-exam-paper` : 9212

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.paper` |
| 前缀 | `/paper` |
| 主表 | `paper`、`paper_question` |
| 源码规模 | 18 个类 |

支持两种组卷方式：**手工选题**与**按规则随机抽题**（题库 + 题型 + 难度 + 数量 + 单题分值）。
组卷保存时，试题明细按传入顺序**全量覆盖** `paper_question`——即每次保存是一次整体替换，不是增量追加。

### 考试管理服务 `ruoyi-exam-manage` : 9213

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.manage` |
| 前缀 | `/exam`、`/invite` |
| 主表 | `exam`、`exam_user`、`exam_invite` |
| 源码规模 | 33 个类 |

考试计划的中枢，配置项最多：

- **考试类型**：正式（`1`）/ 练习（`2`）
- **状态流**：`not_start` 未开始 → `ongoing` 进行中 → `finished` 已结束 → `archived` 已归档
- **参加方式**：白名单（按部门选人）/ 公开链接（加入码 + 密码 + 有效期）
- **时间控制**：起止时间窗、限时、是否允许迟到与迟到分钟数、重考次数
- **判分策略**：答案展示时机、客观题部分得分开关与比例、答错扣分
- **绑定**：9 项防作弊规则、及格证书模板

加入码长度为 10，字符集刻意剔除了 `0/1/I/O/l` 等肉眼易混淆字符。

### 答题服务 `ruoyi-exam-answer` : 9214

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.answer` |
| 前缀 | `/answer`（内部 `/record`） |
| 主表 | **`exam_record`、`exam_answer`（独立库）** |
| 源码规模 | 22 个类，含 7 个 `@DubboReference` |

**全链路并发最高的服务**。对外只暴露 `/answer/record/**`，内部 Controller 路径是 `/record/**`。

关键设计：

| 能力 | 实现 |
| --- | --- |
| 断点续答 | 逐题自动保存；中途退出可从断点继续 |
| 自动判分 | 客观题交卷即出分，三态：正确 / 半对 / 错误 |
| 超时兜底 | `ExamTimeoutTask` 定时任务，倒计时归零由服务端强制提交 |
| 重复交卷 | 幂等设计，重复提交不产生多份成绩 |
| 时钟校准 | 前端 `useServerClock` 对齐服务端时间，避免改本机系统时间作弊 |

::: tip 成绩只有一处写入口
主观题得分由 `mark` 服务通过 `writeBackMark` **回写**到 answer，其它服务不允许直接改 `exam_record` 的成绩字段。
排查成绩异常时只需盯这一条链路。
:::

### 阅卷服务 `ruoyi-exam-mark` : 9215

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.mark` |
| 前缀 | `/mark` |
| 主表 | `exam_mark_task`、`exam_mark_item`、`exam_mark_log` |
| 源码规模 | 23 个类 |

按「考试 → 答卷 → 逐题」三级组织人工阅卷。每次改分写 `exam_mark_log`，动作区分 `create` / `score` / `rescore` / `ai` / `finish`，可完整追溯谁在什么时候把哪道题从几分改到几分。

AI 预评接口已预留，当前实现为 `DefaultMarkAiServiceImpl` 本地兜底——调用会返回「未接入」。

### 统计服务 `ruoyi-exam-stat` : 9216

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.stat` |
| 前缀 | `/stat` |
| 主表 | `stat_exam_*`（7 张预聚合表） |
| 源码规模 | 55 个类 |

最大的服务，也是唯一「重查询」服务。它**不写业务数据**，靠跨服务的**影子实体**（如 `QuestionRef`、`ExamRef`）在本地做映射，避免跨库 JOIN。

| 输出 | 说明 |
| --- | --- |
| 大盘概览 | 考试场次、参考人次、平均分、及格率 |
| 分数段分布 | 分段直方图 |
| 考生明细与排名 | 支持排除作废答卷 |
| 逐题分析 | 正确率、难度、区分度 |
| 选项分布 | 易错项识别 |
| 知识点掌握度 | 薄弱分级 |

::: tip 双重兜底的重算机制
汇总表每 10 分钟由 `StatCalcScheduler` 定时重算，同时提供手动重算接口。
数据不对时直接手动触发重算即可，不用等下一个周期。
:::

### 错题本服务 `ruoyi-exam-practice` : 9217

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.practice` |
| 前缀 | `/practice`（内部 `/wrong`） |
| 主表 | `wrong_question`、`wrong_review_record` |
| 源码规模 | 19 个类 |

交卷后，**答错**和**半对**的题目自动进错题本。支持按来源分组查看、重练（即时判分看解析）、记笔记、标记掌握、移出与恢复，并保留每次重做的历史。

### 证书服务 `ruoyi-exam-cert` : 9218

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.cert` |
| 前缀 | `/cert` |
| 主表 | `exam_certificate`（模板）、`exam_certificate_record`（颁发记录） |
| 源码规模 | 19 个类 |

考试及格后自动颁发。模板支持占位符：

```text
{nickName} {account} {examName} {score} {totalScore}
{passScore} {certNo} {issueDate} {expireDate}
```

支持印章、背景图、横竖版与有效期。证书墙区分「有效 / 已过期 / 已吊销」。

::: warning 含主观题的卷子要等阅卷完才发证
这是为了避免先发证后改分导致证书成绩与实际不一致。`cert` 会等 `mark` 完成后再触发颁发。
:::

### 防作弊服务 `ruoyi-exam-proctor` : 9219

| 项 | 内容 |
| --- | --- |
| 包名 | `org.dromara.exam.proctor` |
| 前缀 | `/proctor`（StripPrefix=1） |
| 主表 | `exam_proctor_session`、`exam_proctor_event`、`exam_proctor_snapshot` |
| 源码规模 | 27 个类 |

监控 13 类行为：切屏离屏、窗口失焦、复制/剪切/粘贴、右键、进出全屏、摄像头抓拍与拒权、开发者工具、多标签页等。

::: tip 判定在服务端
前端的 `useProctor` **只负责把可疑动作报上去**，计数、风险分级、是否强制交卷全部由后端算。
改前端 JS 绕不过去，这是设计上的取舍。
:::

默认规则偏向「只记录、不强制」：

```ts
{ switchScreen: 0, copyPaste: 1, camera: 0, fullScreen: 0,
  cameraInterval: 60, maxPaste: 0, maxExitFullscreen: 0, devtool: 1, multitab: 1 }
```

值为 `0` 表示不设上限（仅记录），需由考试管理员在配置里显式开启。

### AI 服务 `ruoyi-exam-ai` : 9220

Java 侧网关层，**目前只有启动类 1 个 java 文件，无业务代码**；`ruoyi-api-exam-ai` 也只有 `package-info.java`。

Python Agent (`ruoyi-agent/ruoyi-exam-agent`, :9221) 已完成四类能力：

```text
POST /api/ai/question/generate   AI 出题
POST /api/ai/grade/auto          AI 阅卷
POST /api/ai/recommend/wrong     错题推荐
POST /api/ai/paper/analyze       试卷分析
GET  /health
```

Java 与 Python 之间走服务发现（`ai.agent.service-name: ruoyi-exam-agent`）+ REST，异步批量预留了 RocketMQ topic `ai-agent-task`（当前关闭）。

::: warning AI 尚未接线
AI 阅卷目前会返回「未接入」。这是已知的进行中工作，不是 bug。
:::

## 边界外的东西

有些能力没有独立成服务，别到处找：

| 能力 | 归属 |
| --- | --- |
| 用户、角色、菜单、字典、租户 | `ruoyi-system` :9201 |
| AI 模型配置表 `ai_model_config` | `ruoyi-system` :9201 |
| 文件上传、OSS、短信、邮件、SSE | `ruoyi-resource` :9204 |
| 定时任务执行端 | `ruoyi-job` :9203 |

## 下一步

服务之间具体怎么调，见 [服务间调用](/backend/exam/invocation)。
