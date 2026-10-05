// Module: scripts/indexnow-submit-enriched.mjs
//
// Submits every AI-enriched job URL to IndexNow (api.indexnow.org -> Bing,
// Yandex, Naver, Seznam). The job sitemaps under /sitemaps/ already contain
// ONLY jobs with enriched_overview (see isJobForSitemap in lib/sitemapJobs.ts),
// so reading them == "all AI-enriched URLs".
//
// Only new or changed URLs are sent: a state file remembers url -> lastmod,
// so re-running daily does not resubmit the whole site.
//
// Prerequisite: https://<host>/<KEY>.txt must be live (apps/web/public/<KEY>.txt).
//
// Usage (from repo root, in the VS Code terminal):
//   node scripts/indexnow-submit-enriched.mjs --dry-run
//   node scripts/indexnow-submit-enriched.mjs
//   node scripts/indexnow-submit-enriched.mjs --force              (ignore state, resubmit all)
//   node scripts/indexnow-submit-enriched.mjs --base-url=https://intern-flow.in

import fs from 'node:fs';

const KEY = '97f076150822494092783dfc5c2c8a09';
const args = process.argv.slice(2);
const getArg = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;

const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const BASE_URL = getArg('base-url', 'https://intern-flow.in').replace(/\/$/, '');
const HOST = new URL(BASE_URL).hostname; // must equal the host inside every submitted URL
const KEY_LOCATION = `${BASE_URL}/${KEY}.txt`;
const STATE_FILE = getArg('state', 'scripts/.indexnow-state.json');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000; // IndexNow hard limit

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'indexnow-submit-script' }, redirect: 'follow' });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.text();
}

// Returns [{loc, lastmod}] for a sitemap or sitemap-index XML.
function parseEntries(xml) {
    const out = [];
    for (const m of xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/g)) {
        const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(m[1])?.[1];
        const lastmod = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(m[1])?.[1] || '';
        if (loc) out.push({ loc, lastmod });
    }
    return out;
}

async function collectEnrichedUrls() {
    console.log(`Reading ${BASE_URL}/sitemap.xml`);
    const index = parseEntries(await fetchText(`${BASE_URL}/sitemap.xml`));
    // Job sitemaps only: /sitemaps/{jobs|internships|remote-jobs|government-jobs}-N.xml
    const jobFiles = index.map((e) => e.loc).filter((u) => /\/sitemaps\/[a-z-]+-\d+\.xml$/.test(u));
    if (!jobFiles.length) throw new Error('No /sitemaps/*-N.xml job sitemaps found in the index. Aborting.');
    console.log(`Found ${jobFiles.length} job sitemap file(s).`);

    const urls = new Map();
    for (const f of jobFiles) {
        try {
            const entries = parseEntries(await fetchText(f));
            console.log(`  ${f} -> ${entries.length} URLs`);
            for (const e of entries) urls.set(e.loc, e.lastmod);
        } catch (err) {
            console.error(`  ! skipped ${f}: ${err.message}`);
        }
    }
    // IndexNow rejects (422) any URL whose host differs from `host`.
    const wrongHost = [...urls.keys()].filter((u) => new URL(u).hostname !== HOST);
    if (wrongHost.length) {
        console.error(`\n${wrongHost.length} URLs are not on ${HOST} (e.g. ${wrongHost[0]}). They would 422 -- dropping them.`);
        console.error('Fix BASE_URL / --base-url so the sitemap host and this script agree.');
        wrongHost.forEach((u) => urls.delete(u));
    }
    return urls;
}

async function submit(urlList) {
    for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
        });
        if (res.status === 200 || res.status === 202) {
            console.log(`  batch of ${urlList.length} -> HTTP ${res.status} OK`);
            return true;
        }
        if (res.status === 429 || res.status >= 500) {
            const wait = 5000 * attempt;
            console.warn(`  HTTP ${res.status}, retrying in ${wait / 1000}s...`);
            await sleep(wait);
            continue;
        }
        const body = await res.text().catch(() => '');
        console.error(`  batch failed -> HTTP ${res.status} ${body}`);
        if (res.status === 403) console.error(`  403: key file not reachable/valid at ${KEY_LOCATION}`);
        if (res.status === 422) console.error('  422: URL host does not match `host`, or key mismatch');
        return false;
    }
    return false;
}

async function main() {
    const state = !force && fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
    const all = await collectEnrichedUrls();
    const pending = [...all].filter(([url, lastmod]) => state[url] !== (lastmod || 'none')).map(([url]) => url);

    console.log(`\nEnriched URLs in sitemaps: ${all.size}`);
    console.log(`New or changed (to submit): ${pending.length}`);

    if (dryRun || !pending.length) {
        pending.slice(0, 10).forEach((u) => console.log(`  ${u}`));
        if (dryRun) console.log('\n--dry-run: nothing submitted.');
        return;
    }

    for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        if (await submit(batch)) {
            for (const u of batch) state[u] = all.get(u) || 'none';
            fs.writeFileSync(STATE_FILE, JSON.stringify(state)); // save after each good batch
        }
    }
    console.log('\nDone. Check Bing Webmaster Tools -> IndexNow for receipt.');
}

main().catch((e) => {
    console.error('IndexNow submission failed:', e);
    process.exit(1);
});
