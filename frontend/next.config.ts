import type { NextConfig } from "next";
import path from "path";

const backendUrl = process.env.BACKEND_URL || "http://localhost:3006";
const backend = URL.parse(backendUrl);
if (
  !backend ||
  !["http:", "https:"].includes(backend.protocol) ||
  backend.origin !== backendUrl ||
  backend.username ||
  backend.password ||
  (["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname) &&
    backend.port === "3005")
) {
  throw new Error(
    "BACKEND_URL must be the backend's HTTP(S) origin, without a trailing slash.",
  );
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  async rewrites() {
    return [{ source: "/api/:path*", destination: backendUrl + "/api/:path*" }];
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
