---
title: 中间件部署
description: 使用 Docker Compose 一键拉起砚考所需的 MySQL、Nacos、Redis、MinIO 等中间件
---

# 中间件部署

项目在 `exam-back/script/docker/docker-compose.yml` 提供了完整的中间件编排。

::: warning 网络模式限制
编排文件里所有容器都是 `network_mode: "host"`，**仅 Linux 生效**。macOS / Windows 上要么改用虚拟机 / Linux 服务器，要么自行把 host 模式改成端口映射。
:::

## 快速拉起

```bash
cd exam-back/script/docker

# 必需的四个
docker-compose up -d mysql nacos redis minio

# 可选
docker-compose up -d seata-server ruoyi-monitor ruoyi-snailjob-server nginx-web
```

## 默认账号密码

::: danger 上线前必须修改
下面所有密码都是默认值，**生产环境务必逐项替换**。
:::

| 中间件 | 端口 | 账号 | 默认密码 |
| --- | --- | --- | --- |
| MySQL | 3306 | `root` | `ruoyi123` |
| Nacos | 8848 / 9848 / 9849 | `nacos` | `nacos` |
| Redis | 6379 | — | `ruoyi123` |
| MinIO | 9000 / 9001（控制台） | `ruoyi` | `ruoyi123` |
| SnailJob | 8800 / 17888 | `admin` | `admin` |
| Monitor | 9100 | `ruoyi` | `123456` |
| Grafana | 3000 | `admin` | `123456` |
| RabbitMQ | 5672 / 15672 | `ruoyi` | `ruoyi123` |

## 镜像清单

| 服务 | 镜像 | 端口 |
| --- | --- | --- |
| mysql | `mysql:8.0.42` | 3306 |
| nacos | `ruoyi/ruoyi-nacos:2.6.2` | 8848 / 9848 / 9849 |
| redis | `redis:7.2.8` | 6379 |
| minio | `pgsty/minio:RELEASE.2026-02-14T12-00-00Z` | 9000 / 9001 |
| seata-server | `ruoyi/ruoyi-seata-server:2.6.2` | 7091 / 8091 |
| nginx | `nginx:1.22.1` | 80 / 443 |

::: tip Nacos 9848/9849 别忘开
Nacos 2.x 的 gRPC 通信使用 `9848`（客户端）和 `9849`（服务端），比 8848 偏移 1000。
只开 8848 会出现控制台能进、但服务注册不上的现象。
:::

## MinIO 初始化

MinIO 用于存放试题附件、证书背景图/印章、**监考抓拍照片**。

1. 访问 `http://<ip>:9001`，用 `ruoyi` / `ruoyi123` 登录
2. 创建 bucket，例如 `exam`（建议私有）
3. 在系统后台 **文件管理 → 文件配置** 中填入 endpoint、accessKey、secretKey、bucketName

::: warning 抓拍照片会持续增长
监考摄像头按 `cameraInterval`（默认 60 秒）定时抓拍，一场百人考试一小时可产生 6000 张图。
务必给 MinIO 挂够磁盘，并规划生命周期策略定期清理超过保留期的抓拍。
:::

## 可选扩展中间件

需要时再从 compose 里单独拉起，不必全开：

| 中间件 | 端口 | 用途 |
| --- | --- | --- |
| Elasticsearch | 9200 / 9300 | 日志检索、全文搜索 |
| Kibana | 5601 | ES 可视化 |
| Logstash | 4560 | 日志采集（对标 `logstash.address`） |
| RocketMQ | 9876 / 10911 | 消息队列（含控制台 19876） |
| RabbitMQ | 5672 / 15672 | 消息队列（含延迟消息插件） |
| Kafka | 9092 / 9093 | 消息队列 |
| SkyWalking OAP / UI | 11800 / 18080 | 链路追踪 |
| Prometheus / Grafana | 9090 / 3000 | 指标监控 |
| ShardingSphere-Proxy | 3307 | 分库分表代理 |

详细的搭建步骤见 [扩展功能](/backend/extend-function/nacos)。

## 端口冲突排查

官方 compose 未登记 exam 服务，容易出现的冲突：

```bash
# 检查端口占用
lsof -i :9211
# 或
netstat -tunlp | grep 9211
```

::: warning SnailJob 端口不一致
`docker-compose.yml` 里给 `ruoyi-job` 配的是 `SNAIL_PORT: 19203`，而 Nacos 配置 `ruoyi-job.yml` 里是 `port: 2${server.port}` = **29203**，Dockerfile 里也是 29203。
部署前请统一（推荐统一为 29203）。
:::

## 下一步

中间件就绪后，进行 [数据库初始化](/backend/quickstart/database)。
