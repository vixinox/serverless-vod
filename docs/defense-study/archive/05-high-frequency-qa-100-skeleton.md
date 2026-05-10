# 100 题高频问答策略稿

## 使用方式

这份文档不是让你逐字背诵，而是让你在答辩现场能把“不熟悉技术栈的老师”带到同一个理解层面。每题都按四句模板组织：

1. **先讲白话原理**：把陌生名词翻译成老师熟悉的软件工程概念。
2. **再讲项目选择**：为什么这个项目要这样做。
3. **补一句代码证据**：说明它不是空谈，能在项目中定位。
4. **最后说边界**：承认限制，给出下一步优化。

答辩时不要连续抛术语。比如 Serverless 不要只说“无服务器”，可以说“不是没有服务器，而是服务器运维和弹性伸缩由云平台托管”；HLS 不要只说“切片协议”，可以说“把一个大视频拆成清单加小片段，播放器边下边播”。

## A. 项目总览与价值（1-15）

### 1. 你的课题核心解决了什么问题？

核心解决的是中小规模视频点播系统中“上传、转码、存储、播放、互动、统计”一整条链路的工程落地问题。普通管理系统主要处理结构化数据，而视频系统还要处理大文件和异步媒体任务。我的方案用 Next.js 承载页面和业务接口，用 PostgreSQL 管业务数据，用对象存储和 Serverless 流水线处理视频文件。代码上可以从 `app/api/uploads/video-url/route.ts`、`lib/server/videos.ts`、`scripts/localstack/deploy-sfn.mjs` 看到从上传到状态机启动的链路。

### 2. 为什么要做视频点播平台而不是普通管理系统？

因为视频点播比普通 CRUD 系统更能体现综合工程能力：既有账号、评论、播放列表这类业务数据，也有文件上传、转码、HLS 切片、播放器和统计分析。老师可以理解为：普通管理系统主要考察“数据库表单”，视频平台还考察“异步任务和资源处理”。论文中第 3 章需求和第 5 章实现都围绕内容生产、内容消费、内容运营展开，而不是只做信息录入。

### 3. 为什么选 AWS Serverless 而不是传统集群？

视频转码任务具有明显波峰波谷，传统集群需要长期维护转码服务器，低峰浪费，高峰扩容复杂。Serverless 的价值是把转码拆成事件触发的函数任务，用 Step Functions 管顺序和失败分支。项目里状态机定义在 `scripts/localstack/deploy-sfn.mjs`，流程是 `ExtractMetadata -> Transcode -> Finalize`，任一步失败进入 `MarkFailed`。边界是：真正生产环境还要验证云上配额、冷启动、IAM 权限和成本。

### 4. 你的系统最核心创新点是什么？

核心创新点不是发明新算法，而是把视频网站的媒体处理链路做成可观测、可恢复的 Serverless 工作流。上传不经过应用服务器，转码由状态机编排，进度通过内部接口写回数据库，前端轮询展示。证据是 `getVideoUploadUrl()` 生成预签名地址，`createVideo()` 创建 `TranscodeJob` 并调用 `startTranscodeExecution()`，内部回调位于 `app/api/internal/vod/*/route.ts`。

### 5. 项目最有价值的落地场景是什么？

最适合中小团队、课程平台、企业培训、活动回看、校内资源平台等中小规模视频点播场景。这些场景不一定需要大型视频网站的全套分布式系统，但需要可靠上传、处理、播放和基础运营数据。我的系统提供了低运维成本的工程样板：本地用 LocalStack 仿真，云上可替换为 AWS 服务。

### 6. 为什么采用 Next.js 16 + React 19？

Next.js 提供页面路由、服务端渲染和后端 Route Handler，适合把前端页面和轻量业务 API 放在一个工程内。React 负责组件化交互，比如播放器、上传弹窗、评论区和统计图表。需要注意这不是旧 Pages Router 项目；Next.js 16 的 Route Handler 在 `app` 目录下以 `route.ts` 定义，并基于 Web Request/Response API。项目代码如 `app/api/videos/route.ts`、`app/api/hls/[...objectKey]/route.ts` 都符合这个结构。

### 7. 为什么使用 PostgreSQL + Prisma？

视频平台有用户、频道、视频、评论、订阅、播放列表、上传会话、转码任务、统计表等大量关系型数据，适合用 PostgreSQL 保证事务、约束和索引。Prisma 的价值是用 `schema.prisma` 统一描述模型并生成类型安全访问层，降低手写 SQL 的出错概率。代码证据是 `prisma/schema.prisma` 中的 `Video`、`UploadSession`、`TranscodeJob`、`VideoAsset`、`VideoDailyStat` 等模型，以及 `lib/prisma.ts` 的统一客户端。

### 8. 为什么引入 Better Auth？

认证不是本课题要重复造轮子的部分，但又是所有写操作的安全基础。Better Auth 提供邮箱密码和 OAuth 登录、Session 管理、Cookie 集成，项目把它接到 Prisma/PostgreSQL 上。实现集中在 `lib/auth.ts` 和 `app/api/auth/[...all]/route.ts`；业务层通过 `lib/server/auth-session.ts` 的 `requireUserId()` 拦截未登录写操作。

### 9. 系统目标用户是谁？

系统按三类角色设计：游客、注册用户、创作者。游客看公开视频；注册用户可以评论、点赞、订阅、收藏；创作者可以上传、管理视频并查看数据。这个划分在论文第 3 章需求分析中展开，代码中也能看到对应边界：公开视频查询在 `getVideos()`，用户写操作调用 `requireUserId()`，创作者管理接口在 `app/api/studio/*`。

