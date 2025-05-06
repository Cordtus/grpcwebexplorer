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
  output: 'standalone',
  // Ensure static assets are correctly served
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  // Configure static folder properly
  images: {
    unoptimized: true,
  },
};

export default nextConfig;