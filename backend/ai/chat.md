---
title: 对话式 Agent
description: 砚考 AI 助手的意图识别、槽位抽取、追问卡、运行轨迹与权限门禁
---

# 对话式 Agent

除了「点按钮触发某个 Skill」，砚考还有一个**用自然语言办事**的对话入口：

> 用户：帮我出 10 道计算机网络的选择题，难度中等，放进测试题库

Agent 会自己规划：查题库 → 生成 → 展示预览 → 等你确认 → 入库。

## 一次对话的完整链路

```text
POST /ai/chat  {message, sessionId?, answers?, token, identity}
        │
        ▼
  engine.chat()
        │
        ├─ 取/建会话（进程内存，TTL 30 分钟）
        ├─ 刷新 token / clientId / identity —— 以用户身份代调
        │
        ├─ 分支判断
        │    ├─ answers 非空        → 中断续跑（填完追问卡回来了）
        │    ├─ waiting 且猜到答案  → 手打答案续跑
        │    └─ 新提问              → detect_intent + extract_slots
        │
        ├─ 选 flow
        │    question_create / exam_analysis / question_search / general
        │
        └─ flow 执行
             ├─ 规划（LLM → 规则兜底 → 直接回答）
             ├─ 含写操作且未确认？ → 弹确认卡，等用户点头
             ├─ 逐步执行工具/接口/技能，每步记 trace
             └─ 汇总成 Markdown
```

## 意图识别

四个意图，**纯正则快判**（不花 token、延迟确定）：

| 意图 | 触发示例 | 正则 |
| --- | --- | --- |
| `question_create` | 「出 10 道题」「帮我出题」「生成 5 道选择题」 | `出\s*\d*\s*[道个条]*题\|生成.*?题\|来\s*\d+\s*道\|...` |
| `exam_analysis` | 「这次考得怎么样」「及格率多少」 | `答题情况\|考得怎么样\|通过率\|平均分\|...` |
| `question_search` | 「搜一下数据库的题」 | `搜\s*\d*\s*[道个条]*题\|找\s*\d+\s*道\|有没有.*?题` |
| `chat` | 其它 | 兜底 |

匹配顺序 `question_create → exam_analysis → question_search → chat`。

::: tip 意图用正则，槽位用 LLM
这是刻意的分工：**意图特征极强**，正则又快又准；
而槽位（知识点、题型、难度、题库名）千变万化，交给 LLM 语义理解，
不维护脆弱的正则映射表。

唯一例外是**数量**：纯数字 LLM 偶发丢字，所以用正则抽（`(\d+)\s*(?:道|个|条)`，
还认中文数字「十道」「两道」）。
:::

## 槽位（Slots）

业务槽位：`topic`、`count`、`question_type`、`difficulty`、`bank_keyword`、`bank_name`、
`new_bank_name`、`bank_id`、`exam_keyword`、`exam_id`、`exam_name`、`keyword`、
`language`、`reading_comprehension`、`status`、`limit`、`confirmed`

内部槽位（双下划线前缀）：

| 键 | 含义 |
| --- | --- |
| `__question` | 本轮原始问题，续跑时沿用，不被补充信息覆盖 |
| `__history` | 最近 N 条消息 |
| `__intent__` | LLM 修正后的意图 |
| `__plan` | 上一轮规划好的计划，用户确认后复用 |
| `__system_brief` / `__manifest` | 系统说明书与接口清单（一轮内缓存） |
| `__cancel__` | 用户说「取消」 |

合并策略 `merge_slots`：**新值覆盖旧值，但空值不覆盖**——
避免用户只改了题型，却用 `None` 把主题冲掉。

## 追问卡（AskForm）

缺参数时**不猜、不报错**，而是弹一张卡片让用户填。

