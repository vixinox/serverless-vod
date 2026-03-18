import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "localhost",
  ],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.pexels.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "4566",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "4566",
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
