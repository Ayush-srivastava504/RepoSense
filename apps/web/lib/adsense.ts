// Module: lib/adsense.ts
//
// SINGLE SOURCE OF TRUTH for Google AdSense.
//
// The site-wide AdSense loader script (needed for site verification and
// Auto-ads eligibility) lives in app/layout.tsx <head>. Ad UNITS are placed
// with <AdSlot slot={ADSENSE_SLOTS.xxx} />.
//
// WORKFLOW once Google approves the site:
//   1. AdSense dashboard -> Ads -> By ad unit -> create a Display ad unit.
//   2. Copy its numeric data-ad-slot ID into ADSENSE_SLOTS below.
//   3. Place <AdSlot slot={ADSENSE_SLOTS.inArticle} /> where you want the ad.
// While a slot ID is an empty string, <AdSlot> renders NOTHING (no empty
// boxes, no layout shift, no policy risk).

export const ADSENSE_CLIENT = 'ca-pub-5594205569635986';

export const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

export const ADSENSE_SLOTS = {
    // Fill these in AFTER AdSense approves the site and you create ad units.
    inArticle: '',
    listBanner: '',
    sidebar: '',
} as const;
