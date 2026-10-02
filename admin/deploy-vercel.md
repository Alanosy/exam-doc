# 部署到 Vercel

把砚考文档站托管到 Vercel，之后**每次推送到 GitHub 就自动发布**，无需手工操作。

::: tip 项目已自带配置
仓库根目录的 `vercel.json` 已经写好了全部构建参数。
你在 Vercel 控制台导入仓库时，多数情况下**一路点下一步即可**，无需手填。
:::

## 自动部署的效果

| 动作 | 触发的部署 | 访问地址 |
| --- | --- | --- |
| 推送到 `main` | 生产环境 | `https://exam-doc.vercel.app` |
| 发起 Pull Request | 预览环境 | `https://exam-doc-git-<分支>-<账号>.vercel.app` |
| 推送到其他分支 | 预览环境 | 同上，每个分支独立 |

预览环境让你在合并前就能看到文档的线上真实效果。

## 方式一：Vercel 控制台导入（推荐）

### 1. 导入仓库

1. 打开 [vercel.com](https://vercel.com) 并用 GitHub 账号登录
2. 点击 **Add New → Project**
3. 在列表中找到 `Alanosy/exam-doc`，点 **Import**

如果列表里没有，先在 GitHub 授权页面授予 Vercel 访问该仓库的权限。

### 2. 确认构建设置

Vercel 会读取根目录的 `vercel.json`，展开 **Build & Output Settings** 核对一遍：

| 设置项 | 值 |
| --- | --- |
| Framework Preset | VitePress |
| Build Command | `npm run docs:build` |
| Output Directory | `.vitepress/dist` |
| Install Command | `npm install` |
| Root Directory | `./`（保持仓库根目录，不要改） |

::: warning Output Directory 是最容易填错的一项
Vercel 默认是 `dist`，但 VitePress 实际输出到 **`.vitepress/dist`**（注意开头的点）。
填错的表现是：首页能打开，其他页面全部 404。
:::

### 3. 指定 Node 版本

VitePress 1.x 需要 Node 18 以上。进入 **Settings → General → Node.js Version**，选 **22.x**。

项目已在 `package.json` 中声明 `"engines": { "node": ">=20" }`，Vercel 会尊重这个声明；
若控制台仍显示 18.x，手动改成 22.x。

### 4. 部署

点击 **Deploy**，等待约 1 分钟。完成后会拿到一个 `*.vercel.app` 域名。

## 方式二：Vercel CLI

适合想在命令行里先验证一遍的场景。

```bash
# 安装并登录
npm i -g vercel
vercel login

# 本地跑一次和线上完全一致的构建（产物在 .vercel/output）
vercel build

# 部署到预览环境
vercel deploy

# 部署到生产环境
vercel deploy --prod
```

`vercel build` 很有用 —— 它用的是 Vercel 线上的构建环境和配置，
能提前暴露「本地能过、线上挂了」的问题。

## 配置文件说明

根目录的 `vercel.json`：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vitepress",
  "buildCommand": "npm run docs:build",
  "outputDirectory": ".vitepress/dist",
  "installCommand": "npm install",
  "cleanUrls": true,
  "trailingSlash": false
}
```

| 字段 | 作用 |
| --- | --- |
| `framework` | 声明为 VitePress，Vercel 套用对应预设 |
| `buildCommand` | 执行 `npm run docs:build`（即 `vitepress build`） |
| `outputDirectory` | 静态产物目录，必须是 `.vitepress/dist` |
| `installCommand` | 依赖安装命令 |
| `cleanUrls` | **关键**。去掉 URL 里的 `.html` 后缀 |
| `trailingSlash` | 不强制目录末尾斜杠，与 `cleanUrls` 配合保持 URL 统一 |

::: warning 为什么 `cleanUrls` 是必需的
VitePress（配合 `config.mts` 中的 `cleanUrls: true`）生成的产物是
`guide/getting-started.html` 这种文件，但页面内的链接写作 `/guide/getting-started`。

没有服务端配合时访问 `/guide/getting-started` 会直接 404。
Vercel 的 `cleanUrls: true` 正是补齐这一环。
:::

## 自定义域名

**Settings → Domains → Add**，然后按提示加一条 DNS 记录：

| 记录类型 | 主机记录 | 值 |
| --- | --- | --- |
| CNAME | `docs` | `cname.vercel-dns.com` |

Vercel 会自动签发并续期 HTTPS 证书。

若域名在国内使用，注意 `*.vercel.app` 及 Vercel 的部分 IP 在国内访问不稳定，
建议绑定自有域名并配合国内 CDN，或改用境内托管。

## 环境变量

当前文档站是纯静态站点，**不需要任何环境变量**。
后续若接入评论、搜索服务等，在 **Settings → Environment Variables** 中添加，
并注意区分 Production / Preview / Development 三个环境。

## 部署后验收清单

- [ ] 首页正常打开，样式与本地一致
- [ ] 点开侧边栏每个页面，确认无 404
- [ ] 直接访问 `/guide/proctoring` 这类带路径的地址，确认能打开（验证 cleanUrls）
- [ ] 顶部搜索框能搜到中文内容
- [ ] 浏览器无控制台报错，静态资源（logo、样式）正常加载
- [ ] PR 里能看到 Vercel 生成的预览链接

## 常见问题

**首页能开，其他页面全 404**
Output Directory 填成了 `dist`。改成 `.vitepress/dist`。

**页面能开但样式全丢**
一般不是 Vercel 的问题，检查 `config.mts` 里的 `base`。部署在根域名时 `base` 应为 `/` 或不设置。

**本地 build 成功，Vercel build 失败**
多半是 Node 版本过低。到 Settings 里把 Node.js Version 改成 22.x 后重新部署。

**改了 vercel.json 没生效**
`vercel.json` 的改动需要**重新触发一次部署**才会应用。
在 Deployments 页面点最新一条的 Redeploy。

**想让某个推送不触发部署**
在 commit message 里加 `[skip deploy]` 即可跳过。

**构建超时**
VitePress 首次安装依赖较慢（本项目约 125 个包）。
免费版构建超时上限 45 分钟，正常不会触碰；若卡住，到 Deployments 页面取消后重试。

## 与其他平台对比

| 平台 | 优点 | 注意 |
| --- | --- | --- |
| **Vercel** | 零配置、PR 预览、全球 CDN | 国内直连不稳定 |
| GitHub Pages | 免费、与仓库天然集成 | 需自行写 Actions，无 PR 预览 |
| Netlify | 同样零配置 | 国内访问同样一般 |
| [自有服务器](/admin/deployment) | 完全可控、数据在内网 | 需自行维护 Nginx 与证书 |

本站是纯静态内容，切换平台的成本很低 —— 构建产物 `.vitepress/dist` 放到任何静态托管上都能跑。
