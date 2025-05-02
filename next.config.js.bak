/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // This is important for the grpcurl execution
  // which relies on child_process
  experimental: {
    serverComponentsExternalPackages: ['child_process'],
  },
  // Ensure ESM compatibility
  transpilePackages: [],
};

export default nextConfig;