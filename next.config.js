/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// output: 'standalone', // Disabled for Vercel deployment - only use for Docker/self-hosting
	images: {
		unoptimized: true,
	},
};

export default nextConfig;
