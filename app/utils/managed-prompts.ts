import { withBasePath } from "./api-path";

export type ManagedPrompt = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
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
  };
};

export async function loadManagedPromptCatalog(): Promise<ManagedPrompt[]> {
  const res = await fetch(withBasePath("/api/nextchat/prompts"), {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = (await res.json()) as NextChatPromptCatalogEnvelope;
  if (!res.ok || envelope.code !== 0 || !envelope.data) {
    throw new Error(envelope.message || "Failed to load prompt catalog");
  }

  return (envelope.data.chat_prompts ?? [])
    .map((prompt, index) => ({
      id: prompt.id?.trim() || `managed-prompt-${index + 1}`,
      title: prompt.title?.trim() || "",
      content: prompt.content?.trim() || "",
      createdAt: 0,
    }))
    .filter((prompt) => !!prompt.title && !!prompt.content);
}
