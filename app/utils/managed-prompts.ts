import { withBasePath } from "./api-path";

export type ManagedPrompt = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  content: string;
  createdAt: number;
};

export type ManagedImageTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  previewEmoji?: string;
  previewURL?: string;
  defaults?: {
    size?: string;
    count?: number;
  };
};

export type ManagedImagePrompt = {
  id: number;
  title: string;
  description?: string;
  purpose?: string;
  style?: string;
  subject?: string;
  featured?: boolean;
  version?: number;
  promptText?: string;
  variables?: Record<string, unknown>;
  models: string[];
  sizes: string[];
  referenceRequirement?: string;
  referenceInstructions?: string;
  requiresReference: boolean;
  brandLabel?: string;
  contentNotice?: string;
  publicAttributionNote?: string;
  useCount: number;
  favoriteCount: number;
  favorited: boolean;
  media?: unknown[];
  publishedAt?: string;
};

export type ManagedImagePromptPage = {
  items: ManagedImagePrompt[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export type ManagedImagePromptUseResult = {
  promptId: number;
  version: number;
  title: string;
  promptText: string;
  variables?: Record<string, unknown>;
  models: string[];
  sizes: string[];
  referenceRequirement?: string;
  referenceInstructions?: string;
  requiresReference: boolean;
};

export type ManagedPromptSquareCatalog = {
  chatPrompts: ManagedPrompt[];
  imageTemplates: ManagedImageTemplate[];
};

type NextChatPromptCatalogEnvelope = {
  code?: number;
  message?: string;
  data?: {
    chat_prompts?: Array<{
      id?: string;
      title?: string;
      content?: string;
      description?: string;
      category?: string;
    }>;
    image_templates?: {
      intents?: Array<{
        id?: string;
        label?: ManagedLocalizedText;
        templates?: Array<{
          id?: string;
          label?: ManagedLocalizedText;
          description?: ManagedLocalizedText;
          defaults?: {
            size?: string;
            count?: number;
          };
          preview_emoji?: string;
          preview_url?: string;
        }>;
      }>;
    };
  };
};

type ManagedLocalizedText = {
  zh?: string;
  en?: string;
};

type ManagedPromptPaginationEnvelope = {
  code?: number;
  message?: string;
  data?: {
    items?: ManagedImagePromptDTO[];
    total?: number;
    page?: number;
    page_size?: number;
    pages?: number;
  };
};

type ManagedImagePromptEnvelope = {
  code?: number;
  message?: string;
  data?: ManagedImagePromptDTO;
};

type ManagedImagePromptFavoriteEnvelope = {
  code?: number;
  message?: string;
  data?: {
    prompt_id?: number;
    favorited?: boolean;
  };
};

type ManagedImagePromptUseEnvelope = {
  code?: number;
  message?: string;
  data?: ManagedImagePromptUseDTO;
};

type ManagedImagePromptDTO = {
  id?: number;
  title?: string;
  description?: string;
  purpose?: string;
  style?: string;
  subject?: string;
  featured?: boolean;
  version?: number;
  prompt_text?: string;
  variables?: Record<string, unknown>;
  models?: string[];
  sizes?: string[];
  reference_requirement?: string;
  reference_instructions?: string;
  requires_reference?: boolean;
  brand_label?: string;
  content_notice?: string;
  public_attribution_note?: string;
  use_count?: number;
  favorite_count?: number;
  favorited?: boolean;
  media?: unknown[];
  published_at?: string;
};

type ManagedImagePromptUseDTO = {
  prompt_id?: number;
  version?: number;
  title?: string;
  prompt_text?: string;
  variables?: Record<string, unknown>;
  models?: string[];
  sizes?: string[];
  reference_requirement?: string;
  reference_instructions?: string;
  requires_reference?: boolean;
};

export async function loadManagedPromptCatalog(): Promise<ManagedPrompt[]> {
  const catalog = await loadManagedPromptSquareCatalog();
  return catalog.chatPrompts;
}

export async function loadManagedPromptSquareCatalog(): Promise<ManagedPromptSquareCatalog> {
  const res = await fetch(withBasePath("/api/nextchat/prompts"), {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = (await res.json()) as NextChatPromptCatalogEnvelope;
  if (!res.ok || envelope.code !== 0 || !envelope.data) {
    throw new Error(envelope.message || "Failed to load prompt catalog");
  }

  return {
    chatPrompts: parseManagedChatPrompts(envelope.data.chat_prompts ?? []),
    imageTemplates: parseManagedImageTemplates(
      envelope.data.image_templates?.intents ?? [],
    ),
  };
}

export async function listManagedImagePrompts(
  params: {
    q?: string;
    favorite?: boolean;
    page?: number;
    pageSize?: number;
    model?: string;
    size?: string;
    reference?: string;
  } = {},
): Promise<ManagedImagePromptPage> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.favorite !== undefined) {
    search.set("favorite", params.favorite ? "true" : "false");
  }
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.model) search.set("model", params.model);
  if (params.size) search.set("size", params.size);
  if (params.reference) search.set("reference", params.reference);
  const query = search.toString();
  const envelope =
    await fetchManagedPromptJSON<ManagedPromptPaginationEnvelope>(
      `/api/nextchat/image-prompts${query ? `?${query}` : ""}`,
      { method: "GET" },
    );
  const data = envelope.data;
  if (!data)
    throw new Error(envelope.message || "Failed to load image prompts");
  return {
    items: (data.items ?? []).map(parseManagedImagePrompt),
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.page_size ?? data.items?.length ?? 0,
    pages: data.pages ?? 1,
  };
}

export async function getManagedImagePrompt(
  id: number,
): Promise<ManagedImagePrompt> {
  const envelope = await fetchManagedPromptJSON<ManagedImagePromptEnvelope>(
    `/api/nextchat/image-prompts/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  if (!envelope.data) {
    throw new Error(envelope.message || "Failed to load image prompt");
  }
  return parseManagedImagePrompt(envelope.data);
}

export async function setManagedImagePromptFavorite(
  id: number,
  favorite: boolean,
) {
  const envelope =
    await fetchManagedPromptJSON<ManagedImagePromptFavoriteEnvelope>(
      `/api/nextchat/image-prompts/${encodeURIComponent(id)}/favorite`,
      { method: favorite ? "POST" : "DELETE" },
    );
  if (!envelope.data) {
    throw new Error(envelope.message || "Failed to update favorite");
  }
  return !!envelope.data.favorited;
}

export async function useManagedImagePrompt(
  id: number,
): Promise<ManagedImagePromptUseResult> {
  const envelope = await fetchManagedPromptJSON<ManagedImagePromptUseEnvelope>(
    `/api/nextchat/image-prompts/${encodeURIComponent(id)}/use`,
    { method: "POST" },
  );
  if (!envelope.data) {
    throw new Error(envelope.message || "Failed to use image prompt");
  }
  return parseManagedImagePromptUseResult(envelope.data);
}

function parseManagedChatPrompts(
  prompts: NonNullable<NextChatPromptCatalogEnvelope["data"]>["chat_prompts"],
): ManagedPrompt[] {
  return (prompts ?? [])
    .map((prompt, index) => {
      const item: ManagedPrompt = {
        id: prompt.id?.trim() || `managed-prompt-${index + 1}`,
        title: prompt.title?.trim() || "",
        content: prompt.content?.trim() || "",
        createdAt: 0,
      };
      const description = prompt.description?.trim();
      const category = prompt.category?.trim();
      if (description) item.description = description;
      if (category) item.category = category;
      return item;
    })
    .filter((prompt) => !!prompt.title && !!prompt.content);
}

function parseManagedImageTemplates(
  intents: NonNullable<
    NonNullable<NextChatPromptCatalogEnvelope["data"]>["image_templates"]
  >["intents"],
): ManagedImageTemplate[] {
  return (intents ?? []).flatMap((intent, intentIndex) => {
    const category = intent.id?.trim() || `image-intent-${intentIndex + 1}`;
    const categoryLabel = localizedText(intent.label) || category;
    return (intent.templates ?? [])
      .map((template, templateIndex) => {
        const item: ManagedImageTemplate = {
          id:
            template.id?.trim() || `${category}-template-${templateIndex + 1}`,
          title: localizedText(template.label),
          description: localizedText(template.description),
          category,
          categoryLabel,
        };
        const previewEmoji = template.preview_emoji?.trim();
        const previewURL = template.preview_url?.trim();
        if (previewEmoji) item.previewEmoji = previewEmoji;
        if (previewURL) item.previewURL = previewURL;
        if (template.defaults) item.defaults = template.defaults;
        return item;
      })
      .filter((template) => !!template.id && !!template.title);
  });
}

function localizedText(value?: ManagedLocalizedText) {
  return value?.zh?.trim() || value?.en?.trim() || "";
}

async function fetchManagedPromptJSON<T>(
  path: string,
  init: RequestInit,
): Promise<T & { code?: number; message?: string }> {
  const res = await fetch(withBasePath(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = (await res.json()) as T & {
    code?: number;
    message?: string;
  };
  if (!res.ok || envelope.code !== 0) {
    throw new Error(envelope.message || "Managed prompt request failed");
  }
  return envelope;
}

function parseManagedImagePrompt(prompt: ManagedImagePromptDTO) {
  return {
    id: Number(prompt.id ?? 0),
    title: prompt.title?.trim() || "",
    description: prompt.description?.trim() || undefined,
    purpose: prompt.purpose?.trim() || undefined,
    style: prompt.style?.trim() || undefined,
    subject: prompt.subject?.trim() || undefined,
    featured: !!prompt.featured,
    version: prompt.version ?? 0,
    promptText: prompt.prompt_text?.trim() || undefined,
    variables: prompt.variables,
    models: prompt.models ?? [],
    sizes: prompt.sizes ?? [],
    referenceRequirement: prompt.reference_requirement?.trim() || undefined,
    referenceInstructions: prompt.reference_instructions?.trim() || undefined,
    requiresReference: !!prompt.requires_reference,
    brandLabel: prompt.brand_label?.trim() || undefined,
    contentNotice: prompt.content_notice?.trim() || undefined,
    publicAttributionNote: prompt.public_attribution_note?.trim() || undefined,
    useCount: prompt.use_count ?? 0,
    favoriteCount: prompt.favorite_count ?? 0,
    favorited: !!prompt.favorited,
    media: prompt.media,
    publishedAt: prompt.published_at,
  };
}

function parseManagedImagePromptUseResult(
  result: ManagedImagePromptUseDTO,
): ManagedImagePromptUseResult {
  return {
    promptId: Number(result.prompt_id ?? 0),
    version: result.version ?? 0,
    title: result.title?.trim() || "",
    promptText: result.prompt_text?.trim() || "",
    variables: result.variables,
    models: result.models ?? [],
    sizes: result.sizes ?? [],
    referenceRequirement: result.reference_requirement?.trim() || undefined,
    referenceInstructions: result.reference_instructions?.trim() || undefined,
    requiresReference: !!result.requires_reference,
  };
}
