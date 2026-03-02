'use server'

const endpoint = (process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566").replace(/\/$/, "");

/**
 * 返回存储桶的公开访问基础 URL。
 *
 * 生产环境通过 CDN_VIDEO_DOMAIN / CDN_IMAGE_DOMAIN 覆盖；
 * 开发环境直接指向本机 LocalStack（依赖 VOD_S3_CORS_ORIGINS 允许跨域）。
 */
export async function getCdnDomains(): Promise<{
  videoDomain: string;
  imageDomain: string;
}> {
  const videoDomain = process.env.CDN_VIDEO_DOMAIN
    ? `https://${process.env.CDN_VIDEO_DOMAIN}`
    : `${endpoint}/${process.env.VOD_HLS_BUCKET ?? "vod-hls"}`;

  const imageDomain = process.env.CDN_IMAGE_DOMAIN
    ? `https://${process.env.CDN_IMAGE_DOMAIN}`
    : `${endpoint}/${process.env.VOD_IMAGE_BUCKET ?? "vod-image"}`;

  return { videoDomain, imageDomain };
}
