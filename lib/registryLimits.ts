// Limits shared by the page (what it sends and stores) and the server
// (what it accepts). Keys named here end up in every generation's system
// prompt, so their count and length are what bound the prompt's size.

/** Registry keys listed in a /api/program request. */
export const MAX_PROMPT_KEYS = 50;
/** Longest registry key name. */
export const MAX_KEY_LENGTH = 64;
/** Largest single registry value a generated app may store, in characters. */
export const MAX_VALUE_CHARS = 256 * 1024;
/** Most `public_` keys the desktop keeps. */
export const MAX_PUBLIC_KEYS = 40;
