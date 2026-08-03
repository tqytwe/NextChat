export type ContentWorkbenchScene =
  | "ecommerce"
  | "social"
  | "brand"
  | "service"
  | "custom";

export type ContentWorkbenchCopyField =
  | "title"
  | "sellingPoints"
  | "parameters"
  | "audience"
  | "platform"
  | "tone";

export type ContentWorkbenchShotLabel =
  | "main"
  | "angle"
  | "detail"
  | "lifestyle"
  | "sellingPoint"
  | "detailPage"
  | "poster"
  | "vertical"
  | "banner"
  | "socialCover"
  | "socialCarousel"
  | "brandHero"
  | "feature"
  | "workflow"
  | "download"
  | "customShot";

export interface ContentWorkbenchShotPlan {
  id: string;
  scene?: string;
  kind: string;
  label: string;
  labelKey?: ContentWorkbenchShotLabel;
  purpose: string;
  aspect: "square" | "portrait" | "landscape" | "custom";
  size: string;
  count: number;
  promptTemplate: string;
  copyFields: ContentWorkbenchCopyField[];
}

export interface ContentWorkbenchBrandControls {
  lockProduct: boolean;
  lockColor: boolean;
  lockLogo: boolean;
  composition: "center" | "left" | "right" | "closeup";
  safeArea: "none" | "top" | "bottom" | "left" | "right";
  videoIntent: boolean;
}

export interface ContentWorkbenchBrief {
  projectName: string;
  sellingPoints: string;
  parameters?: string;
  audience?: string;
  platform?: string;
  tone?: string;
  scene?: string;
  brandControls?: ContentWorkbenchBrandControls;
}

export interface ContentWorkbenchPreset {
  id: ContentWorkbenchScene;
  titleKey:
    | "presetEcommerce"
    | "presetSocial"
    | "presetBrand"
    | "presetService"
    | "presetCustom";
  hintKey:
    | "presetEcommerceHint"
    | "presetSocialHint"
    | "presetBrandHint"
    | "presetServiceHint"
    | "presetCustomHint";
  shots: ContentWorkbenchShotPlan[];
}

