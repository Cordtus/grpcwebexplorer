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
  // Remove standalone for now - it requires additional setup for static assets
  // output: 'standalone',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;