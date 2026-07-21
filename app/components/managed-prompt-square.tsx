import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import chatStyles from "./chat.module.scss";
import styles from "./managed-prompt-square.module.scss";
import { IconButton } from "./button";
import { showModal, showToast } from "./ui-lib";
import { Path } from "../constant";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import PromptIcon from "../icons/prompt.svg";
import ImageIcon from "../icons/image.svg";
import LoadingIcon from "../icons/three-dots.svg";
import { copyToClipboard } from "../utils";
import {
  getManagedImagePrompt,
  getManagedImagePromptVariables,
  listManagedImagePrompts,
  loadManagedPromptSquareCatalog,
  renderManagedImagePromptWithVariables,
  setManagedImagePromptFavorite,
  useManagedImagePrompt as recordManagedImagePromptUse,
  type ManagedImagePrompt,
  type ManagedImagePromptPage,
  type ManagedImagePromptUseResult,
  type ManagedImageTemplate,
  type ManagedPrompt,
} from "../utils/managed-prompts";
import {
  canSub2APIImageStudioUseReferences,
  inferSub2APIImageStudioAspectTier,
  toSub2APIImageStudioPanelModel,
  type Sub2APIImageStudioModel,
  useSdStore,
} from "../store/sd";

type PromptSquareMode = "all" | "chat" | "image";

const IMAGE_PROMPT_PAGE_SIZE = 24;

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
      template?: ManagedImageTemplate;
      imagePrompt?: ManagedImagePrompt;
    };

