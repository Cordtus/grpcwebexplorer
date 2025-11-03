/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['child_process'],
  },
  transpilePackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  // output: 'standalone', // Disabled for Vercel deployment - only use for Docker/self-hosting
  images: {
    unoptimized: true,
  },
};

export default nextConfig;