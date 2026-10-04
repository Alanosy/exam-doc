---
title: AI 能力总览
description: 砚考 AI 子系统的整体架构、两个服务分工、请求链路与安全边界
---

# AI 能力总览

砚考的 AI 不是「在某个服务里调一下大模型」，而是一套**独立部署、可插拔、带护栏**的子系统。
它由两个进程组成，Java 侧只做门面与权限收口，**模型推理全部发生在 Python 侧**。

## 为什么拆成两个服务

| 关切 | 结论 |
| --- | --- |
| 生态 | Python 侧要对接各家大模型、做 JSON 容错、跑 BM25 检索，Python 生态成熟得多 |
| 稳定性 | 模型调用耗时长、失败率高，放进 Java 线程池会拖垮业务服务 |
| 权限 | AI 要代用户调业务接口，这条链路必须落在有登录态、有权限码的一侧（Java） |
| 演进 | 换模型、改提示词、加减 Skill 都不该重启业务服务 |

于是有了这样的分工：

```text
  ┌─────────────────────────────────────────────────────────────┐
  │  业务服务（mark / question / paper / stat …）                │
  └───────────────────────┬─────────────────────────────────────┘
                          │ Dubbo  RPC
                  ┌───────▼────────┐
                  │ ruoyi-exam-ai  │  Java 网关层 · 端口 9220
                  │  · 权限收口     │  对外门面，不含任何 LLM SDK
                  │  · 补身份/租户  │
                  │  · 工具代调     │
                  └───────┬────────┘
                          │ REST（HTTP，同步）
                  ┌───────▼─────────┐
                  │ ruoyi-exam-agent │  Python Agent · 端口 9221
                  │  · Skill 技能     │  真正的推理与编排
                  │  · Tool 工具      │
                  │  · 模型网关       │
                  └───────┬─────────┘
                          │ HTTPS
                  ┌───────▼─────────┐
                  │  大模型供应商     │  DeepSeek / 通义 / OpenAI / 本地 Ollama …
                  └─────────────────┘
```

反向还有一条：Agent 需要查业务数据时，通过 `/api/exam-tool/**` **回调 Java 侧 9220**，
由 Java 侧带上用户令牌经网关（8080）访问真实业务接口。

## 两个服务一览

| 服务 | 语言 | 端口 | Nacos 服务名 | 职责 |
| --- | --- | --- | --- | --- |
| `ruoyi-exam-ai` | Java 17 | 9220 | `ruoyi-exam-ai` | 对外 REST + Dubbo 门面、权限与租户收口、业务接口代调、会话转发 |
| `ruoyi-exam-agent` | Python 3.12 | 9221 | `ruoyi-exam-agent` | Skill 编排、Tool 调用、模型网关、对话引擎、提示词、RAG、记忆 |

Java 侧**不引入** `spring-ai`、`langchain4j` 或任何 LLM SDK —— 它只有 `RestTemplate`。
Python 侧也不引入 langchain：只需要 `chat/completions` 一个能力，且要精确控制超时、重试与主备链路。

## 一次 AI 阅卷请求怎么走

以「AI 给一道简答题预评分」为例：

```text
1. 教师在阅卷页点「AI 预评」
        │
2. ruoyi-exam-mark ──Dubbo──▶ RemoteAiService.judgeMark(bo)
        │
3. ruoyi-exam-ai：补 tenantId → 拼 JSON → POST http://agent:9221/api/ai/skill/mark_score/run
        │
4. ruoyi-exam-agent：
        ├─ 取提示词 prompts/mark_score.yaml
        ├─ 渲染变量（题干/参考答案/评分要点/考生作答）
        ├─ 模型网关：按 priority 取主模型 → 失败则切备 → 都失败抛 AiUnavailableError
        ├─ 解析 JSON（容错：去代码块、截首尾、去尾逗号）
        └─ 兜底夹逼：score ∈ [0, full_score]，confidence ∈ [0,1]，
                     confidence < 0.6 → need_human = true
        │
5. 原路返回 RemoteMarkAiVo{score, reason, confidence, needHuman, matchedPoints}
        │
6. ruoyi-exam-mark：置信度低于 0.6 的不建议直接采纳，最终分仍由教师确认
```