```json
{
  "kind": "form",
  "title": "还差一点信息",
  "desc": "已识别到：主题=计算机网络、数量=10 道，还缺题型与题库",
  "fields": [
    { "key": "question_type", "label": "题型", "type": "select",
      "options": [{"label":"单选题","value":"SINGLE"}], "required": true },
    { "key": "bank_id", "label": "题库", "type": "select",
      "options": [{"label":"测试题库","value":"1900000000000000001"},
                  {"label":"新建题库","value":"__new__"}] }
  ],
  "submit_text": "继续",
  "cancel_text": "取消"
}
```

| 字段 | 说明 |
| --- | --- |
| `kind` | `form`（表单）/ `choice`（选项）/ `confirm`（确认） |
| `fields[].type` | `text` / `number` / `select` / `multi` / `switch` |
| `fields[].key` | 回传时作为 `answers` 的 key |
| `submit_text` / `cancel_text` | 按钮文案 |

::: warning 选项的 value 一律是字符串
题库 ID、考试 ID 是雪花 ID（19 位），
**超过 JS 的安全整数范围**，走数字会丢精度。
:::

### 三种中断场景

| 场景 | kind | 说明 |
| --- | --- | --- |
| 缺参数 | `form` | **缺什么一次问完**——分多轮追问会让用户觉得「这玩意做不了」 |
| 多个命中 | `form` + `select` | 按名称查到多个题库/考试时让用户选，选项含「新建题库」 |
| 写操作前 | `confirm` | 给预览，用户点头才执行；`desc` 里明写「写操作会真实改动系统数据」 |

### 用户不点按钮，直接打字怎么办

`_guess_answers()` 会猜：

- 「取消」「算了」「不用了」 → `{"__cancel__": true}`
- 「确认」「好的」「执行」 → `{"confirmed": true}`
- 单个字段 → 直接填（number 抽数字；select 先按 value 精确匹配，再按 label 前缀）
- 多字段 → 全数字填 number 字段；**select 优先于 text**；文本含「题库」且有 `new_bank_name` 字段 → 当作新建
- 兜底只认 `字段名=值` 格式

::: tip 猜错了比不猜更糟
兜底规则刻意保守。文本含「题库」时优先匹配 select 而不是 text，
否则「测试题库」会被 `new_bank_name` 文本框吞掉，
导致 `bank_id` 没赋值、又弹同一张卡——用户会觉得死循环了。
:::

## 运行轨迹（Trace）

每轮返回一个 `trace` 数组，前端可以渲染成时间线：

```json
{
  "id": "s1234567",
  "type": "tool",
  "title": "查询题库",
  "detail": "`POST /api/exam-tool/bank/list`",
  "status": "ok",
  "ref": "list_question_banks",
  "latency_ms": 42,
  "preview": ["测试题库（128 题）", "期末题库（56 题）"]
}
```

| `type` | 含义 |
| --- | --- |
| `think` | 思考（理解需求、规划完成） |
| `tool` | 调了内置工具 |
| `skill` | 跑了 AI 技能 |
| `ask` | 等待用户补充信息（`status=waiting`） |
| `write` | 写操作 |
| `done` | 完成 |
| `error` | 出错 |

关键设计：**工具失败不抛异常**，返回 `status="error"` 的步骤——
对话场景不该因一次工具失败整轮崩掉。

## 权限门禁

对话 Agent 能调 26 个工具，权限怎么收？

### 身份从哪来

Java 侧 `ChatServiceImpl.buildIdentity()` 构造身份快照并传给 Agent：

```json
{
  "userId": "1", "userName": "admin", "nickName": "管理员",
  "isSuperAdmin": true,
  "roles": ["admin"],
  "examPermissions": ["exam:ai:list", "system:question:add"],
  "roleScope": "admin",
  "staff": true,
  "note": "没有对应权限码的动作不要规划：即使发出去，网关也会返回 403。"
}
```

`roleScope` 判定：`*:*:*` → `admin`；有 `exam:` 权限 → `teacher`；
角色含 `student`/`考生`/`学员` → `student`；否则 `unknown`。

