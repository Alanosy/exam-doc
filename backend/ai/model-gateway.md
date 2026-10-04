---
title: 模型网关
description: 大模型供应商接入、配置源优先级、主备切换、熔断与重试策略
---

# 模型网关

模型网关是 Agent 的 L2 层，负责把「我要调一次模型」变成
「**选哪个模型 → 失败怎么办 → 什么时候该放弃**」。

砚考不绑定任何一家供应商——底层走 **OpenAI 兼容协议**
（`POST {base_url}/chat/completions`），因此任何兼容服务都能接。

## 支持的供应商

只要提供 `base_url` + `api_key` + `model_name` 三元组即可，没有 per-provider 的 SDK 分支：

| 供应商 | base_url 示例 |
| --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` |
| 通义千问（兼容模式） | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| OpenAI | `https://api.openai.com/v1` |
| Moonshot / 智谱 | 各家兼容端点 |
| 本地 vLLM / Ollama | `http://localhost:11434/v1` |

::: tip 私有化部署
把 `base_url` 指向内网 Ollama 或 vLLM 即可完全离网运行，
这是政企客户最常见的诉求之一。
:::

## 配置源优先级

`AGENT_MODEL_SOURCE`（默认 `mysql,env`）定义了**按序尝试的链**：某个源拿到配置就停止。

| 源 | 类 | 数据来源 |
| --- | --- | --- |
| `mysql` | `MysqlModelProvider` | 只读 `ry-cloud.ai_model_config` 表，支持多租户 |
| `env` | `EnvModelProvider` | `AGENT_LLM_MODELS`（JSON 数组）或单模型 `AGENT_LLM_*` |
| `mock` | `MockModelProvider` | `AGENT_LLM_MOCK=true` 且其它源都没配时兜底 |

MySQL 源实际执行的 SQL：

```sql
SELECT id, config_name, model_type, model_name, api_base, api_key,
       temperature, max_tokens, timeout, retry_count, priority, weight, tenant_id
FROM ai_model_config
WHERE del_flag = '0' AND status = '0' AND tenant_id = %s
ORDER BY priority ASC, id ASC
```

注意两点：

- 表里的 `timeout` 是**毫秒**，代码会 `int(timeout / 1000)` 转成秒
- 缺 `api_key` 或 `model_name` 的记录**直接跳过**（不报错，也不生效）

配置带缓存（`AGENT_MODEL_CACHE_TTL`，默认 60 秒）。改完配置调
`POST /api/ai/model/reload?tenant_id=xxx` 可立即生效。

## 主备切换

```text
1. 取候选链（priority 升序，主用在前）
2. 过滤掉处于 OPEN 熔断态的
3. 取第一个发起调用，失败则在 retry_count 内重试同一模型
4. 仍失败 → 记 DEGRADED、切下一个候选 → 回到 3
5. 全部候选失败 → 抛 AiUnavailableError
6. 成功 → 写调用流水
```

### 哪些错误重试，哪些直接切

| 错误类型 | 判定 | 行为 |
| --- | --- | --- |
| 超时、网络不可达 | `retriable = True` | 重试同一模型，次数耗尽才切 |
| 408 / 409 / 425 / 429 / 500 / 502 / 503 / 504 | `retriable = True` | 同上 |
| 401 / 404 / 未配置 base_url 或 api_key | `retriable = False` | **立即切下一个**，不浪费重试 |

参数类错误重试没意义——401 重试十次还是 401。

重试次数 `retries = max(0, min(cfg.retry_count, 3))`，**上限被夹到 3**。

::: danger 绝不静默降级
全部候选失败时抛 `AiUnavailableError`，**绝不返回假成功**。

理由写在源码注释里：AI 阅卷若在主模型挂掉后静默返回 0 分，
老师会以为学生真的得了 0 分——**这比报错危险得多**。
:::

## 熔断