### 10. 你如何定义项目成功？

我把成功定义为三层：第一，核心业务闭环能跑通，即上传、转码、播放、互动、统计可用；第二，异常可恢复，即损坏视频、超时任务不会让状态永久卡住；第三，测试结果能支撑论文结论。论文第 6 章的功能测试、异常恢复测试和 JMeter 压测对应这三层。代码层面，`reconcile-stale`、`mark-failed` 和压测脚本 `scripts/perf/run-video-list-jmeter.mjs` 是支撑点。

### 11. 如果删掉一个模块，最不能删的是哪个？

最不能删的是视频上传与媒体处理模块，因为它是本课题区别于普通内容平台的核心。如果没有预签名上传、状态机、转码、HLS 产物和状态回写，系统就退化成普通视频信息展示。相关核心代码集中在 `lib/server/videos.ts` 的上传和转码任务方法、`lib/localstack.ts` 的 S3/SFN 封装、`scripts/localstack/lambda/transcode/index.mjs` 的 FFmpeg 处理。

### 12. 你项目的技术风险主要有哪些？

主要风险有三个：媒体转码耗时和资源消耗不可控；LocalStack 与真实 AWS 行为不完全一致；异步任务状态可能出现不一致。对应措施是限制 FFmpeg 线程、使用 Step Functions 的 Retry/Catch、用内部回调统一写库，并提供 stale reconcile 纠错接口。风险不是完全消失，而是被工程机制显式管理。

### 13. 你项目的工程风险主要有哪些？

工程风险主要是功能面较宽，容易出现代码分散、权限遗漏和统计口径不一致。我的处理方式是把 Route Handler 做薄，只负责参数和错误映射，业务规则集中到 `lib/server/*`；权限统一通过 `requireUserId()`；计数类数据尽量下沉到数据库触发器。可以举 `lib/api-route.ts`、`lib/server/comments.ts`、`prisma/triggers.core.sql` 作为证据。

### 14. 论文中的结论是否可泛化？

可以有限泛化到中小规模视频点播或媒体处理场景，但不能直接泛化到大型商业视频网站。我的结论是“方案具备可行性和工程参考价值”，不是“性能已经达到生产级大型平台”。测试环境是本地和 LocalStack 仿真，压测集中在核心读取接口，所以真实云部署、CDN、监控和多码率还需要后续验证。

### 15. 你的项目与现有平台相比优势是什么？

和成熟商业平台比，我的系统规模和能力当然更小；优势在于架构清晰、成本低、可本地复现，适合教学、原型和中小团队自建。它展示了完整链路：前端上传、对象存储、状态机、云函数转码、HLS 播放、互动和统计。答辩时要避免说“超越 YouTube”，应说“提供一套可理解、可实现、可扩展的工程方案”。

## B. 架构设计与链路（16-40）

### 16. 系统总体架构是怎样的？

总体是“统一 Web 应用 + 关系数据库 + 对象存储 + 工作流编排 + 云函数”的结构。Next.js 处理页面和业务 API；PostgreSQL 保存结构化业务数据；S3 保存源视频、HLS 切片和封面；Step Functions 编排 Lambda；EventBridge 传递阶段事件。论文第 4 章架构图就是这条链路，代码分别对应 `app/api/*`、`prisma/schema.prisma`、`lib/localstack.ts`、`scripts/localstack/*`。

### 17. 同步请求与异步任务如何拆分？

同步请求是用户马上需要结果的操作，比如登录、评论、查询视频列表；异步任务是耗时长、不能阻塞页面的操作，比如转码和切片。项目中上传完成后只启动转码任务，前端不等待 Lambda 执行完，而是通过 `pipeline-status` 查询状态。这样可以避免一个 HTTP 请求因为视频处理时间过长而超时。

### 18. 预签名上传的完整流程是什么？

流程是：前端请求 `/api/uploads/video-url`；服务端校验登录，创建视频草稿和 `UploadSession`；服务端为 `vod-raw/{shortCode}/source.mp4` 生成 PUT 预签名 URL；前端直接把文件上传到对象存储；上传成功后调用 `/api/videos` 创建 `TranscodeJob` 并启动状态机。代码证据是 `app/api/uploads/video-url/route.ts`、`getVideoUploadUrl()`、`createVideo()`。

### 19. 为什么前端上传后还要调用创建任务接口？

预签名 URL 只解决“文件怎么传到对象存储”，不代表业务上已经创建了可处理的视频任务。上传成功后再调用创建任务接口，可以让后端确认上传会话、生成 `TranscodeJob`、启动状态机，并把视频状态切换为 `PROCESSING`。这相当于把“文件传输”和“业务任务开始”分成两个明确节点，便于失败恢复。

### 20. Step Functions 在链路中的核心作用？

Step Functions 像一个流程控制器，把多个 Lambda 阶段按顺序组织起来，并统一管理重试和失败分支。项目的状态机定义在 `scripts/localstack/deploy-sfn.mjs`：先 `ExtractMetadata`，再 `Transcode`，再 `Finalize`，失败进入 `MarkFailed`。如果老师不了解，可以类比为“有状态的任务调度器”，不是单个函数自己到处调用。

### 21. Lambda 阶段如何划分职责？

每个 Lambda 只做一个阶段：元数据阶段把任务置为运行中；转码阶段下载源视频、ffprobe 探测、ffmpeg 生成 HLS 和封面；finalize 阶段写入产物并置为 READY；mark-failed 阶段统一失败状态。这样划分让失败点清楚，也方便 Step Functions 捕获和重试。代码在 `scripts/localstack/lambda/*/index.mjs`。

