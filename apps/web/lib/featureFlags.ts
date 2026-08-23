// Module: lib/featureFlags.ts
// Defines function(s): isGated
// Defines type(s): GatedFeature
//

export const featureFlags = {
    requireAuth: process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true',
    requireAuthForApply: process.env.NEXT_PUBLIC_REQUIRE_AUTH_FOR_APPLY === 'true',
    requireAuthForSave: process.env.NEXT_PUBLIC_REQUIRE_AUTH_FOR_SAVE !== 'false',
    requireAuthForTracking: process.env.NEXT_PUBLIC_REQUIRE_AUTH_FOR_TRACKING !== 'false',
    requireAuthForRecommendations: process.env.NEXT_PUBLIC_REQUIRE_AUTH_FOR_RECOMMENDATIONS !== 'false',
};
export type GatedFeature = keyof typeof featureFlags;
export function isGated(feature: GatedFeature) {
    return featureFlags[feature];
}
