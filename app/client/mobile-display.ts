import {
  getManagedMobileLocale,
  type ManagedMobileLocale,
} from "./managed-mobile-i18n";

export type LocalizedMobileDisplay = {
  title?: string;
  title_zh?: string;
  title_en?: string;
  description?: string;
  description_zh?: string;
  description_en?: string;
  name?: string;
  name_zh?: string;
  name_en?: string;
  display_name?: string;
  display_name_zh?: string;
  display_name_en?: string;
  product_name?: string;
  product_name_zh?: string;
  product_name_en?: string;
  template_name?: string;
  template_name_zh?: string;
  template_name_en?: string;
  localized?: {
    zh?: string;
    en?: string;
    default?: string;
    title?: { zh?: string; en?: string; default?: string };
    description?: { zh?: string; en?: string; default?: string };
  };
};

type DisplayOptions = {
  kind?: "title" | "description";
  fallback?: string;
  defaultFields?: string[];
  locale?: ManagedMobileLocale;
};

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function localizedCandidate(value: unknown, suffix: "zh" | "en") {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  const localeValue = record[suffix] ?? record[suffix === "zh" ? "cn" : "en"];
  return nonEmpty(localeValue);
}

/** Only use for API-owned display fields, never model IDs, filenames, or user input. */
export function localizedMobileDisplay(
  value: unknown,
  options: DisplayOptions = {},
) {
  const locale = options.locale || getManagedMobileLocale();
  const suffix = locale === "cn" ? "zh" : "en";
  const kind = options.kind || "title";
  const typedValue = value as LocalizedMobileDisplay | null | undefined;
  const record = value as Record<string, unknown> | null | undefined;
  const localized = typedValue?.localized;
  const nested = localized?.[kind];
  const defaultFields = options.defaultFields || [];
  const resolved = [
    record?.[`${kind}_${suffix}`],
    nested?.[suffix],
    localized?.[suffix],
    // Some dynamic fields (for example plan duration labels) are returned as
    // a direct { zh, en } object instead of under `localized`.
    localizedCandidate(value, suffix),
    nested?.default,
    localized?.default,
    record?.[kind],
    // API resources do not consistently call their visible field `title`.
    // Prefer each declared field's locale variant before showing its default.
    ...defaultFields.map((field) => record?.[`${field}_${suffix}`]),
    ...defaultFields.map((field) =>
      localizedCandidate(record?.[field], suffix),
    ),
    ...defaultFields.map((field) => record?.[field]),
    options.fallback,
  ]
    .map(nonEmpty)
    .find(Boolean);
  if (!resolved && value) recordMobileLocalizationFallback(kind);
  return resolved || "";
}

/** Records field shape only, never API text, account IDs, prompts, or files. */
export function recordMobileLocalizationFallback(kind: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const key = "jisudengchat-mobile-locale-fallbacks";
    const previous = JSON.parse(sessionStorage.getItem(key) || "[]") as Array<{
      kind: string;
      locale: ManagedMobileLocale;
      at: number;
    }>;
    previous.push({ kind, locale: getManagedMobileLocale(), at: Date.now() });
    sessionStorage.setItem(key, JSON.stringify(previous.slice(-20)));
  } catch {
    // Localized display is always best effort.
  }
}
