/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  // Logo and website photo uploads go through server actions (1 MB and 3 MB, checked in the actions).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
