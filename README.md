# 砚考官方文档

砚考 —— 面向高校、政企与培训机构的在线考试与题库管理平台。
本站使用 [VitePress](https://vitepress.dev) 构建。

## 本地开发

```bash
npm install
npm run docs:dev
```

打开 http://localhost:5173 即可预览，修改 Markdown 会热更新。

## 构建

```bash
npm run docs:build
npm run docs:preview
```

构建产物输出到 `.vitepress/dist`，可直接部署到任意静态托管或 Nginx。

## 目录结构

```text
.
├── index.md                  # 首页
├── guide/                    # 产品简介与考试全流程
│   ├── index.md              #   产品简介
│   ├── getting-started.md    #   快速开始
│   ├── concepts.md           #   核心概念
│   ├── question-bank.md      #   题库管理
│   ├── paper.md              #   试卷与组卷
│   ├── exam.md               #   发布考试
│   ├── proctoring.md         #   在线监考与防作弊
│   ├── grading.md            #   阅卷与复核
│   └── analytics.md          #   成绩与学情分析
├── admin/                    # 管理与部署
│   ├── index.md              #   组织与权限
│   ├── users-roles.md        #   用户与角色
│   ├── settings.md           #   系统设置
│   └── deployment.md         #   私有化部署
├── api/                      # 开发者接口
│   ├── index.md              #   API 概览
│   └── webhook.md            #   Webhook 与集成
├── faq.md                    # 常见问题
├── changelog.md              # 更新日志
└── .vitepress/
    ├── config.mts            # 站点配置
    └── theme/                # 主题与样式
```

## 写作约定

- 一个页面只讲一件事，超过三屏就拆分
- 配置类内容优先用表格，流程类内容优先用有序列表
- 代码片段标注语言，示例要能直接跑
- 提醒用 `::: tip`，风险用 `::: warning`
