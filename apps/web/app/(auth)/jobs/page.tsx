'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AppShell from '../../components/AppShell';
import { trackEvent } from '@/lib/analytics';

interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  posted_at: string;
  location?: string;
}

const PAGE_SIZE = 24;

function JobCard({ job, onApply }: { job: Job; onApply: (job: Job) => void }) {
  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">
          {job.source} · {new Date(job.posted_at).toLocaleDateString()}
        </p>
        {job.location && (
          <span className="chip chip-muted flex-shrink-0 text-[0.65rem]">{job.location}</span>
        )}
      </div>
      <h2 className="display mt-2 text-base font-medium leading-snug" style={{ color: 'var(--ink)' }}>
        {job.title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{job.company}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {job.description.substring(0, 140)}…
      </p>
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary mt-4 self-start text-sm"
        onClick={() => onApply(job)}
      >
        Apply
      </a>
    </div>
  );
}

export default function JobsPage() {
  const { user, token, logout } = useAuth();

  // All fetched jobs
  const [allJobs, setAllJobs]     = useState<Job[]>([]);
  const [filtered, setFiltered]   = useState<Job[]>([]);
  const [visible, setVisible]     = useState<Job[]>([]);

  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]         = useState('');
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [hasMore, setHasMore]     = useState(false);
  const [page, setPage]           = useState(1);

  // Filters
  const [search, setSearch]       = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sources, setSources]     = useState<string[]>([]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const FETCH_LIMIT = 200;

  useEffect(() => {
    trackEvent('jobs_page_view');
    if (!token) return;
    fetchJobs(0, true);
  }, [token]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          loadNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered, page, loadingMore]);

  // Re-apply filter whenever search/source/allJobs change
  useEffect(() => {
    applyFilter(allJobs, search, sourceFilter);
  }, [search, sourceFilter, allJobs]);

  const fetchJobs = async (currentOffset: number, initial = false) => {
    if (initial) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const data = await api.get(`/jobs/?limit=${FETCH_LIMIT}&offset=${currentOffset}`);
      const jobs: Job[] = Array.isArray(data) ? data : data.jobs ?? [];
      const serverTotal: number = data.total ?? jobs.length + currentOffset;

      const merged = initial ? jobs : [...allJobs, ...jobs];
      setAllJobs(merged);
      setTotal(serverTotal);
      setOffset(currentOffset + jobs.length);
      setHasMore(currentOffset + jobs.length < serverTotal);

      // Collect unique sources for filter
      const allSources = Array.from(new Set(merged.map((j) => j.source).filter(Boolean)));
      setSources(allSources);

      trackEvent('jobs_loaded', { count: merged.length, total: serverTotal });
    } catch (err: any) {
      setError(err.message || "Couldn't load internships.");
      trackEvent('jobs_load_error', { error: err.message });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const applyFilter = (jobs: Job[], q: string, src: string) => {
    const lower = q.toLowerCase();
    const result = jobs.filter((j) => {
      const matchQ =
        !q ||
        j.title.toLowerCase().includes(lower) ||
        j.company.toLowerCase().includes(lower) ||
        j.description.toLowerCase().includes(lower);
      const matchSrc = !src || j.source === src;
      return matchQ && matchSrc;
    });
    setFiltered(result);
    setPage(1);
    setVisible(result.slice(0, PAGE_SIZE));
  };

  const loadNextPage = () => {
    const nextPage = page + 1;
    const nextSlice = filtered.slice(0, nextPage * PAGE_SIZE);
    if (nextSlice.length > visible.length) {
      setVisible(nextSlice);
      setPage(nextPage);
    }
    // If we've shown all filtered and there are more on server, fetch more
    if (nextSlice.length >= filtered.length && hasMore && !loadingMore) {
      fetchJobs(offset);
    }
  };

  const handleApplyClick = (job: Job) => {
    trackEvent('job_apply_clicked', {
      job_id: job.id,
      title: job.title,
      company: job.company,
      source: job.source,
    });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    trackEvent('jobs_searched', { query: val });
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceFilter(e.target.value);
    trackEvent('jobs_filtered', { source: e.target.value });
  };

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('');
  };

  const isFiltered = search !== '' || sourceFilter !== '';
  const showingAll = visible.length >= filtered.length && !hasMore;

  return (
    <AppShell user={user} onLogout={() => { trackEvent('logout'); logout(); }}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-accent">// internships</p>
          <h1 className="display mt-2 text-3xl font-medium">Latest postings</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Pulled from multiple sources and refreshed daily.
          </p>
        </div>
        {!loading && allJobs.length > 0 && (
          <p className="eyebrow" style={{ color: 'var(--muted)' }}>
            {isFiltered
              ? `${filtered.length} of ${allJobs.length} listings`
              : `${allJobs.length}${hasMore ? '+' : ''} listings`}
          </p>
        )}
      </div>

      {/* Search + filter bar */}
      {!loading && allJobs.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search by title, company, or keyword…"
            className="field flex-1"
            style={{ minWidth: 0 }}
          />
          {sources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={handleSourceChange}
              className="field sm:w-48 flex-shrink-0"
            >
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {isFiltered && (
            <button onClick={clearFilters} className="btn btn-ghost text-sm flex-shrink-0">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="panel animate-pulse p-5 space-y-3">
              <div className="h-3 w-28 rounded" style={{ background: 'var(--line)' }} />
              <div className="h-4 w-48 rounded" style={{ background: 'var(--line)' }} />
              <div className="h-3 w-32 rounded" style={{ background: 'var(--line)' }} />
              <div className="space-y-2 mt-2">
                <div className="h-3 w-full rounded" style={{ background: 'var(--line)' }} />
                <div className="h-3 w-4/5 rounded" style={{ background: 'var(--line)' }} />
                <div className="h-3 w-3/5 rounded" style={{ background: 'var(--line)' }} />
              </div>
              <div className="h-8 w-20 rounded mt-3" style={{ background: 'var(--line)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="panel mt-8 flex flex-wrap items-center gap-4 p-6">
          <p className="chip chip-rust">{error}</p>
          <button
            onClick={() => { trackEvent('jobs_retry_clicked'); fetchJobs(0, true); }}
            className="btn btn-secondary text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* No results from filter */}
      {!loading && !error && filtered.length === 0 && allJobs.length > 0 && (
        <div className="mt-10 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No listings match your search.
          </p>
          <button onClick={clearFilters} className="btn btn-secondary mt-4 text-sm">
            Clear filters
          </button>
        </div>
      )}

      {/* Empty from API */}
      {!loading && !error && allJobs.length === 0 && (
        <p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
          No internships found right now — check back soon.
        </p>
      )}

      {/* Job grid */}
      {!loading && !error && visible.length > 0 && (
        <>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((job) => (
              <JobCard key={job.id} job={job} onApply={handleApplyClick} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {!showingAll && (
            <div ref={sentinelRef} className="mt-8 flex justify-center">
              {loadingMore ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="progress-bar-wrap" style={{ width: '12rem' }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: '60%', transition: 'none', animation: 'pulse 1.5s ease-in-out infinite' }}
                    />
                  </div>
                  <p className="eyebrow">loading more…</p>
                </div>
              ) : (
                <button
                  onClick={loadNextPage}
                  className="btn btn-secondary text-sm"
                >
                  Load more listings
                </button>
              )}
            </div>
          )}

          {/* Done indicator */}
          {showingAll && visible.length > PAGE_SIZE && (
            <p className="mt-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Showing all {filtered.length} listing{filtered.length !== 1 ? 's' : ''}.
            </p>
          )}
        </>
      )}
    </AppShell>
  );
}