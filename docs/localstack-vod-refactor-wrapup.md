# LocalStack VOD 重构收尾与 Next.js CRUD 增强建议

本文用于收尾上一轮 LocalStack VOD 管道重构，给出当前收益、已落地范围，以及 Next.js 端可继续新增的 CRUD 能力，目标是让上传到播放的状态展示更丝滑、更可恢复。

## 1. 本次重构总结

### 1.1 核心目标与结果

1. 降低内存风险。
说明：S3 下载改为流式落盘，避免大文件整块读入内存。

2. 提升长视频上传吞吐。
说明：HLS 目录上传从串行改为有界并发，支持 `UPLOAD_CONCURRENCY` 控制。

3. 控制 ffmpeg 日志内存占用。
说明：stderr 改为尾部截断缓存，避免长任务期间字符串无限增长。

4. 强化失败收敛一致性。
说明：状态机 `MarkFailed` 增加重试，`mark-failed` 对缺失错误字段做兜底回退。

5. 建立僵尸任务对账能力。
说明：新增内部接口与脚本，可将超时卡住的 `QUEUED/RUNNING` 任务收敛到 `FAILED`。

### 1.2 已落地改动清单

1. `scripts/localstack/lambda/_shared/s3.mjs`
说明：`downloadObject` 支持流式下载；`uploadDirectory` 改为文件收集 + worker 并发上传；并发由 `UPLOAD_CONCURRENCY` 控制（默认 8，最大 32）。

2. `scripts/localstack/lambda/transcode/index.mjs`
说明：`ffmpeg/ffprobe` stderr 使用尾部缓存；转码日志级别降低到 warning；失败时保留可诊断 tail。

3. `scripts/localstack/deploy-sfn.mjs`
说明：`MarkFailed` 任务增加 Retry 策略（指数退避），提升失败路径最终一致性。

4. `scripts/localstack/lambda/mark-failed/index.mjs`
说明：兼容多输入形态，优先读取顶层 `error/cause`，缺失时回退 `errorInfo`，避免二次失败。

5. `app/api/internal/vod/reconcile-stale/route.ts`
说明：新增 stale job 对账 API，支持 `dryRun`、阈值分钟、limit，并避免误伤仍有活跃任务的视频。

6. `scripts/localstack/benchmark-jobs.mjs` 与 `scripts/localstack/reconcile-stale.mjs`
说明：新增运维脚本，分别用于基线统计与手工对账。

7. `package.json`
说明：新增 `localstack:benchmark`、`localstack:reconcile-stale` 等脚本入口，便于重复执行。

## 2. 对 Next.js 展示层的直接收益

1. 阶段信号更稳定。
说明：前端可基于 `pipelineStage` 做里程碑式进度展示，不依赖高频百分比回调。

2. 失败状态更快收敛。
说明：失败链路重试后更容易最终落到 `FAILED`，减少 UI 长时间停留在 `PROCESSING`。

3. 长视频体验更可控。
说明：并发上传降低尾段等待，用户在“转码完成到可播放”的等待感更短。

4. 运维闭环更完整。
说明：出现僵尸任务时，可通过接口或脚本纠偏，前端状态不会长期卡住。

## 3. 建议新增的 Next.js CRUD（面向“更丝滑展示”）

下面的 CRUD 不是替代现有流程，而是在当前重构基础上补齐“可观测、可恢复、可解释”的交互。

### 3.1 手动重试失败任务（Create）

1. 目标。
说明：当视频处于 `FAILED` 时，一键创建新的转码任务并重新触发状态机。

2. 建议接口。
说明：`POST /api/studio/videos/[videoId]/jobs`，语义为创建新 job（retry）。

3. UI 收益。
说明：避免用户删除重传，提升失败后的恢复效率。

### 3.2 取消进行中任务（Update）

1. 目标。
说明：支持在 `QUEUED/RUNNING` 时取消任务，并将状态更新为 `CANCELLED` 或 `FAILED(cancelled by user)`。

2. 建议接口。
说明：`PATCH /api/studio/jobs/[jobId]`，body: `{ action: "cancel" }`。

3. UI 收益。
说明：用户可主动止损，避免误上传大文件后被动等待。

### 3.3 软删除任务历史（Delete）

1. 目标。
说明：对历史失败噪声做清理，但保留审计字段（软删除或归档）。

2. 建议接口。
说明：`DELETE /api/studio/jobs/[jobId]`，仅删除展示可见性，不影响视频主数据。

3. UI 收益。
说明：工作室列表更干净，异常批次不再持续干扰运营视图。

### 3.4 管理端对账触发（Create）

1. 目标。
说明：将现有 `reconcile-stale` 能力前置到管理页按钮，带 `dryRun` 预览。

2. 建议接口。
说明：`POST /api/studio/admin/reconcile-stale`，转发调用内部对账逻辑。

3. UI 收益。
说明：无需 CLI 即可恢复卡住状态，适合非工程角色进行日常巡检。

### 3.5 阶段备注维护（Update）

1. 目标。
说明：为 `FAILED` 任务补充人工备注（例如素材异常、版权问题、编码不支持）。

2. 建议接口。
说明：`PATCH /api/studio/jobs/[jobId]/note`。

3. UI 收益。
说明：失败原因可读性提升，团队协作与客服反馈更顺畅。

## 4. 推荐落地顺序

1. 先做 Read：Job Timeline 查询。
说明：最小成本提升可解释性。

2. 再做 Create：失败任务重试。
说明：直接提升恢复效率。

3. 再做 Update：取消任务、失败备注。
说明：提升控制力和协作效率。

4. 最后做 Delete：历史软删除。
说明：属于体验优化，不阻塞主链路。

## 5. 验收建议

1. 正常链路。
说明：SHORT/LONG 各 1 条上传，检查 timeline 是否完整覆盖关键 stage。

2. 失败链路。
说明：构造转码失败，验证“失败可见 + 一键重试 + 状态收敛”。

3. 僵尸链路。
说明：手动制造超时任务，验证管理端 dry-run 与正式 reconcile 结果一致。

4. 交互一致性。
说明：列表页、详情页、播放器页对同一任务状态的文案和动作保持统一。
