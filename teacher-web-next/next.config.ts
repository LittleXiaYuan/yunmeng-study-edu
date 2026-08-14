import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export for desktop packaging (Go embeds out/ into the exe).
  // Dev (`npm run dev`) is unaffected; only `next build` writes to out/.
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  // Note: custom headers() is ignored under `output: "export"` (static files
  // only). Security headers for the desktop build are owned by the Go server
  // if needed; this config keeps the export path simple.
};

export default nextConfig;
