---
title: 考生端接口
description: 考试中心、在线答题、保存答案、交卷、成绩查询、错题本与我的证书接口
---

# 考生端接口

考生视角使用的接口，主要由 `ruoyi-exam-answer`（9214）、`ruoyi-exam-practice`（9217）、`ruoyi-exam-cert`（9218）、`ruoyi-exam-proctor`（9219）提供。

调用前请先读 [API 概览 — 鉴权](/api/#鉴权)。

## 一、考试中心与答题

### 我的考试列表

```http
GET /answer/record/center
```

返回我可参加的考试（含我的答题状态）。

### 我参加过的考试记录

```http
GET /answer/record/records
```

支持按考试、类型、状态、是否及格筛选。

### 开始答题

```http
POST /answer/record/start/{examId}
```

服务端会校验：

- 考试是否在时间窗内
- 我有无参加资格（白名单 / 加入码）
- 是否还有剩余重考次数
- 是否已超出迟到时限

成功后返回 `recordId`（答卷 ID），**并抓取试卷快照**。

::: tip 之后所有答题操作都以 recordId 为准
不再用 examId。因为同一人可能有多次作答记录，recordId 才是唯一的。
:::

### 获取试卷

```http
GET /answer/record/{recordId}/paper
```

返回题目列表（按题目乱序策略打乱后的顺序）。**不含正确答案**——移动端请注意别把答案下发到客户端。

### 保存答案

```http
POST /answer/record/{recordId}/answer
Content-Type: application/json

{
  "questionId": "1834523456789012345",
  "answer": "{...}"
}
```

逐题自动保存，支持断点续答。建议前端每道题作答后立即调用。

### 交卷

```http
POST /answer/record/{recordId}/submit
```

::: tip 幂等
重复提交不会生成多份成绩，可安全重试。
:::

交卷后链路：

```text
① 客观题自动判分
② 调 mark 同步主观题阅卷任务
③ 调 practice 错题入错题本
④ 调 proctor 结束监考会话
⑤ 及格且无待阅主观题 → 调 cert 颁发证书
```

### 查看成绩

```http
GET /answer/record/{recordId}/result
```

返回总分、逐题得分、正确答案与解析（受考试的「答案展示时机」控制）。

::: warning 主观题成绩要等阅卷
调用本接口时如果还有主观题没阅，`result` 里的主观题得分会是 0 或空缺。
需要等 [阅卷](/guide/grading) 完成。
:::

## 二、加入考试（公开链接）

```http
GET  /exam/join/{code}      查询加入码对应的考试信息
POST /exam/join/{code}      加入考试（可能需要密码）
```

`{code}` 是 10 位加入码，字符集避开了 `0/1/I/O/l`。

::: warning 这两个接口需要登录
默认**不在网关白名单**中。如果要做「扫码免登录查看考试须知」，
需要在 `ruoyi-gateway.yml` 的 `security.ignore.whites` 里放行并做好频控。
:::

## 三、错题本

前缀 `/practice`，内部接口是 `/wrong/*`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/practice/wrong/overview` | 错题概览（总数、已掌握数） |
| `GET` | `/practice/wrong/sources` | 来源分组列表 |
| `GET` | `/practice/wrong/sources/page` | 来源分组（分页） |
| `GET` | `/practice/wrong/list` | 错题列表 |
| `GET` | `/practice/wrong/{id}` | 错题详情 |
| `GET` | `/practice/wrong/{id}/reviews` | 重做历史 |
| `POST` | `/practice/wrong/{id}/review` | 提交一次重练作答 |
| `PUT` | `/practice/wrong/{id}/note` | 更新笔记 |
| `POST` | `/practice/wrong/{id}/master` | 标记已掌握 |
| `POST` | `/practice/wrong/{id}/ignore` | 忽略（隐藏） |
| `POST` | `/practice/wrong/{id}/restore` | 恢复 |
| `DELETE` | `/practice/wrong/{id}` | 删除记录 |

详见 [错题本](/guide/wrong-book)。

## 四、我的证书

前缀 `/cert`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/cert/mine/list` | 我的证书列表 |
| `GET` | `/cert/mine/record/{recordId}` | 某次考试的证书 |

证书状态区分「有效 / 已过期 / 已吊销」。详见 [证书管理](/guide/certificate)。

## 五、防作弊上报

前缀 `/proctor`。**一般由前端 `useProctor` 自动调用**，第三方客户端若要自研答题页需要实现。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/proctor/session/start` | 开考后创建监考会话，返回 `sessionId` 与 `rule` |
| `POST` | `/proctor/event/report` | 上报作弊事件（批量） |
| `POST` | `/proctor/session/heartbeat/{id}` | 心跳，30 秒一次，返回服务端真实计数 |
| `POST` | `/proctor/session/finish/{recordId}` | 交卷后结束会话 |
| `POST` | `/proctor/snapshot/upload?sessionId=` | 上传摄像头抓拍图 |

上报的事件类型：

```text
switch_screen   切屏/离屏
copy            复制
cut             剪切
paste           粘贴
contextmenu     右键菜单
devtool         开发者工具
multitab        多标签页
enter_fullscreen / exit_fullscreen
```

::: tip 建议批量上报
`useProctor` 的实现是：队列攒到 5 条或每 5 秒 flush 一次。
自研客户端照做可以避免把网关打爆。
:::

详见 [在线监考与防作弊](/guide/proctoring) 与 [防作弊与答题端](/frontend/proctor)。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| `/answer/record/start` 报「不可参加」 | 检查白名单、时间窗、迟到时限、剩余次数 |
| 获取到空试卷 | 检查试卷状态是否「就绪」、有没有题目 |
| 保存答案报 400 | 检查 `answer` 字段是不是合法 JSON 字符串 |
| 成绩里的主观题是 0 分 | 还没阅卷 |
| 交卷后没有证书 | 检查考试有没有绑证书模板；有无未阅主观题 |

## 相关

- 完整闭环：[快速开始](/guide/getting-started)
- [管理端接口](/api/admin)
