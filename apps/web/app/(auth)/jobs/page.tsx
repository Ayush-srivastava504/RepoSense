'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    api.get('/jobs').then(setJobs);
  }, []);
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Internships</h1>
      <div className="grid gap-4">
        {jobs.map((job: any) => (
          <div key={job.id} className="border p-4 rounded shadow">
            <h2 className="text-xl">{job.title}</h2>
            <p className="text-gray-600">{job.company}</p>
            <p className="text-sm text-gray-500">{job.source}</p>
            <a href={job.url} target="_blank" className="text-blue-500">Apply</a>
          </div>
        ))}
      </div>
    </div>
  );
}