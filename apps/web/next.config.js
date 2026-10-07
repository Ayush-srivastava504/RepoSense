/** @type {import('next').NextConfig} */
const nextConfig = {
	// Docker builds set NEXT_OUTPUT=standalone to emit a minimal self-contained server
	// (.next/standalone). Unset on Vercel / local dev, so those behave exactly as before.
	output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,

	// Several routes fetch from api.intern-flow.in during static generation.
	// Give SSG more headroom under load.
	staticPageGenerationTimeout: 180,

	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
		NEXT_PUBLIC_LOGO_DEV_TOKEN: process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN,
	},

	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'img.logo.dev',
			},
			{
				protocol: 'https',
				hostname: 'www.google.com',
			},
		],
		imageSizes: [32, 48, 64],
	},

	async headers() {
		return [
			{
				// HSTS: HTTPS-only for a year on this host. Deliberately no includeSubDomains/preload --
				// api.* and any other subdomain must be confirmed HTTPS-clean before widening this.
				source: '/:path*',
				headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }],
			},
			{
				source: '/:path*(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)',
				headers: [
					{
						key: 'Cache-Control',
						value: 'public, max-age=31536000, immutable',
					},
				],
			},
		];
	},

	async redirects() {
		return [
			{
				// /resume has no page of its own (only /resume/builder), so it 404'd while the homepage links to it.
				source: '/resume',
				destination: '/resume/builder',
				permanent: true,
			},
			{
				source: '/japan-internships',
				destination: '/japan-jobs?type=internship',
				permanent: true,
			},
		];
	},

	webpack: (config) => {
		config.cache = {
			type: 'memory',
		};
		return config;
	},
};

module.exports = nextConfig;
