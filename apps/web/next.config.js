// @type {import('next').NextConfig}
//
//
//

const nextConfig = {
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
                source: '/japan-internships',
                destination: '/japan-jobs?type=internship',
                permanent: true,
            },
            // Canonicalize the apex domain to www in a single hop. Every
            // canonical tag, sitemap entry, and OG tag in this app is hardcoded
            // to https://www.intern-flow.in, so any request that reaches the
            // apex host needs to redirect straight to www — previously this
            // only happened (unreliably) at the DNS/hosting layer, which is
            // what was causing "Page with redirect" validation failures in
            // Search Console.
            {
                source: '/:path*',
                has: [
                    {
                        type: 'host',
                        value: 'intern-flow.in',
                    },
                ],
                destination: 'https://www.intern-flow.in/:path*',
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
