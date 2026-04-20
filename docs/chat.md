

### 核心硬伤：第5章“系统实现”极度空洞（需要大量重写）

第5章是整篇论文的得分点。你现在的写法是：“app/api/xxx 提供了什么接口，底层调用了 lib/server/xxx 服务，完成了什么功能”。
**这不叫“系统实现”，这叫“系统路由目录”。** 你必须把你的核心算法、核心 SQL、核心配置通过代码块或伪代码的形式展示出来，并配合文字解释其逻辑。

**修改指令：在以下关键小节强制插入核心代码与深度解释。**

#### 1. 在 5.7.1 上传会话与对象存储实现
不要只说“调用 createUploadPresignedUrl() 生成预签名地址”。你必须展示后端是如何使用 AWS SDK (V3) 生成这个地址的。
**你需要补充类似以下的核心逻辑：**
> **补充内容示例：**
> 在获取预签名地址时，为保证安全性，系统通过 AWS SDK 的 `PutObjectCommand` 对上传文件的大小、内容类型以及过期时间进行了严格限制。核心实现代码如下：
> ```typescript
> const command = new PutObjectCommand({
>   Bucket: process.env.AWS_S3_RAW_BUCKET,
>   Key: `${shortCode}/source.mp4`,
>   ContentType: 'video/mp4',
> });
> // 限制预签名地址有效期为 3600 秒
> const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
> ```

#### 2. 在 5.7.3 转码与 HLS 切片实现（极其重要！）
你是视频点播平台，**FFmpeg 的转码参数是这篇论文最核心的“技术含金量”所在**。你一笔带过“通过 FFmpeg 将原始 MP4 视频转换为 master.m3u8”，这是绝对不合格的。你必须贴出实际执行的 FFmpeg 命令，并逐个解释参数含义。
**你需要补充类似以下的核心逻辑：**
> **补充内容示例：**
> 在 Lambda 函数中，系统使用 FFmpeg 进行 HLS 切片。为了兼顾视频质量与转码效率，系统采用了预设的 H.264 编码参数，强制固定关键帧间隔，并生成长度为 10 秒的切片。核心转码命令及参数释义如下：
> ```bash
> ffmpeg -i input.mp4 \
>   -profile:v main -level 4.0 \
>   -start_number 0 -hls_time 10 -hls_list_size 0 \
>   -f hls master.m3u8
> ```
> *参数分析：*
> `-profile:v main -level 4.0`：保证了在大部分移动端设备上的硬件解码兼容性。
> `-hls_time 10`：指定每个 TS 分片的时长为 10 秒，平衡了首屏加载速度与切片文件数量。
> `-hls_list_size 0`：保留所有的切片记录，确保生成点播（VOD）类型而非直播（Live）类型的播放列表。

#### 3. 在 5.9 统计分析模块实现
你提到了 `sp_rollup_daily_stats` 存储过程，这是一个非常好的亮点！但在论文里你居然没有把这部分 SQL 展示出来。这等同于把武器藏在了剑鞘里。
**你需要补充类似以下的核心逻辑：**
> **补充内容示例：**
> 针对高并发的播放事件采集，系统采用异步写入 `VideoPlaybackEvent` 表的方式。为避免统计页面查询时的全表扫描，系统通过定时任务触发存储过程 `sp_rollup_daily_stats`，利用 SQL 的窗口函数与聚合操作生成日统计数据。核心 SQL 聚合逻辑如下：
> ```sql
> INSERT INTO "VideoDailyStat" ("videoId", "date", "views", "watchTimeSeconds")
> SELECT
>   "videoId",
>   DATE("createdAt") as stat_date,
>   COUNT(DISTINCT "sessionId") as daily_views,
>   SUM("watchDeltaMs") / 1000 as daily_watch_time
> FROM "VideoPlaybackEvent"
> WHERE "createdAt" >= CURRENT_DATE - INTERVAL '1 day'
> GROUP BY "videoId", DATE("createdAt")
> ON CONFLICT ("videoId", "date")
> DO UPDATE SET
>   "views" = EXCLUDED."views",
>   "watchTimeSeconds" = EXCLUDED."watchTimeSeconds";
> ```

---


目前的论文“骨架”很规整，“肉”也是有的（业务流程很清晰），但缺少“筋膜和血管”（代码实现与性能数据）。把这三步做完，这篇论文就达到了可以直接打印送审的级别。

第5章是整篇论文的“肌肉”。答辩老师评估你工作量的唯一标准，就是看这一章有没有**真实的代码、复杂的 SQL、核心的配置参数以及对这些技术细节的工程解释**。目前的版本全是在报文件目录（比如 `app/api/xxx`），这不仅水字数，还会被直接判定为“没有核心工作量”。

以下是为你量身定制的第5章逐节重构计划。你不需要改变现有的章节结构，只需要在对应的位置**插入代码块并配合工程解析**。请直接把这些模板和思路“翻译”成你项目里的真实代码填进去。

---

### 5.1 用户认证与权限控制实现
**当前缺陷：** 只说了用了 Better Auth，没有展现如何进行权限拦截。
**重构动作：展现服务端鉴权的核心逻辑。**

