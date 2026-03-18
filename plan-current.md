# 开发者计划（答辩冲刺版）

> 目标：演示炫，能跑，好看。不考虑安全/性能/工程化。

---

## 现状速查：什么是真实功能，什么是空架子

### ✅ 真实可用
- 首页视频瀑布流 + 无限滚动
- 首页→播放页 GSAP 缩略图展开过渡动画
- HLS 播放器（vidstack）+ 双击快进/暂停 GSAP 图标反馈
- 评论 & 回复 CRUD、排序（最新/最热）、评论点赞
- Studio 视频表格 + 播放列表表格 + 完整 CRUD
- 转码任务列表、时间线、重试、取消
- 上传流程（单文件 multipart）
- 播放页侧边播放列表面板
- 用户设置（主题切换）
- 登录 / 注册

### ❌ 空架子 / 注释掉的代码
| 位置 | 问题 |
|------|------|
| `video-action-buttons.tsx` | `putVideoReaction` 整个被注释掉，点赞是假的纯本地 state |
| `get-video-info.ts` L66 | `prevReaction` 硬编码 `undefined`，刷新后点赞状态丢失 |
| `app/studio/stat/page.tsx` | 就一行 `<h1>Stat Page</h1>` |
| `app/studio/dashboard/page.tsx` | 数据全是硬编码 0，没连任何数据库 |
| Navbar 搜索框 | 纯摆设，无任何逻辑 |
| 订阅按钮 | `<Button>订阅</Button>`，无 action |
| 分享 / 添加到 按钮 | 无任何逻辑 |
| 频道主页 | 路由不存在，`Channel` 模型完善但零前端 |
| 历史记录 | `VideoPlaybackEvent` 表存在，无页面，播放时也没写入事件 |
| `VideoDailyStat` / `ChannelDailyStat` | 表存在，没有 actions，没有页面 |

---

## 填坑清单（按演示价值排序）

### P0 — 必须修：功能性破损，会被问到

#### 1. 视频点赞真实落库
- **文件**：`video-action-buttons.tsx`、`get-video-info.ts`
- **做什么**：
  1. 写 `actions/video/put-video-reaction.ts`（`upsert` VideoReaction + `increment/decrement` likesCount）
  2. 取消注释调用，传入真实 videoId
  3. `get-video-info.ts` 查询当前用户的 reaction 并返回

#### 2. 订阅按钮真实落库
- **文件**：`components/player/video-info.tsx`
- **做什么**：
  1. 写 `actions/channel/toggle-subscribe.ts`（`upsert` Subscription + `increment` subscribersCount）
  2. 从 server 拿 `isSubscribed` 初始状态，按钮 optimistic update

---

### P1 — 高演示价值，后端全好了，只差前端

#### 3. 频道主页 `/channel/[name]`
- **后端状态**：`Channel`、`Subscription`、`Video` 全部 ready
- **做什么**（新建 `app/channel/[name]/page.tsx`）：
  - Banner 图 + 频道名 + 订阅人数 + 订阅按钮
  - 视频列表 grid（复用 VideoCard）
  - 可选：简介 tab + 播放列表 tab
- **点击路径**：Watch 页频道名点击 → 跳转频道页，这个路由要加

#### 4. 数据分析页 `studio/stat`
- **后端状态**：`VideoDailyStat`、`ChannelDailyStat` 表存在，需要写查询 action
- **做什么**：
  1. 写 `actions/stat/get-channel-stats.ts`（查近 30 天 ChannelDailyStat 汇总）
  2. 写 `actions/stat/get-video-stats.ts`（单视频的 DailyStat）
  3. 前端用 **ECharts**（`echarts-for-react`）画：
     - 折线图：观看量趋势（30天）
     - 柱状图：各视频播放量对比
     - 饼图：点赞/不喜欢比例（随便凑）
- **注意**：如果 seed 数据里 DailyStat 是空的，用 `scripts/db/` 写一个 seed 脚本硬插几条假数据，演示用

#### 5. Studio Dashboard 接真数据
- **文件**：`app/studio/dashboard/page.tsx`
- **做什么**：
  - 真实订阅人数（从 Channel 查）
  - 近7天总观看数（从 VideoDailyStat 汇总）
  - 最近发布的 3 个视频 + 各自观看量

---

### P2 — 加分项，有空就做

#### 6. 播放历史写入 + 历史页面
- **写入**：在 `video-player.tsx` 的 `onPlay` / `onEnded` 回调里调 server action 写 `VideoPlaybackEvent`（type = PLAY_START / ENDED）
- **页面**：新建 `app/history/page.tsx`，按时间倒序展示看过的视频（join VideoPlaybackEvent → Video），复用 VideoCard

#### 7. 评论内时间戳点击跳转
- **文件**：`comment-content.tsx`（现在直接渲染纯文本）
- **做什么**：
  - 正则匹配 `HH:MM:SS` 或 `MM:SS` 格式
  - 渲染成 `<button>` 样式的蓝色文本
  - 点击时通过 context / 全局 event 控制 vidstack player seek

#### 8. 搜索功能
- **做什么**：Navbar 搜索框加 `onKeyDown Enter` → `router.push('/search?q=xxx')`，新建 `app/search/page.tsx`，`ILIKE %q%` 查 video.title，复用 VideoGallery 布局

---

## 演示动线建议（答辩用）

