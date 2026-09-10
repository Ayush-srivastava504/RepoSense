// Module: scripts/indexnow-submit.mjs
//
// One-off bulk submission of every URL in the site's sitemap to IndexNow
// (api.indexnow.org), which fans out to Bing, Yandex, Seznam, Naver, etc.
//
// Prerequisite: the key file must already be LIVE at
//   https://www.intern-flow.in/<INDEXNOW_KEY>.txt
// (i.e. apps/web/public/<key>.txt has been deployed) — IndexNow verifies
// ownership by fetching that URL before it accepts submissions, so run this
// AFTER deploying, not before.
//
// Usage:
//   node scripts/indexnow-submit.mjs
//   node scripts/indexnow-submit.mjs --dry-run     (collect + print URL count only)
//   node scripts/indexnow-submit.mjs --base-url=https://www.intern-flow.in

const KEY = '97f076150822494092783dfc5c2c8a09';
const HOST = 'www.intern-flow.in';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseUrlArg = args.find((a) => a.startsWith('--base-url='));
const BASE_URL = (baseUrlArg ? baseUrlArg.split('=')[1] : `https://${HOST}`).replace(/\/$/, '');
const KEY_LOCATION = `${BASE_URL}/${KEY}.txt`;

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10000; // IndexNow hard limit per submission

async function fetchText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'indexnow-submit-script' } });
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.text();
}

function extractLocs(xml) {
    const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g);
    return Array.from(matches, (m) => m[1].trim());
}

async function collectAllUrls() {
    console.log(`Fetching sitemap index: ${BASE_URL}/sitemap.xml`);
    const indexXml = await fetchText(`${BASE_URL}/sitemap.xml`);
    const childSitemaps = extractLocs(indexXml);

    if (childSitemaps.length === 0) {
        throw new Error('No child sitemaps found in sitemap index — aborting.');
    }
    console.log(`Found ${childSitemaps.length} child sitemaps.`);

    const allUrls = new Set();
    for (const sitemapUrl of childSitemaps) {
        try {
            const xml = await fetchText(sitemapUrl);
            const urls = extractLocs(xml);
            console.log(`  ${sitemapUrl} -> ${urls.length} URLs`);
            urls.forEach((u) => allUrls.add(u));
        } catch (err) {
            console.error(`  ! Skipping ${sitemapUrl}: ${err.message}`);
        }
    }
    return Array.from(allUrls);
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function submitBatch(urlList) {
    const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            host: HOST,
            key: KEY,
            keyLocation: KEY_LOCATION,
            urlList,
        }),
    });

    const statusMeaning = {
        200: 'OK — submitted successfully',
        202: 'Accepted',
        400: 'Bad request — invalid format',
        403: 'Forbidden — key not valid or not found at keyLocation',
        422: 'Unprocessable — URLs do not belong to host, or key/schema mismatch',
        429: 'Too many requests',
    };

    console.log(
        `Batch of ${urlList.length} URLs -> HTTP ${res.status} (${statusMeaning[res.status] || 'unexpected status'})`
    );
    if (!res.ok && res.status !== 202) {
        const body = await res.text().catch(() => '');
        if (body) console.error(`  Response body: ${body}`);
    }
    return res.status;
}

async function main() {
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Key location: ${KEY_LOCATION}`);

    const urls = await collectAllUrls();
    console.log(`\nTotal unique URLs collected: ${urls.length}`);

    if (dryRun) {
        console.log('\n--dry-run set, not submitting. First 10 URLs:');
        urls.slice(0, 10).forEach((u) => console.log(`  ${u}`));
        return;
    }

    const batches = chunk(urls, MAX_URLS_PER_REQUEST);
    console.log(`\nSubmitting in ${batches.length} batch(es) of up to ${MAX_URLS_PER_REQUEST} URLs...\n`);

    for (const [i, batch] of batches.entries()) {
        console.log(`Batch ${i + 1}/${batches.length}:`);
        await submitBatch(batch);
    }

    console.log('\nDone. Verify receipt in Bing Webmaster Tools (IndexNow section).');
}

main().catch((err) => {
    console.error('IndexNow submission failed:', err);
    process.exit(1);
});
