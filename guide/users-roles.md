---
title: 用户与角色权限
description: 三类账号的建立、菜单权限分配与砚考的考试业务权限标识清单
---

# 用户与角色权限

砚考的权限体系继承自 RuoYi-Cloud-Plus：**用户 → 角色 → 菜单/按钮权限**，并叠加**数据权限**与**多租户**。

## 内置账号

| 角色 | 账号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 超级管理员 | `admin` | `admin123` | 全部权限，含租户管理 |

::: danger 第一件事就是改密码
`admin123` 是框架初始值。上线前必须改。
:::

::: tip 演示环境的账号
在线体验环境另有 `teacher` / `student` 账号，见 [演示系统](/demo/)。本地部署需要自己创建。
:::

## 建立三类账号

砚考需要三种典型角色，按需创建：

| 角色 | 要能看到什么 |
| --- | --- |
| **管理员** | 系统管理（用户/角色/菜单/字典/参数/租户）、file 配置、监控 |
| **教师** | 题库、试卷、考试管理、阅卷、统计、证书管理、监考中心 |
| **学生** | 考试中心、在线答题、考试记录、错题本、我的证书 |

### 创建步骤

```text
① 组织部门
   系统管理 → 部门管理
   建一棵组织树（学院 → 专业 → 班级，或公司 → 部门）
        │
② 岗位（可选）
   系统管理 → 岗位管理
        │
③ 角色
   系统管理 → 角色管理 → 新增
        │ 分配菜单权限
        │ 设置数据权限范围
        ▼
④ 用户
   系统管理 → 用户管理 → 新增
        绑定部门、岗位、角色
```

::: warning 顺序不能反
必须先有部门和角色，再建用户。用户要挂在部门上，数据权限也依赖部门树。
:::

## 考试业务的菜单与权限标识

给教师角色分配菜单时，需要勾选这些：

| 模块 | 路由 | 权限标识 |
| --- | --- | --- |
| 题库管理 | `/system/bank` | `system:bank:*` |
| 题库分类 | `/system/bankCategory` | `system:bankCategory:*` |
| 试题管理 | `/system/question` | `system:question:*` |
| 试卷管理 | `/system/paper` | `system:paper:*` |
| 考试管理 | `/system/exam` | `system:exam:{query,add,edit,remove,export}` |
| 考试邀请记录 | `/system/invite` | `system:invite:*` |
| **阅卷管理** | `/system/mark` | `exam:mark:*` |
| **监考中心** | `/system/proctor` | `exam:proctor:list` |
| **考试统计** | `/system/stat` | `exam:stat:*` |
| **证书管理** | `/system/cert` | `exam:cert:{add,edit,remove,issue}` |
| AI 模型配置 | `/system/modelConfig` | `system:modelConfig:*` |

给学生角色分配：

| 模块 | 路由 |
| --- | --- |
| 考试中心 | `/exam/center` |
| 考试须知 | `/exam/brief/:examId` |
| 在线答题 | `/exam/answer/:recordId` |
| 考试记录 | `/exam/records` |
| 我的证书 | `/exam/certs` |
| 错题本 | `/exam/wrong` |

::: tip 菜单可以用 SQL 一键导入
菜单对应的 SQL 脚本在 `script/sql/update/` 目录下：

- `update_exam_mark_menu.sql`（menu_id 2101-2102）
- `update_exam_proctor_menu.sql`（2103-2104）
- `update_exam_stat_menu.sql`
- `update_exam_cert_menu.sql`（2106-2107）

