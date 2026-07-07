export const BASE_URL = 'https://intern-flow.in';

export interface Hackathon {
  id: string;
  title: string;
  slug: string;
  organizer?: string;
  description?: string;
  participation_mode?: 'online' | 'offline' | 'hybrid';
  location?: string;
  country?: string;
  is_global?: boolean;
  is_student_friendly?: boolean;
  start_date?: string;
  end_date?: string;
  registration_deadline?: string;
  prize_pool_text?: string;
  prize_value_usd?: number;
  team_size_min?: number;
  team_size_max?: number;
  eligibility?: string;
  themes?: string[];
  submission_requirements?: string[];
  source?: string;
  sources?: string[];
  source_url?: string;
  apply_url?: string;
  image_url?: string;
  status?: 'upcoming' | 'ongoing' | 'ended' | 'registration_closed';
  quality_score?: number;
  trust_score?: number;
  first_seen_at?: string;
}

interface HackathonsResponse {
  items: Hackathon[];
  total?: number;
}

/**
 * Main hackathon feed. Defaults to the top 20 — the discovery page is
 * intentionally a short, curated list (the crawler already filtered out
 * low-quality/expired/duplicate listings), not a paginated directory.
 */
export async function getHackathons(options: {
  search?: string;
  mode?: string;
  country?: string;
  theme?: string;
  limit?: number;
} = {}): Promise<Hackathon[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 20),
    });

    if (options.search) params.set('search', options.search);
    if (options.mode) params.set('mode', options.mode);
    if (options.country) params.set('country', options.country);
    if (options.theme) params.set('theme', options.theme);

    const res = await fetch(
      `${process.env.API_BASE_URL}/api/hackathons/?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error('Hackathons API returned', res.status);
      return [];
    }

    const data: HackathonsResponse = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error('Failed to fetch hackathons:', err);
    return [];
  }
}

export async function getFeaturedHackathons(limit = 6): Promise<Hackathon[]> {
  if (!process.env.API_BASE_URL) return [];

  try {
    const res = await fetch(
      `${process.env.API_BASE_URL}/api/hackathons/featured?limit=${limit}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: HackathonsResponse = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error('Failed to fetch featured hackathons:', err);
    return [];
  }
}

export async function getHackathonsEndingSoon(limit = 20): Promise<Hackathon[]> {
  if (!process.env.API_BASE_URL) return [];

  try {
    const res = await fetch(
      `${process.env.API_BASE_URL}/api/hackathons/ending-soon?limit=${limit}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: HackathonsResponse = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error('Failed to fetch ending-soon hackathons:', err);
    return [];
  }
}

export async function getHackathonBySlug(slug: string): Promise<Hackathon | null> {
  if (!process.env.API_BASE_URL) return null;

  try {
    const res = await fetch(`${process.env.API_BASE_URL}/api/hackathons/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('Failed to fetch hackathon:', err);
    return null;
  }
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDeadline(dateStr?: string): string {
  const days = daysUntil(dateStr);
  if (days === null) return 'Deadline TBA';
  if (days < 0) return 'Registration closed';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}
