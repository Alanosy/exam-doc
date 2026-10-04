import { defineConfig } from 'vitepress'

// 「产品介绍」与「演示系统」共用同一份左侧大纲
const introSidebar = [
  {
    text: '认识砚考',
    items: [
      { text: '产品简介', link: '/intro/' },
      { text: '功能总览', link: '/intro/features' },
      { text: '适用场景', link: '/intro/scenarios' },
      { text: '核心流程', link: '/intro/workflow' }
    ]
  },
  {
    text: '架构与技术',
    items: [
      { text: '系统架构', link: '/intro/architecture' },
      { text: '服务清单与端口', link: '/backend/services' },
      { text: '技术栈', link: '/intro/tech-stack' }
    ]
  },
  {
    text: '版本与支持',
    items: [
      { text: '更新日志', link: '/intro/changelog' },
      { text: '演示系统', link: '/demo/' },
      { text: '功能截图', link: '/demo/screenshots' }
    ]
  }
]

const guideSidebar = [
  {
    text: '开始之前',
    items: [
      { text: '使用指南', link: '/guide/' },
      { text: '快速开始', link: '/guide/getting-started' },
      { text: '核心概念', link: '/guide/concepts' }
    ]
  },
  {
    text: '出题与组卷',
    items: [
      { text: '题库与试题', link: '/guide/question-bank' },
      { text: '试卷与组卷', link: '/guide/paper' }
    ]
  },
  {
    text: '考试全流程',
    items: [
      { text: '发布考试', link: '/guide/exam' },
      { text: '在线监考与防作弊', link: '/guide/proctoring' },
      { text: '阅卷与成绩', link: '/guide/grading' },
      { text: '成绩与学情分析', link: '/guide/analytics' },
      { text: '证书管理', link: '/guide/certificate' },
      { text: '错题本', link: '/guide/wrong-book' }
    ]
  },
  {
    text: 'AI 能力',
    collapsed: false,
    items: [
      { text: 'AI 功能总览', link: '/guide/ai-overview' },
      { text: 'AI 出题与质检', link: '/guide/ai-question' },
      { text: 'AI 阅卷', link: '/guide/ai-grading' },
      { text: 'AI 学情与推题', link: '/guide/ai-learning' }
    ]
  },
  {
    text: '管理与运维',
    items: [
      { text: '用户与角色权限', link: '/guide/users-roles' },
      { text: '系统设置', link: '/guide/settings' }
    ]
  }
]

