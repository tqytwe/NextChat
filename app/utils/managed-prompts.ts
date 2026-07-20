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