```text
                连续失败 >= fail_threshold
    HEALTHY ─────────────────────────────► OPEN（冷却 cooldown 秒）
       ▲                                      │ 冷却结束
       │        探针成功                       ▼
       └──────────────────── HALF_OPEN（放行 1 个探针）
                                 │ 探针失败 → 回 OPEN
```

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `AGENT_MODEL_FAILOVER_ENABLED` | `True` | 是否启用主备切换。关掉后只用第一个候选 |
| `AGENT_MODEL_MAX_RETRY` | `1` | 单模型内重试次数 |
| `AGENT_MODEL_FUSE_THRESHOLD` | `3` | 连续失败多少次后熔断 |
| `AGENT_MODEL_FUSE_COOLDOWN` | `60` | 熔断冷却秒数 |
| `AGENT_MODEL_DEFAULT_TIMEOUT` | `60` | 单次调用超时（秒），可被模型配置覆盖 |

**按模型 `code` 隔离**——A 模型熔断不影响 B 模型。

::: tip 为什么必须有熔断
没有熔断时，一个挂掉的模型会被每个请求都试一遍。
200 人批量阅卷 = 白等 200 次 60 秒超时。
:::

查看与复位：

```bash
# 查看各模型熔断状态
curl "http://127.0.0.1:9221/api/ai/model/health?tenant_id=000000"

# 手动复位（不传 model_code 则全部复位）
curl -X POST "http://127.0.0.1:9221/api/ai/model/circuit/reset?model_code=xxx"
```

## 结构化输出

多数 Skill 需要模型返回 JSON。做法是：

```python
if req.response_json:
    payload["response_format"] = {"type": "json_object"}
```

但模型不一定乖乖返回合法 JSON，所以 `app/llm/structured.py` 做了**三轮容错**：

```text
① 直接 json.loads
② 截取第一个 { 或 [ 到最后一个 } 或 ]
③ 去掉尾随逗号再试
全部失败 → 抛 LlmOutputError
```

还有 `_normalize()` 处理「期望数组却返回对象」的情况：
依次尝试 `data` / `items` / `list` / `questions` / `results` / `answer` 键；
若对象含 `stem` / `answer` / `question_type` 就视为单题包成数组。

::: warning 解析失败不静默降级
解析失败**抛异常**，而不是返回空列表。
「解析失败返回空」会让调用方以为「AI 认为没有问题」，这是最坏的沉默。
:::

另外 `extract_content()` 兼容推理型模型：正文可能在 `reasoning_content` 而不是 `content`。

## 调用审计

每次调用写一条 `CallRecord`：`ts`、`biz_type`、`skill_code`、`model`、
`attempt_chain`、`success`、`latency_ms`、`prompt_tokens`、`completion_tokens`、`error`。

`attempt_chain` 形如 `DeepSeek>Qwen`——一眼看出这次换了几次模型。

内存环形缓冲保留最近 `AGENT_CALL_LOG_SIZE`（默认 500）条：

```bash
curl "http://127.0.0.1:9221/api/ai/model/call-log?limit=50"
```

慢调用（> 3 秒）在 Java 侧也会打 info 日志，便于定位。

## 密钥脱敏

`ModelConfig.masked_key`：

- 长度 ≤ 8 → `***`
- 否则 → `前6位***后4位`

`/api/ai/model/list` 返回的是 `public_dict()`，`api_key` 字段被 `exclude` 掉，
只有 `api_key_masked`。**明文密钥不会出现在任何接口响应里**。

## 故障排查速查

| 现象 | 看哪里 | 可能原因 |
| --- | --- | --- |
| 报「请在后台『AI 模型配置』中添加并启用」 | `/api/ai/model/list` 返回 0 个 | 配置源没拿到：表记录 `status != 0`，或缺 `api_key` |
| 一直用备模型 | `/api/ai/model/health` 的 `circuit` | 主模型被熔断，等冷却或 `circuit/reset` |
| 401 | call-log 的 `error` | `api_key` 错或过期，属不可重试错误会直接切备 |
| 响应很慢 | call-log 的 `latency_ms` | 检查模型侧；必要时调小 `timeout` 让它更快失败并切换 |
| 输出解析失败 | 日志里的 `LlmOutputError` | 模型不支持 `json_object`，可关掉该提示词的 `response_json` |

## 相关文档

- [AI 服务部署与配置](/backend/ai/quickstart) —— 模型怎么配
- [Skill 技能详解](/backend/ai/skills)
- [Agent 接口清单](/backend/ai/api)
