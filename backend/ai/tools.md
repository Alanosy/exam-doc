---
title: Tool 工具与护栏
description: Agent 回调业务系统的 26 个工具、角色隔离与四层安全护栏
---

# Tool 工具与护栏

Skill 负责「想」，Tool 负责「做」——
Tool 是 Agent 回调砚考业务系统的通道，也是整套 AI 里**最需要收口**的部分：

> AI 能代用户改数据，意味着一次提示词注入就可能变成一次越权写库。

## 调用链路

```text
  Agent 决定调 save_questions
        │
        ▼  POST http://<java>:9220/api/exam-tool/question/save-batch
        │     头：X-Agent-Token（共享令牌）
        │        X-Tenant-Id（租户）
        │
  ┌─────▼──────────────────────────────────────────┐
  │ ruoyi-exam-ai  ExamToolController（@SaIgnore）  │
  │   ① 校验 X-Agent-Token                          │
  │   ② Dubbo 调真实业务服务                         │
  └────────────────────────────────────────────────┘
```

而 `api_call` 这类「代用户调任意接口」的工具，链路更长：

```text
  Agent  →  /api/exam-tool/api/call（9220）
         →  校验路径白名单 + 写操作白名单
         →  带上【用户自己的令牌】请求网关 8080
         →  网关鉴权 → 下游服务的 @SaCheckPermission 判定
         →  越权返回 403
```

::: warning 为什么刻意不走网关
`/api/exam-tool/**` 被 `@SaIgnore` 放行了登录校验，
Python Agent 直连 9220 而不是走网关 8080。

因为公共模块的 `SecurityConfiguration` 注册了覆盖 `/**` 的 `SaServletFilter` 会校验 `SA-SAME-TOKEN`，
而这个头只有网关 `ForwardAuthFilter` 转发时才带。
`ExamToolSameTokenConfig` 负责给这些请求补上该头（排在 SaServletFilter 之前）。

真正的把关是 **`X-Agent-Token` 共享令牌**，不是内网通行证。
:::

## 26 个工具清单

### 通用（4 个，`audience=any`）

| code | 名称 | 端点 | 用途 |
| --- | --- | --- | --- |
| `resolve_entity` | 按名称定位对象 | POST `/api/exam-tool/resolve` | 按名称查考试/题库拿 ID。**用户只给名字时永远先调它** |
| `api_manifest` | 系统能力清单 | POST `/api/exam-tool/api/manifest` | 列出**当前用户有权使用**的接口 + 系统说明书。规划前先看它 |
| `api_call` | 调用系统接口 | POST `/api/exam-tool/api/call` | 以当前登录用户身份调系统接口 |
| `whoami` | 查询用户身份 | POST `/api/exam-tool/whoami` | 查当前用户角色与考试域权限 |

### 题库与试题（4 个，`admin`）

| code | 名称 | 端点 | 风险 |
| --- | --- | --- | --- |
| `list_question_banks` | 题库列表 | POST `/api/exam-tool/bank/list` | 读 |
| `create_question_bank` | 新建题库 | POST `/api/exam-tool/bank/create` | **写** |
| `search_questions` | 检索试题 | POST `/api/exam-tool/question/search` | 读 |
| `get_question` | 查询单题 | POST `/api/exam-tool/question/get` | 读 |

### 试题写入（2 个，`admin`，均为写）

| code | 名称 | 端点 | 说明 |
| --- | --- | --- | --- |
| `save_question` | 保存试题 | POST `/api/exam-tool/question/save` | 写入题库，**草稿态** |
| `save_questions` | 批量保存试题 | POST `/api/exam-tool/question/save-batch` | 批量写入指定题库 |

### 试卷（3 个，`admin`）

| code | 名称 | 端点 | 风险 |
| --- | --- | --- | --- |
| `get_paper` | 查询试卷 | POST `/api/exam-tool/paper/get` | 读 |
| `add_paper_questions` | 试卷加题 | POST `/api/exam-tool/paper/add-questions` | **写** |

### 考试（3 个，`admin`）

