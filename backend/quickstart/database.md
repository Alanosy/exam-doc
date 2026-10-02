---
title: 数据库初始化
description: 砚考的五个数据库、全部 SQL 脚本的执行顺序与考试业务表清单
---

# 数据库初始化

砚考按业务边界拆了 **5 个库**。**不要把它们的表塞进同一个库**——动态数据源靠库名区分，混在一起会导致跨服务关联失效。

## 库清单

| 数据库名 | 用途 | 使用者 |
| --- | --- | --- |
| `ry-cloud` | 系统基础库（用户/角色/菜单/字典/租户/AI 模型配置） | system、gen、resource |
| `ry-config` | Nacos 配置库 | Nacos 服务端 |
| `ry-exam` | **考试主库** | question、paper、manage、mark、stat、practice、cert、proctor、ai |
| `ry-exam-answer` | **答卷/成绩库** | answer（独立库，便于后续分库分表） |
| `ry-job` | SnailJob 定时任务库 | job、snailjob-server |
| `ry-workflow` | 工作流库 | workflow |
| `ry-seata` | Seata 事务库 | seata-server（可选） |

## 脚本位置

所有脚本在 `exam-back/script/sql/` 下。

| 脚本 | 大小 | 说明 |
| --- | --- | --- |
| `ry-cloud.sql` | 771 KB | 系统基础库建表 + 菜单/字典/用户/租户种子数据 |
| `ry-config.sql` | 250 KB | Nacos 配置库 dump（**有坑，见下方警告**） |
| **`ry-exam.sql`** | 62 KB | **考试主库 29 张表 + 种子数据** |
| **`ry-exam-answer.sql`** | 4.8 KB | **答卷库 2 张表** |
| `ry-job.sql` | 37 KB | SnailJob 服务端库 |
| `ry-workflow.sql` | 18 KB | warm-flow 工作流库 |
| `ry-seata.sql` | 3 KB | Seata 服务端库 |
| `sql/oracle/`、`sql/postgres/` | — | 异构数据库版本的 `ry-cloud` 脚本 |
| `sql/update/` | — | 增量脚本目录 |

## 执行顺序

```bash
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS \`ry-cloud\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS \`ry-config\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS \`ry-exam\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS \`ry-exam-answer\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;"

# 1) Nacos 配置库
mysql -uroot -p ry-config < script/sql/ry-config.sql

# 2) 系统基础库
mysql -uroot -p ry-cloud  < script/sql/ry-cloud.sql

# 3) 考试主库  ← 核心
mysql -uroot -p ry-exam   < script/sql/ry-exam.sql

# 4) 答卷库
mysql -uroot -p ry-exam-answer < script/sql/ry-exam-answer.sql

# 5) 可选
mysql -uroot -p ry-job      < script/sql/ry-job.sql
mysql -uroot -p ry-workflow < script/sql/ry-workflow.sql
mysql -uroot -p ry-seata    < script/sql/ry-seata.sql
```

::: danger ry-config.sql 含有多份历史脏数据
`ry-config.sql` 是 Nacos 配置表的 dump，`datasource.yml` 在里面有**多份历史版本**：

- 出现过 `8.137.151.232:3306`、`host.docker.internal:3306`、`localhost:3306` 三种 MySQL 地址
- 密码混杂着 `password` 与 `ruoyi123`
- 甚至有一条把键名错写成 `ruoyi123: ruoyi123`

直接导入，最终生效的是**最后一条记录**，很容易连不上库。

**推荐做法**：跳过这个 dump，改从 [Nacos 配置导入](/backend/quickstart/nacos-config) 手工录入，干净且可控。
:::

## 考试主库表清单（29 张）

