---
title: 防作弊与答题端
description: 砚考答题页实现、13 类防作弊行为监听、摄像头抓拍与服务端判分逻辑
---

# 防作弊与答题端

这是砚考前端最特殊的一块，plus-ui 原版完全没有对应内容。

## 设计原则

`src/hooks/useProctor.ts` 文件头写得很清楚：

> 只管「把可疑动作报上去」，**计数 / 风险分级 / 是否强制交卷全部后端算**；
> 任何环节出错都静默降级，绝不影响答题。

::: tip 为什么判定放在服务端
放在前端算，等于告诉考生「改 JS 就能绕过」。
放服务端算，前端纯粹是个传感器——即便被禁用，最多是不记 Operator，而不会让考生获得额外权限。
:::

## 监听的 13 类行为

| 行为 | 触发源 | 上报 eventType |
| --- | --- | --- |
| 切屏 / 离屏 | `visibilitychange` + `blur`/`focus` + 3 秒定时兜底 | `switch_screen` |
| 复制 | `copy`（capture 阶段） | `copy` |
| 剪切 | `cut` | `cut` |
| 粘贴 | `paste` | `paste` |
| 右键菜单 | `contextmenu` | `contextmenu` |
| 开发者工具 | `keydown` 组合键 + 窗口尺寸差 > 160px 二次判断 | `devtool` |
| 多标签页 | `BroadcastChannel('proctor_{recordId}')` ping/pong | `multitab` |
| 进入全屏 | `fullscreenchange` | `enter_fullscreen` |
| 退出全屏 | `fullscreenchange` + 3 秒定时兜底 | `exit_fullscreen` |
| 摄像头拒绝授权 | `getUserMedia` 失败 | （计入异常） |
| 摄像头抓拍 | 定时/事件触发 | `periodic` / `enter` / `switch_screen` |
| 心跳 | 30 秒定时 | — |
| 交卷完成 | 页面卸载 / 主动 | `finish` |

## 切屏判定：远比想象中复杂

很多人以为监听 `visibilitychange` 就够了。实际上：

::: warning 切到微信/钉钉不会触发 visibilitychange
切到其它**应用窗口**（而非浏览器标签页）时，`document.hidden` 仍然是 `false`，只会来一个 `blur`。
只用 visibilitychange 会漏掉最典型的作弊场景。
:::

砚考的做法是**焦点状态机** `syncFocus(reason, onBack)`：

1. **状态一律现读**：`document.hasFocus() && !document.hidden`，事件只决定「什么时候读」
2. **两层去重**：
   - `awayCounted` 标志——同一段离屏只记一次，人没回来不解锁
   - 1.5 秒节流，避免连续事件重复计数
3. **延迟复读**：Chrome 在 `blur` 事件回调里 `hasFocus()` 常常还是 `true`，
   所以在 `[0, 300, 1200]` ms 三个时间点各读一次

```ts
// 核心逻辑简化示意
const checkAway = () => {
  const away = !(document.hasFocus() && !document.hidden)
  if (away && !awayCounted) {
    awayCounted = true
    report('switch_screen')
  } else if (!away) {
    awayCounted = false
  }
}
blurEvents.forEach(delay => setTimeout(checkAway, delay))
```

## 摄像头抓拍

```ts
await navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480 },
  audio: false
})
```

| 环节 | 处理 |
| --- | --- |
| 画布 | canvas 宽 320，按真实比例缩放 |
| 格式 | `canvas.toBlob(..., 'image/jpeg', 0.7)` |
| 黑帧检测 | `isBlankFrame()` 隔点采样，平均亮度 < 6 直接丢弃 |
| 等 DOM | `waitVideo(10s)`：模板 `v-if` 导致开考瞬间 `<video>` 还没渲染 |
| 等画面 | `waitFrame(8s)`：等 `readyState >= 2`，否则拍出来是全黑 |
| 保活 | `keepCameraAlive()` 每 3 秒检查，`track.readyState === 'ended'` 时如实提示 |
| 重试 | `retryAttach(rounds=15)`，后台每 2 秒重试挂流 |

**抓拍时机**：入场 `enter`、周期 `periodic`（`max(15, cameraInterval)` 秒）、离屏 `switch_screen`、回来 `resume`。

## 上报与心跳

```ts
// 批量上报
queue.length >= 5  →  flush()
每 5 秒           →  flush()

// 心跳 30 秒一次
proctorHeartbeat(sessionId)  →  顺带返回服务端真实计数 syncCounts()
```

::: tip 为什么要同步计数
考生刷新页面后，本地计数会归零，界面显示「切屏 0 次」会让他以为可以继续切。
心跳把服务端的真实计数带回来，保证「我还能切几次」这个提示始终准确。
:::

## 答题页集成

`views/exam/answer/index.vue`：

