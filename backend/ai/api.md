---
title: Agent 接口清单
description: ruoyi-exam-agent（Python 9221）的 REST 接口，按业务域分类
---

# Agent 接口清单

这一页是 `ruoyi-exam-agent`（Python，**端口 9221**）的接口清单。

::: warning 这些接口不经过网关
Agent 监听 9221，**不注册到 Spring Cloud Gateway**，不直接对外暴露。
正常业务链路里它由 `ruoyi-exam-ai`（9220）调用。

这一页主要用于**调试、排查与二次集成**。
对外（前端）可用的 AI 接口见 [AI 接口](/api/ai)。
:::

## 通用约定

| 项 | 值 |
| --- | --- |
| Base URL | `http://<agent-host>:9221` |
| 接口前缀 | `/api/ai` |
| 数据格式 | `application/json` |
| 统一返回体 | `{"code": 200, "msg": "success", "data": {...}}` |
| HTTP 状态码 | **恒为 200**，业务错误体现在 `code` 里 |

业务码：`200` 成功、`400` 参数错、`401` 未授权、`403` 禁止、`404` 未找到、
`500` 内部错误、`503` AI 不可用。

::: tip `/health` 不包 R&lt;T&gt;
`/health` 与 `/ping` 返回裸结构，因为 Nacos 与 Docker `HEALTHCHECK` 要直接读 `status` 字段。
:::

## 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 完整状态（也挂了 `/api/ai/health`） |
| GET | `/ping` | `{"pong": true}`，不查任何依赖 |

`/health` 返回：

```json
{
  "status": "UP",
  "service": "ruoyi-exam-agent",
  "version": "1.0.0",
  "nacos":  {"enabled": true, "server": "127.0.0.1:8848", "registered": true, ...},
  "skills": 17,
  "prompts": 22,
  "rag":    {"enabled": false, "doc_count": 0, "chunk_count": 0, "term_count": 0},
  "model":  {"failover_enabled": true, "config_source": "mysql,env", "circuit": {}, ...},
  "call":   {"total": 128, "failed": 3, "switched": 5, "success_rate": 0.977}
}
```

**排查故障时先看这个**。

## 出题

前缀 `/api/ai/question`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/question/generate` | 生成试题（`with_audit=true` 时带质检） |
| POST | `/api/ai/question/generate-audit` | 生成 + 逐题质检，返回 accepted / rejected |
| POST | `/api/ai/question/rewrite` | 试题改写扩量 |
| POST | `/api/ai/question/distractor` | 生成干扰项 |
| POST | `/api/ai/question/tag` | 知识点打标 |
| POST | `/api/ai/question/analysis` | 生成解析 |

### generate

请求：

```json
{
  "knowledge_points": ["TCP/IP", "三次握手"],
  "difficulty": "medium",
  "question_type": "SINGLE",
  "count": 5,
  "score": 5,
  "material_key": "",
  "tenant_id": "000000",
  "with_audit": false,
  "extra": { "language": "zh" }
}
```

响应 `data`：

```json
{
  "questions": [
    {
      "question_type": "SINGLE",
      "stem": "TCP 三次握手的第二步是？",
      "options": [{"key": "A", "content": "..."}],
      "answer": "{\"rightKeys\":[\"B\"]}",
      "analysis": "...",
      "knowledge_points": ["TCP/IP"],
      "difficulty": "medium",
      "score": 5
    }
  ],
  "count": 5,
  "model": "deepseek-chat",
  "attempt_chain": "DeepSeek",
  "prompt_version": "v1",
  "latency_ms": 8420,
  "trace_id": "a1b2c3d4e5f6"
}
```

`count` 取值 1~30。

### generate-audit

多了两个数组：`audits`（逐题质检结果）与 `rejected`（未通过质检的题，含 `index` 与 `audit`）。

判定：`passed` 且 `quality_score >= 6`（`reflection_min_score` 0.6 × 10）。

## 阅卷

前缀 `/api/ai/grade`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/grade/auto` | 批量评分 |
| POST | `/api/ai/grade/single` | 单题评分（`?tenant_id=`） |

