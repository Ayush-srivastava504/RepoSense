const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

function extractErrorMessage(rawText: string, status: number) {
  // FastAPI (and most JSON APIs) return errors as { "detail": "..." }
  // or { "message": "..." }. Try that first; fall back to the raw
  // text so nothing is silently swallowed.
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.detail) {
      // FastAPI validation errors can return detail as an array of
      // { msg, loc } objects rather than a string.
      if (Array.isArray(parsed.detail)) {
        return parsed.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
      return String(parsed.detail);
    }
    if (parsed?.message) return String(parsed.message);
    return rawText;
  } catch {
    return rawText || `Request failed with status ${status}`;
  }
}

export const api = {

  async request(
    endpoint: string,
    options?: RequestInit
  ) {

    const token =
      localStorage.getItem('token');

    const res = await fetch(
      `${API_URL}/api${endpoint}`,
      {
        ...options,

        headers: {
          'Content-Type': 'application/json',

          ...(token && {
            Authorization: `Bearer ${token}`
          }),

          ...options?.headers,
        },
      }
    );

    if (!res.ok) {
      const rawText = await res.text();
      throw new Error(extractErrorMessage(rawText, res.status));
    }

    const contentType =
      res.headers.get('content-type');

    if (
      contentType?.includes(
        'application/pdf'
      )
    ) {

      return res.blob();
    }

    return res.json();
  },

  get: (endpoint: string) =>
    api.request(endpoint),

  post: (
    endpoint: string,
    data: any
  ) =>
    api.request(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    ),
};