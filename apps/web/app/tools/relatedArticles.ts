// Module: app/tools/relatedArticles.ts
// Defines function(s): getRelatedArticles
//
// Server-only (Node runtime) helper. It lives apart from app/tools/data.ts on
// purpose: getPostBySlug reads blog posts off disk via fs/path, and data.ts is
// imported by the edge-runtime OG route (app/og/tools/[filename]/route.tsx),
// where fs/path can't be bundled. Keep every lib/blog import out of data.ts.

import { getPostBySlug, type BlogPost } from '@/lib/blog';
import type { ToolDefinition } from '@/app/tools/data';

/**
 * Blog posts this tool names as a natural next step, resolved from
 * relatedArticleSlugs. A slug with no matching post file (e.g. a typo, or a
 * post later removed) is silently dropped rather than breaking the page.
 */
export function getRelatedArticles(tool: ToolDefinition): BlogPost[] {
    return (tool.relatedArticleSlugs ?? [])
        .map((slug) => getPostBySlug(slug))
        .filter((post): post is BlogPost => Boolean(post));
}
