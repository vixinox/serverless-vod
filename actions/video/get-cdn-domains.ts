'use server'

/**
 * 返回 LocalStack 存储桶的公开访问基础 URL。
 *
 * 生产环境可通过 CDN_VIDEO_DOMAIN / CDN_IMAGE_DOMAIN 覆盖。
 * 开发环境默认指向本机 LocalStack。
 */
export async function getCdnDomains(): Promise<{
  videoDomain: string;
  imageDomain: string;
}> {
  // 生产环境：使用外部 CDN 域名
  // 开发环境：返回相对路径（Next.js rewrites 代理到 LocalStack），浏览器同源请求无 CORS
  const videoDomain = process.env.CDN_VIDEO_DOMAIN
    ? `https://${process.env.CDN_VIDEO_DOMAIN}`
    : `/hls-proxy`;

  const imageDomain = process.env.CDN_IMAGE_DOMAIN
    ? `https://${process.env.CDN_IMAGE_DOMAIN}`
    : `/img-proxy`;

  return { videoDomain, imageDomain };
}
