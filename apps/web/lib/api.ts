const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

function extractErrorMessage(rawText: string, status: number) {
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.detail) {
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
  async request(endpoint: string, options?: RequestInit) {
    const token = localStorage.getItem('token');

    const res = await fetch(`${API_URL}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const rawText = await res.text();
      const err: any = new Error(extractErrorMessage(rawText, res.status));
      err.status = res.status; // NEW — lets callers branch on status (e.g. 401)
      throw err;
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/pdf')) {
      return res.blob();
    }

    return res.json();
  },

  get: (endpoint: string) => api.request(endpoint),

  post: (endpoint: string, data: any) =>
    api.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),

  async pollJob(
    jobId: string,
    onProgress?: (status: string) => void,
    intervalMs = 3000,
    timeoutMs = 600_000,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const job = await api.get(`/async-jobs/${jobId}`);

      onProgress?.(job.status);

      if (job.status === 'done') {
        return job.result;
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Job failed without an error message.');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Job timed out waiting for a result.');
  },
};