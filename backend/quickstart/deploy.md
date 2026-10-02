---
title: 打包与部署
description: 砚考前后端生产构建、jar/Docker 部署、Nginx 反代与上线检查清单
---

# 打包与部署

这一页覆盖从「代码」到「线上跑起来」的全过程：后端 jar 打包、Docker 镜像、Nginx 配置、前端构建，以及上线前的安全检查清单。

## 一、后端打包

### 全量构建

```bash
cd exam-back

# 默认 dev profile（Nacos 地址取 127.0.0.1:8848）
mvn clean package -DskipTests

# 生产 profile
mvn clean package -P prod -DskipTests
```

::: warning 打生产包前先改 prod profile
根 `pom.xml` 的 `prod` profile 里 `<nacos.server>` 与 `<logstash.address>` **仍然是 `127.0.0.1`**。
直接打包部署到服务器会找不到注册中心。改完再打。
:::

### 单服务构建

只改了一个服务时，用 `-pl` + `-am` 可以省下几分钟：

```bash
# 只构建答题服务及其依赖模块
mvn clean package -pl ruoyi-modules/ruoyi-exam-answer -am -DskipTests
```

### 产物位置

每个服务在自己的 `target/` 下，`finalName` 等于 artifactId：

```text
ruoyi-modules/ruoyi-exam-question/target/ruoyi-exam-question.jar
ruoyi-modules/ruoyi-exam-paper/target/ruoyi-exam-paper.jar
ruoyi-modules/ruoyi-exam-manage/target/ruoyi-exam-manage.jar
ruoyi-modules/ruoyi-exam-answer/target/ruoyi-exam-answer.jar
ruoyi-modules/ruoyi-exam-mark/target/ruoyi-exam-mark.jar
ruoyi-modules/ruoyi-exam-stat/target/ruoyi-exam-stat.jar
ruoyi-modules/ruoyi-exam-practice/target/ruoyi-exam-practice.jar
ruoyi-modules/ruoyi-exam-cert/target/ruoyi-exam-cert.jar
ruoyi-modules/ruoyi-exam-proctor/target/ruoyi-exam-proctor.jar
ruoyi-modules/ruoyi-exam-ai/target/ruoyi-exam-ai.jar
```

API 模块产物是普通 jar，不带可执行依赖，无需部署。

## 二、jar 部署（推荐最小改动方案）

### 启动脚本

每个 exam 服务建一个统一的启动脚本 `start.sh`：

```bash
#!/bin/bash
APP_NAME=ruoyi-exam-answer
JAR_PATH=/opt/exam/ruoyi-exam-answer.jar
LOG_PATH=/opt/exam/logs
JAVA_OPTS="-Xms512m -Xmx1024m -XX:+HeapDumpOnOutOfMemoryError -XX:+UseZGC"

mkdir -p $LOG_PATH
nohup java -server $JAVA_OPTS \
  -Dfile.encoding=UTF-8 \
  -jar $JAR_PATH \
  > $LOG_PATH/$APP_NAME.log 2>&1 &

echo "$APP_NAME started, pid=$!"
```

### JVM 参数建议

| 服务类型 | 建议堆大小 | 说明 |
| --- | --- | --- |
| gateway | 1~2 GB | 扛全部流量，适当给大 |
| exam-answer | 1~2 GB | 高并发写，考试期间峰值高 |
| exam-stat | 1~2 GB | 统计查询重 |
| 其余 exam-* | 512 MB~1 GB | 常规 CRUD |

::: tip 虚拟线程留到 JDK21
`application-common.yml` 里 `spring.threads.virtual.enabled: false`。
如果能上 JDK21，可以考虑打开以提升并发吞吐，但务必先在压测环境验证 Dubbo 与 Redisson 的兼容性。
:::

### 停止脚本

```bash
#!/bin/bash
PID=$(ps -ef | grep ruoyi-exam-answer.jar | grep -v grep | awk '{print $2}')
if [ -n "$PID" ]; then
  kill -15 $PID
  echo "stopped $PID"
fi
```

::: warning 不要 kill -9
`answer` 服务有「考试倒计时自动交卷」这类兜底任务，强杀可能导致内存中的答题缓存丢失。
用 `kill -15` 让 Spring 走完优雅停机。
:::

## 三、Docker 部署

### 现状

框架原生服务（gateway / auth / system / gen / job / resource / workflow / monitor / snailjob-server）都有现成 Dockerfile，统一模板：

