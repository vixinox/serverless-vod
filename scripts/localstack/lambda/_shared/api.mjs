/**
 * 共享内部 API 客户端
 *
 * Lambda 通过此辅助函数调用 Next.js 内部 Webhook，
 * 替代直接操作 Prisma，消除跨平台 Query Engine 兼容性问题。
 *
 * 环境变量：
 *   NEXT_API_BASE_URL  — Next.js 服务地址（本地开发时为 http://host.docker.internal:3000）
 *   INTERNAL_API_SECRET — 与 Next.js 约定的内部调用共享密钥
 */

const BASE_URL = process.env.NEXT_API_BASE_URL ?? "http://host.docker.internal:3000";
const SECRET   = process.env.INTERNAL_API_SECRET ?? "";

/**
 * 向 Next.js 内部 API 发送 POST 请求。
 * 失败时抛出错误，让 Step Functions 的 Retry/Catch 机制介入。
 *
 * @param {string} path  — API 路径，例如 "/api/internal/vod/mark-failed"
 * @param {Record<string, unknown>} body — 请求体
 */
export async function callInternalApi(path, body) {
  const url = `${BASE_URL}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        // Bearer 方案与 Next.js API 侧保持一致
        "Authorization": `Bearer ${SECRET}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    // 网络层故障（DNS 解析失败、连接拒绝等）直接抛出，触发状态机 Retry
    throw new Error(`[internal-api] 网络错误 ${path}: ${networkErr.message}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = JSON.stringify(json);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      `[internal-api] HTTP ${res.status} ${path}: ${detail}`,
    );
  }

  return res.json();
}
