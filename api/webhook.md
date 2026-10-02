# Webhook 与集成

除了主动调用 [API](/api/) 查询，砚考也支持把事件**主动推送**给你的系统。

## 配置 Webhook

进入 **系统管理 → 开放接口 → Webhook**：

| 配置项 | 说明 |
| --- | --- |
| 回调地址 | 必须是 HTTPS，且公网可达 |
| 订阅事件 | 勾选关心的事件类型 |
| 密钥 | 用于签名校验，请保存 |
| 超时 | 默认 5 秒 |
| 重试次数 | 默认 3 次 |
| 数据范围 | 限定推送哪些组织节点下的事件 |

## 事件类型

| 事件 | 触发时机 |
| --- | --- |
| `exam.created` | 考试创建 |
| `exam.published` | 考试发布 |
| `exam.started` | 考试开始 |
| `exam.ended` | 考试结束 |
| `submission.submitted` | 考生交卷 |
| `submission.forced` | 被强制收卷 |
| `grading.completed` | 全部阅卷完成 |
| `score.published` | 成绩发布 |
| `score.corrected` | 成绩更正 |
| `proctoring.violation` | 认定违纪 |
| `question.created` | 题目创建 |
| `user.created` | 用户创建 |

## 推送格式

```http
POST /your-webhook-endpoint HTTP/1.1
Content-Type: application/json
X-Yankao-Event: submission.submitted
X-Yankao-Delivery-Id: del_7f8e9d
X-Yankao-Timestamp: 1775740800
X-Yankao-Signature: sha256=6f2a...
```

```json
{
  "event": "submission.submitted",
  "eventId": "evt_1a2b3c",
  "occurredAt": "2026-04-10T10:12:31+08:00",
  "data": {
    "examId": "exam_5d6e7f",
    "userId": "u_20240101",
    "studentNo": "2024010101",
    "submissionId": "sub_9d8c7b",
    "durationSeconds": 4210
  }
}
```

## 签名校验

签名算法：

```
signature = "sha256=" + HMAC_SHA256(secret, timestamp + "." + rawBody)
```

Node.js 示例：

```js
import crypto from 'node:crypto'

function verify(secret, timestamp, rawBody, signature) {
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
```

::: warning 必须用原始请求体校验
不要用 JSON 解析后再重新序列化的字符串做校验，空格差异会导致签名不匹配。
请使用框架提供的 raw body。
:::

同时建议校验 `X-Yankao-Timestamp` 与当前时间差值在 5 分钟内，防止重放攻击。

## 响应与重试

你的接口需要返回 **2xx**，否则砚考会重试。

重试策略（指数退避）：

```text
第 1 次重试：30 秒后
第 2 次重试：5 分钟后
第 3 次重试：30 分钟后
3 次失败后：事件进入「失败队列」，可在控制台手动重发
```

::: tip 幂等是必须的
网络抖动可能导致同一事件被投递多次。
请用 `X-Yankao-Delivery-Id` 或 `eventId` 做去重。
:::

## 快速接收示例（Express）

```js
import express from 'express'

const app = express()
app.post(
  '/webhook/yankao',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const event = req.header('X-Yankao-Event')
    const timestamp = req.header('X-Yankao-Timestamp')
    const signature = req.header('X-Yankao-Signature')

    if (!verify(process.env.YANKAO_SECRET, timestamp, req.body, signature)) {
      return res.status(401).send('bad signature')
    }

    // 先落库再处理，保证幂等
    const payload = JSON.parse(req.body.toString('utf8'))
    await saveIfAbsent(payload.eventId, event, payload)

    res.status(200).send('ok')

    // 异步处理业务逻辑，避免超时
    queue.enqueue(payload)
  }
)
```

::: tip 先返回 200，再处理业务
5 秒超时很短。建议把事件先持久化，立即返回 200，
真正的业务逻辑交给后台队列处理。
:::

## 常见集成场景

### 与教务系统同步成绩

```text
score.published → 你的接口接收 → 按 studentNo 匹配 → 回写教务系统
```

### 与人事系统同步培训考核

```text
grading.completed → 触发内部流程 → 更新员工培训档案 → 达标则解锁岗位资格
```

### 与 ATS 招聘系统联动

```text
exam.published  → 生成笔试链接写入候选人记录
submission.submitted → 更新候选人状态为「笔试完成」
score.published → 触发进入面试环节
```

### 与消息平台打通

```text
exam.published → 推送到企业微信群/钉钉群
proctoring.violation → 通知考务负责人
```

## 调试

Webhook 控制台提供：

- **最近投递记录**：请求头、请求体、响应码、响应体
- **手动重发**：针对失败事件
- **测试推送**：发送一条模拟事件，验证你的接口

本地开发可用内网穿透工具（如 ngrok）暴露本地端口，或直接使用沙箱环境。

## 常见问题

**收不到推送？**
依次检查：回调地址是否公网可达、证书是否有效、是否被防火墙拦截、
订阅的事件类型是否包含该事件、数据范围是否覆盖了该组织节点。

**签名一直校验失败？**
99% 的原因是用了解析后的 JSON 而非 raw body。检查框架的 body parser 配置。

**推送延迟？**
正常情况下 3 秒内送达。若积压，检查你的接口响应时间 —— 慢响应会拖慢整个队列。
