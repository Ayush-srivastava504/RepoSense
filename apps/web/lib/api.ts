const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

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

      throw new Error(
        await res.text()
      );
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