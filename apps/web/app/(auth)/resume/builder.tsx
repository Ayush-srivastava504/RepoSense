'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function ResumeBuilder() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const saveResume = async () => {
    try {

      setLoading(true);

      const payload = {
        title,
        content: {
          summary,
          experience: [],
        },
      };

      await api.post(
        '/resume/create',
        payload
      );

      alert('Resume saved successfully');

    } catch (err: any) {

      console.error(err);

      alert(
        err?.response?.data?.detail ||
        'Failed to save resume'
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">

      <h1 className="text-3xl font-bold mb-6">
        Resume Builder
      </h1>

      <div className="mb-4">

        <label className="block mb-2 font-medium">
          Resume Title
        </label>

        <input
          className="border p-3 w-full rounded"
          placeholder="Frontend Developer Resume"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
        />

      </div>

      <div className="mb-4">

        <label className="block mb-2 font-medium">
          Professional Summary
        </label>

        <textarea
          className="border p-3 w-full h-48 rounded"
          placeholder="Write your professional summary..."
          value={summary}
          onChange={(e) =>
            setSummary(e.target.value)
          }
        />

      </div>

      <button
        onClick={saveResume}
        disabled={loading}
        className="bg-blue-600 text-white px-5 py-3 rounded hover:bg-blue-700"
      >
        {
          loading
            ? 'Saving...'
            : 'Save Resume'
        }
      </button>

    </div>
  );
}