---
title: 管理端接口
description: 题库、试卷、考试管理、阅卷、统计与证书维护的管理侧接口
---

# 管理端接口

教师 / 管理员视角使用的接口。调用前请先读 [API 概览 — 鉴权](/api/#鉴权)。

::: tip 大多数情况不用直接调 HTTP
管理端接口主要给前端管理页面用。
如果你只是要做运营后台二次开发，用这些；
如果是要和组织/教务系统对接，**拉成绩**这类需求用 `/stat` 下的只读接口即可。
:::

## 一、题库与分类

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| — | `/question/bank/...` | 题库 CRUD |
| `GET` | `/question/bankCategory/list` | 题库分类列表 |
| `GET` | `/question/bankCategory/tree` | 题库分类树 |

## 二、试题

前缀 `/question`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/question/list` | 题目列表（分页） |
| `POST` | `/question/create` | 新增题目（**含选项一次提交**） |
| `PUT` | `/question` | 修改题目 |
| `DELETE` | `/question/{ids}` | 删除 |
| `POST` | `/question/changeBank` | **批量换题库** |
| `POST` | `/question/random` | **按规则随机抽题**（组卷用） |
| `GET` | `/question/listByIds` | 按 ID 批量查（组卷回显，**保持传入顺序**） |
| — | `/question/option/...` | 选项 CRUD |
| — | `/question/tag/...` | 标签 CRUD |

### 随机抽题

```http
POST /question/random
Content-Type: application/json

{
  "bankId": "1834523456789012345",
  "questionType": "SINGLE",
  "difficulty": "medium",
  "count": 5
}
```

候选不足时返回提示，不会静默少返回。详见 [试卷与组卷](/guide/paper)。

### Excel 导入导出

| 操作 | 说明 |
| --- | --- |
| 导入 | 上传 Excel，整批校验，失败整批回滚并逐行报错 |
| 导出 | 按当前筛选条件导出 |

## 三、试卷

前缀 `/paper`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/paper/list` | 试卷列表 |
| `GET` | `/paper/{id}` | 试卷详情（含题目明细） |
| `POST` | `/paper` | 新增试卷（基本信息） |
| `POST` | `/paper/save` | **组卷保存**（试题明细全量覆盖 `paper_question`） |
| `PUT` | `/paper` | 修改试卷 |
| `DELETE` | `/paper/{id}` | 删除 |
| — | `/paper/question/...` | 试卷-题目关联查询 |

::: warning `/paper/save` 是全量覆盖
每次保存按提交明细**整体替换** `paper_question`。删掉的题不会保留。
:::

## 四、考试管理

前缀 `/exam`、`/invite`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/exam/list` | 考试列表 |
| `GET` | `/exam/{id}` | 考试详情 |
| `POST` | `/exam` | 新增考试 |
| `PUT` | `/exam` | 修改考试 |
| `DELETE` | `/exam/{id}` | 删除 |
| `POST` | `/exam/{id}/joinCode/refresh` | **刷新加入码** |
| `GET` | `/exam/join/{code}` | 查询加入码对应的考试 |
| `POST` | `/exam/join/{code}` | 加入考试 |
| `GET` | `/exam/{id}/whiteUsers` | 查询白名单考生 |
| `PUT` | `/exam/{id}/whiteUsers` | 设置白名单考生 |
| `GET` | `/exam/{id}/situation/overview` | 考试情况看板 |
| `GET` | `/exam/{id}/situation/records` | 考试情况明细 |
| — | `/invite/...` | 邀请记录 |

### 权限标识

```text
system:exam:query     system:exam:add
system:exam:edit      system:exam:remove
system:exam:export
```

详见 [用户与角色权限](/guide/users-roles)。

## 五、阅卷

前缀 `/mark`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/mark/exam/list` | 待阅卷考试列表（含进度） |
| `GET` | `/mark/task/list` | 答卷列表 |
| `GET` | `/mark/task/{taskId}/questions` | 某份答卷的主观题明细 |
| `GET` | `/mark/task/{taskId}/logs` | **阅卷日志（改分审计）** |
| `POST` | `/mark/score` | 提交打分 |
| `POST` | `/mark/task/{taskId}/finish` | 完成阅卷（未打分题按 0 分） |
| `POST` | `/mark/task/{taskId}/ai` | AI 批量预评（**当前未接入**） |

详见 [阅卷与成绩](/guide/grading)。

## 六、统计

前缀 `/stat`。**这是对接教务/BI 系统最有用的一组接口。**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/stat/home/overview` | 首页概览 |
| `GET` | `/stat/dashboard` | 统计大盘 |
| `GET` | `/stat/exam/page` | 考试分页列表（含统计指标） |
| `GET` | `/stat/exam/{id}/overview` | 单场考试概览 |
| `GET` | `/stat/exam/{id}/segment` | **分数段分布** |
| `GET` | `/stat/exam/{id}/users` | 考生明细与排名 |
| `GET` | `/stat/exam/{id}/user/{userId}/detail` | 单个考生答卷明细 |
| `GET` | `/stat/exam/{id}/questions` | **逐题分析**（正确率/难度/区分度） |
| `GET` | `/stat/exam/{id}/knowledge` | **知识点掌握度** |
| `POST` | `/stat/exam/{id}/recalc` | **手动触发重算** |
| `PUT` | `/stat/exam/{id}/record/{recordId}/exclude` | 作废答卷（不入统） |

::: tip 数据不对先调 recalc
统计是预计算的（每 10 分钟定时重算）。改完分数想立刻看到结果，
调一次 `/stat/exam/{id}/recalc` 即可。
:::

权限标识：`exam:stat:*`。详见 [成绩与学情分析](/guide/analytics)。

## 七、证书

前缀 `/cert`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/cert/list` | 证书模板列表 |
| `GET` | `/cert/option/list` | 模板下拉选项 |
| `GET`/`PUT`/`POST` | `/cert` | 模板 CRUD |
| `DELETE` | `/cert/{ids}` | 删除模板 |
| `GET` | `/cert/record/list` | 颁发记录列表 |
| `GET` | `/cert/record/count` | 颁发数量统计 |
| `POST` | `/cert/record/issue` | **手工颁发**（补发） |
| `PUT` | `/cert/record/revoke/{id}` | **吊销**（需原因） |
| `GET` | `/cert/mine/list` | 我的证书（考生侧） |
| `GET` | `/cert/mine/record/{recordId}` | 我的证书（某场考试） |

权限标识：`exam:cert:{add,edit,remove,issue}`。详见 [证书管理](/guide/certificate)。

## 八、监考

前缀 `/proctor`，管理侧接口。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/proctor/exam/list` | 我的考试分组列表 |
| `GET` | `/proctor/session/list` | 监考会话列表 |
| `GET` | `/proctor/overview` | 风险概览 |
| `GET` | `/proctor/session/{id}` | 会话详情 |
| `GET` | `/proctor/event/list` | **事件流水** |
| `GET` | `/proctor/snapshot/list` | **抓拍列表** |

权限标识：`exam:proctor:list`。详见 [在线监考与防作弊](/guide/proctoring)。

## 九、考试情况导出

```http
GET /exam/{examId}/situation/export
```

::: warning 统计大盘的导出还没做
`/stat/dashboard` 的导出目前提示「导出功能将在导出中心提供」。
单场考试各维度的导出是可用的。
:::

## 错误处理

| HTTP 状态 | 常见原因 |
| --- | --- |
| 401 | Token 缺失/过期，见 [放行接口认证失败](/questions/identify_fail) |
| 403 | 该账号没有对应权限标识 |
| 400 | 参数校验失败，`msg` 里有具体字段 |
| 500 | 服务端异常，查对应服务日志 |

## 相关

- [考生端接口](/api/exam)
- 服务实现：[考试微服务总览](/backend/exam/overview)
- 导出能力：[导出功能](/backend/framework/basic/export)
