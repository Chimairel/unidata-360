import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "path";
import { loadEnvFile } from "node:process";

for (const name of [".env.local", ".env"]) {
  const file = path.join(__dirname, "backend", name);
  if (existsSync(file)) loadEnvFile(file);
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
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
