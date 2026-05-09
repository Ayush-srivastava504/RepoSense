'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      <div className="bg-red-500 text-white p-4 text-center">
        Tailwind Test
      </div>

      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-gray-800">InternFlow</div>
          <div className="space-x-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
            <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
          AI-Powered Code Review & Internship Platform
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
          Automate code reviews, connect GitHub, build your resume, and find internships – all in one place.
        </p>
        <Link href="/register" className="bg-blue-600 text-white text-lg px-8 py-3 rounded-lg hover:bg-blue-700">
          Start Free Trial
        </Link>
      </section>

      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-semibold mb-2">AI Code Review</h3>
            <p className="text-gray-600">Real-time bug detection, security scanning, and quality metrics.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-semibold mb-2">GitHub Terminal</h3>
            <p className="text-gray-600">Live bash terminal connected to your repositories.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-semibold mb-2">Resume Builder</h3>
            <p className="text-gray-600">ATS-optimised templates with AI suggestions.</p>
          </div>
        </div>
      </section>

    </div>
  );
}