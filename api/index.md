# API 概览

砚考提供 RESTful 开放接口，用于题库同步、考试创建、成绩拉取等系统集成场景。

::: tip 先确认版本
本文描述 `v1` 接口。接口路径统一前缀 `/api/v1`。
:::

## 接入准备

### 获取凭证

在 **系统管理 → 开放接口 → 应用管理** 中创建应用，得到：

| 凭证 | 说明 |
| --- | --- |
| `appId` | 应用标识，可公开 |
| `appSecret` | 密钥，**仅创建时可见一次**，请妥善保存 |
| `scope` | 该应用被授权的接口范围 |

### 鉴权

采用 `Bearer Token`：

```bash
# 1. 换取 token（有效期 2 小时）
curl -X POST https://kaoshi.example.edu.cn/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{
        "appId": "your-app-id",
        "appSecret": "your-app-secret"
      }'

# 返回
{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 7200
}
```

```bash
# 2. 调用业务接口
curl https://kaoshi.example.edu.cn/api/v1/question-banks \
  -H "Authorization: Bearer eyJhbGciOi..."
```

::: warning Token 请在服务端缓存复用
每个 Token 有效期 2 小时，不要每次请求都重新换取。
建议提前 5 分钟刷新。
:::

## 通用约定

### 请求

- 编码：`UTF-8`
- 请求体：`application/json`
- 时间格式：ISO 8601，如 `2026-04-10T09:00:00+08:00`
- 分页参数：`page`（从 1 开始）、`pageSize`（默认 20，最大 200）

### 响应

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": { }
}
```

失败：

```json
{
  "code": 40001,
  "message": "参数校验失败：questionType 不合法",
  "traceId": "a1b2c3d4"
}
```

常见错误码：

| code | 含义 | 处理建议 |
| --- | --- | --- |
| 0 | 成功 | — |
| 40001 | 参数校验失败 | 检查请求体 |
| 40101 | Token 无效或过期 | 重新换取 Token |
| 40301 | 无该接口权限 | 检查应用 scope |
| 40302 | 数据范围受限 | 检查应用被授权的组织节点 |
| 40401 | 资源不存在 | — |
| 42901 | 触发限流 | 按 `Retry-After` 退避重试 |
| 50000 | 服务端错误 | 携带 `traceId` 联系支持 |

### 限流

默认 100 次/秒/应用。超限返回 42901，响应头 `Retry-After` 给出建议等待秒数。

### 幂等

所有写接口支持 `Idempotency-Key` 请求头，24 小时内重复请求会返回首次结果。

## 主要资源

| 资源 | 路径 | 说明 |
| --- | --- | --- |
| 题库 | `/api/v1/question-banks` | 题库增删改查 |
| 题目 | `/api/v1/questions` | 题目增删改查、批量导入 |
| 知识点 | `/api/v1/knowledge-points` | 知识点树 |
| 试卷 | `/api/v1/papers` | 组卷、生成平行卷 |
| 考试 | `/api/v1/exams` | 创建、发布、查询 |
| 考生 | `/api/v1/exams/{id}/candidates` | 名单管理 |
| 作答 | `/api/v1/exams/{id}/submissions` | 作答记录 |
| 成绩 | `/api/v1/exams/{id}/scores` | 成绩查询与导出 |
| 组织 | `/api/v1/organizations` | 组织树同步 |
| 用户 | `/api/v1/users` | 用户同步 |

## 示例：从自有题库同步题目

```bash
curl -X POST https://kaoshi.example.edu.cn/api/v1/questions:batchImport \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: import-20260410-001" \
  -d '{
        "questionBankId": "qb_1a2b3c",
        "onDuplicate": "skip",
        "questions": [
          {
            "questionType": "single_choice",
            "stem": "关于惯性，下列说法正确的是：",
            "options": [
              { "key": "A", "content": "物体运动越快惯性越大" },
              { "key": "B", "content": "静止的物体没有惯性" },
              { "key": "C", "content": "惯性大小只与质量有关" },
              { "key": "D", "content": "失重状态下惯性消失" }
            ],
            "answer": ["C"],
            "analysis": "惯性是物体的固有属性，仅由质量决定。",
            "difficulty": 0.7,
            "knowledgePointPaths": ["力学/牛顿运动定律"],
            "externalId": "legacy-10231"
          }
        ]
      }'
```

响应：

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "created": 1,
    "skipped": 0,
    "failed": 0,
    "items": [
      { "externalId": "legacy-10231", "questionId": "q_9f8e7d", "status": "created" }
    ]
  }
}
```

`externalId` 用于把砚考的题目 ID 与你方系统关联，后续可通过它做增量更新。

## 示例：拉取一场考试的成绩

```bash
curl "https://kaoshi.example.edu.cn/api/v1/exams/exam_5d6e7f/scores?page=1&pageSize=200" \
  -H "Authorization: Bearer <token>"
```

```json
{
  "code": 0,
  "data": {
    "examId": "exam_5d6e7f",
    "examName": "大学物理 A · 期中测验",
    "total": 248,
    "page": 1,
    "pageSize": 200,
    "items": [
      {
        "userId": "u_20240101",
        "studentNo": "2024010101",
        "name": "张三",
        "status": "submitted",
        "score": 82.5,
        "adjustedScore": null,
        "durationSeconds": 4210,
        "submittedAt": "2026-04-10T10:12:31+08:00"
      }
    ]
  }
}
```

`status` 取值：`not_started` / `in_progress` / `submitted` / `absent` / `deferred` / `violation`。

## 事件推送

除主动查询外，砚考也会主动推送事件（考试发布、交卷、成绩发布等），
详见 [Webhook 与集成](/api/webhook)。

## SDK

| 语言 | 安装 |
| --- | --- |
| Node.js | `npm install @yankao/sdk` |
| Python | `pip install yankao-sdk` |
| Java | Maven 坐标请联系交付团队 |

## 最佳实践

1. **批量优于循环**：题目导入、名单导入一律用批量接口
2. **用 `externalId` 做映射**：不要依赖砚考内部 ID 做业务判断
3. **缓存 Token**：2 小时有效期内复用
4. **处理限流**：实现指数退避重试
5. **记录 `traceId`**：排查问题时这是唯一有效线索
6. **只读优先**：只同步数据时，把应用 scope 限制为只读

## 沙箱环境

申请到的测试应用默认指向沙箱环境 `https://sandbox-yankao.example.com`，
数据每日凌晨清空，可放心做压测与联调。