| code | 名称 | 端点 | 风险 |
| --- | --- | --- | --- |
| `get_exam` | 查询考试 | POST `/api/exam-tool/exam/get` | 读 |
| `find_exam` | 查找考试 | POST `/api/exam-tool/exam/find` | 读 |
| `publish_exam` | 发布考试 | POST `/api/exam-tool/exam/publish` | **写 · 高危** |

### 阅卷（4 个，`admin`）

| code | 名称 | 端点 | 风险 |
| --- | --- | --- | --- |
| `list_pending_mark` | 待阅清单 | POST `/api/exam-tool/mark/list-pending` | 读 |
| `get_mark_item` | 阅卷明细 | POST `/api/exam-tool/mark/get-item` | 读 |
| `submit_mark_score` | 提交分数 | POST `/api/exam-tool/mark/submit-score` | **写 · 高危** |
| `save_ai_score` | 保存 AI 建议分 | POST `/api/exam-tool/mark/save-ai-score` | 写（写 `ai_score`，**不覆盖人工分**） |

### 统计（5 个，`admin`，全读）

| code | 名称 | 端点 |
| --- | --- | --- |
| `exam_stats` | 考试统计 | POST `/api/exam-tool/stat/exam` |
| `exam_answer_stats` | 考试答卷统计 | POST `/api/exam-tool/stat/exam-answers` |
| `stat_overview` | 首页总览 | POST `/api/exam-tool/stat/overview` |
| `stat_record_trend` | 交卷趋势 | POST `/api/exam-tool/stat/record-trend` |
| `question_stats` | 题目统计 | POST `/api/exam-tool/stat/question` |

### 练习与监考（2 个）

| code | 名称 | 端点 | audience |
| --- | --- | --- | --- |
| `list_wrong_questions` | 错题列表 | POST `/api/exam-tool/practice/wrong-list` | **student** |
| `list_proctor_events` | 监考事件 | POST `/api/exam-tool/proctor/events` | admin |

## 角色隔离（软闸）

每个工具有 `audience` 字段：`any` / `admin` / `student`。

```python
def visible_tools(audience="any"):
    if audience == "admin":
        return [t for t in TOOLS.values() if t.audience in ("any", "admin")]
    if audience == "student":
        return [t for t in TOOLS.values() if t.audience in ("any", "student")]
    return list(TOOLS.values())
```

**学生的会话里压根看不到 admin 工具**，模型也就不会去规划「给全班打分」。

::: tip 这是避让，不是拦截
工具清单只是「不告诉模型有这个能力」。
真正的拦截在 Java 侧的路径白名单与网关鉴权——
就算模型硬编一个 `submit_mark_score` 出去，也会被挡回来。
:::

## 护栏（硬闸）

`app/agent/guardrail.py` 定义影响半径分级：

```text
read-only         → 可自主
draft-only        → 可自主（只写草稿态）
affects-score     → 必须人工审批
affects-publish   → 必须人工审批
```

### 四条规则

| 规则 | 常量 / 阈值 | 行为 |
| --- | --- | --- |
| 高危工具闸门 | `HIGH_RISK_TOOLS = {submit_mark_score, publish_exam}` | 未 `approved=true` → `GuardrailBlockedError` |
| 写操作闸门 | `risk_level == WRITE` | 未 `approved=true` → 拦截 |
| 步数闸门 | `MAX_STEPS = 12` | 超步数抛错，防 ReAct 循环失控烧 token |
| 置信度闸门 | `confidence_floor = 0.6` | 低于阈值或 `passed=false` → `needs_human_review` |

被批准的高危调用会打 warning 日志：**「高危工具 %s 已被人工批准执行」**，全程留痕。

### 草稿态工具

`DRAFT_ONLY_TOOLS = {save_question, add_paper_questions, save_ai_score}` ——
这三个可以自主执行，因为它们**不产生最终影响**：

- `save_question` / `add_paper_questions`：写入的是草稿
- `save_ai_score`：写 `ai_score` 字段，**不覆盖人工分**

### 强制转人工

`proctor_analyze`（监考分析）的 `need_human` 在代码里被**强制置 true**，
不允许模型自己说「不需要人工」。作弊认定必须由人来做。

## Java 侧的两道白名单

### 路径白名单

