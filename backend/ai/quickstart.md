---
title: AI 服务部署与配置
description: ruoyi-exam-ai（Java 9220）与 ruoyi-exam-agent（Python 9221）的安装、配置、启动与自检
---

# AI 服务部署与配置

AI 是**可选能力**：不启动这两个服务，砚考的全部考试业务照常运行。
启动顺序上它们依赖 Nacos、MySQL、Redis，被 `ruoyi-exam-mark` 依赖。

## 部署顺序

```text
Nacos + MySQL + Redis 就绪
        │
        ▼
  ruoyi-exam-agent（Python 9221）   ← 先起，Java 侧会回调它
        │
        ▼
  ruoyi-exam-ai（Java 9220）
        │
        ▼
  业务服务（mark / question …）按需调用
```

docker-compose 里已经写好了 `depends_on`：

```yaml
exam-ai:
  depends_on:
    - exam-agent
```

## 第一步：导入 Nacos 配置

`script/config/nacos/ruoyi-exam-ai.yml` 需要在 Nacos 控制台手工创建
（dataId `ruoyi-exam-ai.yml`，group 与 namespace 与其它服务一致）。

完整内容：

```yaml
spring:
  datasource:
    dynamic:
      primary: master
      datasource:
        master:
          type: ${spring.datasource.type}
          driver-class-name: com.mysql.cj.jdbc.Driver
          url: ${datasource.exam.url}
          username: ${datasource.exam.username}
          password: ${datasource.exam.password}

exam-tool:
  token: ""
  gateway-url: http://127.0.0.1:8080
  api:
    enabled: true
    timeout-ms: 8000
    allow: /exam/,/invite/,/question/,/paper/,/answer/,/mark/,/stat/,/practice/,/proctor/,/cert/,/system/dict/
    deny: /exam/user/,/system/dict/type/
    write-allow: /question/create,/mark/score,/mark/task/,/cert/record/,/practice/wrong/,/exam/

ai:
  agent:
    service-name: ruoyi-exam-agent
    base-path: /
    connect-timeout: 5000
    read-timeout: 60000
    max-retries: 2
    mq:
      enabled: false
      topic: ai-agent-task
      consumer-group: ruoyi-exam-ai-consumer
```

### 各配置项说明

| 配置键 | 默认值 | 含义 |
| --- | --- | --- |
| `exam-tool.token` | 空 | Agent 回调 `/api/exam-tool/**` 的共享令牌。**留空 = 不校验**（仅本地联调），上生产必须与 Agent 的 `AGENT_JAVA_GATEWAY_TOKEN` 配成同一个值 |
| `exam-tool.gateway-url` | `http://127.0.0.1:8080` | AI 代调业务接口时打到哪个网关。走网关才能带上用户登录态与权限 |
| `exam-tool.api.enabled` | `true` | 关掉后 Agent 只能用内置工具，不能代调任意接口 |
| `exam-tool.api.timeout-ms` | `8000` | 代调超时 |
| `exam-tool.api.allow` | 见上 | 路径白名单，只列考试域业务接口 |
| `exam-tool.api.deny` | 空 | 显式拒绝，优先级高于 allow |
| `exam-tool.api.write-allow` | 见上 | 非 GET 请求还必须命中的前缀（写操作二次收口） |

::: warning 配置前缀有个坑
`ruoyi-exam-ai.yml` 里的 `ai.agent.*` 这一块**目前不会绑定到任何 Bean**。
代码里 `AiAgentProperties` 绑定的前缀是 **`exam.ai.*`**，两者对不上。

实际生效的是代码默认值：agent 地址 `http://127.0.0.1:9221`、接口前缀 `/api/ai`。

如果你要改 agent 地址，请在 Nacos 里加：

```yaml
exam:
  ai:
    url: http://your-agent-host:9221
```

