// Single source of truth for the legal pages' "last updated" dates.
// The sitemap used to hardcode its own copy of the privacy date and
// it drifted from what the page rendered (2026-05-12 vs 2026-04-18).
// Both the pages and the sitemap import from here now.
export const PRIVACY_LAST_UPDATED = "2026-06-10";
export const TERMS_LAST_UPDATED = "2026-06-10";
