// /jobs shows jobs only, /internships shows internships only, and the hub sitemap lastmod queries mirror the pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

test('/jobs excludes internships and boosts fresher roles; /internships does neither', () => {
    const jobs = read('app/jobs/page.tsx');
    const interns = read('app/internships/page.tsx');
    assert.match(jobs, /excludeType:\s*'internship'/);
    assert.match(jobs, /fresherFirst:\s*true/);
    assert.match(interns, /type:\s*'internship'/);
    assert.doesNotMatch(interns, /excludeType|fresherFirst/);
});

test('/remote-jobs lists jobs only, and its hub sitemap query mirrors that', () => {
    assert.match(read('app/remote-jobs/page.tsx'), /excludeType:\s*'internship'/);
    assert.match(read('lib/routeSitemaps.ts'), /'\/remote-jobs':\s*\[\{ category: 'remote', excludeGovernment: true, excludeType: 'internship'/);
    assert.match(read('app/remote-jobs/page.tsx'), /redirect\(`\/remote-jobs/);
});

test('API params: exclude_type and fresher_first are sent for the list, the featured strip and the facets', () => {
    const jobsLib = read('lib/jobs.ts');
    assert.equal((jobsLib.match(/params\.set\('exclude_type'/g) ?? []).length, 2); // list + featured
    assert.equal((jobsLib.match(/params\.set\('fresher_first'/g) ?? []).length, 2);
    assert.match(read('lib/facets.ts'), /params\.set\('exclude_type'/);
});

test('hub sitemap lastmod query for /jobs matches what the page renders', () => {
    assert.match(read('lib/routeSitemaps.ts'), /'\/jobs':\s*\[\{ excludeGovernment: true, excludeType: 'internship'/);
});

test('page copy no longer promises something the ranking does not do', () => {
    for (const f of ['app/jobs/page.tsx', 'app/internships/page.tsx']) {
        assert.doesNotMatch(read(f), /automatically de-ranked/);
    }
});

test('a ?page= past the last page redirects instead of rendering a duplicate of the last page', () => {
    for (const f of ['app/jobs/page.tsx', 'app/internships/page.tsx']) {
        const src = read(f);
        assert.match(src, /import \{[^}]*\bredirect\b[^}]*\} from 'next\/navigation'/);
        assert.match(src, /if \(currentPage !== requestedPage\) \{[\s\S]*?redirect\(/);
        assert.doesNotMatch(src, /const clamped = await fetchJobsPage/);
    }
});
