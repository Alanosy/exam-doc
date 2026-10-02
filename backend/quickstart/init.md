---
title: 项目初始化
description: 从零把砚考后端跑起来：初始化检查清单、启动顺序与首次登录验证
---

# 项目初始化

这一页串起前置步骤，给出**可勾选的检查清单**与**正确的启动顺序**。
每一步的详细操作在对应的分章里。

## 前置检查清单

按顺序确认打勾，再往下走：

| # | 检查项 | 完成标准 |
| :---: | --- | --- |
| 1 | JDK 17 已安装且非 OracleJDK | `java -version` 输出 `17.x`，且发行版为 OpenJDK / Liberica / Temurin |
| 2 | Maven ≥ 3.8 | `mvn -v` 正常输出 |
| 3 | MySQL 8 已启动 | 能连上，字符集 `utf8mb4` |
| 4 | Redis ≥ 6 已启动 | `redis-cli ping` 返回 `PONG` |
| 5 | Nacos 已启动且可访问 | `http://<ip>:8848/nacos` 能进控制台 |
| 6 | Nacos 命名空间 **ID** 为 `dev` | 控制台「命名空间」里确认（**不是名称，是 ID**） |
| 7 | 4 个业务库已建 | `ry-cloud`、`ry-exam`、`ry-exam-answer`、`ry-config` |
| 8 | SQL 已导入 | `ry-exam` 里有 29 张表，`ry-exam-answer` 里有 2 张 |
| 9 | 22 个 Nacos 配置已导入 | Data ID 与文件名完全一致 |
| 10 | `datasource.yml` 账号密码已改 | 各服务的连接串指向自己的库 |
| 11 | Redis 密码已同步 | `application-common.yml` 与实际一致 |
| 12 | 前端 `.env.development` 的签发地址正确 | `VITE_APP_BASE_API` = `/dev-api`，代理指向 `8080` |

::: tip 最常见的启动失败原因
按经验，90% 的「起不来」是这三件事：

1. **Nacos namespace 写的是名称不是 ID** → 服务读不到配置，报数据源找不到
2. **`ry-config.sql` 直接导入导致脏配置** → datasource 连到错的地址/密码
3. **prod profile 里 Nacos 地址还是 127.0.0.1** → 打完包部署到服务器上找不到注册中心

排查时先看 [无法读取 Nacos 配置](/questions/nacos_read_fail)。
:::

## 本地启动顺序

**第一步：基础设施**

```bash
cd exam-back/script/docker
docker-compose up -d mysql nacos redis minio
```

**第二步：等待 Nacos 就绪**

```bash
# 直到返回 ok
curl http://localhost:8848/nacos/actuator/health
```

**第三步：导入 Nacos 配置**（见 [Nacos 配置导入](/backend/quickstart/nacos-config)）

**第四步：启动应用服务**（严格按此顺序，每个间隔 10~20 秒）

```text
1. ruoyi-gateway        :8080   ← 必须先起来，其它服务注册后被它发现
2. ruoyi-auth           :9210   ← 登录认证
3. ruoyi-system         :9201   ← 用户/角色/菜单
4. ruoyi-exam-question  :9211
5. ruoyi-exam-paper     :9212
6. ruoyi-exam-manage    :9213
7. ruoyi-exam-answer    :9214
8. ruoyi-exam-mark      :9215
9. ruoyi-exam-stat      :9216   （可选）
10. ruoyi-exam-practice :9217   （可选）
11. ruoyi-exam-cert     :9218   （可选）
12. ruoyi-exam-proctor  :9219   （可选）
```

::: warning 为什么 gateway 必须第一个起
Gateway 配置了 `discovery.locator.enabled: true`，靠服务发现动态生成路由。
先起 Gateway 可以让它在后续服务注册时立刻感知；反过来虽然最终也能发现，但前几分钟的请求会 503。
:::

**第五步：验证注册情况**

打开 Nacos 控制台 → **服务管理 → 服务列表**，应看到所有已启动的服务实例数为 1。

## 首次启动验证

用三个命令确认健康检查通过：

```bash
# 1) 网关在线
curl http://localhost:8080/actuator/health

# 2) 获取验证码（返回 JSON 且含 captchaEnabled / uuid）
curl http://localhost:8080/auth/code

# 3) 系统服务经网关可达（需要 token，先跳过）
```

::: tip 关闭验证码方便联调
调试期可以关掉验证码，减少摩擦：`ruoyi-auth.yml` 里把 `captcha.enabled` 改为 `false`。
上线前记得改回来。详见 [登录调试步骤](/questions/login_step)。
:::

## IDEA 中启动

项目 `.run/` 目录下已经有现成的运行配置（Compound 类型可批量启动），直接选中 `RuoYiGatewayApplication` 等启动即可。

::: warning .run 配置没有覆盖 exam 服务
`.run/` 里的配置文件只包含框架原生服务（gateway/auth/system/gen/job/resource…），
**10 个 exam 服务需要自己新建 Spring Boot 运行配置**，或直接用 Maven / jar 启动。
:::

详细配置见 [IDEA 环境配置](/backend/quickstart/idea_environment)。

## 首次登录

| 角色 | 账号 | 密码 | 权限 |
| --- | --- | --- | --- |
| 超级管理员 | `admin` | `admin123` | 全部功能，含系统管理、租户管理 |
| 教师 | 需自行创建并授权 | — | 题库、组卷、考试、阅卷、统计 |
| 学生 | 需自行创建 | — | 考试中心、我的考试、错题本、我的证书 |

默认租户 ID 为 `000000`（超管租户）。多租户场景下登录需要额外传 `tenantId`。

::: tip 忘记密码
`sys_user` 表的密码是 BCrypt。可以执行一次：

```sql
UPDATE sys_user SET password = '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2' WHERE user_name = 'admin';
```

这会把密码重置为 `admin123`。**仅用于本地环境**。
:::

## 下一步

本地跑通后，进入 [打包与部署](/backend/quickstart/deploy)。