| 配置键 | 默认值 | 含义 |
| --- | --- | --- |
| `exam.ai.enabled` | `true` | AI 总开关。关掉后所有 AI 接口返回「未启用」，前端隐藏入口 |
| `exam.ai.url` | `http://127.0.0.1:9221` | agent 直连地址；留空走 Nacos 服务发现 |
| `exam.ai.service-name` | `ruoyi-exam-agent` | url 为空时按此服务名做服务发现 |
| `exam.ai.api-prefix` | `/api/ai` | 接口前缀，需与 Agent 侧 `API_PREFIX` 一致 |
| `exam.ai.connect-timeout` | `3000` | 连接超时（毫秒） |
| `exam.ai.read-timeout` | `60000` | 读取超时（毫秒），主观题评分涉及长文本 |
| `exam.ai.batch-parallel` | `4` | 批量并发度 |
| `exam.ai.retry-count` | `1` | 网络层重试次数（模型主备切换由 Agent 自己做） |
| `exam.ai.default-tenant` | `000000` | 默认租户 ID |
| `exam.ai.mark-timeout` | `45000` | 单题评分超时——**代码中未被引用**，实际用 `read-timeout` |
:::

## 第二步：部署 Python Agent

### 本地开发

```bash
cd exam-back/ruoyi-agent/ruoyi-exam-agent

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

python -m app.main
# 或
uvicorn app.main:app --host 0.0.0.0 --port 9221 --reload
```

启动后自动注册 Nacos（服务名 `ruoyi-exam-agent`，namespace `dev`）。
接口文档：<http://127.0.0.1:9221/docs>

### 配置项（环境变量，前缀 `AGENT_`）

Agent 的配置全部走环境变量，读 `.env` 文件。核心项：

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| `AGENT_PORT` | `9221` | 端口 |
| `AGENT_NACOS_ENABLED` | `True` | 是否注册 Nacos |
| `AGENT_NACOS_SERVER` | `127.0.0.1:8848` | Nacos 地址 |
| `AGENT_NACOS_NAMESPACE` | `dev` | 命名空间 |
| `AGENT_NACOS_USERNAME` / `PASSWORD` | `nacos` / `nacos` | Nacos 登录凭据 |
| **`AGENT_NACOS_IP`** | 空（自动探测） | **容器/多网卡必须显式指定**，否则 Java 侧拿到一个连不通的地址 |
| `AGENT_JAVA_GATEWAY_BASE_URL` | `http://127.0.0.1:9220` | 回调 Java 侧工具端点的地址 |
| `AGENT_JAVA_GATEWAY_TOKEN` | 空 | 回调令牌，放在 `X-Agent-Token` 头（不是 `Authorization`） |
| `AGENT_JAVA_GATEWAY_TIMEOUT` | `10` | 回调超时（秒） |
| `AGENT_LLM_BASE_URL` | `https://api.deepseek.com/v1` | 模型 API 地址（OpenAI 兼容协议） |
| `AGENT_LLM_API_KEY` | 空 | 模型密钥 |
| `AGENT_LLM_MODEL` | `deepseek-chat` | 模型名 |
| `AGENT_LLM_TEMPERATURE` | `0.2` | 温度 |
| `AGENT_LLM_MODELS` | 空 | 多模型主备（JSON 数组），配了就忽略上面三个单模型项 |
| `AGENT_LLM_MOCK` | `False` | **自测开关**，不配真实 Key 也能跑通链路，返回空结构。**严禁生产** |
| `AGENT_MODEL_SOURCE` | `mysql,env` | 模型配置源优先级，逗号分隔按序尝试 |
| `AGENT_MYSQL_*` | — | 只读 `ry-cloud.ai_model_config` 表，**严禁写入** |
| `AGENT_MEMORY_BACKEND` | `auto` | `auto`/`redis`/`memory`，连不上 Redis 自动降级 |
| `AGENT_RAG_ENABLED` | **`False`** | RAG 开关（一期用 BM25，不需要向量库） |
| `AGENT_AGENT_MAX_STEPS` | `12` | 编排最大步数 |
| `AGENT_AGENT_REFLECTION_ENABLED` | `True` | 是否启用 Critic 自检 |