### 22. EventBridge 为什么需要？

EventBridge 的作用是把媒体处理过程中的阶段事件发出去，便于后续扩展日志、通知、监控等订阅者。当前项目中转码 Lambda 会发布 `pipeline.stage` 事件，同时回调内部 API 写数据库。也就是说，数据库回写保证当前功能可见，EventBridge 保留事件驱动扩展能力。证据在 `scripts/localstack/lambda/transcode/index.mjs` 的 `emitStage()`。

### 23. 内部回调接口如何保证安全？

内部接口不面向普通用户，只允许 Lambda 携带 `Authorization: Bearer <INTERNAL_API_SECRET>` 调用。如果密钥没有配置，接口直接拒绝，避免误暴露。实现见 `app/api/internal/vod/update-metadata/route.ts`、`stage/route.ts`、`finalize/route.ts`、`mark-failed/route.ts` 中的 `checkAuth()`。

### 24. 视频状态机为什么设置这些状态？

`VideoProcessingStatus` 只有 `UPLOADING`、`PROCESSING`、`READY`、`FAILED`，是为了让用户界面和业务判断足够清楚。`UPLOADING` 表示文件还在传，`PROCESSING` 表示状态机正在处理，`READY` 表示可以播放，`FAILED` 表示需要重试或处理错误。更细的阶段不放在视频主状态里，而放在 `TranscodeJob.pipelineStage`，避免主状态过度复杂。

### 25. 为什么使用 HLS 而不是 MP4 直链？

MP4 直链是下载一个大文件，网络波动时体验和恢复能力较差；HLS 是清单加小切片，播放器可以边下边播，更适合在线视频。项目生成 `master.m3u8` 和切片文件，播放时只需要读取主清单。代码证据是 `scripts/localstack/lambda/transcode/index.mjs` 的 FFmpeg HLS 输出，以及 `VideoAsset` 中的 `HLS_MASTER`。

### 26. HLS 主清单和切片如何组织？

对象存储中按 `shortCode` 做前缀隔离：源文件是 `vod-raw/{shortCode}/source.mp4`，HLS 输出是 `vod-hls/{shortCode}/master.m3u8` 和切片文件，封面在 `vod-image/thumbnails/{shortCode}/...`。命名规则在 `lib/localstack.ts` 的 `createRawVideoObjectKey()` 和 `createHlsOutputPrefix()`，论文第 4 章表 4-2 也有说明。

### 27. 播放页如何拿到媒体资源地址？

转码完成后，`finalize` 内部接口把主清单写入 `VideoAsset`，并把视频置为 `READY`。播放页读取视频信息和资源配置后，构造 HLS 地址给播放器。真实环境可通过 CDN 域名访问，本地环境走 `/api/hls/[...objectKey]` 代理。相关代码是 `app/watch/[shortCode]/page.tsx`、`components/player/video-player.tsx`、`app/api/hls/[...objectKey]/route.ts`。

### 28. 本地开发为什么要用 HLS 代理接口？

本地没有真实 CloudFront/CDN，浏览器直接访问 LocalStack 对象地址时可能遇到路径、Header、Range 请求等差异。`/api/hls/[...objectKey]` 代理把请求转发到 LocalStack，并保留 `range`、`content-type`、`content-range` 等播放必要头。这样本地可以更接近真实播放链路，代码在 `app/api/hls/[...objectKey]/route.ts`。

### 29. 失败任务如何回收和重试？

状态机任一阶段失败会进入 `MarkFailed`，内部接口把 `TranscodeJob` 和 `Video` 都置为失败并记录错误。用户可在工作室调用重试接口，系统会复用历史输入，创建新的 `TranscodeJob` 并重新启动状态机。代码证据是 `app/api/internal/vod/mark-failed/route.ts` 和 `retryVideoJob()`。

### 30. 如何防止任务长期卡死？

项目提供 `reconcile-stale` 内部维护接口，扫描长时间停留在 `QUEUED/RUNNING` 的任务，将其标记为失败，并在没有其他活跃任务时同步更新视频状态。这解决的是异步系统常见的“任务执行丢失或回调丢失”问题。代码在 `app/api/internal/vod/reconcile-stale/route.ts`。

### 31. 为什么需要 UploadSession 与 TranscodeJob 两张表？

`UploadSession` 记录文件上传阶段，比如对象键、存储桶、过期时间、完成时间；`TranscodeJob` 记录处理阶段，比如输入输出、状态、尝试次数、错误和执行 ARN。两者分开后，可以清楚地区分“文件有没有传完”和“媒体处理有没有完成”。这比把所有字段塞进 `Video` 表更易维护。

### 32. VideoAsset 的设计价值是什么？

`VideoAsset` 是视频产物清单，记录源文件、HLS 主清单、变体、缩略图等资源的位置和元数据。这样播放页和管理页不用每次去对象存储扫描文件，只要查数据库就知道资源在哪里。实现见 `prisma/schema.prisma` 的 `VideoAsset` 模型和 `app/api/internal/vod/finalize/route.ts` 的写入逻辑。

### 33. 如何保证任务状态和视频状态一致？

关键状态更新放在数据库事务里完成。例如 `update-metadata` 同时把任务置为 `RUNNING`、视频置为 `PROCESSING`；`finalize` 同时把任务置为 `SUCCEEDED`、视频置为 `READY` 并写入 `VideoAsset`；失败时同时写入任务和视频错误。证据是多个内部接口中的 `prisma.$transaction()`。

