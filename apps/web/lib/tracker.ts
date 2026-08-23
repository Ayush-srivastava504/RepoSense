// lib/tracker.ts
//
// "My Applications" tracker — a lightweight, fully client-side Kanban
// store for jobs the user has saved or applied to. Deliberately kept in
// localStorage (no backend/auth dependency) so it works instantly for
// guests too, same philosophy as the existing guest-JWT flow: never make
// a visitor sign up before they've gotten value out of the product.
//
// Feature: Application Tracker ("My Applications")
// -------------------------------------------------
// Job boards are stateless — a user finds a job, leaves, and has no way
// to remember what they saved, what they already applied to, or when a
// deadline is coming up. That's the single biggest reason people bounce
// off a job site after one visit. This store lets them save a job in one
// click from anywhere (card or detail page), move it through a simple
// pipeline (Saved → Applied → Interviewing → Offer / Rejected), and see
// deadlines sorted by urgency — turning a one-time visit into a habit
// they come back to, which is exactly what /tracker (see app/(auth)/
// tracker/page.tsx) renders.

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export interface TrackedJob {
  jobId: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  deadline?: string;
  status: ApplicationStatus;
  savedAt: string; // ISO timestamp
  statusUpdatedAt: string; // ISO timestamp
  notes?: string;
}

const STORAGE_KEY = 'reposense:tracked-jobs:v1';
const EVENT_NAME = 'reposense:tracker-changed';

function isBrowser() {
  return typeof window !== 'undefined';
}

function readAll(): Record<string, TrackedJob> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TrackedJob>) : {};
  } catch {
    return {};
  }
}

function writeAll(entries: Record<string, TrackedJob>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  // Same-tab listeners don't get the native `storage` event (that only
  // fires in *other* tabs), so broadcast our own so every mounted
  // SaveJobButton / tracker board stays in sync on this tab too.
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getTrackedJobs(): TrackedJob[] {
  return Object.values(readAll()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export function getTrackedJob(jobId: string): TrackedJob | undefined {
  return readAll()[jobId];
}

export function isTracked(jobId: string): boolean {
  return Boolean(readAll()[jobId]);
}

export function saveJob(job: {
  id: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  deadline?: string;
}): TrackedJob {
  const all = readAll();
  const now = new Date().toISOString();
  const existing = all[job.id];

  const entry: TrackedJob = existing ?? {
    jobId: job.id,
    title: job.title,
    company: job.company,
    url: job.url,
    location: job.location,
    deadline: job.deadline,
    status: 'saved',
    savedAt: now,
    statusUpdatedAt: now,
  };

  all[job.id] = entry;
  writeAll(all);
  return entry;
}

export function updateStatus(jobId: string, status: ApplicationStatus) {
  const all = readAll();
  const entry = all[jobId];
  if (!entry) return;
  entry.status = status;
  entry.statusUpdatedAt = new Date().toISOString();
  writeAll(all);
}

export function updateNotes(jobId: string, notes: string) {
  const all = readAll();
  const entry = all[jobId];
  if (!entry) return;
  entry.notes = notes;
  writeAll(all);
}

export function removeTrackedJob(jobId: string) {
  const all = readAll();
  delete all[jobId];
  writeAll(all);
}

/** Subscribe to changes (same-tab + cross-tab). Returns an unsubscribe fn. */
export function subscribeTracker(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const STATUS_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
];

/** Days until deadline; negative means it has passed. Null if no deadline. */
export function daysUntilDeadline(deadline?: string): number | null {
  if (!deadline) return null;
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
