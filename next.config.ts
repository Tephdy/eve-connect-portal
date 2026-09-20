import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // experimental: { typedRoutes: true },  // ← disabled during active development
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;