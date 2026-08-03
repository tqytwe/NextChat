import type {
  ContentWorkbenchBrief,
  ContentWorkbenchShotPlan,
} from "./content-workbench";

const DEFAULT_MAX_DIMENSION = 2048;
const MAX_ALLOWED_DIMENSION = 4096;

type ContentTextOverlayKind =
  | "selling-point"
  | "detail-page"
  | "poster"
  | "banner"
  | "social-cover";

type ContentTextOverlayBlockKind = "title" | "selling-point" | "parameter";

export interface ContentTextOverlayBlock {
  kind: ContentTextOverlayBlockKind;
  text: string;
}

export interface ContentTextOverlayInput {
  imageDataUrl: string;
  brief: ContentWorkbenchBrief;
  shot: ContentWorkbenchShotPlan;
  /** Caps the generated PNG dimensions. Values are clamped to 512-4096. */
  maxDimension?: number;
}

export interface ContentTextOverlayResult {
  dataUrl: string;
  width: number;
  height: number;
  applied: boolean;
}

export interface ContentTextOverlayPlacement {
  edge: "top" | "bottom" | "left" | "right";
  panelWidth: number;
  maxPanelHeight: number;
  margin: number;
}

interface OverlayTextLine {
  text: string;
  kind: ContentTextOverlayBlockKind;
  font: string;
  lineHeight: number;
  color: string;
}

interface OverlayTextLayout {
  lines: OverlayTextLine[];
  height: number;
}

function isContentTextOverlayKind(
  kind: string,
): kind is ContentTextOverlayKind {
  return (
    kind === "selling-point" ||
    kind === "detail-page" ||
    kind === "poster" ||
    kind === "banner" ||
    kind === "social-cover"
  );
}

function allowsCopyField(
  shot: ContentWorkbenchShotPlan,
  field: "title" | "sellingPoints" | "parameters",
) {
  return !Array.isArray(shot.copyFields) || shot.copyFields.includes(field);
}