### 34. 为什么计数逻辑放在数据库触发器？

点赞数、评论数、订阅数属于高频计数，如果全部靠应用层加减，在并发情况下容易漏更新或重复更新。数据库触发器贴近数据变更源头，只要插入、更新、删除相关记录，就自动维护计数。实现见 `prisma/triggers.core.sql` 的 `fn_video_reaction_counter`、`fn_comment_counter`、`fn_subscription_counter`。

### 35. 评论二级结构如何实现？

评论表使用 `parentId` 自关联：一级评论 `parentId` 为空，回复评论指向父评论。前端按需加载回复，后端 `getComments()` 查询一级评论，`getReplies()` 查询指定父评论下的回复。代码在 `prisma/schema.prisma` 的 `Comment` 模型和 `lib/server/comments.ts`。

### 36. 播放列表如何防止重复添加同一视频？

数据库层面 `PlaylistItem` 有 `@@unique([playlistId, videoId])`，保证同一个列表不能重复出现同一个视频。应用层在 `addVideoToPlaylist()` 中也会先查询是否已存在，存在则返回业务错误。这样是数据库约束和应用校验双保险。

### 37. 统计数据为什么做日级汇总表？

原始播放事件会不断增长，如果图表每次都扫全量事件表，查询成本会越来越高。日级汇总表把观看次数、独立观众、观看时长、互动增量按天预聚合，统计页只读轻量结果。实现见 `VideoPlaybackEvent`、`VideoDailyStat`、`ChannelDailyStat` 以及 `prisma/rollup.daily.sql` 的 `sp_rollup_daily_stats()`。

### 38. 为什么采用轮询而不是 WebSocket？

转码状态不需要毫秒级实时，几秒刷新一次已经足够。轮询实现简单、稳定、部署要求低，适合毕业设计和中小规模后台任务。WebSocket 适合聊天室或实时协作，但会增加连接管理和部署复杂度。项目中状态查询接口是 `/api/videos/[shortCode]/pipeline-status` 和 `/api/studio/videos/processing-statuses`。

### 39. LocalStack 在你的项目中的角色是什么？

LocalStack 是 AWS 服务的本地仿真环境，用来在本机模拟 S3、Lambda、Step Functions、EventBridge、IAM 等服务。它降低开发和演示成本，也让媒体链路可复现。项目脚本在 `scripts/localstack/setup.mjs`、`deploy-lambdas.mjs`、`deploy-sfn.mjs`，论文第 4.5 节说明了本地仿真设计。

### 40. LocalStack 与真实 AWS 差异如何应对？

LocalStack 能验证流程逻辑，但不能完全代表真实云环境，尤其是 IAM 细节、网络延迟、服务配额、冷启动和计费。我的应对策略是把 AWS 调用封装在 `lib/localstack.ts`，通过环境变量切换 endpoint、bucket 和 ARN；论文结论也保守限定为当前测试环境可行，后续需要真实云部署验证。

## C. 测试与性能（41-60）

### 41. 为什么选择 JMeter？

JMeter 是成熟的接口压测工具，适合模拟多线程并发访问，能输出吞吐量、平均响应时间、P99 和错误率等指标。我的目标不是测浏览器渲染，而是测核心读取接口在并发下的服务端表现，所以 JMeter 合适。论文第 6.5 节选择 `/api/videos?limit=12&type=LONG` 作为高频读接口。

### 42. 为什么是 50/100/200 三档并发？

这三档用于逐级加压：50 观察基础并发，100 观察压力上升趋势，200 观察更高并发下的尾延迟和稳定性。这样比只测一个并发数更能说明系统随压力变化的趋势。测试结果显示吞吐量上升，但平均 RT 和 P99 也上升，说明系统可用但已有排队压力。

### 43. 吞吐量如何解读？

吞吐量表示单位时间内系统能处理多少请求，常见单位是 QPS 或 requests/second。论文结果中 50、100、200 并发下吞吐量分别约为 112、120、147，说明在本地测试条件下系统还能持续处理更多请求。但吞吐量不能单独代表体验，还要结合响应时间和错误率。

### 44. 平均 RT 和 P99 区别是什么？

平均 RT 是所有请求响应时间的平均值，容易被大量正常请求拉低；P99 表示 99% 请求都能在这个时间内完成，更能反映极端慢请求。对用户体验来说，P99 很重要，因为少量很慢的请求也会让用户感觉卡顿。论文中并发 200 时 P99 到 2733ms，说明尾部体验有优化空间。

### 45. 错误率为 0 说明了什么？

错误率为 0 说明在测试窗口内接口没有返回失败状态，系统在该并发下保持了基本可用性和稳定性。它能支持“没有明显中断”的结论。代码层面，公开视频列表只查询 `deletedAt=null`、`visibility=PUBLIC`、`processingStatus=READY`，逻辑相对稳定，见 `getVideos()`。

### 46. 错误率为 0 不能说明什么？

错误率为 0 不能说明系统已经达到生产级性能，也不能说明所有接口都稳定。它不覆盖长时间运行、真实云网络、写入链路、大文件上传、转码峰值和复杂用户行为。答辩时要主动说：这是核心读取接口的本地压测结果，是可行性验证，不是全场景性能认证。

### 47. 为什么并发升高后 RT 上涨？