```dockerfile
FROM bellsoft/liberica-openjdk-rocky:17.0.16-cds
RUN mkdir -p /ruoyi/xxx/logs /ruoyi/xxx/temp /ruoyi/skywalking/agent
WORKDIR /ruoyi/xxx
ENV SERVER_PORT=9201 LANG=C.UTF-8 LC_ALL=C.UTF-8 JAVA_OPTS=""
EXPOSE ${SERVER_PORT}
ADD ./target/xxx.jar ./app.jar
ENTRYPOINT java -Dserver.port=${SERVER_PORT} -XX:+HeapDumpOnOutOfMemoryError -XX:+UseZGC ${JAVA_OPTS} -jar app.jar
```

::: danger 10 个 exam 服务缺少 Dockerfile
`ruoyi-modules/ruoyi-exam-*/` 下**全部没有 Dockerfile**，`script/docker/docker-compose.yml` 里也**没有登记 exam 服务**。
用 Docker 部署前必须先补齐，参照下面模板逐个创建。
:::

### exam 服务 Dockerfile 模板

以 `ruoyi-exam-answer` 为例，在 `ruoyi-modules/ruoyi-exam-answer/Dockerfile` 创建：

```dockerfile
FROM bellsoft/liberica-openjdk-rocky:17.0.16-cds

RUN mkdir -p /ruoyi/exam-answer/logs /ruoyi/exam-answer/temp /ruoyi/skywalking/agent
WORKDIR /ruoyi/exam-answer

ENV SERVER_PORT=9214 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    JAVA_OPTS=""

EXPOSE ${SERVER_PORT}

ADD ./target/ruoyi-exam-answer.jar ./app.jar

ENTRYPOINT java -Dserver.port=${SERVER_PORT} \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:+UseZGC \
  ${JAVA_OPTS} \
  -jar app.jar
```

各服务只需替换三处：`/ruoyi/exam-answer` 路径、`SERVER_PORT`、`app.jar` 名。

| 服务 | SERVER_PORT |
| --- | --- |
| exam-question | 9211 |
| exam-paper | 9212 |
| exam-manage | 9213 |
| exam-answer | 9214 |
| exam-mark | 9215 |
| exam-stat | 9216 |
| exam-practice | 9217 |
| exam-cert | 9218 |
| exam-proctor | 9219 |
| exam-ai | 9220 |

### 构建与运行

```bash
cd ruoyi-modules/ruoyi-exam-answer
mvn clean package -DskipTests
docker build -t ruoyi/ruoyi-exam-answer:2.6.2 .

docker run -d --name ruoyi-exam-answer \
  --network host \
  -e JAVA_OPTS="-Xms512m -Xmx1g" \
  -v /opt/exam/logs:/ruoyi/exam-answer/logs \
  ruoyi/ruoyi-exam-answer:2.6.2
```

如果在 docker-compose 里管理，追加一段（注意 host 网络模式）：

```yaml
  ruoyi-exam-answer:
    image: ruoyi/ruoyi-exam-answer:2.6.2
    container_name: ruoyi-exam-answer
    network_mode: "host"
    environment:
      SERVER_PORT: 9214
      JAVA_OPTS: "-Xms512m -Xmx1024m"
    volumes:
      - /docker/exam/logs:/ruoyi/exam-answer/logs
    depends_on:
      - mysql
      - nacos
      - redis
```

::: warning /docker 目录权限
容器内以 root 写日志，宿主机挂载目录权限不足会导致启动失败：

```bash
chmod -R 777 /docker
```
:::

### Python AI Agent

`ruoyi-agent/ruoyi-exam-agent/` 有独立 Dockerfile，不进 Maven 构建：

```bash
cd ruoyi-agent/ruoyi-exam-agent
docker build -t ruoyi/ruoyi-exam-agent:latest .
docker run -d --name ruoyi-exam-agent \
  -e AGENT_PORT=9221 \
  -e AGENT_NACOS_SERVER=127.0.0.1:8848 \
  -e AGENT_NACOS_NAMESPACE=dev \
  -e AGENT_LLM_BASE_URL=<大模型地址> \
  -e AGENT_LLM_API_KEY=<密钥> \
  -e AGENT_LLM_MODEL=qwen-plus \
  -p 9221:9221 \
  ruoyi/ruoyi-exam-agent:latest
```

## 四、前端构建

```bash
cd exam-front

# 安装依赖
npm install --registry=https://registry.npmmirror.com

# 本地开发
npm run dev          # http://localhost:80

# 生产构建
npm run build:prod   # 产物在 dist/
```

::: danger 生产环境变量还是 RuoYi 的标题
`.env.production` 里的 `VITE_APP_TITLE` 仍是 `RuoYi-Vue-Plus多租户管理系统`，
而 `.env.development` 已经改成 `砚考 | YANKAO`。打生产包前记得同步。
:::

### 生产环境要改的变量

