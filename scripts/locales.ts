/** Listing and response languages supported by the Lifexam EU packages. */
export const SUPPORTED_LOCALES = ["en", "es", "pt", "it", "fr", "de"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