const DEFAULT_SHOT_BY_KIND: Record<string, ContentWorkbenchShotPlan> = {
  main: {
    id: "main",
    kind: "main",
    label: "Main visual",
    labelKey: "main",
    purpose: "primary listing or campaign hero visual",
    aspect: "square",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create a clean primary hero visual. Keep the subject unmistakable and the composition focused on the product or message.",
    copyFields: ["title", "sellingPoints"],
  },
  angle: {
    id: "angle",
    kind: "angle",
    label: "Product angles",
    labelKey: "angle",
    purpose: "alternate product angle or practical use view",
    aspect: "square",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create an alternate angle that shows a different useful side of the subject. Do not repeat the primary hero composition.",
    copyFields: ["sellingPoints"],
  },
  detail: {
    id: "detail",
    kind: "detail",
    label: "Detail close-up",
    labelKey: "detail",
    purpose: "material, mechanism, texture, or feature close-up",
    aspect: "square",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create a close-up that isolates a real material, mechanism, texture, or feature. Do not use the generic hero composition. Do not render readable text.",
    copyFields: ["sellingPoints", "parameters"],
  },
  lifestyle: {
    id: "lifestyle",
    kind: "lifestyle",
    label: "Lifestyle scene",
    labelKey: "lifestyle",
    purpose: "authentic contextual or lifestyle use scene",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create an authentic contextual scene with natural use, scale, and lighting. The subject must stay recognizable, but this is not a studio main image.",
    copyFields: ["audience", "platform", "tone"],
  },
  "selling-point": {
    id: "selling-point",
    kind: "selling-point",
    label: "Selling-point visual",
    labelKey: "sellingPoint",
    purpose: "selling-point information visual with editable copy areas",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create a visual base for a selling-point information card. Reserve clean modular areas for local title and bullet overlays. Do not generate readable text, numbers, or logos.",
    copyFields: ["title", "sellingPoints", "parameters"],
  },
  "detail-page": {
    id: "detail-page",
    kind: "detail-page",
    label: "Detail page module",
    labelKey: "detailPage",
    purpose: "e-commerce detail-page visual module with parameter-safe layout",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create a vertical e-commerce detail-page visual module. Show the feature clearly and reserve ordered blank areas for locally rendered specifications and selling points. Do not generate readable text.",
    copyFields: ["title", "sellingPoints", "parameters"],
  },
  poster: {
    id: "poster",
    kind: "poster",
    label: "Poster visual",
    labelKey: "poster",
    purpose: "campaign or brand poster visual with headline-safe space",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create a high-impact poster visual with a clear focal point and deliberate headline-safe space. Do not generate the headline as image text.",
    copyFields: ["title", "sellingPoints", "tone"],
  },
  vertical: {
    id: "vertical",
    kind: "vertical",
    label: "Vertical visual",
    labelKey: "vertical",
    purpose: "vertical mobile social or short-video cover visual",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create a vertical mobile-first visual for social publishing or a short-video cover. Keep the focal point clear on a small screen and reserve safe space for local copy.",
    copyFields: ["title", "sellingPoints", "platform"],
  },
  banner: {
    id: "banner",
    kind: "banner",
    label: "Banner visual",
    labelKey: "banner",
    purpose: "horizontal campaign or storefront banner",
    aspect: "landscape",
    size: "1536x1024",
    count: 1,
    promptTemplate:
      "Create a horizontal banner with an intentional focal side and a separate clean copy-safe area. Do not turn it into a square hero image.",
    copyFields: ["title", "sellingPoints", "platform"],
  },
  "social-cover": {
    id: "social-cover",
    kind: "social-cover",
    label: "Social cover",
    labelKey: "socialCover",
    purpose: "scroll-stopping social media cover",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create a scroll-stopping social cover that communicates one idea at a glance. Reserve a clear cover-title area and avoid tiny or unreadable generated text.",
    copyFields: ["title", "sellingPoints", "audience", "platform"],
  },
  "social-carousel": {
    id: "social-carousel",
    kind: "social-carousel",
    label: "Social carousel",
    labelKey: "socialCarousel",
    purpose: "social carousel card or explanatory post slide",
    aspect: "square",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create one coherent social carousel card with a visual story and a clean modular area for local explanatory copy. Do not repeat the cover composition.",
    copyFields: ["title", "sellingPoints", "parameters"],
  },
  "brand-hero": {
    id: "brand-hero",
    kind: "brand-hero",
    label: "Brand visual",
    labelKey: "brandHero",
    purpose: "brand campaign key visual",
    aspect: "square",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create a distinctive brand campaign key visual with an intentional art direction, memorable mood, and room for a locally rendered campaign line.",
    copyFields: ["title", "sellingPoints", "tone"],
  },
  feature: {
    id: "feature",
    kind: "feature",
    label: "Feature visual",
    labelKey: "feature",
    purpose: "app or service feature explainer visual",
    aspect: "square",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create a clean feature explainer visual that communicates one capability without relying on generated UI text. Leave a clear local-copy area.",
    copyFields: ["title", "sellingPoints", "parameters"],
  },
  workflow: {
    id: "workflow",
    kind: "workflow",
    label: "Workflow visual",
    labelKey: "workflow",
    purpose: "service process or workflow explainer visual",
    aspect: "landscape",
    size: "1536x1024",
    count: 1,
    promptTemplate:
      "Create a simple visual flow base with distinct stages and space for local step labels. Do not generate legible labels or interface text.",
    copyFields: ["title", "sellingPoints", "parameters"],
  },
  download: {
    id: "download",
    kind: "download",
    label: "Download poster",
    labelKey: "download",
    purpose: "app or service download and conversion poster",
    aspect: "portrait",
    size: "1024x1536",
    count: 1,
    promptTemplate:
      "Create a vertical conversion poster with a prominent device or service focal point and protected areas for local download and call-to-action copy.",
    copyFields: ["title", "sellingPoints", "platform"],
  },
  custom: {
    id: "custom",
    kind: "custom",
    label: "Custom shot",
    labelKey: "customShot",
    purpose: "custom visual direction",
    aspect: "custom",
    size: "1024x1024",
    count: 1,
    promptTemplate:
      "Create the requested custom visual direction. Make this composition meaningfully different from the main image and reserve copy space only when requested.",
    copyFields: ["title", "sellingPoints"],
  },
};

