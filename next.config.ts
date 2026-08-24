import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds a
  // stray package-lock.json in the home directory.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // firebase-admin must not be bundled: it is CommonJS with native-ish deps,
  // and bundling it is what surfaced jwks-rsa's require() of ESM-only jose.
  // The jose override in package.json pins the dual-format v5; this keeps
  // Node resolving the package normally on top of that.
  serverExternalPackages: ["firebase-admin"],

  images: {
    // Label photos are served from Firebase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "*.firebasestorage.app" },
    ],
  },
};

export default nextConfig;
