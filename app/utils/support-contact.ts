export type SupportContactType =
  | "wechat"
  | "qq"
  | "telegram"
  | "email"
  | "docs"
  | "custom";

export type SupportContactMethod = {
  id: string;
  type: SupportContactType | string;
  label: string;
  value: string;
  copy_value: string;
  url: string;
  qr_image: string;
  description: string;
  primary: boolean;
  enabled: boolean;
  sort_order: number;
};

export type SupportContactConfig = {
  title: string;
  subtitle: string;
  contacts: SupportContactMethod[];
};

const DEFAULT_TITLE = "联系客服";
const DEFAULT_SUBTITLE =
  "登录、注册、充值、API 或模型调用问题都可以联系人工客服";

export function emptySupportContactConfig(): SupportContactConfig {
  return { title: DEFAULT_TITLE, subtitle: DEFAULT_SUBTITLE, contacts: [] };
}

export function normalizeSupportContactConfig(
  config?: SupportContactConfig | null,
): SupportContactConfig {
  return {
    title: config?.title?.trim() || DEFAULT_TITLE,
    subtitle: config?.subtitle?.trim() || DEFAULT_SUBTITLE,
    contacts: Array.isArray(config?.contacts)
      ? config!.contacts
          .map((contact, index) => normalizeSupportContact(contact, index))
          .filter((contact): contact is SupportContactMethod => !!contact)
          .sort((left, right) => left.sort_order - right.sort_order)
      : [],
  };
}

export function enabledSupportContacts(
  config?: SupportContactConfig | null,
): SupportContactMethod[] {
  return normalizeSupportContactConfig(config).contacts.filter(
    (contact) => contact.enabled,
  );
}

export function primaryQRCodeContacts(
  config?: SupportContactConfig | null,
): SupportContactMethod[] {
  return enabledSupportContacts(config)
    .filter(
      (contact) =>
        contact.primary && !!sanitizeSupportContactImage(contact.qr_image),
    )
    .slice(0, 2);
}

export function supportContactCopyValue(contact: SupportContactMethod) {
  return (contact.copy_value || contact.value || contact.url || "").trim();
}

export function supportContactDisplayValue(contact: SupportContactMethod) {
  return (contact.value || contact.copy_value || contact.url || "").trim();
}

export function supportContactActionUrl(contact: SupportContactMethod) {
  const explicit = sanitizeSupportContactUrl(contact.url);
  if (explicit) return explicit;

  const value = supportContactDisplayValue(contact);
  if (contact.type === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `mailto:${value}`;
  }
  if (contact.type === "telegram" && value) {
    const handle = value.replace(/^@/, "").trim();
    if (/^[a-zA-Z0-9_]{5,32}$/.test(handle)) {
      return `https://t.me/${handle}`;
    }
  }
  return "";
}

export function sanitizeSupportContactImage(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed)) {
    return trimmed;
  }
  return "";
}

function sanitizeSupportContactUrl(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed)) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return "";
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function normalizeSupportContact(
  contact: SupportContactMethod,
  index: number,
): SupportContactMethod | null {
  if (!contact) return null;
  const type = (contact.type || "custom").trim().toLowerCase();
  const normalized = {
    id: contact.id?.trim() || `${type}-${index + 1}`,
    type,
    label: contact.label?.trim() || fallbackContactLabel(type),
    value: contact.value?.trim() || "",
    copy_value: contact.copy_value?.trim() || "",
    url: contact.url?.trim() || "",
    qr_image: contact.qr_image?.trim() || "",
    description: contact.description?.trim() || "",
    primary: !!contact.primary,
    enabled: contact.enabled !== false,
    sort_order:
      Number.isFinite(contact.sort_order) && contact.sort_order > 0
        ? contact.sort_order
        : index + 1,
  };
  if (
    !normalized.value &&
    !normalized.copy_value &&
    !normalized.url &&
    !normalized.qr_image
  ) {
    return null;
  }
  return normalized;
}

function fallbackContactLabel(type: string) {
  switch (type) {
    case "wechat":
      return "微信客服";
    case "qq":
      return "QQ 客服";
    case "telegram":
      return "Telegram";
    case "email":
      return "邮箱";
    case "docs":
      return "文档";
    default:
      return "客服";
  }
}