```yaml
exam-tool:
  api:
    allow: /exam/,/invite/,/question/,/paper/,/answer/,/mark/,/stat/,/practice/,/proctor/,/cert/,/system/dict/
    deny: /exam/user/,/system/dict/type/
    write-allow: /question/create,/mark/score,/mark/task/,/cert/record/,/practice/wrong/,/exam/
```

只列考试域业务接口。**用户、租户、菜单、监控、代码生成一律不在内**。
删考试、删试题、改用户这类破坏性操作永远不会出现在 `write-allow` 里。

`deny` 优先级高于 `allow`。

### 身份透传

`api_call` 的请求体：

```json
{
  "method": "GET",
  "path": "/exam/list",
  "query": { "examName": "期末" },
  "body": null,
  "token": "<用户令牌>",
  "clientId": "<客户端标识>",
  "userId": "123"
}
```

::: danger 缺令牌直接 403，绝不退化成系统身份
这条是硬约束。如果缺令牌时用系统身份兜底，
AI 就成了绕过所有权限的后门。
:::

后端响应 `R<Map<String,Object>>`，Python 侧识别含 `code` 键的结构：
`code != 200` 抛 `ToolError`，否则取 `data`。

## 系统说明书与能力清单

`api_manifest` 返回的不只是接口列表，还有两份喂给模型的关键材料：

| 字段 | 内容 |
| --- | --- |
| `items` | 按权限过滤后的接口清单（`ExamApiCatalog.ENTRIES`，共 **57 条**） |
| `systemBrief` | 系统说明书（`ExamSystemBrief.TEXT`） |
| `identity` | 用户角色与考试域权限 |
| `allowedPrefixes` / `writeAllowedPrefixes` | 当前生效的白名单 |

### 系统说明书在讲什么

这份文本在**规划阶段整份喂给模型**，六章：

1. 系统做什么（建题库 → 组卷 → 发布 → 作答 → 阅卷 → 统计 → 发证书）
2. 核心对象与链路（ASCII 图）
3. 各模块职责与路径前缀
4. 关键枚举（题型、难度、考试状态、试题状态、准入方式）
5. **常见需求固定配方**——10 条，例如「某场考试考得怎么样」：
   `GET /exam/list?examName=关键词` → `GET /exam/{id}/situation/overview` → `GET /stat/exam/{examId}/questions`
6. 六条铁律

**六条铁律**：

1. 不许凭空造 ID（雪花主键，先按名称查，查到多个让用户选）
2. 成绩不在考试表（在答卷库，实时概况走 `/exam/{id}/situation/overview`）
3. 写操作必须最后一步且只有一步、先拿确认
4. 没有权限码的动作不要规划
5. 考生只能看自己的数据
6. 改了业务语义就要同步改这份说明书

::: tip 57 条清单 ≠ 白名单，两套东西
`ExamApiCatalog`（57 条）用于「让模型知道有什么」，
`exam-tool.api.allow`（白名单前缀）用于「代调时放行什么」。
**二者必须同时命中**才能调通。
:::

## 工具不是 function calling

值得强调：砚考**没有**用 OpenAI 的 `tools` 参数做 function calling，
而是「提示词清单 + 模型规划出 ref」：

```text
- save_questions｜批量保存试题（写操作）｜批量写入指定题库｜入参 {bankId, questions[]}
- submit_mark_score｜提交分数（写操作）｜提交评分｜入参 {itemId, score}
```

模型在 `chat_plan.yaml` 指引下输出 `steps[].kind = "tool" | "api" | "answer"` + `ref`，
执行器按 ref 查表调用。

好处是可以精确控制「给模型看哪些工具」（角色隔离），
也便于在调用前插入护栏检查——function calling 由供应商侧直接回调，插不进去。

## 调试工具

```bash
# 查看当前可见的工具与护栏策略
curl http://127.0.0.1:9221/api/ai/tool/list

# 单独调用（approved=false 时高危工具会被拦）
curl -X POST http://127.0.0.1:9221/api/ai/tool/save_questions/invoke \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"000000","payload":{...},"approved":false}'
```

护栏拦截时返回 `{ok:false, blocked:true, error:"..."}`，而不是抛异常。

## 相关文档

- [Skill 技能详解](/backend/ai/skills)
- [对话式 Agent](/backend/ai/chat)
- [AI 服务部署与配置](/backend/ai/quickstart)
