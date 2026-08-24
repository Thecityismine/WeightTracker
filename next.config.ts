import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds a
  // stray package-lock.json in the home directory.
  turbopack: {
    root: path.resolve(__dirname),
  },

  images: {
    // Label photos are served from Firebase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "*.firebasestorage.app" },
    ],
  },
};

export default nextConfig;