```ini
VITE_APP_TITLE = 砚考 | YANKAO
VITE_APP_BASE_API = /prod-api      # 与 Nginx 反代路径一致
VITE_APP_CONTEXT_PATH = /
```

::: tip 接口加密同步
如果 `application-common.yml` 里更换了 RSA 密钥对，前端 `.env.production` 的
`VITE_APP_PUBLIC_KEY` / `VITE_APP_PRIVATE_KEY` 必须同步替换，否则所有接口都会解密失败。
排查见 [请求响应加解密问题](/questions/api_encrypt)。
:::

## 五、Nginx 配置

把 `dist/` 内容上传到静态目录，Nginx 负责托管页面并把 API 反代到网关。

```nginx
server {
    listen       80;
    server_name  your-domain.com;

    # 前端静态资源
    location / {
        root   /docker/nginx/html;
        try_files $uri $uri/ /index.html;
        index  index.html index.htm;
    }

    # 后端 API 反代到网关
    location /prod-api/ {
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://127.0.0.1:8080/;
    }

    # SSE 需要关闭缓冲
    location /prod-api/resource/sse {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   html;
    }
}
```

::: warning SSE 必须关 proxy_buffering
系统的通知推送走 SSE。如果 Nginx 开了缓冲，消息会一直攒着不推送客户端，表现为「消息延迟几十秒才出来」。
:::

### 修改代理路径时注意三处联动

前端 `.env` 的 `VITE_APP_BASE_API`、Nginx 的 `location`、Nginx 的 `proxy_pass` 结尾斜杠必须彼此对齐。
`/prod-api/` 的写法会把前缀剥掉后再转发给网关。

## 六、上线前检查清单

::: danger 安全必检
:::

| # | 检查项 | 默认值 | 必须改 |
| :---: | --- | :---: | :---: |
| 1 | `sa-token.jwt-secret-key` | `abcdefghijklmnopqrstuvwxyz` | ✅ |
| 2 | `api-decrypt` RSA 公私钥（后端 + 前端 env） | 开源仓库明文 | ✅ |
| 3 | MySQL root 密码 | `password` / `ruoyi123` | ✅ |
| 4 | Redis 密码 | `ruoyi123` | ✅ |
| 5 | Nacos 账号密码 | `nacos` / `nacos` | ✅ |
| 6 | MinIO AccessKey / SecretKey | `ruoyi` / `ruoyi123` | ✅ |
| 7 | Admin 账号初始密码 | `admin123` | ✅ |
| 8 | SnailJob token | 硬编码明文 | ✅ |
| 9 | SpringBoot Admin 账号 | `ruoyi` / `123456` | ✅（或关闭） |
| 10 | `prod` profile 的 Nacos 地址 | `127.0.0.1` | ✅ |

### 性能相关

| # | 检查项 | 建议 |
| :---: | --- | --- |
| 1 | `datasource.yml` 的 `p6spy` | 改成 `false`（有性能损耗） |
| 2 | `VITE_BUILD_COMPRESS` | 设为 `gzip`，Nginx 开 `gzip_static` |
| 3 | 网关连接池 | WebFlux 版 `max-connections: 1000`，按并发量调 |
| 4 | MinIO 容量 | 抓拍照片增长快，配生命周期策略 |
| 5 | MySQL `max_connections` | 服务数 × 20（Hikari maxPoolSize），至少 500 |

### 高可用建议

| 组件 | 建议 |
| --- | --- |
| Gateway | ≥ 2 实例 + Nginx 负载均衡 |
| exam-answer | ≥ 2 实例（考试期唯一高并发写服务） |
| exam-stat | ≥ 2 实例（重查询，避免拖垮） |
| Nacos | 生产用集群，见 [Nacos 集群搭建](/backend/extend-function/nacos) |
| Redis | 哨兵或集群模式 |
| MySQL | 主从；`exam-answer` 库量大后可上 ShardingSphere |

## 七、常见问题

| 现象 | 排查方向 |
| --- | --- |
| 打好的 jar 起不来 | [打包 jar 运行报错](/questions/jar_run_fail) |
| 服务读不到 Nacos 配置 | [无法读取 Nacos 配置](/questions/nacos_read_fail) |
| 登录一直失败 | [登录调试步骤](/questions/login_step) |
| 接口返回密文/解密失败 | [请求响应加解密](/questions/api_encrypt) |
| 放行接口仍提示认证失败 | [放行接口认证失败](/questions/identify_fail) |
| Nacos 报 `naming_instance_metadata` | [Nacos Raft Group 报错](/questions/nacos_naming_instance_metadata) |

## 下一步

- 服务端口与职责：[服务清单与端口](/backend/services)
- 考试业务内部实现：[考试微服务](/backend/exam/overview)