### auto

请求：

```json
{
  "paper_id": "", "answer_sheet_id": "", "record_id": "",
  "tenant_id": "000000",
  "reflection": false,
  "max_parallel": 4,
  "items": [
    {
      "question_id": "1900000000000000001",
      "item_id": "1900000000000000002",
      "question_type": "SHORT_ANSWER",
      "stem": "简述 TCP 三次握手",
      "reference_answer": "SYN -> SYN-ACK -> ACK",
      "rubric": ["提到 SYN", "提到 SYN-ACK", "提到 ACK"],
      "student_answer": "客户端发 SYN，服务端回 SYN-ACK，客户端再发 ACK",
      "full_score": 10,
      "analysis": "",
      "anchor_high": "", "anchor_low": ""
    }
  ]
}
```

响应 `data`：

```json
{
  "total": 1, "failed": 0, "need_human_count": 0,
  "confidence_floor": 0.6,
  "reflection": false,
  "results": [
    {
      "question_id": "...", "item_id": "...", "ok": true,
      "score": 8.5, "full_score": 10, "confidence": 0.88,
      "matched_points": [{"point": "提到 SYN", "got": true, "score": 3}],
      "reason": "...", "comment": "...",
      "need_human": false,
      "model": "deepseek-chat", "prompt_version": "v1",
      "trace_id": "...", "latency_ms": 6200
    }
  ],
  "hint": "score 为 AI 建议分，最终分必须由教师确认"
}
```

::: danger `hint` 字段不是装饰
`score` 是**建议分**。`need_human=true` 的结果不能自动落分。
Java 侧 `ruoyi-exam-mark` 的判据是置信度 < 0.6。
:::

`reflection=true` 时每条结果额外带 `reflection:{accepted, adjusted_score, score_quality, issues, comment}`；
`accepted=false` → `need_human=true` 且 `score` 用 `adjusted_score`。

`max_parallel` 取值 1~16。

## 学情

前缀 `/api/ai/recommend`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/recommend/wrong` | 按错题推题 |
| POST | `/api/ai/recommend/diagnose` | 错题归因（可带推题） |
| GET | `/api/ai/recommend/profile/{user_id}` | 长期学情画像（`?tenant_id=`） |

`/diagnose` 会把 `weak_points` 与 `priority` 写入长期记忆，供后续推题使用。
`target_count` 取值 1~10。

## 试卷

前缀 `/api/ai/paper`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/paper/analyze` | 试卷审查（知识点覆盖/难度分布/重复度/用时） |
| POST | `/api/ai/paper/review` | 同上（别名） |
| POST | `/api/ai/paper/difficulty` | 难度预估（平均分、通过率、分布） |

请求体 `PaperAnalyzeRequest`：`paper_id`、`title`、`duration`(60)、`pass_score`(60)、
`total_score`(100)、`questions[]`、`tenant_id`、`focus`(全面审查)、`extra`。

## 监考

前缀 `/api/ai/proctor`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/proctor/analyze` | 监考行为分析 |

`with_report=true` 时额外走 `report_write` 生成自然语言报告（`audience="监考员"`）。

::: warning 返回值里 `need_human` 恒为 true
代码强制置位，不允许模型自己说「不需要人工」。
作弊认定必须由人来做。
:::

## Skill 通用入口

前缀 `/api/ai/skill`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ai/skill/list` | 17 个技能清单（含入参 JSON Schema） |
| GET | `/api/ai/skill/{code}` | 单个技能详情 |
| POST | `/api/ai/skill/{code}/run` | 执行单个技能 |
| POST | `/api/ai/skill/{code}/batch` | 批量执行 |

### run

```bash
curl -X POST http://127.0.0.1:9221/api/ai/skill/mark_score/run \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"000000","input":{"stem":"...","full_score":10,
       "standard_answer":"...","answer_text":"..."}}'
```

