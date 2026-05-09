/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
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