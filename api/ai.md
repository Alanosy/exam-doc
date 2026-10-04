---
title: AI 接口
description: 砚考 AI 能力对外接口，经网关 /ai/** 暴露，含权限码与调用示例
---

# AI 接口

这一页是**经网关暴露**的 AI 接口，供前端与第三方系统集成。
网关地址 `http://<host>:8080`，前缀 `/ai`。

::: tip Python Agent 的原生接口不在这里
`ruoyi-exam-agent`（9221）有 44 个原生接口，**不经过网关**，
用于调试与二次集成。详见 [Agent 接口清单](/backend/ai/api)。
:::

## 通用约定

| 项 | 值 |
| --- | --- |
| 网关前缀 | `/ai`（**不剥前缀**，原样转发到 `ruoyi-exam-ai` :9220） |
| 鉴权 | Sa-Token，Header `Authorization: Bearer <token>` |
| 数据格式 | `application/json` |
| 响应结构 | `{"code":200,"msg":"success","data":{...}}` |

::: warning `/chat` 在网关上不可达
网关只配了 `Path=/ai/**`，因此 `/chat` 系列走不通。
**前端请统一用 `/ai/chat` 前缀**。

Controller 上写的是 `@RequestMapping({"/chat", "/ai/chat"})` 两种形态，
但只有带 `/ai` 的能过网关。
:::

## 权限码

| 权限码 | 覆盖接口 |
| --- | --- |
| `exam:ai:list` | 模型列表、执行技能 |
| `exam:ai:edit` | 评分、出题、质检、试卷审查 |
| 仅需登录（`@SaCheckLogin`） | AI 可用性、对话、错题归因 |

::: tip 对话只卡登录，不卡权限码
这是刻意的设计：**考生也该能用 AI 问「这场考试怎么考」**。
真正的写操作由 Agent 侧的确认卡兜底，越权的业务调用会被网关挡回来。
:::

## 能力探测

### 查询 AI 是否可用

```bash
GET /ai/enabled
Authorization: Bearer <token>
```

```json
{ "code": 200, "data": { "enabled": true } }
```

::: tip 返回的是对象而不是裸布尔
前端读的是 `data.enabled`。返回裸布尔会导致 `.enabled` 恒为 undefined。

另外这个结果**在服务端缓存 10 秒**——改完配置稍等再试。
:::

前端应当**根据这个接口决定是否显示 AI 入口**，不要在页面里写死。

## 模型

### 模型列表

```bash
GET /ai/model/list
Authorization: Bearer <token>      # 需 exam:ai:list
```

```json
{
  "code": 200,
  "data": [
    {
      "code": "1", "name": "DeepSeek", "modelName": "deepseek-chat",
      "type": "chat", "source": "mysql", "priority": 10, "state": "healthy"
    }
  ]
}
```

密钥字段在传输前已脱敏（`前6位***后4位`），**明文不会出现在响应里**。

## 阅卷

### 单题评分

```bash
POST /ai/mark/score
Authorization: Bearer <token>      # 需 exam:ai:edit
```

请求体 `RemoteMarkAiBo`：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `questionType` | `SHORT_ANSWER` | 题型 |
| `title` / `stem` | — | 题干 |
| `fullScore` | — | 满分 |
| `standardAnswer` | — | 参考答案 |
| `rubric` | — | 评分要点 |
| `analysis` | — | 试题解析 |
| `answerText` | — | 考生作答 |
| `tenantId` | 自动补 | 留空则由服务端填当前租户 |

响应：

```json
{
  "code": 200,
  "data": {
    "score": 8.5, "fullScore": 10, "confidence": 0.88,
    "matchedPoints": [{"point": "提到 SYN", "got": true, "score": 3}],
    "reason": "面向教师的评分说明",
    "comment": "面向学生的评语",
    "needHuman": false,
    "model": "deepseek-chat"
  }
}
```

::: danger `score` 是建议分
`needHuman=true` 或 `confidence < 0.6` 的结果**不应自动落分**。
详见 [AI 阅卷](/guide/ai-grading)。
:::

### 批量评分

```bash
POST /ai/mark/batch
Authorization: Bearer <token>      # 需 exam:ai:edit
Content-Type: application/json

[ { ...RemoteMarkAiBo }, { ...RemoteMarkAiBo } ]
```

并发度由服务端 `exam.ai.batch-parallel`（默认 4）控制。

::: tip 返回顺序与入参一致
Agent 并发执行不保证顺序，Java 侧会按 `index` 还原成入参顺序。
调用方**不需要自己排序**。

单条失败的条目不会中断整批，其 `error` 字段带原因。
:::

## 出题

### 生成试题

```bash
POST /ai/question/generate
Authorization: Bearer <token>      # 需 exam:ai:edit
```

请求体 `RemoteQuestionGenBo`：

| 字段 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- |
| `questionType` | `SINGLE` | 枚举 | 题型 |
| `difficulty` | `medium` | — | easy / medium / hard |
| `knowledgePoints` | `[]` | — | 知识点列表 |
| `count` | `5` | 1~30 | 生成题数 |
| `score` | `5` | — | 默认分值 |
| `requirement` | — | — | 附加要求（放入 `extra`） |

响应返回题目数组，每题含 `questionType`、`stem`、`options`、`answer`（JSON 字符串）、
`analysis`、`knowledgePoints`、`difficulty`、`score`。

`answer` 的结构按题型不同，与落库格式严格一致：

```text
单选/多选 {"rightKeys":["A","C"]}      判断 {"rightKeys":["A"]}（A=正确 B=错误）
填空     {"blanks":[{"answers":["北京","北平"]}]}
匹配     {"pairs":[{"left":"CPU","right":"中央处理器"}]}
简答/论述 {"answer":"..."}              代码 {"language":"java","answer":"...","remark":"..."}
```

详见 [AI 出题与质检](/guide/ai-question)。

### 试题质检

```bash
POST /ai/question/audit
Authorization: Bearer <token>      # 需 exam:ai:edit
```

响应：`passed`、`qualityScore`（0~10，**6 分以下不建议入正式库**）、
`issues[]`（含 `level`/`type`/`detail`/`suggestion`）、`summary`。

## 试卷

### 试卷审查

```bash
POST /ai/paper/review
Authorization: Bearer <token>      # 需 exam:ai:edit
```

请求体 `RemotePaperReviewBo`：`title`、`duration`(60)、`passScore`(60)、
`focus`(全面审查)、`questions[]`（含 `questionId`/`questionType`/`stem`/`difficulty`/`knowledgePoints`/`score`）。

响应：`questionCount`、`estimatedMinutes`、`verdict`、`difficultyDistribution`、
`knowledgeCoverage[]`、`issues[]`、`suggestions[]`。

## 学情

### 错题归因

```bash
POST /ai/learn/diagnose
Authorization: Bearer <token>      # 仅需登录
```

请求体 `RemoteDiagnoseBo`：

```json
{
  "wrongItems": [
    { "questionId": "...", "questionType": "SINGLE", "stem": "...",
      "knowledgePoints": ["TCP/IP"], "answerText": "...",
      "standardAnswer": "...", "wrongCount": 2 }
  ],
  "mastered": { "points": ["OSI 七层模型"] }
}
```

响应：`advice`、`priority[]`、`errorDistribution`、`weakPoints[]`。

::: tip 考生也能调
这是全站少数**只卡登录不卡权限码**的业务接口——
学生应该能问「我哪里没学会」。
:::

## 执行技能

### 通用技能执行

```bash
POST /ai/skill/run
Authorization: Bearer <token>      # 需 exam:ai:list
```

```json
{ "skillCode": "mark_score", "input": { "stem": "...", "full_score": 10 } }
```

响应带 `model`、`latencyMs`、`attemptChain`（如 `DeepSeek>Qwen`，可看出换了几次模型）、
`data`（原样返回）。

这个接口是**逃生舱**：新增 Skill 时不用改 Java 代码就能调。
17 个技能清单见 [Skill 技能详解](/backend/ai/skills)。

## 对话

### 发起对话

```bash
POST /ai/chat
Authorization: Bearer <token>
```

请求体 `AiChatBo`：

| 字段 | 说明 |
| --- | --- |
| `sessionId` | **首轮不传**，后续带回来 |
| `message` | 用户消息；提交追问卡时可只回 `answers` |
| `answers` | `{key: value}`，key 对应追问字段的 `key` |
| `modelCode` | 指定模型，不传走主备链 |
| `options` | `contextRounds` / `confirmWrite` / `planner` |

响应 `AiChatVo`：

```json
{
  "sessionId": "a1b2c3d4",
  "reply": "已为你生成 10 道题……",
  "trace": [
    { "type": "tool", "title": "查询题库", "status": "ok", "latencyMs": 42,
      "ref": "list_question_banks", "preview": ["测试题库（128 题）"] }
  ],
  "ask": null,
  "intent": "question_create",
  "data": { }
}
```

::: warning 字段是驼峰不是蛇形
`AiChatVo` 刻意**不启用** SnakeCase 策略——
前端类型全是 camelCase（`sessionId`、`submitText`），
用蛇形会导致前端读不到字段，**会话续跑直接断链**。
:::

### `ask` 字段：追问卡

`ask` **非空表示「我在等你补充信息」**，前端应渲染表单而不是普通气泡：

```json
{
  "kind": "form",
  "title": "还差一点信息",
  "desc": "已识别到：主题=计算机网络、数量=10 道，还缺题型",
  "fields": [
    { "key": "question_type", "label": "题型", "type": "select",
      "options": [{"label":"单选题","value":"SINGLE"}], "required": true }
  ],
  "submitText": "继续",
  "cancelText": "取消"
}
```

| 字段 | 说明 |
| --- | --- |
| `kind` | `form`（表单）/ `choice`（选项）/ `confirm`（确认） |
| `fields[].type` | `text` / `number` / `select` / `multi` / `switch` |
| `fields[].key` | 回传时作为 `answers` 的 key |

用户提交时：

```json
{ "sessionId": "a1b2c3d4", "answers": { "question_type": "SINGLE" }, "message": null }
```

::: danger 选项的 value 必须是字符串
题库 ID / 考试 ID 是**19 位雪花 ID**，超过 JS 安全整数范围，
走数字会丢精度导致查不到数据。后端已全部序列化成字符串，
前端不要转成 Number。
:::

### `trace` 字段：运行轨迹

| `type` | 含义 |
| --- | --- |
| `think` | 思考 |
| `tool` | 调了内置工具 |
| `skill` | 跑了 AI 技能 |
| `ask` | 等待用户补充（`status=waiting`） |
| `write` | 写操作 |
| `done` | 完成 |
| `error` | 出错 |

前端按 `type` 渲染不同图标，按 `status` 渲染不同颜色。

### 会话列表

```bash
GET /ai/chat/sessions
Authorization: Bearer <token>
```

只带摘要（`id`/`title`/`intent`/`messageCount`/`updatedAt`），**不含全量消息**——
避免一次拉回几十个会话的完整聊天记录。

`updatedAt` 单位是**秒**。

### 会话详情

```bash
GET /ai/chat/session/{sessionId}
Authorization: Bearer <token>
```

不存在时返回 `null`。`messages[]` 每项 `{role, content}`。

### 我的身份

```bash
GET /ai/chat/whoami
Authorization: Bearer <token>
```

返回 `userId`、`roles`、`examPermissions`、`roleScope`、`staff`、`isStudent`、
`visibleApiCount` / `totalApiCount`。

调试「为什么 AI 说我没权限」时看这个。

## 服务降级

AI 是**旁路能力**。Agent 挂掉时：

- 接口**不会抛异常**，返回 `success=false` + 说明文案
- 业务功能照常可用
- `/ai/enabled` 返回 `false`，前端隐藏入口

Java 侧 `RemoteAiService` 的每个 Dubbo 方法都有 try-catch 兜底：

| 方法 | 异常兜底 |
| --- | --- |
| `enabled` | `false` |
| `listModels` | 空列表 |
| `judgeMark` | `fail("AI 评分异常: ...")` |
| `generateQuestions` | 空列表 |
| `diagnose` | `fail("AI 错题归因异常: ...")` |

## 相关文档

- [AI 能力总览](/backend/ai/)
- [Agent 接口清单](/backend/ai/api) —— Python 侧原生接口
- [AI 功能总览](/guide/ai-overview) —— 使用者视角