function cloneShot(shot: ContentWorkbenchShotPlan): ContentWorkbenchShotPlan {
  return {
    ...shot,
    copyFields: [...shot.copyFields],
  };
}

function sceneShot(
  kind: keyof typeof DEFAULT_SHOT_BY_KIND,
  overrides: Partial<ContentWorkbenchShotPlan> = {},
) {
  return { ...cloneShot(DEFAULT_SHOT_BY_KIND[kind]), ...overrides };
}

const CONTENT_WORKBENCH_PRESETS: ContentWorkbenchPreset[] = [
  {
    id: "ecommerce",
    titleKey: "presetEcommerce",
    hintKey: "presetEcommerceHint",
    shots: [
      sceneShot("main", { id: "listing-main", count: 2 }),
      sceneShot("angle", { id: "product-angle", count: 2 }),
      sceneShot("detail", { id: "material-detail", count: 2 }),
      sceneShot("lifestyle", { id: "use-scene", count: 2 }),
      sceneShot("selling-point", { id: "selling-point", count: 1 }),
      sceneShot("detail-page", { id: "detail-page", count: 1 }),
      sceneShot("banner", { id: "store-banner", count: 1 }),
    ],
  },
  {
    id: "social",
    titleKey: "presetSocial",
    hintKey: "presetSocialHint",
    shots: [
      sceneShot("social-cover", { id: "social-cover", count: 2 }),
      sceneShot("lifestyle", { id: "social-lifestyle", count: 2 }),
      sceneShot("social-carousel", { id: "carousel-card", count: 3 }),
      sceneShot("vertical", { id: "short-video-cover", count: 2 }),
    ],
  },
  {
    id: "brand",
    titleKey: "presetBrand",
    hintKey: "presetBrandHint",
    shots: [
      sceneShot("brand-hero", { id: "brand-hero", count: 2 }),
      sceneShot("poster", { id: "campaign-poster", count: 2 }),
      sceneShot("lifestyle", { id: "brand-lifestyle", count: 2 }),
      sceneShot("banner", { id: "brand-banner", count: 1 }),
    ],
  },
  {
    id: "service",
    titleKey: "presetService",
    hintKey: "presetServiceHint",
    shots: [
      sceneShot("feature", { id: "feature-card", count: 3 }),
      sceneShot("workflow", { id: "workflow", count: 1 }),
      sceneShot("download", { id: "download-poster", count: 2 }),
      sceneShot("banner", { id: "service-banner", count: 1 }),
    ],
  },
  {
    id: "custom",
    titleKey: "presetCustom",
    hintKey: "presetCustomHint",
    shots: [],
  },
];

export function contentWorkbenchPresets(): ContentWorkbenchPreset[] {
  return CONTENT_WORKBENCH_PRESETS.map((preset) => ({
    ...preset,
    shots: preset.shots.map((shot) => ({
      ...cloneShot(shot),
      scene: shot.scene || preset.id,
    })),
  }));
}

export function contentWorkbenchPlan(
  scene: string,
): ContentWorkbenchShotPlan[] {
  const preset = CONTENT_WORKBENCH_PRESETS.find((item) => item.id === scene);
  return (
    preset?.shots.map((shot) => ({
      ...cloneShot(shot),
      scene: shot.scene || preset.id,
    })) || []
  );
}

export function contentWorkbenchCustomShot(
  id = `custom-${Date.now()}`,
): ContentWorkbenchShotPlan {
  return { ...cloneShot(DEFAULT_SHOT_BY_KIND.custom), id, scene: "custom" };
}

export function contentWorkbenchShotOptions(): ContentWorkbenchShotPlan[] {
  return Object.values(DEFAULT_SHOT_BY_KIND).map(cloneShot);
}

