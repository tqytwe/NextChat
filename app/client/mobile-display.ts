import {
  getManagedMobileLocale,
  type ManagedMobileLocale,
} from "./managed-mobile-i18n";

export type LocalizedMobileDisplay = {
  title?: string;
  title_zh?: string;
  title_en?: string;
  title_ja?: string;
  title_jp?: string;
  title_ko?: string;
  description?: string;
  description_zh?: string;
  description_en?: string;
  description_ja?: string;
  description_jp?: string;
  description_ko?: string;
  name?: string;
  name_zh?: string;
  name_en?: string;
  name_ja?: string;
  name_jp?: string;
  name_ko?: string;
  display_name?: string;
  display_name_zh?: string;
  display_name_en?: string;
  display_name_ja?: string;
  display_name_jp?: string;
  display_name_ko?: string;
  product_name?: string;
  product_name_zh?: string;
  product_name_en?: string;
  product_name_ja?: string;
  product_name_jp?: string;
  product_name_ko?: string;
  template_name?: string;
  template_name_zh?: string;
  template_name_en?: string;
  template_name_ja?: string;
  template_name_jp?: string;
  template_name_ko?: string;
  localized?: {
    ja?: string;
    jp?: string;
    ko?: string;
    zh?: string;
    en?: string;
    default?: string;
    title?: {
      ja?: string;
      jp?: string;
      ko?: string;
      zh?: string;
      en?: string;
      default?: string;
    };
    description?: {
      ja?: string;
      jp?: string;
      ko?: string;
      zh?: string;
      en?: string;
      default?: string;
    };
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

function localeCandidates(locale: ManagedMobileLocale) {
  if (locale === "cn") return ["zh", "cn", "en"] as const;
  if (locale === "jp") return ["ja", "jp", "en", "zh", "cn"] as const;
  if (locale === "ko") return ["ko", "en", "zh", "cn"] as const;
  return ["en", "zh", "cn"] as const;
}

function localizedCandidate(value: unknown, suffixes: readonly string[]) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const suffix of suffixes) {
    const localeValue = record[suffix];
    const resolved = nonEmpty(localeValue);
    if (resolved) return resolved;
  }
  return "";
}

function localizedField(
  record: Record<string, unknown> | null | undefined,
  field: string,
  suffixes: readonly string[],
) {
  for (const suffix of suffixes) {
    const resolved = nonEmpty(record?.[`${field}_${suffix}`]);
    if (resolved) return resolved;
  }
  return "";
}

/** Only use for API-owned display fields, never model IDs, filenames, or user input. */
export function localizedMobileDisplay(
  value: unknown,
  options: DisplayOptions = {},
) {
  const locale = options.locale || getManagedMobileLocale();
  const suffixes = localeCandidates(locale);
  const kind = options.kind || "title";
  const typedValue = value as LocalizedMobileDisplay | null | undefined;
  const record = value as Record<string, unknown> | null | undefined;
  const localized = typedValue?.localized;
  const nested = localized?.[kind];
  const defaultFields = options.defaultFields || [];
  const resolved = [
    localizedField(record, kind, suffixes),
    localizedCandidate(nested, suffixes),
    localizedCandidate(localized, suffixes),
    // Some dynamic fields (for example plan duration labels) are returned as
    // a direct { zh, en } object instead of under `localized`.
    localizedCandidate(value, suffixes),
    nested?.default,
    localized?.default,
    record?.[kind],
    // API resources do not consistently call their visible field `title`.
    // Prefer each declared field's locale variant before showing its default.
    ...defaultFields.map((field) => localizedField(record, field, suffixes)),
    ...defaultFields.map((field) =>
      localizedCandidate(record?.[field], suffixes),
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
