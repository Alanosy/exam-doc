---
title: 前端文档
description: 砚考前端（exam-front）的项目结构、开发规范与考试业务特有实现
---

# 前端文档

砚考前端 `exam-front` 由 [plus-ui](https://gitee.com/JavaLionLi/plus-ui) `5.6.2` 改造而来，技术栈为 Vue 3 + TypeScript + Element Plus + Vite。

## 项目标识

| 项 | 值 |
| --- | --- |
| 包名 | `ruoyi-vue-plus`（保留原名） |
| 版本 | `5.6.2-2.6.2` |
| Vue | 3.5.30 |
| Element Plus | 2.13.5 |
| Vite | 7.3.2 |
| TypeScript | ~5.9.3 |
| UnoCSS | 66.6.6（**非 Tailwind**） |
| Node | ≥ 20.19 |
| 默认端口 | 80（dev）、代理目标 `http://localhost:8080` |

## 目录结构

```text
exam-front/src/
├── api/           接口定义，按业务域分 system/ exam/ monitor/ tool/ workflow/
├── assets/        静态资源与全局样式
├── components/    全局组件（含 CertificatePaper、Editor、UserSelect）
├── directive/     自定义指令（v-hasPermi、v-hasRoles、v-copyText）
├── hooks/         组合式函数（含 useProctor、useServerClock、useExamDicts）
├── layout/        布局组件
├── plugins/       全局挂载（$auth、$download、$modal…）
├── router/        路由（constantRoutes 全静态 + 后端下发动态菜单）
├── store/         Pinia 模块（app/dict/notice/permission/settings/tagsView/user）
├── types/         类型声明
├── utils/         工具（request/auth/crypto/questionMeta/answer/joinLink…）
├── views/         页面
│   ├── system/    后台管理端
│   └── exam/      考生端（C 端）
├── permission.ts  全局路由守卫
└── main.ts
```

## 考试业务特有资产

这些是相对 plus-ui 原版**新增**的部分：

### 页面

| 类别 | 路径 |
| --- | --- |
| 后台管理 | `views/system/{bank,bankCategory,question,paper,exam,mark,proctor,cert,stat,modelConfig,invite}/` |
| 考生端 | `views/exam/**` 共 10 个页面 |

考生端 `/exam/join/:code`（加入考试）是**不带 Layout 的独立整页**，方便扫码直接进入。

### Hooks

| hook | 行数 | 职责 |
| --- | --- | --- |
| [`useProctor`](/frontend/proctor) | 794 | 防作弊采集：13 类行为监听、摄像头抓拍、计数同步 |
| `useServerClock` | 83 | 服务端时钟校准，防止改本机时间作弊 |
| `useExamDicts` | 232 | 考试域 13 个字典的聚合 hook |

### Utils

| 工具 | 职责 |
| --- | --- |
| `questionMeta.ts` | 9 种题型的元数据（答案模式、是否有选项、默认选项数） |
| `answer.ts` | 答案 JSON → 可读文本，兼容参考答案/考生作答两套字段 |
| `joinLink.ts` | `buildJoinLink(joinCode)` 生成加入链接 |
| `request.ts` | axios 封装，含 RSA 接口加解密 |

### 组件

| 组件 | 用途 |
| --- | --- |
| `CertificatePaper.vue` | 证书纸，内置 `@media print` 样式 |
| `Editor/index.vue` | Quill 富文本封装（题干、解析、主观题作答） |
| `UserSelect/index.vue` | 考试白名单选人 |

## 开发必读

| 主题 | 何时看 |
| --- | --- |
| [开发规范](/frontend/dev_norm) | 接手项目的第一份文档 |
| [请求流程](/frontend/request_process) | 要改接口、排查加解密异常 |
| [路由使用](/frontend/router_use) | 新增页面 |
| [权限使用](/frontend/permissions_use) | 菜单/按钮权限不生效 |
| [使用字典](/frontend/dict_use) | 下拉项、状态标签渲染 |
| [通用方法](/frontend/common_func) | 找现成工具函数，避免重复造轮子 |
| [组件文档](/frontend/component_doc) | 用内置组件 |
| [异常处理](/frontend/exception_handling) | 全局错误与提示规范 |
| [防作弊与答题端](/frontend/proctor) | 改答题页、监考逻辑 |

## 一个容易踩的坑：雪花 ID

所有主键都是 **19 位雪花 ID**，超过 `Number.MAX_SAFE_INTEGER`（9007199254740991）。
后端返回 JSON 时如果被解析成数字，精度会丢失。

::: danger 一律字符串透传
拿到 ID 后直接 `String(res.data)`，不要参与数值运算：

```ts
// ✅ 正确
const examId = String(res.data)

// ❌ 错误：精度已丢
const examId = res.data
```
:::

## 另一个坑：路由缓存字段

plus-ui 用的是 **`noCache: true`** 关闭 keep-alive，没有 `cache` 字段。

考试业务里所有编辑页/组卷页/答题页都显式设置了 `noCache: true`——因为「点新增后残留上一条数据」这类 bug 极难排查。新页面建议照做。详见 [页签缓存](/frontend/page_cache)。

## 环境变量

```ini
VITE_APP_TITLE       = 砚考 | YANKAO
VITE_APP_BASE_API    = /dev-api        # 生产改成 /prod-api
VITE_APP_PORT        = 80
VITE_APP_ENCRYPT     = true            # 接口 RSA 加解密开关
VITE_APP_CLIENT_ID   = e5cd7e4891bf95d1d19206ce24a7b32e
VITE_APP_SSE         = true
VITE_APP_WEBSOCKET   = false
```

::: warning .env.production 尚未同步
`.env.production` 里的 `VITE_APP_TITLE` 还是 `RuoYi-Vue-Plus多租户管理系统`，
而 `.env.development` 已改为 `砚考 | YANKAO`。打生产包前记得改。
:::

## 相关链接

- 源码：[exam-platform / exam-front](https://github.com/Alanosy/exam-platform)
- 上游：[plus-ui](https://gitee.com/JavaLionLi/plus-ui)
