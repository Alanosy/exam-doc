---
title: 系统设置
description: 字典维护、系统参数、文件与OSS、租户套餐、AI 模型配置等管理端设置
---

# 系统设置

管理员需要配置的全局项。大部分在 **系统管理** 菜单下。

## 字典管理

砚考大量用字典渲染下拉项、状态标签。改字典**不用改代码、不用发版**——这是推荐做法。

### 考试业务相关字典

| 字典类型 | 取值 |
| --- | --- |
| `exam_type` | 正式 / 练习 |
| `exam_status` | `not_start` / `ongoing` / `finished` / `archived` |
| `exam_participant_type` | 白名单 / 公开链接 |
| `exam_show_answer_mode` | `none` / `after_submit` / `after_exam` / `immediate` |
| `exam_record_status` | `answering` / `submitted` / `expired` |
| `exam_my_status` | `pending` / `answering` / `submitted` / `ended` / `late` / `blocked` |
| `question_type` | 9 种题型 |
| `question_difficulty` | `easy` / `medium` / `hard` |
| `question_status` | 草稿 / 启用 / 废弃 |
| `code_languages` | 10 种编程语言 |
| `bank_visibility_type` | 私有 / 公开 |
| `bank_status` | 草稿 / 正常 / 归档 |
| `mark_task_status` | 阅卷任务状态 |
| `mark_log_action` | `create` / `score` / `rescore` / `ai` / `finish` |
| `wrong_source_type` | 错题来源类型 |
| `wrong_master_status` | `NOT_MASTER` / `MASTERED` / `IGNORED` |
| `model_type` / `model_name` | AI 模型类型与名称 |

这些字典由 `script/sql/update/update_exam_dict.sql` 初始化。

::: tip 字典优先 + 代码兜底
前端 `useExamDicts` 的策略是：先从字典读，**读不到就用代码里写死的默认值**。
所以即便字典没导入，界面也不会崩，只是改不了文案。

如果要改「进行中」显示为「考试中」，改字典即可，不用重新打包前端。
:::

详见 [使用字典](/frontend/dict_use)。

## 参数管理

键值对形式的全局配置。砚考默认没有自定义参数，但你可以按需添加。

常用内置参数：

| 参数键 | 说明 |
| --- | --- |
| `sys.user.initPassword` | 新建用户的初始密码 |
| `sys.oss.previewListResource` | OSS 预览是否走服务端代理 |

前端通过 `proxy?.getConfigKey('xxx')` 读取。详见 [使用参数](/frontend/param_use)。

## 通知公告

系统管理 → 通知公告。支持富文本，会在首页与顶部栏推送。

::: tip SSE 推送的坑
如果 Nginx 反向代理没有关闭 `proxy_buffering`，SSE 消息会攒着不发，
表现为「通知延迟几十秒甚至几分钟才弹出」。

Nginx 配置见 [打包与部署 — Nginx 配置](/backend/quickstart/deploy#五nginx-配置)。
:::

## 文件管理与 OSS

### 文件管理

查看已上传的文件（试题附件、证书背景、印章、监考抓拍）。

### 文件配置（OSS）

砚考用 **AWS S3 协议**客户端，所以 MinIO、七牛、阿里云 OSS、腾讯云 COS 都能配。

| 配置项 | 说明 |
| --- | --- |
| `endpoint` | 例如 `http://<ip>:9000` |
| `accessKey` | MinIO 默认 `ruoyi` |
| `secretKey` | MinIO 默认 `ruoyi123` |
| `bucketName` | 例如 `exam` |
| `prefix` | 路径前缀，可选 |
| `https` | 是否走 HTTPS |
| `region` | 云厂商才需要 |

::: danger MinIO 默认凭据必须改
`ruoyi` / `ruoyi123` 是默认值，改！配置方式见 [OSS 功能](/backend/framework/basic/oss)。
:::

::: warning 抓拍照片增长很快
监考抓拍默认 60 秒一张。一场百人考试一小时约 6000 张图。
务必规划磁盘和生命周期自动清理策略。
:::

## 租户管理

多租户场景下：

| 功能 | 说明 |
| --- | --- |
| 租户列表 | 创建/管理租户 |
| 租户套餐 | 限制该租户能用哪些菜单 |
| 默认租户 | `000000` |

不用多租户的话可以在 `application-common.yml` 里把 `tenant.enable` 设为 `false`。

详见 [多租户功能](/backend/framework/basic/tenant)。

## AI 模型配置

**系统管理 → AI 模型配置**（对应 `ai_model_config` 表）。

| 字段 | 说明 |
| --- | --- |
| 模型类型 `model_type` | 分类 |
| 模型名称 `model_name` | 例如 `qwen-plus` |
| `apiBase` | 大模型 API 地址 |
| `apiKey` | **密钥，注意保密** |
| `temperature` | 生成温度 |
| `maxTokens` | 单次最大 token |
| `timeout` | 超时（毫秒） |
| `retryCount` | 重试次数 |
| `priority` | 优先级 |
| `weight` | 权重（负载均衡用） |
| `status` | 启停 |

::: warning AI 尚未接线
配了模型配置也不会立刻生效——Java 侧与 Python Agent 的接线还在进行中。
当前 AI 阅卷返回「未接入」。

配置详情见 [考试微服务总览 — AI 服务](/backend/exam/overview#ai-服务-ruoyi-exam-ai-9220)。
:::

## 客户端管理

`sys_client` 表维护授权客户端，用于第三方登录的 `clientId` / `grantType`。

前端 `.env` 里的 `VITE_APP_CLIENT_ID` 必须和这里的一条记录对应。

## 代码生成

**系统工具 → 代码生成**。如果要在砚考上开发新业务模块，这是最快的起点：

1. 在数据库建表
2. 代码生成里导入表
3. 配置作者、包路径、生成信息
4. 生成 Java / Vue / SQL
5. 下载解压塞进 `ruoyi-exam-*` 模块

`ruoyi-gen` 服务（:9202）的配置 `gen.author`、`packageName` 在 Nacos 的 `ruoyi-gen.yml`。

详见 [代码生成](/backend/framework/basic/code_generate)。

::: tip 生成后记得改包名前缀
默认生成到 `org.dromara.system`。如果放到考试域，需要手工改包路径为 `org.dromara.exam.xxx`。
:::

## 菜单管理

所有路由在这里维护。改了以后**要重新登录**才生效（菜单是登录时下发的）。

详见 [用户与角色权限](/guide/users-roles#三种权限层级的含义)。

## 定时任务

用 SnailJob 服务端（:8800）管理。砚考内置两个核心任务：

| 任务 | 作用 |
| --- | --- |
| `ExamTimeoutTask` | 倒计时归零自动交卷的兜底 |
| `StatCalcScheduler` | 统计汇总表每 10 分钟重算 |

详见 [SnailJob 调度中心](/backend/quickstart/snail_job_init)。

## 下一步

- [用户与角色权限](/guide/users-roles)
- 部署运维：[打包与部署](/backend/quickstart/deploy)
