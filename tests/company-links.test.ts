import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCompanyLinks, relatedCompanies } from '../lib/companyLinks';
import type { Job } from '../lib/jobs';
import type { Company } from '../lib/companies';

const job = (id: string, type = 'job') => ({ id, type, title: `T${id}`, company: 'Acme' }) as unknown as Job;
const co = (company: string, job_count: number, tier: Company['tier'] = 'top') => ({ company, job_count, tier }) as Company;

test('company links never include the current job and are split by type', () => {
    const r = pickCompanyLinks([job('a'), job('b', 'internship'), job('c')], [job('b', 'internship'), job('d', 'internship')], 'a');
    assert.deepEqual(r.roles.map((j) => j.id), ['c']);
    assert.deepEqual(r.internships.map((j) => j.id), ['b', 'd']);
});

test('company links are capped and an internship is not repeated as a role', () => {
    const many = Array.from({ length: 12 }, (_, i) => job(`r${i}`));
    const r = pickCompanyLinks(many, [], 'none', 5);
    assert.equal(r.roles.length, 5);
    assert.equal(r.internships.length, 0);
});

test('related companies skip self and thin companies, prefer same tier', () => {
    const all = [co('Acme', 9), co('Beta', 5, 'top'), co('Gamma', 30, 'startup'), co('Thin', 1, 'top')];
    const r = relatedCompanies(all, co('Acme', 9, 'top'));
    assert.deepEqual(r.map((c) => c.company), ['Beta', 'Gamma']);
});
