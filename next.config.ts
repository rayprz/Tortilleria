import type { NextConfig } from "next";

// When building for GitHub Pages the site is served from
// https://<user>.github.io/Tortilleria/, so it needs a base path.
// Local dev and other hosts serve from the root.
const isPages = process.env.GITHUB_PAGES === "true";
const repoBase = "/Tortilleria";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isPages ? repoBase : "",
  assetPrefix: isPages ? `${repoBase}/` : "",
  images: { unoptimized: true },
};

export default nextConfig;