const backendSidebar = [
  {
    text: '概览',
    items: [
      { text: '后端文档', link: '/backend/' },
      { text: '服务清单与端口', link: '/backend/services' }
    ]
  },
  {
    text: '快速开始',
    collapsed: false,
    items: [
      { text: '环境准备', link: '/backend/quickstart/requirements' },
      { text: '中间件部署', link: '/backend/quickstart/middleware' },
      { text: '数据库初始化', link: '/backend/quickstart/database' },
      { text: 'Nacos 配置导入', link: '/backend/quickstart/nacos-config' },
      { text: '项目初始化', link: '/backend/quickstart/init' },
      { text: '打包与部署', link: '/backend/quickstart/deploy' },
      { text: 'IDEA 环境配置', link: '/backend/quickstart/idea_environment' },
      { text: '工作流初始化', link: '/backend/quickstart/worker_init' },
      { text: 'SnailJob 调度中心', link: '/backend/quickstart/snail_job_init' }
    ]
  },
  {
    text: '考试业务',
    collapsed: false,
    items: [
      { text: '考试微服务总览', link: '/backend/exam/overview' },
      { text: '服务间调用', link: '/backend/exam/invocation' }
    ]
  },
  {
    text: 'AI 能力',
    collapsed: false,
    items: [
      { text: 'AI 能力总览', link: '/backend/ai/' },
      { text: 'AI 服务部署与配置', link: '/backend/ai/quickstart' },
      { text: 'Skill 技能详解', link: '/backend/ai/skills' },
      { text: 'Tool 工具与护栏', link: '/backend/ai/tools' },
      { text: '模型网关', link: '/backend/ai/model-gateway' },
      { text: '对话式 Agent', link: '/backend/ai/chat' },
      { text: '提示词体系', link: '/backend/ai/prompts' },
      { text: 'Agent 接口清单', link: '/backend/ai/api' }
    ]
  },
  {
    text: '项目结构',
    collapsed: false,
    items: [
      { text: '项目结构', link: '/backend/framework/tree' },
      { text: '软件架构图', link: '/backend/framework/architecture_diagram' }
    ]
  },
  {
    text: '框架能力',
    collapsed: true,
    items: [
      { text: '创建新服务', link: '/backend/framework/association/new_module' },
      { text: '修改包名', link: '/backend/framework/association/update_package_name' },
      { text: '修改应用路径', link: '/backend/framework/association/update_url' },
      { text: '接口文档', link: '/backend/framework/association/doc' },
      { text: '国际化', link: '/backend/framework/association/i18n' },
      { text: '多团队开发', link: '/backend/framework/association/collaboration' },
      { text: '内网鉴权', link: '/backend/framework/association/inner_authentication' }
    ]
  },
  {
    text: '基础功能',
    collapsed: true,
    items: [
      { text: '数据库表设计', link: '/backend/framework/basic/database' },
      { text: '系统用户相关', link: '/backend/framework/basic/user' },
      { text: '权限控制', link: '/backend/framework/basic/permissions_control' },
      { text: '数据权限', link: '/backend/framework/basic/permissions' },
      { text: '网关路由与放行', link: '/backend/framework/basic/router_release' },
      { text: '多租户功能', link: '/backend/framework/basic/tenant' },
      { text: '分页功能', link: '/backend/framework/basic/page' },
      { text: '参数校验', link: '/backend/framework/basic/param_check' },
      { text: '代码生成', link: '/backend/framework/basic/code_generate' },
      { text: '导出功能', link: '/backend/framework/basic/export' },
      { text: '导入功能', link: '/backend/framework/basic/import' },
      { text: 'OSS 功能', link: '/backend/framework/basic/oss' },
      { text: '第三方授权功能', link: '/backend/framework/basic/social' },
      { text: '客户端管理功能', link: '/backend/framework/basic/client' }
    ]
  },
  {
    text: '扩展功能',
    collapsed: true,
    items: [
      { text: '多数据源', link: '/backend/framework/extend/dynamic_datasource' },
      { text: '缓存使用', link: '/backend/framework/extend/cache' },
      { text: '数据脱敏', link: '/backend/framework/extend/sensitive' },
      { text: '数据加解密', link: '/backend/framework/extend/encrypt' },
      { text: 'API 加解密', link: '/backend/framework/extend/api_encrypt' },
      { text: '防重幂等', link: '/backend/framework/extend/idempotent' },
      { text: '翻译功能', link: '/backend/framework/extend/translation' },
      { text: '短信模块', link: '/backend/framework/extend/sms' },
      { text: '邮件功能', link: '/backend/framework/extend/mail' },
      { text: 'WebSocket 功能', link: '/backend/framework/extend/websocket' },
      { text: 'SSE 推送', link: '/backend/framework/extend/sse' }
    ]
  },
  {
    text: '设计说明',
    collapsed: true,
    items: [
      { text: '事务相关', link: '/backend/framework/explain/transaction' },
      { text: '单元测试', link: '/backend/framework/explain/test' },
      { text: '主键使用说明', link: '/backend/framework/explain/key' },
      { text: '关于多表查询', link: '/backend/framework/explain/about_join' }
    ]
  },
  {
    text: '中间件搭建',
    collapsed: true,
    items: [
      { text: 'Nacos 集群搭建', link: '/backend/extend-function/nacos' },
      { text: 'Prometheus + Grafana', link: '/backend/extend-function/prometheus_grafana' },
      { text: 'SkyWalking 链路追踪', link: '/backend/extend-function/skywalking' },
      { text: 'ELK 日志中心', link: '/backend/extend-function/elk' },
      { text: 'ES 搜索引擎', link: '/backend/extend-function/es' },
      { text: 'RabbitMQ 搭建', link: '/backend/extend-function/rabbitmq' },
      { text: 'RocketMQ 搭建', link: '/backend/extend-function/rocketmq' },
      { text: 'Kafka 搭建', link: '/backend/extend-function/kafka' },
      { text: 'Sharding-Proxy 分库分表', link: '/backend/extend-function/shardingproxy' },
      { text: '对接 MaxKey 单点登录', link: '/backend/extend-function/maxkey' }
    ]
  }
]

const frontendSidebar = [
  {
    text: '概览',
    items: [{ text: '前端文档', link: '/frontend/' }]
  },
  {
    text: '开发文档',
    collapsed: false,
    items: [
      { text: '开发规范', link: '/frontend/dev_norm' },
      { text: '通用方法', link: '/frontend/common_func' },
      { text: '请求流程', link: '/frontend/request_process' },
      { text: '路由使用', link: '/frontend/router_use' },
      { text: '组件使用', link: '/frontend/component_use' },
      { text: '组件文档', link: '/frontend/component_doc' },
      { text: '权限使用', link: '/frontend/permissions_use' },
      { text: '页签缓存', link: '/frontend/page_cache' },
      { text: '使用图标', link: '/frontend/icon_use' },
      { text: '使用字典', link: '/frontend/dict_use' },
      { text: '使用参数', link: '/frontend/param_use' },
      { text: '异常处理', link: '/frontend/exception_handling' },
      { text: '内容复制', link: '/frontend/content_copy' }
    ]
  },
  {
    text: '考试业务',
    collapsed: false,
    items: [{ text: '防作弊与答题端', link: '/frontend/proctor' }]
  }
]

