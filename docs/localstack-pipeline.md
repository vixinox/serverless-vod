# LocalStack Lambda + Step Functions HLS 管道

## 1. 环境变量

在 `.env.local` 中配置：

```env
DATABASE_URL=postgresql://...

AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
LOCALSTACK_ENDPOINT=http://127.0.0.1:4566

VOD_RAW_BUCKET=vod-raw
VOD_HLS_BUCKET=vod-hls
VOD_IMAGE_BUCKET=vod-image
VOD_HLS_PUBLIC_READ=true
VOD_S3_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# 运行 localstack:setup 后自动输出，复制到此处：
VOD_SFN_STATE_MACHINE_ARN=arn:aws:states:us-east-1:000000000000:stateMachine:vod-transcode

# Windows 可选：如果 ffmpeg 不在 PATH
# FFMPEG_BIN=C:\tools\ffmpeg\bin\ffmpeg.exe
```

## 2. 管道架构

```
上传完成
   complete API
        SFN StartExecution
             Lambda: vod-extract-metadata   标记 TranscodeJob RUNNING / Video PROCESSING
             Lambda: vod-transcode          ffmpeg 转码 + 上传 vod-hls（重试 3 次）
             Lambda: vod-finalize           写 VideoAsset / 标记 READY
                   (任意步骤失败)
                   Lambda: vod-mark-failed  标记 FAILED
```

S3 路径约定：

| 桶 | 路径 | 说明 |
|----|------|------|
| `vod-raw` | `{shortCode}/source.mp4` | 上传的原始视频 |
| `vod-hls` | `{shortCode}/master.m3u8` | HLS 主清单 |
| `vod-hls` | `{shortCode}/{variant}/seg_*.ts` | 切片（LONG 视频含 source/720p 两个子目录）|
| `vod-image` | `thumbnails/{shortCode}/thumbnail.{ext}` | 缩略图 |

## 3. 启动顺序

```bash
# 1. 启动 Docker 服务
docker compose up -d

# 2. 一键初始化 LocalStack（S3 桶 + IAM 角色 + Lambda + 状态机）
npm run localstack:setup

# 3. 将输出的 ARN 写入 .env.local
#    VOD_SFN_STATE_MACHINE_ARN=arn:aws:states:...

# 4. 启动 Next.js
npm run dev
```

上传视频后，complete API 直接触发 Step Functions，无需额外进程。

## 4. 分步部署命令

```bash
npm run localstack:bootstrap      # 仅初始化 S3 桶 + IAM 角色
npm run localstack:deploy-lambda  # 仅部署/更新 4 个 Lambda 函数
npm run localstack:deploy-sfn     # 仅更新状态机定义
npm run localstack:setup          # 上述三步一次完成
```

修改 Lambda 代码后只需重新运行 `localstack:deploy-lambda`；修改状态机流程后运行 `localstack:deploy-sfn`。

## 5. 查询转码状态

前端轮询：

```
GET /api/videos/status/shortcode/:shortCode
```

当 `processingStatus === "READY"` 时返回 `playbackUrl`（HLS 地址）。

## 6. 前端播放器地址策略

- 设置了 `VIDEO_CLOUDFRONT_DOMAIN`：`https://<domain>/<shortCode>/master.m3u8`
- 未设置时（本地开发）：`http://127.0.0.1:4566/vod-hls/<shortCode>/master.m3u8`