并发升高后，请求会在 Next.js 服务端、数据库连接、CPU 调度和网络栈中排队。即使每个查询本身不复杂，同时请求变多也会造成资源竞争。项目中的 `/api/videos` 会访问数据库并做 JSON 序列化，`jsonResponse()` 还会处理 BigInt 转换，所以 RT 上涨是正常现象。

### 48. 你的瓶颈可能在什么位置？

公开视频列表的瓶颈可能在数据库查询、连接池、Next.js 服务端处理、JSON 序列化和本机硬件资源。媒体链路的瓶颈则可能在 FFmpeg CPU、对象存储 IO、Lambda 执行时长和状态机调度。根据代码，首页接口依赖 `prisma.video.findMany()`；转码 Lambda 限制了 `FFMPEG_THREADS`，说明 CPU 是需要控制的资源。

### 49. 结论的有效性边界是什么？

结论只对当前功能范围、测试环境和测试指标有效。我的测试环境是 Windows、本地 PostgreSQL、LocalStack 和 Next.js 服务，性能测试主要针对读接口。它能证明系统功能闭环和一定并发稳定性，但不能证明真实 AWS 上的所有性能、成本和可用性。论文结论也写成“可行性与工程实践参考”。

### 50. 压测是否覆盖写入链路？

主要压测没有覆盖写入链路，它覆盖的是首页高频读取接口。写入链路通过功能测试和异常恢复测试验证，如未登录评论拦截、上传非法文件拒绝、损坏视频失败处理。原因是写入压测会改变数据状态、需要更复杂的清理和幂等设计，后续可以增加评论写入、播放事件上报和上传任务启动的专项压测。

### 51. 如何验证异常恢复能力？

我用两个方向验证：一是上传损坏视频，观察状态机是否进入失败分支并回写 `FAILED`；二是手动制造超时运行任务，调用 `reconcile-stale` 看是否纠错。论文第 6.4 节的 TC-05 和 TC-06 对应这两类。代码证据是 `mark-failed` 和 `reconcile-stale` 内部接口。

### 52. 损坏视频触发失败链路如何证明有效？

损坏视频会让 ffprobe 或 ffmpeg 处理失败，Step Functions 的 Catch 分支会把输入和错误信息传给 `MarkFailed`，随后内部接口把 `TranscodeJob.status` 和 `Video.processingStatus` 都写成失败。验证时看三个点：状态机进入失败路线、数据库状态改变、前端工作室显示失败信息。

### 53. stale reconcile 机制解决了什么问题？

它解决异步任务“没有成功也没有失败”的卡死问题。例如 Lambda 崩溃、回调丢失、状态机中断时，视频可能长期停在处理中。`reconcile-stale` 根据阈值扫描旧的 `QUEUED/RUNNING` 任务并标记失败，让用户可以重试。代码中还会检查是否存在其他活跃任务，避免误伤正在重试的同一视频。

### 54. 你的测试是否可复现？

基本可复现，因为依赖脚本和配置都在仓库里：`package.json` 定义了 `localstack:setup`、`db:apply-pg-extras`、`perf:jmeter:videos` 等命令；数据库模型和 SQL 脚本在 `prisma/`；LocalStack 部署脚本在 `scripts/localstack/`。但不同机器硬件和后台负载会影响绝对性能数值，所以更应该比较趋势。

### 55. 若换真实云环境预期会有什么变化？

真实 AWS 中对象存储、Lambda 和状态机的行为更接近生产，但也会引入网络延迟、冷启动、服务配额、IAM 权限和计费问题。播放链路如果接入 CloudFront，静态媒体分发可能更稳定；转码链路则要关注 Lambda 临时磁盘、最大执行时间和 FFmpeg 资源。我的预期是架构可迁移，但性能和成本需要重新测试。

### 56. 你会优先优化哪三个点？

第一，接入 CDN 和更完善的缓存策略，降低 HLS 资源访问压力；第二，优化数据库查询和连接池，尤其是首页、搜索、统计页；第三，改进转码策略，支持多码率和更精细的失败重试。对应代码区域分别是 `app/api/hls`/CDN 配置、`lib/server/videos.ts`/`lib/server/stats.ts`、`scripts/localstack/lambda/transcode/index.mjs`。

### 57. 如何证明优化有效？

必须用同一环境、同一数据集、同一压测参数做优化前后对比。指标包括吞吐量、平均 RT、P95/P99、错误率，以及转码任务的平均耗时和失败率。比如优化首页查询后，可以再次跑 `/api/videos?limit=12&type=LONG`，比较 50/100/200 并发下的 P99 是否下降。

### 58. 统计口径如何避免重复计数？

播放统计中，观看次数按 `PLAY_START` 事件统计；独立观众用 `COALESCE(userId, sessionId)` 去重，登录用户按用户 ID，游客按会话 ID；观看时长汇总 `watchDeltaMs`。这些规则写在 `prisma/rollup.daily.sql` 的 `sp_rollup_daily_stats()`。答辩时可以强调：统计口径是显式 SQL，不是前端随便算。

### 59. 为什么需要 unique viewers 指标？

播放量反映视频被打开多少次，但可能被同一个人反复刷新放大；独立观众更接近真实覆盖人数。对创作者来说，一个视频 1000 次播放来自 10 个人和来自 800 个人，运营意义完全不同。项目在 `VideoDailyStat.uniqueViewers` 中保存该指标。

### 60. 你的性能结论最保守表述是什么？

最保守表述是：在当前本地实验环境和测试数据规模下，核心公开视频列表接口在 50/100/200 并发下保持 0 错误率，吞吐量随并发提升而增加，但尾延迟明显上升，说明系统具备一定并发处理能力，同时仍需在真实云环境、写入链路和长时间运行场景下继续验证。

