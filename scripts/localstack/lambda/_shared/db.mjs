/**
 * @deprecated 已废弃 — 请勿在 Lambda 中使用。
 *
 * 新架构下 Lambda 已全面迁移为 HTTP Thin Client（见 _shared/api.mjs）。
 * Prisma 直连数据库逻辑统一移至 Next.js 内部 API 路由中：
 *   POST /api/internal/vod/update-metadata
 *   POST /api/internal/vod/mark-failed
 *   POST /api/internal/vod/finalize
 *
 * 此文件保留仅作历史参考，不再被任何 Lambda 函数导入。
 */
throw new Error(
  "[db.mjs] 此模块已废弃。Lambda 应通过 _shared/api.mjs 的 callInternalApi() 调用 Next.js 内部 API，而非直接连接数据库。",
);
