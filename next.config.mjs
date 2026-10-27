/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  // Logo uploads go through a server action (1 MB limit, checked again in the action).
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
