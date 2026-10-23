import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // Allow the current LAN preview address used by phones on the same Wi-Fi.
  allowedDevOrigins: ["192.168.50.68"],
  output: isGitHubPages ? "export" : "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  ...(isGitHubPages ? { trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
