import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
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