```
首页（瀑布流+动画过渡）
  → 点击视频（展开过渡动画）
    → 播放页（HLS 播放 + 控制栏）
      → 点赞 / 订阅（真实写入）
      → 评论（发评论+回复）
      → 点频道名 → 频道主页
  → 登录 Studio
    → 内容管理（视频表格 CRUD + 任务时间线展开）
    → 上传视频（演示转码流水线）
    → 数据分析（ECharts 图表）
```

---

## 技术栈备忘（答辩装逼用）

- **转码链路**：S3 multipart upload → SQS 触发 → Docker 容器（FFmpeg）→ 输出 HLS 分片 + 多码率 → S3
- **LocalStack**：本地模拟 S3 + SQS + Lambda，零云费用开发
- **HLS 自适应码率**：vidstack 根据网速自动切画质
- **GSAP**：缩略图 → 播放页的 hero 展开过渡，播放/暂停图标反馈，Studio 表格切换淡入
- **Next.js Server Actions**：替代传统 REST API，类型安全的全栈调用

---

## 本轮完成情况（2026-03-17）

### 已完成
- **视频点赞真实落库**
  - 新增 `actions/video/put-video-reaction.ts`
  - `watch` 页点赞 / 点踩按钮已接通真实数据库写入
  - `get-video-info.ts` 已返回当前用户 `prevReaction`，刷新后状态可恢复
  - 计数器依赖现有 `prisma/triggers.core.sql` 触发器维护，避免前后端双重加减

- **订阅按钮真实落库**
  - 新增 `actions/channel/toggle-subscribe.ts`
  - 播放页频道信息区已接通真实订阅状态查询和切换
  - 支持 optimistic update，订阅人数会随按钮状态即时变化
  - 频道主本人看到的是“我的频道”状态，不会误触发订阅自己

- **收藏 / 添加到 按钮补齐后端能力**
  - 新增 `actions/playlist/toggle-video-save.ts`
  - 复用现有 `Playlist / PlaylistItem`，将播放器里的“添加到”实现为快捷收藏
  - 默认落到系统私有播放列表：`稍后再看`
  - `get-video-info.ts` 已返回当前用户是否已收藏，刷新后状态可恢复
  - 现有 Studio 播放列表管理能力可继续管理这些内容

- **分享按钮补齐可用逻辑**
  - 现已支持复制当前视频链接到剪贴板

- **Studio Dashboard 接真数据**
  - 新增 `actions/studio/get-dashboard-summary.ts`
  - `studio/dashboard` 不再显示硬编码 0
  - 已接入真实订阅人数、近 7 天观看次数、频道视频数、最近发布视频列表

- **Studio Stat 后端查询补齐**
  - 新增 `actions/stat/get-channel-stats.ts`
  - 新增 `actions/stat/get-video-stats.ts`
  - `studio/stat` 已从占位页改为真实数据页
  - 当前先用现有 Card/Table 展示 `ChannelDailyStat` / `VideoDailyStat` 聚合结果，后续可无缝替换成图表

- **播放历史写入 + 历史页面**
  - 新增 `actions/video/record-playback-event.ts`
  - 播放器 `PLAY_START / ENDED` 已写入 `VideoPlaybackEvent`
  - 新增 `/history` 页面，按最近观看时间倒序展示历史记录

- **搜索功能**
  - 新增 `actions/video/search-videos.ts`
  - Navbar 搜索框已支持回车 / 点击搜索
  - 新增 `/search?q=xxx` 页面，复用现有视频卡片布局展示结果

### 本轮实现策略说明
- **不新造 Favorite 表**
  - 当前 schema 已有完整播放列表体系，因此收藏能力直接复用 Playlist，减少 schema 变动和答辩时解释成本

- **统计页先做“后端真数据 + 基础展示”**
  - 按你的要求，先不做新的 UI/UX 设计
  - 因此没有上 ECharts，而是把查询 action 和可用页面先落好

### 验证情况
- 已通过：`bunx tsc --noEmit`
- 未能依赖 ESLint 作为最终校验：仓库当前 ESLint 配置在本地会报 `react/display-name` 加载异常，属于现有配置问题，不是本轮改动单独引起

---

## 新的 TODO（保留给后续）

### 暂缓：需要新页面设计 / 纯前端 UIUX
- **频道主页 `/channel/[name]`**
  - 后端模型已经够用，但这是一个新页面，涉及 Banner、Tab、频道布局设计
  - 先暂缓

- **Watch 页点击频道名跳转到频道主页**
  - 依赖频道主页路由完成后再接

- **统计页图表化（ECharts）**
  - 目前后端查询已就绪
  - 后续只需要把现有表格替换为折线图 / 柱状图 / 饼图即可

### 暂缓：交互改造量较大
- **评论内时间戳点击跳转**
  - 需要额外设计评论文本解析、播放器 seek 通信方式、点击态样式
  - 当前评论系统 CRUD / 点赞已可用，此项先保留

- **“添加到”高级版弹窗**
  - 现在已实现快捷收藏到系统播放列表 `稍后再看`
  - 如果后续要支持“选择任意播放列表 / 新建播放列表后立即加入”，建议再做一个播放器侧弹窗 UI

### 可选补强
- **历史记录扩展为更细粒度行为**
  - 当前已写入 `PLAY_START / ENDED`
  - 后续可继续扩展 `PAUSE / SEEK / PROGRESS`，用于更细的观看分析
