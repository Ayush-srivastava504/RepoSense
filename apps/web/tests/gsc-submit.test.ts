// Run: npm run test:sitemap
// scripts/gsc-submit-sitemaps.mjs against local fake Google endpoints (no network, no real credentials).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import type { AddressInfo } from 'node:net';

const INDEX_XML = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>https://intern-flow.in/sitemaps/jobs-1.xml</loc></sitemap>
<sitemap><loc>https://intern-flow.in/sitemap-skills.xml</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></sitemap></sitemapindex>`;

test('parseLocs reads index children; buildJwt is a valid RS256 service-account assertion', async () => {
    const { parseLocs, buildJwt } = await import('../../../scripts/gsc-submit-sitemaps.mjs');
    assert.deepEqual(parseLocs(INDEX_XML), ['https://intern-flow.in/sitemaps/jobs-1.xml', 'https://intern-flow.in/sitemap-skills.xml']);
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwt = buildJwt({ client_email: 'bot@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }, 1_000_000);
    const [h, c, sig] = jwt.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'RS256', typ: 'JWT' });
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    assert.equal(claims.iss, 'bot@p.iam.gserviceaccount.com');
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/webmasters');
    assert.equal(claims.exp - claims.iat, 3600);
    assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, sig, 'base64url'), 'signature verifies');
});

test('without credentials it skips quietly (exit 0); a dry run lists the index and every child, sending nothing', async () => {
    const { main } = await import('../../../scripts/gsc-submit-sitemaps.mjs');
    assert.equal(await main([], {} as NodeJS.ProcessEnv), 0);

    const site = createServer((_req, res) => { res.setHeader('Content-Type', 'application/xml'); res.end(INDEX_XML); });
    await new Promise<void>((r) => site.listen(0, r));
    const base = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
    const logs: string[] = [];
    const realLog = console.log;
    console.log = (...a: unknown[]) => { logs.push(a.join(' ')); };
    try {
        assert.equal(await main(['--dry-run', `--base-url=${base}`], {} as NodeJS.ProcessEnv), 0);
    }
    finally {
        console.log = realLog;
        site.close();
    }
    assert.equal(logs.filter((l) => l.includes('would submit')).length, 3, 'index + 2 children');
});

test('a live run exchanges a token, then PUTs the index and each child to the Search Console API', async () => {
    const { publicKey: _p, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const puts: string[] = [];
    let tokenCalls = 0;
    const google = createServer((req, res) => {
        if (req.url === '/token') { tokenCalls++; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ access_token: 'tok' })); }
        if (req.method === 'PUT' && req.headers.authorization === 'Bearer tok') { puts.push(decodeURIComponent(req.url ?? '')); res.statusCode = 204; return res.end(); }
        res.statusCode = 401; res.end('no');
    });
    const site = createServer((_req, res) => { res.setHeader('Content-Type', 'application/xml'); res.end(INDEX_XML); });
    await Promise.all([new Promise<void>((r) => google.listen(0, r)), new Promise<void>((r) => site.listen(0, r))]);
    const gPort = (google.address() as AddressInfo).port;
    const sPort = (site.address() as AddressInfo).port;
    process.env.GSC_TOKEN_URL = `http://127.0.0.1:${gPort}/token`;
    process.env.GSC_API_BASE = `http://127.0.0.1:${gPort}/webmasters/v3`;
    const realLog = console.log;
    console.log = () => {};
    try {
        // module reads GSC_* at import time, so import a fresh copy after setting them
        const { main } = await import(`../../../scripts/gsc-submit-sitemaps.mjs?live=${Date.now()}`);
        const key = { client_email: 'bot@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
        const code = await main([`--base-url=http://127.0.0.1:${sPort}`], { GSC_SERVICE_ACCOUNT_JSON: JSON.stringify(key), GSC_SITE_URL: 'sc-domain:intern-flow.in' });
        assert.equal(code, 0);
    }
    finally {
        console.log = realLog;
        google.close();
        site.close();
        delete process.env.GSC_TOKEN_URL;
        delete process.env.GSC_API_BASE;
    }
    assert.equal(tokenCalls, 1);
    assert.equal(puts.length, 3);
    assert.ok(puts[0].startsWith('/webmasters/v3/sites/sc-domain:intern-flow.in/sitemaps/http://127.0.0.1:'));
    assert.ok(puts.some((p) => p.endsWith('/sitemaps/https://intern-flow.in/sitemap-skills.xml')));
});