完整清单见 `app/config.py` 与 `.env.example`。

::: tip 没有 API Key 也能先把链路跑通
把 `AGENT_LLM_MOCK=true`，Agent 会返回空结构而不是报错，
可以验证「Java → Python → 返回」整条链路是否通。
此时 `mark_score` 会返回 `confidence=0.0` → 触发 `need_human=true`，正好验证兜底逻辑。

**生产环境务必关掉它。**
:::

### Docker 部署

```bash
docker build -t ruoyi-exam-agent:1.0.0 .
docker run -d -p 9221:9221 --env-file .env ruoyi-exam-agent:1.0.0
```

容器里的关键差异：

| 变量 | 容器里应该写什么 | 为什么 |
| --- | --- | --- |
| `AGENT_JAVA_GATEWAY_BASE_URL` | `http://host.docker.internal:9220` | 容器内的 `127.0.0.1` 是容器自己，不是宿主机 |
| `AGENT_NACOS_SERVER` | `host.docker.internal:8848` | 同上 |
| `AGENT_NACOS_IP` | 宿主机真实 IP | 自动探测的出口 IP 别的服务未必连得上 |
| `AGENT_MYSQL_HOST` | `host.docker.internal` | 同上 |

镜像里**不会**打进 `.env`（已在 `.dockerignore` 排除）——
里面有大模型 API Key，运行时请用 `docker -e` 或 compose `environment` 注入。

## 第三步：启动 Java 侧

```bash
mvn -DskipTests -pl ruoyi-modules/ruoyi-exam-ai -am package
java -jar ruoyi-modules/ruoyi-exam-ai/target/ruoyi-exam-ai.jar
```

网关路由（`ruoyi-gateway.yml`）：

```yaml
- id: ruoyi-exam-ai
  uri: lb://ruoyi-exam-ai
  predicates:
    - Path=/ai/**
  filters:
  # - StripPrefix=1
```

::: warning StripPrefix 被注释掉了
路径**不剥离前缀**原样转发，所以 Controller 写的是 `@RequestMapping({"", "/ai"})`
和 `@RequestMapping({"/chat", "/ai/chat"})` 两种形态都要匹配。

副作用：**`/chat`、`/chat/sessions`、`/chat/session/{id}`、`/chat/whoami` 这四个路径在网关上不可达**，
只有 `/ai/chat`、`/ai/chat/sessions` 等能通。前端请统一用 `/ai/chat` 前缀。
:::

## 第四步：模型配置

有两种方式，优先级由 `AGENT_MODEL_SOURCE`（默认 `mysql,env`）决定，**mysql 拿到配置就不再看 env**。

### 方式一：数据库表（推荐，支持多租户）

在 `ry-cloud.ai_model_config` 表里加记录：

| 字段 | 说明 |
| --- | --- |
| `config_name` | 配置名称，展示用 |
| `model_type` | 模型类型 |
| `model_name` | 实际模型标识，如 `deepseek-chat` |
| `api_base` | API 地址 |
| `api_key` | 密钥（日志中会脱敏成 `前缀6位***后4位`） |
| `temperature` / `max_tokens` | 采样参数 |
| `timeout` | 超时，**单位毫秒**（代码会除以 1000 转成秒） |
| `retry_count` | 单模型内重试次数 |
| `priority` | **越小越优先**，主用取最小值 |
| `status` | `0` 启用 |
| `tenant_id` | 租户隔离 |

排序规则：`ORDER BY priority ASC, id ASC`。缺 `api_key` 或 `model_name` 的记录会被跳过。

### 方式二：环境变量

单模型用 `AGENT_LLM_BASE_URL` / `AGENT_LLM_API_KEY` / `AGENT_LLM_MODEL`；
多模型主备用 `AGENT_LLM_MODELS`（JSON 数组）：

```bash
AGENT_LLM_MODELS='[
  {"name":"DeepSeek","model_name":"deepseek-chat",
   "base_url":"https://api.deepseek.com/v1","api_key":"sk-xxx","priority":10},
  {"name":"Qwen","model_name":"qwen-plus",
   "base_url":"https://dashscope.aliyuncs.com/compatible-mode/v1","api_key":"sk-yyy","priority":20}
]'
```