| 业务域 | 表名 | 说明 |
| --- | --- | --- |
| 考试管理 | `exam` | 考试主表 |
| | `exam_invite` | 考试邀请（公开链接）记录 |
| | `exam_user` | 白名单考生 |
| 题库 | `question` | 题目主表 |
| | `question_option` | 题目选项 |
| | `question_bank` | 题库 |
| | `question_bank_category` | 题库分类树 |
| 试卷 | `paper` | 试卷 |
| | `paper_question` | 试卷-题目关联 |
| 阅卷 | `exam_mark_task` | 阅卷任务 |
| | `exam_mark_item` | 阅卷明细（逐题） |
| | `exam_mark_log` | 改分审计日志 |
| 证书 | `exam_certificate` | 证书模板 |
| | `exam_certificate_record` | 证书颁发记录 |
| 防作弊 | `exam_proctor_session` | 监考会话 |
| | `exam_proctor_event` | 防作弊事件流水 |
| | `exam_proctor_snapshot` | 摄像头抓拍 |
| 错题本 | `wrong_question` | 错题 |
| | `wrong_review_record` | 错题重做记录 |
| 统计 | `stat_exam_summary` | 考试汇总（预计算） |
| | `stat_exam_score_segment` | 分数段分布 |
| | `stat_exam_user` | 考生明细 |
| | `stat_exam_question` | 题目正确率/难度/区分度 |
| | `stat_exam_question_option` | 选项分布与易错项 |
| | `stat_exam_knowledge` | 知识点掌握度 |
| | `stat_calc_task` | 重算任务 |
| | `stat_export_task` | 导出任务 |

## 答卷库表清单（2 张）

| 表名 | 说明 |
| --- | --- |
| `exam_record` | 答卷记录（含成绩、用时、状态） |
| `exam_answer` | 逐题作答明细 |

::: tip 为什么答卷要独立成库
答题是唯一的高并发写场景——一场考试几千人同时交卷。
把 `exam_answer` 单独放一个库，后续可以直接对它在 ShardingSphere 里按 `exam_id` 分片，而不影响其它业务库。
:::

## 增量脚本

`script/sql/update/` 下有两种脚本：

**① 框架版本升级**（按版本顺序执行）

```text
update_2.0-2.1.sql
update_2.1.0-2.1.1.sql
...
update_2.5.3_2.6.0.sql
```

**② 考试域增量**（幂等，可重复执行）

| 脚本 | 作用 |
| --- | --- |
| `update_exam_dict.sql` | 把前端写死的状态/类型收敛为 RuoYi 字典（`exam_*`、`question_*`、`bank_*`、`code_languages` 等） |
| `update_exam_exam_type.sql` | `exam` 增加 `exam_type`（1 正式 / 2 练习），放开起止时间非空约束 |
| `update_exam_stat.sql` | 增加 `partial_score`、`partial_score_rate`；建统计表 |
| `update_exam_cert.sql` | 增加 `cert_id`（绑定的证书模板，为空不发） |
| `update_exam_white_user.sql` | 白名单考生 |
| `update_exam_wrong_question_tenant.sql` | 错题表补租户字段 |
| `update_exam_mark_menu.sql` | 阅卷菜单（menu_id 2101-2102，权限 `exam:mark:*`） |
| `update_exam_proctor_menu.sql` | 监考中心菜单（2103-2104，权限 `exam:proctor:*`） |
| `update_exam_stat_menu.sql` | 统计菜单（权限 `exam:stat:*`） |
| `update_exam_cert_menu.sql` | 证书管理菜单（2106-2107，权限 `exam:cert:*`） |

```bash
mysql -uroot -p ry-exam < script/sql/update/update_exam_dict.sql
mysql -uroot -p ry-exam < script/sql/update/update_exam_stat.sql
# ...依次执行
```

::: tip 菜单脚本可跳过
菜单类脚本（`*_menu.sql`）用 `INSERT ... SELECT ... WHERE NOT EXISTS` 幂等写法，也可以在后台 **系统管理 → 菜单管理** 里手工添加，更直观。
:::

## 数据源配置

Nacos 的 `datasource.yml` 里定义了别名，各服务的 yml 通过 `${datasource.xxx.url}` 引用：

| 别名 | 指向库 |
| --- | --- |
| `system-master` | `ry-cloud` |
| `gen` | `ry-cloud` |
| `job` | `ry-job` |
| `workflow` | `ry-workflow` |
| **`exam`** | **`ry-exam`** |
| **`exam-answer`** | **`ry-exam-answer`** |

只需改 `datasource.yml` 一处，10 个考试服务全部生效。详见 [Nacos 配置导入](/backend/quickstart/nacos-config)。

## 下一步

数据库就绪后，导入 [Nacos 配置](/backend/quickstart/nacos-config)。
