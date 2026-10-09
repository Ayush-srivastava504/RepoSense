// Module: app/sitemap-blog.xml/route.ts
// Build, fallback and lastmod live in lib/routeSitemaps.ts; the answer policy (cache layers, never a 5xx) in
// lib/sitemapResponse.ts.
import { serveRouteSitemap } from '@/lib/routeSitemaps';

export const dynamic = 'force-dynamic';
// Headroom for a cold build on platforms that honour it (Vercel); a no-op elsewhere.
export const maxDuration = 60;

export const GET = (req: Request) => serveRouteSitemap('blog', req);