export function ManagedPromptSquare() {
  const navigate = useNavigate();
  const sdStore = useSdStore();
  const [chatPrompts, setChatPrompts] = useState<ManagedPrompt[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ManagedImageTemplate[]>(
    [],
  );
  const [imagePromptPage, setImagePromptPage] =
    useState<ManagedImagePromptPage>({
      items: [],
      total: 0,
      page: 1,
      pageSize: IMAGE_PROMPT_PAGE_SIZE,
      pages: 1,
    });
  const [imagePromptPageNumber, setImagePromptPageNumber] = useState(1);
  const [imagePromptFavoriteOnly, setImagePromptFavoriteOnly] = useState(false);
  const [imagePromptLoading, setImagePromptLoading] = useState(true);
  const [imagePromptError, setImagePromptError] = useState("");
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

  useEffect(() => {
    setImagePromptPageNumber(1);
  }, [imagePromptFavoriteOnly, search]);

  useEffect(() => {
    if (mode === "chat") {
      setImagePromptLoading(false);
      return;
    }

    let alive = true;
    setImagePromptLoading(true);
    setImagePromptError("");
    setImagePromptPage((page) => ({ ...page, items: [] }));
    listManagedImagePrompts({
      q: search.trim() || undefined,
      favorite: imagePromptFavoriteOnly ? true : undefined,
      page: imagePromptPageNumber,
      pageSize: IMAGE_PROMPT_PAGE_SIZE,
    })
      .then((promptPage) => {
        if (!alive) return;
        setImagePromptPage(promptPage);
        setImagePromptLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setImagePromptError(err?.message || "图片提示词加载失败");
        setImagePromptLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [imagePromptFavoriteOnly, imagePromptPageNumber, mode, search]);

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
      ...imagePromptPage.items.map((prompt) => ({
        kind: "image" as const,
        id: String(prompt.id),
        title: prompt.title,
        category: prompt.style || prompt.subject || prompt.purpose,
        description: prompt.description,
        content: prompt.promptText || prompt.description || prompt.title,
        imagePrompt: prompt,
      })),
    ];

    return merged.filter((item) => {
      if (mode !== "all" && item.kind !== mode) return false;
      if (imagePromptFavoriteOnly && item.kind === "image" && !item.imagePrompt)
        return false;
      if ("imagePrompt" in item && item.imagePrompt) return true;
      if (!keyword) return true;
      return [item.title, item.category, item.description, item.content]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [
    chatPrompts,
    imagePromptFavoriteOnly,
    imagePromptPage.items,
    imageTemplates,
    mode,
    search,
  ]);
  const promptSquareLoading =
    loading || (mode !== "chat" && imagePromptLoading && items.length === 0);

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

  const applyImagePrompt = async (
    prompt: ManagedImagePrompt,
    variableValues?: Record<string, string>,
  ): Promise<boolean> => {
    const missingVariables = getManagedImagePromptVariables(
      prompt.variables,
      prompt.promptText || "",
    ).filter(
      (variable) =>
        variable.required && !String(variableValues?.[variable.name] || ""),
    );
    if (missingVariables.length > 0) {
      showToast(`请填写变量：${missingVariables[0].label}`);
      return false;
    }

    try {
      const result = await recordManagedImagePromptUse(prompt.id);
      const model = selectManagedImagePromptModel(
        result,
        useSdStore.getState().sub2apiImageStudioModels,
        useSdStore.getState().currentModel?.value,
      );
      if (!model) {
        showToast("当前分组没有兼容的图片模型");
        return false;
      }
      if (
        requiresPromptReference(result) &&
        !canSub2APIImageStudioUseReferences(model)
      ) {
        showToast("当前分组没有支持引用图的兼容模型");
        return false;
      }
      const nextParams: any = {
        ...(useSdStore.getState().currentParams ?? {}),
        template_id: "free-create",
        prompt: renderManagedImagePromptWithVariables(
          result.promptText,
          variableValues,
        ),
      };
      const size = selectManagedImagePromptSize(result, model);
      if (size) {
        const inferred = inferSub2APIImageStudioAspectTier(size);
        nextParams.size = size;
        nextParams.aspect = inferred.aspect;
        nextParams.resolution = inferred.tier;
      }
      sdStore.setCurrentModel(toSub2APIImageStudioPanelModel(model));
      sdStore.setCurrentParams(nextParams);
      navigate(Path.Sd, {
        state: {
          managedImagePromptId: prompt.id,
        },
      });
      showToast("已填入图片创作");
      return true;
    } catch (error: any) {
      showToast(error?.message || "图片提示词使用失败");
      return false;
    }
  };

  const toggleImagePromptFavorite = async (prompt: ManagedImagePrompt) => {
    try {
      const favorited = await setManagedImagePromptFavorite(
        prompt.id,
        !prompt.favorited,
      );
      setImagePromptPage((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === prompt.id
            ? updateManagedImagePromptFavorite(item, favorited)
            : item,
        ),
      }));
      return favorited;
    } catch (error: any) {
      showToast(error?.message || "收藏更新失败");
      return undefined;
    }
  };

  const showImagePromptDetail = (prompt: ManagedImagePrompt) => {
    showModal({
      title: prompt.title || "图片提示词",
      children: (close) => (
        <ManagedImagePromptDetail
          prompt={prompt}
          onApply={applyImagePrompt}
          onFavorite={toggleImagePromptFavorite}
          onApplied={close}
        />
      ),
    });
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
            {loading || imagePromptLoading
              ? "加载中"
              : `${items.length} 个条目`}
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
        {mode !== "chat" && (
          <div className={styles["image-controls"]}>
            <IconButton
              text={imagePromptFavoriteOnly ? "全部图片" : "只看收藏"}
              type={imagePromptFavoriteOnly ? "primary" : null}
              onClick={() => {
                setImagePromptFavoriteOnly((value) => {
                  const next = !value;
                  if (next) setMode("image");
                  return next;
                });
              }}
              shadow
            />
            <div className={styles.pager}>
              <IconButton
                text="上一页"
                onClick={() =>
                  setImagePromptPageNumber((page) => Math.max(1, page - 1))
                }
                disabled={imagePromptLoading || imagePromptPage.page <= 1}
                shadow
              />
              <span>
                {imagePromptPage.page} / {Math.max(1, imagePromptPage.pages)}
                {imagePromptPage.total ? ` · ${imagePromptPage.total}` : ""}
              </span>
              <IconButton
                text="下一页"
                onClick={() =>
                  setImagePromptPageNumber((page) =>
                    Math.min(Math.max(1, imagePromptPage.pages), page + 1),
                  )
                }
                disabled={
                  imagePromptLoading ||
                  imagePromptPage.page >= Math.max(1, imagePromptPage.pages)
                }
                shadow
              />
            </div>
          </div>
        )}
      </div>

      <div className={styles.body}>
        {promptSquareLoading ? (
          <div className={styles.empty}>
            <LoadingIcon />
          </div>
        ) : error ? (
          <div className={styles.empty}>{error}</div>
        ) : imagePromptError && mode === "image" && items.length === 0 ? (
          <div className={styles.empty}>{imagePromptError}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>暂无匹配内容</div>
        ) : (
          <>
            {imagePromptError && mode !== "chat" && (
              <div className={styles["inline-error"]}>{imagePromptError}</div>
            )}
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
                      <>
                        {item.imagePrompt && (
                          <>
                            <IconButton
                              icon={<PromptIcon />}
                              text="详情"
                              onClick={() =>
                                showImagePromptDetail(item.imagePrompt!)
                              }
                              shadow
                            />
                            <IconButton
                              text={
                                item.imagePrompt.favorited ? "已收藏" : "收藏"
                              }
                              onClick={() =>
                                void toggleImagePromptFavorite(
                                  item.imagePrompt!,
                                )
                              }
                              shadow
                            />
                          </>
                        )}
                        <IconButton
                          icon={<ImageIcon />}
                          text="去创作"
                          type="primary"
                          onClick={() =>
                            item.imagePrompt
                              ? openImagePromptForApply(
                                  item.imagePrompt,
                                  applyImagePrompt,
                                  showImagePromptDetail,
                                )
                              : applyImageTemplate(item.template!)
                          }
                          shadow
                        />
                      </>
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
          </>
        )}
      </div>
    </div>
  );
}

function buildImageTemplatePrompt(template: ManagedImageTemplate) {
  return [template.title, template.description].filter(Boolean).join("\n");
}

function openImagePromptForApply(
  prompt: ManagedImagePrompt,
  onApply: (
    prompt: ManagedImagePrompt,
    variableValues?: Record<string, string>,
  ) => Promise<boolean>,
  onDetail: (prompt: ManagedImagePrompt) => void,
) {
  if (
    getManagedImagePromptVariables(prompt.variables, prompt.promptText || "")
      .length > 0
  ) {
    onDetail(prompt);
    return;
  }
  void onApply(prompt);
}

function ManagedImagePromptDetail(props: {
  prompt: ManagedImagePrompt;
  onApply: (
    prompt: ManagedImagePrompt,
    variableValues?: Record<string, string>,
  ) => Promise<boolean>;
  onFavorite: (prompt: ManagedImagePrompt) => Promise<boolean | undefined>;
  onApplied?: () => void;
}) {
  const [detail, setDetail] = useState(props.prompt);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const variables = useMemo(
    () =>
      getManagedImagePromptVariables(detail.variables, detail.promptText || ""),
    [detail.promptText, detail.variables],
  );
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getManagedImagePrompt(props.prompt.id)
      .then((prompt) => {
        if (!alive) return;
        setDetail(prompt);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "提示词详情加载失败");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [props.prompt.id]);

  useEffect(() => {
    setVariableValues((current) => {
      const next = { ...current };
      variables.forEach((variable) => {
        if (next[variable.name] === undefined) {
          next[variable.name] = variable.defaultValue || "";
        }
      });
      return next;
    });
  }, [variables]);

  const renderedPrompt = renderManagedImagePromptWithVariables(
    detail.promptText || "",
    variableValues,
  );

  return (
    <div className={styles["prompt-detail"]}>
      {loading && (
        <div className={styles["prompt-detail-loading"]}>
          <LoadingIcon />
        </div>
      )}
      {error && <div className={styles["inline-error"]}>{error}</div>}
      <div className={styles["prompt-detail-meta"]}>
        <span>版本 {detail.version || 1}</span>
        {detail.models.length > 0 && <span>{detail.models.join(" / ")}</span>}
        {detail.sizes.length > 0 && <span>{detail.sizes.join(" / ")}</span>}
        {detail.referenceRequirement && (
          <span>引用图: {detail.referenceRequirement}</span>
        )}
      </div>
      {detail.description && (
        <div className={styles["prompt-detail-note"]}>{detail.description}</div>
      )}
      {(detail.requiresReference || detail.referenceInstructions) && (
        <div className={styles["prompt-detail-note"]}>
          {detail.requiresReference ? "需要引用图" : "引用图可选"}
          {detail.referenceInstructions
            ? `：${detail.referenceInstructions}`
            : ""}
        </div>
      )}
      {detail.contentNotice && (
        <div className={styles["prompt-detail-note"]}>
          {detail.contentNotice}
        </div>
      )}
      {variables.length > 0 && (
        <div className={styles["prompt-variables"]}>
          {variables.map((variable) => (
            <label key={variable.name}>
              <span>
                {variable.label}
                {variable.required ? " *" : ""}
              </span>
              <textarea
                value={variableValues[variable.name] || ""}
                placeholder={variable.placeholder || variable.description}
                onChange={(event) =>
                  setVariableValues((values) => ({
                    ...values,
                    [variable.name]: event.currentTarget.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
      )}
      <textarea
        className={styles["prompt-detail-text"]}
        value={renderedPrompt}
        readOnly
      />
      <div className={styles["prompt-detail-actions"]}>
        <IconButton
          icon={<CopyIcon />}
          text="复制"
          onClick={() => copyToClipboard(renderedPrompt)}
          shadow
        />
        <IconButton
          text={detail.favorited ? "已收藏" : "收藏"}
          onClick={async () => {
            const favorited = await props.onFavorite(detail);
            if (favorited !== undefined) {
              setDetail(updateManagedImagePromptFavorite(detail, favorited));
            }
          }}
          shadow
        />
        <IconButton
          icon={<ImageIcon />}
          text="去创作"
          type="primary"
          onClick={async () => {
            const applied = await props.onApply(detail, variableValues);
            if (applied) props.onApplied?.();
          }}
          shadow
        />
      </div>
    </div>
  );
}

function updateManagedImagePromptFavorite(
  prompt: ManagedImagePrompt,
  favorited: boolean,
) {
  const delta = favorited === prompt.favorited ? 0 : favorited ? 1 : -1;
  return {
    ...prompt,
    favorited,
    favoriteCount: Math.max(0, prompt.favoriteCount + delta),
  };
}

function selectManagedImagePromptModel(
  prompt: ManagedImagePromptUseResult,
  models: Sub2APIImageStudioModel[],
  currentModelID?: string,
) {
  const recommended = prompt.models ?? [];
  if (recommended.length > 0) {
    const match = models.find((model) => recommended.includes(model.id));
    if (match) return match;
  }
  if (requiresPromptReference(prompt)) {
    return models.find((model) => canSub2APIImageStudioUseReferences(model));
  }
  return models.find((model) => model.id === currentModelID) || models[0];
}

function selectManagedImagePromptSize(
  prompt: ManagedImagePromptUseResult,
  model: Sub2APIImageStudioModel,
) {
  const sizes = prompt.sizes ?? [];
  if (sizes.length === 0) return undefined;
  const supported = model.supported_sizes ?? [];
  return sizes.find(
    (size) => supported.length === 0 || supported.includes(size),
  );
}

function requiresPromptReference(
  prompt: ManagedImagePromptUseResult | ManagedImagePrompt,
) {
  return (
    prompt.requiresReference ||
    String(prompt.referenceRequirement || "").toLowerCase() === "required"
  );
}