它们都是幂等写法（`INSERT ... SELECT ... WHERE NOT EXISTS`），重复执行没问题。
也可以在后台手工添加。详见 [数据库初始化 — 增量脚本](/backend/quickstart/database#增量脚本)。
:::

## 三种权限层级的含义

| 层级 | 控制什么 | 在哪配 |
| --- | --- | --- |
| **菜单权限** | 能不能看到这个菜单/页面 | 角色管理 → 菜单权限 |
| **按钮权限** | 能不能点「新增/编辑/删除」 | 权限标识 `xxx:add/edit/remove` |
| **数据权限** | 能看到哪些部门的数据 | 角色管理 → 数据范围 |

::: tip 数据权限常被忽略
两个老师都想看「考试统计」，但你只想让他们看自己教的班。
靠数据权限（「自定义」→ 勾选部门）实现，而不是给他们不同的菜单。
:::

数据范围选项：

| 范围 | 含义 |
| --- | --- |
| 全部数据 | 不限 |
| 自定义数据 | 指定若干部门 |
| 本部门数据 | 仅自己所在部门 |
| 本部门及以下 | 部门树的子树 |
| 仅本人数据 | 只看自己创建的 |

详见 [数据权限](/backend/framework/basic/permissions)。

## 前端是怎么生效的

### 动态菜单

路由不是写死在前端的。登录后前端调 `/system/menu/getRouters`，
由**后端根据用户角色**下发菜单树，前端 `router.addRoute` 动态注册。

```text
登录 → getInfo() → generateRoutes() → addRoute → 渲染菜单
```

::: warning exam-front 的本地 dynamicRoutes 是空的
源码里 `export const dynamicRoutes: RouteRecordRaw[] = []`。
这意味着**权限路由完全由后端菜单下发**，改了前端路由配置没用，要去后台「菜单管理」里改。
:::

### 按钮权限

三种写法：

```html
<!-- ① 指令（最常用，无权限直接移除 DOM） -->
<el-button v-hasPermi="['system:exam:add']">新增</el-button>

<!-- ② v-if 场景（延迟渲染组件用这个） -->
<el-dropdown-item v-if="checkPermi(['system:user:edit'])">编辑</el-dropdown-item>

<!-- ③ 脚本里 -->
if (auth.hasPermi('system:exam:remove')) { ... }
```

::: tip 为什么要有第二种写法
`el-dropdown-item` 这类延迟渲染的下拉项，指令执行时 DOM 还没生成，权限失效。
必须用 `v-if="checkPermi([...])"`。这个坑很容易踩。
:::

详见 [权限使用](/frontend/permissions_use)。

## 多租户

`application-common.yml` 里 `tenant.enable: true`，默认开启。

| 概念 | 说明 |
| --- | --- |
| 租户 | 独立的业务空间，数据彼此隔离 |
| 租户套餐 | 限制该租户可用的菜单功能 |
| 默认租户 | `000000`（超管租户） |

排除在多租户之外的表（`tenant.excludes`）：

```text
sys_menu, sys_tenant, sys_tenant_package, sys_role_dept,
sys_role_menu, sys_user_post, sys_user_role, sys_client,
sys_oss_config, flow_spel
```

**考试业务表不在排除列表里**，意味着它们会自动按租户隔离——多机构部署时天然安全。

登录时需要额外传 `tenantId`。详见 [多租户功能](/backend/framework/basic/tenant)。

## 常见权限问题

| 现象 | 排查 |
| --- | --- |
| 菜单看不到 | 角色有没有勾这个菜单；菜单的「显示状态」是否为显示 |
| 页面白屏 | 组件的 `component` 路径与实际文件是否一致 |
| 按钮不显示 | 权限标识拼写；注意 `v-hasPermi` vs `v-if="checkPermi"` 的选择 |
| 数据看不全 | 角色的数据范围设置 |
| 学生看到了管理菜单 | 学生角色的菜单权限勾错了 |

::: warning 改了权限要重新登录
菜单是登录时一次性下发的。改完权限后**让用户退出重登**才生效。
:::

## 下一步

- [系统设置](/guide/settings)
- 后端数据权限机制：[数据权限](/backend/framework/basic/permissions)
- 前端权限实现：[权限使用](/frontend/permissions_use)
