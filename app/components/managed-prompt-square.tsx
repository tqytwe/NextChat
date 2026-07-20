import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import chatStyles from "./chat.module.scss";
import styles from "./managed-prompt-square.module.scss";
import { IconButton } from "./button";
import { showToast } from "./ui-lib";
import { Path } from "../constant";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import PromptIcon from "../icons/prompt.svg";
import ImageIcon from "../icons/image.svg";
import LoadingIcon from "../icons/three-dots.svg";
import { copyToClipboard } from "../utils";
import {
  loadManagedPromptSquareCatalog,
  type ManagedImageTemplate,
  type ManagedPrompt,
} from "../utils/managed-prompts";
import { inferSub2APIImageStudioAspectTier, useSdStore } from "../store/sd";

type PromptSquareMode = "all" | "chat" | "image";

type PromptSquareItem =
  | {
      kind: "chat";
      id: string;
      title: string;
      category?: string;
      description?: string;
      content: string;
      prompt: ManagedPrompt;
    }
  | {
      kind: "image";
      id: string;
      title: string;
      category?: string;
      description?: string;
      content: string;
      template: ManagedImageTemplate;
    };

export function ManagedPromptSquare() {
  const navigate = useNavigate();
  const sdStore = useSdStore();
  const [chatPrompts, setChatPrompts] = useState<ManagedPrompt[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ManagedImageTemplate[]>(
    [],
  );
  const [mode, setMode] = useState<PromptSquareMode>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    loadManagedPromptSquareCatalog()
      .then((catalog) => {
        if (!alive) return;
        setChatPrompts(catalog.chatPrompts);
        setImageTemplates(catalog.imageTemplates);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "提示词加载失败");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const merged: PromptSquareItem[] = [
      ...chatPrompts.map((prompt) => ({
        kind: "chat" as const,
        id: prompt.id,
        title: prompt.title,
        category: prompt.category,
        description: prompt.description,
        content: prompt.content,
        prompt,
      })),
      ...imageTemplates.map((template) => ({
        kind: "image" as const,
        id: template.id,
        title: template.title,
        category: template.categoryLabel,
        description: template.description,
        content: buildImageTemplatePrompt(template),
        template,
      })),
    ];

    return merged.filter((item) => {
      if (mode !== "all" && item.kind !== mode) return false;
      if (!keyword) return true;
      return [item.title, item.category, item.description, item.content]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [chatPrompts, imageTemplates, mode, search]);

  const applyChatPrompt = (prompt: ManagedPrompt) => {
    navigate(Path.Chat, {
      state: {
        managedPromptContent: prompt.content,
        managedPromptSource: prompt.id,
      },
    });
    showToast("已填入聊天");
  };

  const applyImageTemplate = (template: ManagedImageTemplate) => {
    const currentParams = useSdStore.getState().currentParams ?? {};
    const nextParams: any = {
      ...currentParams,
      template_id: template.id,
      prompt: buildImageTemplatePrompt(template),
    };
    if (template.defaults?.size) {
      const inferred = inferSub2APIImageStudioAspectTier(
        template.defaults.size,
      );
      nextParams.size = template.defaults.size;
      nextParams.aspect = inferred.aspect;
      nextParams.resolution = inferred.tier;
    }
    if (template.defaults?.count) {
      nextParams.count = template.defaults.count;
    }
    sdStore.setCurrentParams(nextParams);
    navigate(Path.Sd, {
      state: {
        managedImageTemplateId: template.id,
      },
    });
    showToast("已填入图片创作");
  };

  return (
    <div className={styles["prompt-square"]}>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-actions">
          <div className="window-action-button">
            <IconButton
              icon={<ReturnIcon />}
              bordered
              title="返回聊天"
              onClick={() => navigate(Path.Chat)}
            />
          </div>
        </div>
        <div className={chatStyles["chat-body-title"]}>
          <div className="window-header-main-title">提示词广场</div>
          <div className="window-header-sub-title">
            {loading ? "加载中" : `${items.length} 个条目`}
          </div>
        </div>
        <div className="window-actions" />
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={search}
          placeholder="搜索标题、分类或内容"
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <div className={styles.tabs}>
          {[
            ["all", "全部"],
            ["chat", "聊天"],
            ["image", "图片"],
          ].map(([value, label]) => (
            <IconButton
              key={value}
              text={label}
              type={mode === value ? "primary" : null}
              onClick={() => setMode(value as PromptSquareMode)}
              shadow
            />
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <LoadingIcon />
          </div>
        ) : error ? (
          <div className={styles.empty}>{error}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>暂无匹配内容</div>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className={styles["prompt-card"]}
              >
                <div className={styles["prompt-card-header"]}>
                  <div className={styles["prompt-card-icon"]}>
                    {item.kind === "image" ? <ImageIcon /> : <PromptIcon />}
                  </div>
                  <div>
                    <div className={styles["prompt-card-title"]}>
                      {item.title}
                    </div>
                    <div className={styles["prompt-card-meta"]}>
                      {item.kind === "image" ? "图片" : "聊天"}
                      {item.category ? ` · ${item.category}` : ""}
                    </div>
                  </div>
                </div>
                <div className={styles["prompt-card-content"]}>
                  {item.description || item.content}
                </div>
                <div className={styles["prompt-card-actions"]}>
                  <IconButton
                    icon={<CopyIcon />}
                    text="复制"
                    onClick={() => copyToClipboard(item.content)}
                    shadow
                  />
                  {item.kind === "image" ? (
                    <IconButton
                      icon={<ImageIcon />}
                      text="去创作"
                      type="primary"
                      onClick={() => applyImageTemplate(item.template)}
                      shadow
                    />
                  ) : (
                    <IconButton
                      icon={<PromptIcon />}
                      text="填入聊天"
                      type="primary"
                      onClick={() => applyChatPrompt(item.prompt)}
                      shadow
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildImageTemplatePrompt(template: ManagedImageTemplate) {
  return [template.title, template.description].filter(Boolean).join("\n");
}
