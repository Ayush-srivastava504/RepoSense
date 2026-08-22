'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthGuard from '../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';

interface LevelSummary {
  key: string;
  label: string;
  description: string;
  count: number;
}

interface LevelProblem {
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  leetcode_url: string;
  solvable: boolean;
  companies: string[];
}

interface LevelDetail {
  key: string;
  label: string;
  description: string;
  problems: LevelProblem[];
}

const DIFFICULTY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };
const STARRED_KEY = 'leetcode-starred';

function difficultyColor(d: string) {
  if (d === 'Easy') return 'var(--green)';
  if (d === 'Hard') return 'var(--rust)';
  return 'var(--score-amber)';
}

function progressKey(levelKey: string) {
  return `leetcode-progress-${levelKey}`;
}

function loadSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

function LeetCodeContent() {
  useAuth();
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [activeLevel, setActiveLevel] = useState<string>('level-1');
  const [detail, setDetail] = useState<LevelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [company, setCompany] = useState('All');
  const [starredOnly, setStarredOnly] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStarred(loadSet(STARRED_KEY));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data: LevelSummary[] = await api.get('/leetcode/levels');
        if (cancelled) return;
        setLevels(data);
        if (data.length > 0) setActiveLevel(data[0].key);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load LeetCode levels.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeLevel) return;
    let cancelled = false;
    setDetailLoading(true);
    setCategory('All');
    setDifficulty('All');
    setCompany('All');
    setStarredOnly(false);
    setSearch('');
    (async () => {
      try {
        const data: LevelDetail = await api.get(`/leetcode/levels/${activeLevel}`);
        if (cancelled) return;
        setDetail(data);
        setCompleted(loadSet(progressKey(activeLevel)));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load this level.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeLevel]);

  const categories = useMemo(() => {
    if (!detail) return ['All'];
    const set = new Set(detail.problems.map((p) => p.category));
    return ['All', ...Array.from(set).sort()];
  }, [detail]);

  const companies = useMemo(() => {
    if (!detail) return ['All'];
    const set = new Set<string>();
    detail.problems.forEach((p) => p.companies.forEach((c) => set.add(c)));
    return ['All', ...Array.from(set).sort()];
  }, [detail]);

  const filteredProblems = useMemo(() => {
    if (!detail) return [];
    const q = search.trim().toLowerCase();
    return detail.problems
      .filter((p) => (category === 'All' ? true : p.category === category))
      .filter((p) => (difficulty === 'All' ? true : p.difficulty === difficulty))
      .filter((p) => (company === 'All' ? true : p.companies.includes(company)))
      .filter((p) => (starredOnly ? starred.has(p.slug) : true))
      .filter((p) => (q ? p.title.toLowerCase().includes(q) : true))
      .sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] || a.title.localeCompare(b.title));
  }, [detail, search, category, difficulty, company, starredOnly, starred]);

  const progressPct = detail && detail.problems.length > 0
    ? Math.round((completed.size / detail.problems.length) * 100)
    : 0;

  function toggleStar(slug: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      saveSet(STARRED_KEY, next);
      return next;
    });
  }

  function surpriseMe() {
    const pool = filteredProblems.length > 0 ? filteredProblems : (detail?.problems || []);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    trackEvent('leetcode_surprise_me', { slug: pick.slug });
    if (pick.solvable) {
      window.location.href = `/leetcode/${pick.slug}`;
    } else {
      window.open(pick.leetcode_url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="container-xl py-12">
      <div className="max-w-2xl">
        <p className="eyebrow eyebrow-accent mb-3">// leetcode practice</p>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Work through a curated problem set
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Pick a level, filter by company, category, or difficulty, and solve. A handful of
          problems run right here against real test cases — the rest link out to LeetCode itself.
        </p>
      </div>

      {error && (
        <p className="mt-6" style={{ color: 'var(--rust)', fontSize: '0.8125rem' }} role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm" style={{ color: 'var(--ink-soft)' }}>Loading levels…</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
            {levels.map((lvl) => {
              const active = lvl.key === activeLevel;
              return (
                <button
                  key={lvl.key}
                  onClick={() => {
                    setActiveLevel(lvl.key);
                    trackEvent('leetcode_level_selected', { level: lvl.key });
                  }}
                  className="pb-3 pt-1 text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--ink)' : 'var(--ink-soft)',
                    borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
                  }}
                >
                  {lvl.label}
                  <span className="ml-1.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    ({lvl.count})
                  </span>
                </button>
              );
            })}
          </div>

          {detail && (
            <p className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
              {detail.description}
            </p>
          )}

          {detail && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ink-soft)' }}>
                <span>
                  {completed.size} / {detail.problems.length} solved
                  {starred.size > 0 && ` · ${starred.size} starred`}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--line)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, backgroundColor: 'var(--green)' }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems…"
              className="field"
            />
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="field">
              {companies.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All companies' : c}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="field">
              {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
              <input
                type="checkbox"
                checked={starredOnly}
                onChange={(e) => setStarredOnly(e.target.checked)}
              />
              Starred only
            </label>
            <button onClick={surpriseMe} className="btn btn-secondary text-xs">
              🎲 Surprise me
            </button>
          </div>

          <div className="mt-6 space-y-2">
            {detailLoading && (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Loading problems…</p>
            )}

            {!detailLoading && filteredProblems.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                No problems match your filters.
              </p>
            )}

            {!detailLoading && filteredProblems.map((p) => {
              const isDone = completed.has(p.slug);
              const isStarred = starred.has(p.slug);
              const visibleCompanies = p.companies.slice(0, 3);
              const extraCount = p.companies.length - visibleCompanies.length;

              const Row = (
                <div
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border px-4 py-3 transition-colors"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={(e) => toggleStar(p.slug, e)}
                      aria-label={isStarred ? 'Unstar problem' : 'Star problem'}
                      className="flex-shrink-0 text-sm"
                      style={{ color: isStarred ? 'var(--score-amber)' : 'var(--ink-soft)' }}
                    >
                      {isStarred ? '★' : '☆'}
                    </button>
                    <span
                      aria-hidden
                      className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px]"
                      style={{
                        borderColor: isDone ? 'var(--green)' : 'var(--line-strong)',
                        backgroundColor: isDone ? 'var(--green)' : 'transparent',
                        color: isDone ? '#fff' : 'transparent',
                      }}
                    >
                      ✓
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      {p.companies.length > 0 ? (
                        <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          {visibleCompanies.join(' · ')}
                          {extraCount > 0 && ` · +${extraCount} more`}
                        </span>
                      ) : (
                        !p.solvable && (
                          <span
                            className="mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px]"
                            style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
                          >
                            on LeetCode
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="hidden text-xs sm:inline" style={{ color: 'var(--ink-soft)' }}>
                      {p.category}
                    </span>
                    <span className="text-xs font-medium" style={{ color: difficultyColor(p.difficulty) }}>
                      {p.difficulty}
                    </span>
                  </div>
                </div>
              );

              return p.solvable ? (
                <Link key={p.slug} href={`/leetcode/${p.slug}`} className="block hover:opacity-80">
                  {Row}
                </Link>
              ) : (
                <a
                  key={p.slug}
                  href={p.leetcode_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-80"
                  onClick={() => trackEvent('leetcode_external_open', { slug: p.slug })}
                >
                  {Row}
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function LeetCodePage() {
  return (
    <AuthGuard>
      <LeetCodeContent />
    </AuthGuard>
  );
}