在这一节中，你需要贴出 `requireUserId()` 的核心实现，或者 Next.js 的 `middleware.ts` 路由拦截逻辑，以证明你实现了真正的服务端权限控制，而不是只在前端隐藏按钮。

> **你要补充的内容示范（请替换为你的真实代码）：**
> 为了保障核心业务接口的安全性，系统在业务服务层（`lib/server/auth-session.ts`）封装了严格的身份校验函数 `requireUserId`。该函数不仅解析会话 Token，还会对失效会话进行拦截。核心代码如下：
> ```typescript
> // lib/server/auth-session.ts 核心鉴权逻辑
> export async function requireUserId() {
>   const session = await auth.api.getSession({
>     headers: headers()
>   });
>   if (!session || !session.user) {
>     throw new Error("UNAUTHORIZED"); 
>   }
>   return session.user.id;
> }
> ```
> **工程解析（必须写）：** 通过在所有涉及写操作（如发布评论、发起转码、修改播放列表）的 Server Action 或 Route Handler 首行调用该函数，系统在数据层入口建立了一道强制拦截网，有效防止了越权提交和越权访问。

---

### 5.2 首页浏览与搜索功能实现
**当前缺陷：** 只说了游标分页，没有展示 Prisma 查询逻辑。
**重构动作：展示基于 Prisma 的游标分页（Cursor-based Pagination）核心查询语句。**

视频列表通常数据量大，传统的 `OFFSET/LIMIT` 分页在深度翻页时性能极差。你需要展示你是如何用 Prisma 实现游标分页的。

> **你要补充的内容示范：**
> 首页视频列表加载采用了游标分页（Cursor Pagination）方案，相较于传统的偏移量分页，游标分页在处理千万级视频记录时不会因深度翻页导致全表扫描性能衰减。其核心 Prisma 查询逻辑如下：
> ```typescript
> const videos = await prisma.video.findMany({
>   take: limit + 1, // 多取一条用于判断是否有下一页
>   cursor: cursor ? { id: cursor } : undefined,
>   where: {
>     visibility: 'PUBLIC',
>     processingStatus: 'READY',
>     deletedAt: null,
>   },
>   orderBy: [
>     { publishAt: 'desc' },
>     { id: 'desc' } // 保证排序稳定性
>   ],
>   include: { channel: true }
> });
> ```
> **工程解析：** 查询条件严格限制了只有状态为 `READY` 且 `PUBLIC` 的视频才能进入公开池。通过 `take: limit + 1` 的设计，服务端仅需一次数据库往返即可同时返回当前页数据与 `nextCursor` 标识，降低了数据库连接开销。

---

### 5.4 评论互动功能实现
**当前缺陷：** 只说了“触发器维护计数”，没有展示触发器。
**重构动作：贴出 PostgreSQL 触发器的核心 SQL 语句。**

这是体现你懂关系型数据库高级特性的绝佳位置。展示你是如何用数据库底层的 Trigger 替代应用层的 `+1/-1` 代码，从而避免并发写冲突的。

> **你要补充的内容示范：**
> 在高并发互动场景下，如果在应用层通过 `SELECT` 后再 `UPDATE` 的方式维护视频评论数（`commentsCount`），极易产生脏写和计数丢失。为此，系统将计数逻辑下沉至 PostgreSQL 的触发器中执行。核心 SQL 定义如下：
> ```sql
> CREATE OR REPLACE FUNCTION update_video_comment_count()
> RETURNS TRIGGER AS $$
> BEGIN
>     IF (TG_OP = 'INSERT') THEN
>         UPDATE "Video" SET "commentsCount" = "commentsCount" + 1 
>         WHERE id = NEW."videoId";
>     ELSIF (TG_OP = 'DELETE') THEN
>         UPDATE "Video" SET "commentsCount" = "commentsCount" - 1 
>         WHERE id = OLD."videoId";
>     END IF;
>     RETURN NULL;
> END;
> $$ LANGUAGE plpgsql;
> 
> CREATE TRIGGER trigger_comment_count
> AFTER INSERT OR DELETE ON "Comment"
> FOR EACH ROW EXECUTE FUNCTION update_video_comment_count();
> ```
> **工程解析：** 将统计逻辑封装在触发器中，使得计数更新与评论插入天然处于同一个数据库事务内，不仅彻底解决了并发写入导致的数据不一致问题，还减轻了 Node.js 应用层的计算负担。

---

### 5.7 视频上传与媒体处理流水线实现（全篇核心，重中之重）

这部分是整篇论文技术含量的天花板。你必须分步骤展示底层的 SDK 调用和 FFmpeg 命令。

#### 5.7.1 上传会话与对象存储实现
**重构动作：展示生成 S3 预签名 URL 的核心参数配置。**
> **你要补充的内容示范：**
> 在客户端直传对象存储之前，服务端需通过 AWS SDK v3 生成受限的预签名 URL。为了防止恶意大文件攻击和格式伪造，系统在签名时强制校验了 Content-Type。
> ```typescript
> import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
> import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
> 
> const command = new PutObjectCommand({
>   Bucket: process.env.S3_RAW_BUCKET,
>   Key: `${shortCode}/source.mp4`,
>   ContentType: 'video/mp4', // 强制 MIME 类型，防止任意文件上传
> });
> // 签名有效期设置为 3600 秒
> const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
> ```