const apiSidebar = [
  {
    text: '概览',
    items: [{ text: 'API 概览', link: '/api/' }]
  },
  {
    text: '接口清单',
    items: [
      { text: '考生端接口', link: '/api/exam' },
      { text: '管理端接口', link: '/api/admin' },
      { text: 'AI 接口', link: '/api/ai' }
    ]
  }
]

const questionsSidebar = [
  {
    text: '概览',
    items: [{ text: '常见问题', link: '/questions/' }]
  },
  {
    text: '部署运维',
    collapsed: false,
    items: [
      { text: '无法读取 Nacos 配置', link: '/questions/nacos_read_fail' },
      { text: 'Nacos Raft Group 报错', link: '/questions/nacos_naming_instance_metadata' },
      { text: '打包 jar 运行报错', link: '/questions/jar_run_fail' },
      { text: '登录调试步骤', link: '/questions/login_step' },
      { text: '放行接口提示认证失败', link: '/questions/identify_fail' },
      { text: '不支持 ST 请求', link: '/questions/st_not_support' },
      { text: '关于 HTTPS 配置', link: '/questions/https_config' },
      { text: 'Redis 报错 Permission denied', link: '/questions/permission_denied' },
      { text: 'JCE cannot authenticate the provider BC', link: '/questions/jce_cannot' },
      { text: '如何同步项目更新', link: '/questions/synchronous_update' }
    ]
  },
  {
    text: '框架与接口',
    collapsed: false,
    items: [
      { text: '请求响应参数解密', link: '/questions/api_encrypt' },
      { text: 'Only one connection receive subscriber', link: '/questions/only_one_subscriber' },
      { text: '如何指定 Dubbo 注册 IP', link: '/questions/dubbo_ip' },
      { text: '为什么删除 Sentinel', link: '/questions/sentinel_404' },
      { text: '接口文档对接 knife4j', link: '/questions/kinfe4j' },
      { text: 'Swagger 相关问题', link: '/questions/swagger' },
      { text: '如何对接国产数据库', link: '/questions/domestic_databases' },
      { text: '如何使用 Druid 连接池', link: '/questions/use_druid' },
      { text: 'ParseException SQL 解析异常', link: '/questions/parse_exception' }
    ]
  },
  {
    text: '开发踩坑',
    collapsed: false,
    items: [
      { text: 'unable to read meta-data for class', link: '/questions/read_metadata' },
      { text: '实体 bean 为空', link: '/questions/bean_null' },
      { text: '导入 Excel 实体类为空', link: '/questions/import_excel' },
      { text: 'Lombok 注解爆红', link: '/questions/lombok' }
    ]
  }
]

export default defineConfig({
  title: '砚考',
  description: '砚考 — 面向高校、政企与培训机构的在线考试与题库管理平台',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  // README.md 与 scripts 说明不属于文档正文，不参与构建
  srcExclude: ['README.md', 'scripts/**', '**/*.json'],
  head: [
    ['meta', { name: 'theme-color', content: '#2e6b63' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: '砚考 · 在线考试系统' }],
    ['meta', { property: 'og:description', content: '砚考 — 面向高校、政企与培训机构的在线考试与题库管理平台' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '未找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    },

    nav: [
      { text: '产品介绍', link: '/intro/', activeMatch: '/intro/' },
      { text: '使用指南', link: '/guide/', activeMatch: '/guide/' },
      { text: '后端文档', link: '/backend/', activeMatch: '/backend/' },
      { text: '前端文档', link: '/frontend/', activeMatch: '/frontend/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: '常见问题', link: '/questions/', activeMatch: '/questions/' },
      { text: '演示系统', link: '/demo/', activeMatch: '/demo/' }
    ],

    sidebar: {
      '/intro/': introSidebar,
      '/demo/': introSidebar,
      '/guide/': guideSidebar,
      '/backend/': backendSidebar,
      '/frontend/': frontendSidebar,
      '/api/': apiSidebar,
      '/questions/': questionsSidebar
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/Alanosy/exam-platform' }],

    footer: {
      message: '砚考 · 让每一次考试都经得起检验',
      copyright: 'Copyright © 2026 砚考团队'
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    lastUpdatedText: '最后更新于'
  }
})
