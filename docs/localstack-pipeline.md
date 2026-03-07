# LocalStack Lambda + Step Functions HLS 管道

## 1. 环境变量

在 `.env.local` 中配置：

```env
DATABASE_URL=postgresql://...

AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
LOCALSTACK_ENDPOINT=http://localhost:4566

VOD_RAW_BUCKET=vod-raw
VOD_HLS_BUCKET=vod-hls
VOD_IMAGE_BUCKET=vod-image
VOD_HLS_PUBLIC_READ=true
VOD_IMAGE_PUBLIC_READ=true
VOD_S3_CORS_ORIGINS=http://localhost:3000

# 运行 localstack:setup 后自动输出，复制到此处：
VOD_SFN_STATE_MACHINE_ARN=arn:aws:states:us-east-1:000000000000:stateMachine:vod-transcode

# 生产环境可选：封面图 CDN 域名，未配置时回退到 LocalStack 直连 URL
# VIDEO_IMAGE_CDN_DOMAIN=your-cloudfront-domain.cloudfront.net

# Windows 可选：如果 ffmpeg 不在 PATH
# FFMPEG_BIN=C:\tools\ffmpeg\bin\ffmpeg.exe

# 可选：HLS 分片上传并发度（默认 8，最大 32）
# UPLOAD_CONCURRENCY=12

# 可选：ffmpeg/ffprobe stderr 内存尾部保留字符数（默认 12000）
# FFMPEG_STDERR_TAIL_CHARS=12000

# 可选：僵尸任务纠偏阈值（分钟，默认 45）
# VOD_STALE_PROCESSING_MINUTES=45
```

## 2. 管道架构

```
上传完成
   complete API
        SFN StartExecution
             Lambda: vod-extract-metadata   标记 TranscodeJob RUNNING / Video PROCESSING
                                            发布 pipeline.stage { stage: "job_started" }
             Lambda: vod-transcode          ffmpeg 转码 + 上传 vod-hls（重试 3 次）
                                            + ffmpeg 截取封面缩略图 + 上传 vod-image
                                            每个阶段发布 pipeline.stage 事件
             Lambda: vod-finalize           写 VideoAsset(HLS_MASTER + THUMBNAIL)
                                            更新 Video.thumbnail / 标记 READY
                   (任意步骤失败)
                   Lambda: vod-mark-failed  标记 FAILED（失败重试 5 次）
```

S3 路径约定：

| 桶 | 路径 | 说明 |
|----|------|------|
| `vod-raw` | `{shortCode}/source.mp4` | 上传的原始视频 |
| `vod-hls` | `{shortCode}/master.m3u8` | HLS 主清单 |
| `vod-hls` | `{shortCode}/{variant}/seg_*.ts` | 切片（LONG 视频含 source/720p 两个子目录）|
| `vod-image` | `thumbnails/{shortCode}/thumbnail.jpg` | ffmpeg 截取的封面缩略图 |

## 3. 流水线阶段事件

`vod-transcode` Lambda 在每个关键里程碑处向 EventBridge（`vod-events` 总线）发布
`pipeline.stage` 事件，并回调 `/api/internal/vod/stage` 写入 `TranscodeJob.pipelineStage`。

| stage 值 | 含义 |
|----------|------|
| `job_started` | extract-metadata：TranscodeJob 置为 RUNNING |
| `downloading` | transcode：开始从 S3 下载源视频 |
| `probing` | transcode：ffprobe 探测元数据（时长、分辨率）|
| `transcoding` | transcode：ffmpeg 开始编码 |
| `uploading_segments` | transcode：HLS 切片上传到 vod-hls |
| `thumbnail_extracting` | transcode：ffmpeg 截取封面帧 |
| `thumbnail_uploading` | transcode：封面图上传到 vod-image |

> 注意：不再使用实时百分比进度（`progressPct`），`TranscodeJob.progressPct` 字段
> 已从 schema 移除，替换为 `pipelineStage String?`。

## 3.1 失败路径收敛说明

- `ExtractMetadata` / `Transcode` / `Finalize` 任一阶段失败后，统一经 `Catch -> MarkFailed`。
- `MarkFailed` 在状态机内置重试（间隔 3 秒、最多 5 次、指数退避）。
- `mark-failed` Lambda 对 `error/cause` 做兜底解析：优先读顶层字段，缺失时回退 `errorInfo`。

## 4. 元数据采集

- **时长**：ffprobe 从 `vod-raw/{shortCode}/source.mp4` 提取，优先读取视频流 `duration`，
  回退到容器格式 `format.duration`，写入 `Video.duration`（秒）。
