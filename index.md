---
layout: home

hero:
  name: 砚考
  text: 在线考试与题库管理平台
  tagline: 从题库建设到考试发布、严肃监考、自动阅卷与学情分析，一套系统覆盖考试全生命周期。
  image:
    src: /logo.svg
    alt: 砚考
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 产品简介
      link: /intro/
    - theme: alt
      text: 部署文档
      link: /backend/quickstart/deploy

features:
  - icon: 📚
    title: 结构化题库
    details: 9 种题型，按分类树组织，支持可见性与三态管理；Excel 模板批量导入导出，整批校验失败回滚。
    link: /guide/question-bank
  - icon: 📝
    title: 灵活组卷
    details: 手工选题与随机抽题规则两种方式，规则可复用，候选不足时提前提示；支持题目与选项乱序。
    link: /guide/paper
  - icon: 🛡️
    title: 严肃监考
    details: 13 类行为全程记录，摄像头定时抓拍，达标即强制交卷——计数与判定全在服务端，改前端绕不过去。
    link: /guide/proctoring
  - icon: ⚡
    title: 自动阅卷
    details: 客观题交卷即出分（正确 / 半对 / 错误三态），主观题三级人工阅卷，每次改分留审计日志。
    link: /guide/grading
  - icon: 📊
    title: 学情分析
    details: 分数段分布、难度与区分度、易错项、知识点掌握度与薄弱分级；预计算汇总表支持定时与手动重算。
    link: /guide/analytics
  - icon: 🏢
    title: 私有化部署
    details: 基于 RuoYi-Cloud-Plus 微服务架构，10 个考试服务可独立部署与水平扩展，支持多租户隔离。
    link: /backend/quickstart/deploy
---

## 砚考是什么

砚考是一套面向**高校、职业院校、政企单位与培训机构**的在线考试与题库管理平台。
它把「出题 → 组卷 → 考试 → 监考 → 阅卷 → 分析」这条链路上的每一步都产品化，
让教务、考务与培训负责人不必再在多个工具之间手工搬运数据。

::: tip 三分钟上手
如果你是第一次接触砚考，建议从 [快速开始](/guide/getting-started) 读起，
跟着走完「建题库 → 组卷 → 发布一场考试 → 看成绩报表」的完整流程。
:::

## 适用场景

| 场景 | 砚考提供的能力 |
| --- | --- |
| 高校期末考试、补考、重修考试 | 大规模并发、按教学班排考、白名单准入、缓考与违纪处理 |
| 职业资格与认证考试 | 严格身份核验、全程监考留痕、证书有效期与吊销 |
| 企业校招 / 社招笔试 | 链接邀约、限时作答、防作弊报告、成绩接口对接 ATS |
| 内部培训与上岗考核 | 岗位题库、达标线设定、错题重练、培训效果追踪 |
| 日常作业与随堂测验 | 轻量发布、自动判分、即时反馈 |

详见 [适用场景](/intro/scenarios)。

## 一次完整考试的旅程

```text
建题库  →  组卷  →  发布与排期  →  考生作答  →  系统监考
                                                    ↓
学情分析  ←  成绩发布  ←  主观题阅卷  ←  客观题自动判分
```

想了解每一步的细节，请打开 [使用指南](/guide/)。

## 按角色进入

| 你是 | 从这里开始 |
| --- | --- |
| 想看看它长什么样 | [演示系统](/demo/) |
| 要办一场考试 | [使用指南](/guide/) |
| 要部署到服务器 | [环境准备](/backend/quickstart/requirements) |
| 要二次开发前端 | [前端文档](/frontend/) |
| 要对接集成 | [API 概览](/api/) |

## 获取帮助

- 产品能力：[产品介绍](/intro/)
- 按主题浏览：[使用指南](/guide/)
- 后端与部署：[后端文档](/backend/)
- 前端开发：[前端文档](/frontend/)
- 对接开发：[API 概览](/api/)
- 遇到问题先看：[常见问题](/questions/)
