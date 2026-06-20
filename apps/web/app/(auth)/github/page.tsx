'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../components/AppShell';

export default function GitHubPage() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [code, setCode] = useState('');
  const [review, setReview] = useState(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connected, setConnected] = useState(false);
  const [generatedReadme, setGeneratedReadme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReadme, setShowReadme] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      refresh();
      setConnected(true);
      router.replace('/github');
    }
  }, [searchParams, router, refresh]);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setConnected(true);
    setLoadingRepos(true);

    api
      .get('/github/repos')
      .then(setRepos)
      .catch(() => setRepos([]))
      .finally(() => setLoadingRepos(false));
  }, [user]);

  useEffect(() => {
    if (!selectedRepo) return;

    api
      .get(`/github/contents?repo=${selectedRepo}&path=${currentPath}`)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [selectedRepo, currentPath]);

  const connectGitHub = () => {
    window.location.href = `${API_URL}/api/github/login`;
  };

  const openFile = (file: any) => {
    if (file.type === 'dir') {
      setCurrentPath(file.path);
    } else {
      api.get(`/github/file?repo=${selectedRepo}&path=${file.path}`).then((res) => setCode(res.content));
    }
  };

  const runReview = async () => {
    setReviewing(true);
    try {
      const result = await api.post('/v1/review', { code, language: 'python' });
      setReview(result);
    } finally {
      setReviewing(false);
    }
  };

  const generateReadme = async () => {
    if (!selectedRepo) {
      alert('Select a repository first.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await api.post(`/github/${selectedRepo}/auto-setup`, {});
      setGeneratedReadme(result.readme);
      setShowReadme(true);
    } catch (error) {
      console.error('Error generating README:', error);
      alert("Couldn't generate the README. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow eyebrow-accent">// code review</p>
          <h1 className="display mt-2 text-3xl font-medium">GitHub</h1>
        </div>
        {connected && (
          <span className="chip chip-green">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--green)' }} />
            connected
          </span>
        )}
      </div>

      {!connected ? (
        <div className="panel mt-8 max-w-md p-8">
          <p className="text-[0.9375rem]" style={{ color: 'var(--ink-soft)' }}>
            Connect a GitHub account to browse repositories and run reviews on real code.
          </p>
          <button onClick={connectGitHub} className="btn btn-primary mt-5">
            Connect GitHub account
          </button>
        </div>
      ) : loadingRepos ? (
        <p className="mt-8 eyebrow">loading repositories…</p>
      ) : (
        <div className="mt-8">
          <select
            className="field max-w-md"
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              setCurrentPath('');
              setCode('');
              setReview(null);
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Select a repository
            </option>
            {repos.map((repo: any) => (
              <option key={repo.id} value={repo.full_name}>
                {repo.full_name}
              </option>
            ))}
          </select>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="panel">
              <div className="border-b px-4 py-3" style={{ borderColor: 'var(--line)' }}>
                <p className="eyebrow">files {currentPath ? `/ ${currentPath}` : ''}</p>
              </div>
              <div className="h-80 overflow-auto p-2">
                {currentPath && (
                  <button
                    onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                    className="w-full rounded-[var(--radius-sm)] p-2 text-left text-sm hover:bg-[var(--paper-dim)]"
                  >
                    .. back
                  </button>
                )}
                {files.map((file: any) => (
                  <button
                    key={file.path}
                    onClick={() => openFile(file)}
                    className="block w-full rounded-[var(--radius-sm)] p-2 text-left text-sm hover:bg-[var(--paper-dim)]"
                  >
                    {file.type === 'dir' ? '📁 ' : '📄 '}
                    {file.name}
                  </button>
                ))}
                {!files.length && <p className="p-2 text-sm" style={{ color: 'var(--muted)' }}>No files to show.</p>}
              </div>
            </div>

            <div className="panel-dark overflow-hidden">
              <div className="border-b px-4 py-3" style={{ borderColor: '#2a2d35' }}>
                <p className="eyebrow" style={{ color: '#9ea3ab' }}>
                  preview
                </p>
              </div>
              <pre className="h-80 overflow-auto p-4 text-[0.8125rem] leading-relaxed" style={{ fontFamily: 'var(--font-mono)', color: '#d7d6cf' }}>
                {code || '// select a file to preview it here'}
              </pre>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={runReview} disabled={!code || reviewing} className="btn btn-primary">
              {reviewing ? 'Reviewing…' : 'Review this file'}
            </button>
            <button
              onClick={generateReadme}
              disabled={isGenerating || !selectedRepo}
              className="btn btn-secondary"
            >
              {isGenerating ? 'Generating README…' : 'Generate README'}
            </button>
          </div>

          {review && (
            <div className="panel mt-6 p-5">
              <p className="eyebrow eyebrow-accent mb-3">// review result</p>
              <pre className="overflow-auto text-[0.8125rem] leading-relaxed" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}>
                {JSON.stringify(review, null, 2)}
              </pre>
            </div>
          )}

          {showReadme && generatedReadme && (
            <div className="panel mt-6 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow eyebrow-accent">// generated readme</p>
                <button onClick={() => setShowReadme(false)} className="btn btn-ghost !px-2 !py-1 text-sm">
                  Close
                </button>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-[0.875rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {generatedReadme}
              </pre>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}