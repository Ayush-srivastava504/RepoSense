'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Resume {
  id: string;
  title: string;
  content: any;
  created_at: string;
}

export default function ResumeBuilder() {
  const { user, token } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isPremium = user?.subscription_tier === 'premium';

  useEffect(() => {
    if (token && isPremium) {
      loadResumes();
    }
  }, [token, isPremium]);

  const loadResumes = async () => {
    try {
      const data = await api.get('/resume/list');
      setResumes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveResume = async () => {
    if (!isPremium) {
      setMessage('Upgrade to premium to save resumes.');
      return;
    }
    setLoading(true);
    try {
      const payload = { title, content: JSON.parse(content) };
      await api.post('/resume/create', payload);
      setMessage('Resume saved successfully!');
      loadResumes();
      setTitle('');
      setContent('');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Premium Feature</h1>
        <p className="mb-4">Resume builder is available for premium subscribers only.</p>
        <button className="bg-green-600 text-white px-6 py-2 rounded">Upgrade Now</button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Resume Builder</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar: List of resumes */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-3">My Resumes</h2>
          {resumes.length === 0 && <p className="text-gray-500">No resumes yet.</p>}
          <ul className="space-y-2">
            {resumes.map((res) => (
              <li
                key={res.id}
                className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setSelectedResume(res)}
              >
                {res.title}
              </li>
            ))}
          </ul>
        </div>
        {/* Editor */}
        <div className="md:col-span-2 bg-white p-4 rounded shadow">
          <input
            type="text"
            placeholder="Resume Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          />
          <textarea
            placeholder='Resume content (JSON format) e.g., {"summary":"...", "experience":[]}'
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-64 border p-2 rounded font-mono text-sm"
          />
          <button
            onClick={saveResume}
            disabled={loading}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Saving...' : 'Save Resume'}
          </button>
          {message && <p className="mt-2 text-green-600">{message}</p>}
          {selectedResume && (
            <div className="mt-4 p-3 border-t">
              <h3 className="font-semibold">Preview (JSON)</h3>
              <pre className="text-xs bg-gray-100 p-2 overflow-auto">
                {JSON.stringify(selectedResume.content, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
