'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4">
        <div className="container mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Internship Platform</h1>
          {user ? (
            <div>
              <span className="mr-4">{user.email}</span>
              <button onClick={logout} className="text-red-500">Logout</button>
            </div>
          ) : (
            <Link href="/login" className="text-blue-500">Login</Link>
          )}
        </div>
      </nav>
      <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/github" className="bg-white p-6 rounded shadow hover:shadow-lg">
          <h2 className="text-xl font-bold">GitHub Integration</h2>
          <p>Connect repos, real terminal, AI code review</p>
        </Link>
        <Link href="/resume/builder" className="bg-white p-6 rounded shadow hover:shadow-lg">
          <h2 className="text-xl font-bold">Resume Builder</h2>
          <p>Create professional resumes (Premium)</p>
        </Link>
        <Link href="/jobs" className="bg-white p-6 rounded shadow hover:shadow-lg">
          <h2 className="text-xl font-bold">Internships</h2>
          <p>Find latest internships</p>
        </Link>
      </div>
    </div>
  );
}