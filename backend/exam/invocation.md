---
title: 服务间调用
description: 砚考 Dubbo RPC 契约、调用链路与新增接口的扩展步骤
---

# 服务间调用

考试微服务之间用 **Apache Dubbo 3.3.6** 通信。接口契约放在 `ruoyi-api/` 模块，实现放在各业务服务的 `dubbo` 包里。

## 模块划分原则

```text
ruoyi-api/ruoyi-api-exam-<模块>/      ← 只有接口 + DTO，无实现
    └── org.dromara.exam.<模块>.api.RemoteXxxService

ruoyi-modules/ruoyi-exam-<模块>/       ← 实现
    └── org.dromara.exam.<模块>.dubbo.RemoteXxxServiceImpl
```

这样做的好处：调用方只依赖 API 模块（一个薄 jar），不会把整个业务模块拖进依赖树。

| 业务服务 | API 模块 | 接口 |
| --- | --- | --- |
| `ruoyi-exam-question` | `ruoyi-api-exam-question` | `RemoteQuestionService` |
| `ruoyi-exam-paper` | `ruoyi-api-exam-paper` | `RemotePaperService` |
| `ruoyi-exam-manage` | `ruoyi-api-exam-manage` | `RemoteExamService` |
| `ruoyi-exam-answer` | `ruoyi-api-exam-answer` | `RemoteExamAnswerService` |
| `ruoyi-exam-mark` | `ruoyi-api-exam-mark` | `RemoteMarkService` |
| `ruoyi-exam-stat` | `ruoyi-api-exam-stat` | `RemoteStatService` |
| `ruoyi-exam-practice` | `ruoyi-api-exam-practice` | `RemoteWrongQuestionService` |
| `ruoyi-exam-cert` | `ruoyi-api-exam-cert` | `RemoteCertService` |
| `ruoyi-exam-proctor` | `ruoyi-api-exam-proctor` | `RemoteProctorService` |

## 写一个 Dubbo 接口

### 1. 在 API 模块定义接口

```java
// ruoyi-api/ruoyi-api-exam-mark/src/main/java/org/dromara/exam/mark/api/RemoteMarkService.java
public interface RemoteMarkService {
    /** 同步主观题阅卷任务（按 recordId 幂等） */
    Long syncSubjective(RemoteMarkSyncBo bo);

    /** 查询某场考试下待阅卷的答卷 ID */
    List<Long> listPendingRecordIds(Long examId);
}
```

DTO 统一放在同级的 `domain` 包，命名前缀用 `Remote`（对外传输）或 `Bo` / `Vo`。

### 2. 在业务模块实现

```java
@Slf4j
@Service                       // Spring 的 @Service
@RequiredArgsConstructor
@DubboService                  // ← 暴露为 Dubbo 服务
public class RemoteMarkServiceImpl implements RemoteMarkService {

    private final IMarkService markService;

    @Override
    public Long syncSubjective(RemoteMarkSyncBo bo) {
        return markService.syncSubjective(bo);
    }
}
```

### 3. 在调用方引用

```java
@Service
public class ExamRecordServiceImpl {

    @DubboReference
    private RemoteMarkService remoteMarkService;

    @DubboReference
    private RemotePaperService remotePaperService;

    @DubboReference
    private RemoteQuestionService remoteQuestionService;
    // ...
}
```

`ruoyi-exam-answer` 的实现里引用了 7 个远程服务，是调用最密集的一个。

::: warning Dubbo 端口自增
`application-common.yml` 里 `dubbo.protocol.port: -1`（从 20880 起自增），
`dubbo.application.qos-enable: false`（避免单机多生产者端口冲突）。
单机起多个服务不会冲突，但**同服务多实例部署时要留意 qos 端口**，改完记得验证。
:::

## 典型调用链路

### 组卷

```text
paper  ──▶ question     按 题库/题型/难度/数量 抽题
```

### 发布考试

```text
manage ──▶ paper        校验试卷可用性、取试卷信息
```

### 开考（链路最长）

```text
answer ──▶ manage       校验可否开考、参考资格、剩余次数
answer ──▶ paper        取试卷快照（开考瞬间抓一次，之后不再变）
answer ──▶ question     取题目与标准答案（判分用）
```

::: tip 为什么要抓快照
试卷在考试期间可能被老师编辑。开考时把试卷快照once拉到 answer 侧，
保证同一场考试所有考生看到的题目完全一致——否则改卷子会影响正在答题的人。
:::

### 交卷（扇出最多）

```text
answer ──▶ mark        syncSubjective 同步主观题阅卷任务（按 recordId 幂等）
answer ──▶ practice    错题入错题本
answer ──▶ proctor     上报防作弊状态
answer ──▶ cert        触发证书颁发（及格且无待阅主观题时）
```

### 阅卷回写

```text
mark   ──▶ answer      listAnswers 读明细 → writeBackMark 回写主观题得分
```

### 统计（旁路只读）

```text
stat   ──▶ 各服务       通过 QuestionRef / ExamRef / PaperQuestionRef 影子实体本地映射
```

## 跨语言调用：AI

```text
[question/paper/answer/mark]
        │ Dubbo
        ▼
[ruoyi-exam-ai :9220]  ──REST lb://ruoyi-exam-agent──▶  [ruoyi-exam-agent :9221 Python]
        │
        └─ 异步批量预留：RocketMQ topic = ai-agent-task（当前 mq.enabled=false）
```

配置在 `ruoyi-exam-ai.yml`：

```yaml
ai:
  agent:
    service-name: ruoyi-exam-agent   # 与 Nacos 注册名一致，不要改
    base-path: /
    connect-timeout: 5000
    read-timeout: 60000
    max-retries: 2
```

## 超时与重试

| 参数 | 默认值 | 位置 |
| --- | --- | --- |
| `dubbo.consumer.timeout` | 3000 ms | `application-common.yml` |
| `dubbo.custom.request-log` | true | 同上（**建议生产关闭**） |
| `dubbo.custom.log-level` | info | 同上 |
| Dubbo 协议端口 | -1（自增） | 同上 |

::: warning 统计类接口要单独配超时
`stat` 的重查询（重算监会、全量知识点分析）可能跑几十秒，
默认的 3 秒消费端超时会直接熔断。建议在引用处显式放大：

```java
@DubboReference(timeout = 60000)
private RemoteStatService remoteStatService;
```
:::

## 排查 Dubbo 问题

```bash
# 查看某服务提供了哪些 Dubbo 接口
telnet localhost 20880
> ls
> ls -l RemoteMarkService
```

或在 [监控中心](/backend/extend-function/nacos)（SpringBoot Admin）里看 Dubbo 元数据。

常见问题：[如何指定 Dubbo 注册 IP](/questions/dubbo_ip)

## 下一步

- 各服务的领域边界：[考试微服务总览](/backend/exam/overview)
- 框架的基础能力：[数据权限](/backend/framework/basic/permissions)、[多租户](/backend/framework/basic/tenant)