## D. 安全与可维护性（61-80）

### 61. 登录态如何管理？

登录态由 Better Auth 管理，认证入口在 `/api/auth/[...all]`，会话数据通过 Prisma 写入 PostgreSQL，Cookie 集成由 `nextCookies()` 处理。服务端业务代码通过 `auth.api.getSession()` 从请求头中识别当前用户。封装在 `lib/server/auth-session.ts`，其中 `getOptionalUserId()` 用于可选身份，`requireUserId()` 用于强制登录。

### 62. 未登录访问写接口如何拦截？

写接口最终都会进入业务服务层，并调用 `requireUserId()`。如果没有登录，会抛出“未登录”，Route Handler 再映射为 401。例子包括评论、订阅、上传、播放列表和工作室视频管理。这样做比每个接口手写 Cookie 判断更统一，证据见 `lib/server/comments.ts`、`lib/server/videos.ts`、`lib/server/playlists.ts`。

### 63. 为什么要做内部 API Secret 鉴权？

内部 API 会直接修改转码状态，如果被外部用户调用，可能伪造 READY 或 FAILED 状态，破坏数据安全。因此所有 `/api/internal/vod/*` 都要求 `INTERNAL_API_SECRET`。这相当于让 Lambda 和 Next.js 后端之间有一把共享钥匙，只有内部链路能写入状态。

### 64. 上传接口如何避免滥用？

上传前必须登录，服务端只为当前用户创建草稿和预签名 URL，URL 有过期时间，且绑定对象键和 Content-Type。上传后还要通过创建任务接口确认会话，不能随便让匿名用户写入业务数据。代码在 `getVideoUploadUrl()`，其中 `expiresAt` 记录上传会话过期时间，预签名默认 900 秒。

### 65. 第三方登录如何与本地账户共存？

Better Auth 的 `Account` 表保存不同 provider 的账号信息，本地密码和 GitHub/Google 都关联到同一个 `User` 模型。项目在 `lib/auth.ts` 配置 `emailAndPassword`、`github`、`google`，并做 GitHub 邮箱和头像映射。答辩时可以说：用户身份是站内 User，登录方式只是 Account 的不同来源。

### 66. 会话过期如何处理？

会话由 Better Auth 维护，数据库中的 `Session` 有 `expiresAt` 字段，后续请求会根据 Cookie 中的令牌查询会话是否有效。过期或不存在时，`getOptionalUserId()` 返回空，必须登录的接口通过 `requireUserId()` 拒绝。前端登录页和导航栏会根据会话状态切换展示。

### 67. 为什么强调统一错误映射？

统一错误映射能让 API 返回稳定的中文错误，前端也能一致处理。否则每个接口各写各的错误格式，维护成本高，用户体验也差。项目的服务端辅助在 `lib/api-route.ts`，前端请求错误在 `lib/api-client.ts`，认证错误中文映射在 `lib/auth-error.ts`。

### 68. 系统如何防止越权编辑视频？

编辑、删除、重试、取消等工作室操作都会先通过 `requireUserId()` 获取当前用户，再用 `shortCode + userId + deletedAt=null` 查询视频。找不到就报“视频不存在”，不会允许编辑他人视频。证据是 `editVideo()`、`deleteVideo()`、`retryVideoJob()`、`cancelVideoJob()`。

### 69. 私有视频访问控制怎么实现？

播放页的 `getVideoInfo()` 会根据当前用户和视频可见性判断访问权限。公开视频和未列出视频在 READY 后可看；私有和草稿只有作者可看；非作者访问未处理完成的视频会 `notFound()`；未登录访问私有视频会跳转登录。代码集中在 `lib/server/videos.ts` 的 `getVideoInfo()`。

### 70. 评论编辑删除如何限制权限？

评论编辑和删除都先要求登录，再查询评论作者 `userId`，只有当前用户等于作者才允许修改或软删除。否则抛出“无权限修改/删除此评论”。实现见 `lib/server/comments.ts` 的 `updateComment()` 和 `deleteComment()`。

### 71. 订阅关系如何保证唯一性？

数据库 `Subscription` 模型有 `@@unique([subscriberId, channelId])`，保证同一个用户不能重复订阅同一个频道。应用层 `toggleSubscribe()` 先查是否已订阅，存在则取消，不存在则创建，同时禁止订阅自己的频道。订阅数由数据库触发器维护。

### 72. 数据库级约束和应用层校验如何配合？

应用层校验负责给用户友好的错误和业务规则，比如不能收藏不可见视频、不能编辑他人视频；数据库约束负责兜底一致性，比如唯一约束、外键、级联删除和索引。两者不是替代关系，而是前者提升体验，后者保证数据不会被异常并发破坏。例子是 `PlaylistItem` 的唯一约束和 `addVideoToPlaylist()` 的存在性检查。

### 73. 你如何处理软删除后的查询一致性？

视频和评论使用 `deletedAt` 做软删除，查询时统一过滤 `deletedAt: null`。这样可以保留历史数据和统计关联，同时前台不展示已删除内容。证据是 `getVideos()`、`getVideoInfo()`、`listUserVideos()`、`getComments()` 等查询都包含 `deletedAt` 条件。

### 74. 统计任务与在线业务如何解耦？

