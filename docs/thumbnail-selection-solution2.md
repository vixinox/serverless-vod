# 封面图选取工具方案（方案2：仅传时间点，后端/Lambda 截帧）

## 1. 目标与结论

### 目标
- 用户在前端播放器中选择某一时刻作为封面。
- 前端只提交“时间点”，不上传截图文件。
- 后端/Lambda 基于源视频截帧并上传到 S3，更新视频封面。

### 结论
采用 **方案2（只传时间点，后端截帧）** 作为主方案。

### 选择理由
- 一致性：封面生成由服务端统一执行，避免不同浏览器/设备截帧差异。
- 可靠性：不依赖前端 `canvas`/跨域解码，减少客户端失败面。
- 安全性：避免客户端可篡改图片内容，后端可统一鉴权和审计。
- 带宽成本：前端无需上传截图文件，仅上传时间点参数。
- 复用现有能力：当前 `transcode` Lambda 已具备 ffmpeg 截图与上传能力，可扩展复用。

---

## 2. 范围（MVP）

### 本次包含
- 前端：在编辑页提供“时间点预览 + 选择封面时刻 + 提交”。
- 后端：新增“提交封面时间点”接口，触发截图任务。
- Lambda：按指定秒数截帧，上传到固定封面 Key。
- 数据库：记录封面来源与手动选取时间，防止后续自动流程覆盖。

### 本次不包含
- AI 自动选帧。
- 多张候选封面智能评分。
- 历史封面版本管理 UI。

---

## 3. 端到端流程

1. 用户打开视频编辑页，播放器加载 HLS。
2. 用户拖动到目标时刻，点击“设为封面”。
3. 前端调用 server action/API，提交：`shortCode` + `selectedAtSec`。
4. 后端鉴权并校验参数后，触发“手动封面截帧任务”（可直接调用 Lambda 或发消息）。
5. Lambda 从 `vod-raw/{shortCode}/source.mp4` 按时间点截帧。
6. Lambda 上传到：`vod-image/thumbnails/{shortCode}/thumbnail.jpg`（固定 Key）。
7. 后端更新 `Video.thumbnail` 和 `VideoAsset(THUMBNAIL)`，记录封面模式为手动。
8. 前端刷新预览，提示保存成功。

---

## 4. 接口设计（建议）

## 4.1 前端 -> 后端

`POST /api/video/{shortCode}/thumbnail/select`

请求体：

```json
{
  "selectedAtSec": 37
}
```

响应体：

```json
{
  "success": true,
  "thumbnail": "https://.../thumbnails/{shortCode}/thumbnail.jpg",
  "selectedAtSec": 37,
  "mode": "MANUAL"
}
```

## 4.2 校验规则
- `selectedAtSec` 必须是整数或可安全取整的正数。
- 下限：`>= 0`。
- 上限：`<= duration`（未知时可先接受，Lambda 内二次兜底）。
- 仅视频所有者可调用。

---

## 5. 数据模型改造（建议）

在 `Video` 增加字段：
- `thumbnailMode`：`AUTO | MANUAL`（默认 `AUTO`）
- `manualThumbnailAtSec`：`Int?`
- `thumbnailUpdatedAt`：`DateTime?`

说明：
- 当用户手动选封面成功后：
  - `thumbnailMode = MANUAL`
  - `manualThumbnailAtSec = selectedAtSec`
  - `thumbnailUpdatedAt = now()`

---

## 6. 与现有转码管道的衔接

当前管道在 finalize 阶段会写 `Video.thumbnail`。为避免覆盖手动封面，增加规则：

- 若 `Video.thumbnailMode = MANUAL`：
  - 自动流程（转码 finalize）**不覆盖** `Video.thumbnail`。
  - 仅更新 HLS 资产与状态字段。

- 若 `Video.thumbnailMode = AUTO`：
  - 按现有流程写自动生成封面。

---

## 7. Lambda 截帧策略（手动模式）

输入参数：
- `shortCode`
- `selectedAtSec`
- `requestedBy`

执行策略：
- 使用 `ffmpeg -ss <selectedAtSec> -i source.mp4 -frames:v 1 ...`。
- 若截帧失败，进行一次兜底（例如向前回退 1~2 秒重试）。
- 输出统一为 JPEG（`thumbnail.jpg`），保持链路简化。

输出：
- `thumbnailBucket`
- `thumbnailKey`
- `selectedAtSec`

---

## 8. 缓存与刷新策略（必须）

因为封面使用固定 Key，必须处理缓存：

- 推荐 URL 增加版本参数：
  - `.../thumbnail.jpg?v=<thumbnailUpdatedAt 或时间戳>`
- 或在 CDN 执行失效。

MVP 建议：优先使用版本参数，改造最小。

---

## 9. 异常与边界情况清单

- 视频仍在 `UPLOADING/PROCESSING`：拒绝手动选封面，提示“处理完成后可设置”。
- `selectedAtSec` 超出时长：自动 clamp 到 `duration - 1`（最小 0）。
- 视频时长未知：先按输入执行，失败时返回可读错误。
- 连续快速点击：后端做幂等/互斥（同视频同秒可去重）。
- S3 上传成功但 DB 更新失败：需要补偿或重试机制。
- DB 更新成功但前端未刷新：返回最新 `thumbnail` 供前端立即替换。
- 非所有者调用：返回 403。

---

## 10. 验收标准（MVP）

- 用户可在编辑页选择时刻并设置封面。
- 前端不上传图片文件，仅发送时间点。
- S3 中目标封面对象被更新。
- `Video.thumbnail` 与 `VideoAsset(THUMBNAIL)` 更新成功。
- 手动封面不会被后续自动 finalize 覆盖。
- 刷新页面后封面稳定显示最新版本。

---

## 11. 实施顺序（建议）

1. Prisma 增字段 + 迁移。
2. 新增后端“选择封面时间点”接口。
3. 扩展 Lambda：支持按传入秒数截帧。
4. 前端编辑页增加“选时刻设封面”交互。
5. finalize 逻辑增加 `MANUAL` 保护分支。
6. 增加缓存版本参数并联调。

---

## 12. 回滚策略

若手动封面功能上线后异常，可快速降级：
- 前端隐藏“设为封面”入口。
- 后端接口返回 `501` 或 feature flag 关闭。
- 现有自动封面流程保持可用。