export function normalizeContentWorkbenchShot(
  shot: Partial<ContentWorkbenchShotPlan> & { id?: string; kind?: string },
): ContentWorkbenchShotPlan {
  const fallback =
    DEFAULT_SHOT_BY_KIND[shot.kind || ""] || DEFAULT_SHOT_BY_KIND.custom;
  const count = Math.max(1, Math.min(6, Number(shot.count || fallback.count)));
  return {
    ...cloneShot(fallback),
    ...shot,
    id: shot.id || fallback.id,
    scene: shot.scene || fallback.scene || "custom",
    kind: shot.kind || fallback.kind,
    label: shot.label || fallback.label,
    purpose: shot.purpose || fallback.purpose,
    aspect: shot.aspect || fallback.aspect,
    size: shot.size || fallback.size,
    count,
    promptTemplate: shot.promptTemplate || fallback.promptTemplate,
    copyFields:
      Array.isArray(shot.copyFields) && shot.copyFields.length
        ? shot.copyFields
        : [...fallback.copyFields],
  };
}

function briefValue(
  brief: ContentWorkbenchBrief,
  field: ContentWorkbenchCopyField,
) {
  if (field === "title") return brief.projectName.trim();
  return String(brief[field] || "").trim();
}

function contentWorkbenchControls(controls?: ContentWorkbenchBrandControls) {
  if (!controls) return [];
  return [
    controls.lockProduct &&
      "Preserve the subject identity, shape, and packaging.",
    controls.lockColor && "Preserve the primary colors.",
    controls.lockLogo &&
      "Preserve real visible branding without inventing text.",
    `Composition preference: ${controls.composition}.`,
    controls.safeArea !== "none" &&
      `Reserve a clean copy-safe area on the ${controls.safeArea}.`,
    controls.videoIntent &&
      "Use a clean layered composition suitable for later motion editing.",
  ].filter((value): value is string => Boolean(value));
}

export function buildContentWorkbenchPrompt(
  brief: ContentWorkbenchBrief,
  inputShot: ContentWorkbenchShotPlan,
) {
  const shot = normalizeContentWorkbenchShot(inputShot);
  const subject = brief.projectName.trim();
  const context = shot.copyFields
    .filter((field) => field !== "title")
    .map((field) => {
      const value = briefValue(brief, field);
      if (!value) return "";
      if (field === "title") return `Subject: ${value}.`;
      if (field === "sellingPoints") return `Key information: ${value}.`;
      if (field === "parameters")
        return `Specifications to support with local copy: ${value}.`;
      if (field === "audience") return `Audience: ${value}.`;
      if (field === "platform") return `Publishing context: ${value}.`;
      return `Tone: ${value}.`;
    })
    .filter(Boolean);
  const controls = contentWorkbenchControls(brief.brandControls);
  return [
    `Scene: ${brief.scene || "custom"}.`,
    subject && `Subject: ${subject}.`,
    `Shot purpose: ${shot.purpose}.`,
    shot.promptTemplate,
    `Target aspect: ${shot.aspect}; requested size: ${shot.size}.`,
    ...context,
    ...controls,
    "When reference images are attached, use them only to preserve identity and visual facts; follow this shot purpose instead of recreating the reference as a generic main image.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildContentWorkbenchCopyPrompt(brief: ContentWorkbenchBrief) {
  const scene = brief.scene || "custom";
  const details = [
    `Create publishing copy for the ${scene} content project “${brief.projectName}”.`,
    `Core information: ${brief.sellingPoints}.`,
    brief.parameters && `Parameters or facts: ${brief.parameters}.`,
    `Audience: ${brief.audience || "general"}.`,
    `Platform: ${brief.platform || "general"}.`,
    `Tone: ${brief.tone || "clear"}.`,
    "Return a title, 3-5 concise selling points, and one ready-to-publish post in the user's language.",
    "For detail-page or information visuals, keep factual parameters as editable copy rather than asking the image model to render them.",
  ].filter(Boolean);
  return details.join(" ");
}
