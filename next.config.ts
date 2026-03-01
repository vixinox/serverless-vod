import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.pexels.com",
      },
    ],
  },

  /**
   * 开发环境：将 /hls-proxy 和 /img-proxy 反向代理到 LocalStack S3，
   * 使浏览器始终向同源请求，彻底规避 CORS 限制。
   * 生产环境设置 CDN_VIDEO_DOMAIN / CDN_IMAGE_DOMAIN 后这两条规则不生效。
   */
  async rewrites() {
    if (process.env.CDN_VIDEO_DOMAIN && process.env.CDN_IMAGE_DOMAIN) {
      return [];
    }

    const endpoint = (process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566").replace(/\/$/, "");
    const hlsBucket   = process.env.VOD_HLS_BUCKET   ?? "vod-hls";
    const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";

    const rules = [];

    if (!process.env.CDN_VIDEO_DOMAIN) {
      rules.push({
        source:      "/hls-proxy/:path*",
        destination: `${endpoint}/${hlsBucket}/:path*`,
      });
    }

    if (!process.env.CDN_IMAGE_DOMAIN) {
      rules.push({
        source:      "/img-proxy/:path*",
        destination: `${endpoint}/${imageBucket}/:path*`,
      });
    }

    return rules;
  },
};

export default nextConfig;
