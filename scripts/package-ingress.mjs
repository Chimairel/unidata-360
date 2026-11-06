import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";

const origin = process.argv[2];
const railway = new URL(origin ?? "https://invalid.example");
if (
  origin !== railway.origin ||
  railway.protocol !== "https:" ||
  !railway.hostname.endsWith(".up.railway.app")
) {
  throw new Error(
    "Supply the Railway service's exact HTTPS origin without a trailing slash.",
  );
}

await mkdir("tmp", { recursive: true });
const directory = await mkdtemp(join("tmp", "ingress-"));
await mkdir(join(directory, "public"));
await writeFile(
  join(directory, "public", "robots.txt"),
  "User-agent: *\nDisallow: /\n",
);
await writeFile(
  join(directory, "vercel.json"),
  JSON.stringify(
    {
      framework: null,
      outputDirectory: "public",
      headers: [
        {
          source: "/api/:path*",
          headers: [{ key: "x-vercel-enable-rewrite-caching", value: "0" }],
        },
      ],
      rewrites: [
        { source: "/", destination: railway.origin + "/" },
        { source: "/:path*", destination: railway.origin + "/:path*" },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(directory);
