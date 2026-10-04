---
title: 提示词体系
description: 22 条提示词清单、YAML 结构、渲染机制、版本管理与热加载
---

# 提示词体系

砚考把**所有提示词外置到 `prompts/*.yaml`**，改提示词不需要改代码、不需要重新发版。

```text
prompts/
├── 命题：question_gen / distractor_gen / question_rewrite
│        knowledge_tag / analysis_gen / question_audit
├── 阅卷：mark_score / mark_reflect / code_judge
│        scoring_calib / similarity_detect
├── 学情：diagnosis / recommend
├── 试卷：paper_review / paper_difficulty
├── 监考：proctor_analyze / report_write
└── 对话：slot_extract / chat_plan / chat_summarize
         chat_analysis / chat_free
```

共 **22 条**（README 里写的「17 条」是早期快照）。

## 22 条提示词一览

| # | 文件 | code | 版本 | 用途 | 温度 / max_tokens / JSON |
| :-- | --- | --- | --- | --- | --- |
| 1 | `question_gen.yaml` | question_gen | v1 | 批量生成试题，含答案 JSON 契约 | 0.7 / 3000 / array |
| 2 | `distractor_gen.yaml` | distractor_gen | v1 | 生成有迷惑性但可证伪的干扰项 | 0.8 / 1200 / array |
| 3 | `question_rewrite.yaml` | question_rewrite | v1 | 4 种策略改写等价变体 | 0.8 / 2000 / array |
| 4 | `knowledge_tag.yaml` | knowledge_tag | v1 | 补知识点、难度、布鲁姆认知层次 | 0.2 / 1200 / object |
| 5 | `analysis_gen.yaml` | analysis_gen | v1 | 为已有答案的题写解析 | 0.4 / 1500 / object |
| 6 | `question_audit.yaml` | question_audit | v1 | 质检：答案唯一性/歧义/暗示泄露 | 0.2 / 1500 / object |
| 7 | `mark_score.yaml` | mark_score | v1 | 主观题建议分 + 置信度 | **0.1** / 1500 / object |
| 8 | `mark_reflect.yaml` | mark_reflect | v1 | 复核已给出的评分 | **0.1** / 1000 / object |
| 9 | `code_judge.yaml` | code_judge | v1 | 代码题：功能正确性 + 代码质量 | 0.1 / 1500 / object |
| 10 | `scoring_calib.yaml` | scoring_calib | v1 | 对比 AI 分与教师分，给校准系数 | 0.1 / 800 / object |
| 11 | `similarity_detect.yaml` | similarity_detect | v1 | 雷同检测，区分真正雷同与正常相似 | 0.1 / 1200 / object |
| 12 | `diagnosis.yaml` | diagnosis | v1 | 错题归因（concept/calculation/misread/incomplete/skill/careless） | 0.2 / 1500 / object |
| 13 | `recommend.yaml` | recommend | v1 | 按遗忘曲线 + 循序渐进推题 | 0.3 / 1500 / array |
| 14 | `paper_review.yaml` | paper_review | v1 | 知识点覆盖/难度分布/重复度/用时 | 0.2 / 1800 / object |
| 15 | `paper_difficulty.yaml` | paper_difficulty | v1 | 预估平均分、通过率与分布 | 0.2 / 1000 / object |
| 16 | `proctor_analyze.yaml` | proctor_analyze | v1 | 事件时序 → 证据链（不做最终判定） | 0.2 / 1500 / object |
| 17 | `report_write.yaml` | report_write | v1 | 统计数据 → 自然语言报告 | 0.4 / 2000 / object |
| 18 | `slot_extract.yaml` | slot_extract | v1 | 语义抽取对话参数 | **0.01** / 600 / object |
| 19 | `chat_plan.yaml` | chat_plan | **v2** | 判断能否做到，拆成可执行步骤 | 0.2 / 1800 / object |
| 20 | `chat_summarize.yaml` | chat_summarize | v1 | 原始数据 → Markdown 结论 | 0.4 / 1600 / 否 |
| 21 | `chat_analysis.yaml` | chat_analysis | v1 | 答卷统计 → 面向老师的结论 | 0.4 / 1200 / 否 |
| 22 | `chat_free.yaml` | chat_free | **v2** | 领域内自由问答兜底 | 0.5 / 1200 / 否 |

::: tip 温度设置是有讲究的
**评分类一律 0.1，槽位抽取 0.01** —— 这两类要的是稳定可复现，不是创意。
**出题类 0.7~0.8** —— 需要多样性，否则连续生成十道题会高度雷同。
:::

## YAML 结构

以 `mark_score.yaml` 为例：

```yaml
code: mark_score
name: 主观题 AI 评分
version: v1
description: 对简答/论述/填空等主观题给出建议分与理由（只给建议分，最终分由教师确认）
params:
  temperature: 0.1
  max_tokens: 1500
  response_json: true
  response_shape: object
system: |
  你是阅卷助手，为考生的主观题作答给出**建议分**。
  ## 铁律
  1. 建议分不是最终分，最终分由教师确认
  2. 严格按参考答案的评分要点给分，要点之外不加分
  ...
  ## 置信度（confidence, 0-1）
  - 0.9 以上：要点清晰，评分有把握
  - 0.6-0.9：基本可判，但存在表述歧义
  - 0.6 以下：无法可靠判断，建议转人工
  ## 输出格式（严格 JSON 对象）
  { "score": 7.5, "full_score": 10, "confidence": 0.85,
    "matched_points": [{"point":"...", "got":true, "score":3}],
    "reason": "面向教师的评分说明", "comment": "面向学生的评语", "need_human": false }
user: |
  ## 题目   {question_type} / {stem} / {full_score}
  ## 参考答案 {standard_answer}
  ## 评分要点（若有）{rubric}
  ## 试题解析（若有）{analysis}
  ## 考生作答 {answer_text}
  ## 历史满分样例（作为评分锚点，若有）{anchor_high}
  ## 历史低分样例（作为评分锚点，若有）{anchor_low}
  请给出建议分。
```

