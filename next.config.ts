import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  ...(process.env.STUDIO_DESKTOP_EXPORT === '1' ? { output: 'export' as const, distDir: '.next-desktop', trailingSlash: true, images: { unoptimized: true } } : {}),
  experimental: { ...(process.env.STUDIO_DISABLE_BUILD_CACHE === '1' ? { turbopackFileSystemCacheForBuild: false } : {}), optimizePackageImports: ["@heroui/react", "lucide-react"] },
};
export default config;

