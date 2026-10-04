---
title: Skill 技能详解
description: ruoyi-exam-agent 的 17 个 AI 技能清单、输入输出契约与调用方式
---

# Skill 技能详解

**Skill（技能）** 是 Agent 的能力单元：一次「提示词 + 模型调用 + 结构化解析」的封装。
它不碰数据库，只做「输入 → 输出」的纯计算，因此可独立单测。

## Skill 的设计契约

```text
┌──────────────────────────────────────────────────────────┐
│  AiSkill.run(input, ctx)   ← 模板方法，子类不重写           │
│                                                            │
│   1. prompt_registry.require(prompt_code)  取提示词          │
│   2. build_vars(inp, ctx)                  子类实现：拼变量  │
│   3. tpl.render(**variables)              渲染（占位符安全） │
│   4. 读 tpl.params → ChatRequest           温度/JSON 模式   │
│   5. model_router.chat()                   走模型网关       │
│   6. self.parse(resp.content)              子类实现：解析   │
│   7. 返回 SkillResult                                       │
└──────────────────────────────────────────────────────────┘
```

四条约定：

1. 输入输出都是 **Pydantic 模型**，可独立单测
2. 提示词外置到 `prompts/<code>.yaml`，**改提示词不改代码**
3. 每次执行记录 `model / attempt_chain / latency / prompt_version`，便于追查「这版分数是哪套提示词打出来的」
4. 声明 `risk_level`，写操作类由 [护栏](/backend/ai/tools#护栏) 拦截

`SkillResult` 字段：`skill`、`version`、`data`、`model`、`model_code`、`attempt_chain`、
`latency_ms`、`prompt_version`、`need_human`、`raw`、`trace_id`。

## 17 个技能总览

### 命题域（6 个）

| code | 名称 | 提示词 | 用途 |
| --- | --- | --- | --- |
| `question_gen` | 智能出题 | `question_gen.yaml` | 按知识点、难度、题型批量生成试题 |
| `distractor_gen` | 干扰项生成 | `distractor_gen.yaml` | 为已有正确选项的题干生成有迷惑性的干扰项 |
| `question_rewrite` | 试题改写扩量 | `question_rewrite.yaml` | 等价变体改写，用于题库扩量与防泄露 |
| `knowledge_tag` | 知识点打标 | `knowledge_tag.yaml` | 为存量试题补知识点、难度与认知层次 |
| `analysis_gen` | 试题解析生成 | `analysis_gen.yaml` | 为已有答案的试题批量生成解析 |
| `question_audit` | 试题质检 | `question_audit.yaml` | 审查答案唯一性、歧义、暗示泄露（Reflection 的 Critic） |

### 阅卷域（5 个）

| code | 名称 | 提示词 | 用途 |
| --- | --- | --- | --- |
| `mark_score` | 主观题 AI 评分 | `mark_score.yaml` | 简答/论述/填空的建议分、要点命中与置信度 |
| `mark_reflect` | 评分自检 | `mark_reflect.yaml` | 对已给出的 AI 评分做二次校验 |
| `code_judge` | 代码题判分 | `code_judge.yaml` | 结合运行结果与代码质量评分 |
| `scoring_calib` | 评分校准 | `scoring_calib.yaml` | 对比 AI 分与教师历史分，给宽严偏差与校准系数 |
| `similarity_detect` | 作答雷同检测 | `similarity_detect.yaml` | 相似度聚类，辅助判定抄袭 |

### 学情域（2 个）

| code | 名称 | 提示词 | 用途 |
| --- | --- | --- | --- |
| `diagnosis` | 错题归因 | `diagnosis.yaml` | 定位薄弱知识点与错误类型 |
| `recommend` | 个性化推题 | `recommend.yaml` | 基于学情画像推荐复习题 |

### 试卷域（2 个）

| code | 名称 | 提示词 | 用途 |
| --- | --- | --- | --- |
| `paper_review` | 试卷审查 | `paper_review.yaml` | 知识点覆盖、难度分布、重复度、预计用时 |
| `paper_difficulty` | 试卷难度预估 | `paper_difficulty.yaml` | 考前预估平均分、通过率与分数分布 |

### 监考与报告（2 个）

| code | 名称 | 提示词 | 用途 |
| --- | --- | --- | --- |
| `proctor_analyze` | 监考行为分析 | `proctor_analyze.yaml` | 分析监考事件时序，输出可疑程度与证据链 |
| `report_write` | 分析报告撰写 | `report_write.yaml` | 把统计数据转成自然语言报告 |

## 重点一：`mark_score` 评分逻辑

这是唯一已经接入业务链路的技能（阅卷页的「AI 预评」），也是最需要谨慎的一个。

**铁律：AI 只给建议分，不给定分。**

```python
CONFIDENCE_FLOOR = 0.6   # 置信度低于此值 → need_human = True
```

输入 `MarkScoreInput`：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `question_type` | `SHORT_ANSWER` | 题型 |
| `stem` | — | 题干 |
| `full_score` | `10` | 满分（须 > 0） |
| `standard_answer` | — | 参考答案 |
| `rubric` | 空 | 评分要点 |
| `analysis` | 空 | 试题解析 |
| `answer_text` | — | 考生作答 |
| `anchor_high` / `anchor_low` | 空 | 历史高/低分样例，作为评分锚点 |

输出 `MarkScoreOutput`：`score`、`full_score`、`confidence`、`matched_points[]`、`reason`、`comment`、`need_human`。

### 三重兜底

解析完模型输出后，代码会**无条件夹逼**，防止模型把分数写飞：

```python
out.score      = max(0.0, min(out.score, out.full_score))   # 夹到 [0, 满分]
out.confidence = max(0.0, min(out.confidence, 1.0))         # 夹到 [0, 1]
if out.confidence < CONFIDENCE_FLOOR:
    out.need_human = True                                    # 置信度不足一律转人工
```

### 置信度语义

| 区间 | 含义 | 处置 |
| --- | --- | --- |
| ≥ 0.9 | 要点清晰，评分有把握 | 可直接采纳 |
| 0.6 ~ 0.9 | 基本可判，存在表述歧义 | 建议人工过一眼 |
| < 0.6 | 无法可靠判断 | **必须转人工**，此时 score 仅供参考 |

### 提示词里的六条铁律

1. 建议分不是最终分，最终分由教师确认
2. 严格按参考答案的评分要点给分，要点之外不加分
3. 不得因作答冗长、字迹工整、态度诚恳给虚高分
4. 不得因作答简短给低分
5. 作答空白 / 乱码 / 复制题干 / 完全答非所问 → **直接 0 分，confidence 给 1.0**
6. 信息不足无法判断时如实降低 confidence

第 5 条值得注意：空白卷是最确定的情况，反而给满置信度——
它避免了「明明是白卷却因为置信度低又推给老师重判」。

## 重点二：`question_gen` 出题参数

输入 `QuestionGenInput`：

| 字段 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- |
| `question_type` | `SINGLE` | 枚举 | `SINGLE`/`MULTIPLE`/`JUDGE`/`BLANK`/`MATCH`/`SHORT_ANSWER`/`ESSAY`/`CODE`/`UPLOAD_FILE` |
| `difficulty` | `medium` | — | `easy`/`medium`/`hard` |
| `knowledge_points` | `[]` | — | 知识点列表，会渲染成「、」连接的字符串 |
| `count` | `5` | 1 ~ 30 | 生成题数 |
| `score` | `5` | — | 默认分值 |
| `rag_context` | — | — | 参考资料，优先基于资料命题 |
| `extra` | — | — | 附加要求，见下 |

`extra` 里两个特殊键：

| 键 | 效果 |
| --- | --- |
| `extra.language = "en"` | 题干/选项/解析全英文；`"zh"` 或未指定用中文 |
| `extra.reading_comprehension = true` | 每题含一段阅读短文作为题干背景 |

### 答案字段契约（重要）

生成的 `answer` 是 **JSON 字符串**，结构按题型不同。这套契约与 Java 侧落库格式**严格对齐**：

```text
SINGLE / MULTIPLE : {"rightKeys": ["A", "C"]}
JUDGE             : {"rightKeys": ["A"]}          A=正确，B=错误
BLANK             : {"blanks": [{"answers": ["北京", "北平"]}]}
MATCH             : {"pairs": [{"left": "CPU", "right": "中央处理器"}]}
SHORT_ANSWER/ESSAY: {"answer": "..."}
CODE              : {"language": "java", "answer": "...", "remark": "..."}
UPLOAD_FILE       : {"answer": "作答要求与评分要点"}
```

输出 `GeneratedQuestion`：`question_type`、`stem`、`options[{key,content}]`、`answer`、
`analysis`、`knowledge_points`、`difficulty`、`score`。

::: tip 生成的题默认落草稿态
AI 生成的试题入库时状态是**草稿**，需要人工确认后才启用。这是护栏的一部分。
:::

## 重点三：`proctor_analyze` 强制转人工

```python
# app/skills/proctor.py
def parse(self, content, ...):
    data = ...
    data["need_human"] = True    # 强制：不允许模型自己说不需要人工
    return data
```

这是硬编码的。作弊认定必须由人来做，模型只负责把事件时序整理成证据链。

同理，`similarity_detect`（雷同检测）也是 `require_human_review = True`。

## 调用方式

### 通用入口

```bash
# 执行单个技能
curl -X POST http://127.0.0.1:9221/api/ai/skill/mark_score/run \
  -H "Content-Type: application/json" \
  -d '{
        "tenant_id": "000000",
        "input": {
          "stem": "简述 TCP 三次握手",
          "full_score": 10,
          "standard_answer": "SYN -> SYN-ACK -> ACK",
          "answer_text": "客户端发 SYN，服务端回 SYN-ACK，客户端再发 ACK"
        }
      }'
```

```bash
# 批量执行（并发，skip_error=true 时单条失败不影响其它）
curl -X POST http://127.0.0.1:9221/api/ai/skill/mark_score/batch \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"000000","items":[{"input":{...}},{"input":{...}}],"max_parallel":4,"skip_error":true}'
```

::: tip 批量返回按 index 排序
Agent 并发执行**不保证顺序**，所以每条结果都带 `index` 字段。
Java 侧 `judgeMarkBatch` 会按 index 还原成入参顺序——调用方不用自己排。
:::

### 业务封装入口

出题、阅卷、学情还有更贴近业务的封装，见 [Agent 接口清单](/backend/ai/api)：
`/api/ai/question/generate`、`/api/ai/grade/auto`、`/api/ai/recommend/diagnose` 等。

### 从 Java 侧调用

业务服务走 Dubbo，不直接打 HTTP：

```java
@DubboReference
private RemoteAiService remoteAiService;

RemoteMarkAiVo vo = remoteAiService.judgeMark(bo);
if (vo.getNeedHuman() || vo.getConfidence().compareTo(LOW_CONFIDENCE) < 0) {
    // 不建议直接采纳
}
```

`RemoteAiService` 的所有方法**不抛异常**，失败体现在返回值的 `success/message` 里——
AI 是旁路能力，agent 挂了业务要照常跑。

## 编排：把技能串起来

单个技能解决单点问题，复杂任务需要编排。Agent 提供三层机制。

### 预置计划（Plan）

5 套规则化计划，零成本、可预期：

| task_type | 名称 | 步骤 |
| --- | --- | --- |
| `question_batch` | 批量出题（生成 + 质检） | `question_gen` → `question_audit` |
| `mark_batch` | 批量阅卷 | `list_pending_mark` → `mark_score` → `mark_reflect` → `save_ai_score` |
| `paper_compose` | 智能组卷 | `search_questions` → `paper_review` → `paper_difficulty` |
| `diagnose` | 学情诊断与推题 | `list_wrong_questions` → `diagnosis` → `recommend` |
| `proctor_report` | 监考报告生成 | `list_proctor_events` → `proctor_analyze` → `report_write` |

```bash
curl -X POST http://127.0.0.1:9221/api/ai/agent/plan/mark_batch/run \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"000000","params":{...},"approved":false}'
```

执行时每步结果会**回灌上下文**（`shared[step.id] = data`），后续步骤通过 `payload_from` 引用——
这就是 ReAct 的 Observation。步数上限 12（`AGENT_AGENT_MAX_STEPS`）。

### Critic 自检（Reflection）

命题与阅卷这两个「错不起」的域，Reflection 是标配：

- 命题：`question_audit` 打分，`passed` 且 `quality_score >= 6` 才算通过
- 阅卷：`mark_reflect` 复核，`accepted=false` 时改用 `adjusted_score` 并置 `need_human=true`

只需额外 1 次调用，性价比高于 Multi-Agent（2~5 次）。
开关：`AGENT_AGENT_REFLECTION_ENABLED`（默认开），阈值 `AGENT_AGENT_REFLECTION_MIN_SCORE`（0.6）。

### Multi-Agent 拓扑

| 拓扑 | 语义 | 典型用途 |
| --- | --- | --- |
| `pipeline` | 串行流水线，上一步输出喂下一步 | 生成 → 质检 |
| `vote` | 并行投票，分差 > tolerance 时 `need_arbitration=true` | **阅卷双评** |
| `panel` | 并行专家组，单专家失败不影响其它 | 多角度审查 |

```bash
curl -X POST http://127.0.0.1:9221/api/ai/agent/orchestrate/vote \
  -d '{"tenant_id":"000000","skills":["mark_score","mark_score"],"payload":{...},"tolerance":1.0}'
```

## 新增一个 Skill

两步：

1. 写 `prompts/<code>.yaml`（含 `code`、`name`、`version`、`system`、`user`、`params`）
2. 在 `app/skills/registry.py` 的 `_build()` 里加一行注册

提示词支持 `reload()` 热加载，改完不用重启。

## 相关文档

- [Tool 工具与护栏](/backend/ai/tools)
- [提示词体系](/backend/ai/prompts)
- [Agent 接口清单](/backend/ai/api)
