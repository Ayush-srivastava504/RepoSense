'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function ResumeBuilder() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState({ summary: '', experience: [] });

  const saveResume = async () => {
    if (user?.subscription_tier !== 'premium') {
      alert('Please upgrade to premium to save resumes');
      return;
    }
    await api.post('/resume/create', { title, content });
    alert('Resume saved');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Resume Builder</h1>
      <input className="border p-2 w-full mb-4" placeholder="Resume title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="border p-2 w-full h-64" placeholder="JSON content" value={JSON.stringify(content)} onChange={(e) => setContent(JSON.parse(e.target.value))} />
      <button onClick={saveResume} className="bg-blue-500 text-white p-2 rounded mt-2">Save Resume</button>
    </div>
  );
}