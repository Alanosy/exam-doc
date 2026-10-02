---
title: API 概览
description: 砚考 RESTful 接口的调用约定、鉴权方式、网关前缀与错误码
---

# API 概览

砚考的全部接口经网关统一暴露。这份文档描述**实际存在的接口**，供第三方系统集成使用。

::: tip 想看 Swagger
服务起来后可以直接用 SpringDoc 界面：

```text
http://<网关>:8080/<服务前缀>/v3/api-docs
```

网关白名单里已经放行了 `/*/v3/api-docs`。详见 [接口文档配置](/backend/framework/association/doc)。
:::

## 基础约定

| 项 | 值 |
| --- | --- |
| 协议 | HTTP/HTTPS |
| 网关地址 | `http://<host>:8080` |
| 生产反代前缀 | `/prod-api`（Nginx 剥掉前缀后转发） |
| 数据格式 | `application/json` |
| 字符集 | UTF-8 |

## 服务前缀一览

| 前缀 | 服务 | 端口 |
| --- | --- | :---: |
| `/auth` | 认证中心 | 9210 |
| `/system`、`/monitor` | 系统管理 | 9201 |
| `/tool` | 代码生成 | 9202 |
| `/resource` | 文件/OSS/短信/邮件 | 9204 |
| `/workflow` | 工作流 | 9205 |
| `/question`、`/bank`、`/bankCategory`、`/option`、`/tag` | 题库 | 9211 |
| `/paper` | 试卷 | 9212 |
| `/exam`、`/invite` | 考试管理 | 9213 |
| **`/answer`** | 答题（内部 `/record`） | 9214 |
| `/mark` | 阅卷 | 9215 |
| `/stat` | 统计 | 9216 |
| **`/practice`** | 错题本（内部 `/wrong`） | 9217 |
| `/cert` | 证书 | 9218 |
| **`/proctor`** | 防作弊 | 9219 |
| `/ai` | AI | 9220 |

::: warning 三个服务会剥掉前缀
`answer`、`practice`、`proctor` 三条网关路由配了 `StripPrefix=1`：

```text
对外 /answer/record/center        → 内部 /record/center
对外 /practice/wrong/overview     → 内部 /wrong/overview
对外 /proctor/exam/list           → 内部 /exam/list
```

调用时**用对外形式**。其它服务前缀与内部路径一致。
:::

## 鉴权

砚考用 Sa-Token + JWT。

### 1. 获取验证码

```bash
GET /auth/code
```

响应：

```json
{
  "captchaEnabled": true,
  "code": 200,
  "img": "data:image/png;base64,...",
  "uuid": "8f3c1a2b-..."
}
```

调试期可以在 Nacos 的 `ruoyi-auth.yml` 里把 `captcha.enabled` 设为 `false` 关掉验证码。

### 2. 登录

```bash
POST /auth/login
Content-Type: application/json

{
  "tenantId": "000000",
  "username": "admin",
  "password": "admin123",
  "rememberMe": false,
  "uuid": "<上一步的 uuid>",
  "code": "12",
  "clientId": "e5cd7e4891bf95d1d19206ce24a7b32e",
  "grantType": "password"
}
```

响应里拿到 `access_token`（在 `Authorization` 字段）。

### 3. 携带 Token

```bash
GET /exam/list
Authorization: Bearer <access_token>
```

::: tip clientId 需与后端一致
`clientId` / `grantType` 必须与 `sys_client` 表里的一条记录匹配。
前端 `.env` 里的 `VITE_APP_CLIENT_ID` 是同一个值。
:::

### 免登录白名单

网关默认放行这些路径：

```text
/auth/code   /auth/logout   /auth/login
/auth/binding/*   /auth/register   /auth/tenant/list
/resource/sms/code   /resource/sse/close
/*/v3/api-docs   /*/error   /csrf   /warm-flow-ui/**
```

配置在 `ruoyi-gateway.yml` 的 `security.ignore.whites`。
详见 [网关路由与放行](/backend/framework/basic/router_release)。

## 接口加密

`application-common.yml` 默认开启 `api-decrypt.enabled: true`，用 RSA 对请求/响应体加解密。

| 场景 | 处理 |
| --- | --- |
| 浏览器 | 前端自动处理（`.env` 里的公私钥） |
| 第三方集成 | **建议关闭或单独协商密钥** |

::: danger 开源仓库里的密钥是公开的
仓库内置的 RSA 密钥对等于没加密。生产必须重新生成。
详见 [请求响应加解密](/questions/api_encrypt)。
:::

调试时可以临时关掉（后端 `api-decrypt.enabled: false`，前端 `VITE_APP_ENCRYPT=false`），详见 [登录调试步骤](/questions/login_step)。

## 统一响应结构

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": { }
}
```

| code | 含义 |
| --- | --- |
| 200 | 成功 |
| 401 | 未认证 / Token 失效 |
| 403 | 无权限 |
| 500 | 服务端异常 |

失败时 `data` 通常为 `null`，`msg` 带具体原因。

## 分页约定

列表接口统一用 query 参数：

| 参数 | 说明 |
| --- | --- |
| `pageNum` | 页码，从 1 开始 |
| `pageSize` | 每页条数 |
| `orderByColumn` | 排序列 |
| `isAsc` | `asc` / `desc` |

```bash
GET /exam/list?pageNum=1&pageSize=20
```

详见 [分页功能](/backend/framework/basic/page)。

## 雪花 ID

::: danger 所有 ID 都是 19 位雪花 ID
超过 JavaScript `Number.MAX_SAFE_INTEGER`（9007199254740991）。
**JSON 解析时必须用字符串 / int64**，否则精度丢失，查不到数据。

```json
{ "examId": 1834523456789012345 }
```

- Java：用 `Long`
- TypeScript：用 `string`
- Python：`int`（安全）
:::

## 幂等性

砚考对写操作有 [防重幂等](/backend/framework/extend/idempotent) 支持。
特别是 **交卷接口是幂等的**——重复提交不会生成多份成绩。

## 接口清单

| 分组 | 说明 |
| --- | --- |
| [考生端接口](/api/exam) | 考试中心、答题、交卷、成绩、错题本、证书 |
| [管理端接口](/api/admin) | 题库、试卷、考试、阅卷、统计、证书管理 |

## 常见问题

- 401 但已带 Token → [放行接口认证失败](/questions/identify_fail)
- 返回密文 → [请求响应加解密](/questions/api_encrypt)
- 文档打不开 → [Swagger 相关问题](/questions/swagger)

## 相关

- 服务的领域边界：[考试微服务总览](/backend/exam/overview)
- 服务间 RPC：[服务间调用](/backend/exam/invocation)