| 字段 | 说明 |
| --- | --- |
| `code` | 与 Skill 的 `prompt_code` 对应。**缺这个字段的文件会被跳过并告警** |
| `name` / `description` | 展示用 |
| `version` | 版本，会回传到 `SkillResult.prompt_version` |
| `params` | `temperature` / `max_tokens` / `response_json` / `response_shape` |
| `system` / `user` | 提示词正文，支持 `{占位符}` |

## 渲染机制

::: warning 刻意不用 `str.format`
提示词里大量出现 JSON 示例（`{"score": 8}`）。
`str.format` 会把花括号吃掉，还要求写成 `{{ }}` 转义，极易出错。

这里用正则**只替换形如 `{identifier}` 的占位符**，其余花括号原样保留：

```python
_PLACEHOLDER = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\}")
```
:::

`_safe_render` 的行为：

| 情况 | 处理 |
| --- | --- |
| 命中上下文键 | 转字符串（list/dict 用 `json.dumps(ensure_ascii=False)`，`None` → `""`） |
| 支持 `a.b` 路径取值 | 如 `{identity.userId}` |
| **占位符缺失** | **原样保留**，不抛异常 |

最后一条很关键：一次模板改动不会把所有 Skill 打挂。

## 版本管理

每个模板带 `version`，Skill 执行后回传 `prompt_version`。

这意味着你可以回答一个很实际的问题：
**「这批分数是哪套提示词打出来的？」** —— 查调用日志里的 `prompt_version` 就知道。

改了提示词语义后，记得**升版本**，否则追查时会混淆。

## 热加载

```python
prompt_registry.reload()
```

提示词在启动时加载（`lifespan` 第 2 步），运行中可调用 `reload()` 重新扫描。
生产环境配合 `ai_prompt_template` 表可实现**租户级覆写**直接下发。

::: tip 加载失败不阻塞启动
`lifespan` 里每一步失败都不会让服务起不来，但会在 `/health` 的
`prompts` / `skills` / `nacos` 字段里体现出来。排查时先看 `/health`。
:::

## 几条值得单独说的提示词

### `chat_plan.yaml`（v2）——规划器的大脑

对话 Agent 的决策核心。它告诉模型三类能力：

```text
1. tool  —— 内置工具 code（26 个）
2. api   —— 系统接口 path（用 api_call 调）
3. answer—— 不需要数据，你直接回答
```

输出：`{goal, feasible, reason, steps[{kind, ref, title, params, risk}], direct_answer}`

**八条硬规则**：

1. 步骤最多 6 步
2. 不要凭空造 ID（先按名称查）
3. **写操作最多 1 步且放最后**
4. `roles` / `examPermissions` 是事实，`audience=student` 只能看自己的
5. 查询优先 `api`；出题用 `skill question_gen`；入库才用 `tool save_questions`
6. 纯聊天 → steps 里放一条 `kind=answer`
7. 宁可 `feasible=false` 也不编做不到的计划
8. 系统说明书里有固定配方就别自己发明

步骤间传值用 `{步骤序号.字段路径}`：

```text
GET /exam/{1.items.0.id}/situation/overview
         ↑ 第 1 步结果的第 0 项的 id
```

### `question_gen.yaml` ——答案契约在这里

这份提示词里写死了各题型的 `answer` JSON 结构，
与 Java 侧落库格式严格对齐。**改落库格式时必须同步改这里**。

### `proctor_analyze.yaml` ——明确不做判定

提示词里明写「不做最终作弊判定」，输出的是证据链与可疑程度。
代码层面也强制 `need_human = true`，双重保险。

## 新增提示词

1. 在 `prompts/` 下建 `<code>.yaml`，必须带 `code` 字段
2. 在对应 Skill 里设 `prompt_code = "<code>"`
3. 调用 `reload()` 或直接重启

## 调优建议

| 症状 | 可能原因 | 怎么调 |
| --- | --- | --- |
| 生成的题高度雷同 | 温度太低 | 提高 `question_gen` 的 `temperature`（当前 0.7） |
| 同一个作答两次评分不一致 | 温度太高 | 降低 `mark_score` 的 `temperature`（当前 0.1） |
| 输出 JSON 解析失败 | 模型不支持 `json_object` | 关掉该提示词的 `response_json`，靠容错解析兜底 |
| 模型总是「编一个」做不到的计划 | 硬规则不够强 | 强化 `chat_plan.yaml` 的第 7 条 |
| 分数普遍偏高 | 缺锚点 | 传入 `anchor_high` / `anchor_low` 历史样例 |

## 相关文档

- [Skill 技能详解](/backend/ai/skills)
- [对话式 Agent](/backend/ai/chat)
- [模型网关](/backend/ai/model-gateway) —— 结构化输出与 JSON 容错
