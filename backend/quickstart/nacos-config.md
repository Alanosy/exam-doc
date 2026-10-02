---
title: Nacos 配置导入
description: 把砚考的 22 个 Nacos 配置文件导入到正确的命名空间，并逐项改成自己的环境参数
---

# Nacos 配置导入

砚考的所有服务共享 Nacos 中的一套配置文件，服务启动时会按名字拉取三份：

```yaml
spring:
  config:
    import:
      - optional:nacos:application-common.yml   # 全局共享
      - optional:nacos:datasource.yml           # 数据源别名
      - optional:nacos:${spring.application.name}.yml  # 各服务私有
```

## 第一步：创建命名空间（最容易踩的坑）

各服务 `application.yml` 里写的是：

```yaml
namespace: ${spring.profiles.active}   # 默认值 dev
```

::: danger namespace 填的是 ID 不是名称
这里的值必须是 Nacos 命名空间的 **命名空间ID**，而不是「命名空间名」。
新建命名空间时如果不手动指定 ID，Nacos 会自动生成一串 UUID，导致服务永远读不到配置。

正确做法：新建命名空间 → **命名空间ID** 手动填 `dev`（名称可以也填 `dev`）。同理生产环境建 `prod`。
:::

## 第二步：导入配置文件

把 `exam-back/script/config/nacos/` 下的文件全部建到 Nacos 对应 namespace 下，**Data ID 必须与文件名完全一致**，Group 默认 `DEFAULT_GROUP`，格式选 `YAML`（`seata-server.properties` 选 `Properties`）。

::: tip 手工录入优于导入 zip
官方 README 只写了「把配置内容复制进去」。建议直接用 Nacos 控制台**新建配置、粘贴内容**，
避免 zip 批量导入时的编码与 Data ID 错乱问题。
:::

### 完整清单（22 个）

| 配置文件 | 必需 | 说明 |
| --- | --- | :---: |
| `application-common.yml` | ✅ | 全局共享：Redis、Dubbo、Sa-Token、MyBatis-Plus、多租户、接口加密 |
| `datasource.yml` | ✅ | 数据源别名定义 |
| `ruoyi-gateway.yml` | ✅ | 网关白名单 + **exam 全部路由** |
| `ruoyi-auth.yml` | ✅ | 验证码、密码重试次数、社交登录 |
| `ruoyi-system.yml` | ✅ | 系统服务数据源 |
| **`ruoyi-exam-question.yml`** | ✅ | 题库服务（数据源：`exam`） |
| **`ruoyi-exam-paper.yml`** | ✅ | 试卷服务 |
| **`ruoyi-exam-manage.yml`** | ✅ | 考试管理服务 |
| **`ruoyi-exam-answer.yml`** | ✅ | 答题服务（数据源：**`exam-answer`**） |
| `ruoyi-exam-mark.yml` | 推荐 | 阅卷服务 |
| `ruoyi-exam-stat.yml` | 推荐 | 统计服务 |
| `ruoyi-exam-practice.yml` | 推荐 | 错题本服务 |
| `ruoyi-exam-cert.yml` | 推荐 | 证书服务 |
| `ruoyi-exam-proctor.yml` | 推荐 | 防作弊服务 |
| `ruoyi-exam-ai.yml` | 可选 | AI 网关 + Agent 发现配置 |
| `ruoyi-resource.yml` | 推荐 | OSS / SSE / 邮件 / 短信 |
| `ruoyi-gen.yml` | 可选 | 代码生成作者、包路径 |
| `ruoyi-job.yml` | 可选 | SnailJob group / token |
| `ruoyi-workflow.yml` | 可选 | 工作流数据源 |
| `ruoyi-monitor.yml` | 可选 | 监控账号 |
| `ruoyi-gateway-mvc.yml` | 不用 | MVC 网关，**当前缺 exam 路由** |
| `seata-server.properties` | 可选 | Seata 服务端 |

## 第三步：必改的配置项

### `datasource.yml`

把 `url`、`username`、`password` 改成实际环境。默认是 `root` / `password`。

```yaml
datasource:
  exam:
    url: jdbc:mysql://<你的MySQL>:3306/ry-exam?...&serverTimezone=GMT%2B8
    username: root
    password: <改成你的密码>
  exam-answer:
    url: jdbc:mysql://<你的MySQL>:3306/ry-exam-answer?...
```

