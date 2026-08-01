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

/** Only use for API-owned display fields, never model IDs, filenames, or user input. */
export function localizedMobileDisplay(
  value: LocalizedMobileDisplay | null | undefined,
  options: DisplayOptions = {},
) {
  const locale = options.locale || getManagedMobileLocale();
  const suffix = locale === "cn" ? "zh" : "en";
  const kind = options.kind || "title";
  const record = value as Record<string, unknown> | null | undefined;
  const localized = value?.localized;
  const nested = localized?.[kind];
  const resolved = [
    record?.[`${kind}_${suffix}`],
    nested?.[suffix],
    localized?.[suffix],
    nested?.default,
    localized?.default,
    record?.[kind],
    ...(options.defaultFields || []).map((field) => record?.[field]),
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
