// Module: lib/seo/robots.ts
// Defines component(s)/export(s): parseRobotsDirective

import type { Metadata } from 'next';

/**
 * "index, follow" / "noindex, nofollow" -> Next.js Metadata robots object.
 * Lives here (rather than inline in app/blog/[slug]/page.tsx) so it's a
 * plain function importable from tests without dragging in next/link,
 * next/headers, etc. — the same reasoning as lib/structuredData.ts and the
 * other lib/seo helpers.
 */
export function parseRobotsDirective(robots?: string): Metadata['robots'] | undefined {
  if (!robots) return undefined;
  const tokens = robots.toLowerCase().split(',').map((t) => t.trim());
  return {
    index: !tokens.includes('noindex'),
    follow: !tokens.includes('nofollow'),
  };
}
