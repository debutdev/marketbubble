import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        hostname: "polymarket-upload.s3.us-east-2.amazonaws.com",
        protocol: "https",
      },
      {
        hostname: "i.scdn.co",
        protocol: "https",
      },
      {
        hostname: "image-cdn-ak.spotifycdn.com",
        protocol: "https",
      },
      {
        hostname: "image-cdn-fa.spotifycdn.com",
        protocol: "https",
      },
      {
        hostname: "unavatar.io",
        protocol: "https",
      },
      {
        hostname: "pbs.twimg.com",
        protocol: "https",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
