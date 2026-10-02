# 私有化部署

砚考支持完全离线的私有化部署，所有数据留在机构自有服务器内。

::: tip 本文档面向运维人员
如果你只需要使用砚考而无需维护服务器，可以跳过本文，
直接看 [快速开始](/guide/getting-started)。
:::

## 部署形态

| 形态 | 并发规模 | 服务器建议 |
| --- | --- | --- |
| 单机版 | ≤ 500 人同时在线 | 8C16G × 1 |
| 标准集群 | ≤ 3000 人同时在线 | 应用 8C16G × 2，数据库 16C64G × 1 |
| 大型集群 | ≥ 3000 人同时在线 | 应用横向扩展，数据库主从 + 读写分离 |

## 环境要求

### 软件版本

| 组件 | 版本要求 |
| --- | --- |
| 操作系统 | CentOS 7.9+ / Rocky 9 / Ubuntu 22.04 / 麒麟 V10 |
| 容器运行时 | Docker 24+ 与 Docker Compose v2 |
| 数据库 | MySQL 8.0+ 或 PostgreSQL 14+ |
| 缓存 | Redis 7+ |
| 对象存储 | MinIO（内置）或 S3 兼容存储 |
| 反向代理 | Nginx 1.22+ |

### 国产化支持

已适配：鲲鹏 / 飞腾（ARM64）、麒麟 / 统信操作系统、达梦 DM8、人大金仓 KingBase。
适配清单以实施交付文档为准。

### 网络与端口

| 端口 | 用途 | 是否需对外 |
| --- | --- | --- |
| 443 | HTTPS 访问 | 是 |
| 80 | HTTP 跳转 | 是 |
| 22 | 运维 SSH | 否（建议仅内网） |
| 3306 / 5432 | 数据库 | 否 |
| 6379 | Redis | 否 |
| 9000 | MinIO | 否 |

::: warning 监考屏幕共享需要 WebSocket 与 UDP 端口
若启用屏幕共享监看，需在反向代理上放行 WebSocket 升级，
并开放 UDP 10000—20000 端口段用于媒体流。
:::

## 安装步骤

### 1. 准备服务器

```bash
# 关闭 SELinux（或配置对应策略）
setenforce 0
sed -i 's/^SELINUX=.*/SELINUX=permissive/' /etc/selinux/config

# 内核参数
cat >> /etc/sysctl.conf <<EOF
vm.max_map_count=262144
net.core.somaxconn=65535
EOF
sysctl -p
```

### 2. 获取安装包

联系砚考交付团队获取离线安装包 `yankao-offline-<version>.tar.gz`，校验 SHA256：

```bash
sha256sum -c yankao-offline-<version>.tar.gz.sha256
```

### 3. 加载镜像

```bash
tar -xzf yankao-offline-<version>.tar.gz
cd yankao-offline-<version>
docker load -i images/yankao-app.tar
docker load -i images/yankao-nginx.tar
```

### 4. 配置

复制并编辑配置文件：

```bash
cp .env.example .env
vim .env
```

关键配置项：

```ini
# 站点
SITE_DOMAIN=kaoshi.your-school.edu.cn
SITE_TITLE=砚考

# 数据库
DB_HOST=10.0.0.11
DB_PORT=3306
DB_NAME=yankao
DB_USER=yankao
DB_PASSWORD=<请替换为强密码>

# Redis
REDIS_HOST=10.0.0.12
REDIS_PASSWORD=<请替换为强密码>

# 对象存储
STORAGE_TYPE=minio
MINIO_ENDPOINT=http://10.0.0.13:9000
MINIO_ACCESS_KEY=<替换为实际值>
MINIO_SECRET_KEY=<替换为实际值>

# 安全
JWT_SECRET=<随机 32 位字符串>
ENCRYPTION_KEY=<随机 32 位字符串>
```

::: warning 切勿使用示例中的默认密钥
`JWT_SECRET` 与 `ENCRYPTION_KEY` 一旦上线不可更换（会导致已有数据无法解密）。
请使用 `openssl rand -hex 32` 生成并妥善保管。
:::

### 5. 初始化数据库

```bash
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:seed
```

`db:seed` 会创建初始超级管理员，密码输出到控制台，**请立即修改并保存**。

### 6. 启动

```bash
docker compose up -d
docker compose ps      # 确认全部容器 healthy
docker compose logs -f app
```

### 7. 配置反向代理与证书

```nginx
server {
    listen 443 ssl http2;
    server_name kaoshi.your-school.edu.cn;

    ssl_certificate     /etc/nginx/cert/fullchain.pem;
    ssl_certificate_key /etc/nginx/cert/privkey.pem;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 监考媒体流
    location /media/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

### 8. 验收自检

```bash
# 健康检查
curl -fsS https://kaoshi.your-school.edu.cn/api/health

# 跑一遍冒烟用例
docker compose run --rm app npm run smoke -- --domain https://kaoshi.your-school.edu.cn
```

人工验收清单：

- [ ] 用超级管理员登录，修改初始密码
- [ ] 建一个测试题库，导入 3 道题
- [ ] 组一份测试卷，发布一场只有自己的考试
- [ ] 完整作答并交卷，确认客观题自动判分正确
- [ ] 进入监考大屏，确认画面正常
- [ ] 查看分析报告能正常出图
- [ ] 导出一份 Excel 成绩单

## 备份

每日全量备份脚本示例：

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/data/backup/yankao
DATE=$(date +%F-%H%M)

mkdir -p "$BACKUP_DIR/$DATE"

# 数据库
docker compose exec -T db mysqldump \
  --single-transaction --routines --triggers \
  -u root -p"$DB_ROOT_PASSWORD" yankao \
  | gzip > "$BACKUP_DIR/$DATE/db.sql.gz"

# 对象存储
mc mirror --quiet minio/yankao "$BACKUP_DIR/$DATE/objects"

# 保留 30 天
find "$BACKUP_DIR" -maxdepth 1 -mtime +30 -exec rm -rf {} \;
```

加入 crontab：

```text
0 2 * * * /opt/yankao/backup.sh >> /var/log/yankao-backup.log 2>&1
```

::: tip 备份一定要做恢复演练
没验证过的备份等于没有备份。建议每季度在隔离环境完整恢复一次。
:::

## 升级

```bash
# 1. 备份（务必）
./backup.sh

# 2. 停服
docker compose down

# 3. 加载新镜像
docker load -i images-new/yankao-app.tar

# 4. 执行迁移
docker compose run --rm app npm run db:migrate

# 5. 启动
docker compose up -d
```

跨大版本升级请先阅读对应版本的 [更新日志](/changelog)，确认有无破坏性变更。

## 监控

建议接入 Prometheus + Grafana，砚考在 `/metrics` 暴露以下指标：

| 指标 | 告警建议 |
| --- | --- |
| `yankao_http_request_duration_seconds` | P95 > 2s 持续 5 分钟 |
| `yankao_exam_active_users` | 考试期间突降 30% |
| `yankao_db_connections_used` | > 80% 最大连接数 |
| `yankao_media_stream_errors_total` | 5 分钟内 > 10 |
| `yankao_storage_used_bytes` | > 80% 配额 |

## 常见问题

**考试高峰期卡顿？**
优先检查数据库连接池与应用节点 CPU。
大规模考试建议提前扩容应用节点，并在考试开始前 30 分钟预热。

**屏幕共享打不开？**
检查 Nginx 是否正确配置 WebSocket 升级，以及 UDP 端口段是否放行。

**日志文件在哪？**
`docker compose logs` 查看实时日志，持久化日志位于 `/var/lib/docker/volumes/yankao-logs`。