在线业务只负责记录原始事件，比如播放事件、点赞、评论、订阅；统计汇总由 `sp_rollup_daily_stats()` 后续按日期聚合到日表。这样用户播放时不用等待复杂统计计算，统计页也不用实时扫描全量日志。代码证据是 `recordPlaybackEvent()` 和 `prisma/rollup.daily.sql`。

### 75. 如何处理播放器埋点数据质量？

播放器只在关键事件上报：首次播放、进度、暂停、恢复、拖动、结束，并携带 sessionId、播放位置、时长增量、速率、音量等字段。后端对不存在或已删除视频直接忽略，避免脏数据进入。前端逻辑在 `components/player/video-player.tsx`，后端写入在 `recordPlaybackEvent()`。

### 76. 可维护性最关键的设计是什么？

最关键的是分层：Route Handler 薄、业务逻辑集中在 `lib/server/*`、基础设施封装在 `lib/localstack.ts`、数据模型集中在 `prisma/schema.prisma`。这样改接口不必重写业务，换云服务也尽量只改封装层。对老师可以说：项目不是把代码都写在页面组件里，而是按职责分开。

### 77. 日后扩展短视频场景要改哪些点？

数据库已经有 `VideoType` 的 `LONG/SHORT`，查询接口也支持 `type` 参数，所以基础区分已具备。要扩展短视频，还需要改前端浏览交互、推荐算法、播放器竖屏体验、上传限制、统计口径和内容分发策略。代码切入点包括 `getVideos()`、首页组件、上传时的 `videoType` 和播放器布局。

### 78. 若接入内容审核，架构如何放置？

内容审核应放在转码完成前或发布前。可以在 Step Functions 中增加 `Moderation` 阶段，调用图像/视频审核服务；也可以在 `Finalize` 前根据审核结果决定视频是 READY 还是 REVIEW_FAILED。业务上，上传后默认私有或草稿，审核通过后才允许公开。这样不会让未审核内容直接进入公开视频列表。

### 79. 若增加多码率自适应，链路如何改造？

转码 Lambda 需要生成多套分辨率/码率的 HLS 变体，比如 360p、720p、1080p，并生成包含多个 variant 的 master playlist。数据库 `VideoAsset` 可以为每个变体保存 `qualityLabel`、`bitrateKbps`、宽高等信息。前端播放器可读取多码率主清单自动切换。当前项目已保留 `HLS_VARIANT`、`qualityLabel` 字段，具备扩展基础。

### 80. 如何定位线上故障？

按链路分层定位：先看用户请求是否到 Next.js，再查数据库视频状态和最新 `TranscodeJob`，再看 Step Functions 执行 ARN 和 Lambda 日志，最后看对象存储中源文件和 HLS 产物是否存在。项目里 `pipeline-status` 返回 jobStatus、pipelineStage、attempt、executionArn，可以作为前端和后台排查入口。

## E. 论文与答辩表达（81-100）

### 81. 你的研究意义是什么？

研究意义在于把 Serverless 架构应用到视频点播这种异步、文件密集型场景，验证它对中小规模业务的可行性。它不是单纯做一个网页，而是把对象存储、函数计算、工作流编排、数据库和播放器连接成完整链路。对中小团队来说，这能降低自建转码集群的门槛。

### 82. 与相关工作的差异在哪里？

相关技术通常分别讨论 Serverless、对象存储、HLS 或认证框架，而我的工作把这些技术组合成一个可运行的视频点播平台。差异在工程集成：预签名上传、状态机转码、HLS 播放、权限控制、互动和统计都在同一项目内实现。答辩时要强调“系统设计与实现”，不是单点算法突破。

### 83. 论文第 2 章与第 4 章如何衔接？

第 2 章讲技术可行性，解释为什么这些技术适合本课题；第 4 章把这些技术落到具体架构和模块设计。比如第 2 章介绍 S3、Lambda、Step Functions、HLS，第 4 章就说明它们如何组成上传和转码链路。也就是先回答“能不能用”，再回答“怎么设计”。

### 84. 论文第 5 章“实现”如何对应第 4 章“设计”？

第 4 章给出架构、模块、数据库和接口设计，第 5 章用实际页面、接口和代码流程证明设计被落地。比如第 4 章设计了内部回调接口，第 5 章说明转码 Lambda 如何回调这些接口；第 4 章设计了统计表，第 5 章说明播放器埋点和 rollup 如何生成图表。

### 85. 第 6 章测试如何支撑结论？

第 6 章从功能、异常和性能三个角度支撑结论。功能测试证明核心业务闭环可用；异常测试证明损坏视频和卡死任务可恢复；性能测试证明核心读接口在本地并发下保持 0 错误率。它支撑的是“当前环境下可行且稳定”，不是无限规模生产能力。

### 86. 你的结论是否过度承诺？

没有，我在结论中限定了场景和边界。系统验证的是中小规模视频点播场景下的工程可行性，并承认还需要真实云环境测试、多码率、内容审核和更完整监控。答辩时如果被追问，要主动说：论文没有承诺达到大型商业平台水平。

### 87. 你项目最大的不足是什么？

最大不足是真实云环境和生产级能力验证还不够充分。目前主要依赖 LocalStack 和本地压测，媒体分发、多码率、内容审核、监控告警和成本分析还不完整。这个回答要诚实，但要接上已经做的补救：本地仿真链路完整、异常恢复机制已实现、下一步可以迁移到真实 AWS 验证。

### 88. 为什么这个不足没有在本阶段解决？

毕业设计周期有限，真实云部署会涉及账号权限、云资源成本、配额、安全配置、域名和 CDN 等额外工作。为了保证论文主体完整，我优先完成核心业务链路和本地可复现验证。这个取舍符合工程原则：先把架构闭环做稳定，再逐步做生产化增强。