- **分辨率**：宽高写入 `VideoAsset(HLS_MASTER)` 的 `width/height` 字段。
- **封面缩略图**：ffmpeg 在视频时长 5% 处（最少 1 秒，最多 30 秒）截取一帧 JPEG，
  最大宽度缩放到 1280px，上传至 `vod-image/thumbnails/{shortCode}/thumbnail.jpg`。
  截图路径写入 `VideoAsset(THUMBNAIL)` 并更新 `Video.thumbnail` URL。
  截图失败时以 `console.warn` 记录并继续，**不阻断**转码主流程。

## 5. 启动顺序

```bash
# 1. 启动 Docker 服务
docker compose up -d

# 2. 一键初始化 LocalStack（S3 桶 + IAM 角色 + Lambda + 状态机）
npm run localstack:setup

# 3. 从 localstack:setup 的终端输出复制 ARN 到 .env.local
#    VOD_SFN_STATE_MACHINE_ARN=arn:aws:states:...

# 4. 启动 Next.js
npm run dev
```

上传视频后，complete API 直接触发 Step Functions，无需额外进程。

## 6. 分步部署命令

```bash
npm run localstack:bootstrap      # 仅初始化 S3 桶 + IAM 角色
npm run localstack:deploy-lambda  # 仅部署/更新 4 个 Lambda 函数
npm run localstack:deploy-sfn     # 仅更新状态机定义
npm run localstack:reconcile-stale # 手动执行僵尸任务纠偏
npm run localstack:benchmark      # 输出 SHORT/LONG 最近成功任务基线耗时
npm run localstack:setup          # 上述三步一次完成
```

修改 Lambda 代码后只需重新运行 `localstack:deploy-lambda`；修改状态机流程后运行 `localstack:deploy-sfn`。

## 7. 内部 API 端点

| 端点 | 说明 |
|------|------|
| `POST /api/internal/vod/update-metadata` | extract-metadata 回调：置 RUNNING/PROCESSING |
| `POST /api/internal/vod/stage` | transcode 各阶段回调：写 `pipelineStage` |
| `POST /api/internal/vod/finalize` | finalize 回调：写 VideoAsset / 置 READY |
| `POST /api/internal/vod/mark-failed` | mark-failed 回调：置 FAILED |
| `POST /api/internal/vod/reconcile-stale` | 纠偏长时间卡住的 QUEUED/RUNNING 任务，收敛到 FAILED |

## 7.1 僵尸任务纠偏

- 触发方式：`npm run localstack:reconcile-stale`
- Dry-run：`node scripts/localstack/reconcile-stale.mjs --dry-run --stale-minutes=45 --limit=200`
- 行为：将超过阈值仍处于 `QUEUED/RUNNING` 的任务置为 `FAILED`，并将无其他活跃任务的 `PROCESSING` 视频收敛到 `FAILED`

## 7.2 基线统计

- 命令：`npm run localstack:benchmark`
- 指定样本：`node scripts/localstack/benchmark-jobs.mjs --short-code-short=<SHORT_CODE> --short-code-long=<LONG_CODE>`
- 指标：
  - `queueSeconds` = `queuedAt -> startedAt`
  - `processingSeconds` = `startedAt -> finishedAt`
  - `wallSeconds` = `queuedAt -> finishedAt`

## 8. 查询转码状态

前端轮询 `getPipelineStatus(shortCode)` Server Action，返回：

```typescript
type PipelineStatus = {
  processingStatus: string;   // UPLOADING | PROCESSING | READY | FAILED
  jobStatus: string | null;   // QUEUED | RUNNING | SUCCEEDED | FAILED
  pipelineStage: string | null; // 当前阶段（见上表），RUNNING 时有意义
  // ...其他字段
};
```

当 `processingStatus === "READY"` 时可通过 `Video.thumbnail` 获取封面 URL，
通过 VideoAsset(HLS_MASTER) 获取播放地址。

## 9. 前端播放器地址策略

- 设置了 `VIDEO_CLOUDFRONT_DOMAIN`：`https://<domain>/<shortCode>/master.m3u8`
- 未设置时（本地开发）：`http://localhost:4566/vod-hls/<shortCode>/master.m3u8`

封面图地址策略：

- 设置了 `VIDEO_IMAGE_CDN_DOMAIN`：`https://<domain>/thumbnails/<shortCode>/thumbnail.jpg`
- 未设置时（本地开发）：`http://localhost:4566/vod-image/thumbnails/<shortCode>/thumbnail.jpg`