#### 5.7.3 转码与 HLS 切片实现（必须逐字手写解析）
**重构动作：贴出真实的 FFmpeg 切片命令，并挨个解释参数。** 这是老师最爱问的地方。
> **你要补充的内容示范：**
> 云函数（Lambda）接收到转码指令后，通过内部调用的 FFmpeg 进程执行 HLS 切片操作。为了在不同带宽环境下提供稳定的播放体验，系统对 H.264 编码参数进行了严格约束。核心执行命令如下：
> ```bash
> ffmpeg -i input.mp4 \
>   -profile:v main -level 4.0 \
>   -c:a aac -ar 48000 -b:a 128k \
>   -hls_time 10 -hls_list_size 0 \
>   -hls_segment_filename "seg_%03d.ts" \
>   -f hls master.m3u8
> ```
> **工程解析：**
> *   `-profile:v main -level 4.0`：采用 Main Profile，确保视频在大部分中低端智能手机和旧版浏览器上均能触发硬件解码。
> *   `-c:a aac -b:a 128k`：统一重采样音频为 48kHz、128kbps 的 AAC 格式，抹平用户原始上传视频的音频编码差异。
> *   `-hls_time 10`：将切片时长固定为 10 秒。时长过短会导致浏览器频繁发送 HTTP 请求引发拥塞，时长过长会导致首屏加载慢和拖拽延迟，10 秒是兼顾首帧耗时与请求频率的工程折中。
> *   `-hls_list_size 0`：指示 FFmpeg 保留所有的切片记录，这是生成点播（VOD）播放列表而非直播列表的关键配置。

#### 5.7.4 封面抽取与状态回写实现
**重构动作：展示内部回调接口（Webhook）如何利用数据库事务（Transaction）保证状态一致性。**
> **你要补充的内容示范：**
> 流水线结束时，系统需同步更新任务状态与视频资源。为防止状态被部分更新，回调接口使用了 Prisma 的 `$transaction` 进行原子化回写。
> ```typescript
> await prisma.$transaction(async (tx) => {
>   // 1. 将流水线任务标记为成功
>   await tx.transcodeJob.update({
>     where: { id: jobId },
>     data: { status: 'SUCCEEDED', finishedAt: new Date() }
>   });
>   // 2. 清理旧资源（支持任务重试的幂等性）
>   await tx.videoAsset.deleteMany({ where: { videoId } });
>   // 3. 写入新的 HLS 资源地址
>   await tx.videoAsset.create({
>     data: { videoId, assetType: 'HLS_MASTER', storageKey: hlsKey, ... }
>   });
>   // 4. 将视频状态对外开放
>   await tx.video.update({
>     where: { id: videoId },
>     data: { processingStatus: 'READY', readyAt: new Date() }
>   });
> });
> ```

---

### 5.9 统计分析模块实现
**当前缺陷：** 提到了存储过程，但没写 SQL，这是严重失分项。
**重构动作：展示 `sp_rollup_daily_stats` 存储过程的核心逻辑。**

这证明了你不仅会用 ORM 写增删改查，还具备处理大批量日志数据的能力。

> **你要补充的内容示范：**
> 播放器前端会持续通过防抖（Debounce）策略上报播放事件，这些散列的原始日志写入 `VideoPlaybackEvent`。为了降低数据大盘的查询延迟，系统每天凌晨执行一次 `sp_rollup_daily_stats` 存储过程进行数据聚合（Rollup）。聚合 SQL 核心部分如下：
> ```sql
> INSERT INTO "VideoDailyStat" ("videoId", "date", "views", "uniqueViewers", "watchTimeSeconds")
> SELECT 
>     "videoId",
>     DATE("createdAt") as stat_date,
>     COUNT(*) as daily_views,
>     COUNT(DISTINCT "sessionId") as daily_unique_viewers,
>     SUM("watchDeltaMs") / 1000 as daily_watch_time
> FROM "VideoPlaybackEvent"
> WHERE "createdAt" >= CURRENT_DATE - INTERVAL '1 day'
> GROUP BY "videoId", DATE("createdAt")
> ON CONFLICT ("videoId", "date") 
> DO UPDATE SET 
>     "views" = EXCLUDED."views",
>     "uniqueViewers" = EXCLUDED."uniqueViewers",
>     "watchTimeSeconds" = EXCLUDED."watchTimeSeconds";
> ```
> **工程解析：** 
> 1. 利用 `COUNT(DISTINCT "sessionId")` 精确统计独立观看人数。
> 2. 使用 PostgreSQL 的 `ON CONFLICT DO UPDATE`（即 Upsert 语义），保证了即使统计任务被重复触发，同一天的数据记录也不会出现主键冲突或数据重复累加，赋予了统计脚本良好的幂等性。

---