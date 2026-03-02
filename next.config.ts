import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    // 允许 127.0.0.1 直接访问（与 localhost 互为别名，但浏览器视为不同源）
    "http://127.0.0.1:3000",
    "127.0.0.1",
    // 显式允许 localhost（devcontainer 端口转发后有时以 localhost 发起跨域请求）
    "http://localhost:3000",
    "localhost",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.pexels.com",
      },
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "./videos/**",
      "./scripts/**",
      "./docs/**",
      "./prisma/**",
    ],
  },
};

export default nextConfig;
