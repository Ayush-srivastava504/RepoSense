// Human-readable relative time ("Posted 4 hours ago"), matching the pattern used on job
// boards like Astra/LinkedIn. Pure function, no client-only Intl quirks, safe to call during
// SSR.
//

export function timeAgo(dateString?: string): string {
    if (!dateString)
        return 'Recently';
    const then = new Date(dateString).getTime();
    if (Number.isNaN(then))
        return 'Recently';
    const diffMs = Date.now() - then;
    if (diffMs < 0)
        return 'Just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1)
        return 'Just now';
    if (minutes < 60)
        return `Posted ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `Posted ${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `Posted ${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12)
        return `Posted ${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `Posted ${years} year${years === 1 ? '' : 's'} ago`;
}
