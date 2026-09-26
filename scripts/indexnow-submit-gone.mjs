// Module: scripts/indexnow-submit-gone.mjs
//
// Companion to indexnow-submit.mjs. That script submits URLs currently in
// the live sitemap -- by design, gone (is_active = false) jobs are NOT in
// the sitemap, so it never tells IndexNow-consuming engines (Bing,
// Yandex, Seznam, Naver) that those URLs are gone. This script does that
// half: it pulls the recently-deactivated jobs from the API's
// /api/jobs/gone-urls endpoint (added alongside migration 025's
// deactivated_at column), rebuilds each one's canonical URL using the
// SAME slug logic as apps/web/lib/slug.ts's canonicalPathForJob(), and
// submits those to IndexNow.
//
// IndexNow doesn't care about status codes -- submitting a URL just tells
// the engine "recrawl this soon." For a URL that now 410s, a fast recrawl
// is exactly what gets it dropped from the index sooner.
//
// Prerequisite: same as indexnow-submit.mjs -- the key file must be live
// at https://intern-flow.in/<INDEXNOW_KEY>.txt.
//
// Usage:
//   node scripts/indexnow-submit-gone.mjs
//   node scripts/indexnow-submit-gone.mjs --since-days=7
//   node scripts/indexnow-submit-gone.mjs --dry-run
//   node scripts/indexnow-submit-gone.mjs --base-url=https://intern-flow.in --api-base=https://api.intern-flow.in

const KEY = '97f076150822494092783dfc5c2c8a09';
const HOST = 'intern-flow.in';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const getArg = (name, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const BASE_URL = getArg('base-url', `https://${HOST}`).replace(/\/$/, '');
const API_BASE = getArg('api-base', process.env.API_BASE_URL || 'https://api.intern-flow.in').replace(/\/$/, '');
const SINCE_DAYS = getArg('since-days', '1');
const KEY_LOCATION = `${BASE_URL}/${KEY}.txt`;

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10000; // IndexNow hard limit per submission

// --- Ported from apps/web/lib/slug.ts. Keep in sync if that file changes
// its slug format -- this script has no import access to app TS source,
// so it's a deliberate duplicate, not a shared module. ---

function slugify(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function jobSlug(job) {
    const parts = [slugify(job.title), slugify(job.company)];
    const city = job.location?.split(',')[0]?.trim();
    if (city) parts.push(slugify(city));
    const pay = job.salary || job.stipend;
    if (pay) parts.push(slugify(pay));
    const base = parts.filter(Boolean).join('-');
    const MAX_BASE_LENGTH = 90;
    const truncatedBase = base.length > MAX_BASE_LENGTH ? base.slice(0, MAX_BASE_LENGTH).replace(/-+$/, '') : base;
    return `${truncatedBase}-${job.id}`;
}

function canonicalCategoryForJob(job) {
    if (job.is_government) return 'government-jobs';
    if (job.type === 'internship') return 'internships';
    if (job.is_remote) return 'remote-jobs';
    return 'jobs';
}

function canonicalPathForJob(job) {
    return `/${canonicalCategoryForJob(job)}/${jobSlug(job)}`;
}

// --- Fetch + submit ---

async function fetchGoneJobs() {
    const url = `${API_BASE}/api/jobs/gone-urls?since_days=${encodeURIComponent(SINCE_DAYS)}`;
    console.log(`Fetching gone jobs: ${url}`);
    const headers = process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const body = await res.json();
    return body.jobs ?? [];
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
        body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
    });

    const statusMeaning = {
        200: 'OK — submitted successfully',
        202: 'Accepted',
        400: 'Bad request — invalid format',
        403: 'Forbidden — key not valid or not found at keyLocation',
        422: 'Unprocessable — URLs do not belong to host, or key/schema mismatch',
        429: 'Too many requests',
    };

    console.log(`Batch of ${urlList.length} URLs -> HTTP ${res.status} (${statusMeaning[res.status] || 'unexpected status'})`);
    if (!res.ok && res.status !== 202) {
        const body = await res.text().catch(() => '');
        if (body) console.error(`  Response body: ${body}`);
    }
    return res.status;
}

async function main() {
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`API base: ${API_BASE}`);
    console.log(`Since days: ${SINCE_DAYS}`);
    console.log(`Key location: ${KEY_LOCATION}`);

    const jobs = await fetchGoneJobs();
    console.log(`\nGone jobs fetched: ${jobs.length}`);

    const urls = jobs.map((job) => `${BASE_URL}${canonicalPathForJob(job)}`);

    if (dryRun) {
        console.log('\n--dry-run set, not submitting. First 10 URLs:');
        urls.slice(0, 10).forEach((u) => console.log(`  ${u}`));
        return;
    }

    if (urls.length === 0) {
        console.log('Nothing to submit.');
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
    console.error('IndexNow gone-URL submission failed:', err);
    process.exit(1);
});
