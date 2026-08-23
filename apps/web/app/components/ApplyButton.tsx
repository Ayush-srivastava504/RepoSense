// Module: app/components/ApplyButton.tsx
// Defines component(s)/export(s): ApplyButton
//
//

'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { featureFlags } from '@/lib/featureFlags';
import { trackEvent } from '@/lib/analytics';
export default function ApplyButton({ url, jobId }: {
    url: string;
    jobId: string;
}) {
    const { user } = useAuth();
    const router = useRouter();
    const handleApply = () => {
        if (featureFlags.requireAuthForApply && !user) {
            router.push('/login');
            return;
        }
        trackEvent('job_apply_click', { job_id: jobId });
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    return (<button onClick={handleApply} className="btn btn-primary">
      Apply now
    </button>);
}