改完配置不用重启，调一下热加载：

```bash
curl -X POST "http://127.0.0.1:9221/api/ai/model/reload?tenant_id=000000"
```

## 第五步：自检

### 一键自检

```bash
python selftest.py
```

会依次打 `/health`、`/api/ai/skill/list`、`/api/ai/tool/list`、`/api/ai/model/list`、
`/api/ai/agent/plan/list`，以及一次真实的 `mark_score` 调用，结果写入 `selftest-report.txt`。

输出示例（MOCK 模式）：

```text
PASS GET /health -> HTTP 200 | status=UP skills=17 prompts=22
PASS GET /api/ai/skill/list -> HTTP 200 | skills=17
PASS GET /api/ai/tool/list -> HTTP 200 | tools=26
PASS GET /api/ai/model/list -> HTTP 200 | models=1 primary=MOCK（未配置真实模型）
PASS POST /api/ai/skill/mark_score/run -> HTTP 200 | skill_ok=True
RESULT: ALL PASS
```

### 健康检查

```bash
curl http://127.0.0.1:9221/health
```

::: tip `/health` 不包 R&lt;T&gt;
这是刻意的——Nacos 与 Docker `HEALTHCHECK` 直接读 `status` 字段。
`/api/ai/**` 下的接口才统一包 `R<T>`。
:::

返回里带 `nacos`、`skills`、`prompts`、`rag`、`model`、`call` 六组状态，**先看这一段排查**。

### 从 Java 侧确认

```bash
curl -H "Authorization: Bearer <token>" http://<网关>:8080/ai/enabled
# {"code":200,"data":{"enabled":true}}
```

`enabled()` 内部会 ping Agent，结果**缓存 10 秒**——改完配置稍等再试。

### 单元测试

```bash
pytest                                            # 单元测试（默认，不需要真实 Key）
pytest tests/test_gateway.py -v                   # 模型网关与熔断
pytest tests/test_tools.py -v                     # 护栏铁律
AGENT_LLM_MOCK=false AGENT_LLM_API_KEY=sk-xxx pytest -m integration   # 真实模型回归（会花钱）
```

::: warning 测试文件里有一处过期断言
`tests/test_tools.py` 里 `assert len(TOOLS) == 24`，而 `catalog.py` 实际有 **26 个**工具，
这条断言会失败。更新工具清单时记得同步改。
同理 README 里「15 个 Tool、17 条提示词」是早期快照，实际是 26 / 22。
:::

## 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `AI 服务未启用，请确认 agent 已启动` | agent 没起来，或地址连错 | 先看日志里的**最终 URL**——连错地址比代码写错常见得多 |
| Nacos 报 `Insufficient privilege.` | 用了 `nacos-sdk-python` 注册 | 代码已改成 httpx 直连 OpenAPI 绕过，确认跑的是新版本 |
| 容器里 Agent 调不通 Java | `AGENT_JAVA_GATEWAY_BASE_URL` 写成了 `127.0.0.1` | 改成 `host.docker.internal:9220` |
| 工具调用返回「认证失败，无法访问系统资源」 | 缺 `SA-SAME-TOKEN` 头 | `ExamToolSameTokenConfig` 会自动补；若 Redis 里没有 same-token 会 warn，可在 yaml 里打开 `sa-token.check-same-token: false` |
| 所有 AI 请求都很慢 | 模型超时 + 无熔断 | 检查 `/api/ai/model/health` 的 `circuit`，必要时 `POST /api/ai/model/circuit/reset` |
| 分数全是 0 且 `needHuman=true` | MOCK 模式没关 | 检查 `AGENT_LLM_MOCK` |

## 相关文档

- [AI 能力总览](/backend/ai/)
- [模型网关](/backend/ai/model-gateway)
- [Tool 工具与护栏](/backend/ai/tools)
