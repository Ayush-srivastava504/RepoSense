/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  images: {
    // Company logos are fetched from Clearbit's free logo API, keyed by
    // the job's apply_domain. next/image requires every remote host to
    // be allowlisted up front; wildcarding isn't possible for a single
    // fixed host, so this is the full, exact set we use.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
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