// Module: scripts/gsc-submit-sitemaps.mjs
//
// Asks Google Search Console to (re)read the sitemap index and every child sitemap, once a day, so "Last read" in
// Search Console tracks the real change cadence instead of whatever Google's own scheduler picks. It only SUBMITS
// (Search Console API: sitemaps.submit, a PUT); it never changes what a sitemap contains.
//
// Google still decides how often it actually crawls the URLs inside. This just removes "nobody told Google the
// sitemap changed" as a reason a sitemap sits unread for days.
//
// Setup (once):
//   1. Google Cloud -> create a service account, enable the "Search Console API", download its JSON key.
//   2. Search Console -> Settings -> Users and permissions -> add the service account's e-mail as Owner/Full user.
//   3. GitHub -> repo secrets: GSC_SERVICE_ACCOUNT_JSON (the whole key file), and optionally GSC_SITE_URL
//      (default "sc-domain:intern-flow.in"; use "https://intern-flow.in/" for a URL-prefix property).
// Without GSC_SERVICE_ACCOUNT_JSON the script logs a notice and exits 0, so the workflow never fails for lack of it.
//
// Usage:
//   node scripts/gsc-submit-sitemaps.mjs
//   node scripts/gsc-submit-sitemaps.mjs --dry-run            (prints what it would submit, sends nothing)
//   node scripts/gsc-submit-sitemaps.mjs --base-url=https://intern-flow.in

import { createSign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SCOPE = 'https://www.googleapis.com/auth/webmasters';
const TOKEN_URL = process.env.GSC_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const API_BASE = process.env.GSC_API_BASE || 'https://www.googleapis.com/webmasters/v3';

const b64url = (input) => Buffer.from(input).toString('base64url');

/** <loc> values of a sitemap or sitemap index. */
export function parseLocs(xml) {
    return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

/** Signed service-account JWT for the OAuth token exchange (RS256). */
export function buildJwt(key, nowSeconds = Math.floor(Date.now() / 1000)) {
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
        iss: key.client_email,
        scope: SCOPE,
        aud: key.token_uri || TOKEN_URL,
        iat: nowSeconds,
        exp: nowSeconds + 3600,
    }));
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');
    return `${header}.${claims}.${signature}`;
}

async function accessToken(key) {
    const res = await fetch(key.token_uri || TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: buildJwt(key) }),
    });
    if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()).access_token;
}

export async function submitSitemap(token, siteUrl, feedUrl) {
    const url = `${API_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedUrl)}`;
    const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, ok: res.ok, body: res.ok ? '' : await res.text() };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
    const dryRun = argv.includes('--dry-run');
    const baseArg = argv.find((a) => a.startsWith('--base-url='));
    const baseUrl = (baseArg ? baseArg.split('=').slice(1).join('=') : env.SITE_URL || 'https://intern-flow.in').replace(/\/$/, '');
    const siteUrl = env.GSC_SITE_URL || 'sc-domain:intern-flow.in';

    if (!env.GSC_SERVICE_ACCOUNT_JSON && !dryRun) {
        console.log('gsc-submit-sitemaps: GSC_SERVICE_ACCOUNT_JSON not set, skipping (see the header of this script for setup).');
        return 0;
    }

    const indexUrl = `${baseUrl}/sitemap.xml`;
    const indexRes = await fetch(indexUrl);
    if (!indexRes.ok) {
        // Do not submit a sitemap that is not healthy right now; tomorrow's run covers it.
        console.error(`gsc-submit-sitemaps: ${indexUrl} answered HTTP ${indexRes.status}, nothing submitted.`);
        return 1;
    }
    const feeds = [indexUrl, ...parseLocs(await indexRes.text())];
    console.log(`gsc-submit-sitemaps: ${feeds.length} sitemaps for ${siteUrl}${dryRun ? ' (dry run)' : ''}`);
    if (dryRun) {
        for (const f of feeds) console.log(`  would submit ${f}`);
        return 0;
    }

    const token = await accessToken(JSON.parse(env.GSC_SERVICE_ACCOUNT_JSON));
    let failed = 0;
    for (const feed of feeds) {
        const r = await submitSitemap(token, siteUrl, feed);
        console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.status} ${feed}${r.body ? ` ${r.body.slice(0, 200)}` : ''}`);
        if (!r.ok) failed++;
    }
    return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
}
