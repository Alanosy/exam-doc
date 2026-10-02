import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '砚考',
  description: '砚考 — 面向高校、政企与培训机构的在线考试与题库管理平台',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  // README.md 与 package.json 说明不属于文档正文，不参与构建
  srcExclude: ['README.md', '**/*.json'],
  head: [
    ['meta', { name: 'theme-color', content: '#2e6b63' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: '砚考 · 在线考试系统' }],
    ['meta', { property: 'og:description', content: '砚考 — 面向高校、政企与培训机构的在线考试与题库管理平台' }]
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
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
      { text: '产品简介', link: '/guide/', activeMatch: '/guide/' },
      { text: '使用指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '管理与部署', link: '/admin/', activeMatch: '/admin/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: '常见问题', link: '/faq', activeMatch: '/faq' }
    ],

    sidebar: {
      '/': [
        {
          text: '开始使用',
          items: [
            { text: '产品简介', link: '/guide/' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '核心概念', link: '/guide/concepts' },
            { text: '更新日志', link: '/changelog' }
          ]
        },
        {
          text: '考试全流程',
          items: [
            { text: '题库管理', link: '/guide/question-bank' },
            { text: '试卷与组卷', link: '/guide/paper' },
            { text: '发布考试', link: '/guide/exam' },
            { text: '在线监考与防作弊', link: '/guide/proctoring' },
            { text: '阅卷与复核', link: '/guide/grading' },
            { text: '成绩与学情分析', link: '/guide/analytics' }
          ]
        },
        {
          text: '管理与部署',
          items: [
            { text: '组织与权限', link: '/admin/' },
            { text: '用户与角色', link: '/admin/users-roles' },
            { text: '系统设置', link: '/admin/settings' },
            { text: '私有化部署', link: '/admin/deployment' }
          ]
        },
        {
          text: '开发者',
          items: [
            { text: 'API 概览', link: '/api/' },
            { text: 'Webhook 与集成', link: '/api/webhook' }
          ]
        },
        {
          text: '帮助',
          items: [{ text: '常见问题', link: '/faq' }]
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/' }],

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
