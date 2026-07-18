import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Nagłówki bezpieczeństwa (CSP nonce, HSTS, COOP itd.) — jedno źródło: proxy.ts.
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    viewTransition: true,
  },
};

/**
 * Budżet JS (00-core.mdc): 200 KB bez 3D. Uruchom `ANALYZE=1 pnpm build`
 * przed release, żeby wykryć regresję > 10% (60-quality.mdc, 90-release.mdc).
 */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "1",
});

export default withBundleAnalyzer(nextConfig);