function splitRawCopy(value?: string) {
  if (!value || !value.trim()) return [];
  return value
    .split(/\r?\n|[；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Returns raw user-provided copy. This intentionally performs no translation,
 * rewriting, or factual expansion before local rendering.
 */
export function contentTextOverlayBlocks(
  brief: ContentWorkbenchBrief,
  shot: ContentWorkbenchShotPlan,
): ContentTextOverlayBlock[] {
  if (!isContentTextOverlayKind(shot.kind)) return [];

  const title = brief.projectName && brief.projectName.trim();
  const blocks: ContentTextOverlayBlock[] = [];
  if (title && allowsCopyField(shot, "title")) {
    blocks.push({ kind: "title", text: title });
  }

  if (shot.kind !== "selling-point" && shot.kind !== "detail-page") {
    return blocks;
  }

  if (allowsCopyField(shot, "sellingPoints")) {
    for (const text of splitRawCopy(brief.sellingPoints)) {
      blocks.push({ kind: "selling-point", text });
    }
  }
  if (allowsCopyField(shot, "parameters")) {
    for (const text of splitRawCopy(brief.parameters)) {
      blocks.push({ kind: "parameter", text });
    }
  }
  return blocks;
}

export function shouldRenderContentTextOverlay(
  brief: ContentWorkbenchBrief,
  shot: ContentWorkbenchShotPlan,
) {
  return contentTextOverlayBlocks(brief, shot).length > 0;
}

function normalizeMaxDimension(value?: number) {
  const requested = Number.isFinite(value) ? Math.round(Number(value)) : 0;
  if (!requested) return DEFAULT_MAX_DIMENSION;
  return Math.max(512, Math.min(MAX_ALLOWED_DIMENSION, requested));
}

function parseRequestedSize(size: string | undefined) {
  const match = String(size || "").match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Keeps export canvases inside a bounded pixel budget instead of trusting an
 * arbitrary upstream image size.
 */
export function chooseContentTextOverlayDimensions(
  source: Pick<
    HTMLImageElement,
    "naturalWidth" | "naturalHeight" | "width" | "height"
  >,
  shot: Pick<ContentWorkbenchShotPlan, "size" | "aspect">,
  maxDimension?: number,
) {
  const requested = parseRequestedSize(shot.size);
  const fallback =
    requested ||
    (shot.aspect === "portrait"
      ? { width: 1024, height: 1536 }
      : shot.aspect === "landscape"
      ? { width: 1536, height: 1024 }
      : { width: 1024, height: 1024 });
  const sourceWidth = Math.round(Number(source.naturalWidth || source.width));
  const sourceHeight = Math.round(
    Number(source.naturalHeight || source.height),
  );
  const width = sourceWidth > 0 ? sourceWidth : fallback.width;
  const height = sourceHeight > 0 ? sourceHeight : fallback.height;
  const cap = normalizeMaxDimension(maxDimension);
  const scale = Math.min(1, cap / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function resolveEdge(
  brief: ContentWorkbenchBrief,
  shot: ContentWorkbenchShotPlan,
  width: number,
  height: number,
): ContentTextOverlayPlacement["edge"] {
  const requested = brief.brandControls?.safeArea;
  if (requested && requested !== "none") return requested;
  if (brief.brandControls?.composition === "left") return "right";
  if (brief.brandControls?.composition === "right") return "left";
  if (shot.kind === "banner" || width > height) return "right";
  return "bottom";
}

export function resolveContentTextOverlayPlacement(
  brief: ContentWorkbenchBrief,
  shot: ContentWorkbenchShotPlan,
  width: number,
  height: number,
): ContentTextOverlayPlacement {
  const shortestSide = Math.max(1, Math.min(width, height));
  const margin = Math.max(12, Math.min(64, Math.round(shortestSide * 0.035)));
  const edge = resolveEdge(brief, shot, width, height);
  const sidePanel = edge === "left" || edge === "right";
  return {
    edge,
    panelWidth: sidePanel
      ? Math.max(1, Math.round(Math.min(width - margin * 2, width * 0.48)))
      : Math.max(1, width - margin * 2),
    maxPanelHeight: sidePanel
      ? Math.max(1, height - margin * 2)
      : Math.max(1, Math.round(height * 0.52)),
    margin,
  };
}

function wrapContentText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const tokens = /\s/.test(paragraph)
      ? paragraph.split(/(\s+)/).filter(Boolean)
      : Array.from(paragraph);
    let line = "";
    for (const token of tokens) {
      const candidate = line + token;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = candidate;
      }
    }
    if (line || !lines.length) lines.push(line.trimEnd());
  }
  return lines;
}

function textStyle(
  kind: ContentTextOverlayBlockKind,
  shortestSide: number,
  scale: number,
) {
  const titleSize =
    Math.max(18, Math.min(58, Math.round(shortestSide * 0.052))) * scale;
  const bodySize =
    Math.max(14, Math.min(38, Math.round(shortestSide * 0.031))) * scale;
  if (kind === "title") {
    return {
      font: `700 ${Math.round(titleSize)}px sans-serif`,
      lineHeight: Math.round(titleSize * 1.24),
      color: "#ffffff",
    };
  }
  if (kind === "parameter") {
    const size = Math.round(bodySize * 0.92);
    return {
      font: `500 ${size}px sans-serif`,
      lineHeight: Math.round(size * 1.4),
      color: "#d9e3ee",
    };
  }
  return {
    font: `600 ${Math.round(bodySize)}px sans-serif`,
    lineHeight: Math.round(bodySize * 1.42),
    color: "#ffffff",
  };
}

function layoutContentText(
  context: CanvasRenderingContext2D,
  blocks: ContentTextOverlayBlock[],
  contentWidth: number,
  maxContentHeight: number,
  shortestSide: number,
) {
  for (let scale = 1; scale >= 0.5; scale -= 0.05) {
    const lines: OverlayTextLine[] = [];
    let height = 0;
    for (const block of blocks) {
      const style = textStyle(block.kind, shortestSide, scale);
      context.font = style.font;
      const prefix = block.kind === "selling-point" ? "• " : "";
      const wrapped = wrapContentText(
        context,
        prefix + block.text,
        contentWidth,
      );
      for (const text of wrapped) {
        lines.push({ text, kind: block.kind, ...style });
        height += style.lineHeight;
      }
      height += Math.round(
        style.lineHeight * (block.kind === "title" ? 0.34 : 0.16),
      );
    }
    if (height <= maxContentHeight) return { lines, height };
  }
  throw new Error("content text is too long to fit safely on this image");
}

function panelCoordinates(
  placement: ContentTextOverlayPlacement,
  canvasWidth: number,
  canvasHeight: number,
  panelHeight: number,
) {
  const { edge, panelWidth, margin } = placement;
  if (edge === "top") return { x: margin, y: margin };
  if (edge === "bottom")
    return { x: margin, y: canvasHeight - margin - panelHeight };
  if (edge === "left") {
    return { x: margin, y: Math.round((canvasHeight - panelHeight) / 2) };
  }
  return {
    x: canvasWidth - margin - panelWidth,
    y: Math.round((canvasHeight - panelHeight) / 2),
  };
}

function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
  if (typeof Image === "undefined") {
    return Promise.reject(
      new Error("content text overlay requires a browser image API"),
    );
  }
  if (!/^data:image\//i.test(dataUrl)) {
    return Promise.reject(
      new Error("content text overlay requires an image data URL"),
    );
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("content text overlay image could not be read"));
    image.src = dataUrl;
  });
}