::: tip 生产务必关闭 p6spy
`datasource.yml` 里 `p6spy: true` 会输出完整 SQL 与耗时，有性能损耗，生产改成 `false`。
:::

### `application-common.yml`

| 配置项 | 默认值 | 生产建议 |
| --- | --- | --- |
| `spring.data.redis.host` | `localhost:6379` | 改内网地址 |
| `spring.data.redis.password` | `ruoyi123` | **必须改** |
| `sa-token.jwt-secret-key` | `abcdefghijklmnopqrstuvwxyz` | **必须改**（32 位以上随机串） |
| `api-decrypt.enabled` | `true` | 保留；公私钥需另行生成替换 |
| `xss.enabled` | `true` | 保留 |
| `tenant.enable` | `true` | 不需要多租户可关 |
| `dubbo.protocol.port` | `-1`（自增） | 保持自增，避免单机多实例冲突 |

::: danger 接口加密密钥是公开的
`api-decrypt` 的 RSA 公私钥在开源仓库里是**明文且公开**的，等于没加密。
生产必须重新生成并成对替换到后端 `application-common.yml` 与前端 `.env.*` 的
`VITE_APP_PUBLIC_KEY` / `VITE_APP_PRIVATE_KEY`。
生成方式见 [请求响应加解密](/backend/framework/extend/api_encrypt)。
:::

### `ruoyi-gateway.yml`

`security.ignore.whites` 是**不需要登录就能访问**的路径，默认开放：

```yaml
/auth/code  /auth/logout  /auth/login  /auth/register
/auth/tenant/list  /resource/sms/code  /*/v3/api-docs
```

::: warning 考生端接口目前需要登录
加入考试页 `/exam/join/{code}` 查询考试信息走的是 `/exam/join/{code}` 接口，**不在白名单中**，
意味着未登录用户无法预览考试信息。如果要做「扫码免登录查看考试须知」，需要在这里放行并做好频控。
:::

### 网关路由表

已配置的考试路由：

| 路由 id | 目标 | Path 谓词 | StripPrefix |
| --- | --- | --- | --- |
| `ruoyi-exam-question` | question | `/question`、`/bank`、`/media`、`/option`、`/tag`、`/tagRel`、`/bankCategory` | 无 |
| `ruoyi-exam-paper` | paper | `/paper` | 无 |
| `ruoyi-exam-manage` | manage | `/exam`、`/invite` | 无 |
| `ruoyi-exam-answer` | answer | `/answer` | **1** |
| `ruoyi-exam-mark` | mark | `/mark` | 无 |
| `ruoyi-exam-stat` | stat | `/stat` | 无 |
| `ruoyi-exam-practice` | practice | `/practice` | **1** |
| `ruoyi-exam-proctor` | proctor | `/proctor` | **1** |
| `ruoyi-exam-cert` | cert | `/cert` | 无 |
| `ruoyi-exam-ai` | ai | `/ai` | 无 |

::: danger 两个已知待修问题
1. **`/stat` 路由 id 重复出现两次**（约第 131 行与第 161 行），应删除其中一条重复的 `ruoyi-exam-stat`。
2. **`ruoyi-exam-question` 残留了 `/bank`、`/media`、`/tag`、`/tagRel` 四个没有对应 Controller 的谓词**，属设计稿遗留，不影响运行但建议清理。
:::

## 第四步：修改 pom 中的环境地址

根 `pom.xml` 的 profiles：

```xml
<profiles.active>dev</profiles.active>
<nacos.server>127.0.0.1:8848</nacos.server>
<nacos.username>nacos</nacos.username>
<nacos.password>nacos</nacos.password>
<logstash.address>127.0.0.1:4560</logstash.address>
```

::: warning prod profile 地址还没改
根 pom 的 `prod` profile 里 Nacos 与 Logstash 地址**仍然写着 `127.0.0.1`**，
打生产包前必须改成实际地址，否则上线后服务会找不到注册中心。
:::

## 修改 Tenant token

`ruoyi-job.yml` 里 SnailJob 的 token 是硬编码的：

```yaml
snail-job:
  group: "ruoyi_group"
  token: "SJ_cKqBTPzCsWA3VyuCfFoccmuIEGXjr5KT"
```

同时需要在 SnailJob 后台**组管理**里创建同名 `ruoyi_group`，否则任务执行器注册会失败。
详见 [SnailJob 调度中心](/backend/quickstart/snail_job_init)。

## 下一步

配置就绪后，进入 [项目初始化](/backend/quickstart/init)。
