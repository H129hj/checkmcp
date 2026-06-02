// i18n foundation — English is the default/source locale (international .dev, English marketing/SEO/AEO).
// Add a locale by adding it to `locales` + a messages map; detection + hreflang are already wired.

export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// Negotiate from an Accept-Language header (falls back to default).
export function detectLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const wanted = acceptLanguage.split(",").map((p) => p.split(";")[0].trim().slice(0, 2).toLowerCase());
  for (const w of wanted) if ((locales as readonly string[]).includes(w)) return w as Locale;
  return defaultLocale;
}

// hreflang alternates for SEO (used in metadata.alternates.languages).
export function hreflang(path = "/"): Record<string, string> {
  const base = "https://checkmcp.dev";
  const out: Record<string, string> = { "x-default": base + path };
  for (const l of locales) out[l] = base + path; // single-locale today; per-locale URLs when more are added
  return out;
}
