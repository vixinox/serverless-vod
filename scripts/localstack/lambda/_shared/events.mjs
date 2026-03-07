/**
 * 共享 EventBridge 客户端
 *
 * Lambda 通过此模块向自定义事件总线发布转码管道事件。
 * 失败时仅记录警告，不抛出异常，不阻塞主流程。
 *
 * 环境变量：
 *   VOD_EVENT_BUS        — EventBridge 事件总线名称（默认 vod-events）
 *   LOCALSTACK_ENDPOINT  — LocalStack 端点
 *   AWS_DEFAULT_REGION   — 区域
 */
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const region   = process.env.AWS_DEFAULT_REGION  ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
const eventBus = process.env.VOD_EVENT_BUS       ?? "vod-events";

const client = new EventBridgeClient({
  region,
  endpoint,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

/**
 * 向 vod-events 事件总线发布一条事件。
 * 失败时静默降级（仅 console.warn），不影响转码主流程。
 *
 * @param {string} detailType  事件类型，例如 "transcode.progress"
 * @param {Record<string, unknown>} detail  事件详情（会自动追加 ts 时间戳）
 */
export async function emitEvent(detailType, detail) {
  try {
    const res = await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: eventBus,
            Source:       "vod.pipeline",
            DetailType:   detailType,
            Detail:       JSON.stringify({ ...detail, ts: Date.now() }),
          },
        ],
      }),
    );
    if (res.FailedEntryCount) {
      console.warn(`[events] PutEvents 部分失败 (${detailType}):`, JSON.stringify(res.Entries));
    }
  } catch (err) {
    console.warn(`[events] EventBridge PutEvents 跳过 (${detailType}): ${err.message}`);
  }
}