/**
 * Locally renders editable factual copy over a generated image. It never
 * uploads the source image or copy, and it returns the original data URL for
 * visual types that intentionally do not carry local text.
 */
export async function renderContentTextOverlay(
  input: ContentTextOverlayInput,
): Promise<ContentTextOverlayResult> {
  const blocks = contentTextOverlayBlocks(input.brief, input.shot);
  if (!blocks.length) {
    return {
      dataUrl: input.imageDataUrl,
      width: 0,
      height: 0,
      applied: false,
    };
  }
  if (typeof document === "undefined") {
    throw new Error("content text overlay requires a browser canvas");
  }

  const image = await loadDataUrlImage(input.imageDataUrl);
  const dimensions = chooseContentTextOverlayDimensions(
    image,
    input.shot,
    input.maxDimension,
  );
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("content text overlay canvas is unavailable");

  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  const placement = resolveContentTextOverlayPlacement(
    input.brief,
    input.shot,
    dimensions.width,
    dimensions.height,
  );
  const padding = Math.max(
    12,
    Math.min(
      56,
      Math.round(Math.min(dimensions.width, dimensions.height) * 0.035),
    ),
  );
  const layout = layoutContentText(
    context,
    blocks,
    Math.max(1, placement.panelWidth - padding * 2),
    Math.max(1, placement.maxPanelHeight - padding * 2),
    Math.min(dimensions.width, dimensions.height),
  );
  const panelHeight = Math.min(
    placement.maxPanelHeight,
    Math.max(layout.height + padding * 2, padding * 3),
  );
  const position = panelCoordinates(
    placement,
    dimensions.width,
    dimensions.height,
    panelHeight,
  );

  context.fillStyle = "rgba(8, 15, 27, 0.84)";
  context.fillRect(position.x, position.y, placement.panelWidth, panelHeight);
  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  if (placement.edge === "top" || placement.edge === "bottom") {
    context.fillRect(
      position.x,
      position.y,
      placement.panelWidth,
      Math.max(3, Math.round(padding * 0.16)),
    );
  } else {
    context.fillRect(
      position.x,
      position.y,
      Math.max(3, Math.round(padding * 0.16)),
      panelHeight,
    );
  }

  let y = position.y + padding;
  for (const line of layout.lines) {
    context.font = line.font;
    context.fillStyle = line.color;
    context.textBaseline = "top";
    context.fillText(line.text, position.x + padding, y);
    y += line.lineHeight;
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: dimensions.width,
    height: dimensions.height,
    applied: true,
  };
}

export async function renderContentTextOverlayDataUrl(
  input: ContentTextOverlayInput,
) {
  return (await renderContentTextOverlay(input)).dataUrl;
}
