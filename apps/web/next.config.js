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
			// The site is India-only (migration 039). The old abroad hubs fold into the India listings.
			{ source: '/japan-internships', destination: '/internships', permanent: true },
			{ source: '/japan-jobs', destination: '/jobs', permanent: true },
			{ source: '/europe-jobs', destination: '/jobs', permanent: true },
			// Retired keyword-template blog posts -> the tool page each one was written around.
			...[
				['cover-letter-template-free-download-kw-0022', '/tools/cover-letter-generator'],
				['github-portfolio-builder-india-kw-0172', '/tools/github-readme-generator'],
				['github-readme-generator-india-kw-0142', '/tools/github-readme-generator'],
				['linkedin-headline-examples-for-freshers-kw-0046', '/tools/linkedin-optimizer'],
				['resume-for-data-science-internship-kw-0137', '/tools/resume-builder'],
				['resume-format-checker-for-students-kw-0096', '/tools/ats-resume-checker'],
				['resume-headline-for-freshers-kw-0041', '/tools/resume-builder'],
				['resume-score-checker-for-freshers-kw-0118', '/tools/ats-resume-checker'],
			].map(([slug, destination]) => ({ source: `/blog/${slug}`, destination, permanent: true })),
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