### 89. 下一步工作计划是什么？

下一步分三类：云上验证，把 LocalStack 链路迁移到真实 AWS 并测试 IAM、冷启动和成本；媒体能力，增加多码率自适应、封面策略和内容审核；运维能力，增加日志、监控、告警和更完整压测。这样回答能体现你知道项目从毕业设计到生产系统还差什么。

### 90. 如果多给一个月你会优先做什么？

我会优先做真实 AWS 部署和 CDN 播放验证，因为这是当前结论最需要加强的外部有效性。其次是多码率 HLS，让系统更接近真实视频网站。最后补充写入链路压测，比如播放事件上报、评论写入和转码任务启动。

### 91. 你的工作对中小团队有什么现实价值？

现实价值是提供一套低门槛视频平台建设思路：不用先维护复杂转码集群，而是用对象存储、函数计算和工作流编排处理媒体任务；业务层用 Next.js 和 PostgreSQL 快速完成内容、互动和统计。中小团队可以先按这个架构做 MVP，再根据流量逐步扩展。

### 92. 如何向非技术评委解释系统架构图？

可以用“快递加工厂”类比：用户把原始视频直接寄到仓库 S3；系统生成一张加工单 TranscodeJob；流水线 Step Functions 安排不同工位 Lambda 做检测、转码、封面和入库；完成后数据库记录成品位置；用户播放时按清单取小片段观看。这样老师不懂 AWS 也能理解职责分工。

### 93. 你的三分钟版本如何讲？

三分钟讲法：第一段讲问题，视频平台难在大文件上传和异步转码；第二段讲方案，用 Next.js、PostgreSQL、Prisma、Better Auth 完成业务，用 S3、Lambda、Step Functions、EventBridge 完成媒体流水线；第三段讲结果，系统实现上传、播放、互动、统计，并通过功能、异常和并发测试验证可行性；最后讲不足，真实云和生产级能力还需继续完善。

### 94. 你的八分钟版本如何讲？

八分钟可以按论文结构：1 分钟背景和目标；1 分钟需求和角色；2 分钟总体架构，重点讲同步业务与异步转码拆分；2 分钟实现，重点讲预签名上传、状态机、HLS 播放和统计；1 分钟测试结果；1 分钟总结不足与展望。现场如果时间紧，就删掉普通互动模块，保留媒体链路和测试。

### 95. 如何处理被打断后的衔接？

先直接回答老师问题，再用一句话接回主线。例如老师打断问 HLS，你回答“它是清单加切片的播放方式，本项目生成 master.m3u8 和切片文件”，然后接“所以在我的上传处理链路中，转码完成后的产物会写入 VideoAsset 供播放页读取”。不要从头重讲，直接把问题接回当前章节。

### 96. 现场演示失败时如何补救？

不要慌，先说明演示依赖本地服务、数据库和 LocalStack，可能受环境影响。然后用论文截图、接口返回、数据库状态或代码链路替代证明。比如上传演示失败，可以展示 `UploadSession`、`TranscodeJob` 表设计和 `scripts/localstack/deploy-sfn.mjs` 状态机；播放失败可以展示 HLS 代理和 `VideoAsset` 记录。

### 97. 遇到不会的问题如何应对？

先承认边界，再说可推断方向。模板是：“这个细节我目前没有做完整验证，不能直接下结论。但从项目架构看，它会影响某某模块，我会通过某某测试或改造来验证。”不要编造。比如被问真实 AWS 成本，就说需要结合 Lambda 执行时长、S3 存储、CloudFront 流量和 Step Functions 调用量估算。

### 98. 如何把回答控制在 60 秒内？

用“四句模板”：为什么、怎么做、证据、边界。比如问 Serverless：为什么是任务波动；怎么做是 S3 + Step Functions + Lambda；证据是状态机和内部回调；边界是真实云还需验证。答辩时每句不超过 15 秒，老师追问再展开细节。

### 99. 你希望评委记住你的哪三点？

第一，我做的是完整视频点播闭环，不只是前端页面。第二，核心媒体处理链路采用 Serverless 工作流，具备可观测和失败恢复。第三，我对测试结论保持边界意识，能说明当前可行性和下一步生产化方向。这三点对应“完整性、架构性、工程意识”。

### 100. 你的一句话收尾是什么？

可以这样收尾：本课题完成了一套基于 AWS Serverless 思路的视频点播平台，实现了从上传、转码、播放到互动统计的完整链路，并通过本地仿真和测试验证了该方案在中小规模场景下的工程可行性；后续将继续向真实云部署、多码率播放和生产级监控方向完善。

## 高频追问速记

- **Serverless 不是没有服务器**：是服务器运维、弹性和资源回收由云平台托管。
- **预签名 URL 的本质**：后端临时授权客户端直传对象存储，降低应用服务器带宽压力。
- **Step Functions 的本质**：有状态的任务编排器，负责顺序、重试和失败分支。
- **HLS 的本质**：清单文件加小切片，播放器按清单边下边播。
- **Prisma 的本质**：用模型文件生成类型安全的数据访问层，不是替代数据库设计。
- **LocalStack 的本质**：本地 AWS 仿真，适合开发验证，不等于真实云生产结果。
- **P99 的意义**：看尾部慢请求，比平均值更能反映卡顿。
- **答辩安全句式**：当前测试证明“可行和稳定”，不夸大为“生产级最优”。
