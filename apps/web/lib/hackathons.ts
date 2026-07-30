export const BASE_URL = 'https://www.intern-flow.in';

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://api.intern-flow.in';

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
  limit?: number;
  offset?: number;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string'
    );
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string'
        );
      }
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeHackathon(data: Hackathon): Hackathon {
  return {
    ...data,
    themes: parseStringArray(data.themes),
    submission_requirements: parseStringArray(
      data.submission_requirements
    ),
    sources: parseStringArray(data.sources),
  };
}

export async function getHackathons(
  options: {
    search?: string;
    mode?: string;
    country?: string;
    theme?: string;
    isGlobal?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Hackathon[]> {
  try {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
    });

    if (options.search) {
      params.set('search', options.search);
    }

    if (options.mode) {
      params.set('mode', options.mode);
    }

    if (options.country) {
      params.set('country', options.country);
    }

    if (options.theme) {
      params.set('theme', options.theme);
    }

    if (options.isGlobal !== undefined) {
      params.set('is_global', String(options.isGlobal));
    }

    const url = `${API_BASE_URL}/api/hackathons/?${params.toString()}`;

    console.log('Fetching hackathons from:', url);

    const res = await fetch(url, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(
        'Hackathons API returned',
        res.status,
        await res.text()
      );

      return [];
    }

    const data: HackathonsResponse = await res.json();

    return (data.items ?? []).map(normalizeHackathon);
  } catch (err) {
    console.error('Failed to fetch hackathons:', err);

    return [];
  }
}

export async function getFeaturedHackathons(
  limit = 6
): Promise<Hackathon[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/hackathons/featured?limit=${limit}`,
      {
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return [];
    }

    const data: HackathonsResponse = await res.json();

    return (data.items ?? []).map(normalizeHackathon);
  } catch (err) {
    console.error('Failed to fetch featured hackathons:', err);

    return [];
  }
}

export async function getHackathonsEndingSoon(
  limit = 20
): Promise<Hackathon[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/hackathons/ending-soon?limit=${limit}`,
      {
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return [];
    }

    const data: HackathonsResponse = await res.json();

    return (data.items ?? []).map(normalizeHackathon);
  } catch (err) {
    console.error('Failed to fetch ending-soon hackathons:', err);

    return [];
  }
}

export async function getHackathonBySlug(
  slug: string
): Promise<Hackathon | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/hackathons/${encodeURIComponent(slug)}`,
      {
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return null;
    }

    const data: Hackathon = await res.json();

    return normalizeHackathon(data);
  } catch (err) {
    console.error('Failed to fetch hackathon:', err);

    return null;
  }
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) {
    return null;
  }

  const diffMs = new Date(dateStr).getTime() - Date.now();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDeadline(dateStr?: string): string {
  const days = daysUntil(dateStr);

  if (days === null) {
    return 'Deadline TBA';
  }

  if (days < 0) {
    return 'Registration closed';
  }

  if (days === 0) {
    return 'Ends today';
  }

  if (days === 1) {
    return '1 day left';
  }

  return `${days} days left`;
}