::: tip 关键设计：AI 只给「建议」，不给「决定」
整条链路上 AI **不会直接写库**。它返回的是建议分、建议题目、建议结论，
写操作要么落草稿态（`save_questions`），要么必须显式 `approved=true`（`submit_mark_score`）。
:::

## 能力矩阵

砚考的 AI 覆盖命题、阅卷、学情、试卷、监考五个域，共 **17 个 Skill**：

| 业务域 | Skill | 面向 |
| --- | --- | --- |
| 命题 | 智能出题、干扰项生成、试题改写、知识点打标、解析生成、试题质检 | 教师 |
| 阅卷 | 主观题评分、评分自检、代码题判分、评分校准、雷同检测 | 教师 |
| 学情 | 错题归因、个性化推题 | 考生 |
| 试卷 | 试卷审查、难度预估 | 教师 |
| 监考 | 监考行为分析、分析报告撰写 | 教师 |

此外还有一个**对话式 Agent**：用户用自然语言说「帮我出 10 道计算机网络的选择题放进测试题库」，
Agent 自己规划步骤、调工具、缺参数时弹卡片追问、写操作前请求确认。

详见 [Skill 技能详解](/backend/ai/skills)。

## 安全边界（重要）

AI 能代用户调业务接口，这是最需要收口的地方。砚考做了**四道闸**：

| 闸口 | 位置 | 拦什么 |
| --- | --- | --- |
| ① 路径白名单 | Java `exam-tool.api.allow` | 只允许考试域前缀，用户/租户/菜单/监控/代码生成一律不在内 |
| ② 写操作二次白名单 | Java `exam-tool.api.write-allow` | 非 GET 还必须命中更窄的前缀，删考试、删试题永远不在名单里 |
| ③ 身份透传 | `/api/exam-tool/api/call` | 带**用户自己的令牌**走网关，越权由网关判 403；缺令牌直接 403，绝不退化成系统身份 |
| ④ 护栏 | Python `guardrail.py` | `submit_mark_score`、`publish_exam` 必须显式 `approved=true` |

角色隔离还有一道软闸：考生的会话里**压根看不到** `admin` 工具（`audience` 字段），
模型也就不会去规划「给全班打分」。但这是避让不是拦截，真正的拦截仍在 Java 侧。

::: warning 监考判定永远转人工
`proctor_analyze` 的 `need_human` 在代码里被**强制置为 true** ——
不允许模型自己说「不需要人工」。作弊认定必须由人来做。
:::

## 已知待办

写文档时核对出的几处不一致，部署前建议先确认：

| 问题 | 现状 | 影响 |
| --- | --- | --- |
| 配置前缀不匹配 | `AiAgentProperties` 绑定 `exam.ai.*`，Nacos 里写的是 `ai.agent.*` | Nacos 上那块不生效，实际走代码默认值 `http://127.0.0.1:9221` |
| `/chat` 网关路由缺失 | 网关只配了 `Path=/ai/**` | `/chat`、`/chat/sessions` 等不可达，只有 `/ai/chat` 能通 |
| `markTimeout` 未被引用 | 配置项存在但代码没用 | 单题评分实际用的是 `readTimeout`（60s） |
| 无流式实现 | pom 注释提到 SSE，但代码全是同步请求 | 对话响应是一次性返回，不是逐字流式 |

详见 [AI 服务部署与配置](/backend/ai/quickstart)。

## 继续阅读

- [AI 服务部署与配置](/backend/ai/quickstart) —— 把 AI 跑起来
- [Skill 技能详解](/backend/ai/skills) —— 17 个能力逐个说明
- [Tool 工具与护栏](/backend/ai/tools) —— AI 怎么操作系统
- [模型网关](/backend/ai/model-gateway) —— 主备、熔断、重试
- [对话式 Agent](/backend/ai/chat) —— 意图、槽位、追问卡
- [提示词体系](/backend/ai/prompts) —— 22 条提示词与热加载
- [Agent 接口清单](/backend/ai/api) —— Python 侧 REST 接口
