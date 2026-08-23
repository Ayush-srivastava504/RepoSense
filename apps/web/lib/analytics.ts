// lib/analytics.ts Central GA4 event tracking helpers. `trackEvent` is the low-level
// primitive (kept for backward compatibility with existing call sites); everything below it
// is a typed, named wrapper for a specific event in the tracking plan so call sites stay
// self-documenting and consistent (same event name + same param shape every time it fires).

declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
    }
}
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window === 'undefined')
        return;
    window.gtag?.('event', eventName, params);
};
export const trackSignUp = (method: 'email' | 'github' | 'google' = 'email') => trackEvent('sign_up', { method });
export const trackLogin = (method: 'email' | 'github' | 'google' = 'email') => trackEvent('login', { method });
export const trackRepoAnalysis = (params: {
    repo_url?: string;
    repo_name?: string;
}) => trackEvent('github_repo_analysis', params);
export const trackReadmeGeneration = (params: {
    repo_name?: string;
    success?: boolean;
}) => trackEvent('readme_generation', params);
export const trackResumeCreation = (params: {
    template?: string;
    step?: string;
}) => trackEvent('resume_creation', params);
export const trackResumeDownload = (params: {
    format?: 'pdf' | 'docx';
    template?: string;
}) => trackEvent('resume_download', params);
export const trackLinkedinOptimization = (params: {
    section?: string;
    success?: boolean;
}) => trackEvent('linkedin_optimization', params);
export const trackAtsScoreGeneration = (params: {
    score?: number;
    resume_id?: string;
}) => trackEvent('ats_score_generation', params);
export const trackCoverLetterGeneration = (params: {
    job_title?: string;
    company?: string;
}) => trackEvent('cover_letter_generation', params);
export const trackToolCompletion = (params: {
    tool: string;
    duration_seconds?: number;
}) => trackEvent('tool_completion', params);
export const trackToolStart = (params: {
    tool: string;
    source?: string;
}) => trackEvent('tool_start', params);
export const trackJobSearch = (params: {
    query: string;
    result_count?: number;
}) => trackEvent('job_search', params);
export const trackFilterUsage = (params: {
    filter_type: string;
    filter_value: string;
}) => trackEvent('filter_usage', params);
export const trackJobView = (params: {
    job_id: string;
    job_title?: string;
    company?: string;
}) => trackEvent('job_view', params);
export const trackApplyClick = (params: {
    job_id: string;
    company?: string;
    source?: string;
}) => trackEvent('apply_click', params);
export const trackOutboundClick = (params: {
    url: string;
    link_text?: string;
}) => trackEvent('outbound_click', params);
export const trackSearchQuery = (params: {
    query: string;
    page: string;
}) => trackEvent('search_query', params);
export const trackRelatedToolClick = (params: {
    from_tool: string;
    to_tool: string;
}) => trackEvent('related_tool_click', params);
export const trackError = (params: {
    error_type: string;
    message?: string;
    page?: string;
}) => trackEvent('app_error', params);
export const trackFunnelStep = (params: {
    funnel: string;
    step: string;
    step_index?: number;
}) => trackEvent('funnel_step', params);
export const trackConversion = (params: {
    conversion_type: string;
    value?: number;
}) => trackEvent('conversion', params);
