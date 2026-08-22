/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_LOGO_DEV_TOKEN: process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN,
  },
  images: {
    // Company logos: Logo.dev is the primary source (the officially-
    // recommended successor to Clearbit's Logo API, which was shut down
    // Dec 8, 2025 — see app/components/CompanyLogo.tsx), with Google's
    // favicon service as a no-key fallback. next/image requires every
    // remote host to be allowlisted up front.
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
    // Logos are small and mostly flat color/wordmarks — 64px is plenty
    // for the card avatar slot and keeps the optimizer's output tiny.
    imageSizes: [32, 48, 64],
  },
  /**
   * Long-lived, immutable caching for static files in /public. These are
   * fingerprint-free (favicon, og-image, manifest, etc.), so instead of
   * relying on the default short/no-cache behavior we tell browsers to
   * keep them for a year and revalidate only when we intentionally
   * change the deployment. Fixes the "Use efficient cache lifetimes"
   * Lighthouse insight.
   */
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

  /**
   * /japan-jobs and /japan-internships used to be two near-identical pages.
   * They're now one page with a tab toggle at /japan-jobs?type=internship —
   * this 308 forwards old links/bookmarks/search-engine results there
   * (Next.js automatically carries over any extra query params, like
   * ?search=... or ?page=..., onto the destination).
   */
  async redirects() {
    return [
      {
        source: '/japan-internships',
        destination: '/japan-jobs?type=internship',
        permanent: true,
      },
    ];
  },

  /**
   * Disable webpack's persistent file cache on Windows.
   * The default cache strategy can cause "Unable to snapshot resolve dependencies"
   * errors during the build process. Switching to an in‑memory cache avoids the
   * issue while still providing fast incremental builds.
   */
  webpack: (config) => {
    // Use an in‑memory cache instead of the default filesystem cache.
    config.cache = {
      type: 'memory',
    };
    return config;
  },
};

module.exports = nextConfig;