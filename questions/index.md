---
title: 常见问题
description: 砚考部署与开发过程中的高频问题速查
---

# 常见问题

这一页汇总部署与二次开发时最容易卡住的问题。**先在这里搜一遍**，排查效率比翻源码高得多。

::: tip 还没跑起来？
按 [快速开始](/backend/quickstart/requirements) 走一遍，90% 的启动问题会被前置检查清单拦住。
:::

## 启动与部署类

| 问题 | 症状 |
| --- | --- |
| [无法读取 Nacos 配置](/questions/nacos_read_fail) | 服务起来了但报数据源找不到 / 配置缺失 |
| [打包 jar 运行报错](/questions/jar_run_fail) | 本地能跑，打成 jar 就崩 |
| [如何同步项目更新](/questions/synchronous_update) | 拉取上游改动后本地冲突 |
| [登录调试步骤](/questions/login_step) | 登录一直失败、验证码过不去 |
| [放行接口提示认证失败](/questions/identify_fail) | 配了白名单还是 401 |
| [Nacos Raft Group 报错](/questions/nacos_naming_instance_metadata) | 控制台刷 `naming_instance_metadata` |
| [不支持 ST 请求](/questions/st_not_support) | 请求方式被拒 |
| [关于 HTTPS 配置](/questions/https_config) | 摄像头/证书需要 HTTPS |
| [Redis 报错 Permission denied](/questions/permission_denied) | Redis 连接被拒 |

## 框架与接口类

| 问题 | 症状 |
| --- | --- |
| [请求响应参数解密](/questions/api_encrypt) | 接口返回密文 / 解密失败 |
| [JCE cannot authenticate the provider BC](/questions/jce_cannot) | 加密模块初始化失败 |
| [Only one connection receive subscriber allowed](/questions/only_one_subscriber) | SSE / WebSocket 重复订阅 |
| [如何指定 Dubbo 注册 IP](/questions/dubbo_ip) | 多网卡注册到错的地址 |
| [为什么删除 Sentinel](/questions/sentinel_404) | 找不到 Sentinel 控制台 |
| [接口文档对接 knife4j](/questions/kinfe4j) | 想用 knife4j 替代 Swagger |
| [Swagger 相关问题](/questions/swagger) | 接口文档打不开 |
| [如何对接国产数据库](/questions/domestic_databases) | 达梦、人大金仓适配 |
| [如何使用 Druid 连接池](/questions/use_druid) | 想换回 Druid |
| [ParseException SQL 解析异常](/questions/parse_exception) | 多租户/数据权限拼接 SQL 报错 |

## 开发踩坑类

| 问题 | 症状 |
| --- | --- |
| [unable to read meta-data for class xxx](/questions/read_metadata) | 启动报类元数据读不到 |
| [实体 bean 为空问题](/questions/bean_null) | 注入的对象是 null |
| [导入 Excel 实体类为空](/questions/import_excel) | 导入后字段全是空 |
| [Lombok 注解爆红](/questions/lombok) | IDE 里满屏红线但能编译 |

## 快速自检清单

服务起不来时，按顺序过一遍：

```bash
# 1. Nacos 能连上吗
curl http://<nacos>:8848/nacos/actuator/health

# 2. 命名空间 ID 是 dev 吗（不是名称！）
#    控制台 → 命名空间 → 看 ID 列

# 3. 配置 Data ID 与文件名一致吗
#    application-common.yml / datasource.yml / ruoyi-<服务名>.yml

# 4. MySQL 能连吗，库里有表吗
mysql -uroot -p -e "USE ry_exam; SHOW TABLES;"

# 5. Redis 通吗
redis-cli -h <host> -a <pwd> ping

# 6. 网关活吗
curl http://<gateway>:8080/actuator/health

# 7. 服务注册上了吗
#    Nacos 控制台 → 服务管理 → 服务列表
```

## 还是没解决

- 后端部署问题先看：[打包与部署](/backend/quickstart/deploy)
- 前端问题看：[前端文档](/frontend/)
- 提交 Issue：[exam-platform Issues](https://github.com/Alanosy/exam-platform/issues)
- QQ 交流群：群1 `1034380536`、群2 `1098802068`
