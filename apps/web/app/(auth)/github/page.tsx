'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function GitHubPage() {
  const { user } = useAuth();
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setConnected(true);
      router.replace('/github');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setConnected(true);
    setLoadingRepos(true);

    api.get('/github/repos')
      .then(setRepos)
      .catch(() => setRepos([]))
      .finally(() => setLoadingRepos(false));
  }, [user]);

  useEffect(() => {
    if (!selectedRepo) return;

    api.get(`/github/contents?repo=${selectedRepo}&path=${currentPath}`)
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
      api.get(`/github/file?repo=${selectedRepo}&path=${file.path}`)
        .then((res) => setCode(res.content));
    }
  };

  const runReview = async () => {
    const result = await api.post('/v1/review', {
      code,
      language: 'python',
    });
    setReview(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-gray-200 p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-100">GitHub Integration</h1>

      {!connected ? (
        <button
          onClick={connectGitHub}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white"
        >
          Connect GitHub Account
        </button>
      ) : loadingRepos ? (
        <p>Loading...</p>
      ) : (
        <>
          <select
            className="bg-gray-800 border border-gray-700 p-2 rounded mb-4 w-full text-gray-200"
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              setCurrentPath('');
              setCode('');
            }}
          >
            <option>Select a repo</option>
            {repos.map((repo: any) => (
              <option key={repo.id} value={repo.full_name}>
                {repo.full_name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 p-2 h-96 overflow-auto rounded">
              {files.map((file: any) => (
                <div
                  key={file.path}
                  className="cursor-pointer p-1 hover:bg-red-800 rounded"
                  onClick={() => openFile(file)}
                >
                  {file.name}
                </div>
              ))}
            </div>

            <div className="bg-black border border-gray-700 p-3 h-96 overflow-auto rounded">
              <pre className="text-sm whitespace-pre-wrap text-green-400 font-mono">
                {code}
              </pre>
            </div>
          </div>

          <button
            onClick={runReview}
            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded mt-4"
          >
            Review Code
          </button>

          {review && (
            <pre className="bg-gray-900 border border-gray-700 p-4 mt-4 overflow-auto rounded text-gray-300">
              {JSON.stringify(review, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}