### 三道门禁

| 闸 | 位置 | 行为 |
| --- | --- | --- |
| ① 身份门禁 | `engine.py` | 学生问「出题」/「全班情况」→ 直接转 `flow_general`，交给规划器按权限重新判断 |
| ② 计划门禁 | `check_step_allowed()` | 计划阶段就检查步骤是否越权，越权则 `feasible=false` 并说明原因 |
| ③ 执行门禁 | Java 侧白名单 + 网关鉴权 | 真正的拦截，越权 403 |

第 ② 道的价值在于：**在计划阶段就告诉用户做不到**，
而不是执行到一半吃个 403 才说。

另外 `api_manifest` 返回的 identity 会**覆盖** ctx 里那份——Java 侧按权限算出来的更权威。

## 会话存储

会话存在 **进程内存**（`app/chat/session.py`），刻意不接 Redis：

```python
SESSION_TTL  = 1800   # 30 分钟无活动回收
MAX_SESSIONS = 500    # 超出淘汰最久未用的
MAX_HISTORY  = 40     # 每会话保留消息数

DEFAULT_OPTIONS = {
    "context_rounds": 6,     # 带多少轮历史进上下文
    "confirm_write": True,   # 写操作必须先确认
    "model_code": "",        # 留空走默认模型
    "planner": True,         # 开放域先规划再执行
}
```

理由：对话是短任务，进程重启丢掉可接受；
引入 Redis 会让本地调试必须先装 Redis。

::: warning 多实例部署时会话会「丢」
Agent 跑多副本时，请求可能被打到没有该会话的实例上。
生产若要多副本，需要开启会话粘性，或把 `SessionStore` 换成 Redis 实现。
:::

**会话里不存 trace**——trace 是一次回合的执行日志，回合结束就归档，下次重新生成。

### 另一套记忆

`app/memory/store.py` 是与会话**独立**的另一套机制，走 Redis/内存后端：

| 类型 | 键 | TTL |
| --- | --- | --- |
| 短期记忆 | `st:{session_id}` | 1800 秒 |
| 学情画像 | `lt:profile:{tenant_id}:{user_id}` | 长期 |
| 评分偏好 | `lt:scoring:{tenant_id}:{marker}` | 长期 |

目前学情画像被 `/api/ai/recommend/diagnose` 读写（归因后回写 `weak_points`）。

## 幂等性

用户填完追问卡后，engine 会**从头重跑整个 flow**。
因此 flow 必须满足：已确定的槽位（`bank_id`、`exam_id`）存在 slots 里，
重跑时直接跳过匹配步骤，**不能重复弹同一张卡**。

## 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/ai/chat` | 对话（经网关，推荐） |
| GET | `/ai/chat/sessions` | 历史会话列表（只带摘要） |
| GET | `/ai/chat/session/{id}` | 会话详情（带全量消息） |
| GET | `/ai/chat/whoami` | 当前用户的 AI 可见范围 |

请求体 `AiChatBo`：

| 字段 | 说明 |
| --- | --- |
| `sessionId` | 首轮不传 |
| `message` | 用户消息；提交追问卡时只回 `answers`，`message` 可为 null |
| `answers` | `{key: value}`，key 对应 `AiChatFieldVo.key` |
| `modelCode` | 指定模型，不传走主备链 |
| `options` | `contextRounds` / `confirmWrite` / `planner` |

::: warning `/chat` 在网关上不可达
网关只配了 `Path=/ai/**`，所以 `/chat`、`/chat/sessions` 走不通，
前端请统一用 `/ai/chat` 前缀。详见 [AI 服务部署与配置](/backend/ai/quickstart)。
:::

## 相关文档

- [Tool 工具与护栏](/backend/ai/tools)
- [提示词体系](/backend/ai/prompts)
- [Skill 技能详解](/backend/ai/skills)
