'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  FileText, Upload, Sparkles, Sliders, Play, CheckCircle2, 
  XCircle, Clock, Eye, AlertCircle, Briefcase, ChevronRight, RefreshCw, ShieldCheck
} from 'lucide-react';

interface CandidateProfile {
  full_name: string;
  email: string;
  phone: string;
  skills: string[];
  raw_text?: string;
}

interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  apply_url: string;
  ats_type: string;
  required_skills: string[];
  description: string;
}

interface MatchResult {
  job_id: string;
  job_title: string;
  company: string;
  overall_score: number;
  keyword_score: number;
  title_score: number;
  matched_skills: string[];
  missing_skills: string[];
  is_recommended: boolean;
  rationale: string;
}

interface ApplicationSubmissionResult {
  job_id: string;
  company: string;
  status: string;
  form_type: string;
  logs: string;
  screenshot_path?: string;
  error_message?: string;
}

interface ApplicationRecord {
  id?: string;
  user_id: string;
  job_id: string;
  company: string;
  title: string;
  status: string;
  applied_at: string;
  logs?: string;
  screenshot_path?: string;
}

export default function AutoApplyDashboard() {
  const [activeTab, setActiveTab] = useState<'profile' | 'match' | 'execute' | 'history'>('profile');

  // Candidate State
  const [resumeText, setResumeText] = useState('');
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  // Matching & Filtering Settings
  const [minScore, setMinScore] = useState(65);
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [matchedJobs, setMatchedJobs] = useState<{ job: DiscoveredJob; match: MatchResult }[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Execution Settings
  const [applyLimit, setApplyLimit] = useState(3);
  const [dryRun, setDryRun] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<ApplicationSubmissionResult[]>([]);

  // Application History
  const [historyRecords, setHistoryRecords] = useState<ApplicationRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Fetch application history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.get('/auto-apply/history?limit=30');
      setHistoryRecords(data || []);
    } catch (err) {
      console.error('Failed to load application history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIngesting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/auto-apply/ingest`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (res.ok) {
        const profile = await res.json();
        setCandidateProfile(profile);
        if (profile.raw_text) setResumeText(profile.raw_text);
      }
    } catch (err) {
      console.error('Error parsing resume PDF:', err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleParseText = async () => {
    if (!resumeText.trim()) return;
    setIsIngesting(true);
    try {
      const formData = new FormData();
      formData.append('raw_text', resumeText);
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/auto-apply/ingest`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (res.ok) {
        const profile = await res.json();
        setCandidateProfile(profile);
      }
    } catch (err) {
      console.error('Error parsing text:', err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleDiscoverAndMatch = async () => {
    setIsDiscovering(true);
    try {
      const formData = new FormData();
      formData.append('resume_text', resumeText || candidateProfile?.raw_text || '');
      formData.append('min_score', String(minScore));
      formData.append('limit', '20');

      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/auto-apply/discover-and-match`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        let filtered = data || [];
        if (isRemoteOnly) {
          filtered = filtered.filter((item: any) => item.job.is_remote);
        }
        setMatchedJobs(filtered);
        setActiveTab('match');
      }
    } catch (err) {
      console.error('Discovery & matching error:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleRunPipeline = async () => {
    setIsExecuting(true);
    setExecutionResults([]);
    try {
      const payload = {
        resume_text: resumeText || candidateProfile?.raw_text || '',
        min_score: minScore,
        limit: applyLimit,
        dry_run: dryRun,
        is_remote: isRemoteOnly ? true : null
      };
      const res = await api.post('/auto-apply/run', payload);
      setExecutionResults(res.results || []);
      loadHistory();
      setActiveTab('execute');
    } catch (err) {
      console.error('Auto apply pipeline error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner Navigation */}
      <div className="panel p-2 flex flex-wrap gap-2 rounded-xl bg-opacity-50">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'profile' ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          1. Profile & Resume
        </button>

        <button
          onClick={() => setActiveTab('match')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'match' ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          2. Matching ({matchedJobs.length})
        </button>

        <button
          onClick={() => setActiveTab('execute')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'execute' ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Play className="w-4 h-4" />
          3. Auto-Apply Engine
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'history' ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          4. Application History
        </button>
      </div>

      {/* Tab 1: Profile & Resume Ingestion */}
      {activeTab === 'profile' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="panel p-6 space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Resume (PDF/Docx)
            </h3>
            <p className="text-sm text-slate-500">
              Upload your resume PDF to parse skills, experience, and contact details into structured JSON fields.
            </p>
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition">
              <FileText className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm font-medium">Click to upload or drag & drop</span>
              <span className="text-xs text-slate-400 mt-1">PDF or Docx (max 10MB)</span>
              <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
            </label>

            <div className="pt-2">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink mx-4 text-xs uppercase text-slate-400 font-semibold">Or Paste Resume Text</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste raw resume plain text here..."
                rows={6}
                className="w-full text-sm p-3 rounded-lg border dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleParseText}
                disabled={isIngesting || !resumeText.trim()}
                className="mt-3 w-full btn btn-primary py-2.5 flex items-center justify-center gap-2"
              >
                {isIngesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Parse & Extract Profile Fields
              </button>
            </div>
          </div>

          {/* Extracted Profile View */}
          <div className="panel p-6 space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Parsed Candidate Profile
            </h3>

            {candidateProfile ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Full Name</span>
                    <p className="font-medium">{candidateProfile.full_name || 'Not detected'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Email</span>
                    <p className="font-medium">{candidateProfile.email || 'Not detected'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Phone</span>
                    <p className="font-medium">{candidateProfile.phone || 'Not detected'}</p>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold block mb-2">
                    Extracted Skills ({candidateProfile.skills?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {candidateProfile.skills?.map((skill) => (
                      <span key={skill} className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleDiscoverAndMatch}
                    disabled={isDiscovering}
                    className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    {isDiscovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    Proceed to Job Discovery & Matching
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Upload a resume or paste text on the left to extract structured candidate details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Job Discovery & Matching */}
      {activeTab === 'match' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="panel p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1">
                  Min Match Score ({minScore}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-40 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="remote-only"
                  checked={isRemoteOnly}
                  onChange={(e) => setIsRemoteOnly(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="remote-only" className="text-sm font-medium cursor-pointer">
                  Remote jobs only
                </label>
              </div>
            </div>

            <button
              onClick={handleDiscoverAndMatch}
              disabled={isDiscovering}
              className="btn btn-outline py-2 px-4 flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
              Refresh Job Feed
            </button>
          </div>

          {/* Job Matches Grid */}
          <div className="space-y-4">
            {matchedJobs.length > 0 ? (
              matchedJobs.map(({ job, match }) => (
                <div key={job.id} className="panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-primary">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-lg">{job.title}</h4>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                        {job.ats_type}
                      </span>
                      {job.is_remote && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Remote
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-500">{job.company} • {job.location || 'Flexible'}</p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="font-semibold text-slate-400">Matched Skills:</span>
                      {match.matched_skills.map((skill) => (
                        <span key={skill} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          ✓ {skill}
                        </span>
                      ))}
                      {match.missing_skills.length > 0 && (
                        <>
                          <span className="font-semibold text-slate-400 ml-2">Missing:</span>
                          {match.missing_skills.slice(0, 3).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              ! {skill}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{match.overall_score}%</div>
                      <span className="text-xs text-slate-400">Compatibility Score</span>
                    </div>

                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline py-2 px-3 text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Posting
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="panel p-12 text-center text-slate-400">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No matching job postings found yet.</p>
                <p className="text-xs text-slate-400 mt-1">Click &quot;Refresh Job Feed&quot; to fetch and score open positions against your profile.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Auto-Apply Engine Execution */}
      {activeTab === 'execute' && (
        <div className="space-y-6">
          <div className="panel p-6 space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              Automated Application Execution Controls
            </h3>

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1">
                  Application Count Limit
                </label>
                <select
                  value={applyLimit}
                  onChange={(e) => setApplyLimit(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border dark:border-slate-700 bg-transparent text-sm"
                >
                  <option value={1}>1 Application</option>
                  <option value={3}>3 Applications</option>
                  <option value={5}>5 Applications</option>
                  <option value={10}>10 Applications</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1">
                  Execution Safety Mode
                </label>
                <div
                  onClick={() => setDryRun(!dryRun)}
                  className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between text-sm transition ${
                    dryRun ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span className="font-semibold">{dryRun ? 'Dry-Run (Preview Form Fills)' : 'Live Submission Mode'}</span>
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunPipeline}
                  disabled={isExecuting}
                  className="w-full btn btn-primary py-3 flex items-center justify-center gap-2 font-semibold shadow-md"
                >
                  {isExecuting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  {dryRun ? 'Run Auto-Apply (Dry Run)' : 'Launch Live Applications'}
                </button>
              </div>
            </div>
          </div>

          {/* Execution Log & Results */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Pipeline Execution Output
            </h4>

            {executionResults.length > 0 ? (
              executionResults.map((res) => (
                <div key={res.job_id} className="panel p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        res.status === 'DRY_RUN_SUCCESS' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        res.status === 'APPLIED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {res.status}
                      </span>
                      <h5 className="font-semibold text-base">{res.company}</h5>
                      <span className="text-xs text-slate-400">Form: {res.form_type}</span>
                    </div>

                    {res.screenshot_path && (
                      <button
                        onClick={() => setSelectedScreenshot(res.screenshot_path || null)}
                        className="btn btn-outline py-1 px-3 text-xs flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Screenshot
                      </button>
                    )}
                  </div>

                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                    {res.logs || res.error_message || 'Sequence completed cleanly.'}
                  </pre>
                </div>
              ))
            ) : (
              <div className="panel p-10 text-center text-slate-400">
                <Play className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Click &quot;Run Auto-Apply&quot; above to execute Playwright stealth form filling across target jobs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Application History */}
      {activeTab === 'history' && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b dark:border-slate-700 pb-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Application Submission History
            </h3>

            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="btn btn-outline py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              Refresh History
            </button>
          </div>

          <div className="space-y-3">
            {historyRecords.length > 0 ? (
              historyRecords.map((rec) => (
                <div key={rec.id || rec.job_id} className="p-4 border dark:border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                        rec.status === 'APPLIED' ? 'bg-emerald-500/10 text-emerald-600' :
                        rec.status === 'DRY_RUN_SUCCESS' ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {rec.status}
                      </span>
                      <h5 className="font-semibold text-sm">{rec.company} — {rec.title}</h5>
                    </div>
                    <span className="text-xs text-slate-400 mt-1 block">Logged at: {rec.applied_at}</span>
                  </div>

                  {rec.screenshot_path && (
                    <button
                      onClick={() => setSelectedScreenshot(rec.screenshot_path || null)}
                      className="btn btn-outline py-1 px-3 text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Screenshot
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400 text-sm">
                No application records found in history yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedScreenshot(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2">
              <h4 className="font-semibold text-sm">Playwright Verification Screenshot</h4>
              <button onClick={() => setSelectedScreenshot(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-mono">{selectedScreenshot}</p>
            <div className="bg-slate-100 dark:bg-slate-800 rounded p-2 text-center text-xs text-slate-400">
              Form snapshot captured during automated dry-run run execution.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
