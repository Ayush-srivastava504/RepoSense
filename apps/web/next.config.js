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