响应：`{skill, version, data, need_human, model, attempt_chain, latency_ms, prompt_version, trace_id}`

### batch

```json
{
  "tenant_id": "000000",
  "items": [{"input": {...}}, {"input": {...}}],
  "max_parallel": 4,
  "skip_error": true
}
```

::: tip 结果按 index 排序
并发执行不保证顺序，每条结果带 `index`。
Java 侧 `judgeMarkBatch` 会按 index 还原成入参顺序。
:::

## Tool 工具

前缀 `/api/ai/tool`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ai/tool/list` | 工具清单 + 护栏策略 |
| GET | `/api/ai/tool/guardrail` | 护栏策略 |
| POST | `/api/ai/tool/{code}/invoke` | 调用工具（`approved` 开关） |

```json
{"tenant_id":"000000","payload":{...},"approved":false}
```

护栏拦截时返回 `{ok:false, blocked:true, error:"..."}` 而不是抛异常。

## Agent 编排

前缀 `/api/ai/agent`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ai/agent/plan/list` | 5 套预置计划 |
| POST | `/api/ai/agent/plan/{task_type}/run` | 执行计划 |
| POST | `/api/ai/agent/orchestrate/pipeline` | 串行流水线 |
| POST | `/api/ai/agent/orchestrate/vote` | 并行投票（阅卷双评） |
| POST | `/api/ai/agent/orchestrate/panel` | 并行专家组 |
| POST | `/api/ai/agent/reflect` | Critic 自检（`kind=question\|score`） |
| POST | `/api/ai/agent/generate-and-audit` | 生成 + 质检组合拳 |

`vote` 需要至少 2 个 skill，返回 `agreed_score`、`max_gap`、`need_arbitration`。

## 对话

前缀 `/api/ai/chat`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/chat` | 对话主入口 |
| POST | `/api/ai/chat/reset` | 清除会话 |
| GET | `/api/ai/chat/sessions` | 会话列表（`?tenant_id=&user_id=&limit=30`） |
| GET | `/api/ai/chat/session/{session_id}` | 会话详情 |

请求 `ChatIn`：`session_id`、`message`、`answers`、`tenant_id`、`user_id`、
`model_code`、`token`、`client_id`、`identity`、`options`。

响应 `ChatResult`：`session_id`、`reply`(Markdown)、`trace[]`、`ask`(追问卡)、`intent`、`data`。

会话列表只带摘要，**详情才带全量消息**——避免一次拉回几十个会话的完整聊天记录。

## 模型网关

前缀 `/api/ai/model`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ai/model/list` | 模型清单（密钥脱敏） |
| GET | `/api/ai/model/health` | 熔断状态与配置源 |
| POST | `/api/ai/model/reload` | 重新加载配置（热更新） |
| POST | `/api/ai/model/circuit/reset` | 复位熔断（`model_code` 为空则全部） |
| GET | `/api/ai/model/call-log` | 调用流水（`?limit=50`，1~500） |

## RAG

前缀 `/api/ai/rag`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/rag/ingest` | 灌入文档（切片 + 建索引） |
| POST | `/api/ai/rag/retrieve` | 检索（`top_k` 1~20） |
| GET | `/api/ai/rag/stats` | 索引统计 |
| POST | `/api/ai/rag/enable` | 运行时开关（`?flag=true`） |

一期用 **BM25 关键词检索**（内存倒排），**不需要向量库**，
所以 `requirements-rag.txt`（chromadb + sentence-transformers）不用装。

`AGENT_RAG_ENABLED` 默认 `False`。

## 端点总数

`health` 2（各双路径）+ question 6 + grade 2 + recommend 3 + paper 3 + proctor 1 +
skill 4 + tool 3 + agent 7 + chat 4 + model 5 + rag 4 = **44 个逻辑端点**。

## 相关文档

- [AI 能力总览](/backend/ai/)
- [AI 接口（对外）](/api/ai)
- [Skill 技能详解](/backend/ai/skills)
