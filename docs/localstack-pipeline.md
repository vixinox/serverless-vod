# LocalStack Lambda + SQS HLS 管道（答辩演示版）

## 1. 环境变量

建议在 `.env.local` 中配置：

```env
DATABASE_URL=postgresql://...

AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
LOCALSTACK_ENDPOINT=http://127.0.0.1:4566
LOCALSTACK_SERVICES=s3,sqs

VOD_RAW_BUCKET=vod-raw
VOD_HLS_BUCKET=vod-hls
VOD_TRANSCODE_QUEUE_NAME=vod-transcode
VOD_HLS_PUBLIC_READ=true
VOD_HLS_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Windows 可选：如果 ffmpeg 不在 PATH
# FFMPEG_BIN=C:\\tools\\ffmpeg\\bin\\ffmpeg.exe
```

说明：
- `localstack:bootstrap` 会为 HLS 桶写入 CORS。
- 若 `VOD_HLS_PUBLIC_READ=true`，会写入公开读策略，方便 hls.js 直接播放切片。

## 2. 启动顺序

1. 启动依赖

```bash
docker compose up -d
```

2. 初始化 LocalStack 资源

```bash
npm run localstack:bootstrap
```

3. 启动 Next 服务

```bash
npm run dev
```

4. 启动 transcode worker（模拟 Lambda 消费 SQS）

```bash
npm run localstack:worker
```

## 3. 业务流程 API

### 初始化上传（拿 presign）

`POST /api/videos/upload/init`

请求体示例：

```json
{
  "title": "demo-video",
  "filename": "demo.mp4",
  "contentType": "video/mp4",
  "videoType": "LONG"
}
```

返回：`videoId`、`uploadSessionId`、`upload.presignedUrl`。

### 完成上传并入队

前端 PUT 到 presignedUrl 成功后，调用：

`POST /api/videos/upload/complete`

请求体示例：

```json
{
  "videoId": "...",
  "uploadSessionId": "..."
}
```

### 查询状态

`GET /api/videos/status/:videoId`

或（前端只拿 shortCode 的场景）：

`GET /api/videos/status/shortcode/:shortCode`

当 `processingStatus = READY` 时会返回 `playbackUrl`（master.m3u8 的签名地址）。

## 4. 演示建议

- 先用 10~20 秒短视频做一次上传。
- 页面轮询状态直到 `READY`。
- 演示 S3 内存在 `hls/<shortCode>/master.m3u8` 与分片文件。
- 如果只想先验证 worker，可手动上传视频到 raw bucket，再直接调用 complete API 触发任务。

## 5. 前端播放器地址策略

- 若设置了 `VIDEO_CLOUDFRONT_DOMAIN`：播放地址为 `https://<domain>/hls/<shortCode>/master.m3u8`。
- 未设置时：播放地址为 `http://127.0.0.1:4566/<hls-bucket>/hls/<shortCode>/master.m3u8`。