```ts
const {
  sessionId, rule, switchCount, pasteCount,
  exitFullscreenCount, cameraCount,
  cameraOpen, cameraReady, cameraError,
  videoRef, start: startProctorWatch, stop: stopProctorWatch,
  enterFullscreen
} = useProctor({
  recordId: recordId.value,
  onExceed: (reason) => {
    ElMessage.error(reason)
    void autoFinish()          // 违规达上限 → 服务端判定强制交卷
  },
  onWarn: (msg) => ElMessage.warning(msg)
})
```

模板里监考卡片会实时展示 `switchCount / pasteCount / exitFullscreenCount / cameraCount`，对考生**透明公开**。

## 服务端时钟校准

防止考生改本机系统时间「延长」考试时间。

`src/hooks/useServerClock.ts`：

| 函数 | 作用 |
| --- | --- |
| `useServerClock()` | 返回 `{ serverNow, serverOffset, syncServerTime }` |
| `toTs(value)` | 把后端 `yyyy-MM-dd HH:mm:ss` 按**本地时区**解析（不是 UTC） |
| `formatCountdown(millis)` | 超过一天时带天数 |
| `syncServerTime(serverTime, sentAt)` | 扣掉一半网络往返估算真实偏移 |

偏移值缓存在 `sessionStorage['exam-server-offset']`，`MIN_OFFSET_DELTA = 1000` 避免抖动反复写入。

使用位置：`views/exam/center`、`views/exam/brief`（入场窗口 `latestEntryTime` 判定）。

## 答题页其它要点

| 主题 | 实现 |
| --- | --- |
| 骨架屏 | `loading` 初始值**必须**为 `true`，否则 `onMounted` 前渲染会报 `Cannot read properties of undefined` |
| 作答存储 | `answers: Record<questionId, JSON字符串>`、`flagged: Set<string>`（待复查） |
| 代码题 | 用**纯文本 textarea**，不用富文本——富文本会破坏缩进 |
| 富文本空值 | `richHasContent()`：quill 空值是 `<p><br></p>`，还要单独查 `img/video/audio/iframe` |
| 倒计时 | `remaining` 存秒，`clockText` 按 `h>0 ? hh:mm:ss : mm:ss` 格式化 |
| 成绩页 | `/exam/result/:recordId` 与答题页复用同一组件，name 为 `ExamResult` |
| 自动保存 | 逐题自动保存，支持断点续答 |

## 答案 JSON 契约

`src/utils/questionMeta.ts` 定义了题型与答案模式：

| 题型 | answerMode | 有选项 | 默认选项数 |
| --- | --- | --- | :---: |
| `SINGLE` 单选 | `option` | ✅ | 4 |
| `MULTIPLE` 多选 | `option` | ✅ | 4 |
| `JUDGE` 判断 | `option` | ✅（固定正确/错误） | 2 |
| `BLANK` 填空 | `blank` | ❌ | 1 |
| `SHORT_ANSWER` 简答 | `text` | ❌ | 0 |
| `ESSAY` 论述 | `text` | ❌ | 0 |
| `CODE` 代码 | `code` | ❌ | 0 |
| `UPLOAD_FILE` 文件上传 | `text` | ❌ | 0 |
| `MATCH` 匹配 | `pairs` | ❌ | 3 |

参考答案 JSON：

```jsonc
// option
{ "rightKeys": ["A", "C"] }

// blank（多空 × 多写法）
{ "blanks": [{ "answers": ["张三"] }, { "answers": ["Beijing", "北京"] }] }

// text
{ "answer": "<p>富文本</p>" }

// code
{ "language": "java", "answer": "...", "remark": "..." }

// pairs
{ "pairs": [{ "left": "CPU", "right": "中央处理器" }] }
```

::: tip 两套字段都认
参考答案用 `rightKeys / answers / answer`，考生作答用 `choices / text / blanks[].text`。
`utils/answer.ts` 的 `formatAnswer` **两种都接受**，即便传反了也不会把 JSON 原文贴到页面上。
:::

## 调试建议

排查防作弊不生效时：

1. 确认考试配置里真的开启了对应规则（默认多数规则是「只记录、不强制」）
2. 从【监考中心】看事件流水有没有进来 → 有，说明采集正常，是判定问题
3. 完全没有事件 → 检查 `startProctor` 是否拿到 `sessionId`
4. 摄像头打不开 → 检查 HTTPS（**浏览器在非 localhost 下要求 HTTPS 才给摄像头权限**）

::: warning 摄像头需要 HTTPS
生产环境必须是 HTTPS，否则 `navigator.mediaDevices` 直接不可用。
本地 `localhost` 是白名单，所以开发环境看不出问题。
:::

## 相关

- 服务端防作弊服务：[考试微服务总览 — proctor](/backend/exam/overview#防作弊服务-ruoyi-exam-proctor-9219)
- 管理员视角怎么配置：[在线监考与防作弊](/guide/proctoring)
